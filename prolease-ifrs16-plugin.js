/**
 * DJ DataForge v6 - ProLease IFRS 16 v6.0.0 (Native ES6 Module)
 *
 * AUTOR: DJCalc (portado para ES6 modules)
 * DATA: 2025-10-23
 * COMPATIBILIDADE: Kernel >= v6.0.0 (módulo ES6 nativo)
 *
 * --- CHANGELOG v6.0.0: MODULARIZAÇÃO ES6 ---
 * - ✅ Convertido de IIFE para ES6 module com export/import
 * - ✅ Removido bootstrap auto-registrante
 * - ✅ Exporta classe principal e manifest para importação dinâmica
 * - ✅ Mantém toda funcionalidade IFRS 16 intacta
 * - ✅ Compatível com sistema de plugins nativo do DataForge v6
 *
 * --- USO ---
 * import { ProLeasePlugin, manifest } from './prolease-ifrs16-plugin.js';
 * // ou carregamento dinâmico via UI do DataForge
 */

// -------------------------------
// Persistência simples por plugin
// -------------------------------
class Persistence {
  constructor(pluginId, log) {
    this.dbName = 'DJDataForge_PluginData_v6';
    this.storeName = pluginId;
    this.db = null;
    this.log = log || console.log;
  }

  async _db() {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'key' });
        }
      };
      req.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };
      req.onerror = (e) => {
        reject(e.target.error);
      };
    });
  }

  async set(key, value) {
    const db = await this._db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([this.storeName], 'readwrite');
      tx.objectStore(this.storeName).put({ key, value }).onsuccess = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  async get(key) {
    const db = await this._db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([this.storeName], 'readonly');
      const req = tx.objectStore(this.storeName).get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : undefined);
      req.onerror = (e) => reject(e.target.error);
    });
  }
}

// ----------------------------------
// Helpers de compatibilidade v6
// ----------------------------------
const Compat = {
  clearSheet(sheet) {
    try {
      if (!sheet) return;
      if (Array.isArray(sheet.rows)) sheet.rows = [];
      if (Array.isArray(sheet.columns)) sheet.columns = [];
      if (typeof sheet.rows === 'number') sheet.rows = 0;
    } catch(e) { /* no-op */ }
  },

  setCell(sheet, r, c, v) {
    if (!sheet) return;
    if (typeof sheet.setCell === 'function') {
      sheet.setCell(r, c, v);
      return;
    }
    // Fallback defensivo
    try {
      while (sheet.columns.length <= c) {
        if (typeof sheet.addColumn === 'function') {
          sheet.addColumn(sheet.columnToLetter(sheet.columns.length));
        } else {
          const colName = sheet.columnToLetter
            ? sheet.columnToLetter(sheet.columns.length)
            : 'C' + (sheet.columns.length + 1);
          sheet.columns.push({ name: String(colName) });
        }
      }
      while (sheet.rows.length <= r) {
        sheet.rows.push(new Array(sheet.columns.length).fill(''));
      }
      sheet.rows[r][c] = v;
    } catch(e) { /* no-op */ }
  },

  setActiveSheet(workbook, sheet) {
    try {
      if (!workbook || !sheet) return;
      const idx = Array.isArray(workbook.sheets)
        ? workbook.sheets.indexOf(sheet)
        : -1;
      if (typeof workbook.setActiveSheet === 'function') {
        workbook.setActiveSheet(idx >= 0 ? idx : 0);
      } else {
        if (idx >= 0) workbook.activeSheetIndex = idx;
      }
    } catch(e) { /* no-op */ }
  },

  uiRefresh(ui) {
    try { ui?.recalculateAll?.(true); } catch(_) {}
    try { ui?.renderGrid?.(); } catch(_) {}
    try {
      const f = ui?.updateStats || ui?.renderSheetStats;
      if (typeof f === 'function') f.call(ui);
    } catch(_) {}
  }
};

// ----------------------
// Web Worker in-line V6
// ----------------------
function createCalcWorker() {
  const code = `
    self.onmessage = function(event) {
      const { action, payload } = event.data || {};
      try {
        if (action !== 'calculate') return;
        const rows = generate(payload);
        const headers = getHeaders();
        self.postMessage({
          action: 'calculationComplete',
          payload: {
            contractData: payload,
            calculatedRows: [headers, ...rows]
          }
        });
      } catch (error) {
        self.postMessage({
          error: (error && error.message) || String(error)
        });
      }
    };

    function getHeaders() {
      return [
        "Month #",
        "Date",
        "A) Sum of All Costs",
        "B) Monthly Service Deductions",
        "C) Landlord TI Allowance after Commence Date",
        "D) Total Rent to be Capitalized (A + B + C)",
        "Remaining Present Value",
        "E) Interest",
        "End of Month Lease Liability",
        "Current Short Term (ST) Liability",
        "Non Current Long Term (LT) Liability",
        "Proof Column (ST+LT)",
        "F) New Initial Landlord Allowance",
        "I) Allowance Amortization",
        "J) Allowance Closing Balance",
        "K) New IDC",
        "N) IDC Amortization",
        "O) IDC Closing Balance",
        "S) Opening ROU Asset",
        "U) ROU Asset Amortization",
        "V) ROU Asset Closing Balance",
        "Total ROU Asset Closing Balance (J+O+V)",
        "W) Total P&L Non-Financial Expense",
        "P&L - Reported Lease Expense (E+W)"
      ];
    }

    function generate(d) {
      const rows = [];
      const termMonths = Number(d.termMonths || 0);
      const totalRent = Number(d.totalRent || 0);
      const serviceDeductions = Number(d.serviceDeductions || 0);
      const discountRate = Number(d.discountRate || 0);
      const initialLandlordAllowance = Number(d.initialLandlordAllowance || 0);
      const initialDirectCosts = Number(d.initialDirectCosts || 0);
      const startDate = new Date(d.startDate);

      const monthlyDiscountRate = Math.pow(1 + (discountRate / 100), 1/12) - 1;
      const rentToCapitalize = totalRent - serviceDeductions;

      let initialLeaseLiability = 0;
      for (let i = 0; i < termMonths; i++) {
        initialLeaseLiability += rentToCapitalize / Math.pow(1 + monthlyDiscountRate, i + 1);
      }

      const openingROU = initialLeaseLiability + initialDirectCosts - initialLandlordAllowance;
      const allowanceAmort = termMonths > 0 ? initialLandlordAllowance / termMonths : 0;
      const idcAmort = termMonths > 0 ? initialDirectCosts / termMonths : 0;
      const rouAmort = termMonths > 0 ? openingROU / termMonths : 0;

      let curLease = initialLeaseLiability;
      let curAllowance = initialLandlordAllowance;
      let curIDC = initialDirectCosts;
      let curROU = openingROU;

      for (let i = 1; i <= termMonths; i++) {
        const row = [];
        const curDate = new Date(startDate);
        curDate.setMonth(curDate.getMonth() + (i - 1));

        const interest = curLease * monthlyDiscountRate;
        const principal = rentToCapitalize - interest;

        row[0] = i;
        row[1] = curDate.toISOString().split('T')[0];
        row[2] = totalRent;
        row[3] = serviceDeductions;
        row[4] = 0;
        row[5] = rentToCapitalize;

        let remainingPV = 0;
        for (let j = i; j < termMonths; j++) {
          remainingPV += rentToCapitalize / Math.pow(1 + monthlyDiscountRate, j - i + 1);
        }
        row[6] = remainingPV;
        row[7] = interest;

        curLease -= principal;
        row[8] = Math.abs(curLease) < 0.01 ? 0 : curLease;

        let st = 0, lt = 0, tmp = curLease;
        for (let m = 0; m < (termMonths - i); m++) {
          const fInt = tmp * monthlyDiscountRate;
          const fPr = rentToCapitalize - fInt;
          if (m < 12) st += fPr;
          else lt += fPr;
          tmp -= fPr;
        }
        row[9] = st;
        row[10] = lt;
        row[11] = st + lt;

        row[12] = (i === 1) ? initialLandlordAllowance : 0;
        row[13] = allowanceAmort;
        curAllowance -= allowanceAmort;
        row[14] = Math.abs(curAllowance) < 0.01 ? 0 : curAllowance;

        row[15] = (i === 1) ? initialDirectCosts : 0;
        row[16] = idcAmort;
        curIDC -= idcAmort;
        row[17] = Math.abs(curIDC) < 0.01 ? 0 : curIDC;

        row[18] = curROU;
        row[19] = rouAmort;
        curROU -= rouAmort;
        row[20] = Math.abs(curROU) < 0.01 ? 0 : curROU;

        row[21] = curROU + curIDC + curAllowance;
        row[22] = rouAmort + idcAmort - allowanceAmort;
        row[23] = interest + row[22];

        rows.push(row);
      }
      return rows;
    }
  `;

  const blob = new Blob([code], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  const w = new Worker(url);

  setTimeout(() => {
    try { URL.revokeObjectURL(url); } catch(_) {}
  }, 1000);

  return w;
}

// --------------
// Plugin classe
// --------------
export class ProLeasePlugin {
  constructor(context) {
    this.context = context;
    this.contracts = [];
    this.worker = null;
    this.persistence = new Persistence(ProLeasePlugin.ID, context.log);
  }

  static get ID() { return 'dj.ifrs16.prolease'; }
  static get NAME() { return 'ProLease IFRS 16 Calculator'; }
  static get VERSION() { return '6.0.0'; }

  async init() {
    this.context.log(`Inicializando ${ProLeasePlugin.NAME} v${ProLeasePlugin.VERSION}...`);
    this.worker = createCalcWorker();
    this.worker.onmessage = (ev) => this._onWorkerMessage(ev);
    this.contracts = await this.persistence.get('contracts') || [];
    this._registerStaticMenus();
    this._rebuildDynamicMenus();
  }

  _onWorkerMessage(event) {
    const { action, payload, error } = event.data || {};
    if (error) {
      this.context.error('Erro recebido do Worker:', error);
      this.context.ui?.showToast?.(`Erro no cálculo: ${error}`, 'error');
      return;
    }
    if (action === 'calculationComplete') {
      this._createOrUpdateSheet(payload.contractData, payload.calculatedRows);
    }
  }

  _registerStaticMenus() {
    try {
      this.context.kernel.registry.registerMenuItem({
        pluginId: ProLeasePlugin.ID,
        label: 'Novo Contrato de Arrendamento (IFRS 16)',
        group: 'ProLease',
        action: () => this._createNewLease()
      });
    } catch(e) {
      this.context.error('Falha ao registrar menu estático:', e);
    }
  }

  _rebuildDynamicMenus() {
    const registry = this.context.kernel.registry;
    try {
      if (registry.menuItems && Array.isArray(registry.menuItems)) {
        registry.menuItems = registry.menuItems.filter(item =>
          item.pluginId !== ProLeasePlugin.ID || item.group === 'ProLease'
        );
      }
      this.contracts.forEach(contract => {
        registry.registerMenuItem({
          pluginId: ProLeasePlugin.ID,
          label: `Recalcular: ${contract.contractName}`,
          group: 'ProLease - Contratos Salvos',
          action: () => {
            this.context.ui?.showToast?.(`Recalculando "${contract.contractName}"...`, 'info');
            this.worker.postMessage({ action: 'calculate', payload: contract });
          }
        });
      });
    } catch(e) {
      this.context.error('Falha ao reconstruir menus dinâmicos:', e);
    }
    try { this.context.ui?.renderApp?.(); } catch(_) {}
  }

  async _createNewLease() {
    const contractData = await this._promptForContractData();
    if (!contractData) {
      this.context.ui?.showToast?.('Criação de contrato cancelada.', 'info');
      return;
    }
    this.contracts.push(contractData);
    await this.persistence.set('contracts', this.contracts);
    this.context.ui?.showToast?.('Contrato salvo. Calculando em segundo plano...', 'info');
    this.worker.postMessage({ action: 'calculate', payload: contractData });
    this._rebuildDynamicMenus();
  }

  async _promptForContractData() {
    const contractName = prompt("Nome do Contrato (para a aba):", "Contrato Exemplo 1");
    if (!contractName) return null;

    if (this.contracts.some(c => c.contractName === contractName)) {
      this.context.ui?.showToast?.(`Contrato com o nome "${contractName}" já existe.`, 'error');
      return null;
    }

    const termMonths = parseInt(prompt("Prazo do Contrato (meses):", "36"), 10);
    if (isNaN(termMonths) || termMonths < 0) return null;

    const startDate = prompt("Data de Início (YYYY-MM-DD):", new Date().toISOString().split('T')[0]);
    if (!startDate) return null;

    const totalRent = parseFloat(prompt("Custo Total Mensal (Aluguel Bruto):", "80000"));
    if (isNaN(totalRent)) return null;

    const serviceDeductions = parseFloat(prompt("Deduções de Serviço Mensal:", "5000"));
    if (isNaN(serviceDeductions)) return null;

    const discountRate = parseFloat(prompt("Taxa de Desconto Anual (%):", "15"));
    if (isNaN(discountRate)) return null;

    const initialLandlordAllowance = parseFloat(prompt("Incentivo Inicial do Locador (Allowance):", "0"));
    if (isNaN(initialLandlordAllowance)) return null;

    const initialDirectCosts = parseFloat(prompt("Custos Diretos Iniciais (IDC):", "30000"));
    if (isNaN(initialDirectCosts)) return null;

    return {
      contractName,
      termMonths,
      startDate,
      totalRent,
      serviceDeductions,
      discountRate,
      initialLandlordAllowance,
      initialDirectCosts
    };
  }

  _ensureActiveWorkbook() {
    let wb = this.context.kernel.workbookManager?.getActiveWorkbook?.();
    if (!wb) {
      const km = this.context.kernel.workbookManager || (
        this.context.kernel.workbookManager = new (
          window.WorkbookManager || function() {
            this.workbooks = [];
            this.activeWorkbookIndex = -1;
            this.createWorkbook = function(n) {
              const w = new (window.Workbook || function() {
                this.name = n;
                this.sheets = [new (window.Sheet || function() {
                  this.name = 'Planilha1';
                  this.columns = [];
                  this.rows = [];
                })('Planilha1')];
                this.activeSheetIndex = 0;
              })();
              this.workbooks.push(w);
              this.activeWorkbookIndex = this.workbooks.length - 1;
              return w;
            };
            this.getActiveWorkbook = function() {
              return this.workbooks[this.activeWorkbookIndex] || null;
            };
          }
        )()
      );
      wb = km.createWorkbook('Projeto ProLease');
    }
    return wb;
  }

  _createOrUpdateSheet(contractData, calculatedRows) {
    const workbook = this._ensureActiveWorkbook();
    if (!workbook) {
      this.context.error("Não foi possível obter/criar a pasta de trabalho ativa.");
      this.context.ui?.showToast?.("Erro: Nenhuma pasta de trabalho ativa encontrada.", "error");
      return;
    }

    const sheetName = `IFRS16 - ${contractData.contractName}`;
    let sheet = (workbook.sheets || []).find(s => s && s.name === sheetName);

    if (!sheet) {
      sheet = typeof workbook.addSheet === 'function'
        ? workbook.addSheet(sheetName)
        : null;
      if (!sheet) {
        this.context.error('Falha ao criar planilha.');
        this.context.ui?.showToast?.('Falha ao criar planilha.', 'error');
        return;
      }
    } else {
      Compat.clearSheet(sheet);
    }

    const headers = Array.isArray(calculatedRows) ? calculatedRows.shift() : null;
    if (Array.isArray(headers)) {
      headers.forEach((h, c) => Compat.setCell(sheet, 0, c, h));
    }

    (calculatedRows || []).forEach((row, rIdx) => {
      (row || []).forEach((val, cIdx) => {
        Compat.setCell(sheet, rIdx + 1, cIdx, val);
      });
    });

    Compat.setActiveSheet(workbook, sheet);
    Compat.uiRefresh(this.context.ui);

    this.context.ui?.showToast?.(
      `Simulação "${sheetName}" foi criada/atualizada!`,
      'success'
    );
  }

  dispose() {
    try {
      this.context.log(`Descarregando ${ProLeasePlugin.NAME}...`);
      if (this.worker) this.worker.terminate();

      const registry = this.context.kernel.registry;
      if (registry.menuItems && Array.isArray(registry.menuItems)) {
        registry.menuItems = registry.menuItems.filter(
          item => item.pluginId !== ProLeasePlugin.ID
        );
      }

      this.context.ui?.renderApp?.();
    } catch(e) {
      this.context.error('Erro ao descarregar plugin:', e);
    }
  }
}

// --------------
// Manifest para registro no DataForge v6
// --------------
export const manifest = {
  id: ProLeasePlugin.ID,
  name: ProLeasePlugin.NAME,
  version: ProLeasePlugin.VERSION,
  description: 'Calcula e gerencia contratos de arrendamento IFRS 16 com amortização completa.',
  author: 'DJCalc / Código',
  engineSemver: '>=6.0.0',

  // Função de inicialização que será chamada pelo kernel
  async init(context) {
    const instance = new ProLeasePlugin(context);
    await instance.init();
    return instance;
  },

  // Exporta a classe para uso direto se necessário
  pluginClass: ProLeasePlugin
};

// Export default para facilitar importação
export default manifest;
