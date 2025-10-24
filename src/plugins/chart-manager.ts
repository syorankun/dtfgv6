import { logger } from '../@core/storage-utils-consolidated';
import { nanoid } from 'nanoid';
import Chart from 'chart.js/auto';

export interface ChartConfig {
  id: string;
  name: string;
  type: string;
  sheetId: string;
  labelsRange: string;
  datasets: Array<{ range: string; label: string; color?: string }>;
  options: {
    title?: string;
    xAxisLabel?: string;
    yAxisLabel?: string;
    backgroundColor?: string[];
    borderColor?: string[];
  };
}

export class ChartManager {
  private charts: Map<string, ChartConfig> = new Map();

  createChart(name: string, type: string, sheetId: string, labelsRange: string, datasets: Array<{ range: string; label: string; color?: string }>, options: any): ChartConfig {
    const chartConfig: ChartConfig = {
      id: nanoid(),
      name,
      type,
      sheetId,
      labelsRange,
      datasets,
      options,
    };

    this.charts.set(chartConfig.id, chartConfig);
    logger.info('[ChartManager] Chart created', { id: chartConfig.id, name });
    return chartConfig;
  }

  getChart(id: string): ChartConfig | undefined {
    return this.charts.get(id);
  }

  deleteChart(id: string): void {
    this.charts.delete(id);
    logger.info('[ChartManager] Chart deleted', { id });
  }

  listCharts(): ChartConfig[] {
    return Array.from(this.charts.values());
  }
}
