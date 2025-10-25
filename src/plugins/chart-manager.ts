import { logger } from '../@core/storage-utils-consolidated';
import { nanoid } from 'nanoid';
import Chart from 'chart.js/auto';

export interface ChartConfig {
  id: string;
  name: string;
  type: string;
  templateId?: string; // Store template ID to preserve indexAxis and other options
  sheetId: string;
  labelsRange: string;
  datasets: Array<{ range: string; label: string; color?: string }>;
  options: {
    title?: string;
    xAxisLabel?: string;
    yAxisLabel?: string;
    backgroundColor?: string[];
    borderColor?: string[];
    showLegend?: boolean;
    legendPosition?: 'top' | 'bottom' | 'left' | 'right';
    showGrid?: boolean;
    showDataLabels?: boolean;
    theme?: string;
    indexAxis?: 'x' | 'y'; // For bar/column differentiation
  };
}

export class ChartManager {
  private charts: Map<string, ChartConfig> = new Map();
  private chartInstances: Map<string, Chart> = new Map();

  createChart(
    name: string,
    type: string,
    labelsRange: string,
    datasets: Array<{ range: string; label: string; color?: string }>,
    options: any,
    sheetId?: string,
    id?: string,
    templateId?: string
  ): ChartConfig {
    const chartConfig: ChartConfig = {
      id: id || nanoid(),
      name,
      type,
      templateId,
      sheetId: sheetId || '',
      labelsRange,
      datasets,
      options,
    };

    this.charts.set(chartConfig.id, chartConfig);
    logger.info('[ChartManager] Chart created', { id: chartConfig.id, name, type, templateId });
    return chartConfig;
  }

  updateChart(id: string, updates: Partial<ChartConfig>): ChartConfig | undefined {
    const chart = this.charts.get(id);
    if (!chart) {
      logger.warn('[ChartManager] Chart not found for update', { id });
      return undefined;
    }

    const updatedChart = { ...chart, ...updates, id }; // Preserve ID
    this.charts.set(id, updatedChart);
    logger.info('[ChartManager] Chart updated', { id, updates });
    return updatedChart;
  }

  getChart(id: string): ChartConfig | undefined {
    return this.charts.get(id);
  }

  deleteChart(id: string): void {
    // Destroy chart instance if exists
    const instance = this.chartInstances.get(id);
    if (instance) {
      instance.destroy();
      this.chartInstances.delete(id);
    }

    this.charts.delete(id);
    logger.info('[ChartManager] Chart deleted', { id });
  }

  listCharts(): ChartConfig[] {
    return Array.from(this.charts.values());
  }

  setChartInstance(id: string, instance: Chart): void {
    this.chartInstances.set(id, instance);
  }

  getChartInstance(id: string): Chart | undefined {
    return this.chartInstances.get(id);
  }

  clearAll(): void {
    // Destroy all chart instances
    this.chartInstances.forEach(instance => instance.destroy());
    this.chartInstances.clear();
    this.charts.clear();
    logger.info('[ChartManager] All charts cleared');
  }

  loadCharts(charts: ChartConfig[]): void {
    charts.forEach(chart => {
      this.charts.set(chart.id, chart);
    });
    logger.info('[ChartManager] Charts loaded', { count: charts.length });
  }

  exportChart(id: string): string | undefined {
    const instance = this.chartInstances.get(id);
    if (!instance) {
      logger.warn('[ChartManager] Chart instance not found for export', { id });
      return undefined;
    }

    return instance.toBase64Image();
  }
}
