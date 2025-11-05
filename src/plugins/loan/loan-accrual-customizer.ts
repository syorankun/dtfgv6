import { logger } from '@core/storage-utils-consolidated';
import type { PluginContext } from '@core/types';
import {
  DEFAULT_ACCRUAL_VIEW,
  FX_VARIATION_FOCUS_VIEW,
  cloneAccrualViewConfig,
  type AccrualSheetViewConfig
} from './loan-accrual-view';

const STORAGE_KEY_VIEWS = 'loan:accrual:views';
const STORAGE_KEY_SELECTION = 'loan:accrual:view-selection';

export interface AccrualViewProfile {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  category?: string;
  builtIn?: boolean;
  createdAt: string;
  updatedAt: string;
  view: AccrualSheetViewConfig;
}

interface AccrualViewSelection {
  global: string;
  perContract: Record<string, string>;
}

export interface AccrualViewProfileInput {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  category?: string;
  view: AccrualSheetViewConfig;
}

export interface RegisterAccrualViewEvent {
  profile: AccrualViewProfileInput;
  persist?: boolean;
  setActive?: boolean;
  contractId?: string;
}

export interface SetAccrualViewEvent {
  viewId: string;
  contractId?: string;
}

export class LoanAccrualCustomizer {
  private views: Map<string, AccrualViewProfile> = new Map();
  private selection: AccrualViewSelection = { global: DEFAULT_ACCRUAL_VIEW.id, perContract: {} };
  private initialized = false;
  private boundRegisterHandler?: (payload: RegisterAccrualViewEvent) => void;
  private boundSetHandler?: (payload: SetAccrualViewEvent) => void;

  constructor(private context: PluginContext) {}

  public async init(): Promise<void> {
    if (this.initialized) return;

    await this.loadProfiles();
    await this.ensureBuiltInProfiles();
    await this.loadSelection();
    this.ensureSelectionDefaults();
    this.bindEvents();

    this.initialized = true;
    logger.info('[LoanAccrualCustomizer] Inicializado com ' + this.views.size + ' layouts');
  }

  public listProfiles(): AccrualViewProfile[] {
    return Array.from(this.views.values()).map(profile => ({
      ...profile,
      view: cloneAccrualViewConfig(profile.view)
    }));
  }

  public getProfile(viewId: string): AccrualViewProfile | undefined {
    const profile = this.views.get(viewId);
    if (!profile) return undefined;
    return {
      ...profile,
      view: cloneAccrualViewConfig(profile.view)
    };
  }

  public resolveView(contractId?: string): { profile: AccrualViewProfile; view: AccrualSheetViewConfig } {
    const viewId = contractId ? this.selection.perContract[contractId] || this.selection.global : this.selection.global;
    const profile = this.views.get(viewId) || this.views.get(DEFAULT_ACCRUAL_VIEW.id);
    if (!profile) {
      // fallback to first view available or default constant
      const fallbackView = cloneAccrualViewConfig(DEFAULT_ACCRUAL_VIEW);
      const fallbackProfile: AccrualViewProfile = {
        id: DEFAULT_ACCRUAL_VIEW.id,
        name: 'Padrão',
        description: DEFAULT_ACCRUAL_VIEW.description,
        builtIn: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        view: fallbackView
      };
      this.views.set(fallbackProfile.id, fallbackProfile);
      this.selection.global = fallbackProfile.id;
      return { profile: { ...fallbackProfile }, view: cloneAccrualViewConfig(fallbackProfile.view) };
    }

    return {
      profile: {
        ...profile,
        view: cloneAccrualViewConfig(profile.view)
      },
      view: cloneAccrualViewConfig(profile.view)
    };
  }

  public async setActiveView(viewId: string, contractId?: string): Promise<boolean> {
    if (!this.views.has(viewId)) {
      return false;
    }

    if (contractId) {
      if (!contractId.trim()) {
        return false;
      }
      this.selection.perContract[contractId] = viewId;
    } else {
      this.selection.global = viewId;
    }

    await this.saveSelection();
    return true;
  }

  public async registerOrUpdateProfile(profileInput: AccrualViewProfileInput, options?: { builtIn?: boolean; persist?: boolean; setActive?: boolean; contractId?: string }): Promise<AccrualViewProfile> {
    const now = new Date().toISOString();
    const existing = this.views.get(profileInput.id);

    const clonedView = cloneAccrualViewConfig(profileInput.view);
    clonedView.id = profileInput.id;

    const profile: AccrualViewProfile = {
      id: profileInput.id,
      name: profileInput.name,
      description: profileInput.description,
      tags: profileInput.tags,
      category: profileInput.category,
      builtIn: options?.builtIn ?? existing?.builtIn ?? false,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      view: clonedView
    };

    this.views.set(profile.id, profile);

    if (options?.persist ?? true) {
      await this.saveProfiles();
    }

    if (options?.setActive) {
      await this.setActiveView(profile.id, options.contractId);
    } else if (!existing && profile.builtIn && this.selection.global === DEFAULT_ACCRUAL_VIEW.id && profile.id !== DEFAULT_ACCRUAL_VIEW.id) {
      // keep default global unless specifically requested
    }

    return profile;
  }

  public getActiveViewId(contractId?: string): string {
    return contractId ? this.selection.perContract[contractId] || this.selection.global : this.selection.global;
  }

  private bindEvents(): void {
    if (!this.context?.events) return;

    this.boundRegisterHandler = (payload: RegisterAccrualViewEvent) => {
      if (!payload || typeof payload !== 'object') return;
      const { profile, persist = true, setActive = false, contractId } = payload;
      if (!profile?.id || !profile.view) {
        logger.warn('[LoanAccrualCustomizer] Payload inválido em registerView');
        return;
      }
      this.registerOrUpdateProfile(profile, { persist, setActive, contractId }).catch(error => {
        logger.error('[LoanAccrualCustomizer] Erro ao registrar layout via evento', error);
      });
    };

    this.boundSetHandler = (payload: SetAccrualViewEvent) => {
      if (!payload || typeof payload !== 'object') return;
      if (!payload.viewId) return;
      this.setActiveView(payload.viewId, payload.contractId).catch(error => {
        logger.error('[LoanAccrualCustomizer] Erro ao aplicar layout via evento', error);
      });
    };

    this.context.events.on('loan:accrual:registerView', this.boundRegisterHandler);
    this.context.events.on('loan:accrual:setActiveView', this.boundSetHandler);
  }

  private async loadProfiles(): Promise<void> {
    try {
      const raw = await this.context.storage.get(STORAGE_KEY_VIEWS);
      if (!raw) return;

      if (Array.isArray(raw)) {
        raw.forEach(item => this.hydrateProfile(item));
      } else if (typeof raw === 'object') {
        Object.values(raw as Record<string, unknown>).forEach(item => this.hydrateProfile(item));
      }
    } catch (error) {
      logger.warn('[LoanAccrualCustomizer] Não foi possível carregar layouts do storage', error);
    }
  }

  private hydrateProfile(raw: any): void {
    if (!raw || typeof raw !== 'object') return;
    if (!raw.id || !raw.view) return;

    const profile: AccrualViewProfile = {
      id: String(raw.id),
      name: String(raw.name || raw.id),
      description: raw.description ? String(raw.description) : undefined,
      tags: Array.isArray(raw.tags) ? raw.tags.map(String) : undefined,
      category: raw.category ? String(raw.category) : undefined,
      builtIn: Boolean(raw.builtIn),
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
      view: cloneAccrualViewConfig({ ...raw.view, id: raw.view.id || raw.id })
    };

    this.views.set(profile.id, profile);
  }

  private async ensureBuiltInProfiles(): Promise<void> {
    const builtIns: AccrualViewProfileInput[] = [
      {
        id: DEFAULT_ACCRUAL_VIEW.id,
        name: 'Layout Padrão',
        description: DEFAULT_ACCRUAL_VIEW.description,
        tags: ['padrão', 'completo'],
        view: DEFAULT_ACCRUAL_VIEW
      },
      {
        id: FX_VARIATION_FOCUS_VIEW.id,
        name: 'FX & Juros',
        description: FX_VARIATION_FOCUS_VIEW.description,
        tags: ['fx', 'variação'],
        view: FX_VARIATION_FOCUS_VIEW
      }
    ];

    for (const builtIn of builtIns) {
      const existing = this.views.get(builtIn.id);
      await this.registerOrUpdateProfile(builtIn, { builtIn: true, persist: false });
      if (!existing && builtIn.id === DEFAULT_ACCRUAL_VIEW.id) {
        this.selection.global = builtIn.id;
      }
    }

    await this.saveProfiles();
  }

  private ensureSelectionDefaults(): void {
    if (!this.selection.global || !this.views.has(this.selection.global)) {
      this.selection.global = DEFAULT_ACCRUAL_VIEW.id;
    }

    Object.keys(this.selection.perContract).forEach(contractId => {
      const viewId = this.selection.perContract[contractId];
      if (!this.views.has(viewId)) {
        delete this.selection.perContract[contractId];
      }
    });
  }

  private async loadSelection(): Promise<void> {
    try {
      const raw = await this.context.storage.get(STORAGE_KEY_SELECTION);
      if (!raw || typeof raw !== 'object') return;

      const selectionRaw = raw as Partial<AccrualViewSelection>;
      this.selection = {
        global: typeof selectionRaw.global === 'string' ? selectionRaw.global : DEFAULT_ACCRUAL_VIEW.id,
        perContract: selectionRaw.perContract && typeof selectionRaw.perContract === 'object' ? { ...selectionRaw.perContract } : {}
      };
    } catch (error) {
      logger.warn('[LoanAccrualCustomizer] Não foi possível carregar seleção de layout', error);
    }
  }

  private async saveProfiles(): Promise<void> {
    try {
      const serialized = Array.from(this.views.values()).map(profile => ({
        ...profile,
        view: cloneAccrualViewConfig(profile.view)
      }));
      await this.context.storage.set(STORAGE_KEY_VIEWS, serialized);
    } catch (error) {
      logger.error('[LoanAccrualCustomizer] Erro ao salvar layouts', error);
    }
  }

  private async saveSelection(): Promise<void> {
    try {
      await this.context.storage.set(STORAGE_KEY_SELECTION, this.selection);
    } catch (error) {
      logger.error('[LoanAccrualCustomizer] Erro ao salvar seleção de layout', error);
    }
  }
}
