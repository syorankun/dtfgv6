# DJ DataForge v6 - Widget System Architecture

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura de Componentes](#arquitetura-de-componentes)
3. [Fluxo de Dados](#fluxo-de-dados)
4. [Sistema de Tipos](#sistema-de-tipos)
5. [Ciclo de Vida dos Widgets](#ciclo-de-vida-dos-widgets)
6. [Persistência e Serialização](#persistência-e-serialização)

---

## Visão Geral

O sistema de widgets do DJ DataForge v6 permite criar **dashboards interativos** compostos por múltiplos widgets posicionáveis, redimensionáveis e configuráveis. Cada widget pode exibir dados de diferentes fontes (células, tabelas, fórmulas) e fornecer diferentes tipos de visualização.

### Características Principais

- ✅ **Modular**: Sistema baseado em registro (Widget Registry)
- ✅ **Extensível**: Plugins podem registrar novos tipos de widgets
- ✅ **Persistente**: Todas as configurações salvas automaticamente no IndexedDB
- ✅ **Interativo**: Drag & drop, resize, configuração em tempo real
- ✅ **Type-safe**: TypeScript strict mode com interfaces completas

### Widgets Disponíveis (Core)

| Tipo | Descrição | Status |
|------|-----------|--------|
| `kpi` | Indicadores chave de desempenho | ✅ Implementado |
| `table` | Tabelas estruturadas com filtros/ordenação | ✅ Implementado |
| `text` | Blocos de texto formatado | ✅ Implementado |
| `image` | Imagens e logos | ✅ Implementado |
| `chart` | Gráficos (linha, barra, pizza) | 🚧 Planejado |
| `pivot` | Tabelas dinâmicas | 🚧 Planejado |

---

## Arquitetura de Componentes

```
┌─────────────────────────────────────────────────────────────┐
│                        UI Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Dashboard    │  │ Widget       │  │ Settings     │      │
│  │ Container    │──│ Renderer     │──│ Panel        │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│                    Core Layer                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Dashboard    │  │ Widget       │  │ Widget       │      │
│  │ Manager      │──│ Registry     │──│ Renderers    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│                   Data Layer                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Workbook     │  │ Table        │  │ IndexedDB    │      │
│  │ Manager      │──│ Manager      │──│ Storage      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### 1. Dashboard Manager (`src/@core/dashboard-manager.ts`)

**Responsabilidades:**
- Gerenciar layouts de dashboard por sheet
- CRUD de widgets (criar, atualizar, remover)
- Controlar modo (grid vs dashboard)
- Serialização para persistência

**Singleton Pattern:**
```typescript
const dashboardManager = DashboardManager.getInstance();
```

**API Principal:**
```typescript
// Obter ou criar layout
const layout = dashboardManager.getOrCreateLayout(sheetId);

// Adicionar widget
const widget = dashboardManager.addWidget(sheetId, 'table', {
  title: 'Vendas 2024',
  tableId: 'tb_vendas_2024'
});

// Alternar modo
const newMode = dashboardManager.toggleMode(sheetId);

// Atualizar configuração de widget
dashboardManager.updateWidget(sheetId, widgetId, {
  title: 'Novo Título'
});
```

---

### 2. Widget Registry (`src/@core/widget-registry.ts`)

**Responsabilidades:**
- Registrar classes de renderização por tipo
- Fornecer acesso às classes registradas
- Validar tipos de widget

**Pattern: Registry + Factory**

```typescript
import { widgetRegistry } from '@core/widget-registry';

// Registrar widget (feito automaticamente no DashboardRenderer)
widgetRegistry.register('table', TableWidgetRenderer);

// Obter classe de renderer
const RendererClass = widgetRegistry.get('table');
if (RendererClass) {
  const renderer = new RendererClass(config, sheet, container);
  renderer.render();
}
```

**Interface para Renderers:**
```typescript
export interface IWidgetRenderer {
  new (
    config: WidgetConfig,
    sheet: Sheet,
    container: HTMLDivElement,
    onWidgetChange?: () => void
  ): {
    render(): void;
    renderSettings?(container: HTMLElement): void;
  };
}
```

---

### 3. Dashboard Renderer (`src/@core/dashboard-renderer.ts`)

**Responsabilidades:**
- Renderizar todos os widgets de um layout
- Gerenciar drag & drop
- Gerenciar resize
- Orquestrar eventos de widget

**Principais Classes:**

#### `WidgetRenderer` (Wrapper interno)
- Cria elemento HTML do widget
- Adiciona header com título e controles
- Adiciona resize handles
- Delega renderização de conteúdo para renderer específico

#### `DashboardRenderer` (Orquestrador)
- Gerencia múltiplos `WidgetRenderer`
- Lida com eventos de mouse global (drag/resize)
- Sincroniza mudanças com `DashboardManager`
- Gerencia painel de configurações

**Uso:**
```typescript
const dashboardRenderer = new DashboardRenderer(
  containerElement,
  sheet,
  layout
);

// Configurar auto-save
dashboardRenderer.setChangeHandler(async () => {
  await kernel.saveAllDashboards();
});

// Adicionar widget dinamicamente
dashboardRenderer.addWidget(widgetConfig);

// Limpar ao sair do modo dashboard
dashboardRenderer.destroy();
```

---

### 4. Widget Renderers (`src/@core/dashboard-widgets.ts`)

Cada tipo de widget tem sua própria classe de renderização.

#### Estrutura Base de um Renderer:

```typescript
export class MyWidgetRenderer {
  private config: WidgetConfig;
  private sheet: Sheet;
  private container: HTMLDivElement;
  private onWidgetChange?: () => void;

  constructor(
    config: WidgetConfig,
    sheet: Sheet,
    container: HTMLDivElement,
    onWidgetChange?: () => void
  ) {
    this.config = config;
    this.sheet = sheet;
    this.container = container;
    this.onWidgetChange = onWidgetChange;
  }

  render(): void {
    // Renderizar conteúdo no container
    this.container.innerHTML = `<div>Widget Content</div>`;
  }

  renderSettings?(container: HTMLElement): void {
    // Renderizar painel de configurações (opcional)
    container.innerHTML = `<div>Widget Settings</div>`;
  }
}
```

**Renderers Implementados:**

1. **KPIWidgetRenderer**
   - Fontes: célula, fórmula, agregação de tabela
   - Formatação: número, moeda, porcentagem
   - Cores condicionais
   - Comparação vs meta/anterior

2. **TableWidgetRenderer**
   - Exibe StructuredTable
   - Configurações: colunas visíveis, ordenação, filtro, paginação
   - Accordion de configurações expandível
   - Top N com agrupamento "Outros"

3. **TextWidgetRenderer**
   - Formatação: negrito, itálico, sublinhado
   - Alinhamento e tamanhos de fonte
   - Cores personalizáveis

4. **ImageWidgetRenderer**
   - Fontes: URL, base64
   - Modos de ajuste: contain, cover, fill, none
   - Opacidade e border-radius

---

## Fluxo de Dados

### 1. Criação de Widget

```
User Click (btn-add-table-widget)
    ↓
UIManager.addWidget('table')
    ↓
Show Modal with Configuration Form
    ↓
User Submits Form
    ↓
DashboardManager.addWidget(sheetId, 'table', config)
    ↓
Creates WidgetConfig object with unique ID
    ↓
Adds to layout.widgets[]
    ↓
layout.modified = new Date()
    ↓
DashboardRenderer.refresh()
    ↓
WidgetRenderer created with config
    ↓
Specific renderer (TableWidgetRenderer) instantiated
    ↓
render() called → DOM updated
```

### 2. Configuração de Widget

```
User Clicks ⚙️ button on widget
    ↓
Event 'widget-settings' dispatched
    ↓
DashboardRenderer.renderSelectedWidgetSettings()
    ↓
Gets WidgetRenderer for widgetId
    ↓
Calls renderer.renderSettings(settingsContainer)
    ↓
TableWidgetRenderer.renderSettings() renders accordion
    ↓
Event listeners attached to inputs
    ↓
User changes input (e.g., filters text)
    ↓
Event listener updates config.tableWidgetConfig.textFilter
    ↓
Calls renderer.render() → table re-renders with filter
    ↓
Calls onWidgetChange() → triggers auto-save
    ↓
Kernel.saveAllDashboards() → persists to IndexedDB
```

### 3. Drag & Drop

```
User MouseDown on widget header
    ↓
DashboardRenderer.startDrag(widgetId, clientX, clientY)
    ↓
Stores: draggedWidget, dragStartX/Y, widgetStartX/Y
    ↓
User MouseMove
    ↓
DashboardRenderer.handleDragMove(e)
    ↓
Calculates deltaX, deltaY
    ↓
Applies snap-to-grid if enabled
    ↓
WidgetRenderer.updatePosition(newX, newY)
    ↓
Updates element.style.left/top
    ↓
User MouseUp
    ↓
DashboardRenderer.handleMouseUp()
    ↓
Updates config.position in layout
    ↓
Calls onWidgetChange() → auto-save
```

---

## Sistema de Tipos

### Tipos Principais (`src/@core/types/index.ts`)

#### DashboardLayout
```typescript
export interface DashboardLayout {
  id: string;
  sheetId: string;
  mode: DashboardMode;           // 'grid' | 'dashboard'
  widgets: WidgetConfig[];
  gridVisible?: boolean;          // Show grid lines
  snapToGrid?: boolean;           // Snap widgets to grid
  gridSize?: number;              // Grid size in px (default 20)
  created: Date;
  modified: Date;
}
```

#### WidgetConfig
```typescript
export interface WidgetConfig {
  id: string;
  type: WidgetType;               // 'kpi' | 'table' | 'text' | 'image' | 'chart' | 'pivot'
  position: WidgetPosition;
  title: string;

  // Type-specific configs
  tableId?: string;
  kpiConfig?: KPIConfig;
  textConfig?: TextConfig;
  imageConfig?: ImageConfig;
  tableWidgetConfig?: TableWidgetConfig;

  // Visual
  showTitle?: boolean;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;

  // Metadata
  created: Date;
  modified: Date;
}
```

#### WidgetPosition
```typescript
export interface WidgetPosition {
  x: number;       // Position in pixels from left
  y: number;       // Position in pixels from top
  width: number;   // Width in pixels
  height: number;  // Height in pixels
}
```

#### TableWidgetConfig
```typescript
export interface TableWidgetConfig {
  hiddenColumns?: string[];        // Column IDs to hide
  sort?: {
    columnId: string;
    direction: 'asc' | 'desc';
  };
  topN?: number | null;            // Show only top N rows
  showTotalRow?: boolean;          // Override table's showTotalRow
  textFilter?: string;             // Filter rows by text search
  itemsPerPage?: number | null;    // Pagination
  currentPage?: number;            // Current page (0-indexed)
  showAlternatingRows?: boolean;   // Zebra striping
}
```

---

## Ciclo de Vida dos Widgets

### 1. Inicialização (Dashboard Mode Ativado)

```typescript
// UIManager.toggleDashboardMode()
private initDashboard(sheetId: string): void {
  const container = document.getElementById('dashboard-container');
  const sheet = kernel.workbookManager.getActiveSheet();

  // Get or create layout
  const layout = kernel.dashboardManager.getOrCreateLayout(sheetId);

  // Create renderer
  this.dashboardRenderer = new DashboardRenderer(container, sheet, layout);

  // Set up auto-save
  this.dashboardRenderer.setChangeHandler(async () => {
    await kernel.saveAllDashboards();
  });
}
```

### 2. Renderização

```typescript
// DashboardRenderer.renderWidget()
private renderWidget(config: WidgetConfig): void {
  // Create wrapper renderer
  const renderer = new WidgetRenderer(config, sheet, onWidgetChange);

  // Get DOM element
  const element = renderer.getElement();

  // Attach event listeners
  element.addEventListener('widget-remove', ...);
  element.addEventListener('widget-settings', ...);
  element.addEventListener('widget-resize-start', ...);

  // Add to DOM
  this.container.appendChild(element);

  // Store reference
  this.widgets.set(config.id, renderer);
}
```

### 3. Interação

**Resize:**
```typescript
// User drags resize handle
startResize(widgetId, handle, clientX, clientY)
  ↓
handleResizeMove(e) → calculate new size
  ↓
renderer.updateSize(width, height)
  ↓
handleMouseUp() → save to config
```

**Settings:**
```typescript
// User clicks settings button
Event 'widget-settings' → renderSelectedWidgetSettings()
  ↓
renderer.renderSettings(settingsPanel)
  ↓
User changes input
  ↓
Event listener → update config → renderer.render()
  ↓
onWidgetChange() → auto-save
```

### 4. Destruição

```typescript
// UIManager.toggleDashboardMode() (exit)
if (this.dashboardRenderer) {
  this.dashboardRenderer.destroy();
  this.dashboardRenderer = undefined;
}

// DashboardRenderer.destroy()
destroy(): void {
  this.widgets.forEach(widget => widget.destroy());
  this.widgets.clear();
  this.container.innerHTML = '';
}

// WidgetRenderer.destroy()
destroy(): void {
  this.element.remove();
}
```

---

## Persistência e Serialização

### Auto-save Flow

```typescript
// Triggered on any widget change
onWidgetChange() callback
  ↓
kernel.saveAllDashboards()
  ↓
dashboardManager.serialize()
  ↓
{
  layouts: [
    {
      id: 'layout-123',
      sheetId: 'sheet-456',
      mode: 'dashboard',
      widgets: [...],
      created: '2024-01-15T10:30:00.000Z',
      modified: '2024-01-15T15:45:00.000Z'
    }
  ]
}
  ↓
StorageManager.saveDashboards(data)
  ↓
IndexedDB 'dashboards' object store
```

### Load Flow

```typescript
// On kernel initialization
kernel.loadAllDashboards()
  ↓
StorageManager.loadDashboards()
  ↓
IndexedDB 'dashboards' object store
  ↓
dashboardManager.deserialize(data)
  ↓
Converts ISO strings back to Date objects
  ↓
Populates layouts Map
  ↓
Ready for use
```

### Serialization Format

**Before serialization:**
```typescript
{
  id: 'wgt-abc123',
  type: 'table',
  created: Date Object,
  modified: Date Object,
  tableWidgetConfig: {
    textFilter: 'vendas',
    currentPage: 2
  }
}
```

**After serialization:**
```json
{
  "id": "wgt-abc123",
  "type": "table",
  "created": "2024-01-15T10:30:00.000Z",
  "modified": "2024-01-15T15:45:00.000Z",
  "tableWidgetConfig": {
    "textFilter": "vendas",
    "currentPage": 2
  }
}
```

---

## Performance Considerations

### 1. Virtual Rendering
- Widgets renderizam apenas quando visíveis
- Scroll containers evitam renderização de conteúdo fora da viewport

### 2. Event Delegation
- Eventos de mouse global (drag/resize) anexados apenas uma vez ao document
- Remove listeners no destroy()

### 3. Debouncing
- Input de filtro usa evento 'input' mas poderia usar debounce para melhor performance
- Auto-save já é debounced pelo kernel (10s interval)

### 4. Memoization
- Configs são objetos mutáveis, mas mudanças disparam re-render explícito
- Evita re-renders desnecessários

---

## Próximos Passos

- **Parte 2**: Como criar widgets customizados
- **Parte 3**: Como plugins podem adicionar widgets + refinamentos no core

---

**Versão:** 1.0.0
**Data:** 2025-01-27
**Autor:** DJ DataForge Team
