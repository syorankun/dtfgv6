# DJ DataForge v6 - Integração de Widgets via Plugins

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura Plugin → Widget](#arquitetura-plugin--widget)
3. [Tutorial Completo](#tutorial-completo)
4. [Casos de Uso Avançados](#casos-de-uso-avançados)
5. [Boas Práticas](#boas-práticas)
6. [Referência de API](#referência-de-api)

---

## Visão Geral

Plugins no DJ DataForge v6 podem **estender o sistema de widgets** registrando novos tipos de visualização. Isso permite:

- ✅ Adicionar widgets especializados (financeiros, científicos, etc.)
- ✅ Integrar visualizações de bibliotecas externas (Chart.js, D3.js, etc.)
- ✅ Reutilizar widgets entre projetos
- ✅ Distribuir widgets via npm ou CDN
- ✅ Manter widgets isolados do core

---

## Arquitetura Plugin → Widget

### Fluxo de Integração

```
┌─────────────────────────────────────────────────────────────┐
│                      Plugin Init                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 1. Plugin.init(context) chamado                      │   │
│  │ 2. context.widgets.register(type, RendererClass)     │   │
│  │ 3. context.ui.addDashboardButton(...)                │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  Widget Registry (Core)                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ widgetRegistry.register('my-widget', MyRenderer)     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  Dashboard Renderer                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Busca renderer no registry                           │   │
│  │ Instancia e renderiza                                │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

### PluginContext Interface (Estendida)

```typescript
export interface PluginContext {
  // Kernel access
  kernel: DJDataForgeKernel;

  // Storage
  storage: {
    get(key: string): Promise<any>;
    set(key: string, value: any): Promise<void>;
    delete(key: string): Promise<void>;
  };

  // Events
  events: {
    on(event: string, handler: Function): void;
    emit(event: string, data?: any): void;
    off(event: string, handler: Function): void;
  };

  // UI Integration
  ui: {
    showToast(message: string, type: 'success' | 'error' | 'info'): void;
    addToolbarButton(config: ToolbarButtonConfig): void;
    addDashboardButton(config: DashboardButtonConfig): void; // ← Para widgets
  };

  // Widget Integration (NOVO - veja refinamentos)
  widgets: {
    register(type: string, rendererClass: IWidgetRenderer): void;
    unregister(type: string): void;
    create(sheetId: string, type: string, config: Partial<WidgetConfig>): WidgetConfig;
  };
}
```

---

## Tutorial Completo

### Exemplo: Plugin com Widget de Markdown

Vamos criar um plugin que adiciona um widget de renderização de Markdown.

#### Passo 1: Estrutura do Plugin

```
my-markdown-plugin/
├── package.json
├── src/
│   ├── index.ts              (Entry point)
│   ├── markdown-widget.ts    (Widget renderer)
│   └── types.ts              (TypeScript types)
└── README.md
```

---

#### Passo 2: Definir Tipos

**`src/types.ts`**

```typescript
export interface MarkdownWidgetConfig {
  content: string;
  theme: 'light' | 'dark';
  showPreview: boolean;
}

// Extend core WidgetConfig
declare module '@core/types' {
  interface WidgetConfig {
    markdownConfig?: MarkdownWidgetConfig;
  }
}
```

---

#### Passo 3: Criar Widget Renderer

**`src/markdown-widget.ts`**

```typescript
import type { WidgetConfig } from '@core/types';
import type { Sheet } from '@core/workbook-consolidated';
import { marked } from 'marked'; // Biblioteca markdown (npm install marked)

export class MarkdownWidgetRenderer {
  private config: WidgetConfig;
  private container: HTMLDivElement;
  private onWidgetChange?: () => void;

  constructor(
    config: WidgetConfig,
    _sheet: Sheet,
    container: HTMLDivElement,
    onWidgetChange?: () => void
  ) {
    this.config = config;
    this.container = container;
    this.onWidgetChange = onWidgetChange;
  }

  render(): void {
    const mdConfig = this.config.markdownConfig;
    if (!mdConfig) {
      this.container.innerHTML = '<div>Configuração não encontrada</div>';
      return;
    }

    const html = marked(mdConfig.content || '# Digite seu markdown...');

    this.container.innerHTML = `
      <div
        class="markdown-content"
        style="
          padding: 16px;
          height: 100%;
          overflow-y: auto;
          background: ${mdConfig.theme === 'dark' ? '#1f2937' : '#ffffff'};
          color: ${mdConfig.theme === 'dark' ? '#f3f4f6' : '#1f2937'};
        "
      >
        ${html}
      </div>
    `;
  }

  renderSettings(container: HTMLElement): void {
    const mdConfig = this.config.markdownConfig || {
      content: '',
      theme: 'light',
      showPreview: true
    };

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <div>
          <label style="font-size: 12px; display: block; margin-bottom: 4px;">Conteúdo Markdown:</label>
          <textarea
            class="md-content"
            rows="8"
            style="width: 100%; padding: 8px; font-family: monospace; font-size: 12px; resize: vertical;"
          >${mdConfig.content}</textarea>
        </div>

        <div>
          <label style="font-size: 12px; display: block; margin-bottom: 4px;">Tema:</label>
          <select class="md-theme" style="width: 100%; padding: 4px;">
            <option value="light" ${mdConfig.theme === 'light' ? 'selected' : ''}>Claro</option>
            <option value="dark" ${mdConfig.theme === 'dark' ? 'selected' : ''}>Escuro</option>
          </select>
        </div>
      </div>
    `;

    // Event listeners
    const contentTextarea = container.querySelector('.md-content') as HTMLTextAreaElement;
    const themeSelect = container.querySelector('.md-theme') as HTMLSelectElement;

    contentTextarea.addEventListener('input', () => {
      if (!this.config.markdownConfig) {
        this.config.markdownConfig = { content: '', theme: 'light', showPreview: true };
      }
      this.config.markdownConfig.content = contentTextarea.value;
      this.render();
      this.onWidgetChange?.();
    });

    themeSelect.addEventListener('change', () => {
      if (!this.config.markdownConfig) {
        this.config.markdownConfig = { content: '', theme: 'light', showPreview: true };
      }
      this.config.markdownConfig.theme = themeSelect.value as 'light' | 'dark';
      this.render();
      this.onWidgetChange?.();
    });
  }
}
```

---

#### Passo 4: Plugin Principal

**`src/index.ts`**

```typescript
import type { Plugin, PluginContext, PluginManifest } from '@core/types';
import { MarkdownWidgetRenderer } from './markdown-widget';

export class MarkdownPlugin implements Plugin {
  manifest: PluginManifest = {
    id: 'markdown-widget-plugin',
    name: 'Markdown Widget',
    version: '1.0.0',
    author: 'Seu Nome',
    description: 'Adiciona widget de renderização de Markdown aos dashboards',
    permissions: ['ui:dashboard', 'widgets:register'],
    entryPoint: 'index.js'
  };

  private context?: PluginContext;

  async init(context: PluginContext): Promise<void> {
    this.context = context;

    // 1. Registrar widget no registry
    context.widgets.register('markdown', MarkdownWidgetRenderer);

    // 2. Adicionar botão no painel de dashboard
    context.ui.addDashboardButton({
      id: 'btn-add-markdown-widget',
      label: 'Markdown',
      icon: '📝',
      onClick: () => this.createMarkdownWidget()
    });

    // 3. Log de sucesso
    context.ui.showToast('Plugin Markdown carregado!', 'success');

    console.log('[MarkdownPlugin] Initialized successfully');
  }

  private createMarkdownWidget(): void {
    if (!this.context) return;

    const kernel = this.context.kernel;
    const sheet = kernel.workbookManager.getActiveSheet();
    if (!sheet) {
      this.context.ui.showToast('Nenhuma sheet ativa', 'error');
      return;
    }

    // Usar helper do context para criar widget
    const widget = this.context.widgets.create(sheet.id, 'markdown', {
      title: 'Markdown',
      markdownConfig: {
        content: '# Olá!\n\nEste é um widget de **Markdown**.',
        theme: 'light',
        showPreview: true
      }
    });

    // Emitir evento para UI atualizar
    this.context.events.emit('widget:created', { widgetId: widget.id });

    this.context.ui.showToast('Widget Markdown adicionado!', 'success');
  }

  async dispose(): Promise<void> {
    if (!this.context) return;

    // Cleanup: desregistrar widget
    this.context.widgets.unregister('markdown');

    console.log('[MarkdownPlugin] Disposed');
  }
}

// Export default para carregamento do plugin
export default MarkdownPlugin;
```

---

#### Passo 5: Package.json

```json
{
  "name": "@dataforge/markdown-widget-plugin",
  "version": "1.0.0",
  "description": "Markdown widget plugin for DJ DataForge",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "watch": "tsc --watch"
  },
  "dependencies": {
    "marked": "^11.0.0"
  },
  "peerDependencies": {
    "@dataforge/core": "^6.0.0"
  },
  "devDependencies": {
    "@types/marked": "^6.0.0",
    "typescript": "^5.3.0"
  }
}
```

---

#### Passo 6: Carregar Plugin

**No aplicativo principal:**

```typescript
// src/app.ts

import { MarkdownPlugin } from '@dataforge/markdown-widget-plugin';

// Após kernel.init()
const markdownPlugin = new MarkdownPlugin();
await kernel.pluginHost.loadPlugin(markdownPlugin);
```

---

## Casos de Uso Avançados

### Caso 1: Widget com Biblioteca Externa (Chart.js)

```typescript
import Chart from 'chart.js/auto';

export class ChartJSWidgetRenderer {
  private config: WidgetConfig;
  private sheet: Sheet;
  private container: HTMLDivElement;
  private chartInstance?: Chart;

  constructor(config: WidgetConfig, sheet: Sheet, container: HTMLDivElement) {
    this.config = config;
    this.sheet = sheet;
    this.container = container;
  }

  render(): void {
    const chartConfig = this.config.chartJSConfig;
    if (!chartConfig) return;

    // Destruir chart anterior se existir
    if (this.chartInstance) {
      this.chartInstance.destroy();
    }

    // Criar canvas
    this.container.innerHTML = '<canvas id="myChart"></canvas>';
    const canvas = this.container.querySelector('#myChart') as HTMLCanvasElement;

    // Buscar dados da tabela
    const data = this.getDataFromTable(chartConfig.tableId);

    // Criar novo chart
    this.chartInstance = new Chart(canvas, {
      type: chartConfig.chartType || 'bar',
      data: {
        labels: data.labels,
        datasets: [{
          label: chartConfig.datasetLabel || 'Dataset',
          data: data.values,
          backgroundColor: chartConfig.backgroundColor || '#3b82f6'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    });
  }

  private getDataFromTable(tableId: string): { labels: string[]; values: number[] } {
    // Implementação similar ao BarChartWidgetRenderer
    // ...
    return { labels: [], values: [] };
  }

  destroy(): void {
    if (this.chartInstance) {
      this.chartInstance.destroy();
    }
  }
}
```

---

### Caso 2: Widget Interativo com State Management

```typescript
export class TodoListWidgetRenderer {
  private config: WidgetConfig;
  private container: HTMLDivElement;
  private onWidgetChange?: () => void;

  constructor(config: WidgetConfig, _sheet: Sheet, container: HTMLDivElement, onWidgetChange?: () => void) {
    this.config = config;
    this.container = container;
    this.onWidgetChange = onWidgetChange;
  }

  render(): void {
    if (!this.config.todoConfig) {
      this.config.todoConfig = { items: [] };
    }

    const todos = this.config.todoConfig.items;

    this.container.innerHTML = `
      <div style="padding: 16px; display: flex; flex-direction: column; gap: 12px; height: 100%;">
        <div style="display: flex; gap: 8px;">
          <input
            type="text"
            class="todo-input"
            placeholder="Nova tarefa..."
            style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px;"
          />
          <button class="todo-add" style="padding: 8px 16px; cursor: pointer;">➕</button>
        </div>

        <div style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;">
          ${todos.map((item, index) => `
            <div style="display: flex; align-items: center; gap: 8px; padding: 8px; background: #f9fafb; border-radius: 4px;">
              <input
                type="checkbox"
                class="todo-toggle"
                data-index="${index}"
                ${item.completed ? 'checked' : ''}
                style="flex-shrink: 0;"
              />
              <span style="flex: 1; ${item.completed ? 'text-decoration: line-through; color: #9ca3af;' : ''}">${item.text}</span>
              <button class="todo-delete" data-index="${index}" style="padding: 4px 8px; cursor: pointer; border: none; background: #ef4444; color: white; border-radius: 4px;">🗑️</button>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    // Event listeners
    this.container.querySelector('.todo-add')?.addEventListener('click', () => {
      const input = this.container.querySelector('.todo-input') as HTMLInputElement;
      if (input.value.trim()) {
        this.config.todoConfig!.items.push({ text: input.value, completed: false });
        input.value = '';
        this.render();
        this.onWidgetChange?.();
      }
    });

    this.container.querySelectorAll('.todo-toggle').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const index = parseInt((e.target as HTMLInputElement).dataset.index!);
        this.config.todoConfig!.items[index].completed = !this.config.todoConfig!.items[index].completed;
        this.render();
        this.onWidgetChange?.();
      });
    });

    this.container.querySelectorAll('.todo-delete').forEach(button => {
      button.addEventListener('click', (e) => {
        const index = parseInt((e.target as HTMLButtonElement).dataset.index!);
        this.config.todoConfig!.items.splice(index, 1);
        this.render();
        this.onWidgetChange?.();
      });
    });
  }
}
```

---

### Caso 3: Widget com WebSocket (Dados em Tempo Real)

```typescript
export class RealtimeWidgetRenderer {
  private config: WidgetConfig;
  private container: HTMLDivElement;
  private ws?: WebSocket;

  constructor(config: WidgetConfig, _sheet: Sheet, container: HTMLDivElement) {
    this.config = config;
    this.container = container;
  }

  render(): void {
    const rtConfig = this.config.realtimeConfig;
    if (!rtConfig?.wsUrl) {
      this.container.innerHTML = '<div>Configure WebSocket URL</div>';
      return;
    }

    this.container.innerHTML = `
      <div style="padding: 16px;">
        <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">
          Status: <span class="ws-status">Connecting...</span>
        </div>
        <div class="ws-data" style="font-size: 24px; font-weight: bold;">
          --
        </div>
      </div>
    `;

    this.connectWebSocket(rtConfig.wsUrl);
  }

  private connectWebSocket(url: string): void {
    // Fechar conexão anterior
    if (this.ws) {
      this.ws.close();
    }

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      const status = this.container.querySelector('.ws-status');
      if (status) status.textContent = '🟢 Connected';
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const dataDiv = this.container.querySelector('.ws-data');
      if (dataDiv) {
        dataDiv.textContent = data.value || '--';
      }
    };

    this.ws.onerror = () => {
      const status = this.container.querySelector('.ws-status');
      if (status) status.textContent = '🔴 Error';
    };

    this.ws.onclose = () => {
      const status = this.container.querySelector('.ws-status');
      if (status) status.textContent = '⚫ Disconnected';
    };
  }

  destroy(): void {
    if (this.ws) {
      this.ws.close();
    }
  }
}
```

---

## Boas Práticas

### 1. Versionamento de Widgets

```typescript
export interface MarkdownWidgetConfig {
  version: number;  // Schema version
  content: string;
  theme: 'light' | 'dark';
}

export class MarkdownWidgetRenderer {
  render(): void {
    const config = this.migrateConfig(this.config.markdownConfig);
    // ...
  }

  private migrateConfig(config: any): MarkdownWidgetConfig {
    if (!config.version || config.version < 2) {
      // Migrate v1 to v2
      return {
        version: 2,
        content: config.text || '', // v1 usava 'text'
        theme: config.theme || 'light'
      };
    }
    return config;
  }
}
```

---

### 2. Lazy Loading de Bibliotecas

```typescript
export class HeavyChartWidgetRenderer {
  private chartLibLoaded = false;

  async render(): Promise<void> {
    if (!this.chartLibLoaded) {
      await this.loadChartLibrary();
      this.chartLibLoaded = true;
    }

    // Render chart
  }

  private async loadChartLibrary(): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Chart.js'));
      document.head.appendChild(script);
    });
  }
}
```

---

### 3. Comunicação entre Widgets

```typescript
// Plugin A registra um widget que emite eventos
export class ProducerWidgetRenderer {
  render(): void {
    this.container.querySelector('.btn')?.addEventListener('click', () => {
      // Emitir evento global via kernel
      this.context.events.emit('data:updated', { value: 42 });
    });
  }
}

// Plugin B registra um widget que escuta eventos
export class ConsumerWidgetRenderer {
  constructor(config, sheet, container, onWidgetChange, context) {
    // ...
    this.context = context;

    // Escutar evento
    context.events.on('data:updated', this.handleDataUpdate.bind(this));
  }

  handleDataUpdate(data: any): void {
    // Atualizar widget com novos dados
    this.render();
  }

  destroy(): void {
    this.context.events.off('data:updated', this.handleDataUpdate);
  }
}
```

---

### 4. Testes Unitários

```typescript
// markdown-widget.test.ts

import { MarkdownWidgetRenderer } from '../src/markdown-widget';

describe('MarkdownWidgetRenderer', () => {
  let container: HTMLDivElement;
  let config: WidgetConfig;

  beforeEach(() => {
    container = document.createElement('div');
    config = {
      id: 'test-widget',
      type: 'markdown',
      position: { x: 0, y: 0, width: 400, height: 300 },
      title: 'Test',
      created: new Date(),
      modified: new Date(),
      markdownConfig: {
        content: '# Test',
        theme: 'light',
        showPreview: true
      }
    };
  });

  it('should render markdown content', () => {
    const renderer = new MarkdownWidgetRenderer(config, mockSheet, container);
    renderer.render();

    expect(container.querySelector('.markdown-content')).toBeTruthy();
    expect(container.innerHTML).toContain('<h1>Test</h1>');
  });

  it('should update theme', () => {
    const renderer = new MarkdownWidgetRenderer(config, mockSheet, container);
    config.markdownConfig!.theme = 'dark';
    renderer.render();

    const content = container.querySelector('.markdown-content') as HTMLElement;
    expect(content.style.background).toBe('#1f2937');
  });
});
```

---

## Referência de API

### PluginContext.widgets

#### `register(type: string, rendererClass: IWidgetRenderer): void`

Registra um novo tipo de widget.

```typescript
context.widgets.register('my-widget', MyWidgetRenderer);
```

---

#### `unregister(type: string): void`

Remove um tipo de widget do registry (chamado no `dispose()`).

```typescript
context.widgets.unregister('my-widget');
```

---

#### `create(sheetId: string, type: string, config: Partial<WidgetConfig>): WidgetConfig`

Helper para criar widget com ID e timestamps automáticos.

```typescript
const widget = context.widgets.create(sheet.id, 'my-widget', {
  title: 'Meu Widget',
  myWidgetConfig: { ... }
});
```

**Internamente chama:**
```typescript
kernel.dashboardManager.addWidget(sheetId, type, config);
```

---

### PluginContext.ui

#### `addDashboardButton(config: DashboardButtonConfig): void`

Adiciona botão no painel de dashboard.

```typescript
interface DashboardButtonConfig {
  id: string;
  label: string;
  icon: string;
  onClick: () => void;
}

context.ui.addDashboardButton({
  id: 'btn-my-widget',
  label: 'Meu Widget',
  icon: '🎨',
  onClick: () => this.createMyWidget()
});
```

---

### PluginContext.events

#### Widget Lifecycle Events

Eventos emitidos automaticamente pelo core:

- `widget:created` - Novo widget criado
- `widget:updated` - Widget modificado
- `widget:removed` - Widget removido
- `widget:moved` - Widget movido/redimensionado
- `dashboard:mode-changed` - Modo alterado (grid ↔ dashboard)

**Uso:**
```typescript
context.events.on('widget:created', (data) => {
  console.log('Widget criado:', data.widgetId);
});
```

---

## Distribuição de Plugins com Widgets

### Opção 1: npm Package

```bash
# Publicar
npm publish

# Instalar em outro projeto
npm install @dataforge/my-widget-plugin
```

---

### Opção 2: CDN

```typescript
// Carregar de CDN
const pluginModule = await import('https://cdn.example.com/my-plugin.js');
const plugin = new pluginModule.default();
await kernel.pluginHost.loadPlugin(plugin);
```

---

### Opção 3: Plugin Marketplace (Futuro)

```typescript
// Instalar via marketplace
await kernel.pluginHost.installFromMarketplace('my-widget-plugin');
```

---

## Exemplo Completo: Plugin Financeiro

Ver `src/plugins/financial-widgets-plugin.ts` para exemplo de plugin que adiciona múltiplos widgets financeiros:

- 📊 **Stock Chart** - Gráfico de ações com dados de API
- 💹 **Forex Rate** - Taxa de câmbio em tempo real
- 📈 **Portfolio Summary** - Resumo de portfólio
- 🏦 **Bank Balance** - Saldo bancário agregado

---

**Versão:** 1.0.0
**Data:** 2025-01-27
**Autor:** DJ DataForge Team
