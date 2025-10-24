# DataForge v6 Architecture Analysis - Complete Plugin Guide

## Executive Summary

This document provides a complete architectural overview of DJ DataForge v6 and is designed to guide the rewriting of the ProLease IFRS 16 plugin as a native v6 module. The architecture is built on a modular, plugin-first design with a centralized kernel orchestrating all components.

---

## 1. CORE ARCHITECTURE OVERVIEW

### 1.1 System Layers

```
┌─────────────────────────────────────────────────────────┐
│                      UI Layer (app.ts)                  │
│         Excel-Style Ribbon, Virtual Grid, Panels        │
├─────────────────────────────────────────────────────────┤
│                   Plugin Layer (plugin-system)          │
│      ChartsPlugin, PivotPlugin, FXPackPlugin, etc.      │
├─────────────────────────────────────────────────────────┤
│                    API Layer (KernelContext)            │
│    Events, UI Integration, Storage, Calc Engine         │
├─────────────────────────────────────────────────────────┤
│                  Core Services (Kernel)                 │
│  WorkbookManager, CalcEngine, CompanyManager, etc.      │
├─────────────────────────────────────────────────────────┤
│            Persistence Layer (IndexedDB)                │
│         Companies, Workbooks, Plugin Data, etc.         │
└─────────────────────────────────────────────────────────┘
```

### 1.2 Singleton Kernel

The kernel is a singleton that provides access to all core services:

```typescript
// Access via singleton
import { kernel } from '@core/kernel';
const instance = DJDataForgeKernel.getInstance();

// Key properties:
kernel.workbookManager      // Manages workbooks and sheets
kernel.calcEngine           // Formula parser and evaluator
kernel.storageManager       // IndexedDB persistence
kernel.companyManager       // Multi-company support
kernel.pluginHost           // Plugin loading and management
kernel.eventBus            // Pub/sub event system
kernel.sessionManager      // Session tracking
```

---

## 2. PLUGIN SYSTEM ARCHITECTURE

### 2.1 Plugin Interface

Every plugin must implement this interface:

```typescript
interface Plugin {
  manifest: PluginManifest;
  init(context: PluginContext): Promise<void>;
  dispose?(): Promise<void>;  // Optional cleanup
}

interface PluginManifest {
  id: string;                    // Unique identifier (e.g., 'dj.ifrs16.prolease')
  name: string;                  // Display name
  version: string;               // Semantic version
  author: string;                // Author name
  description: string;           // Short description
  permissions: PluginPermission[]; // Required permissions
  entryPoint: string;            // Entry file path
}

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

### 2.2 Plugin Context API

Each plugin receives a `PluginContext` with full access to kernel services:

```typescript
interface PluginContext {
  pluginId: string;
  manifest: PluginManifest;
  kernel: KernelContext;        // Full kernel context
  storage: PluginStorageAPI;    // Plugin-specific persistent storage
  ui: PluginUIAPI;              // UI integration
  events: PluginEventAPI;       // Event system
}

interface KernelContext {
  kernel: DJDataForgeKernel;        // Kernel instance
  version: string;                   // v6.0.0
  workbookManager: WorkbookManager;
  calcEngine: CalcEngine;
  companyManager: CompanyManager;
  eventBus: EventBus;
  storage: PersistenceManager;
}
```

### 2.3 Example Built-in Plugin: FXPackPlugin

Reference implementation for how plugins are structured:

```typescript
export class FXPackPlugin implements Plugin {
  manifest: PluginManifest = {
    id: 'fx-pack',
    name: 'FX Pack',
    version: '1.0.0',
    author: 'DJ DataForge Team',
    description: 'Financial and statistical formulas',
    permissions: ['formula:register'],
    entryPoint: 'fx-pack.js',
  };

  async init(context: PluginContext): Promise<void> {
    // Get the formula registry
    const registry = context.kernel.calcEngine.getRegistry();
    
    // Register custom functions
    registry.register('VPL', (taxa: number, ...valores: number[]) => {
      return valores.reduce((vpn, valor, i) => {
        return vpn + valor / Math.pow(1 + taxa, i + 1);
      }, 0);
    }, { description: 'Net Present Value' });
    
    // Show success toast
    context.ui.showToast('FX Pack loaded successfully!', 'success');
  }
}
```

### 2.4 Plugin Loading Flow

```
┌─────────────────────────────────────┐
│  PluginHost.loadPlugin()            │
├─────────────────────────────────────┤
│ 1. Validate permissions             │
│ 2. Instantiate plugin class         │
│ 3. Create PluginContext             │
│ 4. Call plugin.init(context)        │
│ 5. Store plugin instance & context  │
│ 6. Emit 'plugin:loaded' event       │
└─────────────────────────────────────┘
```

---

## 3. PLUGIN UI INTEGRATION

### 3.1 UI API Methods

Plugins can add UI elements through the context:

```typescript
interface PluginUIAPI {
  // Add button to toolbar
  addToolbarButton(config: ToolbarButtonConfig): void;
  
  // Add side panel
  addPanel(config: PanelConfig): void;
  
  // Add menu item
  addMenuItem(config: MenuItemConfig): void;
  
  // Show notification
  showToast(message: string, type: "info" | "success" | "warning" | "error"): void;
}

interface ToolbarButtonConfig {
  id: string;
  label: string;
  icon?: string;        // HTML/emoji icon
  tooltip?: string;
  onClick: () => void;  // Called when clicked
}

interface PanelConfig {
  id: string;
  title: string;
  position?: "left" | "right" | "bottom";
  render: (container: HTMLElement) => void;  // Render function
}

interface MenuItemConfig {
  id: string;
  label: string;
  parent?: string;     // Parent menu group
  onClick: () => void;
  separator?: boolean;
}
```

### 3.2 Example: Adding UI Elements

```typescript
async init(context: PluginContext): Promise<void> {
  // Add toolbar button
  context.ui.addToolbarButton({
    id: 'calculate-lease',
    label: 'Calculate Lease',
    icon: '📊',
    tooltip: 'Calculate IFRS 16 lease contract',
    onClick: () => {
      this.calculateLease(context);
    },
  });

  // Add side panel
  context.ui.addPanel({
    id: 'lease-calculator',
    title: 'Lease Calculator',
    position: 'right',
    render: (container) => {
      container.innerHTML = `
        <form id="lease-form">
          <input type="text" placeholder="Contract name" />
          <input type="number" placeholder="Term months" />
          <button type="submit">Calculate</button>
        </form>
      `;
      
      const form = container.querySelector('#lease-form');
      form?.addEventListener('submit', (e) => {
        e.preventDefault();
        this.calculateLease(context);
      });
    },
  });

  // Show toast notification
  context.ui.showToast('Lease plugin loaded!', 'success');
}
```

---

## 4. WORKBOOK AND SHEET MANAGEMENT

### 4.1 Workbook Manager

Central manager for all workbook operations:

```typescript
class WorkbookManager {
  // Create new workbook
  createWorkbook(name?: string): Workbook;
  
  // Access workbooks
  getWorkbook(id: string): Workbook | undefined;
  getActiveWorkbook(): Workbook | undefined;
  listWorkbooks(): Workbook[];
  
  // Delete workbook
  deleteWorkbook(id: string): boolean;
  
  // Activation
  setActiveWorkbook(id: string): boolean;
}
```

### 4.2 Workbook Structure

```typescript
class Workbook {
  readonly id: string;
  name: string;
  companyId?: string;
  version: string;
  sheets: Map<string, Sheet>;     // Sheet collections
  activeSheetId?: string;
  createdAt: Date;
  modifiedAt: Date;

  // Sheet operations
  addSheet(name: string): Sheet;
  removeSheet(id: string): boolean;
  getSheet(id: string): Sheet | undefined;
  getActiveSheet(): Sheet | undefined;
  listSheets(): Sheet[];
}
```

### 4.3 Sheet Structure

```typescript
class Sheet {
  readonly id: string;
  name: string;
  columns: Map<number, Column>;   // Column metadata
  rows: Map<number, Map<number, Cell>>;  // Sparse cell storage
  rowCount: number;
  colCount: number;

  // Cell operations
  setCell(row: number, col: number, value: any, options?: {
    formula?: string;
    type?: CellType;
    format?: CellFormat;
  }): void;
  
  getCell(row: number, col: number): Cell | undefined;
  getCellValue(row: number, col: number): any;
  getCellFormula(row: number, col: number): string | undefined;
  
  // Range operations
  getRange(r1: number, c1: number, r2: number, c2: number): Cell[][];
  setRange(r1: number, c1: number, data: any[][]): void;
  
  // Column operations
  addColumn(idx: number, name: string, type?: CellType): Column;
  renameColumn(idx: number, newName: string): void;
  
  // Row operations
  insertRows(at: number, count?: number): void;
  deleteRows(at: number, count?: number): void;
}
```

### 4.4 Creating Sheets from Plugin

```typescript
async init(context: PluginContext): Promise<void> {
  const wbManager = context.kernel.workbookManager;
  
  // Create or get workbook
  let workbook = wbManager.getActiveWorkbook();
  if (!workbook) {
    workbook = wbManager.createWorkbook('ProLease Calculations');
    wbManager.setActiveWorkbook(workbook.id);
  }

  // Add a new sheet
  const sheet = workbook.addSheet('IFRS16 - Sample Contract');
  
  // Set headers
  const headers = [
    "Month #", "Date", "Rent", "Service", "Interest", 
    "Liability", "ROU Asset", "P&L Impact"
  ];
  headers.forEach((h, col) => {
    sheet.setCell(0, col, h);
  });
  
  // Set data
  const data = [
    [1, '2025-01-01', 80000, 5000, 1500, 475000, 520000, 6500],
    [2, '2025-02-01', 80000, 5000, 1485, 470000, 515000, 6485],
  ];
  data.forEach((row, rowIdx) => {
    row.forEach((val, colIdx) => {
      sheet.setCell(rowIdx + 1, colIdx, val);
    });
  });
  
  // Make it active
  workbook.setActiveSheet(sheet.id);
}
```

---

## 5. FORMULA SYSTEM AND CALCULATION ENGINE

### 5.1 Formula Registry

Plugins can register custom formulas:

```typescript
class FormulaRegistry {
  // Register custom function
  register(
    name: string,
    impl: (...args: any[]) => any,
    options?: {
      argCount?: number;        // -1 = variadic
      async?: boolean;
      description?: string;
    }
  ): void;

  // Get function
  get(name: string): FunctionSpec | undefined;
  
  // List all functions
  list(): FunctionSpec[];
}

// In plugin
async init(context: PluginContext): Promise<void> {
  const registry = context.kernel.calcEngine.getRegistry();
  
  // Register financial functions
  registry.register('IFRS_PRESENT_VALUE', 
    (monthlyRate: number, months: number, payment: number) => {
      // Calculate PV
      return payment * ((1 - Math.pow(1 + monthlyRate, -months)) / monthlyRate);
    },
    { argCount: 3, description: 'Present value for lease' }
  );
}
```

### 5.2 Formula Evaluation Flow

```
User enters: =SOMA(A1:A10)
    ↓
FormulaParser.tokenize() → Tokens
    ↓
FormulaParser.parse() → AST
    ↓
CalcEngine.evalAST() → Recursively evaluate
    ↓
Registry lookup for SOMA
    ↓
Evaluate arguments (A1:A10 → array of values)
    ↓
Call registry function
    ↓
Cell value = result
```

### 5.3 Dependency Tracking

Formulas are automatically tracked for recalculation:

```typescript
// Recalculate a sheet
await context.kernel.recalculate(sheet.id);

// Recalculate specific cell and dependents
await context.kernel.recalculate(sheet.id, 'A1');

// Force recalculation (ignore cache)
await context.kernel.recalculate(sheet.id, 'A1', { force: true });
```

---

## 6. DATA PERSISTENCE

### 6.1 Plugin Storage API

Each plugin gets isolated storage:

```typescript
interface PluginStorageAPI {
  async get(key: string): Promise<any>;
  async set(key: string, value: any): Promise<void>;
  async delete(key: string): Promise<void>;
  async clear(): Promise<void>;
}

// Usage in plugin
async init(context: PluginContext): Promise<void> {
  // Save contracts
  const contracts = [
    { 
      id: 'c1', 
      name: 'Lease 1', 
      term: 36,
      // ... more fields
    }
  ];
  
  await context.storage.set('contracts', contracts);
  
  // Load contracts
  const saved = await context.storage.get('contracts');
}
```

### 6.2 Workbook Persistence

Workbooks are automatically saved to IndexedDB:

```typescript
// Automatic save (happens in background)
await kernel.saveWorkbook(workbookId);

// Save all
await kernel.saveAllWorkbooks();

// Auto-save runs every 10 seconds
```

### 6.3 IndexedDB Schema

```
Database: DJ_DataForge_v6
├── companies
│   └── CompanyContext
├── workbooks
│   └── Workbook (indexed by companyId)
├── snapshots
│   └── Recovery snapshots
├── plugin_data
│   └── Plugin-specific data (indexed by pluginId)
├── plugin_settings
│   └── Plugin configuration
└── settings
    └── Global settings
```

---

## 7. EVENT SYSTEM

### 7.1 Event Bus

Pub/sub event system for decoupled communication:

```typescript
interface EventBus {
  on(event: string, handler: Function): void;
  off(event: string, handler: Function): void;
  emit(event: string, payload?: any): void;
}

// Usage in plugin
async init(context: PluginContext): Promise<void> {
  // Listen to workbook events
  context.kernel.eventBus.on('workbook:saved', (data) => {
    console.log('Workbook saved:', data.workbookId);
  });
  
  // Emit plugin-specific event
  context.events.emit('lease-calculated', { contractId: 'c1' });
}
```

### 7.2 Available Events

```typescript
// Kernel events
'kernel:ready'              // Kernel initialization complete
'kernel:shutdown'           // Kernel shutting down
'kernel:recalc-done'        // Sheet recalculation complete
'kernel:autosave-done'      // Auto-save completed

// Workbook events
'workbook:created'          // New workbook created
'workbook:deleted'          // Workbook deleted
'workbook:saved'            // Workbook saved

// Plugin events
'plugin:loaded'             // Plugin loaded
'plugin:unloaded'           // Plugin unloaded
'plugin:{pluginId}:{event}' // Plugin-specific events (namespaced)
```

---

## 8. COMPANY MANAGEMENT

### 8.1 Multi-Company Context

Each workbook belongs to a company:

```typescript
interface CompanyContext {
  id: string;
  name: string;
  logo?: string;
  settings: CompanySettings;
  workbooks: string[];      // Workbook IDs
  plugins: PluginRef[];     // Active plugins
  createdAt: Date;
  updatedAt: Date;
}

interface CompanySettings {
  locale: string;           // "pt-BR"
  currency: string;         // "BRL"
  dateFormat: string;       // "DD/MM/YYYY"
  numberFormat: string;     // "#,##0.00"
  decimals: number;         // 2
  timezone: string;         // "America/Sao_Paulo"
}
```

### 8.2 Company Manager

```typescript
class CompanyManager {
  async init(): Promise<void>;
  
  async createCompany(name: string): Promise<CompanyContext>;
  
  getCompany(id: string): CompanyContext | undefined;
  getActiveCompany(): CompanyContext | undefined;
  listCompanies(): CompanyContext[];
  
  async setActiveCompany(id: string): Promise<boolean>;
  
  async updateCompany(id: string, updates: Partial<CompanyContext>): Promise<void>;
  
  async deleteCompany(id: string): Promise<boolean>;
}

// Access from plugin
async init(context: PluginContext): Promise<void> {
  const activeCompany = context.kernel.companyManager.getActiveCompany();
  console.log('Current company:', activeCompany?.name);
  
  // Workbook inherits company settings
  const wb = context.kernel.workbookManager.getActiveWorkbook();
  if (wb && activeCompany) {
    wb.companyId = activeCompany.id;
  }
}
```

---

## 9. MENU AND TOOLBAR INTEGRATION

### 9.1 Dynamic Menu Registration

Plugins can register menus and respond to events:

```typescript
async init(context: PluginContext): Promise<void> {
  // Add toolbar button
  context.ui.addToolbarButton({
    id: 'new-lease',
    label: 'New Lease',
    icon: '📝',
    onClick: () => this.showNewLeaseDialog(context),
  });

  // Add panel with interactive content
  context.ui.addPanel({
    id: 'lease-manager',
    title: 'Lease Manager',
    render: (container) => {
      container.innerHTML = `
        <div class="lease-manager">
          <button id="create-btn">Create New</button>
          <button id="import-btn">Import Data</button>
          <div id="lease-list"></div>
        </div>
      `;
      
      container.querySelector('#create-btn')
        ?.addEventListener('click', () => {
          this.showNewLeaseDialog(context);
        });
    },
  });
}
```

### 9.2 Menu Item Lifecycle

Menus are rendered in the UI ribbon. Users can:
- Click toolbar buttons → Trigger onClick handler
- Interact with panels → Custom DOM event handlers
- Access menu items → Trigger associated actions

---

## 10. MIGRATION GUIDE: ProLease IFRS 16 to v6

### 10.1 Key Differences from Legacy Plugin

| Aspect | Legacy (v5.x) | Native v6 |
|--------|---------------|-----------|
| Module System | IIFE (self-executing) | ES6 modules (import/export) |
| Registration | Auto-bootstrap | Explicit manifest + init() |
| Storage | Raw IndexedDB | Plugin storage API |
| Sheets | Direct manipulation | WorkbookManager API |
| Workbooks | Registry-based | Kernel manager |
| Events | Custom event system | Kernel EventBus |
| Formulas | Direct registry | CalcEngine registry |

### 10.2 Rewriting Strategy

The new ProLeasePlugin should:

1. **Implement Plugin Interface**
   ```typescript
   export class ProLeasePlugin implements Plugin {
     manifest: PluginManifest = { /* ... */ };
     async init(context: PluginContext): Promise<void> { /* ... */ }
     async dispose?(): Promise<void> { /* ... */ }
   }
   ```

2. **Use Context APIs**
   - Access workbooks via `context.kernel.workbookManager`
   - Store contracts via `context.storage`
   - Show UI via `context.ui`
   - Listen to events via `context.events`

3. **Register IFRS 16 Formulas**
   - Register financial functions in `context.kernel.calcEngine.getRegistry()`
   - PV, interest rate, amortization functions

4. **Manage Sheets**
   - Create/update sheets via WorkbookManager
   - Use Sheet.setCell() for data
   - Trigger recalculation with kernel.recalculate()

5. **Persist Data**
   - Save contracts in plugin storage (context.storage)
   - Workbooks auto-saved by kernel

### 10.3 Core Classes to Use

```typescript
// Imports for new ProLeasePlugin
import type { 
  PluginContext, 
  PluginManifest,
  Plugin 
} from './types';

// Accessing kernel services
const wbManager = context.kernel.workbookManager;
const calcEngine = context.kernel.calcEngine;
const storage = context.storage;
const ui = context.ui;
const events = context.events;
```

---

## 11. DEVELOPMENT PATTERNS

### 11.1 Typical Plugin Lifecycle

```typescript
export class MyPlugin implements Plugin {
  manifest: PluginManifest = {
    id: 'my.plugin',
    name: 'My Plugin',
    version: '1.0.0',
    author: 'Me',
    description: 'Does something cool',
    permissions: ['ui:toolbar', 'read:workbook', 'write:storage'],
    entryPoint: 'index.js',
  };

  async init(context: PluginContext): Promise<void> {
    // 1. Load saved state
    const savedState = await context.storage.get('state');
    
    // 2. Register UI elements
    context.ui.addToolbarButton({
      id: 'action',
      label: 'Do Something',
      onClick: () => this.doSomething(context),
    });
    
    // 3. Listen to events
    context.events.on('document-saved', () => {
      console.log('Document was saved');
    });
    
    // 4. Show success message
    context.ui.showToast('Plugin loaded!', 'success');
  }

  async doSomething(context: PluginContext): Promise<void> {
    // Perform action...
    
    // Save state
    await context.storage.set('state', { /* ... */ });
    
    // Notify user
    context.ui.showToast('Done!', 'success');
  }

  async dispose?(): Promise<void> {
    // Clean up resources
  }
}
```

### 11.2 Common Patterns

#### Creating Multiple Sheets Programmatically

```typescript
const wb = context.kernel.workbookManager.createWorkbook('Reports');
context.kernel.workbookManager.setActiveWorkbook(wb.id);

// Create multiple sheets
const summarySheet = wb.addSheet('Summary');
const detailSheet = wb.addSheet('Details');

// Populate summary
summarySheet.setCell(0, 0, 'Total Leases');
summarySheet.setCell(0, 1, 5);

// Populate details
const headers = ['Name', 'Amount', 'Term', 'Status'];
headers.forEach((h, col) => {
  detailSheet.setCell(0, col, h);
});
```

#### Working with Formulas

```typescript
const registry = context.kernel.calcEngine.getRegistry();

// Register custom formula
registry.register('LEASE_PV', (rent: number, rate: number, months: number) => {
  const monthlyRate = Math.pow(1 + rate/100, 1/12) - 1;
  return rent * ((1 - Math.pow(1 + monthlyRate, -months)) / monthlyRate);
}, { 
  argCount: 3, 
  description: 'Calculate lease present value' 
});

// Use in sheet
sheet.setCell(0, 0, '=LEASE_PV(5000, 12, 36)');

// Trigger recalculation
await context.kernel.recalculate(sheet.id);
```

#### Real-time Notifications

```typescript
context.kernel.eventBus.on('workbook:saved', (data) => {
  context.ui.showToast(`Workbook "${data.workbookId}" saved!`, 'success');
});

// Emit custom events
context.events.emit('contract-calculated', { 
  contractId: 'lease-001',
  pvAmount: 250000 
});
```

---

## 12. PERFORMANCE CONSIDERATIONS

### 12.1 Virtual Grid

The grid uses canvas rendering for performance:
- Only visible cells rendered
- 60 FPS target
- Sparse data structure (rows/cols not stored)

### 12.2 Calculation Optimization

- **Caching**: Results cached until dependencies change
- **Dependency Tracking**: Only recalculate affected cells
- **Async Support**: Can mark functions as async for long operations
- **Worker Support**: For heavy computations (like ProLease)

### 12.3 Storage Optimization

- **Sparse Storage**: Empty cells not stored
- **Workbook Serialization**: Only stores non-empty cells
- **IndexedDB**: Efficient for documents <50MB
- **Auto-save**: Every 10 seconds (configurable)

---

## 13. DEBUGGING AND LOGGING

### 13.1 Logger Usage

```typescript
import { logger } from '@core/storage-utils-consolidated';

logger.info('Message', { data: 'object' });
logger.warn('Warning', { optional: 'data' });
logger.error('Error', error);
logger.debug('Debug info');

// Get history
const logs = logger.getHistory({ level: 'error' });

// Set level
logger.setLevel('debug');
```

### 13.2 Plugin Debugging

```typescript
async init(context: PluginContext): Promise<void> {
  logger.info(`[${this.manifest.name}] Initializing...`);
  
  try {
    // Do work...
    logger.info(`[${this.manifest.name}] Ready`);
  } catch (error) {
    logger.error(`[${this.manifest.name}] Failed`, error);
    context.ui.showToast('Failed to initialize', 'error');
  }
}
```

---

## 14. TESTING ARCHITECTURE

### 14.1 Key Testing Areas

1. **Formula Execution**
   - Parser tokenization
   - AST generation
   - Evaluation with various data types
   - Dependency resolution

2. **Sheet Operations**
   - Cell setting/getting
   - Range operations
   - Column/row manipulation
   - Serialization

3. **Plugin Integration**
   - Context provision
   - UI element injection
   - Storage isolation
   - Event handling

4. **Multi-Company**
   - Company context switching
   - Workbook company association
   - Settings inheritance

---

## 15. COMPLETE EXAMPLE: ProLease Plugin Skeleton

```typescript
// prolease-ifrs16-plugin.ts

import type { Plugin, PluginContext, PluginManifest } from './types';
import { logger } from './storage-utils-consolidated';

interface LeaseContract {
  id: string;
  name: string;
  termMonths: number;
  startDate: string;
  monthlyRent: number;
  serviceDeduction: number;
  discountRate: number;
  landlordAllowance: number;
  initialDirectCosts: number;
}

export class ProLeasePlugin implements Plugin {
  manifest: PluginManifest = {
    id: 'dj.ifrs16.prolease',
    name: 'ProLease IFRS 16',
    version: '6.0.0',
    author: 'DJCalc',
    description: 'IFRS 16 lease accounting and amortization calculations',
    permissions: [
      'read:workbook',
      'write:workbook',
      'ui:toolbar',
      'ui:panel',
      'formula:register',
    ],
    entryPoint: 'prolease-ifrs16-plugin.ts',
  };

  private contracts: LeaseContract[] = [];
  private worker?: Worker;

  async init(context: PluginContext): Promise<void> {
    logger.info('[ProLeasePlugin] Initializing...');

    // Load saved contracts
    this.contracts = (await context.storage.get('contracts')) || [];

    // Create worker for calculations
    this.worker = this.createWorker();

    // Register formulas
    this.registerFormulas(context);

    // Add UI elements
    this.setupUI(context);

    logger.info('[ProLeasePlugin] Ready');
    context.ui.showToast('ProLease IFRS 16 loaded!', 'success');
  }

  private registerFormulas(context: PluginContext): void {
    const registry = context.kernel.calcEngine.getRegistry();

    // Register IFRS 16 specific formulas...
  }

  private setupUI(context: PluginContext): void {
    // Add toolbar button
    context.ui.addToolbarButton({
      id: 'new-lease',
      label: 'New Lease',
      icon: '📋',
      onClick: () => this.createNewLease(context),
    });

    // Add control panel
    context.ui.addPanel({
      id: 'prolease-panel',
      title: '📋 Lease Manager',
      render: (container) => {
        container.innerHTML = `
          <div class="lease-controls">
            <button id="create-contract">Create Contract</button>
            <div id="contract-list"></div>
          </div>
        `;
        
        this.updateContractList(container);
        
        container.querySelector('#create-contract')
          ?.addEventListener('click', () => {
            this.createNewLease(context);
          });
      },
    });
  }

  private createNewLease(context: PluginContext): void {
    // Get user input...
    // Create contract...
    // Send to worker for calculation...
    // Create/update sheet...
  }

  private createWorker(): Worker {
    // Create worker for background calculations
    return new Worker(new URL('./prolease-worker.ts', import.meta.url), {
      type: 'module',
    });
  }

  private updateContractList(container: HTMLElement): void {
    const list = container.querySelector('#contract-list');
    if (!list) return;

    list.innerHTML = this.contracts
      .map(
        (c) =>
          `<div class="contract-item" data-id="${c.id}">
            <span>${c.name}</span>
            <button data-action="recalc">Recalc</button>
            <button data-action="delete">Delete</button>
          </div>`
      )
      .join('');
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

## 16. CONCLUSION

The DataForge v6 architecture provides:

✅ **Plugin-First Design**: Easy to extend without modifying core
✅ **Rich Context API**: Full access to kernel services
✅ **Isolated Storage**: Each plugin has private data storage
✅ **UI Integration**: Seamless toolbar, panel, and menu support
✅ **Event System**: Decoupled communication
✅ **Multi-Company Support**: Workbooks belong to companies
✅ **Persistent Storage**: IndexedDB with auto-save
✅ **Performance**: Virtual grid with sparse data structures
✅ **Calculation Engine**: Formula parser, evaluator, registry
✅ **Developer Tools**: Logging, debugging, development patterns

The ProLease IFRS 16 plugin should leverage these capabilities to provide a modern, maintainable implementation while keeping all IFRS 16 calculation logic intact.

