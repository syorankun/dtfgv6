# Exemplo Completo: Plugin com Widget Customizado

Este documento demonstra como criar um plugin completo que adiciona um widget customizado ao DJ DataForge v6.

## Exemplo: Plugin de Widget de Gráfico de Barras

Este exemplo cria um plugin que adiciona um widget de gráfico de barras simples ao dashboard.

### 1. Estrutura do Plugin

```typescript
// src/plugins/chart-plugin.ts

import type { Plugin, PluginContext, PluginManifest } from '@core/types';
import type { WidgetConfig } from '@core/types';
import type { Sheet } from '@core/workbook-consolidated';

/**
 * Configuração específica do widget de gráfico
 */
interface ChartWidgetConfig {
  dataSource: 'table' | 'range';
  tableId?: string;
  range?: string;
  chartType: 'bar' | 'line' | 'pie';
  xColumn?: string;
  yColumn?: string;
  colors?: string[];
}

/**
 * Renderer do Widget de Gráfico
 */
class ChartWidgetRenderer {
  private config: WidgetConfig;
  private container: HTMLDivElement;
  private sheet: Sheet;
  private onWidgetChange?: () => void;
  private chartElement?: HTMLCanvasElement;

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
    this.container.innerHTML = '';

    const chartConfig = (this.config as any).chartConfig as ChartWidgetConfig | undefined;

    if (!chartConfig) {
      this.container.innerHTML = '<div style="color: #ef4444;">Configuração de gráfico ausente</div>';
      return;
    }

    // Criar canvas para o gráfico
    this.chartElement = document.createElement('canvas');
    this.chartElement.width = this.container.clientWidth;
    this.chartElement.height = this.container.clientHeight;
    this.container.appendChild(this.chartElement);

    // Renderizar gráfico
    this.renderChart(chartConfig);
  }

  private renderChart(config: ChartWidgetConfig): void {
    if (!this.chartElement) return;

    const ctx = this.chartElement.getContext('2d');
    if (!ctx) return;

    // Obter dados
    const data = this.getData(config);

    // Renderizar gráfico simples (exemplo com barras)
    if (config.chartType === 'bar') {
      this.renderBarChart(ctx, data, config);
    }
  }

  private getData(config: ChartWidgetConfig): { labels: string[]; values: number[] } {
    // Se for de uma tabela
    if (config.dataSource === 'table' && config.tableId) {
      const { TableManager } = require('@core/table-manager');
      const tableManager = TableManager.getInstance();
      const table = tableManager.getTable(config.tableId);

      if (table) {
        const labels: string[] = [];
        const values: number[] = [];

        // Extrair dados da tabela (simplificado)
        const data = tableManager.getTableData(config.tableId);
        data.forEach((row: any[]) => {
          labels.push(String(row[0]));
          values.push(Number(row[1]) || 0);
        });

        return { labels, values };
      }
    }

    // Dados de exemplo se não houver fonte
    return {
      labels: ['A', 'B', 'C', 'D'],
      values: [10, 20, 15, 25]
    };
  }

  private renderBarChart(
    ctx: CanvasRenderingContext2D,
    data: { labels: string[]; values: number[] },
    config: ChartWidgetConfig
  ): void {
    const width = this.chartElement!.width;
    const height = this.chartElement!.height;
    const padding = 40;
    const barWidth = (width - padding * 2) / data.labels.length;
    const maxValue = Math.max(...data.values);
    const scale = (height - padding * 2) / maxValue;

    // Limpar canvas
    ctx.clearRect(0, 0, width, height);

    // Desenhar barras
    data.values.forEach((value, index) => {
      const barHeight = value * scale;
      const x = padding + index * barWidth;
      const y = height - padding - barHeight;

      // Cor da barra
      ctx.fillStyle = (config.colors && config.colors[index]) || '#3b82f6';
      ctx.fillRect(x + 5, y, barWidth - 10, barHeight);

      // Label
      ctx.fillStyle = '#374151';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(data.labels[index], x + barWidth / 2, height - 20);

      // Valor
      ctx.fillText(String(value), x + barWidth / 2, y - 5);
    });

    // Eixos
    ctx.strokeStyle = '#9ca3af';
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();
  }

  renderSettings(container: HTMLElement): void {
    container.innerHTML = `
      <div style="padding: 10px; display: flex; flex-direction: column; gap: 10px;">
        <h4 style="margin: 0; font-size: 14px;">Configurações do Gráfico</h4>

        <div>
          <label style="font-size: 12px; display: block; margin-bottom: 4px;">Tipo de Gráfico</label>
          <select id="chart-type" style="width: 100%; padding: 4px;">
            <option value="bar">Barras</option>
            <option value="line">Linha</option>
            <option value="pie">Pizza</option>
          </select>
        </div>

        <div>
          <label style="font-size: 12px; display: block; margin-bottom: 4px;">Fonte de Dados</label>
          <select id="data-source" style="width: 100%; padding: 4px;">
            <option value="table">Tabela</option>
            <option value="range">Intervalo</option>
          </select>
        </div>

        <button id="apply-chart-settings" style="padding: 6px 12px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;">
          Aplicar
        </button>
      </div>
    `;

    // Event listeners
    const applyButton = container.querySelector('#apply-chart-settings');
    applyButton?.addEventListener('click', () => {
      const chartType = (container.querySelector('#chart-type') as HTMLSelectElement)?.value;
      const dataSource = (container.querySelector('#data-source') as HTMLSelectElement)?.value;

      // Atualizar configuração
      const chartConfig: ChartWidgetConfig = {
        ...(this.config as any).chartConfig,
        chartType: chartType as 'bar' | 'line' | 'pie',
        dataSource: dataSource as 'table' | 'range'
      };

      (this.config as any).chartConfig = chartConfig;

      // Notificar mudança
      if (this.onWidgetChange) {
        this.onWidgetChange();
      }

      // Re-renderizar
      this.render();
    });
  }

  destroy(): void {
    // Cleanup
    this.container.innerHTML = '';
    this.chartElement = undefined;
  }
}

/**
 * Plugin Principal
 */
export class ChartPlugin implements Plugin {
  manifest: PluginManifest = {
    id: 'chart-plugin',
    name: 'Chart Widget Plugin',
    version: '1.0.0',
    author: 'DataForge Team',
    description: 'Adiciona widgets de gráficos ao dashboard',
    permissions: ['read:workbook', 'ui:toolbar'],
    entryPoint: 'chart-plugin.js'
  };

  async init(context: PluginContext): Promise<void> {
    console.log('[ChartPlugin] Initializing...');

    // 1. Registrar o widget customizado
    context.widgets.register('chart', ChartWidgetRenderer);
    console.log('[ChartPlugin] Chart widget registered');

    // 2. Adicionar botão ao dashboard para criar gráficos
    context.ui.addDashboardButton({
      id: 'add-chart',
      label: 'Gráfico',
      icon: '📊',
      onClick: () => {
        const sheet = context.kernel.workbookManager.getActiveSheet();
        if (!sheet) {
          context.ui.showToast('Nenhuma sheet ativa', 'error');
          return;
        }

        // Criar widget de gráfico
        const widget = context.widgets.create(sheet.id, 'chart', {
          title: 'Novo Gráfico',
          position: { x: 100, y: 100, width: 500, height: 400 },
          chartConfig: {
            dataSource: 'table',
            chartType: 'bar',
            colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444']
          }
        });

        console.log('[ChartPlugin] Chart widget created:', widget.id);
        context.ui.showToast('Gráfico adicionado ao dashboard', 'success');
      }
    });

    // 3. Listar tipos de widgets disponíveis
    const availableTypes = context.widgets.getAvailableTypes();
    console.log('[ChartPlugin] Available widget types:', availableTypes);

    // 4. Escutar eventos de widgets
    context.events.on('widget:created', (data) => {
      if (data.type === 'chart') {
        console.log('[ChartPlugin] Chart widget created:', data.widgetId);
      }
    });

    context.events.on('widget:removed', (data) => {
      console.log('[ChartPlugin] Widget removed:', data.widgetId);
    });

    context.ui.showToast('Chart Plugin carregado!', 'success');
  }

  async dispose(): Promise<void> {
    console.log('[ChartPlugin] Disposing...');
    // Cleanup automático será feito pelo sistema
  }
}
```

### 2. Carregando o Plugin

```typescript
// src/app.ts ou src/plugins/index.ts

import { ChartPlugin } from './plugins/chart-plugin';

// Carregar plugin no kernel
async function loadPlugins() {
  const kernel = DJDataForgeKernel.getInstance();

  const chartPlugin = new ChartPlugin();
  await kernel.pluginHost.loadPlugin(chartPlugin);
}
```

### 3. Uso do Widget

Após carregar o plugin:

1. **Via UI**: Clique no botão "📊 Gráfico" no dashboard sidebar
2. **Programaticamente**:

```typescript
// Obter contexto do plugin
const context = kernel.pluginHost.getContext('chart-plugin');

// Criar widget de gráfico
if (context) {
  const widget = context.widgets.create(sheetId, 'chart', {
    title: 'Vendas Mensais',
    position: { x: 50, y: 50, width: 600, height: 400 },
    chartConfig: {
      dataSource: 'table',
      tableId: 'my-sales-table',
      chartType: 'bar',
      xColumn: 'mes',
      yColumn: 'vendas',
      colors: ['#3b82f6', '#10b981']
    }
  });
}
```

## Recursos Avançados

### Verificar Disponibilidade de Tipos

```typescript
// Verificar se um tipo está disponível antes de criar
if (context.widgets.isTypeAvailable('chart')) {
  context.widgets.create(sheetId, 'chart', { ... });
} else {
  console.error('Chart widget não está disponível');
}
```

### Listar Todos os Widgets

```typescript
// Obter todos os tipos registrados
const types = context.widgets.getAvailableTypes();
console.log('Widgets disponíveis:', types);
// Output: ['kpi', 'table', 'text', 'image', 'chart']
```

### Eventos de Ciclo de Vida

```typescript
// Escutar criação de widgets
context.events.on('widget:created', (data) => {
  console.log(`Widget ${data.type} criado:`, data.widgetId);
});

// Escutar remoção
context.events.on('widget:removed', (data) => {
  console.log(`Widget removido:`, data.widgetId);
});

// Escutar atualização
context.events.on('widget:updated', (data) => {
  console.log(`Widget atualizado:`, data.widgetId, data.updates);
});

// Escutar movimentação/redimensionamento
context.events.on('widget:moved', (data) => {
  console.log(`Widget movido:`, data.widgetId, data.position);
});
```

## Boas Práticas

1. **Sempre implemente `destroy()`** - Limpe recursos, timers, event listeners
2. **Valide configurações** - Verifique se dados necessários existem antes de renderizar
3. **Use `onWidgetChange`** - Notifique mudanças para auto-save funcionar
4. **Trate erros graciosamente** - Mostre mensagens de erro amigáveis
5. **Teste limpeza** - Verifique se `destroy()` é chamado corretamente ao trocar de modo
6. **Documente configurações** - Deixe claro quais opções seu widget aceita

## Testando o Plugin

```typescript
// Teste básico
const sheet = kernel.workbookManager.getActiveSheet();
if (sheet) {
  // Criar widget
  const widget = context.widgets.create(sheet.id, 'chart', {
    title: 'Teste',
    chartConfig: { chartType: 'bar', dataSource: 'table' }
  });

  // Verificar
  const layout = kernel.dashboardManager.getLayout(sheet.id);
  console.log('Widgets no layout:', layout?.widgets.length);

  // Limpar
  kernel.dashboardManager.removeWidget(sheet.id, widget.id);
}
```

## Veja Também

- [WIDGETS_ARCHITECTURE.md](./WIDGETS_ARCHITECTURE.md) - Arquitetura do sistema de widgets
- [WIDGETS_CUSTOM_DEVELOPMENT.md](./WIDGETS_CUSTOM_DEVELOPMENT.md) - Guia de desenvolvimento
- [WIDGETS_PLUGIN_INTEGRATION.md](./WIDGETS_PLUGIN_INTEGRATION.md) - Integração com plugins
