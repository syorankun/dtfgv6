/**
 * DJ DataForge v6 - Kernel (Orquestrador Central)
 * 
 * O Kernel é o maestro que gerencia todos os componentes do sistema:
 * - WorkbookManager: gerencia workbooks e sheets
 * - CalcEngine: executa fórmulas e recálculos
 * - PersistenceManager: salva/carrega dados do IndexedDB
 * - CompanyManager: gerencia contextos multi-empresa
 * - PluginHost: carrega e gerencia plugins
 * 
 * Este é um arquivo consolidado. Não dividir ainda.
 */

import { nanoid } from 'nanoid';
import { WorkbookManager, Workbook } from './workbook-consolidated';
import { CalcEngine } from './calc-engine-consolidated';
import { PersistenceManager, logger, Perf } from './storage-utils-consolidated';
import { PluginHost } from './plugin-system-consolidated';
import type { KernelState, KernelContext, CompanyContext, Session } from './types';

// ============================================================================
// EVENT BUS (Simple pub/sub)
// ============================================================================

class EventBus {
  private listeners: Map<string, Set<Function>> = new Map();
  
  on(event: string, handler: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }
  
  off(event: string, handler: Function): void {
    this.listeners.get(event)?.delete(handler);
  }
  
  emit(event: string, payload?: any): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(payload);
        } catch (error) {
          logger.error(`[EventBus] Handler error for ${event}`, error);
        }
      });
    }
  }
  
  clear(): void {
    this.listeners.clear();
  }
}

// ============================================================================
// COMPANY MANAGER
// ============================================================================

class CompanyManager {
  private companies: Map<string, CompanyContext> = new Map();
  private activeCompanyId?: string;
  private storage: PersistenceManager;
  
  constructor(storage: PersistenceManager) {
    this.storage = storage;
  }
  
  async init(): Promise<void> {
    // Load companies from storage
    const companiesData = await this.storage.getAllCompanies();
    
    for (const data of companiesData) {
      this.companies.set(data.id, data);
    }
    
    // Get last active company
    const lastActiveId = await this.storage.getSetting("lastActiveCompany");
    
    if (lastActiveId && this.companies.has(lastActiveId)) {
      this.activeCompanyId = lastActiveId;
    } else if (this.companies.size > 0) {
      // Set first company as active
      this.activeCompanyId = this.companies.keys().next().value;
    } else {
      // Create default company
      const defaultCompany = await this.createCompany("Minha Empresa");
      this.activeCompanyId = defaultCompany.id;
    }
    
    logger.info("[CompanyManager] Initialized", {
      companies: this.companies.size,
      active: this.activeCompanyId,
    });
  }
  
  async createCompany(name: string, options?: Partial<CompanyContext>): Promise<CompanyContext> {
    const company: CompanyContext = {
      id: options?.id || nanoid(),
      name,
      logo: options?.logo,
      settings: options?.settings || {
        locale: "pt-BR",
        currency: "BRL",
        dateFormat: "DD/MM/YYYY",
        numberFormat: "#,##0.00",
        decimals: 2,
        timezone: "America/Sao_Paulo",
      },
      workbooks: [],
      plugins: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    this.companies.set(company.id, company);
    await this.storage.saveCompany(company);
    
    logger.info("[CompanyManager] Company created", { id: company.id, name });
    
    return company;
  }
  
  getCompany(id: string): CompanyContext | undefined {
    return this.companies.get(id);
  }
  
  getActiveCompany(): CompanyContext | undefined {
    return this.activeCompanyId ? this.companies.get(this.activeCompanyId) : undefined;
  }
  
  async setActiveCompany(id: string): Promise<boolean> {
    if (!this.companies.has(id)) {
      logger.warn("[CompanyManager] Company not found", { id });
      return false;
    }
    
    this.activeCompanyId = id;
    await this.storage.saveSetting("lastActiveCompany", id);
    
    logger.info("[CompanyManager] Active company changed", { id });
    return true;
  }
  
  listCompanies(): CompanyContext[] {
    return Array.from(this.companies.values());
  }
  
  async updateCompany(id: string, updates: Partial<CompanyContext>): Promise<void> {
    const company = this.companies.get(id);
    if (!company) throw new Error(`Company not found: ${id}`);
    
    Object.assign(company, updates);
    company.updatedAt = new Date();
    
    await this.storage.saveCompany(company);
    logger.info("[CompanyManager] Company updated", { id });
  }
  
  async deleteCompany(id: string): Promise<boolean> {
    if (this.companies.size <= 1) {
      logger.warn("[CompanyManager] Cannot delete last company");
      return false;
    }
    
    const deleted = this.companies.delete(id);
    
    if (deleted) {
      await this.storage.deleteCompany(id);
      
      if (this.activeCompanyId === id) {
        this.activeCompanyId = this.companies.keys().next().value;
        await this.storage.saveSetting("lastActiveCompany", this.activeCompanyId);
      }
      
      logger.info("[CompanyManager] Company deleted", { id });
    }
    
    return deleted;
  }
  
  serialize(): any {
    const companies: any[] = [];
    this.companies.forEach(c => companies.push(c));
    
    return {
      activeCompanyId: this.activeCompanyId,
      companies,
    };
  }
}

// ============================================================================
// SESSION MANAGER
// ============================================================================

class SessionManager {
  private session?: Session;
  private activityTimer?: number;
  
  start(companyId: string, userId?: string): void {
    this.session = {
      id: nanoid(),
      companyId,
      userId,
      startedAt: new Date(),
      lastActivityAt: new Date(),
    };
    
    this.startActivityTracking();
    logger.info("[Session] Started", { sessionId: this.session.id });
  }
  
  updateActivity(): void {
    if (this.session) {
      this.session.lastActivityAt = new Date();
    }
  }
  
  setActiveWorkbook(workbookId: string): void {
    if (this.session) {
      this.session.activeWorkbookId = workbookId;
    }
  }
  
  getSession(): Session | undefined {
    return this.session;
  }
  
  private startActivityTracking(): void {
    // Update activity every 30 seconds
    this.activityTimer = window.setInterval(() => {
      this.updateActivity();
    }, 30000);
    
    // Listen to user interactions
    const events = ['click', 'keydown', 'scroll', 'mousemove'];
    events.forEach(event => {
      document.addEventListener(event, () => this.updateActivity(), { passive: true });
    });
  }
  
  end(): void {
    if (this.activityTimer) {
      clearInterval(this.activityTimer);
    }
    
    logger.info("[Session] Ended", { sessionId: this.session?.id });
    this.session = undefined;
  }
}

// ============================================================================
// KERNEL (Main orchestrator)
// ============================================================================

export class DJDataForgeKernel {
  private static instance?: DJDataForgeKernel;
  
  readonly version = "6.0.0";
  
  // State
  state: KernelState = "init";
  
  // Core managers
  workbookManager: WorkbookManager;
  calcEngine: CalcEngine;
  storageManager: PersistenceManager;
  companyManager: CompanyManager;
  sessionManager: SessionManager;
  eventBus: EventBus;
  pluginHost: PluginHost;
  
  // Auto-save
  private autoSaveTimer?: number;
  private grid?: any;
  
  private constructor() {
    this.workbookManager = new WorkbookManager();
    this.calcEngine = new CalcEngine();
    this.storageManager = new PersistenceManager();
    this.companyManager = new CompanyManager(this.storageManager);
    this.sessionManager = new SessionManager();
    this.eventBus = new EventBus();
    this.pluginHost = new PluginHost(this, this.storageManager);

    logger.info(`[Kernel] DJ DataForge v${this.version} initialized`);
  }
  
  // --------------------------------------------------------------------------
  // LIFECYCLE
  // --------------------------------------------------------------------------
  
  async init(): Promise<void> {
    if (this.state !== "init") {
      logger.warn("[Kernel] Already initialized");
      return;
    }
    
    try {
      logger.info("[Kernel] Initializing...");
      Perf.start("kernel-init");
      
      // 1. Initialize storage
      await this.storageManager.init();
      
      // 2. Initialize company manager
      await this.companyManager.init();
      
      // 3. Initialize calc engine
      await this.calcEngine.init();
      
      // 4. Load workbooks for active company
      const activeCompany = this.companyManager.getActiveCompany();
      if (activeCompany) {
        const workbooksData = await this.storageManager.getAllWorkbooks(activeCompany.id);
        
        if (workbooksData.length > 0) {
          for (const wbData of workbooksData) {
            const wb = Workbook.deserialize(wbData);
            this.workbookManager['workbooks'].set(wb.id, wb);
          }
        } else {
          this.createWorkbook('Meu Primeiro Workbook');
        }
        
        logger.info("[Kernel] Workbooks loaded", { count: workbooksData.length });
      }
      
      // 5. Start session
      if (activeCompany) {
        this.sessionManager.start(activeCompany.id);
      }
      
      // 6. Try to recover from crash
      await this.recoverFromCrash();
      
      // 7. Start auto-save
      this.startAutoSave();
      
      // 8. Setup beforeunload
      this.setupBeforeUnload();
      
      this.state = "ready";
      
      const duration = Perf.end("kernel-init");
      
      this.eventBus.emit("kernel:ready", {
        version: this.version,
        company: activeCompany?.name,
        workbooks: this.workbookManager.listWorkbooks().length,
        duration,
      });
      
      logger.info("[Kernel] Ready");
    } catch (error) {
      logger.error("[Kernel] Init failed", error);
      this.state = "shutdown";
      throw error;
    }
  }
  
  async dispose(): Promise<void> {
    logger.info("[Kernel] Shutting down...");
    this.state = "shutdown";
    
    // Stop auto-save
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }
    
    // Save final snapshot
    try {
      await this.saveSnapshot();
    } catch (error) {
      logger.error("[Kernel] Final snapshot failed", error);
    }
    
    // End session
    this.sessionManager.end();
    
    // Clear event bus
    this.eventBus.clear();
    
    this.eventBus.emit("kernel:shutdown");
    logger.info("[Kernel] Shutdown complete");
  }

  setGrid(grid: any): void {
    this.grid = grid;
  }

  getGrid(): any {
    return this.grid;
  }
  
  getFormulaRegistry() {
    return this.calcEngine.getRegistry();
  }
  
  // --------------------------------------------------------------------------
  // PUBLIC API
  // --------------------------------------------------------------------------
  
  /**
   * Get context for plugins
   */
  getContext(): KernelContext {
    return {
      kernel: this,
      version: this.version,
      workbookManager: this.workbookManager,
      calcEngine: this.calcEngine,
      transformPipeline: undefined, // TODO: implement
      companyManager: this.companyManager,
      eventBus: this.eventBus,
      storage: this.storageManager,
      getGrid: this.getGrid.bind(this),
    };
  }
  
  /**
   * Recalculate sheet or cell
   */
  async recalculate(
    sheetId: string,
    cellRef?: string,
    options?: { force?: boolean; async?: boolean }
  ): Promise<{ duration: number; cellsRecalc: number }> {
    if (this.state === "computing") {
      logger.warn("[Kernel] Recalc already in progress");
      return { duration: 0, cellsRecalc: 0 };
    }
    
    this.state = "computing";
    Perf.start(`recalc-${sheetId}`);
    
    try {
      const sheet = this.workbookManager.getSheet(sheetId);
      if (!sheet) throw new Error(`Sheet not found: ${sheetId}`);
      
      const cellsRecalc = await this.calcEngine.recalculate(sheet, cellRef, options);
      const duration = Perf.end(`recalc-${sheetId}`);
      
      this.eventBus.emit("kernel:recalc-done", {
        sheetId,
        cellsRecalc,
        duration,
      });
      
      return { duration, cellsRecalc };
    } catch (error) {
      logger.error("[Kernel] Recalc failed", error);
      throw error;
    } finally {
      this.state = "idle";
    }
  }

  async clearAllData(): Promise<void> {
    logger.warn("[Kernel] Clearing all persistent data...");
    await this.storageManager.clearAll();
    this.eventBus.emit("kernel:data-cleared");
    logger.info("[Kernel] All persistent data cleared. Reloading application.");
  }

  // --------------------------------------------------------------------------
  // WORKBOOK OPERATIONS
  // --------------------------------------------------------------------------

  /**
   * Create new workbook
   */
  createWorkbook(name?: string): Workbook {
    const wb = this.workbookManager.createWorkbook(name);
    
    // Link to active company
    const activeCompany = this.companyManager.getActiveCompany();
    if (activeCompany) {
      wb.companyId = activeCompany.id;
      activeCompany.workbooks.push(wb.id);
      this.companyManager.updateCompany(activeCompany.id, activeCompany);
    }
    
    this.sessionManager.setActiveWorkbook(wb.id);
    
    this.eventBus.emit("workbook:created", { workbookId: wb.id, name: wb.name });
    logger.info("[Kernel] Workbook created", { id: wb.id, name: wb.name });
    
    return wb;
  }
  
  /**
   * Delete workbook
   */
  async deleteWorkbook(id: string): Promise<boolean> {
    const wb = this.workbookManager.getWorkbook(id);
    if (!wb) return false;
    
    // Remove from company
    if (wb.companyId) {
      const company = this.companyManager.getCompany(wb.companyId);
      if (company) {
        company.workbooks = company.workbooks.filter(wbId => wbId !== id);
        await this.companyManager.updateCompany(company.id, company);
      }
    }
    
    // Delete from storage
    await this.storageManager.deleteWorkbook(id);
    
    // Delete from manager
    const deleted = this.workbookManager.deleteWorkbook(id);
    
    if (deleted) {
      this.eventBus.emit("workbook:deleted", { workbookId: id });
      logger.info("[Kernel] Workbook deleted", { id });
    }
    
    return deleted;
  }
  
  /**
   * Save workbook to storage
   */
  async saveWorkbook(workbookId?: string): Promise<void> {
    const wb = workbookId 
      ? this.workbookManager.getWorkbook(workbookId)
      : this.workbookManager.getActiveWorkbook();
    
    if (!wb) {
      logger.warn("[Kernel] No workbook to save");
      return;
    }
    
    await this.storageManager.saveWorkbook(wb);
    this.eventBus.emit("workbook:saved", { workbookId: wb.id });
    logger.debug("[Kernel] Workbook saved", { id: wb.id });
  }
  
  /**
   * Save all workbooks
   */
  async saveAllWorkbooks(): Promise<void> {
    const workbooks = this.workbookManager.listWorkbooks();
    
    for (const wb of workbooks) {
      await this.storageManager.saveWorkbook(wb);
    }
    
    logger.info("[Kernel] All workbooks saved", { count: workbooks.length });
  }
  
  // --------------------------------------------------------------------------
  // INTERNAL METHODS
  // --------------------------------------------------------------------------
  
  private startAutoSave(): void {
    this.autoSaveTimer = window.setInterval(async () => {
      try {
        await this.saveAllWorkbooks();
        await this.saveSnapshot();
        this.eventBus.emit("kernel:autosave-done");
        logger.debug("[Kernel] Auto-save complete");
      } catch (error) {
        logger.error("[Kernel] Auto-save failed", error);
      }
    }, 10000); // 10 seconds
  }
  
  private async saveSnapshot(): Promise<void> {
    const snapshot = {
      version: this.version,
      timestamp: new Date().toISOString(),
      companies: this.companyManager.serialize(),
      workbooks: this.workbookManager.serialize(),
      session: this.sessionManager.getSession(),
    };
    
    await this.storageManager.saveSnapshot(snapshot);
  }
  
  private async recoverFromCrash(): Promise<void> {
    try {
      const snapshot = await this.storageManager.getLastSnapshot();
      
      if (!snapshot) {
        logger.info("[Kernel] No snapshot to recover");
        return;
      }
      
      // Check if snapshot is recent (< 5 minutes old)
      const snapshotTime = new Date(snapshot.timestamp).getTime();
      const now = Date.now();
      const ageMinutes = (now - snapshotTime) / 60000;
      
      if (ageMinutes > 5) {
        logger.info("[Kernel] Snapshot too old, skipping recovery");
        return;
      }
      
      // TODO: Ask user if they want to recover
      logger.info("[Kernel] Recovery snapshot available", { 
        age: `${ageMinutes.toFixed(1)} min ago` 
      });
      
      this.eventBus.emit("kernel:recovery-available", { snapshot });
    } catch (error) {
      logger.error("[Kernel] Recovery check failed", error);
    }
  }
  
  private setupBeforeUnload(): void {
    window.addEventListener("beforeunload", async (_e) => {
      try {
        await this.saveAllWorkbooks();
        await this.saveSnapshot();
      } catch (error) {
        logger.error("[Kernel] Beforeunload save failed", error);
      }
    });
  }
  
  // --------------------------------------------------------------------------
  // SINGLETON
  // --------------------------------------------------------------------------
  
  static getInstance(): DJDataForgeKernel {
    if (!DJDataForgeKernel.instance) {
      DJDataForgeKernel.instance = new DJDataForgeKernel();
    }
    return DJDataForgeKernel.instance;
  }
}

// Export global instance
export const kernel = DJDataForgeKernel.getInstance();

// Expose to window for debugging
if (typeof window !== 'undefined') {
  (window as any).DJKernel = kernel;
}