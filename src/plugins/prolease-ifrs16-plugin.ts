/**
 * ProLease IFRS 16 Plugin for DataForge v6
 *
 * Native TypeScript implementation following DataForge v6 plugin architecture
 * Provides complete IFRS 16 lease accounting calculations with amortization schedules
 *
 * @author DJCalc / Código
 * @version 6.0.0
 * @date 2025-10-23
 */

import type { PluginContext, PluginManifest } from '../@core/types';
import type { Plugin } from '../@core/plugin-system-consolidated';
import type { Sheet } from '../@core/workbook-consolidated';
import { logger } from '../@core/storage-utils-consolidated';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface LeaseContract {
  id: string;
  contractName: string;
  termMonths: number;
  startDate: string; // YYYY-MM-DD
  totalRent: number;
  serviceDeductions: number;
  discountRate: number; // Annual percentage
  initialLandlordAllowance: number;
  initialDirectCosts: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// PLUGIN CLASS
// ============================================================================

export class ProLeasePlugin implements Plugin {
  manifest: PluginManifest = {
    id: 'dj.ifrs16.prolease',
    name: 'ProLease IFRS 16',
    version: '6.0.0',
    author: 'DJCalc / Código',
    description: 'IFRS 16 lease accounting calculator with comprehensive amortization schedules',
    permissions: [
      'read:workbook',
      'write:workbook',
      'ui:toolbar',
      'ui:panel',
      'formula:register',
      'read:storage',
      'write:storage',
    ],
    entryPoint: 'prolease-ifrs16-plugin.ts',
  };

  private context!: PluginContext;
  private contracts: LeaseContract[] = [];
  private worker?: Worker;

  // ========================================================================
  // LIFECYCLE METHODS
  // ========================================================================

  async init(context: PluginContext): Promise<void> {
    this.context = context;
    logger.info('[ProLeasePlugin] Initializing v6.0.0...');

    try {
      // Load saved contracts from persistent storage
      await this.loadContracts();

      // Create Web Worker for background calculations
      this.worker = this.createCalculationWorker();

      // Register IFRS 16 formulas for spreadsheet use
      this.registerFormulas();

      // Setup UI elements
      this.setupUI();

      logger.info(`[ProLeasePlugin] Ready with ${this.contracts.length} saved contracts`);
      context.ui.showToast(`ProLease IFRS 16 loaded! ${this.contracts.length} contract(s)`, 'success');
    } catch (error) {
      logger.error('[ProLeasePlugin] Initialization failed', error);
      context.ui.showToast('Failed to load ProLease plugin', 'error');
      throw error;
    }
  }

  async dispose(): Promise<void> {
    logger.info('[ProLeasePlugin] Disposing...');

    // Terminate worker
    if (this.worker) {
      this.worker.terminate();
      this.worker = undefined;
    }

    // Save any pending data
    await this.saveContracts();

    logger.info('[ProLeasePlugin] Disposed successfully');
  }

  // ========================================================================
  // DATA PERSISTENCE
  // ========================================================================

  private async loadContracts(): Promise<void> {
    try {
      const saved = await this.context.storage.get('contracts');
      this.contracts = saved || [];
      logger.info(`[ProLeasePlugin] Loaded ${this.contracts.length} contracts`);
    } catch (error) {
      logger.error('[ProLeasePlugin] Failed to load contracts', error);
      this.contracts = [];
    }
  }

  private async saveContracts(): Promise<void> {
    try {
      await this.context.storage.set('contracts', this.contracts);
      logger.info(`[ProLeasePlugin] Saved ${this.contracts.length} contracts`);
    } catch (error) {
      logger.error('[ProLeasePlugin] Failed to save contracts', error);
      throw error;
    }
  }

  // ========================================================================
  // FORMULA REGISTRATION
  // ========================================================================

  private registerFormulas(): void {
    const registry = this.context.kernel.calcEngine.getRegistry();

    // Present Value for Lease Payments
    registry.register(
      'LEASE_PV',
      (monthlyRate: number, months: number, payment: number) => {
        if (monthlyRate === 0) return payment * months;
        return payment * ((1 - Math.pow(1 + monthlyRate, -months)) / monthlyRate);
      },
      {
        argCount: 3,
        description: 'Calculate present value for lease payments (rate, months, payment)',
      }
    );

    // Convert Annual Rate to Monthly Rate
    registry.register(
      'LEASE_MONTHLY_RATE',
      (annualRate: number) => {
        return Math.pow(1 + annualRate / 100, 1 / 12) - 1;
      },
      {
        argCount: 1,
        description: 'Convert annual discount rate to monthly rate (annual %)',
      }
    );

    // Calculate ROU Asset Opening Balance
    registry.register(
      'LEASE_ROU_OPENING',
      (leaseLiability: number, directCosts: number, allowance: number) => {
        return leaseLiability + directCosts - allowance;
      },
      {
        argCount: 3,
        description: 'Calculate opening ROU asset (liability, direct costs, allowance)',
      }
    );

    logger.info('[ProLeasePlugin] Registered 3 IFRS 16 formulas');
  }

  // ========================================================================
  // UI SETUP
  // ========================================================================

  private setupUI(): void {
    // Add toolbar button
    this.context.ui.addToolbarButton({
      id: 'prolease-new-contract',
      label: 'New Lease',
      icon: '📋',
      tooltip: 'Create new IFRS 16 lease contract',
      onClick: () => this.handleNewContract(),
    });

    // Add control panel
    this.context.ui.addPanel({
      id: 'prolease-manager',
      title: '📋 ProLease Manager',
      position: 'right',
      render: (container) => this.renderControlPanel(container),
    });

    logger.info('[ProLeasePlugin] UI elements registered');
  }

  private renderControlPanel(container: HTMLElement): void {
    container.innerHTML = `
      <div class="prolease-panel" style="padding: 8px;">
        <button id="prolease-create-btn" class="prolease-btn-primary" style="
          width: 100%;
          padding: 10px;
          margin-bottom: 12px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
        ">
          ➕ Create New Contract
        </button>

        <div style="margin-bottom: 8px; font-size: 12px; color: #64748b; font-weight: 500;">
          SAVED CONTRACTS (${this.contracts.length})
        </div>

        <div id="prolease-contracts-list" style="
          max-height: 400px;
          overflow-y: auto;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
        ">
          ${this.renderContractsList()}
        </div>
      </div>
    `;

    // Attach event listeners
    const createBtn = container.querySelector('#prolease-create-btn');
    createBtn?.addEventListener('click', () => this.handleNewContract());

    this.attachContractListeners(container);
  }

  private renderContractsList(): string {
    if (this.contracts.length === 0) {
      return `
        <div style="padding: 20px; text-align: center; color: #94a3b8; font-size: 13px;">
          No contracts yet.<br>Click "Create New Contract" to begin.
        </div>
      `;
    }

    return this.contracts
      .map(
        (c) => `
        <div class="contract-item" style="
          padding: 12px;
          border-bottom: 1px solid #e2e8f0;
          transition: background 0.2s;
        ">
          <div style="font-weight: 600; font-size: 14px; color: #1e293b; margin-bottom: 4px;">
            ${this.escapeHtml(c.contractName)}
          </div>
          <div style="font-size: 12px; color: #64748b; margin-bottom: 8px;">
            📅 ${new Date(c.startDate).toLocaleDateString()} |
            📊 ${c.termMonths} months |
            💰 ${this.formatCurrency(c.totalRent)}/mo
          </div>
          <div style="display: flex; gap: 6px;">
            <button
              data-contract-id="${c.id}"
              data-action="recalc"
              style="
                flex: 1;
                padding: 6px 12px;
                font-size: 12px;
                background: #10b981;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: 500;
              ">
              🔄 Recalculate
            </button>
            <button
              data-contract-id="${c.id}"
              data-action="delete"
              style="
                padding: 6px 12px;
                font-size: 12px;
                background: #ef4444;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: 500;
              ">
              🗑️
            </button>
          </div>
        </div>
      `
      )
      .join('');
  }

  private attachContractListeners(container: HTMLElement): void {
    // Recalculate buttons
    container.querySelectorAll('[data-action="recalc"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const contractId = (e.target as HTMLElement).getAttribute('data-contract-id');
        const contract = this.contracts.find((c) => c.id === contractId);
        if (contract) {
          this.handleRecalculate(contract);
        }
      });
    });

    // Delete buttons
    container.querySelectorAll('[data-action="delete"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const contractId = (e.target as HTMLElement).getAttribute('data-contract-id');
        this.handleDelete(contractId);
      });
    });

    // Hover effects
    container.querySelectorAll('.contract-item').forEach((item) => {
      item.addEventListener('mouseenter', () => {
        (item as HTMLElement).style.background = '#f8fafc';
      });
      item.addEventListener('mouseleave', () => {
        (item as HTMLElement).style.background = 'transparent';
      });
    });
  }

  private showContractModal(contract?: LeaseContract): void {
    const isEditing = !!contract;
    const modalId = 'prolease-modal';

    // Remove existing modal
    document.getElementById(modalId)?.remove();

    const modalHTML = `
      <div id="${modalId}" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10001;">
        <div style="background: white; border-radius: 8px; padding: 24px; width: 90%; max-width: 500px;">
          <h3 style="margin-top: 0; margin-bottom: 20px;">${isEditing ? 'Edit Contract' : 'New IFRS 16 Contract'}</h3>
          <form id="prolease-contract-form">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
              <div style="grid-column: 1 / -1;">
                <label>Contract Name</label>
                <input type="text" name="contractName" value="${contract?.contractName || ''}" required>
              </div>
              <div>
                <label>Term (months)</label>
                <input type="number" name="termMonths" value="${contract?.termMonths || 36}" required>
              </div>
              <div>
                <label>Start Date</label>
                <input type="date" name="startDate" value="${contract?.startDate || new Date().toISOString().split('T')[0]}" required>
              </div>
              <div>
                <label>Monthly Rent (gross)</label>
                <input type="number" name="totalRent" value="${contract?.totalRent || 80000}" required>
              </div>
              <div>
                <label>Monthly Service Deductions</label>
                <input type="number" name="serviceDeductions" value="${contract?.serviceDeductions || 5000}" required>
              </div>
              <div>
                <label>Annual Discount Rate (%)</label>
                <input type="number" name="discountRate" value="${contract?.discountRate || 15}" step="0.01" required>
              </div>
              <div>
                <label>Landlord Allowance</label>
                <input type="number" name="initialLandlordAllowance" value="${contract?.initialLandlordAllowance || 0}" required>
              </div>
              <div style="grid-column: 1 / -1;">
                <label>Initial Direct Costs</label>
                <input type="number" name="initialDirectCosts" value="${contract?.initialDirectCosts || 30000}" required>
              </div>
            </div>
            <div style="margin-top: 24px; display: flex; justify-content: flex-end; gap: 8px;">
              <button type="button" id="prolease-modal-cancel">Cancel</button>
              <button type="submit" class="prolease-btn-primary">${isEditing ? 'Save Changes' : 'Create Contract'}</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const form = document.getElementById('prolease-contract-form') as HTMLFormElement;
    form.onsubmit = (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const newContract: LeaseContract = {
        id: contract?.id || this.generateId(),
        contractName: formData.get('contractName') as string,
        termMonths: +(formData.get('termMonths') as string),
        startDate: formData.get('startDate') as string,
        totalRent: +(formData.get('totalRent') as string),
        serviceDeductions: +(formData.get('serviceDeductions') as string),
        discountRate: +(formData.get('discountRate') as string),
        initialLandlordAllowance: +(formData.get('initialLandlordAllowance') as string),
        initialDirectCosts: +(formData.get('initialDirectCosts') as string),
        createdAt: contract?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (isEditing) {
        const index = this.contracts.findIndex(c => c.id === newContract.id);
        if (index !== -1) {
          this.contracts[index] = newContract;
        }
      } else {
        this.contracts.push(newContract);
      }

      this.saveContracts();
      this.refreshControlPanel();
      this.calculateAndCreateSheet(newContract);
      document.getElementById(modalId)?.remove();
    };

    document.getElementById('prolease-modal-cancel')!.onclick = () => {
      document.getElementById(modalId)?.remove();
    };
  }

  // ========================================================================
  // USER ACTIONS
  // ========================================================================

  private handleNewContract(): void {
    logger.info('[ProLeasePlugin] Creating new contract');
    this.showContractModal();
  }

  private handleRecalculate(contract: LeaseContract): void {
    logger.info('[ProLeasePlugin] Recalculating contract', { id: contract.id });
    this.context.ui.showToast(`Recalculating "${contract.contractName}"...`, 'info');
    this.calculateAndCreateSheet(contract);
  }

  private async handleDelete(contractId: string | null): Promise<void> {
    if (!contractId) return;

    const contract = this.contracts.find((c) => c.id === contractId);
    if (!contract) return;

    if (!confirm(`Delete contract "${contract.contractName}"?\n\nThis action cannot be undone.`)) {
      return;
    }

    this.contracts = this.contracts.filter((c) => c.id !== contractId);
    await this.saveContracts();

    logger.info('[ProLeasePlugin] Contract deleted', { id: contractId });
    this.context.ui.showToast('Contract deleted', 'success');

    this.refreshControlPanel();
  }

  // ========================================================================
  // CALCULATION ENGINE
  // ========================================================================

  private calculateAndCreateSheet(contract: LeaseContract): void {
    if (!this.worker) {
      this.context.ui.showToast('Calculator not ready', 'error');
      return;
    }

    this.worker.postMessage({ action: 'calculate', payload: contract });

    this.worker.onmessage = (event) => {
      const { action, payload, error } = event.data || {};

      if (error) {
        logger.error('[ProLeasePlugin] Calculation error:', error);
        this.context.ui.showToast(`Calculation error: ${error}`, 'error');
        return;
      }

      if (action === 'calculationComplete') {
        this.populateSheet(contract, payload.calculatedRows);
      }
    };
  }

  private populateSheet(contract: LeaseContract, calculatedRows: any[][]): void {
    try {
      const wbManager = this.context.kernel.workbookManager;

      // Get or create workbook
      let wb = wbManager.getActiveWorkbook();
      if (!wb) {
        wb = wbManager.createWorkbook('ProLease IFRS 16 Calculations');
        wbManager.setActiveWorkbook(wb.id);
        logger.info('[ProLeasePlugin] Created new workbook');
      }

      // Create or get sheet
      const sheetName = `IFRS16 - ${contract.contractName}`;
      const sheets = Array.from(wb.sheets.values()) as Sheet[];
      let sheet: Sheet | undefined = sheets.find((s: Sheet) => s.name === sheetName);

      if (!sheet) {
        sheet = wb.addSheet(sheetName);
        logger.info('[ProLeasePlugin] Created new sheet', { name: sheetName });
      } else {
        // Clear existing data
        const rows = sheet.rows;
        rows.forEach((rowMap: Map<number, any>, rowIdx: number) => {
          rowMap.forEach((_cell: any, colIdx: number) => {
            sheet!.clearCell(rowIdx, colIdx);
          });
        });
        logger.info('[ProLeasePlugin] Cleared existing sheet', { name: sheetName });
      }

      if (!sheet) {
        throw new Error('Failed to create or get sheet');
      }

      // Populate with headers and data
      const headers = calculatedRows[0] || [];
      const dataRows = calculatedRows.slice(1) || [];

      // Set headers
      headers.forEach((header: any, col: number) => {
        sheet!.setCell(0, col, String(header), {
          type: 'string',
          format: { bold: true, alignment: 'center' },
        });
      });

      // Set data rows
      dataRows.forEach((row: any[], rowIdx: number) => {
        row.forEach((val: any, col: number) => {
          const cellType = typeof val === 'number' ? 'number' : col === 1 ? 'date' : 'string';
          sheet!.setCell(rowIdx + 1, col, val, { type: cellType });
        });
      });

      // Activate the sheet
      wb.setActiveSheet(sheet.id);

      // Trigger recalculation
      this.context.kernel.kernel.recalculate(sheet.id, undefined, { force: true });

      logger.info('[ProLeasePlugin] Sheet populated successfully', {
        contract: contract.contractName,
        rows: dataRows.length,
        cols: headers.length,
      });

      this.context.ui.showToast(`Sheet "${sheetName}" created with ${dataRows.length} rows!`, 'success');
    } catch (error) {
      logger.error('[ProLeasePlugin] Sheet population failed', error);
      this.context.ui.showToast('Failed to create sheet', 'error');
    }
  }

  // ========================================================================
  // WEB WORKER CREATION
  // ========================================================================

  private createCalculationWorker(): Worker {
    const code = `
      // IFRS 16 Calculation Worker
      self.onmessage = function(event) {
        const { action, payload } = event.data || {};
        if (action !== 'calculate') return;

        try {
          const rows = generate(payload);
          const headers = getHeaders();
          self.postMessage({
            action: 'calculationComplete',
            payload: { contractData: payload, calculatedRows: [headers, ...rows] }
          });
        } catch (error) {
          self.postMessage({ error: (error && error.message) || String(error) });
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

        // Calculate initial lease liability (present value of all payments)
        let initialLeaseLiability = 0;
        for (let i = 0; i < termMonths; i++) {
          initialLeaseLiability += rentToCapitalize / Math.pow(1 + monthlyDiscountRate, i + 1);
        }

        // Opening ROU asset
        const openingROU = initialLeaseLiability + initialDirectCosts - initialLandlordAllowance;

        // Monthly amortization amounts
        const allowanceAmort = termMonths > 0 ? initialLandlordAllowance / termMonths : 0;
        const idcAmort = termMonths > 0 ? initialDirectCosts / termMonths : 0;
        const rouAmort = termMonths > 0 ? openingROU / termMonths : 0;

        // Running balances
        let curLease = initialLeaseLiability;
        let curAllowance = initialLandlordAllowance;
        let curIDC = initialDirectCosts;
        let curROU = openingROU;

        // Generate monthly rows
        for (let i = 1; i <= termMonths; i++) {
          const row = [];
          const curDate = new Date(startDate);
          curDate.setMonth(curDate.getMonth() + (i - 1));

          // Interest and principal
          const interest = curLease * monthlyDiscountRate;
          const principal = rentToCapitalize - interest;

          // Month number and date
          row[0] = i;
          row[1] = curDate.toISOString().split('T')[0];

          // Costs
          row[2] = totalRent;
          row[3] = serviceDeductions;
          row[4] = 0; // TI Allowance after commence (typically 0)
          row[5] = rentToCapitalize;

          // Remaining PV
          let remainingPV = 0;
          for (let j = i; j < termMonths; j++) {
            remainingPV += rentToCapitalize / Math.pow(1 + monthlyDiscountRate, j - i + 1);
          }
          row[6] = remainingPV;

          // Interest and liability
          row[7] = interest;
          curLease -= principal;
          row[8] = Math.abs(curLease) < 0.01 ? 0 : curLease;

          // ST/LT classification
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

          // Landlord allowance
          row[12] = (i === 1) ? initialLandlordAllowance : 0;
          row[13] = allowanceAmort;
          curAllowance -= allowanceAmort;
          row[14] = Math.abs(curAllowance) < 0.01 ? 0 : curAllowance;

          // Initial direct costs
          row[15] = (i === 1) ? initialDirectCosts : 0;
          row[16] = idcAmort;
          curIDC -= idcAmort;
          row[17] = Math.abs(curIDC) < 0.01 ? 0 : curIDC;

          // ROU asset
          row[18] = curROU;
          row[19] = rouAmort;
          curROU -= rouAmort;
          row[20] = Math.abs(curROU) < 0.01 ? 0 : curROU;

          // Total ROU and P&L
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
    const worker = new Worker(url);

    setTimeout(() => {
      try {
        URL.revokeObjectURL(url);
      } catch (_) {}
    }, 1000);

    logger.info('[ProLeasePlugin] Calculation worker created');
    return worker;
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  private refreshControlPanel(): void {
    const panel = document.querySelector('#plugin-panel-prolease-manager .panel-content');
    if (panel) {
      this.renderControlPanel(panel as HTMLElement);
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const manifest = new ProLeasePlugin().manifest;
export default ProLeasePlugin;
