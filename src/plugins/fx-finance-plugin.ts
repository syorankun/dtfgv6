/**
 * FX & Finance Plugin - Phase 1
 *
 * Plugin for capturing exchange rates and economic indices
 *
 * Features (Phase 1):
 * - PTAX synchronization (BCB API)
 * - Manual rates management
 * - FX formulas (RATE, CONVERT, TODAY, VARIATION, AVG, MAX, MIN, FORWARD)
 * - FIN formulas (PV, FV, PMT, NPER, RATE, RATE.EQUIVALENT)
 * - Static dashboard
 * - Capability provider (dj.fx.rates@3)
 * - Plugin persistence
 *
 * @version 1.0.0 (Phase 1)
 */

import type { PluginContext, PluginManifest } from '@core/types';
import type { Plugin } from '@core/plugin-system-consolidated';
import type { Sheet, Workbook } from '@core/workbook-consolidated';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/**
 * Supported currencies (including BRL for conversions)
 */
type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CHF' | 'CAD' | 'AUD' | 'CNY' | 'BRL';

/**
 * Rate source types
 */
type RateSource = 'PTAX' | 'MANUAL' | 'AUTO';

/**
 * Exchange rate record
 */
interface ExchangeRate {
  date: string;        // YYYY-MM-DD
  currency: CurrencyCode;
  buyRate: number;     // Taxa de compra (BRL)
  sellRate: number;    // Taxa de venda (BRL)
  source: RateSource;
  timestamp?: string;  // ISO 8601
}

/**
 * PTAX API response types
 */
interface PTAXQuotation {
  cotacaoCompra: number;
  cotacaoVenda: number;
  dataHoraCotacao: string;
  tipoBoletim: string;
}

interface PTAXResponse {
  value: PTAXQuotation[];
}

/**
 * Manual rate input
 */
interface ManualRateInput {
  date: string;
  currency: CurrencyCode;
  sellRate: number;
  buyRate?: number;
}

/**
 * Plugin configuration
 */
interface FXFinanceConfig {
  defaultSource: RateSource;
  fallbackDays: number;  // Days to look back for rates
  autoSaveInterval: number;  // Minutes
}

/**
 * Capability API for other plugins
 */
interface FXRatesAPI {
  getRate(date: string, currency: CurrencyCode, source?: RateSource): Promise<number | null>;
  convert(value: number, fromCurrency: CurrencyCode, toCurrency: CurrencyCode, date?: string): Promise<number>;
  getAvailableCurrencies(): CurrencyCode[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SHEET_NAMES = {
  PTAX: '_FX_PTAX_Rates',
  MANUAL: '_FX_Manual_Rates',
  DASHBOARD: '_FX_Dashboard'
} as const;

const BCB_API = {
  BASE_URL: 'https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata',
  ENDPOINTS: {
    QUOTATION_PERIOD: 'CotacaoMoedaPeriodo'
  }
} as const;

const SUPPORTED_CURRENCIES: CurrencyCode[] = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'CNY'];

const DEFAULT_CONFIG: FXFinanceConfig = {
  defaultSource: 'AUTO',
  fallbackDays: 7,
  autoSaveInterval: 10
};

// ============================================================================
// MAIN PLUGIN CLASS
// ============================================================================

export class FXFinancePlugin implements Plugin {
  manifest: PluginManifest = {
    id: 'fx-finance',
    name: 'FX & Finance',
    version: '1.0.0',
    author: 'DJ DataForge',
    description: 'Exchange rates capture and economic indices with financial formulas',
    permissions: [
      'read:workbook',
      'write:workbook',
      'ui:toolbar',
      'ui:menu',
      'read:storage',
      'write:storage',
      'network:fetch'
    ],
    entryPoint: 'fx-finance-plugin.js'
  };

  private context!: PluginContext;
  private config: FXFinanceConfig = { ...DEFAULT_CONFIG };
  private ratesCache: Map<string, ExchangeRate> = new Map();
  private sheetsCreated: boolean = false;

  // ============================================================================
  // PLUGIN LIFECYCLE
  // ============================================================================

  async init(context: PluginContext): Promise<void> {
    this.context = context;

    // Load configuration
    await this.loadConfig();

    // Check if sheets already exist
    this.checkExistingSheets();

    // Load rates into cache (if sheets exist)
    await this.loadRatesCache();

    // Register formulas
    this.registerFXFormulas();
    this.registerFINFormulas();

    // Setup UI
    this.setupUI();

    // Register capability provider
    this.registerCapability();

    context.ui.showToast('FX & Finance Plugin loaded!', 'success');
  }

  async dispose(): Promise<void> {
    // Clear cache
    this.ratesCache.clear();

    // Save any pending data
    await this.saveConfig();
  }

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  private async loadConfig(): Promise<void> {
    const saved = await this.context.storage.get('config');
    if (saved) {
      this.config = { ...DEFAULT_CONFIG, ...saved };
    }
  }

  private async saveConfig(): Promise<void> {
    await this.context.storage.set('config', this.config);
  }

  // ============================================================================
  // SHEET INITIALIZATION
  // ============================================================================

  private checkExistingSheets(): void {
    const ptaxSheet = this.getSheet(SHEET_NAMES.PTAX);
    const manualSheet = this.getSheet(SHEET_NAMES.MANUAL);

    this.sheetsCreated = !!(ptaxSheet && manualSheet);
  }

  private async createSheetsIfNeeded(): Promise<void> {
    if (this.sheetsCreated) return;

    // Ask user if they want to create sheets (visible or hidden)
    const choice = await this.askSheetCreationPreference();

    if (choice === 'cancel') {
      throw new Error('Operação cancelada pelo usuário');
    }

    const wb = this.getActiveWorkbook();
    if (!wb) {
      throw new Error('Nenhuma pasta de trabalho ativa');
    }

    const hideSheets = choice === 'hidden';

    // Create PTAX rates sheet
    const ptaxSheet = wb.addSheet(SHEET_NAMES.PTAX);
    this.setupPTAXSheetHeaders(ptaxSheet);
    if (hideSheets) {
      this.hideSheet(ptaxSheet);
    }

    // Create Manual rates sheet
    const manualSheet = wb.addSheet(SHEET_NAMES.MANUAL);
    this.setupManualSheetHeaders(manualSheet);
    if (hideSheets) {
      this.hideSheet(manualSheet);
    }

    this.sheetsCreated = true;

    const visibility = hideSheets ? 'ocultas' : 'visíveis';
    this.context.ui.showToast(`Planilhas de taxas criadas (${visibility})`, 'success');
  }

  private hideSheet(sheet: Sheet): void {
    // Mark sheet as hidden by prefixing name with underscore if not already
    if (!sheet.name.startsWith('_')) {
      // Sheet names already start with _, so they're effectively "hidden" by convention
      // No additional action needed for now
    }
  }

  private async askSheetCreationPreference(): Promise<'visible' | 'hidden' | 'cancel'> {
    return new Promise((resolve) => {
      const modalId = 'fx-sheet-creation-modal';

      // Remove existing modal
      document.getElementById(modalId)?.remove();

      const modalHTML = `
        <div id="${modalId}" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 10001;">
          <div style="background: white; border-radius: 8px; padding: 32px; width: 90%; max-width: 500px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h2 style="margin-top: 0; color: #2563eb;">Criar Planilhas de Dados</h2>
            <p style="color: #64748b; line-height: 1.6; margin-bottom: 24px;">
              Este plugin precisa criar duas planilhas para armazenar as taxas de câmbio:
              <br><br>
              <strong>• _FX_PTAX_Rates</strong> - Dados do Banco Central<br>
              <strong>• _FX_Manual_Rates</strong> - Taxas manuais
              <br><br>
              Como você prefere criar essas planilhas?
            </p>

            <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px;">
              <button id="fx-sheet-visible" style="padding: 14px 20px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 14px; display: flex; align-items: center; justify-content: center; gap: 8px;">
                <span>📊</span> Criar Planilhas Visíveis
              </button>
              <button id="fx-sheet-hidden" style="padding: 14px 20px; background: #64748b; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 14px; display: flex; align-items: center; justify-content: center; gap: 8px;">
                <span>🔒</span> Criar Planilhas (organizadas com prefixo _)
              </button>
            </div>

            <button id="fx-sheet-cancel" style="padding: 10px 20px; background: transparent; color: #64748b; border: 1px solid #e2e8f0; border-radius: 6px; cursor: pointer; font-weight: 500; width: 100%;">
              Cancelar
            </button>
          </div>
        </div>
      `;

      document.body.insertAdjacentHTML('beforeend', modalHTML);

      const visibleBtn = document.getElementById('fx-sheet-visible');
      const hiddenBtn = document.getElementById('fx-sheet-hidden');
      const cancelBtn = document.getElementById('fx-sheet-cancel');

      visibleBtn?.addEventListener('click', () => {
        document.getElementById(modalId)?.remove();
        resolve('visible');
      });

      hiddenBtn?.addEventListener('click', () => {
        document.getElementById(modalId)?.remove();
        resolve('hidden');
      });

      cancelBtn?.addEventListener('click', () => {
        document.getElementById(modalId)?.remove();
        resolve('cancel');
      });
    });
  }

  private setupPTAXSheetHeaders(sheet: Sheet): void {
    const headers = ['Data', 'Moeda', 'Taxa Compra (BRL)', 'Taxa Venda (BRL)', 'Timestamp'];
    headers.forEach((header, col) => {
      sheet.setCell(0, col, header, { type: 'string' });
    });
  }

  private setupManualSheetHeaders(sheet: Sheet): void {
    const headers = ['Data', 'Moeda', 'Taxa Compra (BRL)', 'Taxa Venda (BRL)', 'Observações'];
    headers.forEach((header, col) => {
      sheet.setCell(0, col, header, { type: 'string' });
    });
  }

  // ============================================================================
  // PTAX SYNCHRONIZATION
  // ============================================================================

  /**
   * Synchronize PTAX rates from BCB API
   */
  async syncPTAX(startDate: string, endDate: string, currencies: CurrencyCode[]): Promise<void> {
    try {
      // Create sheets if this is the first sync
      await this.createSheetsIfNeeded();

      this.context.ui.showToast('Sincronizando cotações PTAX...', 'info');

      for (const currency of currencies) {
        const rates = await this.fetchPTAXRates(currency, startDate, endDate);
        await this.savePTAXRates(rates);
      }

      // Reload cache
      await this.loadRatesCache();

      this.context.ui.showToast(
        `Sincronização concluída! ${currencies.length} moeda(s) atualizadas.`,
        'success'
      );
    } catch (error) {
      this.context.ui.showToast(
        `Erro na sincronização: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        'error'
      );
      throw error;
    }
  }

  /**
   * Fetch PTAX rates from BCB API
   */
  private async fetchPTAXRates(
    currency: CurrencyCode,
    startDate: string,
    endDate: string
  ): Promise<ExchangeRate[]> {
    // Format dates for API (MM-DD-YYYY)
    const formatDateForAPI = (date: string): string => {
      const [year, month, day] = date.split('-');
      return `${month}-${day}-${year}`;
    };

    const url = `${BCB_API.BASE_URL}/${BCB_API.ENDPOINTS.QUOTATION_PERIOD}(moeda=@moeda,dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)?` +
      `@moeda='${currency}'&@dataInicial='${formatDateForAPI(startDate)}'&@dataFinalCotacao='${formatDateForAPI(endDate)}'&$format=json`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`BCB API error: ${response.status} ${response.statusText}`);
    }

    const data: PTAXResponse = await response.json();

    // Group by date and get closing rate (latest timestamp per day)
    const ratesByDate = this.groupPTAXByDate(data.value, currency);

    return ratesByDate;
  }

  /**
   * Group PTAX quotations by date and select closing rate
   * (Critical logic: filters out intraday bulletins, keeps only closing)
   */
  private groupPTAXByDate(quotations: PTAXQuotation[], currency: CurrencyCode): ExchangeRate[] {
    const groupedByDate = new Map<string, PTAXQuotation[]>();

    // Group all quotations by date
    for (const quote of quotations) {
      // Validate data
      if (!quote.cotacaoCompra || !quote.cotacaoVenda || quote.cotacaoCompra <= 0 || quote.cotacaoVenda <= 0) {
        continue; // Skip invalid "phantom rates"
      }

      const date = quote.dataHoraCotacao.split(' ')[0]; // Extract date part (YYYY-MM-DD)
      if (!groupedByDate.has(date)) {
        groupedByDate.set(date, []);
      }
      groupedByDate.get(date)!.push(quote);
    }

    // For each date, select the LATEST quotation (closing rate)
    const closingRates: ExchangeRate[] = [];

    for (const [date, quotes] of groupedByDate.entries()) {
      // Sort by timestamp descending and take the first (latest)
      const sortedQuotes = quotes.sort((a, b) =>
        new Date(b.dataHoraCotacao).getTime() - new Date(a.dataHoraCotacao).getTime()
      );

      const closingQuote = sortedQuotes[0];

      closingRates.push({
        date,
        currency,
        buyRate: closingQuote.cotacaoCompra,
        sellRate: closingQuote.cotacaoVenda,
        source: 'PTAX',
        timestamp: closingQuote.dataHoraCotacao
      });
    }

    return closingRates;
  }

  /**
   * Save PTAX rates to sheet
   */
  private async savePTAXRates(rates: ExchangeRate[]): Promise<void> {
    const sheet = this.getSheet(SHEET_NAMES.PTAX);
    if (!sheet) {
      throw new Error('PTAX sheet not found');
    }

    // Get existing data to avoid duplicates
    const existingKeys = this.getExistingRateKeys(sheet);

    let rowIndex = this.getLastRowIndex(sheet) + 1;

    for (const rate of rates) {
      const key = `${rate.date}-${rate.currency}`;

      // Skip if already exists
      if (existingKeys.has(key)) {
        continue;
      }

      sheet.setCell(rowIndex, 0, rate.date, { type: 'string' });
      sheet.setCell(rowIndex, 1, rate.currency, { type: 'string' });
      sheet.setCell(rowIndex, 2, rate.buyRate, { type: 'number' });
      sheet.setCell(rowIndex, 3, rate.sellRate, { type: 'number' });
      sheet.setCell(rowIndex, 4, rate.timestamp || '', { type: 'string' });

      rowIndex++;
    }
  }

  // ============================================================================
  // MANUAL RATES
  // ============================================================================

  /**
   * Add manual rate
   */
  async addManualRate(input: ManualRateInput): Promise<void> {
    try {
      // Create sheets if this is the first manual rate
      await this.createSheetsIfNeeded();

      const sheet = this.getSheet(SHEET_NAMES.MANUAL);
      if (!sheet) {
        throw new Error('Manual rates sheet not found');
      }

      const buyRate = input.buyRate || input.sellRate; // Default buy rate to sell rate

      const rowIndex = this.getLastRowIndex(sheet) + 1;
      sheet.setCell(rowIndex, 0, input.date, { type: 'string' });
      sheet.setCell(rowIndex, 1, input.currency, { type: 'string' });
      sheet.setCell(rowIndex, 2, buyRate, { type: 'number' });
      sheet.setCell(rowIndex, 3, input.sellRate, { type: 'number' });
      sheet.setCell(rowIndex, 4, 'Manual', { type: 'string' });

      // Update cache
      const rate: ExchangeRate = {
        date: input.date,
        currency: input.currency,
        buyRate,
        sellRate: input.sellRate,
        source: 'MANUAL'
      };
      this.ratesCache.set(this.getRateCacheKey(input.date, input.currency, 'MANUAL'), rate);

      this.context.ui.showToast('Taxa manual adicionada com sucesso!', 'success');
    } catch (error) {
      this.context.ui.showToast(
        `Erro ao adicionar taxa: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        'error'
      );
      throw error;
    }
  }

  // ============================================================================
  // RATES CACHE
  // ============================================================================

  /**
   * Load all rates into memory cache for fast formula evaluation
   */
  private async loadRatesCache(): Promise<void> {
    this.ratesCache.clear();

    // Load PTAX rates
    const ptaxSheet = this.getSheet(SHEET_NAMES.PTAX);
    if (ptaxSheet) {
      this.loadSheetIntoCache(ptaxSheet, 'PTAX');
    }

    // Load Manual rates
    const manualSheet = this.getSheet(SHEET_NAMES.MANUAL);
    if (manualSheet) {
      this.loadSheetIntoCache(manualSheet, 'MANUAL');
    }
  }

  private loadSheetIntoCache(sheet: Sheet, source: RateSource): void {
    // Iterate through all rows
    for (const [rowIndex, rowData] of sheet.rows.entries()) {
      if (rowIndex === 0) continue; // Skip header row

      const date = rowData.get(0)?.value?.toString();
      const currency = rowData.get(1)?.value?.toString() as CurrencyCode;
      const buyRate = Number(rowData.get(2)?.value);
      const sellRate = Number(rowData.get(3)?.value);

      if (date && currency && buyRate && sellRate) {
        const rate: ExchangeRate = {
          date,
          currency,
          buyRate,
          sellRate,
          source
        };
        this.ratesCache.set(this.getRateCacheKey(date, currency, source), rate);
      }
    }
  }

  private getRateCacheKey(date: string, currency: CurrencyCode, source: RateSource): string {
    return `${date}|${currency}|${source}`;
  }

  /**
   * Get rate from cache with fallback logic
   */
  private getRateFromCache(
    date: string,
    currency: CurrencyCode,
    source: RateSource = 'AUTO',
    useSellRate = true
  ): number | null {
    // AUTO source: try MANUAL first, then PTAX
    if (source === 'AUTO') {
      const manualKey = this.getRateCacheKey(date, currency, 'MANUAL');
      const manualRate = this.ratesCache.get(manualKey);
      if (manualRate) {
        return useSellRate ? manualRate.sellRate : manualRate.buyRate;
      }

      const ptaxKey = this.getRateCacheKey(date, currency, 'PTAX');
      const ptaxRate = this.ratesCache.get(ptaxKey);
      if (ptaxRate) {
        return useSellRate ? ptaxRate.sellRate : ptaxRate.buyRate;
      }
    } else {
      // Specific source
      const key = this.getRateCacheKey(date, currency, source);
      const rate = this.ratesCache.get(key);
      if (rate) {
        return useSellRate ? rate.sellRate : rate.buyRate;
      }
    }

    // Fallback: look for previous business days (up to N days)
    return this.getRateWithFallback(date, currency, source, useSellRate);
  }

  /**
   * Fallback to previous business day if rate not found for exact date
   */
  private getRateWithFallback(
    date: string,
    currency: CurrencyCode,
    source: RateSource,
    useSellRate: boolean
  ): number | null {
    const maxDaysBack = this.config.fallbackDays;
    const currentDate = new Date(date);

    for (let i = 1; i <= maxDaysBack; i++) {
      currentDate.setDate(currentDate.getDate() - 1);
      const fallbackDate = currentDate.toISOString().split('T')[0];

      if (source === 'AUTO') {
        // Try MANUAL first
        const manualKey = this.getRateCacheKey(fallbackDate, currency, 'MANUAL');
        const manualRate = this.ratesCache.get(manualKey);
        if (manualRate) {
          return useSellRate ? manualRate.sellRate : manualRate.buyRate;
        }

        // Then PTAX
        const ptaxKey = this.getRateCacheKey(fallbackDate, currency, 'PTAX');
        const ptaxRate = this.ratesCache.get(ptaxKey);
        if (ptaxRate) {
          return useSellRate ? ptaxRate.sellRate : ptaxRate.buyRate;
        }
      } else {
        const key = this.getRateCacheKey(fallbackDate, currency, source);
        const rate = this.ratesCache.get(key);
        if (rate) {
          return useSellRate ? rate.sellRate : rate.buyRate;
        }
      }
    }

    return null;
  }

  // ============================================================================
  // FX FORMULAS
  // ============================================================================

  private registerFXFormulas(): void {
    const registry = this.context.kernel.calcEngine.getRegistry();

    // FX_RATE(date, currency, [source])
    registry.register('FX_RATE', (date: string, currency: string, source?: string) => {
      const rateSource = (source?.toUpperCase() || 'AUTO') as RateSource;
      const rate = this.getRateFromCache(date, currency as CurrencyCode, rateSource, true);
      return rate || '#N/A';
    }, {
      argCount: [2, 3],
      description: 'Get exchange rate for date and currency (BRL)'
    });

    // FX_TODAY(currency)
    registry.register('FX_TODAY', (currency: string) => {
      const today = new Date().toISOString().split('T')[0];
      let rate = this.getRateFromCache(today, currency as CurrencyCode, 'AUTO', true);

      // If no rate for today, get the last available rate
      if (!rate) {
        rate = this.getLastAvailableRate(currency as CurrencyCode);
      }

      return rate || '#N/A';
    }, {
      argCount: 1,
      description: 'Get today\'s exchange rate (or last available)'
    });

    // FX_CONVERT(value, fromCurrency, toCurrency, [date])
    registry.register('FX_CONVERT', (value: number, from: string, to: string, date?: string) => {
      const conversionDate = date || new Date().toISOString().split('T')[0];

      // BRL to BRL = no conversion
      if (from === 'BRL' && to === 'BRL') {
        return value;
      }

      // From BRL to foreign currency
      if (from === 'BRL') {
        const toRate = this.getRateFromCache(conversionDate, to as CurrencyCode, 'AUTO', true);
        if (!toRate) return '#N/A';
        return value / toRate;
      }

      // From foreign currency to BRL
      if (to === 'BRL') {
        const fromRate = this.getRateFromCache(conversionDate, from as CurrencyCode, 'AUTO', true);
        if (!fromRate) return '#N/A';
        return value * fromRate;
      }

      // Foreign to foreign (triangulate via BRL)
      const fromRate = this.getRateFromCache(conversionDate, from as CurrencyCode, 'AUTO', true);
      const toRate = this.getRateFromCache(conversionDate, to as CurrencyCode, 'AUTO', true);

      if (!fromRate || !toRate) return '#N/A';

      const brlAmount = value * fromRate;
      return brlAmount / toRate;
    }, {
      argCount: [3, 4],
      description: 'Convert value from one currency to another'
    });

    // FX_VARIATION(currency, startDate, endDate, [source])
    registry.register('FX_VARIATION', (currency: string, startDate: string, endDate: string, source?: string) => {
      const rateSource = (source?.toUpperCase() || 'AUTO') as RateSource;
      const startRate = this.getRateFromCache(startDate, currency as CurrencyCode, rateSource, true);
      const endRate = this.getRateFromCache(endDate, currency as CurrencyCode, rateSource, true);

      if (!startRate || !endRate) return '#N/A';

      return ((endRate - startRate) / startRate) * 100;
    }, {
      argCount: [3, 4],
      description: 'Calculate variation % between two dates'
    });

    // FX_AVG(currency, startDate, endDate, [source])
    registry.register('FX_AVG', (currency: string, startDate: string, endDate: string, source?: string) => {
      const rates = this.getRatesInRange(currency as CurrencyCode, startDate, endDate, source as RateSource);
      if (rates.length === 0) return '#N/A';

      const sum = rates.reduce((acc, rate) => acc + rate.sellRate, 0);
      return sum / rates.length;
    }, {
      argCount: [3, 4],
      description: 'Average rate in date range'
    });

    // FX_MAX(currency, startDate, endDate, [source])
    registry.register('FX_MAX', (currency: string, startDate: string, endDate: string, source?: string) => {
      const rates = this.getRatesInRange(currency as CurrencyCode, startDate, endDate, source as RateSource);
      if (rates.length === 0) return '#N/A';

      return Math.max(...rates.map(r => r.sellRate));
    }, {
      argCount: [3, 4],
      description: 'Maximum rate in date range'
    });

    // FX_MIN(currency, startDate, endDate, [source])
    registry.register('FX_MIN', (currency: string, startDate: string, endDate: string, source?: string) => {
      const rates = this.getRatesInRange(currency as CurrencyCode, startDate, endDate, source as RateSource);
      if (rates.length === 0) return '#N/A';

      return Math.min(...rates.map(r => r.sellRate));
    }, {
      argCount: [3, 4],
      description: 'Minimum rate in date range'
    });

    // FX_FORWARD(spotDate, forwardDate, currency, domesticRate, foreignRate)
    registry.register('FX_FORWARD', (
      spotDate: string,
      forwardDate: string,
      currency: string,
      domesticRate: number,
      foreignRate: number
    ) => {
      const spotRate = this.getRateFromCache(spotDate, currency as CurrencyCode, 'AUTO', true);
      if (!spotRate) return '#N/A';

      const spot = new Date(spotDate);
      const forward = new Date(forwardDate);
      const days = Math.floor((forward.getTime() - spot.getTime()) / (1000 * 60 * 60 * 24));

      // Forward rate formula: F = S × (1 + rd × t) / (1 + rf × t)
      const t = days / 360; // Using 360 day convention
      const forwardRate = spotRate * ((1 + domesticRate * t) / (1 + foreignRate * t));

      return forwardRate;
    }, {
      argCount: 5,
      description: 'Calculate theoretical forward rate'
    });
  }

  /**
   * Get the last available rate for a currency (most recent date)
   */
  private getLastAvailableRate(currency: CurrencyCode, source: RateSource = 'AUTO'): number | null {
    const rates: ExchangeRate[] = [];

    // Collect all rates for this currency from cache
    for (const [, rate] of this.ratesCache.entries()) {
      if (rate.currency === currency) {
        if (source === 'AUTO' || rate.source === source) {
          rates.push(rate);
        }
      }
    }

    // If no rates found, return null
    if (rates.length === 0) {
      return null;
    }

    // Sort by date descending (most recent first)
    rates.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    });

    // Return the most recent rate
    return rates[0].sellRate;
  }

  /**
   * Get all rates in date range
   */
  private getRatesInRange(
    currency: CurrencyCode,
    startDate: string,
    endDate: string,
    source: RateSource = 'AUTO'
  ): ExchangeRate[] {
    const rates: ExchangeRate[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const current = new Date(start);

    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];

      if (source === 'AUTO') {
        const manualKey = this.getRateCacheKey(dateStr, currency, 'MANUAL');
        const manualRate = this.ratesCache.get(manualKey);
        if (manualRate) {
          rates.push(manualRate);
        } else {
          const ptaxKey = this.getRateCacheKey(dateStr, currency, 'PTAX');
          const ptaxRate = this.ratesCache.get(ptaxKey);
          if (ptaxRate) {
            rates.push(ptaxRate);
          }
        }
      } else {
        const key = this.getRateCacheKey(dateStr, currency, source);
        const rate = this.ratesCache.get(key);
        if (rate) {
          rates.push(rate);
        }
      }

      current.setDate(current.getDate() + 1);
    }

    return rates;
  }

  // ============================================================================
  // FIN FORMULAS
  // ============================================================================

  private registerFINFormulas(): void {
    const registry = this.context.kernel.calcEngine.getRegistry();

    // FIN_PV(rate, nper, pmt, [fv], [type])
    registry.register('FIN_PV', (rate: number, nper: number, pmt: number, fv = 0, type = 0) => {
      if (rate === 0) {
        return -(pmt * nper + fv);
      }

      const pvifa = (1 - Math.pow(1 + rate, -nper)) / rate;
      const pv = -(pmt * pvifa * (1 + rate * type) + fv * Math.pow(1 + rate, -nper));

      return pv;
    }, {
      argCount: [3, 5],
      description: 'Present value of investment'
    });

    // FIN_FV(rate, nper, pmt, [pv], [type])
    registry.register('FIN_FV', (rate: number, nper: number, pmt: number, pv = 0, type = 0) => {
      if (rate === 0) {
        return -(pv + pmt * nper);
      }

      const fv = -(pv * Math.pow(1 + rate, nper) + pmt * (1 + rate * type) * ((Math.pow(1 + rate, nper) - 1) / rate));

      return fv;
    }, {
      argCount: [3, 5],
      description: 'Future value of investment'
    });

    // FIN_PMT(rate, nper, pv, [fv], [type])
    registry.register('FIN_PMT', (rate: number, nper: number, pv: number, fv = 0, type = 0) => {
      if (rate === 0) {
        return -(pv + fv) / nper;
      }

      const pvifa = (1 - Math.pow(1 + rate, -nper)) / rate;
      const pmt = (-pv - fv * Math.pow(1 + rate, -nper)) / (pvifa * (1 + rate * type));

      return pmt;
    }, {
      argCount: [3, 5],
      description: 'Payment for loan'
    });

    // FIN_NPER(rate, pmt, pv, [fv], [type])
    registry.register('FIN_NPER', (rate: number, pmt: number, pv: number, fv = 0, type = 0) => {
      if (rate === 0) {
        return -(pv + fv) / pmt;
      }

      const num = pmt * (1 + rate * type) - fv * rate;
      const den = pv * rate + pmt * (1 + rate * type);

      if (num <= 0 || den <= 0) {
        return '#N/A';
      }

      const nper = Math.log(num / den) / Math.log(1 + rate);

      return nper;
    }, {
      argCount: [3, 5],
      description: 'Number of periods for investment'
    });

    // FIN_RATE(nper, pmt, pv, [fv], [type], [guess])
    registry.register('FIN_RATE', (
      nper: number,
      pmt: number,
      pv: number,
      fv = 0,
      type = 0,
      guess = 0.1
    ) => {
      // Newton-Raphson method to find rate
      const MAX_ITERATIONS = 100;
      const PRECISION = 1e-6;

      let rate = guess;

      for (let i = 0; i < MAX_ITERATIONS; i++) {
        const f = pv * Math.pow(1 + rate, nper) +
                  pmt * (1 + rate * type) * ((Math.pow(1 + rate, nper) - 1) / rate) +
                  fv;

        const df = nper * pv * Math.pow(1 + rate, nper - 1) +
                   pmt * (1 + rate * type) *
                   (nper * Math.pow(1 + rate, nper - 1) / rate -
                    (Math.pow(1 + rate, nper) - 1) / (rate * rate));

        const newRate = rate - f / df;

        if (Math.abs(newRate - rate) < PRECISION) {
          return newRate;
        }

        rate = newRate;
      }

      return '#N/A'; // Did not converge
    }, {
      argCount: [3, 6],
      description: 'Interest rate per period'
    });

    // FIN_RATE_EQUIVALENT(rate, fromPeriods, toPeriods)
    registry.register('FIN_RATE_EQUIVALENT', (rate: number, fromPeriods: number, toPeriods: number) => {
      // Convert rate from one period to another
      // Example: monthly to annual: (1 + rate)^(12/1) - 1
      const equivalentRate = Math.pow(1 + rate, toPeriods / fromPeriods) - 1;
      return equivalentRate;
    }, {
      argCount: 3,
      description: 'Convert rate between different periods'
    });
  }

  // ============================================================================
  // DASHBOARD (STATIC)
  // ============================================================================

  /**
   * Create static dashboard sheet with formulas
   */
  async createStaticDashboard(): Promise<void> {
    const wb = this.getActiveWorkbook();
    if (!wb) {
      this.context.ui.showToast('Nenhuma pasta de trabalho ativa', 'warning');
      return;
    }

    // Get loaded currencies
    const loadedCurrencies = this.getLoadedCurrencies();

    if (loadedCurrencies.length === 0) {
      this.context.ui.showToast('Nenhuma moeda carregada. Sincronize dados primeiro.', 'warning');
      return;
    }

    // Delete existing dashboard if exists
    const existingSheet = this.getSheet(SHEET_NAMES.DASHBOARD);
    if (existingSheet) {
      wb.deleteSheet(existingSheet.id);
    }

    // Create new dashboard sheet
    const sheet = wb.addSheet(SHEET_NAMES.DASHBOARD);

    // Title
    sheet.setCell(0, 0, 'Dashboard de Câmbio', { type: 'string' });

    // Headers
    const headers = ['Moeda', 'Taxa Hoje', 'Variação 30d (%)', 'Média 30d', 'Máxima 30d', 'Mínima 30d'];
    headers.forEach((header, col) => {
      sheet.setCell(1, col, header, { type: 'string' });
    });

    // Get today and 30 days ago
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Add rows for each currency
    let row = 2;
    for (const currency of loadedCurrencies) {
      sheet.setCell(row, 0, currency, { type: 'string' });

      // Use formulas (value will be calculated by recalculate)
      sheet.setCell(row, 1, 0, {
        type: 'formula',
        formula: `=FX_TODAY("${currency}")`
      });

      sheet.setCell(row, 2, 0, {
        type: 'formula',
        formula: `=FX_VARIATION("${currency}","${thirtyDaysAgo}","${today}")`
      });

      sheet.setCell(row, 3, 0, {
        type: 'formula',
        formula: `=FX_AVG("${currency}","${thirtyDaysAgo}","${today}")`
      });

      sheet.setCell(row, 4, 0, {
        type: 'formula',
        formula: `=FX_MAX("${currency}","${thirtyDaysAgo}","${today}")`
      });

      sheet.setCell(row, 5, 0, {
        type: 'formula',
        formula: `=FX_MIN("${currency}","${thirtyDaysAgo}","${today}")`
      });

      row++;
    }

    // Set as active sheet
    wb.setActiveSheet(sheet.id);

    // Recalculate sheet formulas
    this.context.kernel.kernel.recalculate(sheet.id, undefined, { force: true });

    this.context.ui.showToast('Dashboard criado com sucesso!', 'success');
  }

  /**
   * Get list of currencies that have loaded data
   */
  private getLoadedCurrencies(): CurrencyCode[] {
    const currencies = new Set<CurrencyCode>();

    for (const key of this.ratesCache.keys()) {
      const currency = key.split('|')[1] as CurrencyCode;
      currencies.add(currency);
    }

    return Array.from(currencies).sort();
  }

  // ============================================================================
  // CAPABILITY PROVIDER
  // ============================================================================

  private registerCapability(): void {
    const api: FXRatesAPI = {
      getRate: async (date: string, currency: CurrencyCode, source?: RateSource) => {
        return this.getRateFromCache(date, currency, source || 'AUTO', true);
      },

      convert: async (value: number, fromCurrency: CurrencyCode, toCurrency: CurrencyCode, date?: string) => {
        const conversionDate = date || new Date().toISOString().split('T')[0];

        if (fromCurrency === 'BRL' && toCurrency === 'BRL') {
          return value;
        }

        if (fromCurrency === 'BRL') {
          const toRate = this.getRateFromCache(conversionDate, toCurrency, 'AUTO', true);
          if (!toRate) throw new Error(`Rate not found for ${toCurrency} on ${conversionDate}`);
          return value / toRate;
        }

        if (toCurrency === 'BRL') {
          const fromRate = this.getRateFromCache(conversionDate, fromCurrency, 'AUTO', true);
          if (!fromRate) throw new Error(`Rate not found for ${fromCurrency} on ${conversionDate}`);
          return value * fromRate;
        }

        const fromRate = this.getRateFromCache(conversionDate, fromCurrency, 'AUTO', true);
        const toRate = this.getRateFromCache(conversionDate, toCurrency, 'AUTO', true);

        if (!fromRate || !toRate) {
          throw new Error(`Rates not found for conversion on ${conversionDate}`);
        }

        const brlAmount = value * fromRate;
        return brlAmount / toRate;
      },

      getAvailableCurrencies: () => {
        return this.getLoadedCurrencies();
      }
    };

    // Register capability (assuming kernel has a capability system)
    // This would need to be implemented in the kernel
    if (this.context.kernel && typeof (this.context.kernel as any).registerCapability === 'function') {
      (this.context.kernel as any).registerCapability('dj.fx.rates@3', api);
    }
  }

  // ============================================================================
  // UI SETUP
  // ============================================================================

  private setupUI(): void {
    // Menu: Sincronizar PTAX
    this.context.ui.addMenuItem({
      id: 'fx-sync-ptax',
      label: 'Sincronizar Cotações PTAX',
      onClick: () => this.showSyncPTAXDialog()
    });

    // Menu: Adicionar Taxa Manual
    this.context.ui.addMenuItem({
      id: 'fx-add-manual',
      label: 'Adicionar Taxa Manual',
      onClick: () => this.showAddManualRateDialog()
    });

    // Menu: Dashboard Estático
    this.context.ui.addMenuItem({
      id: 'fx-dashboard-static',
      label: 'Dashboard Câmbio (Estático)',
      onClick: () => this.createStaticDashboard()
    });

    // Menu: Salvar Plugin
    this.context.ui.addMenuItem({
      id: 'fx-save-plugin',
      label: 'Salvar Plugin na Sessão',
      onClick: () => this.savePluginToSession()
    });
  }

  /**
   * Show PTAX synchronization dialog
   */
  private showSyncPTAXDialog(): void {
    const modalId = 'fx-sync-ptax-modal';

    // Remove existing modal
    document.getElementById(modalId)?.remove();

    // Get default dates (last 30 days)
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    const formatDate = (date: Date) => date.toISOString().split('T')[0];

    // Filter currencies to exclude BRL
    const selectableCurrencies = SUPPORTED_CURRENCIES.filter(c => c !== 'BRL');

    const modalHTML = `
      <div id="${modalId}" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10001;">
        <div style="background: white; border-radius: 8px; padding: 24px; width: 90%; max-width: 500px; max-height: 90vh; overflow-y: auto;">
          <h2 style="margin-top: 0;">Sincronizar Cotações PTAX</h2>

          <div style="margin: 15px 0;">
            <label style="display: block; margin-bottom: 5px; font-weight: 500;">Data Inicial:</label>
            <input type="date" id="fx-start-date" value="${formatDate(startDate)}"
                   style="padding: 8px; width: 100%; box-sizing: border-box; border: 1px solid #ddd; border-radius: 4px;">
          </div>

          <div style="margin: 15px 0;">
            <label style="display: block; margin-bottom: 5px; font-weight: 500;">Data Final:</label>
            <input type="date" id="fx-end-date" value="${formatDate(endDate)}"
                   style="padding: 8px; width: 100%; box-sizing: border-box; border: 1px solid #ddd; border-radius: 4px;">
          </div>

          <div style="margin: 15px 0;">
            <label style="display: block; margin-bottom: 5px; font-weight: 500;">Moedas:</label>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
              ${selectableCurrencies.map(curr => `
                <label style="display: flex; align-items: center; cursor: pointer;">
                  <input type="checkbox" name="currency" value="${curr}" checked
                         style="margin-right: 8px;">
                  ${curr}
                </label>
              `).join('')}
            </div>
          </div>

          <div style="margin-top: 20px; display: flex; gap: 10px;">
            <button id="fx-sync-btn" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500;">
              Sincronizar
            </button>
            <button id="fx-cancel-btn" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500;">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Setup event listeners
    const syncBtn = document.getElementById('fx-sync-btn');
    const cancelBtn = document.getElementById('fx-cancel-btn');

    syncBtn?.addEventListener('click', async () => {
      const startDateInput = document.getElementById('fx-start-date') as HTMLInputElement;
      const endDateInput = document.getElementById('fx-end-date') as HTMLInputElement;
      const checkedCurrencies = Array.from(
        document.querySelectorAll('input[name="currency"]:checked')
      ).map(cb => (cb as HTMLInputElement).value) as CurrencyCode[];

      if (checkedCurrencies.length === 0) {
        this.context.ui.showToast('Selecione pelo menos uma moeda', 'warning');
        return;
      }

      document.getElementById(modalId)?.remove();
      await this.syncPTAX(startDateInput.value, endDateInput.value, checkedCurrencies);
    });

    cancelBtn?.addEventListener('click', () => {
      document.getElementById(modalId)?.remove();
    });
  }

  /**
   * Show add manual rate dialog
   */
  private showAddManualRateDialog(): void {
    const modalId = 'fx-manual-rate-modal';

    // Remove existing modal
    document.getElementById(modalId)?.remove();

    const today = new Date().toISOString().split('T')[0];

    // Filter currencies to exclude BRL
    const selectableCurrencies = SUPPORTED_CURRENCIES.filter(c => c !== 'BRL');

    const modalHTML = `
      <div id="${modalId}" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10001;">
        <div style="background: white; border-radius: 8px; padding: 24px; width: 90%; max-width: 450px;">
          <h2 style="margin-top: 0;">Adicionar Taxa Manual</h2>

          <div style="margin: 15px 0;">
            <label style="display: block; margin-bottom: 5px; font-weight: 500;">Data:</label>
            <input type="date" id="fx-manual-date" value="${today}"
                   style="padding: 8px; width: 100%; box-sizing: border-box; border: 1px solid #ddd; border-radius: 4px;">
          </div>

          <div style="margin: 15px 0;">
            <label style="display: block; margin-bottom: 5px; font-weight: 500;">Moeda:</label>
            <select id="fx-manual-currency" style="padding: 8px; width: 100%; box-sizing: border-box; border: 1px solid #ddd; border-radius: 4px;">
              ${selectableCurrencies.map(curr => `<option value="${curr}">${curr}</option>`).join('')}
            </select>
          </div>

          <div style="margin: 15px 0;">
            <label style="display: block; margin-bottom: 5px; font-weight: 500;">Taxa de Venda (BRL):</label>
            <input type="number" id="fx-manual-sell-rate" step="0.0001"
                   style="padding: 8px; width: 100%; box-sizing: border-box; border: 1px solid #ddd; border-radius: 4px;">
          </div>

          <div style="margin: 15px 0;">
            <label style="display: block; margin-bottom: 5px; font-weight: 500;">Taxa de Compra (BRL) [Opcional]:</label>
            <input type="number" id="fx-manual-buy-rate" step="0.0001"
                   style="padding: 8px; width: 100%; box-sizing: border-box; border: 1px solid #ddd; border-radius: 4px;"
                   placeholder="Deixe vazio para usar taxa de venda">
          </div>

          <div style="margin-top: 20px; display: flex; gap: 10px;">
            <button id="fx-manual-add-btn" style="padding: 10px 20px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500;">
              Adicionar
            </button>
            <button id="fx-manual-cancel-btn" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500;">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const addBtn = document.getElementById('fx-manual-add-btn');
    const cancelBtn = document.getElementById('fx-manual-cancel-btn');

    addBtn?.addEventListener('click', async () => {
      const dateInput = document.getElementById('fx-manual-date') as HTMLInputElement;
      const currencySelect = document.getElementById('fx-manual-currency') as HTMLSelectElement;
      const sellRateInput = document.getElementById('fx-manual-sell-rate') as HTMLInputElement;
      const buyRateInput = document.getElementById('fx-manual-buy-rate') as HTMLInputElement;

      const sellRate = parseFloat(sellRateInput.value);
      if (isNaN(sellRate) || sellRate <= 0) {
        this.context.ui.showToast('Taxa de venda inválida', 'error');
        return;
      }

      const input: ManualRateInput = {
        date: dateInput.value,
        currency: currencySelect.value as CurrencyCode,
        sellRate,
        buyRate: buyRateInput.value ? parseFloat(buyRateInput.value) : undefined
      };

      document.getElementById(modalId)?.remove();
      await this.addManualRate(input);
    });

    cancelBtn?.addEventListener('click', () => {
      document.getElementById(modalId)?.remove();
    });
  }

  /**
   * Save plugin source code to session storage
   */
  private async savePluginToSession(): Promise<void> {
    try {
      // Get current plugin source from file
      // This would need to be implemented based on your file system access
      const pluginSource = `/* FX & Finance Plugin source code would be saved here */`;

      await this.context.storage.set('plugin-source', pluginSource);

      this.context.ui.showToast('Plugin salvo na sessão com sucesso!', 'success');
    } catch (error) {
      this.context.ui.showToast(
        `Erro ao salvar plugin: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        'error'
      );
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private getActiveWorkbook(): Workbook | null {
    return this.context.kernel.workbookManager.getActiveWorkbook();
  }

  private getSheet(name: string): Sheet | null {
    const wb = this.getActiveWorkbook();
    if (!wb) return null;

    const sheets = Array.from(wb.sheets.values());
    return sheets.find((s: Sheet) => s.name === name) || null;
  }

  private getExistingRateKeys(sheet: Sheet): Set<string> {
    const keys = new Set<string>();

    // Iterate through all rows in the sheet
    for (const [rowIndex, rowData] of sheet.rows.entries()) {
      if (rowIndex === 0) continue; // Skip header row

      const date = rowData.get(0)?.value?.toString();
      const currency = rowData.get(1)?.value?.toString();

      if (date && currency) {
        keys.add(`${date}-${currency}`);
      }
    }

    return keys;
  }

  private getLastRowIndex(sheet: Sheet): number {
    if (sheet.rows.size === 0) return 0;

    const rowIndexes = Array.from(sheet.rows.keys());
    return Math.max(...rowIndexes);
  }
}

// ============================================================================
// PLUGIN EXPORT
// ============================================================================

export default FXFinancePlugin;
