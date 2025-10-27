# DJ DataForge v6 - Desenvolvendo Widgets Customizados

## 📋 Índice

1. [Introdução](#introdução)
2. [Estrutura Básica de um Widget](#estrutura-básica-de-um-widget)
3. [Tutorial Passo a Passo](#tutorial-passo-a-passo)
4. [Exemplos Práticos](#exemplos-práticos)
5. [Boas Práticas](#boas-práticas)
6. [Troubleshooting](#troubleshooting)

---

## Introdução

Este guia ensina como criar widgets customizados para o DJ DataForge v6. Widgets customizados podem:

- ✅ Visualizar dados de formas únicas
- ✅ Integrar com APIs externas
- ✅ Fornecer interatividade avançada
- ✅ Reutilizar lógica de negócio
- ✅ Ser compartilhados entre projetos

### Pré-requisitos

- Conhecimento de TypeScript
- Familiaridade com DOM manipulation
- Entendimento básico da arquitetura do DataForge (veja `WIDGETS_ARCHITECTURE.md`)

---

## Estrutura Básica de um Widget

### 1. Definir Tipo no Sistema de Tipos

**Arquivo:** `src/@core/types/index.ts`

```typescript
// 1. Adicione o tipo ao union type
export type WidgetType =
  | 'kpi'
  | 'table'
  | 'text'
  | 'image'
  | 'chart'
  | 'pivot'
  | 'my-custom-widget';  // ← Novo tipo

// 2. Adicione a interface de configuração (se necessário)
export interface MyCustomWidgetConfig {
  apiUrl?: string;
  refreshInterval?: number;
  displayMode?: 'compact' | 'expanded';
  customParameter?: any;
}

// 3. Adicione ao WidgetConfig
export interface WidgetConfig {
  // ... campos existentes
  myCustomWidgetConfig?: MyCustomWidgetConfig;  // ← Nova config
}
```

---

### 2. Criar a Classe Renderer

**Arquivo:** `src/@core/my-custom-widget.ts` (ou dentro de `dashboard-widgets.ts`)

```typescript
import type { WidgetConfig } from './types';
import type { Sheet } from './workbook-consolidated';

export class MyCustomWidgetRenderer {
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

  /**
   * Renderiza o conteúdo do widget
   */
  render(): void {
    const myConfig = this.config.myCustomWidgetConfig;
    if (!myConfig) {
      this.container.innerHTML = '<div>Configuração não encontrada</div>';
      return;
    }

    // Seu código de renderização aqui
    this.container.innerHTML = `
      <div style="padding: 20px;">
        <h3>Meu Widget Customizado</h3>
        <p>Modo: ${myConfig.displayMode}</p>
      </div>
    `;
  }

  /**
   * Renderiza o painel de configurações (opcional)
   */
  renderSettings?(container: HTMLElement): void {
    const myConfig = this.config.myCustomWidgetConfig || {};

    container.innerHTML = `
      <div>
        <label>
          Modo de Exibição:
          <select class="my-widget-display-mode">
            <option value="compact" ${myConfig.displayMode === 'compact' ? 'selected' : ''}>Compacto</option>
            <option value="expanded" ${myConfig.displayMode === 'expanded' ? 'selected' : ''}>Expandido</option>
          </select>
        </label>
      </div>
    `;

    // Event listeners
    const select = container.querySelector('.my-widget-display-mode') as HTMLSelectElement;
    select.addEventListener('change', () => {
      if (!this.config.myCustomWidgetConfig) {
        this.config.myCustomWidgetConfig = {};
      }
      this.config.myCustomWidgetConfig.displayMode = select.value as 'compact' | 'expanded';
      this.render();
      this.onWidgetChange?.();
    });
  }
}
```

---

### 3. Registrar o Widget

**Arquivo:** `src/@core/dashboard-renderer.ts`

```typescript
private _registerWidgets(): void {
  widgetRegistry.register('table', TableWidgetRenderer);
  widgetRegistry.register('kpi', KPIWidgetRenderer);
  widgetRegistry.register('text', TextWidgetRenderer);
  widgetRegistry.register('image', ImageWidgetRenderer);
  widgetRegistry.register('my-custom-widget', MyCustomWidgetRenderer);  // ← Novo
}
```

---

### 4. Adicionar UI para Criar Widget (Opcional)

**Arquivo:** `src/ui-manager.ts`

```typescript
// Adicionar botão no painel de dashboard
<button id="btn-add-my-widget" class="dashboard-widget-btn">
  <span class="widget-icon">🎨</span>
  <span class="widget-label">Meu Widget</span>
</button>

// Event listener
document.getElementById('btn-add-my-widget')?.addEventListener('click', () => {
  this.addWidget('my-custom-widget');
});

// Implementar modal de criação
public addWidget(type: 'my-custom-widget'): void {
  const sheet = kernel.workbookManager.getActiveSheet();
  if (!sheet || !this.isDashboardMode) return;

  // Mostrar modal com configurações iniciais
  const modal = this.createModal('Novo Widget Customizado');
  modal.innerHTML = `
    <div class="modal-body">
      <div class="form-group">
        <label>Modo de Exibição</label>
        <select id="my-widget-mode">
          <option value="compact">Compacto</option>
          <option value="expanded">Expandido</option>
        </select>
      </div>
    </div>
    <div class="modal-footer">
      <button id="my-widget-cancel" class="btn-secondary">Cancelar</button>
      <button id="my-widget-create" class="btn-primary">Criar</button>
    </div>
  `;

  document.getElementById('my-widget-create')?.addEventListener('click', () => {
    const mode = (document.getElementById('my-widget-mode') as HTMLSelectElement).value;

    const widget = kernel.dashboardManager.addWidget(sheet.id, 'my-custom-widget', {
      title: 'Meu Widget',
      myCustomWidgetConfig: {
        displayMode: mode as 'compact' | 'expanded'
      }
    });

    if (this.dashboardRenderer) {
      this.dashboardRenderer.refresh();
    }

    modal.remove();
  });
}
```

---

## Tutorial Passo a Passo

### Exemplo: Widget de Contador Simples

Vamos criar um widget que conta cliques e persiste o valor.

#### Passo 1: Definir Tipos

```typescript
// src/@core/types/index.ts

export type WidgetType =
  | 'kpi' | 'table' | 'text' | 'image' | 'chart' | 'pivot'
  | 'counter';  // ← Novo

export interface CounterWidgetConfig {
  count: number;
  step: number;  // Incremento por clique
  maxCount?: number;
}

export interface WidgetConfig {
  // ... campos existentes
  counterConfig?: CounterWidgetConfig;
}
```

#### Passo 2: Criar Renderer

```typescript
// src/@core/dashboard-widgets.ts (ou arquivo separado)

export class CounterWidgetRenderer {
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
    // Inicializar config se não existir
    if (!this.config.counterConfig) {
      this.config.counterConfig = { count: 0, step: 1 };
    }

    const cfg = this.config.counterConfig;

    this.container.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 20px;">
        <div style="font-size: 72px; font-weight: bold; color: #2563eb;">
          ${cfg.count}
        </div>
        <div style="display: flex; gap: 10px;">
          <button class="counter-decrement" style="padding: 10px 20px; font-size: 18px; cursor: pointer;">➖</button>
          <button class="counter-increment" style="padding: 10px 20px; font-size: 18px; cursor: pointer;">➕</button>
          <button class="counter-reset" style="padding: 10px 20px; font-size: 18px; cursor: pointer;">🔄</button>
        </div>
        ${cfg.maxCount ? `<div style="font-size: 12px; color: #6b7280;">Máximo: ${cfg.maxCount}</div>` : ''}
      </div>
    `;

    // Event listeners
    this.container.querySelector('.counter-increment')?.addEventListener('click', () => {
      if (cfg.maxCount && cfg.count >= cfg.maxCount) return;
      cfg.count += cfg.step;
      this.render();
      this.onWidgetChange?.();
    });

    this.container.querySelector('.counter-decrement')?.addEventListener('click', () => {
      if (cfg.count <= 0) return;
      cfg.count -= cfg.step;
      this.render();
      this.onWidgetChange?.();
    });

    this.container.querySelector('.counter-reset')?.addEventListener('click', () => {
      cfg.count = 0;
      this.render();
      this.onWidgetChange?.();
    });
  }

  renderSettings(container: HTMLElement): void {
    const cfg = this.config.counterConfig || { count: 0, step: 1 };

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <div>
          <label style="font-size: 12px; display: block; margin-bottom: 4px;">Incremento por clique:</label>
          <input type="number" class="counter-step" value="${cfg.step}" style="width: 100%; padding: 4px; font-size: 12px;">
        </div>
        <div>
          <label style="font-size: 12px; display: block; margin-bottom: 4px;">Contador máximo (opcional):</label>
          <input type="number" class="counter-max" value="${cfg.maxCount || ''}" placeholder="Sem limite" style="width: 100%; padding: 4px; font-size: 12px;">
        </div>
      </div>
    `;

    const stepInput = container.querySelector('.counter-step') as HTMLInputElement;
    stepInput.addEventListener('change', () => {
      if (!this.config.counterConfig) this.config.counterConfig = { count: 0, step: 1 };
      this.config.counterConfig.step = parseInt(stepInput.value) || 1;
      this.onWidgetChange?.();
    });

    const maxInput = container.querySelector('.counter-max') as HTMLInputElement;
    maxInput.addEventListener('change', () => {
      if (!this.config.counterConfig) this.config.counterConfig = { count: 0, step: 1 };
      const value = parseInt(maxInput.value);
      this.config.counterConfig.maxCount = isNaN(value) ? undefined : value;
      this.render();
      this.onWidgetChange?.();
    });
  }
}
```

#### Passo 3: Registrar

```typescript
// src/@core/dashboard-renderer.ts

private _registerWidgets(): void {
  // ... registros existentes
  widgetRegistry.register('counter', CounterWidgetRenderer);
}
```

#### Passo 4: Adicionar Botão (Opcional)

```typescript
// src/ui-manager.ts - no painel de dashboard

<button id="btn-add-counter-widget" class="dashboard-widget-btn">
  <span class="widget-icon">🔢</span>
  <span class="widget-label">Contador</span>
</button>

// Event listener
document.getElementById('btn-add-counter-widget')?.addEventListener('click', () => {
  const sheet = kernel.workbookManager.getActiveSheet();
  if (!sheet || !this.isDashboardMode) return;

  const widget = kernel.dashboardManager.addWidget(sheet.id, 'counter', {
    title: 'Contador',
    counterConfig: {
      count: 0,
      step: 1
    }
  });

  if (this.dashboardRenderer) {
    this.dashboardRenderer.refresh();
  }
});
```

---

## Exemplos Práticos

### Exemplo 1: Widget de Relógio

```typescript
export class ClockWidgetRenderer {
  private config: WidgetConfig;
  private container: HTMLDivElement;
  private intervalId?: number;

  constructor(config: WidgetConfig, _sheet: Sheet, container: HTMLDivElement) {
    this.config = config;
    this.container = container;
  }

  render(): void {
    this.container.innerHTML = `
      <div id="clock-display" style="display: flex; align-items: center; justify-content: center; height: 100%; font-size: 48px; font-weight: bold;">
        --:--:--
      </div>
    `;

    // Update every second
    this.intervalId = window.setInterval(() => {
      const now = new Date();
      const timeString = now.toLocaleTimeString('pt-BR');
      const display = this.container.querySelector('#clock-display');
      if (display) {
        display.textContent = timeString;
      }
    }, 1000);
  }

  destroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }
}
```

**Importante:** Adicione método `destroy()` no `IWidgetRenderer` para cleanup.

---

### Exemplo 2: Widget de API (Weather)

```typescript
export interface WeatherWidgetConfig {
  city: string;
  apiKey: string;
  unit: 'celsius' | 'fahrenheit';
}

export class WeatherWidgetRenderer {
  private config: WidgetConfig;
  private container: HTMLDivElement;
  private onWidgetChange?: () => void;

  constructor(config: WidgetConfig, _sheet: Sheet, container: HTMLDivElement, onWidgetChange?: () => void) {
    this.config = config;
    this.container = container;
    this.onWidgetChange = onWidgetChange;
  }

  async render(): Promise<void> {
    const weatherConfig = this.config.weatherConfig;
    if (!weatherConfig || !weatherConfig.apiKey) {
      this.container.innerHTML = '<div style="padding: 20px; text-align: center;">Configure a API key nas configurações</div>';
      return;
    }

    this.container.innerHTML = '<div style="padding: 20px; text-align: center;">Carregando...</div>';

    try {
      const data = await this.fetchWeather(weatherConfig.city, weatherConfig.apiKey);
      const temp = weatherConfig.unit === 'celsius' ? data.main.temp : (data.main.temp * 9/5) + 32;

      this.container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 10px;">
          <div style="font-size: 24px; font-weight: bold;">${weatherConfig.city}</div>
          <div style="font-size: 64px;">${Math.round(temp)}°${weatherConfig.unit === 'celsius' ? 'C' : 'F'}</div>
          <div style="font-size: 18px; color: #6b7280;">${data.weather[0].description}</div>
        </div>
      `;
    } catch (error) {
      this.container.innerHTML = `<div style="padding: 20px; color: #ef4444;">Erro ao carregar dados: ${error.message}</div>`;
    }
  }

  private async fetchWeather(city: string, apiKey: string): Promise<any> {
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`
    );
    if (!response.ok) throw new Error('Falha ao buscar dados');
    return response.json();
  }

  renderSettings(container: HTMLElement): void {
    const cfg = this.config.weatherConfig || { city: '', apiKey: '', unit: 'celsius' };

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <div>
          <label style="font-size: 12px;">Cidade:</label>
          <input type="text" class="weather-city" value="${cfg.city}" style="width: 100%; padding: 4px;">
        </div>
        <div>
          <label style="font-size: 12px;">API Key:</label>
          <input type="password" class="weather-apikey" value="${cfg.apiKey}" style="width: 100%; padding: 4px;">
        </div>
        <div>
          <label style="font-size: 12px;">Unidade:</label>
          <select class="weather-unit" style="width: 100%; padding: 4px;">
            <option value="celsius" ${cfg.unit === 'celsius' ? 'selected' : ''}>Celsius</option>
            <option value="fahrenheit" ${cfg.unit === 'fahrenheit' ? 'selected' : ''}>Fahrenheit</option>
          </select>
        </div>
        <button class="weather-refresh" style="padding: 6px; cursor: pointer;">Atualizar</button>
      </div>
    `;

    const cityInput = container.querySelector('.weather-city') as HTMLInputElement;
    const apikeyInput = container.querySelector('.weather-apikey') as HTMLInputElement;
    const unitSelect = container.querySelector('.weather-unit') as HTMLSelectElement;
    const refreshBtn = container.querySelector('.weather-refresh') as HTMLButtonElement;

    const saveConfig = () => {
      if (!this.config.weatherConfig) this.config.weatherConfig = { city: '', apiKey: '', unit: 'celsius' };
      this.config.weatherConfig.city = cityInput.value;
      this.config.weatherConfig.apiKey = apikeyInput.value;
      this.config.weatherConfig.unit = unitSelect.value as 'celsius' | 'fahrenheit';
      this.onWidgetChange?.();
    };

    cityInput.addEventListener('change', saveConfig);
    apikeyInput.addEventListener('change', saveConfig);
    unitSelect.addEventListener('change', saveConfig);

    refreshBtn.addEventListener('click', () => {
      saveConfig();
      this.render();
    });
  }
}
```

---

### Exemplo 3: Widget de Gráfico de Barras Simples

```typescript
export interface BarChartWidgetConfig {
  tableId: string;
  labelColumn: number;
  valueColumn: number;
  barColor: string;
}

export class BarChartWidgetRenderer {
  private config: WidgetConfig;
  private sheet: Sheet;
  private container: HTMLDivElement;

  constructor(config: WidgetConfig, sheet: Sheet, container: HTMLDivElement) {
    this.config = config;
    this.sheet = sheet;
    this.container = container;
  }

  render(): void {
    const chartConfig = this.config.barChartConfig;
    if (!chartConfig || !chartConfig.tableId) {
      this.container.innerHTML = '<div>Configure a tabela nas configurações</div>';
      return;
    }

    const tableManager = TableManager.getInstance();
    const table = tableManager.getTable(chartConfig.tableId);
    if (!table) {
      this.container.innerHTML = '<div>Tabela não encontrada</div>';
      return;
    }

    const tableSheet = kernel.workbookManager.getSheet(table.sheetId);
    if (!tableSheet) return;

    // Extract data
    const data: { label: string; value: number }[] = [];
    const dataStartRow = table.hasHeaders ? table.range.startRow + 1 : table.range.startRow;
    const dataEndRow = table.showTotalRow ? table.range.endRow - 1 : table.range.endRow;

    for (let row = dataStartRow; row <= dataEndRow; row++) {
      const labelCell = tableSheet.getCell(row, table.range.startCol + chartConfig.labelColumn);
      const valueCell = tableSheet.getCell(row, table.range.startCol + chartConfig.valueColumn);

      if (labelCell && valueCell && typeof valueCell.value === 'number') {
        data.push({
          label: String(labelCell.value),
          value: valueCell.value
        });
      }
    }

    // Render simple bar chart
    const maxValue = Math.max(...data.map(d => d.value));
    const barColor = chartConfig.barColor || '#3b82f6';

    this.container.innerHTML = `
      <div style="padding: 20px; height: 100%; display: flex; flex-direction: column; gap: 8px; overflow-y: auto;">
        ${data.map(item => {
          const percentage = (item.value / maxValue) * 100;
          return `
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="min-width: 80px; font-size: 12px; text-align: right;">${item.label}</div>
              <div style="flex: 1; background: #e5e7eb; height: 24px; border-radius: 4px; position: relative;">
                <div style="background: ${barColor}; height: 100%; width: ${percentage}%; border-radius: 4px; transition: width 0.3s;"></div>
                <span style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); font-size: 11px; font-weight: bold; color: ${percentage > 50 ? '#fff' : '#1f2937'};">
                  ${item.value.toLocaleString('pt-BR')}
                </span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  renderSettings(container: HTMLElement): void {
    // Implementação similar aos exemplos anteriores
    // Permitir escolher tabela, colunas de label/valor, cor das barras
  }
}
```

---

## Boas Práticas

### 1. Gerenciamento de Estado

✅ **BOM:**
```typescript
render(): void {
  // Inicializar config se não existir
  if (!this.config.myConfig) {
    this.config.myConfig = this.getDefaultConfig();
  }

  // Usar a config
  const cfg = this.config.myConfig;
  // ...
}
```

❌ **EVITAR:**
```typescript
render(): void {
  // Assumir que config existe sem verificar
  const cfg = this.config.myConfig; // Pode ser undefined!
  // ...
}
```

---

### 2. Event Listeners

✅ **BOM:**
```typescript
render(): void {
  this.container.innerHTML = `<button class="my-btn">Click</button>`;

  // Anexar listener após renderizar DOM
  this.container.querySelector('.my-btn')?.addEventListener('click', () => {
    this.handleClick();
  });
}
```

❌ **EVITAR:**
```typescript
render(): void {
  this.container.innerHTML = `<button onclick="this.handleClick()">Click</button>`;
  // Inline handlers não terão acesso ao contexto da classe
}
```

---

### 3. Cleanup de Recursos

Se seu widget usa timers, listeners globais, ou subscriptions:

```typescript
export class MyWidgetRenderer {
  private intervalId?: number;
  private abortController?: AbortController;

  render(): void {
    // Setup interval
    this.intervalId = window.setInterval(() => {
      this.updateData();
    }, 5000);

    // Setup fetch with abort signal
    this.abortController = new AbortController();
    fetch(url, { signal: this.abortController.signal });
  }

  destroy(): void {
    // Cleanup interval
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    // Abort fetch
    if (this.abortController) {
      this.abortController.abort();
    }
  }
}
```

**Nota:** Atualmente `destroy()` não está na interface. Veja refinamentos sugeridos na Parte 3.

---

### 4. Error Handling

✅ **BOM:**
```typescript
async render(): Promise<void> {
  try {
    const data = await this.fetchData();
    this.renderData(data);
  } catch (error) {
    this.container.innerHTML = `
      <div style="padding: 20px; color: #ef4444; text-align: center;">
        ❌ Erro: ${error instanceof Error ? error.message : 'Desconhecido'}
      </div>
    `;
    logger.error('[MyWidget] Render error', error);
  }
}
```

---

### 5. Responsividade

Adapte ao tamanho do widget:

```typescript
render(): void {
  const width = this.config.position.width;
  const height = this.config.position.height;

  const isCompact = width < 300 || height < 200;

  this.container.innerHTML = `
    <div style="
      font-size: ${isCompact ? '12px' : '16px'};
      padding: ${isCompact ? '8px' : '16px'};
    ">
      ${isCompact ? 'Compact view' : 'Full view'}
    </div>
  `;
}
```

---

### 6. Acessibilidade

```typescript
render(): void {
  this.container.innerHTML = `
    <div role="region" aria-label="${this.config.title}">
      <button
        aria-label="Incrementar contador"
        class="increment-btn"
      >
        ➕
      </button>
    </div>
  `;
}
```

---

### 7. Performance

Para widgets com dados grandes:

```typescript
render(): void {
  // Use DocumentFragment para construção em batch
  const fragment = document.createDocumentFragment();

  data.forEach(item => {
    const div = document.createElement('div');
    div.textContent = item.label;
    fragment.appendChild(div);
  });

  this.container.innerHTML = '';
  this.container.appendChild(fragment);
}
```

---

## Troubleshooting

### Problema: Widget não aparece

**Possíveis causas:**
1. Tipo não registrado no `widgetRegistry`
2. Erro no método `render()`
3. Config inválida

**Solução:**
```typescript
// Verificar no console do browser
console.log(widgetRegistry.get('my-widget-type')); // Deve retornar a classe

// Adicionar try-catch no render
render(): void {
  try {
    // seu código
  } catch (error) {
    console.error('[MyWidget] Render error:', error);
    this.container.innerHTML = `<div>Error: ${error.message}</div>`;
  }
}
```

---

### Problema: Configurações não salvam

**Possíveis causas:**
1. Não está chamando `this.onWidgetChange?.()`
2. Config não está sendo atualizada corretamente

**Solução:**
```typescript
renderSettings(container: HTMLElement): void {
  const input = container.querySelector('.my-input') as HTMLInputElement;

  input.addEventListener('change', () => {
    // 1. Atualizar config
    if (!this.config.myConfig) this.config.myConfig = {};
    this.config.myConfig.value = input.value;

    // 2. Re-renderizar widget
    this.render();

    // 3. Triggerar auto-save
    this.onWidgetChange?.(); // ← Essencial!
  });
}
```

---

### Problema: Widget não atualiza com dados da sheet

**Possíveis causas:**
1. Não está lendo dados atuais da sheet
2. Não está recalculando após mudanças

**Solução:**
```typescript
render(): void {
  // Sempre buscar dados frescos da sheet
  const cell = this.sheet.getCell(row, col);
  const currentValue = cell?.value;

  // Não armazenar cache de valores da sheet no widget
  // ❌ EVITAR: this.cachedValue = cell?.value;
}
```

---

### Problema: Memory leak

**Possíveis causas:**
1. Event listeners não removidos
2. Timers não limpos

**Solução:**
```typescript
export class MyWidgetRenderer {
  private listeners: Array<{ element: Element; handler: EventListener }> = [];

  render(): void {
    // Limpar listeners anteriores
    this.cleanup();

    const btn = this.container.querySelector('.btn');
    const handler = () => this.handleClick();

    btn?.addEventListener('click', handler);
    this.listeners.push({ element: btn!, handler });
  }

  cleanup(): void {
    this.listeners.forEach(({ element, handler }) => {
      element.removeEventListener('click', handler as any);
    });
    this.listeners = [];
  }

  destroy(): void {
    this.cleanup();
  }
}
```

---

## Checklist de Desenvolvimento

Antes de considerar seu widget pronto:

- [ ] Tipos TypeScript definidos em `types/index.ts`
- [ ] Classe renderer implementa `IWidgetRenderer`
- [ ] Método `render()` funciona sem erros
- [ ] Método `renderSettings()` implementado (se aplicável)
- [ ] Widget registrado no `widgetRegistry`
- [ ] Error handling adequado
- [ ] Cleanup de recursos (timers, listeners)
- [ ] Testado em diferentes tamanhos
- [ ] Configurações persistem corretamente
- [ ] Documentação adicionada (comentários JSDoc)
- [ ] Acessibilidade considerada (ARIA labels)

---

**Próximo:** Veja `WIDGETS_PLUGIN_INTEGRATION.md` para aprender como plugins podem adicionar widgets.
