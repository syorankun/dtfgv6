import { nanoid } from 'nanoid';
import { ChartManager, ChartConfig } from './chart-manager';
import type { 
    PluginManifest, 
    PluginContext, 
    PluginPermission,
    PluginStorageAPI,
    PluginUIAPI,
    PluginEventAPI,
    ToolbarButtonConfig,
    PanelConfig,
    MenuItemConfig
  } from '../@core/types';
import { logger } from '../@core/storage-utils-consolidated';
import Chart from 'chart.js/auto';
import { Plugin } from '../@core/plugin-system-consolidated';

  // ============================================================================
  // BUILT-IN PLUGIN: CHARTS
  // ============================================================================

  export class ChartsPlugin implements Plugin {
    private chartManager = new ChartManager();

    manifest: PluginManifest = {
      id: 'charts',
      name: 'Charts',
      version: '1.0.0',
      author: 'DJ DataForge Team',
      description: 'Criação de gráficos e visualizações',
      permissions: ['read:workbook', 'ui:panel', 'ui:toolbar'],
      entryPoint: 'charts.js',
    };
    
    async init(context: PluginContext): Promise<void> {
      // Add toolbar button
      context.ui.addToolbarButton({
        id: 'create-chart',
        label: 'Criar Gráfico',
        icon: '📊',
        tooltip: 'Criar gráfico a partir dos dados selecionados',
        onClick: () => {
          this.createChart(context);
        },
      });
      
      // Add panel
      context.ui.addPanel({
        id: 'charts-panel',
        title: '📊 Gráficos',
        render: (container) => {
          container.innerHTML = `
            <div class="charts-panel-content">
              <div id="chart-list" class="chart-list"></div>
              <div id="chart-preview" style="margin-top: 12px;"></div>
            </div>
          `;
        },
      });
      
      context.ui.showToast('Charts plugin carregado!', 'success');
      logger.info('[ChartsPlugin] Initialized');
    }
    
    private createChart(context: PluginContext): void {
      logger.debug('[ChartsPlugin] createChart called');
      const sheet = context.kernel.workbookManager.getActiveSheet();
      if (!sheet) {
        context.ui.showToast('Nenhuma planilha ativa para criar um gráfico', 'warning');
        return;
      }

      const html = `
        <div class="modal-overlay" id="chart-modal">
          <div class="modal" style="max-width: 800px;">
            <h2>Criar Gráfico</h2>
            <div class="form-group">
              <label>Nome do Gráfico:</label>
              <input type="text" id="chart-name" class="form-control" placeholder="ex: Vendas por Mês">
            </div>
            <div class="form-group">
              <label>Tipo de Gráfico:</label>
              <select id="chart-type-select" class="form-control">
                <option value="bar">Barras</option>
                <option value="line">Linhas</option>
                <option value="pie">Pizza</option>
                <option value="doughnut">Rosca</option>
                <option value="polarArea">Área Polar</option>
                <option value="radar">Radar</option>
              </select>
            </div>
            <div class="form-group">
              <label>Eixo de Rótulos (ex: A2:A10):</label>
              <div style="display: flex; gap: 8px;">
                <input type="text" id="chart-labels-range" class="form-control" placeholder="ex: A2:A10">
                <button id="btn-select-labels-range" class="btn">Selecionar</button>
              </div>
            </div>
            <div id="chart-datasets-container"></div>
            <button id="btn-add-dataset" class="btn">Adicionar Série de Dados</button>
            <div id="chart-preview-container" style="height: 300px; margin-top: 16px;"></div>
            <div class="modal-actions">
              <button id="btn-cancel-chart" class="btn">Cancelar</button>
              <button id="btn-preview-chart" class="btn">Pré-visualizar</button>
              <button id="btn-create-chart-modal" class="btn btn-primary">Criar</button>
            </div>
          </div>
        </div>
      `;

      document.body.insertAdjacentHTML('beforeend', html);

      this.addDatasetInput(context);

      document.getElementById('btn-add-dataset')?.addEventListener('click', () => {
        logger.debug('[ChartsPlugin] Add Dataset button clicked');
        this.addDatasetInput(context);
      });

      const labelsRangeInput = document.getElementById('chart-labels-range') as HTMLInputElement;
      const grid = context.kernel.getGrid();
      if (grid) {
        const selection = grid.getSelection();
        if (selection) {
          const sheet = context.kernel.workbookManager.getActiveSheet();
          if (sheet) {
            const start = `${sheet.getColumnName(selection.start.col)}${selection.start.row + 1}`;
            const end = `${sheet.getColumnName(selection.end.col)}${selection.end.row + 1}`;
            labelsRangeInput.value = `${start}:${end}`;
            logger.debug('[ChartsPlugin] Initial labels range set from selection', { range: labelsRangeInput.value });
          }
        }
      }

      document.getElementById('btn-cancel-chart')?.addEventListener('click', () => {
        logger.debug('[ChartsPlugin] Cancel Chart button clicked');
        document.getElementById('chart-modal')?.remove();
        context.events.emit('chart:end-range-selection');
      });

      document.getElementById('btn-preview-chart')?.addEventListener('click', () => {
        logger.debug('[ChartsPlugin] Preview Chart button clicked');
        const chartConfig = this.getChartConfigFromModal();
        this.previewChart(context, chartConfig);
      });

      document.getElementById('btn-create-chart-modal')?.addEventListener('click', () => {
        logger.debug('[ChartsPlugin] Create Chart button clicked');
        const chartConfig = this.getChartConfigFromModal();
        const newChart = this.chartManager.createChart(chartConfig.name, chartConfig.type, chartConfig.labelsRange, chartConfig.datasets, chartConfig.options);
        this.addChartToList(newChart);
        this.addChartIndicatorToGrid(context, newChart.labelsRange);

        document.getElementById('chart-modal')?.remove();
        context.events.emit('chart:end-range-selection'); // Ensure handler is reset after creation
      });

      document.getElementById('btn-select-labels-range')?.addEventListener('click', () => {
        logger.debug('[ChartsPlugin] Select Labels Range button clicked');
        context.events.emit('chart:start-range-selection', 'chart-labels-range');
        const modal = document.getElementById('chart-modal');
        if (modal) {
          (modal as any).style.display = 'none';
        }
      });

      context.events.on('chart:range-selected', (data: { range: string, targetInput: string }) => {
        logger.debug('[ChartsPlugin] chart:range-selected event received', data);
        const dataRangeInput = document.getElementById(data.targetInput) as HTMLInputElement;
        if (dataRangeInput) {
          dataRangeInput.value = data.range;
        }
        const modal = document.getElementById('chart-modal');
        if (modal) {
          (modal as any).style.display = '';
        }
      });
    }

    private addDatasetInput(context: PluginContext): void {
      logger.debug('[ChartsPlugin] addDatasetInput called');
      const container = document.getElementById('chart-datasets-container');
      if (!container) return;

      const datasetId = `dataset-${nanoid(5)}`;
      const html = `
        <div class="form-group" id="${datasetId}">
          <label>Série de Dados:</label>
          <div style="display: flex; gap: 8px;">
            <input type="text" id="${datasetId}-range" class="form-control chart-dataset-range" placeholder="ex: B2:B10">
            <button id="${datasetId}-select-range" class="btn btn-select-dataset-range">Selecionar</button>
            <input type="text" id="${datasetId}-label" class="form-control chart-dataset-label" placeholder="Nome da Série">
            <button class="btn btn-remove-dataset">-</button>
          </div>
        </div>
      `;

      container.insertAdjacentHTML('beforeend', html);

      const newDatasetGroup = document.getElementById(datasetId);

      newDatasetGroup?.querySelector('.btn-select-dataset-range')?.addEventListener('click', () => {
        logger.debug('[ChartsPlugin] Select Dataset Range button clicked', { datasetId });
        const targetInputId = `${datasetId}-range`;
        context.events.emit('chart:start-range-selection', targetInputId);
        const modal = document.getElementById('chart-modal');
        if (modal) {
          (modal as any).style.display = 'none';
        }
      });

      newDatasetGroup?.querySelector('.btn-remove-dataset')?.addEventListener('click', () => {
        logger.debug('[ChartsPlugin] Remove Dataset button clicked', { datasetId });
        newDatasetGroup.remove();
      });
    }

    private getChartConfigFromModal(): ChartConfig {
      logger.debug('[ChartsPlugin] getChartConfigFromModal called');
      const name = (document.getElementById('chart-name') as HTMLInputElement).value;
      const type = (document.getElementById('chart-type-select') as HTMLSelectElement).value;
      const labelsRange = (document.getElementById('chart-labels-range') as HTMLInputElement).value;
      const sheetId = (this.getContext().kernel.workbookManager.getActiveSheet() as any).id;

      const datasets: Array<{ range: string; label: string; color?: string }> = [];
      document.querySelectorAll('#chart-datasets-container > div').forEach((datasetGroup) => {
        const rangeInput = datasetGroup.querySelector('.chart-dataset-range') as HTMLInputElement;
        const labelInput = datasetGroup.querySelector('.chart-dataset-label') as HTMLInputElement;
        if (rangeInput && labelInput) {
          datasets.push({ range: rangeInput.value, label: labelInput.value });
        }
      });

      const chartConfig: ChartConfig = {
        id: nanoid(), // Will be overwritten if editing existing chart
        name,
        type,
        sheetId,
        labelsRange,
        datasets,
        options: {},
      };
      logger.debug('[ChartsPlugin] Chart config from modal', chartConfig);
      return chartConfig;
    }


    private previewChart(context: PluginContext, chartConfig: ChartConfig): void {
      logger.debug('[ChartsPlugin] previewChart called', chartConfig);
      const chartPreviewContainer = document.getElementById('chart-preview-container');
      if (!chartPreviewContainer) return;

      const canvas = document.createElement('canvas');
      chartPreviewContainer.innerHTML = '';
      chartPreviewContainer.appendChild(canvas);

      this.generateChart(context, chartConfig, canvas);
    }

    private generateChart(context: PluginContext, chartConfig: ChartConfig, canvas?: HTMLCanvasElement): void {
      logger.debug('[ChartsPlugin] generateChart called', chartConfig);
      const sheet = context.kernel.workbookManager.getActiveSheet();
      if (!sheet) return;

      const labelsRange = sheet.getRangeFromString(chartConfig.labelsRange);
      if (!labelsRange) {
        context.ui.showToast('Intervalo de rótulos inválido', 'error');
        return;
      }

      const labels = sheet.getRange(labelsRange.start.row, labelsRange.start.col, labelsRange.end.row, labelsRange.end.col)
        .flat()
        .map((cell: any) => cell.value);

      const datasets = chartConfig.datasets.map((datasetConfig) => {
        const datasetRange = sheet.getRangeFromString(datasetConfig.range);
        if (!datasetRange) {
          context.ui.showToast(`Intervalo de dados inválido para a série ${datasetConfig.label}`, 'error');
          return null;
        }
        const data = sheet.getRange(datasetRange.start.row, datasetRange.start.col, datasetRange.end.row, datasetRange.end.col)
          .flat()
          .map((cell: any) => cell.value);
        return {
          label: datasetConfig.label,
          data: data,
          backgroundColor: datasetConfig.color || this.getRandomColor(),
          borderColor: datasetConfig.color || this.getRandomColor(),
          borderWidth: 1,
        };
      }).filter((d: any) => d !== null);

      const targetCanvas = canvas || document.createElement('canvas');
      if (!canvas) {
        const chartPreview = document.getElementById('chart-preview');
        if (!chartPreview) return;
        chartPreview.innerHTML = '';
        chartPreview.appendChild(targetCanvas);
      }

      // Clear previous chart
      const existingChart = (targetCanvas as any).chart;
      if (existingChart) {
        existingChart.destroy();
      }

      try {
        const newChart = new Chart(targetCanvas, {
          type: chartConfig.type as any,
          data: {
            labels: labels,
            datasets: datasets,
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              title: {
                display: !!chartConfig.options.title,
                text: chartConfig.options.title,
              },
              legend: {
                display: true,
              },
            },
            scales: {
              x: {
                title: {
                  display: !!chartConfig.options.xAxisLabel,
                  text: chartConfig.options.xAxisLabel,
                },
              },
              y: {
                title: {
                  display: !!chartConfig.options.yAxisLabel,
                  text: chartConfig.options.yAxisLabel,
                },
              },
            },
          },
        });
        (targetCanvas as any).chart = newChart;
        logger.debug('[ChartsPlugin] Chart generated successfully', { chartConfig });
      } catch (error) {
        logger.error('[ChartsPlugin] Failed to create chart', error);
        context.ui.showToast('Erro ao criar gráfico. Verifique os dados selecionados.', 'error');
      }
    }

    private getRandomColor(): string {
      const letters = '0123456789ABCDEF';
      let color = '#';
      for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
      }
      return color;
    }

    private addChartToList(chartConfig: ChartConfig): void {
      const chartList = document.getElementById('chart-list');
      if (!chartList) return;

      const chartItem = document.createElement('div');
      chartItem.className = 'chart-item';
      chartItem.dataset.chartId = chartConfig.id;
      chartItem.innerHTML = `
        <span class="chart-name">${chartConfig.name}</span>
        <button class="btn-delete-chart">🗑️</button>
      `;

      chartList.appendChild(chartItem);

      chartItem.addEventListener('click', () => {
        this.generateChart(this.getContext(), chartConfig);
      });

      chartItem.querySelector('.btn-delete-chart')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.chartManager.deleteChart(chartConfig.id);
        chartItem.remove();
      });
    }

    private getContext(): PluginContext {
      return (window as any).DJKernel.pluginHost.contexts.get('charts');
    }

    private addChartIndicatorToGrid(context: PluginContext, labelsRange: string): void {
      const sheet = context.kernel.workbookManager.getActiveSheet();
      if (!sheet) return;

      const range = sheet.getRangeFromString(labelsRange);
      if (!range) return;

      for (let r = range.start.row; r <= range.end.row; r++) {
        for (let c = range.start.col; c <= range.end.col; c++) {
          const cell = sheet.getCell(r, c);
          if (cell) {
            if (!cell.format) {
              cell.format = {};
            }
            cell.format.bgColor = '#e0f2fe';
          }
        }
      }

      const grid = context.kernel.getGrid();
      if (grid) {
        grid.refresh();
      }
    }


  }
