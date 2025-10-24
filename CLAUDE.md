# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DJ DataForge v6 is an Excel-like data grid with a formula engine, plugin system, and multi-company support. It runs entirely client-side using TypeScript, Vite, and IndexedDB for persistence.

## Development Commands

### Core Development
```bash
npm run dev              # Start dev server (http://localhost:5173)
npm run build            # TypeScript compile + production build
npm run preview          # Preview production build (http://localhost:4173)
npm run type-check       # TypeScript type checking (no emit)
```

### Code Quality
```bash
npm run lint             # ESLint (src/**/*.ts)
npm run format           # Prettier formatting
```

### Testing
```bash
npm run test             # Run all tests (vitest)
npm run test:unit        # Unit tests only
npm run test:e2e         # Playwright E2E tests
npm run test:watch       # Watch mode
npm run coverage         # Coverage report
npm run bench            # Performance benchmarks
```

### Plugin Builds
```bash
npm run build:plugin     # Build plugin using vite.config.plugin.ts
npm run build:standalone # Build standalone version (pre + post processing)
```

### Important Notes About Builds
- **NEVER** open `dist/index.html` directly in browser (CORS policy blocks `file://` protocol)
- **ALWAYS** use `npm run preview` or a local HTTP server to test builds
- Production deployments should serve files from dist/ via HTTP server

## Architecture Overview

### Core Layers
```
┌─────────────────────────────┐
│     UI Layer (app.ts)       │  Excel-style UI, virtual grid
├─────────────────────────────┤
│   Plugin Layer              │  FX-Pack, Charts, Pivot, ProLease
├─────────────────────────────┤
│   API Layer (KernelContext) │  Events, UI Integration, Storage
├─────────────────────────────┤
│   Core Services (Kernel)    │  WorkbookManager, CalcEngine, etc.
├─────────────────────────────┤
│   Persistence (IndexedDB)   │  Companies, Workbooks, Plugin Data
└─────────────────────────────┘
```

### Kernel as Central Orchestrator

The **Kernel** is a singleton that orchestrates all system components:

```typescript
kernel.workbookManager   // Manages workbooks and sheets
kernel.calcEngine        // Formula parser and evaluator
kernel.storageManager    // IndexedDB persistence
kernel.companyManager    // Multi-company contexts
kernel.pluginHost        // Plugin loading and management
kernel.eventBus          // Pub/sub event system
kernel.sessionManager    // Session tracking
```

Access kernel via: `import { kernel } from '@core/kernel'` or `DJDataForgeKernel.getInstance()`

### File Organization

The codebase uses **consolidated files** (not yet split into modules):

- `src/@core/types/index.ts` - All TypeScript types
- `src/@core/workbook-consolidated.ts` - Workbook, Sheet, Column, Cell, WorkbookManager
- `src/@core/calc-engine-consolidated.ts` - Parser, Evaluator, Registry, DAG
- `src/@core/storage-utils-consolidated.ts` - Storage, Logger, Formatters, Assert
- `src/@core/kernel.ts` - Kernel orchestrator, EventBus, CompanyManager
- `src/@core/plugin-system-consolidated.ts` - Plugin host and interfaces
- `src/@core/grid-virtual-consolidated.ts` - Virtual grid rendering
- `src/@core/io-transform-consolidated.ts` - Import/export, transformations
- `src/app.ts` - Application entry point

**NOTE**: Consolidated files have `// FUTURE SPLIT POINTS:` comments indicating where to split when refactoring.

### Path Aliases

TypeScript path mapping (configured in tsconfig.json and vite.config.ts):

```typescript
@core/*    → src/@core/*
@ui/*      → src/@ui/*
@plugins/* → src/@plugins/*
```

Always use path aliases when importing core modules.

## Working with the Codebase

### TypeScript Configuration

This project uses **strict mode** with aggressive linting:
- All strict flags enabled (strictNullChecks, noImplicitAny, etc.)
- No unused locals or parameters allowed
- No implicit returns
- No fallthrough cases in switch

When writing code, ensure full type safety and handle all edge cases explicitly.

### Formula System

The CalcEngine provides a full formula parser and evaluator:

**Built-in Functions** (20+ formulas):
- Math: SOMA, MÉDIA, MÁXIMO, MÍNIMO, ARREDONDAR, ABS, RAIZ, POTÊNCIA
- Text: CONCATENAR, MAIÚSCULA, MINÚSCULA, TEXTO, NÚM.CARACT
- Logic: SE, E, OU, NÃO
- Info: ÉNÚM, ÉTEXTO, ÉVAZIO
- Count: CONT.NÚM, CONT.VALORES
- Lookup: PROCV

**Registering Custom Functions**:
```typescript
const registry = kernel.calcEngine.getRegistry();
registry.register('MY_FUNC', (arg1: number, arg2: number) => {
  return arg1 + arg2;
}, { argCount: 2, description: 'My custom function' });
```

**Formula Evaluation Flow**:
1. User enters: `=SOMA(A1:A10)`
2. FormulaParser tokenizes → AST
3. CalcEngine evaluates AST recursively
4. Registry lookup for SOMA
5. Arguments evaluated (A1:A10 → array)
6. Function called, result stored in cell

Formulas support dependency tracking and automatic recalculation.

### Plugin System

All plugins implement the `Plugin` interface:

```typescript
interface Plugin {
  manifest: PluginManifest;
  init(context: PluginContext): Promise<void>;
  dispose?(): Promise<void>;
}
```

Each plugin receives a `PluginContext` with access to:
- `context.kernel` - Full kernel services
- `context.storage` - Plugin-specific persistent storage (IndexedDB)
- `context.ui` - UI integration (toolbar buttons, panels, menus)
- `context.events` - Event pub/sub system

**Built-in Plugins**:
- ProLease IFRS 16 (`src/plugins/prolease-ifrs16-plugin.ts`) - Lease accounting calculations

### Workbook and Sheet Structure

**Workbook** → **Sheets** → **Cells**

```typescript
// Create workbook
const wb = kernel.workbookManager.createWorkbook('My Workbook');

// Add sheet
const sheet = wb.addSheet('Sheet1');

// Set cell values
sheet.setCell(0, 0, 'Name');
sheet.setCell(1, 0, 'John', { type: 'text' });

// Set formula
sheet.setCell(1, 1, '=A2&" Smith"', {
  formula: '=A2&" Smith"',
  type: 'formula'
});

// Recalculate
await kernel.recalculate(sheet.id);
```

**Storage**: Sparse data structure - empty cells are not stored. Rows and columns use `Map<number, ...>` for efficient memory usage.

### Multi-Company Support

Every workbook can belong to a company context:

```typescript
const company = await kernel.companyManager.createCompany('Acme Corp');
kernel.companyManager.setActiveCompany(company.id);

// Workbooks created now will inherit company settings
const wb = kernel.workbookManager.createWorkbook('Q4 Sales');
// wb.companyId === company.id
```

Company contexts include settings for locale, currency, date format, number format, decimals, and timezone.

### Event System

Use the EventBus for decoupled communication:

```typescript
// Listen to events
kernel.eventBus.on('workbook:saved', (data) => {
  console.log('Workbook saved:', data.workbookId);
});

// Emit events
kernel.eventBus.emit('custom:event', { data: 'payload' });
```

**Standard Events**:
- `kernel:ready`, `kernel:shutdown`, `kernel:recalc-done`, `kernel:autosave-done`
- `workbook:created`, `workbook:deleted`, `workbook:saved`
- `plugin:loaded`, `plugin:unloaded`

### IndexedDB Persistence

All data persists to IndexedDB (`DJ_DataForge_v6` database):

**Object Stores**:
- `companies` - Company contexts
- `workbooks` - Workbook data (indexed by companyId)
- `snapshots` - Recovery snapshots
- `plugin_data` - Plugin-specific data (indexed by pluginId)
- `plugin_settings` - Plugin configurations
- `settings` - Global settings

**Auto-save**: Runs every 10 seconds automatically. Use `kernel.saveWorkbook(id)` or `kernel.saveAllWorkbooks()` for manual saves.

## Common Tasks

### Adding a New Formula

1. Open `src/@core/calc-engine-consolidated.ts`
2. Find the `FormulaRegistry` constructor
3. Add registration:
```typescript
this.register('MY_FORMULA', (arg1: number, arg2: number) => {
  return arg1 * arg2;
}, { argCount: 2, description: 'Multiplies two numbers' });
```

### Creating a New Plugin

1. Create `src/plugins/my-plugin.ts`:
```typescript
import type { Plugin, PluginContext, PluginManifest } from '@core/types';

export class MyPlugin implements Plugin {
  manifest: PluginManifest = {
    id: 'my-plugin',
    name: 'My Plugin',
    version: '1.0.0',
    author: 'Your Name',
    description: 'Does something cool',
    permissions: ['read:workbook', 'write:workbook', 'ui:toolbar'],
    entryPoint: 'my-plugin.js',
  };

  async init(context: PluginContext): Promise<void> {
    // Setup UI, register formulas, etc.
    context.ui.showToast('My Plugin loaded!', 'success');
  }
}
```

2. Register in `src/app.ts` or `src/plugins/index.ts`

### Working with Sheets Programmatically

```typescript
// Get active workbook
const wb = kernel.workbookManager.getActiveWorkbook();
if (!wb) return;

// Add sheet with data
const sheet = wb.addSheet('Data');
const headers = ['ID', 'Name', 'Amount'];
headers.forEach((h, col) => sheet.setCell(0, col, h));

// Add data rows
const data = [[1, 'Alice', 100], [2, 'Bob', 200]];
data.forEach((row, rowIdx) => {
  row.forEach((val, colIdx) => {
    sheet.setCell(rowIdx + 1, colIdx, val);
  });
});

// Recalculate and save
await kernel.recalculate(sheet.id);
await kernel.saveWorkbook(wb.id);
```

### Testing Changes

1. Run `npm run type-check` first to catch TypeScript errors
2. Use `npm run dev` to test in browser
3. Check browser console for errors (Logger outputs there)
4. Use `npm run test` for automated tests
5. Use `npm run preview` to test production build

## Debugging and Logging

The project includes a Logger utility:

```typescript
import { logger } from '@core/storage-utils-consolidated';

logger.info('Message', { data: 'optional object' });
logger.warn('Warning');
logger.error('Error occurred', error);
logger.debug('Debug info');

// Get log history
const logs = logger.getHistory({ level: 'error' });

// Set log level
logger.setLevel('debug'); // 'debug' | 'info' | 'warn' | 'error'
```

All logs appear in browser console and are stored in memory (can be exported).

## Development Guidelines

### File Size Limits
- Keep TypeScript files under **500 lines** where possible
- Consolidated files are temporary; split when appropriate
- Use `// FUTURE SPLIT POINTS:` comments to mark logical boundaries

### Code Style
- Use TypeScript strict mode (no `any` without good reason)
- Prefer explicit types over inference for public APIs
- Use functional programming patterns where appropriate
- Comment complex logic, especially in formula evaluation

### Naming Conventions
- Classes: PascalCase (`WorkbookManager`)
- Functions/methods: camelCase (`createWorkbook`)
- Constants: UPPER_SNAKE_CASE (`MAX_CELL_SIZE`)
- Private fields: prefix with `_` or use `private` keyword
- Files: kebab-case (`calc-engine-consolidated.ts`)

### Testing
- Unit tests for core logic (calc engine, workbook operations)
- E2E tests for user workflows (Playwright)
- Performance benchmarks for critical paths (virtual grid, formula evaluation)

## Project Roadmap

The project is currently in **Phase 1 (Foundation)** with these remaining phases:

- **Phase 2**: Advanced calc engine (financial functions, date functions)
- **Phase 3**: I/O & Transform (CSV/XLSX/JSON import/export, filters, undo/redo)
- **Phase 4**: UI Shell (virtual grid with canvas, cell editor, copy/paste)
- **Phase 5**: Plugin system enhancements (plugin marketplace, security)
- **Phase 6**: Polish & QA (performance tuning, accessibility, documentation)

## Additional Documentation

Comprehensive specifications are available in the project root:
- SPEC-00 to SPEC-11 (architecture, API, UI/UX, plugin system, testing)
- ARCHITECTURE_ANALYSIS.md - Complete architectural overview
- PROLEASE_V6_README.md - ProLease plugin documentation
- PROLEASE_IMPLEMENTATION_GUIDE.md - IFRS 16 implementation details

When implementing new features, consult the relevant SPEC documents for detailed requirements and design decisions.
