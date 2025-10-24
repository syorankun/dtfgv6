# ProLease IFRS 16 Plugin - v6 Implementation Guide

## Quick Reference: Key Files and Interfaces

### 1. Source File Map

```
/home/user/dtfgv6/src/
├── @core/
│   ├── kernel.ts                           ← Core orchestrator
│   ├── plugin-system-consolidated.ts       ← Plugin host & base plugins
│   ├── types/index.ts                      ← All TypeScript interfaces
│   ├── workbook-consolidated.ts            ← Workbook/Sheet classes
│   ├── calc-engine-consolidated.ts         ← Formula engine
│   ├── storage-utils-consolidated.ts       ← Persistence & logging
│   ├── grid-virtual-consolidated.ts        ← Canvas-based grid
│   └── io-transform-consolidated.ts        ← I/O operations
├── app.ts                                  ← UI application entry
├── style.css                               ← Application styling
└── main.ts                                 ← Vite entry point

ProLease-specific:
├── prolease-ifrs16-plugin.js               ← Current plugin (v5.x)
└── PROLEASE_PLUGIN_README.md               ← Current documentation
```

### 2. Key Type Definitions (from types/index.ts)

```typescript
// Plugin interface (every plugin must implement)
interface Plugin {
  manifest: PluginManifest;
  init(context: PluginContext): Promise<void>;
  dispose?(): Promise<void>;
}

// Plugin manifest
interface PluginManifest {
  id: string;                    // 'dj.ifrs16.prolease'
  name: string;                  // 'ProLease IFRS 16'
  version: string;               // '6.0.0'
  author: string;
  description: string;
  permissions: PluginPermission[];
  entryPoint: string;
}

// Full context provided to plugin
interface PluginContext {
  pluginId: string;
  manifest: PluginManifest;
  kernel: KernelContext;
  storage: PluginStorageAPI;    // Plugin-specific persistent storage
  ui: PluginUIAPI;              // UI integration
  events: PluginEventAPI;       // Event system
}

// Kernel context - full access to services
interface KernelContext {
  kernel: DJDataForgeKernel;
  version: string;
  workbookManager: WorkbookManager;
  calcEngine: CalcEngine;
  companyManager: CompanyManager;
  eventBus: EventBus;
  storage: PersistenceManager;
}

// Plugin permissions
type PluginPermission =
  | "read:workbook"
  | "write:workbook"
  | "read:storage"
  | "write:storage"
  | "ui:toolbar"
  | "ui:panel"
  | "ui:menu"
  | "formula:register"
  | "transform:register"
  | "network:fetch";
```

### 3. Workbook/Sheet API (from workbook-consolidated.ts)

```typescript
class Workbook {
  readonly id: string;
  name: string;
  companyId?: string;
  sheets: Map<string, Sheet>;
  activeSheetId?: string;
  
  addSheet(name: string): Sheet;
  removeSheet(id: string): boolean;
  getSheet(id: string): Sheet | undefined;
  setActiveSheet(id: string): boolean;
  listSheets(): Sheet[];
  serialize(): any;
}

class Sheet {
  readonly id: string;
  name: string;
  columns: Map<number, Column>;
  rows: Map<number, Map<number, Cell>>;
  rowCount: number;
  colCount: number;
  
  setCell(row: number, col: number, value: any, options?: {
    formula?: string;
    type?: CellType;
    format?: CellFormat;
  }): void;
  
  getCell(row: number, col: number): Cell | undefined;
  getCellValue(row: number, col: number): any;
  getCellFormula(row: number, col: number): string | undefined;
  
  getRange(r1: number, c1: number, r2: number, c2: number): Cell[][];
  setRange(r1: number, c1: number, data: any[][]): void;
  
  addColumn(idx: number, name: string, type?: CellType): Column;
  insertRows(at: number, count?: number): void;
  deleteRows(at: number, count?: number): void;
}

interface Cell {
  value: any;
  type: CellType;
  formula?: string;
  error?: string;
  note?: string;
  format?: CellFormat;
}
```

### 4. Plugin Storage API (from plugin-system-consolidated.ts)

```typescript
interface PluginStorageAPI {
  async get(key: string): Promise<any>;
  async set(key: string, value: any): Promise<void>;
  async delete(key: string): Promise<void>;
  async clear(): Promise<void>;
}

// Implementation used:
class PluginStorageAPIImpl implements PluginStorageAPI {
  constructor(private pluginId: string, private storage: PersistenceManager) {}
  
  async get(key: string): Promise<any> {
    return await this.storage.getPluginData(this.pluginId, key);
  }
  
  async set(key: string, value: any): Promise<void> {
    await this.storage.savePluginData(this.pluginId, key, value);
  }
  
  async delete(key: string): Promise<void> {
    await this.storage.deletePluginData(this.pluginId, key);
  }
  
  async clear(): Promise<void> {
    await this.storage.clearPluginData(this.pluginId);
  }
}
```

### 5. Plugin UI API (from plugin-system-consolidated.ts)

```typescript
interface PluginUIAPI {
  addToolbarButton(config: ToolbarButtonConfig): void;
  addPanel(config: PanelConfig): void;
  addMenuItem(config: MenuItemConfig): void;
  showToast(message: string, type: "info" | "success" | "warning" | "error"): void;
}

interface ToolbarButtonConfig {
  id: string;
  label: string;
  icon?: string;
  tooltip?: string;
  onClick: () => void;
}

interface PanelConfig {
  id: string;
  title: string;
  render: (container: HTMLElement) => void;
  position?: "left" | "right" | "bottom";
}

interface MenuItemConfig {
  id: string;
  label: string;
  parent?: string;
  onClick: () => void;
  separator?: boolean;
}

// Implementation:
class PluginUIAPIImpl implements PluginUIAPI {
  private toolbarButtons: Map<string, ToolbarButtonConfig> = new Map();
  private panels: Map<string, PanelConfig> = new Map();
  private menuItems: Map<string, MenuItemConfig> = new Map();
  
  addToolbarButton(config: ToolbarButtonConfig): void {
    this.toolbarButtons.set(config.id, config);
    const toolbar = document.getElementById('plugin-toolbar');
    if (toolbar) {
      const btn = document.createElement('button');
      btn.id = `plugin-btn-${config.id}`;
      btn.className = 'ribbon-btn';
      btn.innerHTML = `
        <span class="ribbon-icon">${config.icon || ''}</span>
        <span class="ribbon-label">${config.label}</span>
      `;
      btn.onclick = config.onClick;
      toolbar.appendChild(btn);
    }
  }
  
  addPanel(config: PanelConfig): void {
    this.panels.set(config.id, config);
    const container = document.getElementById('plugin-panels');
    if (container) {
      const panel = document.createElement('div');
      panel.id = `plugin-panel-${config.id}`;
      panel.className = 'panel plugin-panel';
      
      const header = document.createElement('h4');
      header.textContent = config.title;
      panel.appendChild(header);
      
      const content = document.createElement('div');
      content.className = 'panel-content';
      panel.appendChild(content);
      
      config.render(content);
      container.appendChild(panel);
    }
  }
  
  showToast(message: string, type: "info" | "success" | "warning" | "error"): void {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
      color: white;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      animation: slideIn 0.3s ease-out;
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}
```

### 6. Formula Registry API (from calc-engine-consolidated.ts)

```typescript
class FormulaRegistry {
  register(
    name: string,
    impl: (...args: any[]) => any,
    options?: {
      argCount?: number;        // -1 = variadic
      async?: boolean;
      description?: string;
    }
  ): void;

  get(name: string): FunctionSpec | undefined;
  
  list(): FunctionSpec[];
}

interface FunctionSpec {
  name: string;
  impl: (...args: any[]) => any;
  argCount: number; // -1 = variadic
  async?: boolean;
  description?: string;
}

// Example from FXPackPlugin:
export class FXPackPlugin implements Plugin {
  async init(context: PluginContext): Promise<void> {
    const registry = context.kernel.calcEngine.getRegistry();
    
    registry.register('VPL', (taxa: number, ...valores: number[]) => {
      const flat = valores.flat();
      return flat.reduce((vpn, valor, i) => {
        return vpn + valor / Math.pow(1 + taxa, i + 1);
      }, 0);
    }, { description: 'Net Present Value' });
    
    registry.register('PGTO', (taxa: number, nper: number, vp: number, vf: number = 0, tipo: number = 0) => {
      if (taxa === 0) return -(vp + vf) / nper;
      const pvif = Math.pow(1 + taxa, nper);
      let pmt = taxa / (pvif - 1) * -(vp * pvif + vf);
      if (tipo === 1) pmt /= (1 + taxa);
      return pmt;
    }, { argCount: 5, description: 'Payment for loan' });
  }
}
```

### 7. Workbook Manager API (from kernel.ts)

```typescript
class WorkbookManager {
  createWorkbook(name?: string): Workbook;
  getWorkbook(id: string): Workbook | undefined;
  getActiveWorkbook(): Workbook | undefined;
  listWorkbooks(): Workbook[];
  deleteWorkbook(id: string): boolean;
  setActiveWorkbook(id: string): boolean;
}

// Used in app.ts to load/create workbooks:
const wb = kernel.workbookManager.createWorkbook('ProLease Calculations');
kernel.workbookManager.setActiveWorkbook(wb.id);

const activeWb = kernel.workbookManager.getActiveWorkbook();
if (activeWb) {
  const sheets = activeWb.listSheets();
  const sheet = activeWb.addSheet('IFRS16 Simulation');
}
```

### 8. Event System (from kernel.ts)

```typescript
class EventBus {
  on(event: string, handler: Function): void;
  off(event: string, handler: Function): void;
  emit(event: string, payload?: any): void;
  clear(): void;
}

// Events available:
'kernel:ready'              // Kernel initialized
'kernel:shutdown'           // Shutting down
'kernel:recalc-done'        // Recalculation complete
'kernel:autosave-done'      // Auto-save done
'workbook:created'          // Workbook created
'workbook:deleted'          // Workbook deleted
'workbook:saved'            // Workbook saved
'plugin:loaded'             // Plugin loaded
'plugin:unloaded'           // Plugin unloaded

// Usage:
kernel.eventBus.on('workbook:saved', (data) => {
  console.log('Workbook saved:', data.workbookId);
});
```

### 9. Kernel Recalculation API (from kernel.ts)

```typescript
class DJDataForgeKernel {
  async recalculate(
    sheetId: string,
    cellRef?: string,
    options?: { force?: boolean; async?: boolean }
  ): Promise<{ duration: number; cellsRecalc: number }>;
}

// Usage in plugin:
const sheet = workbook.getActiveSheet();
if (sheet) {
  const result = await context.kernel.recalculate(sheet.id);
  console.log(`Recalculated ${result.cellsRecalc} cells in ${result.duration}ms`);
}
```

---

## Implementation Checklist for ProLease v6

### Phase 1: Core Plugin Structure

- [ ] Create `src/plugins/prolease-ifrs16-plugin.ts`
- [ ] Implement `ProLeasePlugin` class implementing `Plugin` interface
- [ ] Define manifest with proper permissions
- [ ] Export class and manifest for registration
- [ ] Implement basic `init()` method
- [ ] Add logging setup

### Phase 2: Data Persistence

- [ ] Define `LeaseContract` interface with all IFRS 16 fields
- [ ] Implement contract saving via `context.storage.set()`
- [ ] Implement contract loading via `context.storage.get()`
- [ ] Handle contract updates and deletions
- [ ] Create contract list management

### Phase 3: UI Integration

- [ ] Add toolbar button "New Lease" with onClick handler
- [ ] Add control panel with contract list
- [ ] Implement form for lease data input (use prompts or modal)
- [ ] Add recalculation button for saved contracts
- [ ] Implement delete confirmation UI
- [ ] Add success/error toast notifications

### Phase 4: IFRS 16 Calculations

- [ ] Port `generate()` function from Web Worker
- [ ] Register financial formulas in CalcEngine
- [ ] Create worker for background calculations
- [ ] Handle worker communication
- [ ] Implement result array processing

### Phase 5: Sheet Management

- [ ] Create workbook "ProLease Calculations" on first use
- [ ] Generate sheet named per contract
- [ ] Write headers (24 columns as per original)
- [ ] Populate data rows from calculation results
- [ ] Handle sheet updates for recalculations
- [ ] Link to active company

### Phase 6: Event Handling and Integration

- [ ] Listen to workbook save events
- [ ] Subscribe to kernel ready event
- [ ] Emit plugin-specific events
- [ ] Handle cleanup in `dispose()` method
- [ ] Manage worker lifecycle

### Phase 7: Testing and Polish

- [ ] Test contract creation workflow
- [ ] Test data persistence across sessions
- [ ] Test recalculation accuracy
- [ ] Test sheet generation
- [ ] Test error handling
- [ ] Verify compatibility with multi-company

---

## Sample ProLease v6 Template

```typescript
// src/plugins/prolease-ifrs16-plugin.ts

import type { Plugin, PluginContext, PluginManifest } from '../@core/types';
import { logger } from '../@core/storage-utils-consolidated';

interface LeaseContract {
  id: string;
  contractName: string;
  termMonths: number;
  startDate: string;
  totalRent: number;
  serviceDeductions: number;
  discountRate: number;
  initialLandlordAllowance: number;
  initialDirectCosts: number;
}

export class ProLeasePlugin implements Plugin {
  manifest: PluginManifest = {
    id: 'dj.ifrs16.prolease',
    name: 'ProLease IFRS 16',
    version: '6.0.0',
    author: 'DJCalc / Código',
    description: 'IFRS 16 lease accounting calculator with amortization schedules',
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

  private contracts: LeaseContract[] = [];
  private worker?: Worker;

  async init(context: PluginContext): Promise<void> {
    logger.info('[ProLeasePlugin] Initializing...');

    try {
      // 1. Load saved contracts from plugin storage
      const saved = await context.storage.get('contracts');
      this.contracts = saved || [];

      // 2. Create worker for calculations
      this.worker = this.createWorker();

      // 3. Register IFRS 16 formulas
      this.registerFormulas(context);

      // 4. Setup UI elements
      this.setupUI(context);

      logger.info(`[ProLeasePlugin] Ready with ${this.contracts.length} saved contracts`);
      context.ui.showToast('ProLease IFRS 16 loaded!', 'success');
    } catch (error) {
      logger.error('[ProLeasePlugin] Initialization failed', error);
      context.ui.showToast('Failed to load ProLease plugin', 'error');
    }
  }

  private registerFormulas(context: PluginContext): void {
    const registry = context.kernel.calcEngine.getRegistry();

    // Register IFRS 16 financial functions
    registry.register(
      'LEASE_PV',
      (monthlyRate: number, months: number, payment: number) => {
        if (monthlyRate === 0) return payment * months;
        return payment * ((1 - Math.pow(1 + monthlyRate, -months)) / monthlyRate);
      },
      { argCount: 3, description: 'Present value for lease payments' }
    );

    registry.register(
      'LEASE_MONTHLY_RATE',
      (annualRate: number) => {
        return Math.pow(1 + annualRate / 100, 1 / 12) - 1;
      },
      { argCount: 1, description: 'Convert annual rate to monthly rate' }
    );
  }

  private setupUI(context: PluginContext): void {
    // Add toolbar button
    context.ui.addToolbarButton({
      id: 'prolease-new-contract',
      label: 'New Lease',
      icon: '📋',
      tooltip: 'Create new IFRS 16 lease contract',
      onClick: () => this.createNewLease(context),
    });

    // Add control panel
    context.ui.addPanel({
      id: 'prolease-manager',
      title: '📋 ProLease Manager',
      position: 'right',
      render: (container) => {
        this.renderControlPanel(container, context);
      },
    });
  }

  private renderControlPanel(container: HTMLElement, context: PluginContext): void {
    container.innerHTML = `
      <div class="prolease-panel">
        <button id="prolease-create-btn" style="width: 100%; padding: 8px; margin-bottom: 12px;">
          Create New Contract
        </button>
        <div id="prolease-contracts-list" style="max-height: 300px; overflow-y: auto;">
          ${this.renderContractsList()}
        </div>
      </div>
    `;

    const createBtn = container.querySelector('#prolease-create-btn');
    createBtn?.addEventListener('click', () => {
      this.createNewLease(context);
    });

    // Add event listeners to contract items
    this.attachContractListeners(container, context);
  }

  private renderContractsList(): string {
    if (this.contracts.length === 0) {
      return '<p style="color: #64748b; font-size: 12px;">No contracts yet</p>';
    }

    return this.contracts
      .map(
        (c) =>
          `<div style="padding: 8px; border-bottom: 1px solid #e2e8f0;">
        <div style="font-weight: 500;">${c.contractName}</div>
        <div style="font-size: 12px; color: #64748b;">
          ${c.termMonths} months | ${new Date(c.startDate).toLocaleDateString()}
        </div>
        <div style="margin-top: 4px;">
          <button data-contract-id="${c.id}" data-action="recalc" style="margin-right: 4px; padding: 4px 8px; font-size: 11px;">
            Recalc
          </button>
          <button data-contract-id="${c.id}" data-action="delete" style="padding: 4px 8px; font-size: 11px;">
            Delete
          </button>
        </div>
      </div>`
      )
      .join('');
  }

  private attachContractListeners(container: HTMLElement, context: PluginContext): void {
    // Recalculate
    container.querySelectorAll('[data-action="recalc"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const contractId = (e.target as HTMLElement).getAttribute('data-contract-id');
        const contract = this.contracts.find((c) => c.id === contractId);
        if (contract) {
          this.calculateAndCreateSheet(contract, context);
        }
      });
    });

    // Delete
    container.querySelectorAll('[data-action="delete"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const contractId = (e.target as HTMLElement).getAttribute('data-contract-id');
        if (confirm('Delete this contract?')) {
          this.contracts = this.contracts.filter((c) => c.id !== contractId);
          this.saveContracts(context);
          context.ui.showToast('Contract deleted', 'info');
          // Re-render panel
          const panel = document.querySelector('#prolease-manager');
          if (panel) {
            const content = panel.querySelector('.panel-content');
            if (content) {
              this.renderControlPanel(content as HTMLElement, context);
            }
          }
        }
      });
    });
  }

  private createNewLease(context: PluginContext): void {
    const contractName = prompt('Contract name:', 'Contract 1');
    if (!contractName) return;

    if (this.contracts.some((c) => c.contractName === contractName)) {
      context.ui.showToast('Contract name already exists', 'error');
      return;
    }

    const termMonths = parseInt(prompt('Term (months):', '36') || '0', 10);
    if (isNaN(termMonths) || termMonths <= 0) return;

    const startDate = prompt('Start date (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
    if (!startDate) return;

    const totalRent = parseFloat(prompt('Monthly rent (gross):', '80000') || '0');
    if (isNaN(totalRent) || totalRent <= 0) return;

    const serviceDeductions = parseFloat(prompt('Monthly service deductions:', '5000') || '0');
    if (isNaN(serviceDeductions)) return;

    const discountRate = parseFloat(prompt('Annual discount rate (%):', '15') || '0');
    if (isNaN(discountRate)) return;

    const initialLandlordAllowance = parseFloat(prompt('Landlord allowance:', '0') || '0');
    if (isNaN(initialLandlordAllowance)) return;

    const initialDirectCosts = parseFloat(prompt('Initial direct costs:', '30000') || '0');
    if (isNaN(initialDirectCosts)) return;

    const contract: LeaseContract = {
      id: Math.random().toString(36).slice(2),
      contractName,
      termMonths,
      startDate,
      totalRent,
      serviceDeductions,
      discountRate,
      initialLandlordAllowance,
      initialDirectCosts,
    };

    this.contracts.push(contract);
    this.saveContracts(context);

    context.ui.showToast('Contract created. Calculating...', 'info');
    this.calculateAndCreateSheet(contract, context);
  }

  private calculateAndCreateSheet(contract: LeaseContract, context: PluginContext): void {
    if (!this.worker) {
      context.ui.showToast('Calculator not ready', 'error');
      return;
    }

    this.worker.postMessage({ action: 'calculate', payload: contract });

    this.worker.onmessage = (event) => {
      const { action, payload, error } = event.data || {};

      if (error) {
        logger.error('[ProLeasePlugin] Calculation error:', error);
        context.ui.showToast(`Calculation error: ${error}`, 'error');
        return;
      }

      if (action === 'calculationComplete') {
        this.populateSheet(contract, payload.calculatedRows, context);
      }
    };
  }

  private populateSheet(
    contract: LeaseContract,
    calculatedRows: any[][],
    context: PluginContext
  ): void {
    try {
      const wbManager = context.kernel.workbookManager;

      // Get or create workbook
      let wb = wbManager.getActiveWorkbook();
      if (!wb) {
        wb = wbManager.createWorkbook('ProLease Calculations');
        wbManager.setActiveWorkbook(wb.id);
      }

      // Create or get sheet
      const sheetName = `IFRS16 - ${contract.contractName}`;
      let sheet = wb.getSheet(
        Array.from(wb.listSheets()).find((s) => s.name === sheetName)?.id || ''
      );

      if (!sheet) {
        sheet = wb.addSheet(sheetName);
      } else {
        // Clear existing sheet
        for (let r = 0; r < sheet.rowCount; r++) {
          for (let c = 0; c < sheet.colCount; c++) {
            sheet.clearCell(r, c);
          }
        }
      }

      // Populate with headers and data
      const headers = calculatedRows[0] || [];
      const dataRows = calculatedRows.slice(1) || [];

      headers.forEach((h: any, col: number) => {
        sheet.setCell(0, col, h);
      });

      dataRows.forEach((row: any[], rowIdx: number) => {
        row.forEach((val: any, col: number) => {
          sheet.setCell(rowIdx + 1, col, val);
        });
      });

      wb.setActiveSheet(sheet.id);

      context.ui.showToast(`Sheet "${sheetName}" created!`, 'success');
      logger.info('[ProLeasePlugin] Sheet populated', { contractName: contract.contractName });
    } catch (error) {
      logger.error('[ProLeasePlugin] Sheet creation failed', error);
      context.ui.showToast('Failed to create sheet', 'error');
    }
  }

  private async saveContracts(context: PluginContext): Promise<void> {
    try {
      await context.storage.set('contracts', this.contracts);
    } catch (error) {
      logger.error('[ProLeasePlugin] Failed to save contracts', error);
    }
  }

  private createWorker(): Worker {
    const code = `
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
          "Month #", "Date", "A) Sum of All Costs", "B) Monthly Service Deductions",
          "C) Landlord TI Allowance", "D) Total Rent Capitalized", "Remaining PV",
          "E) Interest", "End of Month Liability", "ST Liability", "LT Liability",
          "Proof (ST+LT)", "F) New Initial Allowance", "I) Allowance Amort",
          "J) Allowance Balance", "K) New IDC", "N) IDC Amort", "O) IDC Balance",
          "S) Opening ROU", "U) ROU Amort", "V) ROU Balance", "Total ROU Balance",
          "W) P&L Non-Financial", "P&L - Reported Expense"
        ];
      }

      function generate(d) {
        // Copy calculation logic from original prolease-ifrs16-plugin.js
        // ... [full implementation from Web Worker]
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

    return worker;
  }

  async dispose(): Promise<void> {
    if (this.worker) {
      this.worker.terminate();
    }
    logger.info('[ProLeasePlugin] Disposed');
  }
}

export const manifest = new ProLeasePlugin().manifest;
export default manifest;
```

---

## Key Differences: Legacy vs Native v6

| Feature | Legacy (Current) | Native v6 |
|---------|-----------------|-----------|
| **Module** | IIFE (self-executing) | ES6 module with export |
| **Entry** | Auto-bootstrap + polling | Explicit manifest + init() |
| **Workbook Access** | Direct `workbook.sheets` | Via `context.kernel.workbookManager` |
| **Sheet Operations** | Direct array manipulation | Sheet API (setCell, getRange, etc) |
| **Storage** | Raw IndexedDB operations | `context.storage` API |
| **UI Updates** | Direct DOM manipulation | Via `context.ui` methods |
| **Events** | Custom registry callbacks | Kernel EventBus |
| **Worker** | Inline creation | Modern URL-based creation |
| **Logging** | console.log/error | Kernel logger |

---

## Testing Workflow

### Manual Testing Steps

1. **Plugin Loads**
   - Check console for `[ProLeasePlugin] Initializing...`
   - Verify toolbar button appears
   - Verify panel renders

2. **Create Contract**
   - Click "New Lease"
   - Fill in form fields
   - Verify save message

3. **Sheet Generation**
   - Verify new sheet created
   - Check headers (24 columns)
   - Verify data rows populated

4. **Persistence**
   - Refresh page
   - Verify contracts still appear in panel

5. **Recalculation**
   - Click "Recalc" on saved contract
   - Verify sheet updates
   - Verify no duplicate sheets

