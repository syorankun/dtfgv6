/**
 * ProLease IFRS 16 Plugin - Single File for Dynamic Import
 *
 * Compatible with:
 * - file:// protocol (no CORS issues)
 * - DataForge dynamic plugin loading system
 * - Blob URL imports
 *
 * Usage: Load this file via "Load Plugin" button in DataForge
 */

class ProLeaseIFRS16Plugin {
  constructor() {
    this.manifest = {
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
      entryPoint: 'prolease-plugin.js',
    };

    this.context = null;
    this.contracts = [];
    this.worker = null;
  }

  // ========================================================================
  // LIFECYCLE
  // ========================================================================

  async init(context) {
    this.context = context;
    this.log('Initializing ProLease IFRS 16 v6.0.0...');

    try {
      await this.loadContracts();
      this.worker = this.createCalculationWorker();
      this.registerFormulas();
      this.setupUI();

      this.log(\`Ready with \${this.contracts.length} saved contracts\`);
      context.ui.showToast(\`ProLease IFRS 16 loaded! \${this.contracts.length} contract(s)\`, 'success');
    } catch (error) {
      this.error('Initialization failed', error);
      context.ui.showToast('Failed to load ProLease plugin', 'error');
      throw error;
    }
  }

  async dispose() {
    this.log('Disposing...');
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    await this.saveContracts();
    this.log('Disposed successfully');
  }

  // ========================================================================
  // LOGGING
  // ========================================================================

  log(...args) {
    console.log('[ProLeasePlugin]', ...args);
  }

  error(...args) {
    console.error('[ProLeasePlugin]', ...args);
  }

  // ========================================================================
  // DATA PERSISTENCE
  // ========================================================================

  async loadContracts() {
    try {
      const saved = await this.context.storage.get('contracts');
      this.contracts = saved || [];
      this.log(\`Loaded \${this.contracts.length} contracts\`);
    } catch (error) {
      this.error('Failed to load contracts', error);
      this.contracts = [];
    }
  }

  async saveContracts() {
    try {
      await this.context.storage.set('contracts', this.contracts);
      this.log(\`Saved \${this.contracts.length} contracts\`);
    } catch (error) {
      this.error('Failed to save contracts', error);
      throw error;
    }
  }

  // ========================================================================
  // FORMULA REGISTRATION
  // ========================================================================

  registerFormulas() {
    const registry = this.context.kernel.calcEngine.getRegistry();

    // Present Value for Lease Payments
    registry.register(
      'LEASE_PV',
      (monthlyRate, months, payment) => {
        if (monthlyRate === 0) return payment * months;
        return payment * ((1 - Math.pow(1 + monthlyRate, -months)) / monthlyRate);
      },
      { argCount: 3, description: 'Calculate present value for lease payments (rate, months, payment)' }
    );

    // Convert Annual Rate to Monthly Rate
    registry.register(
      'LEASE_MONTHLY_RATE',
      (annualRate) => Math.pow(1 + annualRate / 100, 1 / 12) - 1,
      { argCount: 1, description: 'Convert annual discount rate to monthly rate (annual %)' }
    );

    // Calculate ROU Asset Opening Balance
    registry.register(
      'LEASE_ROU_OPENING',
      (leaseLiability, directCosts, allowance) => leaseLiability + directCosts - allowance,
      { argCount: 3, description: 'Calculate opening ROU asset (liability, direct costs, allowance)' }
    );

    this.log('Registered 3 IFRS 16 formulas');
  }

  // ========================================================================
  // UI SETUP
  // ========================================================================

  setupUI() {
    this.context.ui.addToolbarButton({
      id: 'prolease-new-contract',
      label: 'New Lease',
      icon: '📋',
      tooltip: 'Create new IFRS 16 lease contract',
      onClick: () => this.handleNewContract(),
    });

    this.context.ui.addPanel({
      id: 'prolease-manager',
      title: '📋 ProLease Manager',
      position: 'right',
      render: (container) => this.renderControlPanel(container),
    });

    this.log('UI elements registered');
  }

  renderControlPanel(container) {
    container.innerHTML = \`
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
          SAVED CONTRACTS (\${this.contracts.length})
        </div>

        <div id="prolease-contracts-list" style="
          max-height: 400px;
          overflow-y: auto;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
        ">
          \${this.renderContractsList()}
        </div>
      </div>
    \`;

    const createBtn = container.querySelector('#prolease-create-btn');
    createBtn?.addEventListener('click', () => this.handleNewContract());

    this.attachContractListeners(container);
  }

  renderContractsList() {
    if (this.contracts.length === 0) {
      return \`
        <div style="padding: 20px; text-align: center; color: #94a3b8; font-size: 13px;">
          No contracts yet.<br>Click "Create New Contract" to begin.
        </div>
      \`;
    }

    return this.contracts
      .map(
        (c) => \`
        <div class="contract-item" style="
          padding: 12px;
          border-bottom: 1px solid #e2e8f0;
          transition: background 0.2s;
        " onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
          <div style="font-weight: 600; font-size: 14px; color: #1e293b; margin-bottom: 4px;">
            \${this.escapeHtml(c.contractName)}
          </div>
          <div style="font-size: 12px; color: #64748b; margin-bottom: 8px;">
            📅 \${new Date(c.startDate).toLocaleDateString()} |
            📊 \${c.termMonths} months |
            💰 \${this.formatCurrency(c.totalRent)}/mo
          </div>
          <div style="display: flex; gap: 6px;">
            <button
              data-contract-id="\${c.id}"
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
              data-contract-id="\${c.id}"
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
      \`
      )
      .join('');
  }

  attachContractListeners(container) {
    container.querySelectorAll('[data-action="recalc"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const contractId = e.target.getAttribute('data-contract-id');
        const contract = this.contracts.find((c) => c.id === contractId);
        if (contract) this.handleRecalculate(contract);
      });
    });

    container.querySelectorAll('[data-action="delete"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const contractId = e.target.getAttribute('data-contract-id');
        this.handleDelete(contractId);
      });
    });
  }

  // ========================================================================
  // USER ACTIONS
  // ========================================================================

  handleNewContract() {
    this.log('Creating new contract');

    const contractName = prompt('Contract Name:', \`Contract \${this.contracts.length + 1}\`);
    if (!contractName) {
      this.context.ui.showToast('Contract creation cancelled', 'info');
      return;
    }

    if (this.contracts.some((c) => c.contractName === contractName)) {
      this.context.ui.showToast('Contract name already exists', 'error');
      return;
    }

    const termMonths = this.promptNumber('Term (months):', 36);
    if (termMonths === null || termMonths <= 0) return;

    const startDate = prompt('Start Date (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
    if (!startDate) return;

    const totalRent = this.promptNumber('Monthly Rent (gross):', 80000);
    if (totalRent === null || totalRent <= 0) return;

    const serviceDeductions = this.promptNumber('Monthly Service Deductions:', 5000);
    if (serviceDeductions === null) return;

    const discountRate = this.promptNumber('Annual Discount Rate (%):', 15);
    if (discountRate === null) return;

    const initialLandlordAllowance = this.promptNumber('Landlord Allowance:', 0);
    if (initialLandlordAllowance === null) return;

    const initialDirectCosts = this.promptNumber('Initial Direct Costs:', 30000);
    if (initialDirectCosts === null) return;

    const contract = {
      id: this.generateId(),
      contractName,
      termMonths,
      startDate,
      totalRent,
      serviceDeductions,
      discountRate,
      initialLandlordAllowance,
      initialDirectCosts,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.contracts.push(contract);
    this.saveContracts();

    this.log('Contract created', { id: contract.id, name: contractName });
    this.context.ui.showToast(\`Contract "\${contractName}" created. Calculating...\`, 'info');

    this.calculateAndCreateSheet(contract);
    this.refreshControlPanel();
  }

  handleRecalculate(contract) {
    this.log('Recalculating contract', { id: contract.id });
    this.context.ui.showToast(\`Recalculating "\${contract.contractName}"...\`, 'info');
    this.calculateAndCreateSheet(contract);
  }

  async handleDelete(contractId) {
    if (!contractId) return;

    const contract = this.contracts.find((c) => c.id === contractId);
    if (!contract) return;

    if (!confirm(\`Delete contract "\${contract.contractName}"?\\n\\nThis action cannot be undone.\`)) {
      return;
    }

    this.contracts = this.contracts.filter((c) => c.id !== contractId);
    await this.saveContracts();

    this.log('Contract deleted', { id: contractId });
    this.context.ui.showToast('Contract deleted', 'success');

    this.refreshControlPanel();
  }

  // ========================================================================
  // CALCULATION ENGINE
  // ========================================================================

  calculateAndCreateSheet(contract) {
    if (!this.worker) {
      this.context.ui.showToast('Calculator not ready', 'error');
      return;
    }

    this.worker.postMessage({ action: 'calculate', payload: contract });

    this.worker.onmessage = (event) => {
      const { action, payload, error } = event.data || {};

      if (error) {
        this.error('Calculation error:', error);
        this.context.ui.showToast(\`Calculation error: \${error}\`, 'error');
        return;
      }

      if (action === 'calculationComplete') {
        this.populateSheet(contract, payload.calculatedRows);
      }
    };
  }

  populateSheet(contract, calculatedRows) {
    try {
      const wbManager = this.context.kernel.workbookManager;

      let wb = wbManager.getActiveWorkbook();
      if (!wb) {
        wb = wbManager.createWorkbook('ProLease IFRS 16 Calculations');
        wbManager.setActiveWorkbook(wb.id);
        this.log('Created new workbook');
      }

      const sheetName = \`IFRS16 - \${contract.contractName}\`;
      const sheets = Array.from(wb.sheets.values());
      let sheet = sheets.find((s) => s.name === sheetName);

      if (!sheet) {
        sheet = wb.addSheet(sheetName);
        this.log('Created new sheet', { name: sheetName });
      } else {
        const rows = sheet.rows;
        rows.forEach((rowMap, rowIdx) => {
          rowMap.forEach((cell, colIdx) => {
            sheet.clearCell(rowIdx, colIdx);
          });
        });
        this.log('Cleared existing sheet', { name: sheetName });
      }

      const headers = calculatedRows[0] || [];
      const dataRows = calculatedRows.slice(1) || [];

      headers.forEach((header, col) => {
        sheet.setCell(0, col, String(header), {
          type: 'string',
          format: { bold: true, alignment: 'center' },
        });
      });

      dataRows.forEach((row, rowIdx) => {
        row.forEach((val, col) => {
          const cellType = typeof val === 'number' ? 'number' : col === 1 ? 'date' : 'string';
          sheet.setCell(rowIdx + 1, col, val, { type: cellType });
        });
      });

      wb.setActiveSheet(sheet.id);
      this.context.kernel.kernel.recalculate(sheet.id, undefined, { force: true });

      this.log('Sheet populated successfully', {
        contract: contract.contractName,
        rows: dataRows.length,
        cols: headers.length,
      });

      this.context.ui.showToast(\`Sheet "\${sheetName}" created with \${dataRows.length} rows!\`, 'success');
    } catch (error) {
      this.error('Sheet population failed', error);
      this.context.ui.showToast('Failed to create sheet', 'error');
    }
  }

  // ========================================================================
  // WEB WORKER CREATION
  // ========================================================================

  createCalculationWorker() {
    const code = \`
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
    \`;

    const blob = new Blob([code], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);

    setTimeout(() => {
      try { URL.revokeObjectURL(url); } catch (_) {}
    }, 1000);

    this.log('Calculation worker created');
    return worker;
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  refreshControlPanel() {
    const panel = document.querySelector('#plugin-panel-prolease-manager .panel-content');
    if (panel) this.renderControlPanel(panel);
  }

  promptNumber(message, defaultValue) {
    const input = prompt(message, String(defaultValue));
    if (input === null) return null;
    const num = parseFloat(input);
    return isNaN(num) ? null : num;
  }

  generateId() {
    return \`\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  formatCurrency(value) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }
}

// ============================================================================
// EXPORT DEFAULT (Required by DataForge plugin system)
// ============================================================================

export default ProLeaseIFRS16Plugin;
