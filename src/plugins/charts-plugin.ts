import { nanoid } from 'nanoid';
import { ChartManager, ChartConfig } from './chart-manager';
import type {
    PluginManifest,
    PluginContext
  } from '../@core/types';
import { logger } from '../@core/storage-utils-consolidated';
import Chart from 'chart.js/auto';
import { Plugin } from '../@core/plugin-system-consolidated';

// ============================================================================
// PROFESSIONAL CHART PLUGIN
// ============================================================================

interface ChartTemplate {
  id: string;
  name: string;
  type: string;
  description: string;
  icon: string;
  options: any;
}

interface ChartTheme {
  id: string;
  name: string;
  colors: string[];
  backgroundColor: string;
  gridColor: string;
  fontColor: string;
}

export class ChartsPlugin implements Plugin {
  private chartManager = new ChartManager();
  private context!: PluginContext;
  private rangeSelectionCallback: ((range: string) => void) | null = null;
  private isSelectingRange: boolean = false;
  private selectionOverlay: HTMLElement | null = null;

  // Professional color schemes
  private readonly THEMES: ChartTheme[] = [
    {
      id: 'default',
      name: 'Padrão',
      colors: ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'],
      backgroundColor: '#ffffff',
      gridColor: '#e5e7eb',
      fontColor: '#374151'
    },
    {
      id: 'professional',
      name: 'Profissional',
      colors: ['#0EA5E9', '#DC2626', '#059669', '#D97706', '#7C3AED', '#DB2777', '#0D9488', '#EA580C'],
      backgroundColor: '#ffffff',
      gridColor: '#d1d5db',
      fontColor: '#1f2937'
    },
    {
      id: 'pastel',
      name: 'Pastel',
      colors: ['#93C5FD', '#FCA5A5', '#6EE7B7', '#FCD34D', '#C4B5FD', '#F9A8D4', '#5EEAD4', '#FDBA74'],
      backgroundColor: '#ffffff',
      gridColor: '#e5e7eb',
      fontColor: '#6b7280'
    },
    {
      id: 'vibrant',
      name: 'Vibrante',
      colors: ['#2563EB', '#DC2626', '#16A34A', '#CA8A04', '#9333EA', '#BE185D', '#0F766E', '#C2410C'],
      backgroundColor: '#ffffff',
      gridColor: '#d1d5db',
      fontColor: '#111827'
    },
    {
      id: 'dark',
      name: 'Escuro',
      colors: ['#60A5FA', '#F87171', '#34D399', '#FBBF24', '#A78BFA', '#F472B6', '#2DD4BF', '#FB923C'],
      backgroundColor: '#1f2937',
      gridColor: '#4b5563',
      fontColor: '#f9fafb'
    }
  ];

  // Professional chart templates
  private readonly TEMPLATES: ChartTemplate[] = [
    {
      id: 'column-basic',
      name: 'Colunas Básico',
      type: 'bar',
      description: 'Gráfico de colunas verticais simples',
      icon: '📊',
      options: {
        indexAxis: 'x',
        plugins: { legend: { display: true, position: 'top' } }
      }
    },
    {
      id: 'bar-horizontal',
      name: 'Barras Horizontais',
      type: 'bar',
      description: 'Gráfico de barras horizontais',
      icon: '📈',
      options: {
        indexAxis: 'y',
        plugins: { legend: { display: true, position: 'top' } }
      }
    },
    {
      id: 'line-smooth',
      name: 'Linha Suave',
      type: 'line',
      description: 'Gráfico de linha com curvas suaves',
      icon: '📉',
      options: {
        tension: 0.4,
        fill: false,
        plugins: { legend: { display: true, position: 'top' } }
      }
    },
    {
      id: 'area-filled',
      name: 'Área Preenchida',
      type: 'line',
      description: 'Gráfico de área com preenchimento',
      icon: '🌊',
      options: {
        tension: 0.4,
        fill: true,
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        plugins: { legend: { display: true, position: 'top' } }
      }
    },
    {
      id: 'pie',
      name: 'Pizza',
      type: 'pie',
      description: 'Gráfico de pizza circular',
      icon: '🥧',
      options: {
        plugins: {
          legend: { display: true, position: 'right' },
          tooltip: { callbacks: {} }
        }
      }
    },
    {
      id: 'doughnut',
      name: 'Rosca',
      type: 'doughnut',
      description: 'Gráfico de rosca (pizza com furo central)',
      icon: '🍩',
      options: {
        cutout: '50%',
        plugins: { legend: { display: true, position: 'right' } }
      }
    },
    {
      id: 'radar',
      name: 'Radar',
      type: 'radar',
      description: 'Gráfico de radar para comparação multidimensional',
      icon: '🎯',
      options: {
        scales: {
          r: { beginAtZero: true }
        },
        plugins: { legend: { display: true, position: 'top' } }
      }
    },
    {
      id: 'polar',
      name: 'Área Polar',
      type: 'polarArea',
      description: 'Gráfico de área polar',
      icon: '⭕',
      options: {
        plugins: { legend: { display: true, position: 'right' } }
      }
    }
  ];

  manifest: PluginManifest = {
    id: 'charts',
    name: 'Charts Professional',
    version: '2.0.0',
    author: 'DJ DataForge Team',
    description: 'Sistema profissional de criação e gerenciamento de gráficos',
    permissions: ['read:workbook', 'write:workbook', 'ui:panel', 'ui:toolbar', 'read:storage', 'write:storage'],
    entryPoint: 'charts.js',
  };

  async init(context: PluginContext): Promise<void> {
    this.context = context;

    // Load saved charts from storage
    await this.loadChartsFromStorage();

    // Add toolbar button
    context.ui.addToolbarButton({
      id: 'create-chart',
      label: 'Criar Gráfico',
      icon: '📊',
      tooltip: 'Criar gráfico profissional a partir dos dados selecionados',
      onClick: () => {
        this.openChartWizard();
      },
    });

    // Add panel
    context.ui.addPanel({
      id: 'charts-panel',
      title: '📊 Gráficos',
      render: (container) => {
        this.renderChartsPanel(container);
      },
    });

    // Setup event listeners
    this.setupEventListeners();

    context.ui.showToast('Charts Professional carregado!', 'success');
    logger.info('[ChartsPlugin] Initialized with professional features');
  }

  async dispose(): Promise<void> {
    // Save all charts before disposal
    await this.saveChartsToStorage();

    // Clear all chart instances
    this.chartManager.clearAll();

    logger.info('[ChartsPlugin] Disposed');
  }

  // ============================================================================
  // STORAGE MANAGEMENT
  // ============================================================================

  private async loadChartsFromStorage(): Promise<void> {
    try {
      const storedCharts = await this.context.storage.get('charts') as ChartConfig[] | null;
      if (storedCharts && Array.isArray(storedCharts)) {
        this.chartManager.loadCharts(storedCharts);
        logger.info('[ChartsPlugin] Loaded charts from storage', { count: storedCharts.length });
      }
    } catch (error) {
      logger.error('[ChartsPlugin] Failed to load charts from storage', error);
    }
  }

  private async saveChartsToStorage(): Promise<void> {
    try {
      const charts = this.chartManager.listCharts();
      await this.context.storage.set('charts', charts);
      logger.info('[ChartsPlugin] Saved charts to storage', { count: charts.length });
    } catch (error) {
      logger.error('[ChartsPlugin] Failed to save charts to storage', error);
    }
  }

  // ============================================================================
  // RANGE SELECTION MANAGEMENT
  // ============================================================================

  private startRangeSelection(callback: (range: string) => void, message: string = 'Selecione o intervalo na planilha'): void {
    if (this.isSelectingRange) return;

    this.isSelectingRange = true;
    this.rangeSelectionCallback = callback;

    // Hide wizard modal completely
    const modal = document.getElementById('chart-modal');
    if (modal) {
      (modal as HTMLElement).style.display = 'none';
    }

    // Create selection overlay with instructions
    this.showSelectionOverlay(message);

    // Setup grid selection listener and keyboard shortcuts
    this.setupGridSelectionListener();
    this.setupSelectionKeyboardShortcuts();
  }

  private showSelectionOverlay(message: string): void {
    // Remove existing overlay if any
    if (this.selectionOverlay) {
      this.selectionOverlay.remove();
    }

    const overlay = document.createElement('div');
    overlay.id = 'chart-selection-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 9999;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      gap: 16px;
      animation: slideDown 0.3s ease-out;
      font-family: system-ui, -apple-system, sans-serif;
    `;

    overlay.innerHTML = `
      <style>
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      </style>
      <div style="font-size: 24px; animation: pulse 1.5s infinite;">📍</div>
      <div style="flex: 1;">
        <div style="font-weight: 600; font-size: 16px; margin-bottom: 4px;">${message}</div>
        <div style="font-size: 13px; opacity: 0.9; margin-bottom: 8px;">Clique e arraste no grid para selecionar</div>
        <div id="selection-preview" style="
          font-family: 'Courier New', monospace;
          font-size: 14px;
          font-weight: 600;
          background: rgba(255,255,255,0.2);
          padding: 4px 8px;
          border-radius: 4px;
          display: inline-block;
          opacity: 0;
          transition: opacity 0.3s;
        ">-</div>
        <div style="font-size: 11px; opacity: 0.8; margin-top: 8px;">
          <kbd style="background: rgba(255,255,255,0.3); padding: 2px 6px; border-radius: 3px; font-family: monospace;">Enter</kbd> para confirmar ·
          <kbd style="background: rgba(255,255,255,0.3); padding: 2px 6px; border-radius: 3px; font-family: monospace;">ESC</kbd> para cancelar
        </div>
      </div>
      <button id="btn-confirm-selection" style="
        padding: 8px 16px;
        background: white;
        color: #667eea;
        border: none;
        border-radius: 4px;
        font-weight: 600;
        cursor: pointer;
        transition: transform 0.2s;
      ">✓ Confirmar</button>
      <button id="btn-cancel-selection" style="
        padding: 8px 16px;
        background: rgba(255,255,255,0.2);
        color: white;
        border: 1px solid rgba(255,255,255,0.3);
        border-radius: 4px;
        font-weight: 600;
        cursor: pointer;
        transition: transform 0.2s;
      ">✕ Cancelar</button>
    `;

    document.body.appendChild(overlay);
    this.selectionOverlay = overlay;

    // Hover effects
    const confirmBtn = overlay.querySelector('#btn-confirm-selection');
    const cancelBtn = overlay.querySelector('#btn-cancel-selection');

    confirmBtn?.addEventListener('mouseenter', () => {
      (confirmBtn as HTMLElement).style.transform = 'scale(1.05)';
    });
    confirmBtn?.addEventListener('mouseleave', () => {
      (confirmBtn as HTMLElement).style.transform = 'scale(1)';
    });

    cancelBtn?.addEventListener('mouseenter', () => {
      (cancelBtn as HTMLElement).style.transform = 'scale(1.05)';
    });
    cancelBtn?.addEventListener('mouseleave', () => {
      (cancelBtn as HTMLElement).style.transform = 'scale(1)';
    });

    // Confirm button
    confirmBtn?.addEventListener('click', () => {
      this.confirmRangeSelection();
    });

    // Cancel button
    cancelBtn?.addEventListener('click', () => {
      this.cancelRangeSelection();
    });
  }

  private setupGridSelectionListener(): void {
    // Listen for selection changes to update preview
    const updateSelectionPreview = () => {
      const grid = this.context.kernel.getGrid();
      const sheet = this.context.kernel.workbookManager.getActiveSheet();

      if (!grid || !sheet || !this.isSelectingRange) return;

      const selection = grid.getSelection();
      if (selection) {
        const start = `${sheet.getColumnName(selection.start.col)}${selection.start.row + 1}`;
        const end = `${sheet.getColumnName(selection.end.col)}${selection.end.row + 1}`;
        const rangeString = `${start}:${end}`;

        // Update overlay with current selection
        const overlay = document.getElementById('chart-selection-overlay');
        if (overlay) {
          const previewEl = overlay.querySelector('#selection-preview');
          if (previewEl) {
            previewEl.textContent = rangeString;
            (previewEl as HTMLElement).style.opacity = '1';
          }
        }
      }
    };

    // Poll for selection changes (since we may not have a direct event)
    const intervalId = setInterval(() => {
      if (!this.isSelectingRange) {
        clearInterval(intervalId);
        return;
      }
      updateSelectionPreview();
    }, 100);

    // Store interval ID to clear on end
    (this as any).selectionUpdateInterval = intervalId;
  }

  private setupSelectionKeyboardShortcuts(): void {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!this.isSelectingRange) {
        document.removeEventListener('keydown', handleKeyPress);
        return;
      }

      // Enter to confirm
      if (e.key === 'Enter') {
        e.preventDefault();
        this.confirmRangeSelection();
      }

      // Escape to cancel
      if (e.key === 'Escape') {
        e.preventDefault();
        this.cancelRangeSelection();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    (this as any).selectionKeyboardHandler = handleKeyPress;
  }

  private confirmRangeSelection(): void {
    const grid = this.context.kernel.getGrid();
    const sheet = this.context.kernel.workbookManager.getActiveSheet();

    if (!grid || !sheet) {
      this.context.ui.showToast('Erro ao capturar seleção', 'error');
      this.cancelRangeSelection();
      return;
    }

    const selection = grid.getSelection();
    if (!selection) {
      this.context.ui.showToast('Nenhuma seleção detectada. Selecione células no grid.', 'warning');
      return;
    }

    // Convert selection to range string
    const start = `${sheet.getColumnName(selection.start.col)}${selection.start.row + 1}`;
    const end = `${sheet.getColumnName(selection.end.col)}${selection.end.row + 1}`;
    const rangeString = `${start}:${end}`;

    // Call the callback
    if (this.rangeSelectionCallback) {
      this.rangeSelectionCallback(rangeString);
      this.rangeSelectionCallback = null;
    }

    // End selection mode
    this.endRangeSelection();
  }

  private cancelRangeSelection(): void {
    this.rangeSelectionCallback = null;
    this.endRangeSelection();
  }

  private endRangeSelection(): void {
    this.isSelectingRange = false;

    // Clear update interval
    if ((this as any).selectionUpdateInterval) {
      clearInterval((this as any).selectionUpdateInterval);
      (this as any).selectionUpdateInterval = null;
    }

    // Remove keyboard handler
    if ((this as any).selectionKeyboardHandler) {
      document.removeEventListener('keydown', (this as any).selectionKeyboardHandler);
      (this as any).selectionKeyboardHandler = null;
    }

    // Remove overlay with fade out animation
    if (this.selectionOverlay) {
      this.selectionOverlay.style.animation = 'slideUp 0.3s ease-out';
      setTimeout(() => {
        if (this.selectionOverlay) {
          this.selectionOverlay.remove();
          this.selectionOverlay = null;
        }
      }, 300);
    }

    // Restore wizard modal with fade in
    const modal = document.getElementById('chart-modal');
    if (modal) {
      (modal as HTMLElement).style.display = '';
      (modal as HTMLElement).style.animation = 'fadeIn 0.3s ease-out';
    }

    // Add animations styles if not exists
    if (!document.getElementById('chart-animations-style')) {
      const style = document.createElement('style');
      style.id = 'chart-animations-style';
      style.textContent = `
        @keyframes slideUp {
          from {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
          to {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px);
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  // ============================================================================
  // EVENT MANAGEMENT
  // ============================================================================

  private setupEventListeners(): void {
    // Auto-save charts when data changes
    this.context.events.on('workbook:saved', async () => {
      await this.saveChartsToStorage();
    });
  }

  // ============================================================================
  // UI RENDERING
  // ============================================================================

  private renderChartsPanel(container: HTMLElement): void {
    const charts = this.chartManager.listCharts();

    container.innerHTML = `
      <div class="charts-panel-content" style="padding: 12px;">
        <div style="margin-bottom: 12px;">
          <button class="btn btn-primary" id="btn-new-chart" style="width: 100%; padding: 10px; font-weight: 600;">
            ➕ Novo Gráfico
          </button>
        </div>

        <div style="margin-bottom: 12px;">
          <h3 style="font-size: 14px; font-weight: 600; color: #374151; margin: 0 0 8px 0;">Meus Gráficos (${charts.length})</h3>
        </div>

        <div id="chart-list" class="chart-list" style="max-height: calc(100vh - 200px); overflow-y: auto;">
          ${charts.length === 0 ? '<p style="text-align: center; color: #9ca3af; padding: 20px; font-size: 13px;">Nenhum gráfico criado</p>' : ''}
        </div>
      </div>
    `;

    // Render chart list
    const chartListEl = container.querySelector('#chart-list');
    if (chartListEl) {
      charts.forEach(chart => {
        this.addChartToList(chart, chartListEl as HTMLElement);
      });
    }

    // New chart button
    container.querySelector('#btn-new-chart')?.addEventListener('click', () => {
      this.openChartWizard();
    });
  }

  private addChartToList(chartConfig: ChartConfig, containerEl?: HTMLElement): void {
    const chartList = containerEl || document.getElementById('chart-list');
    if (!chartList) return;

    const chartItem = document.createElement('div');
    chartItem.className = 'chart-item';
    chartItem.dataset.chartId = chartConfig.id;
    chartItem.style.cssText = `
      padding: 10px;
      margin-bottom: 8px;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      transition: all 0.2s;
    `;

    chartItem.innerHTML = `
      <div style="margin-bottom: 8px;">
        <div style="font-weight: 600; color: #111827; font-size: 14px; margin-bottom: 2px;">${chartConfig.name}</div>
        <div style="font-size: 11px; color: #6b7280;">${this.getChartTypeLabel(chartConfig.type)}</div>
      </div>
      <div style="display: flex; gap: 4px;">
        <button class="btn-expand-chart" style="flex: 1; padding: 6px; border: 1px solid #10b981; background: white; color: #10b981; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 4px;" title="Expandir em nova Sheet">
          ⛶ Expandir
        </button>
        <button class="btn-edit-chart" style="padding: 6px 10px; border: none; background: #3b82f6; color: white; border-radius: 4px; cursor: pointer; font-size: 14px;" title="Editar">✏️</button>
        <button class="btn-export-chart" style="padding: 6px 10px; border: none; background: #8b5cf6; color: white; border-radius: 4px; cursor: pointer; font-size: 14px;" title="Exportar PNG">💾</button>
        <button class="btn-delete-chart" style="padding: 6px 10px; border: none; background: #ef4444; color: white; border-radius: 4px; cursor: pointer; font-size: 14px;" title="Excluir">🗑️</button>
      </div>
    `;

    // Hover effect
    chartItem.addEventListener('mouseenter', () => {
      chartItem.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
      chartItem.style.borderColor = '#3b82f6';
      chartItem.style.transform = 'translateY(-2px)';
    });
    chartItem.addEventListener('mouseleave', () => {
      chartItem.style.boxShadow = 'none';
      chartItem.style.borderColor = '#e5e7eb';
      chartItem.style.transform = 'translateY(0)';
    });

    // Expand button - Creates new sheet with chart
    chartItem.querySelector('.btn-expand-chart')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      await this.expandChartToSheet(chartConfig);
    });

    // Edit button
    chartItem.querySelector('.btn-edit-chart')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openChartWizard(chartConfig);
    });

    // Export button
    chartItem.querySelector('.btn-export-chart')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      await this.exportChart(chartConfig.id);
    });

    // Delete button
    chartItem.querySelector('.btn-delete-chart')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm(`Deseja realmente excluir o gráfico "${chartConfig.name}"?`)) {
        this.chartManager.deleteChart(chartConfig.id);
        chartItem.remove();
        await this.saveChartsToStorage();

        this.context.ui.showToast('Gráfico excluído com sucesso!', 'success');

        // Update panel header count
        const panelContent = document.querySelector('.charts-panel-content');
        if (panelContent) {
          this.renderChartsPanel(panelContent as HTMLElement);
        }
      }
    });

    chartList.appendChild(chartItem);
  }

  private getChartTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      'bar': 'Barras/Colunas',
      'line': 'Linha',
      'pie': 'Pizza',
      'doughnut': 'Rosca',
      'radar': 'Radar',
      'polarArea': 'Área Polar'
    };
    return labels[type] || type;
  }

  private async expandChartToSheet(chartConfig: ChartConfig): Promise<void> {
    try {
      const workbook = this.context.kernel.workbookManager.getActiveWorkbook();
      if (!workbook) {
        this.context.ui.showToast('Nenhum workbook ativo', 'error');
        return;
      }

      // Create new sheet for chart
      const sheetName = `📊 ${chartConfig.name}`;
      const chartSheet = workbook.addSheet(sheetName);

      // Create a full-page chart visualization
      const chartContainer = document.createElement('div');
      chartContainer.id = `chart-sheet-${chartConfig.id}`;
      chartContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: white;
        z-index: 9999;
        display: flex;
        flex-direction: column;
      `;

      chartContainer.innerHTML = `
        <div style="padding: 20px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; background: #f9fafb;">
          <div>
            <h1 style="margin: 0; font-size: 24px; color: #111827;">${chartConfig.name}</h1>
            <p style="margin: 4px 0 0 0; font-size: 14px; color: #6b7280;">Sheet: ${sheetName} • Tipo: ${this.getChartTypeLabel(chartConfig.type)}</p>
          </div>
          <div style="display: flex; gap: 8px;">
            <button id="btn-refresh-chart" class="btn" style="padding: 8px 16px; border: 1px solid #d1d5db; background: white; border-radius: 4px; cursor: pointer;">
              🔄 Atualizar
            </button>
            <button id="btn-export-chart-full" class="btn" style="padding: 8px 16px; border: 1px solid #8b5cf6; background: #8b5cf6; color: white; border-radius: 4px; cursor: pointer;">
              💾 Exportar PNG
            </button>
            <button id="btn-close-chart-sheet" class="btn" style="padding: 8px 16px; border: 1px solid #ef4444; background: #ef4444; color: white; border-radius: 4px; cursor: pointer;">
              ✕ Fechar
            </button>
          </div>
        </div>
        <div style="flex: 1; padding: 20px; overflow: auto;">
          <div style="width: 100%; height: 100%; min-height: 600px;">
            <canvas id="chart-fullscreen-canvas"></canvas>
          </div>
        </div>
      `;

      document.body.appendChild(chartContainer);

      const canvas = document.getElementById('chart-fullscreen-canvas') as HTMLCanvasElement;
      if (canvas) {
        this.generateChart(chartConfig, canvas);
      }

      // Close button
      document.getElementById('btn-close-chart-sheet')?.addEventListener('click', () => {
        chartContainer.remove();
        // Optionally delete the sheet
        const shouldDeleteSheet = confirm('Deseja remover a sheet do gráfico também?');
        if (shouldDeleteSheet) {
          workbook.deleteSheet(chartSheet.id);
          this.context.ui.showToast('Sheet do gráfico removida', 'success');
        }
      });

      // Refresh button
      document.getElementById('btn-refresh-chart')?.addEventListener('click', () => {
        const canvas = document.getElementById('chart-fullscreen-canvas') as HTMLCanvasElement;
        if (canvas) {
          this.generateChart(chartConfig, canvas);
        }
        this.context.ui.showToast('Gráfico atualizado!', 'success');
      });

      // Export button
      document.getElementById('btn-export-chart-full')?.addEventListener('click', async () => {
        await this.exportChart(chartConfig.id);
      });

      // Switch to the new sheet
      workbook.setActiveSheet(chartSheet.id);

      this.context.ui.showToast(`Gráfico expandido em nova sheet: ${sheetName}`, 'success');
      logger.info('[ChartsPlugin] Chart expanded to sheet', { chartId: chartConfig.id, sheetName });
    } catch (error) {
      logger.error('[ChartsPlugin] Failed to expand chart to sheet', error);
      this.context.ui.showToast('Erro ao expandir gráfico', 'error');
    }
  }

  // ============================================================================
  // CHART WIZARD (PROFESSIONAL MODAL)
  // ============================================================================

  private openChartWizard(editChart?: ChartConfig): void {
    const isEditing = !!editChart;
    const sheet = this.context.kernel.workbookManager.getActiveSheet();

    if (!sheet && !isEditing) {
      this.context.ui.showToast('Nenhuma planilha ativa para criar um gráfico', 'warning');
      return;
    }

    const html = `
      <div class="modal-overlay" id="chart-modal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;">
        <div class="modal chart-wizard" id="chart-wizard-modal" style="background: white; border-radius: 8px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); max-width: 900px; width: 90%; max-height: 90vh; overflow: hidden; display: flex; flex-direction: column;">
          <!-- Header -->
          <div style="padding: 20px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; cursor: move;" id="modal-header">
            <h2 style="margin: 0; color: #111827; font-size: 20px;">${isEditing ? '✏️ Editar Gráfico' : '📊 Assistente de Criação de Gráfico'}</h2>
            <button id="btn-close-wizard" style="border: none; background: none; font-size: 24px; cursor: pointer; color: #6b7280; padding: 0; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 4px;" title="Fechar">×</button>
          </div>

          <!-- Tabs -->
          <div style="display: flex; border-bottom: 1px solid #e5e7eb; background: #f9fafb;">
            <button class="wizard-tab active" data-tab="template" style="flex: 1; padding: 12px 20px; border: none; background: none; cursor: pointer; border-bottom: 2px solid #3b82f6; color: #3b82f6; font-weight: 500;">
              1. Modelo
            </button>
            <button class="wizard-tab" data-tab="data" style="flex: 1; padding: 12px 20px; border: none; background: none; cursor: pointer; border-bottom: 2px solid transparent; color: #6b7280;">
              2. Dados
            </button>
            <button class="wizard-tab" data-tab="customize" style="flex: 1; padding: 12px 20px; border: none; background: none; cursor: pointer; border-bottom: 2px solid transparent; color: #6b7280;">
              3. Personalizar
            </button>
            <button class="wizard-tab" data-tab="preview" style="flex: 1; padding: 12px 20px; border: none; background: none; cursor: pointer; border-bottom: 2px solid transparent; color: #6b7280;">
              4. Pré-visualizar
            </button>
          </div>

          <!-- Content -->
          <div style="flex: 1; overflow-y: auto; padding: 20px;" id="wizard-content">
            ${this.renderTemplateTab(editChart)}
          </div>

          <!-- Footer -->
          <div style="padding: 16px 20px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; background: #f9fafb;">
            <button id="btn-wizard-cancel" class="btn" style="padding: 8px 16px; border: 1px solid #d1d5db; background: white; border-radius: 4px; cursor: pointer;">Cancelar</button>
            <div style="display: flex; gap: 8px;">
              <button id="btn-wizard-prev" class="btn" style="padding: 8px 16px; border: 1px solid #d1d5db; background: white; border-radius: 4px; cursor: pointer; display: none;">← Anterior</button>
              <button id="btn-wizard-next" class="btn btn-primary" style="padding: 8px 16px; border: none; background: #3b82f6; color: white; border-radius: 4px; cursor: pointer;">Próximo →</button>
              <button id="btn-wizard-finish" class="btn btn-primary" style="padding: 8px 16px; border: none; background: #10b981; color: white; border-radius: 4px; cursor: pointer; display: none;">${isEditing ? '✓ Salvar' : '✓ Criar Gráfico'}</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);

    // Make modal draggable
    this.makeModalDraggable();

    // Setup wizard navigation
    this.setupWizardNavigation(editChart);

    // Close button
    document.getElementById('btn-close-wizard')?.addEventListener('click', () => {
      this.closeChartWizard();
    });

    // Cancel button
    document.getElementById('btn-wizard-cancel')?.addEventListener('click', () => {
      this.closeChartWizard();
    });

    // Click outside to close
    document.getElementById('chart-modal')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        this.closeChartWizard();
      }
    });

    // ESC to close
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.closeChartWizard();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  }

  private makeModalDraggable(): void {
    const modal = document.getElementById('chart-wizard-modal');
    const header = document.getElementById('modal-header');

    if (!modal || !header) return;

    let isDragging = false;
    let currentX = 0;
    let currentY = 0;
    let initialX = 0;
    let initialY = 0;

    header.addEventListener('mousedown', (e) => {
      isDragging = true;
      initialX = e.clientX - currentX;
      initialY = e.clientY - currentY;
      header.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;
        modal.style.transform = `translate(${currentX}px, ${currentY}px)`;
      }
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
      header.style.cursor = 'move';
    });
  }

  private setupWizardNavigation(editChart?: ChartConfig): void {
    const tabs = ['template', 'data', 'customize', 'preview'];
    let currentTab = 0;

    // Find template ID from editChart if exists
    let initialTemplateId = 'column-basic'; // default
    if (editChart) {
      const foundTemplate = this.TEMPLATES.find(t =>
        t.type === editChart.type &&
        JSON.stringify(t.options.indexAxis) === JSON.stringify(editChart.options.indexAxis)
      );
      initialTemplateId = foundTemplate?.id || 'column-basic';
    }

    const wizardData = {
      selectedTemplateId: initialTemplateId,
      chartName: editChart?.name || '',
      labelsRange: editChart?.labelsRange || '',
      datasets: editChart?.datasets || [],
      theme: editChart?.options?.theme || 'default',
      showLegend: editChart?.options?.showLegend !== false,
      legendPosition: (editChart?.options?.legendPosition || 'top') as 'top' | 'bottom' | 'left' | 'right',
      showGrid: editChart?.options?.showGrid !== false,
      showDataLabels: editChart?.options?.showDataLabels || false,
      customOptions: editChart?.options || {}
    };

    // Capture current tab data before navigating away
    const captureCurrentTabData = () => {
      const currentTabName = tabs[currentTab];

      switch (currentTabName) {
        case 'template':
          // Template selection - save template ID, not just type
          const selectedCard = document.querySelector('.template-card.selected');
          if (selectedCard) {
            wizardData.selectedTemplateId = (selectedCard as HTMLElement).dataset.template || 'column-basic';
          }
          break;

        case 'data':
          // Chart name
          const nameInput = document.getElementById('chart-name') as HTMLInputElement;
          if (nameInput) {
            wizardData.chartName = nameInput.value;
          }

          // Labels range
          const labelsInput = document.getElementById('chart-labels-range') as HTMLInputElement;
          if (labelsInput) {
            wizardData.labelsRange = labelsInput.value;
          }

          // Datasets - CRITICAL: Capture all datasets
          const datasetsContainer = document.getElementById('chart-datasets-container');
          if (datasetsContainer) {
            const datasets: any[] = [];
            datasetsContainer.querySelectorAll('[id^="dataset-"]').forEach(div => {
              const rangeInput = div.querySelector('.dataset-range') as HTMLInputElement;
              const labelInput = div.querySelector('.dataset-label') as HTMLInputElement;
              const colorInput = div.querySelector('.dataset-color') as HTMLInputElement;

              // Include dataset even if fields are empty (to preserve structure)
              datasets.push({
                range: rangeInput?.value || '',
                label: labelInput?.value || '',
                color: colorInput?.value || '#3b82f6'
              });
            });
            wizardData.datasets = datasets;
            logger.debug('[ChartsPlugin] Captured datasets from data tab', { count: datasets.length, datasets });
          }
          break;

        case 'customize':
          // Theme
          const themeSelect = document.getElementById('chart-theme') as HTMLSelectElement;
          if (themeSelect) {
            wizardData.theme = themeSelect.value;
          }

          // Show legend
          const showLegendCheckbox = document.getElementById('chart-show-legend') as HTMLInputElement;
          if (showLegendCheckbox) {
            wizardData.showLegend = showLegendCheckbox.checked;
          }

          // Legend position
          const legendPositionSelect = document.getElementById('legend-position') as HTMLSelectElement;
          if (legendPositionSelect) {
            wizardData.legendPosition = legendPositionSelect.value as any;
          }

          // Show grid
          const showGridCheckbox = document.getElementById('chart-show-grid') as HTMLInputElement;
          if (showGridCheckbox) {
            wizardData.showGrid = showGridCheckbox.checked;
          }

          // Show data labels
          const showDataLabelsCheckbox = document.getElementById('chart-show-data-labels') as HTMLInputElement;
          if (showDataLabelsCheckbox) {
            wizardData.showDataLabels = showDataLabelsCheckbox.checked;
          }

          // Chart title
          const titleInput = document.getElementById('chart-title') as HTMLInputElement;
          if (titleInput) {
            wizardData.customOptions.title = titleInput.value;
          }
          break;
      }
    };

    const updateNavigation = () => {
      document.querySelectorAll('.wizard-tab').forEach((tab, index) => {
        if (index === currentTab) {
          tab.classList.add('active');
          (tab as HTMLElement).style.borderBottomColor = '#3b82f6';
          (tab as HTMLElement).style.color = '#3b82f6';
          (tab as HTMLElement).style.fontWeight = '500';
        } else {
          tab.classList.remove('active');
          (tab as HTMLElement).style.borderBottomColor = 'transparent';
          (tab as HTMLElement).style.color = '#6b7280';
          (tab as HTMLElement).style.fontWeight = '400';
        }
      });

      const prevBtn = document.getElementById('btn-wizard-prev');
      const nextBtn = document.getElementById('btn-wizard-next');
      const finishBtn = document.getElementById('btn-wizard-finish');

      if (prevBtn) prevBtn.style.display = currentTab > 0 ? 'block' : 'none';
      if (nextBtn) nextBtn.style.display = currentTab < tabs.length - 1 ? 'block' : 'none';
      if (finishBtn) finishBtn.style.display = currentTab === tabs.length - 1 ? 'block' : 'none';
    };

    const renderTab = (tabName: string) => {
      const content = document.getElementById('wizard-content');
      if (!content) return;

      switch (tabName) {
        case 'template':
          content.innerHTML = this.renderTemplateTab(wizardData);
          this.setupTemplateTabHandlers(wizardData);
          break;
        case 'data':
          content.innerHTML = this.renderDataTab(wizardData);
          this.setupDataTabHandlers(wizardData);
          break;
        case 'customize':
          content.innerHTML = this.renderCustomizeTab(wizardData);
          this.setupCustomizeTabHandlers(wizardData);
          break;
        case 'preview':
          content.innerHTML = this.renderPreviewTab(wizardData);
          this.setupPreviewTabHandlers(wizardData);
          break;
      }
    };

    // Tab clicks
    document.querySelectorAll('.wizard-tab').forEach((tab, index) => {
      tab.addEventListener('click', () => {
        // Capture data before changing tab
        captureCurrentTabData();
        logger.debug('[ChartsPlugin] Tab changed', { from: tabs[currentTab], to: tabs[index], wizardData });

        currentTab = index;
        updateNavigation();
        renderTab(tabs[currentTab]);
      });
    });

    // Navigation buttons
    document.getElementById('btn-wizard-prev')?.addEventListener('click', () => {
      if (currentTab > 0) {
        // Capture data before going back
        captureCurrentTabData();
        logger.debug('[ChartsPlugin] Going back', { from: tabs[currentTab], to: tabs[currentTab - 1], wizardData });

        currentTab--;
        updateNavigation();
        renderTab(tabs[currentTab]);
      }
    });

    document.getElementById('btn-wizard-next')?.addEventListener('click', () => {
      if (currentTab < tabs.length - 1) {
        // Capture data before going forward
        captureCurrentTabData();
        logger.debug('[ChartsPlugin] Going forward', { from: tabs[currentTab], to: tabs[currentTab + 1], wizardData });

        currentTab++;
        updateNavigation();
        renderTab(tabs[currentTab]);
      }
    });

    document.getElementById('btn-wizard-finish')?.addEventListener('click', async () => {
      // Capture data from current tab before creating/updating
      captureCurrentTabData();

      await this.createOrUpdateChartFromWizard(wizardData, editChart);
    });

    updateNavigation();
  }

  // ============================================================================
  // WIZARD TAB RENDERERS
  // ============================================================================

  private renderTemplateTab(wizardData?: any): string {
    // Get currently selected template ID
    const selectedTemplateId = wizardData?.selectedTemplateId || 'column-basic';

    return `
      <div>
        <h3 style="margin-top: 0; color: #111827;">Escolha um modelo de gráfico</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; margin-top: 20px;">
          ${this.TEMPLATES.map(template => `
            <div class="template-card ${template.id === selectedTemplateId ? 'selected' : ''}" data-template="${template.id}" data-type="${template.type}" style="
              border: 2px solid ${template.id === selectedTemplateId ? '#3b82f6' : '#e5e7eb'};
              border-radius: 8px;
              padding: 16px;
              cursor: pointer;
              transition: all 0.2s;
              background: ${template.id === selectedTemplateId ? '#eff6ff' : 'white'};
            ">
              <div style="font-size: 32px; text-align: center; margin-bottom: 8px;">${template.icon}</div>
              <div style="font-weight: 500; color: #111827; text-align: center; margin-bottom: 4px;">${template.name}</div>
              <div style="font-size: 12px; color: #6b7280; text-align: center;">${template.description}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  private setupTemplateTabHandlers(wizardData: any): void {
    document.querySelectorAll('.template-card').forEach(card => {
      card.addEventListener('click', () => {
        // Remove previous selection
        document.querySelectorAll('.template-card').forEach(c => {
          (c as HTMLElement).style.borderColor = '#e5e7eb';
          (c as HTMLElement).style.background = 'white';
          c.classList.remove('selected');
        });

        // Add selection
        (card as HTMLElement).style.borderColor = '#3b82f6';
        (card as HTMLElement).style.background = '#eff6ff';
        card.classList.add('selected');

        const selectedTemplateId = (card as HTMLElement).dataset.template || 'column-basic';
        wizardData.selectedTemplateId = selectedTemplateId;

        // Find template to log its details
        const template = this.TEMPLATES.find(t => t.id === selectedTemplateId);
        logger.debug('[ChartsPlugin] Template selected', {
          templateId: selectedTemplateId,
          type: template?.type,
          indexAxis: template?.options.indexAxis
        });
      });

      card.addEventListener('mouseenter', () => {
        if (!card.classList.contains('selected')) {
          (card as HTMLElement).style.borderColor = '#93c5fd';
          (card as HTMLElement).style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.1)';
        }
      });

      card.addEventListener('mouseleave', () => {
        if (!card.classList.contains('selected')) {
          (card as HTMLElement).style.borderColor = '#e5e7eb';
          (card as HTMLElement).style.boxShadow = 'none';
        }
      });
    });
  }

  private renderDataTab(wizardData: any): string {
    return `
      <div>
        <h3 style="margin-top: 0; color: #111827;">Configure os dados do gráfico</h3>

        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 8px; color: #374151; font-weight: 500;">Nome do Gráfico *</label>
          <input type="text" id="chart-name" class="form-control" placeholder="ex: Vendas Mensais 2024" value="${wizardData.chartName}" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 4px;">
        </div>

        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 8px; color: #374151; font-weight: 500;">Eixo de Rótulos (Labels) *</label>
          <div style="display: flex; gap: 8px;">
            <input type="text" id="chart-labels-range" class="form-control" placeholder="ex: A2:A12" value="${wizardData.labelsRange}" style="flex: 1; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 4px;">
            <button id="btn-select-labels-range" class="btn" style="padding: 8px 16px; border: 1px solid #d1d5db; background: white; border-radius: 4px; cursor: pointer; white-space: nowrap;">📍 Selecionar na Planilha</button>
          </div>
          <small style="color: #6b7280; display: block; margin-top: 4px;">Ex: Nomes dos meses, categorias, produtos</small>
        </div>

        <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
          <label style="color: #374151; font-weight: 500;">Séries de Dados *</label>
          <button id="btn-add-dataset" class="btn" style="padding: 6px 12px; border: 1px solid #d1d5db; background: white; border-radius: 4px; cursor: pointer;">➕ Adicionar Série</button>
        </div>

        <div id="chart-datasets-container" style="margin-bottom: 20px;">
          ${wizardData.datasets.length === 0 ? '<p style="text-align: center; color: #9ca3af; padding: 20px; border: 1px dashed #d1d5db; border-radius: 4px;">Nenhuma série de dados adicionada</p>' : ''}
        </div>

        <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px; border-radius: 4px; margin-top: 20px;">
          <strong style="color: #1e40af;">💡 Dica:</strong>
          <p style="margin: 4px 0 0 0; color: #1e3a8a; font-size: 14px;">Use "Selecionar na Planilha" e selecione os dados diretamente com o mouse. Mais rápido e sem erros!</p>
        </div>
      </div>
    `;
  }

  private setupDataTabHandlers(wizardData: any): void {
    // Chart name
    const nameInput = document.getElementById('chart-name') as HTMLInputElement;
    if (nameInput) {
      nameInput.addEventListener('input', () => {
        wizardData.chartName = nameInput.value;
      });
    }

    // Labels range
    const labelsInput = document.getElementById('chart-labels-range') as HTMLInputElement;
    if (labelsInput) {
      labelsInput.addEventListener('input', () => {
        wizardData.labelsRange = labelsInput.value;
      });
    }

    // Select labels range button
    document.getElementById('btn-select-labels-range')?.addEventListener('click', () => {
      this.startRangeSelection((range: string) => {
        if (labelsInput) {
          labelsInput.value = range;
          wizardData.labelsRange = range;
        }
      }, 'Selecione o intervalo de rótulos (ex: A1:A10)');
    });

    // Add dataset button
    document.getElementById('btn-add-dataset')?.addEventListener('click', () => {
      this.addDatasetInput(wizardData);
    });

    // Render existing datasets
    logger.debug('[ChartsPlugin] Rendering datasets in data tab', { count: wizardData.datasets.length, datasets: wizardData.datasets });
    if (wizardData.datasets.length > 0) {
      wizardData.datasets.forEach((dataset: any) => {
        this.addDatasetInput(wizardData, dataset);
      });
    }
  }

  private addDatasetInput(wizardData: any, existingData?: any): void {
    const container = document.getElementById('chart-datasets-container');
    if (!container) return;

    // Remove empty message if exists
    const emptyMsg = container.querySelector('p');
    if (emptyMsg) emptyMsg.remove();

    const datasetId = `dataset-${nanoid(5)}`;
    const datasetDiv = document.createElement('div');
    datasetDiv.id = datasetId;
    datasetDiv.style.cssText = 'background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; padding: 12px; margin-bottom: 12px;';

    datasetDiv.innerHTML = `
      <div style="display: flex; gap: 8px; margin-bottom: 8px;">
        <div style="flex: 1;">
          <label style="display: block; margin-bottom: 4px; color: #374151; font-size: 12px;">Intervalo de Dados</label>
          <input type="text" class="dataset-range" placeholder="ex: B2:B12" value="${existingData?.range || ''}" style="width: 100%; padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px;">
        </div>
        <div style="flex: 1;">
          <label style="display: block; margin-bottom: 4px; color: #374151; font-size: 12px;">Nome da Série</label>
          <input type="text" class="dataset-label" placeholder="ex: Vendas 2024" value="${existingData?.label || ''}" style="width: 100%; padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px;">
        </div>
        <div style="width: 80px;">
          <label style="display: block; margin-bottom: 4px; color: #374151; font-size: 12px;">Cor</label>
          <input type="color" class="dataset-color" value="${existingData?.color || '#3b82f6'}" style="width: 100%; height: 32px; border: 1px solid #d1d5db; border-radius: 4px; cursor: pointer;">
        </div>
      </div>
      <div style="display: flex; gap: 8px;">
        <button class="btn-select-range" style="flex: 1; padding: 6px 12px; border: 1px solid #d1d5db; background: white; border-radius: 4px; cursor: pointer; font-size: 13px;">📍 Selecionar Intervalo</button>
        <button class="btn-remove-dataset" style="padding: 6px 12px; border: 1px solid #fca5a5; background: #fef2f2; color: #dc2626; border-radius: 4px; cursor: pointer; font-size: 13px;">🗑️ Remover</button>
      </div>
    `;

    container.appendChild(datasetDiv);

    // Select range button
    datasetDiv.querySelector('.btn-select-range')?.addEventListener('click', () => {
      const rangeInput = datasetDiv.querySelector('.dataset-range') as HTMLInputElement;
      this.startRangeSelection((range: string) => {
        if (rangeInput) {
          rangeInput.value = range;
          this.updateWizardDatasets(wizardData);
        }
      }, 'Selecione o intervalo de dados para a série (ex: B1:B10)');
    });

    // Remove button
    datasetDiv.querySelector('.btn-remove-dataset')?.addEventListener('click', () => {
      datasetDiv.remove();
      this.updateWizardDatasets(wizardData);

      // Show empty message if no datasets
      const remaining = container.querySelectorAll('[id^="dataset-"]');
      if (remaining.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #9ca3af; padding: 20px; border: 1px dashed #d1d5db; border-radius: 4px;">Nenhuma série de dados adicionada</p>';
      }
    });

    // Update on input
    datasetDiv.querySelectorAll('input').forEach(input => {
      input.addEventListener('input', () => {
        this.updateWizardDatasets(wizardData);
      });
    });

    this.updateWizardDatasets(wizardData);
  }

  private updateWizardDatasets(wizardData: any): void {
    const container = document.getElementById('chart-datasets-container');
    if (!container) return;

    const datasets: any[] = [];
    container.querySelectorAll('[id^="dataset-"]').forEach(div => {
      const range = (div.querySelector('.dataset-range') as HTMLInputElement)?.value || '';
      const label = (div.querySelector('.dataset-label') as HTMLInputElement)?.value || '';
      const color = (div.querySelector('.dataset-color') as HTMLInputElement)?.value || '#3b82f6';

      if (range && label) {
        datasets.push({ range, label, color });
      }
    });

    wizardData.datasets = datasets;
  }

  private renderCustomizeTab(wizardData: any): string {
    return `
      <div>
        <h3 style="margin-top: 0; color: #111827;">Personalize o visual do gráfico</h3>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
          <!-- Left Column -->
          <div>
            <div style="margin-bottom: 20px;">
              <label style="display: block; margin-bottom: 8px; color: #374151; font-weight: 500;">Tema de Cores</label>
              <select id="chart-theme" class="form-control" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 4px;">
                ${this.THEMES.map(theme => `
                  <option value="${theme.id}" ${wizardData.theme === theme.id ? 'selected' : ''}>${theme.name}</option>
                `).join('')}
              </select>
              <div id="theme-preview" style="margin-top: 8px; display: flex; gap: 4px; height: 24px;">
                ${this.THEMES[0].colors.map(color => `
                  <div style="flex: 1; background: ${color}; border-radius: 2px;"></div>
                `).join('')}
              </div>
            </div>

            <div style="margin-bottom: 20px;">
              <label style="display: flex; align-items: center; cursor: pointer;">
                <input type="checkbox" id="chart-show-legend" ${wizardData.showLegend ? 'checked' : ''} style="margin-right: 8px; width: 18px; height: 18px; cursor: pointer;">
                <span style="color: #374151; font-weight: 500;">Exibir Legenda</span>
              </label>
            </div>

            <div style="margin-bottom: 20px;" id="legend-position-container" ${!wizardData.showLegend ? 'style="display: none;"' : ''}>
              <label style="display: block; margin-bottom: 8px; color: #374151; font-weight: 500;">Posição da Legenda</label>
              <select id="legend-position" class="form-control" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 4px;">
                <option value="top" ${wizardData.legendPosition === 'top' ? 'selected' : ''}>Acima</option>
                <option value="bottom" ${wizardData.legendPosition === 'bottom' ? 'selected' : ''}>Abaixo</option>
                <option value="left" ${wizardData.legendPosition === 'left' ? 'selected' : ''}>Esquerda</option>
                <option value="right" ${wizardData.legendPosition === 'right' ? 'selected' : ''}>Direita</option>
              </select>
            </div>
          </div>

          <!-- Right Column -->
          <div>
            <div style="margin-bottom: 20px;">
              <label style="display: flex; align-items: center; cursor: pointer;">
                <input type="checkbox" id="chart-show-grid" ${wizardData.showGrid ? 'checked' : ''} style="margin-right: 8px; width: 18px; height: 18px; cursor: pointer;">
                <span style="color: #374151; font-weight: 500;">Exibir Linhas de Grade</span>
              </label>
            </div>

            <div style="margin-bottom: 20px;">
              <label style="display: flex; align-items: center; cursor: pointer;">
                <input type="checkbox" id="chart-show-data-labels" ${wizardData.showDataLabels ? 'checked' : ''} style="margin-right: 8px; width: 18px; height: 18px; cursor: pointer;">
                <span style="color: #374151; font-weight: 500;">Exibir Valores nos Pontos</span>
              </label>
            </div>

            <div style="margin-bottom: 20px;">
              <label style="display: block; margin-bottom: 8px; color: #374151; font-weight: 500;">Título do Gráfico (opcional)</label>
              <input type="text" id="chart-title" class="form-control" placeholder="Deixe em branco para não exibir" value="${wizardData.customOptions.title || ''}" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 4px;">
            </div>
          </div>
        </div>

        <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 12px; border-radius: 4px; margin-top: 20px;">
          <strong style="color: #065f46;">✨ Recursos Profissionais</strong>
          <p style="margin: 4px 0 0 0; color: #047857; font-size: 14px;">Temas de cores pré-definidos, legendas customizáveis e controles avançados de visualização!</p>
        </div>
      </div>
    `;
  }

  private setupCustomizeTabHandlers(wizardData: any): void {
    // Theme selector
    const themeSelect = document.getElementById('chart-theme') as HTMLSelectElement;
    if (themeSelect) {
      themeSelect.addEventListener('change', () => {
        wizardData.theme = themeSelect.value;

        // Update theme preview
        const theme = this.THEMES.find(t => t.id === themeSelect.value);
        if (theme) {
          const preview = document.getElementById('theme-preview');
          if (preview) {
            preview.innerHTML = theme.colors.map(color =>
              `<div style="flex: 1; background: ${color}; border-radius: 2px;"></div>`
            ).join('');
          }
        }
      });
    }

    // Show legend checkbox
    const showLegendCheckbox = document.getElementById('chart-show-legend') as HTMLInputElement;
    const legendPositionContainer = document.getElementById('legend-position-container');
    if (showLegendCheckbox) {
      showLegendCheckbox.addEventListener('change', () => {
        wizardData.showLegend = showLegendCheckbox.checked;
        if (legendPositionContainer) {
          legendPositionContainer.style.display = showLegendCheckbox.checked ? 'block' : 'none';
        }
      });
    }

    // Legend position
    const legendPositionSelect = document.getElementById('legend-position') as HTMLSelectElement;
    if (legendPositionSelect) {
      legendPositionSelect.addEventListener('change', () => {
        wizardData.legendPosition = legendPositionSelect.value;
      });
    }

    // Show grid checkbox
    const showGridCheckbox = document.getElementById('chart-show-grid') as HTMLInputElement;
    if (showGridCheckbox) {
      showGridCheckbox.addEventListener('change', () => {
        wizardData.showGrid = showGridCheckbox.checked;
      });
    }

    // Show data labels checkbox
    const showDataLabelsCheckbox = document.getElementById('chart-show-data-labels') as HTMLInputElement;
    if (showDataLabelsCheckbox) {
      showDataLabelsCheckbox.addEventListener('change', () => {
        wizardData.showDataLabels = showDataLabelsCheckbox.checked;
      });
    }

    // Chart title
    const titleInput = document.getElementById('chart-title') as HTMLInputElement;
    if (titleInput) {
      titleInput.addEventListener('input', () => {
        wizardData.customOptions.title = titleInput.value;
      });
    }
  }

  private renderPreviewTab(wizardData: any): string {
    return `
      <div>
        <h3 style="margin-top: 0; color: #111827;">Pré-visualização do Gráfico</h3>

        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-top: 20px;">
          <div id="preview-chart-container" style="height: 400px; position: relative;">
            <canvas id="wizard-preview-canvas"></canvas>
          </div>
        </div>

        <div style="margin-top: 20px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px;">
          <h4 style="margin: 0 0 12px 0; color: #111827;">Resumo da Configuração</h4>
          <div style="display: grid; grid-template-columns: 150px 1fr; gap: 8px; font-size: 14px;">
            <div style="color: #6b7280;">Nome:</div>
            <div style="color: #111827; font-weight: 500;">${wizardData.chartName || '(não definido)'}</div>

            <div style="color: #6b7280;">Tipo:</div>
            <div style="color: #111827;">${this.getChartTypeLabel(wizardData.selectedTemplate)}</div>

            <div style="color: #6b7280;">Rótulos:</div>
            <div style="color: #111827;">${wizardData.labelsRange || '(não definido)'}</div>

            <div style="color: #6b7280;">Séries de Dados:</div>
            <div style="color: #111827;">${wizardData.datasets.length} série(s)</div>

            <div style="color: #6b7280;">Tema:</div>
            <div style="color: #111827;">${this.THEMES.find(t => t.id === wizardData.theme)?.name || 'Padrão'}</div>
          </div>
        </div>
      </div>
    `;
  }

  private setupPreviewTabHandlers(wizardData: any): void {
    setTimeout(() => {
      const canvas = document.getElementById('wizard-preview-canvas') as HTMLCanvasElement;
      if (canvas) {
        this.renderWizardPreview(wizardData, canvas);
      }
    }, 100);
  }

  private renderWizardPreview(wizardData: any, canvas: HTMLCanvasElement): void {
    const sheet = this.context.kernel.workbookManager.getActiveSheet();
    if (!sheet) {
      canvas.parentElement!.innerHTML = '<p style="text-align: center; color: #ef4444; padding: 40px;">Erro: Nenhuma planilha ativa</p>';
      return;
    }

    if (!wizardData.labelsRange || wizardData.datasets.length === 0) {
      canvas.parentElement!.innerHTML = '<p style="text-align: center; color: #f59e0b; padding: 40px;">Configure os dados na aba "Dados" para visualizar o gráfico</p>';
      return;
    }

    // Find the selected template
    const template = this.TEMPLATES.find(t => t.id === wizardData.selectedTemplateId);
    if (!template) {
      canvas.parentElement!.innerHTML = '<p style="text-align: center; color: #ef4444; padding: 40px;">Template não encontrado</p>';
      return;
    }

    const chartConfig: ChartConfig = {
      id: nanoid(),
      name: wizardData.chartName,
      type: template.type,
      templateId: template.id,
      sheetId: sheet.id,
      labelsRange: wizardData.labelsRange,
      datasets: wizardData.datasets,
      options: {
        title: wizardData.customOptions.title,
        showLegend: wizardData.showLegend,
        legendPosition: wizardData.legendPosition,
        showGrid: wizardData.showGrid,
        showDataLabels: wizardData.showDataLabels,
        theme: wizardData.theme,
        indexAxis: template.options.indexAxis as 'x' | 'y' | undefined
      }
    };

    this.generateChart(chartConfig, canvas);
  }

  private async createOrUpdateChartFromWizard(wizardData: any, editChart?: ChartConfig): Promise<void> {
    // Find the selected template
    const template = this.TEMPLATES.find(t => t.id === wizardData.selectedTemplateId);
    if (!template) {
      this.context.ui.showToast('Template inválido selecionado', 'error');
      return;
    }

    // Log wizard data for debugging
    logger.debug('[ChartsPlugin] Creating/Updating chart from wizard', {
      chartName: wizardData.chartName,
      templateId: wizardData.selectedTemplateId,
      type: template.type,
      indexAxis: template.options.indexAxis,
      theme: wizardData.theme,
      datasetsCount: wizardData.datasets.length
    });

    // Validation
    if (!wizardData.chartName.trim()) {
      this.context.ui.showToast('Por favor, defina um nome para o gráfico', 'warning');
      return;
    }

    if (!wizardData.labelsRange.trim()) {
      this.context.ui.showToast('Por favor, defina o intervalo de rótulos', 'warning');
      return;
    }

    if (wizardData.datasets.length === 0) {
      this.context.ui.showToast('Por favor, adicione pelo menos uma série de dados', 'warning');
      return;
    }

    const sheet = this.context.kernel.workbookManager.getActiveSheet();
    if (!sheet) {
      this.context.ui.showToast('Nenhuma planilha ativa', 'error');
      return;
    }

    try {
      let chart: ChartConfig;

      // Prepare options with template-specific settings
      const chartOptions = {
        title: wizardData.customOptions.title,
        showLegend: wizardData.showLegend,
        legendPosition: wizardData.legendPosition,
        showGrid: wizardData.showGrid,
        showDataLabels: wizardData.showDataLabels,
        theme: wizardData.theme,
        indexAxis: template.options.indexAxis as 'x' | 'y' | undefined
      };

      if (editChart) {
        // Update existing chart
        chart = this.chartManager.updateChart(editChart.id, {
          name: wizardData.chartName,
          type: template.type,
          templateId: template.id,
          labelsRange: wizardData.labelsRange,
          datasets: wizardData.datasets,
          options: chartOptions
        })!;
      } else {
        // Create new chart
        chart = this.chartManager.createChart(
          wizardData.chartName,
          template.type,
          wizardData.labelsRange,
          wizardData.datasets,
          chartOptions,
          sheet.id,
          undefined,
          template.id
        );
      }

      // Save to storage
      await this.saveChartsToStorage();

      // Update panel
      const panel = document.querySelector('.charts-panel-content');
      if (panel) {
        this.renderChartsPanel(panel as HTMLElement);
      }

      // Close wizard
      this.closeChartWizard();

      // Show success message
      this.context.ui.showToast(
        editChart ? 'Gráfico atualizado com sucesso!' : 'Gráfico criado com sucesso!',
        'success'
      );

      logger.info('[ChartsPlugin] Chart created/updated', { chartId: chart.id, name: chart.name });
    } catch (error) {
      logger.error('[ChartsPlugin] Failed to create/update chart', error);
      this.context.ui.showToast('Erro ao criar/atualizar gráfico', 'error');
    }
  }

  private closeChartWizard(): void {
    document.getElementById('chart-modal')?.remove();
    this.rangeSelectionCallback = null;
  }

  // ============================================================================
  // CHART GENERATION
  // ============================================================================

  private generateChart(chartConfig: ChartConfig, canvas: HTMLCanvasElement): void {
    const sheet = this.context.kernel.workbookManager.getActiveSheet();
    if (!sheet) {
      logger.warn('[ChartsPlugin] No active sheet for chart generation');
      return;
    }

    try {
      // Parse labels range
      const labelsRange = sheet.getRangeFromString(chartConfig.labelsRange);
      if (!labelsRange) {
        this.context.ui.showToast('Intervalo de rótulos inválido', 'error');
        return;
      }

      const labels = sheet.getRange(
        labelsRange.start.row,
        labelsRange.start.col,
        labelsRange.end.row,
        labelsRange.end.col
      )
        .flat()
        .map((cell: any) => cell?.value ?? '');

      // Get theme
      const theme = this.THEMES.find(t => t.id === (chartConfig.options.theme || 'default')) || this.THEMES[0];

      // Parse datasets
      const datasets = chartConfig.datasets.map((datasetConfig, index) => {
        const datasetRange = sheet.getRangeFromString(datasetConfig.range);
        if (!datasetRange) {
          this.context.ui.showToast(`Intervalo de dados inválido para a série ${datasetConfig.label}`, 'error');
          return null;
        }

        const data = sheet.getRange(
          datasetRange.start.row,
          datasetRange.start.col,
          datasetRange.end.row,
          datasetRange.end.col
        )
          .flat()
          .map((cell: any) => {
            const val = cell?.value;
            return typeof val === 'number' ? val : parseFloat(val) || 0;
          });

        // Use theme colors, not individual dataset colors
        const color = theme.colors[index % theme.colors.length];

        // Different styling for different chart types
        const datasetStyle: any = {
          label: datasetConfig.label,
          data: data,
          borderWidth: 2,
        };

        // Apply type-specific styling
        if (chartConfig.type === 'line') {
          datasetStyle.backgroundColor = `${color}33`; // 20% opacity
          datasetStyle.borderColor = color;
          datasetStyle.tension = 0.4;
          datasetStyle.fill = false;
          datasetStyle.pointBackgroundColor = color;
          datasetStyle.pointBorderColor = '#fff';
          datasetStyle.pointBorderWidth = 2;
          datasetStyle.pointRadius = 4;
          datasetStyle.pointHoverRadius = 6;
        } else if (chartConfig.type === 'bar') {
          datasetStyle.backgroundColor = color;
          datasetStyle.borderColor = color;
          datasetStyle.borderWidth = 0;
        } else if (['pie', 'doughnut', 'polarArea'].includes(chartConfig.type)) {
          // For pie charts, each data point gets a different color
          datasetStyle.backgroundColor = data.map((_val: any, i: number) => theme.colors[i % theme.colors.length]);
          datasetStyle.borderColor = '#fff';
          datasetStyle.borderWidth = 2;
        } else if (chartConfig.type === 'radar') {
          datasetStyle.backgroundColor = `${color}33`;
          datasetStyle.borderColor = color;
          datasetStyle.pointBackgroundColor = color;
          datasetStyle.pointBorderColor = '#fff';
          datasetStyle.pointHoverBackgroundColor = '#fff';
          datasetStyle.pointHoverBorderColor = color;
        } else {
          // Default styling
          datasetStyle.backgroundColor = color;
          datasetStyle.borderColor = color;
        }

        return datasetStyle;
      }).filter((d: any) => d !== null);

      // Destroy previous chart instance
      const existingChart = (canvas as any).chart;
      if (existingChart) {
        existingChart.destroy();
      }

      // Check if chart type supports scales
      const hasScales = !['pie', 'doughnut', 'polarArea', 'radar'].includes(chartConfig.type);

      // Build chart options
      const chartOptions: any = {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: chartConfig.options.indexAxis || 'x', // CRITICAL: For bar/column differentiation
        plugins: {
          title: {
            display: !!chartConfig.options.title,
            text: chartConfig.options.title || '',
            font: { size: 16, weight: 'bold' },
            color: theme.fontColor
          },
          legend: {
            display: chartConfig.options.showLegend !== false,
            position: chartConfig.options.legendPosition || 'top',
            labels: { color: theme.fontColor }
          },
          tooltip: {
            enabled: true,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleColor: '#fff',
            bodyColor: '#fff',
            borderColor: theme.colors[0],
            borderWidth: 1
          }
        }
      };

      // Add scales only for compatible chart types
      if (hasScales) {
        chartOptions.scales = {
          x: {
            display: chartConfig.options.showGrid !== false,
            grid: {
              display: chartConfig.options.showGrid !== false,
              color: theme.gridColor
            },
            ticks: { color: theme.fontColor }
          },
          y: {
            display: chartConfig.options.showGrid !== false,
            grid: {
              display: chartConfig.options.showGrid !== false,
              color: theme.gridColor
            },
            ticks: { color: theme.fontColor },
            beginAtZero: true
          }
        };
      }

      // Data labels plugin
      if (chartConfig.options.showDataLabels) {
        chartOptions.plugins.datalabels = {
          display: true,
          color: theme.fontColor,
          font: { weight: 'bold' }
        };
      }

      // Create new chart
      const newChart = new Chart(canvas, {
        type: chartConfig.type as any,
        data: {
          labels: labels,
          datasets: datasets,
        },
        options: chartOptions,
      });

      // Store chart instance
      (canvas as any).chart = newChart;
      this.chartManager.setChartInstance(chartConfig.id, newChart);

      logger.debug('[ChartsPlugin] Chart generated successfully', { chartId: chartConfig.id });
    } catch (error) {
      logger.error('[ChartsPlugin] Failed to generate chart', error);
      this.context.ui.showToast('Erro ao gerar gráfico. Verifique os dados selecionados.', 'error');
    }
  }

  // ============================================================================
  // EXPORT
  // ============================================================================

  private async exportChart(chartId: string): Promise<void> {
    try {
      const chartConfig = this.chartManager.getChart(chartId);
      if (!chartConfig) {
        this.context.ui.showToast('Gráfico não encontrado', 'error');
        return;
      }

      const base64Image = this.chartManager.exportChart(chartId);
      if (!base64Image) {
        this.context.ui.showToast('Erro ao exportar gráfico. Visualize o gráfico primeiro.', 'warning');
        return;
      }

      // Create download link
      const link = document.createElement('a');
      link.download = `${chartConfig.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`;
      link.href = base64Image;
      link.click();

      this.context.ui.showToast('Gráfico exportado com sucesso!', 'success');
      logger.info('[ChartsPlugin] Chart exported', { chartId });
    } catch (error) {
      logger.error('[ChartsPlugin] Failed to export chart', error);
      this.context.ui.showToast('Erro ao exportar gráfico', 'error');
    }
  }
}
