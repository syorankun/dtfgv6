/**
 * DJ DataForge v6 - Dashboard Manager
 *
 * Manages dashboard layouts and widgets for visual data presentation.
 * Each sheet can have an associated dashboard layout with multiple widgets.
 */

import { nanoid } from 'nanoid';
import type {
  DashboardLayout,
  WidgetConfig,
  WidgetType,
  WidgetPosition,
  DashboardMode
} from './types';
import { logger } from './storage-utils-consolidated';

// ============================================================================
// DASHBOARD MANAGER (Singleton)
// ============================================================================

export class DashboardManager {
  private static instance: DashboardManager;
  private layouts: Map<string, DashboardLayout> = new Map(); // sheetId -> layout

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): DashboardManager {
    if (!DashboardManager.instance) {
      DashboardManager.instance = new DashboardManager();
    }
    return DashboardManager.instance;
  }

  /**
   * Create or get dashboard layout for a sheet
   */
  getOrCreateLayout(sheetId: string): DashboardLayout {
    let layout = this.layouts.get(sheetId);

    if (!layout) {
      layout = {
        id: nanoid(),
        sheetId,
        mode: 'grid', // Start in grid mode
        widgets: [],
        gridVisible: true,
        snapToGrid: true,
        gridSize: 20,
        created: new Date(),
        modified: new Date()
      };

      this.layouts.set(sheetId, layout);
      logger.info('[DashboardManager] Created new layout', { sheetId, layoutId: layout.id });
    }

    return layout;
  }

  /**
   * Get layout for a sheet (returns undefined if doesn't exist)
   */
  getLayout(sheetId: string): DashboardLayout | undefined {
    return this.layouts.get(sheetId);
  }

  /**
   * Set mode for a sheet's dashboard
   */
  setMode(sheetId: string, mode: DashboardMode): void {
    const layout = this.getOrCreateLayout(sheetId);
    layout.mode = mode;
    layout.modified = new Date();

    logger.info('[DashboardManager] Mode changed', { sheetId, mode });
  }

  /**
   * Get current mode for a sheet
   */
  getMode(sheetId: string): DashboardMode {
    const layout = this.layouts.get(sheetId);
    return layout?.mode || 'grid';
  }

  /**
   * Add widget to dashboard
   */
  addWidget(sheetId: string, widgetType: WidgetType, options: Partial<Omit<WidgetConfig, 'id' | 'type' | 'created' | 'modified' | 'position'>> & {
    position?: Partial<WidgetPosition>;
  } = {}): WidgetConfig {
    const layout = this.getOrCreateLayout(sheetId);

    // Default position (center of viewport, or stack if multiple widgets)
    const defaultPosition: WidgetPosition = {
      x: 100 + (layout.widgets.length * 20),
      y: 100 + (layout.widgets.length * 20),
      width: 400,
      height: 300
    };

    // Extract position separately to avoid type conflicts
    const { position: _, ...restOptions } = options;

    const widget: WidgetConfig = {
      id: nanoid(),
      type: widgetType,
      position: { ...defaultPosition, ...(options.position || {}) } as WidgetPosition,
      title: options.title || this.generateWidgetTitle(widgetType),
      showTitle: options.showTitle ?? true,
      backgroundColor: options.backgroundColor || '#ffffff',
      borderColor: options.borderColor || '#e5e7eb',
      borderWidth: options.borderWidth ?? 1,
      ...restOptions,
      created: new Date(),
      modified: new Date()
    };

    layout.widgets.push(widget);
    layout.modified = new Date();

    logger.info('[DashboardManager] Widget added', {
      sheetId,
      widgetId: widget.id,
      type: widgetType
    });

    return widget;
  }

  /**
   * Remove widget from dashboard
   */
  removeWidget(sheetId: string, widgetId: string): boolean {
    const layout = this.layouts.get(sheetId);
    if (!layout) return false;

    const index = layout.widgets.findIndex(w => w.id === widgetId);
    if (index === -1) return false;

    layout.widgets.splice(index, 1);
    layout.modified = new Date();

    logger.info('[DashboardManager] Widget removed', { sheetId, widgetId });
    return true;
  }

  /**
   * Update widget position
   */
  updateWidgetPosition(sheetId: string, widgetId: string, position: Partial<WidgetPosition>): boolean {
    const layout = this.layouts.get(sheetId);
    if (!layout) return false;

    const widget = layout.widgets.find(w => w.id === widgetId);
    if (!widget) return false;

    // Apply snap to grid if enabled
    if (layout.snapToGrid && layout.gridSize) {
      const gridSize = layout.gridSize;
      if (position.x !== undefined) {
        position.x = Math.round(position.x / gridSize) * gridSize;
      }
      if (position.y !== undefined) {
        position.y = Math.round(position.y / gridSize) * gridSize;
      }
      if (position.width !== undefined) {
        position.width = Math.round(position.width / gridSize) * gridSize;
      }
      if (position.height !== undefined) {
        position.height = Math.round(position.height / gridSize) * gridSize;
      }
    }

    Object.assign(widget.position, position);
    widget.modified = new Date();
    layout.modified = new Date();

    logger.debug('[DashboardManager] Widget position updated', {
      sheetId,
      widgetId,
      position: widget.position
    });

    return true;
  }

  /**
   * Update widget properties
   */
  updateWidget(sheetId: string, widgetId: string, updates: Partial<WidgetConfig>): boolean {
    const layout = this.layouts.get(sheetId);
    if (!layout) return false;

    const widget = layout.widgets.find(w => w.id === widgetId);
    if (!widget) return false;

    // Don't allow changing id, created, or type
    delete (updates as any).id;
    delete (updates as any).created;
    delete (updates as any).type;

    Object.assign(widget, updates);
    widget.modified = new Date();
    layout.modified = new Date();

    logger.info('[DashboardManager] Widget updated', {
      sheetId,
      widgetId,
      updates: Object.keys(updates)
    });

    return true;
  }

  /**
   * Get widget by ID
   */
  getWidget(sheetId: string, widgetId: string): WidgetConfig | undefined {
    const layout = this.layouts.get(sheetId);
    return layout?.widgets.find(w => w.id === widgetId);
  }

  /**
   * Get all widgets for a sheet
   */
  getWidgets(sheetId: string): WidgetConfig[] {
    const layout = this.layouts.get(sheetId);
    return layout?.widgets || [];
  }

  /**
   * Clear all widgets from a dashboard
   */
  clearWidgets(sheetId: string): void {
    const layout = this.layouts.get(sheetId);
    if (layout) {
      layout.widgets = [];
      layout.modified = new Date();
      logger.info('[DashboardManager] All widgets cleared', { sheetId });
    }
  }

  /**
   * Delete entire layout for a sheet
   */
  deleteLayout(sheetId: string): boolean {
    const deleted = this.layouts.delete(sheetId);
    if (deleted) {
      logger.info('[DashboardManager] Layout deleted', { sheetId });
    }
    return deleted;
  }

  /**
   * Toggle dashboard mode
   */
  toggleMode(sheetId: string): DashboardMode {
    const layout = this.getOrCreateLayout(sheetId);
    const newMode: DashboardMode = layout.mode === 'grid' ? 'dashboard' : 'grid';
    this.setMode(sheetId, newMode);
    return newMode;
  }

  /**
   * Update layout settings
   */
  updateLayoutSettings(sheetId: string, settings: {
    gridVisible?: boolean;
    snapToGrid?: boolean;
    gridSize?: number;
  }): boolean {
    const layout = this.layouts.get(sheetId);
    if (!layout) return false;

    Object.assign(layout, settings);
    layout.modified = new Date();

    logger.info('[DashboardManager] Layout settings updated', { sheetId, settings });
    return true;
  }

  /**
   * Generate default title for widgets
   */
  private generateWidgetTitle(type: WidgetType): string {
    const layout = Array.from(this.layouts.values())[0];
    const count = layout?.widgets.filter(w => w.type === type).length || 0;

    const titles: Record<WidgetType, string> = {
      kpi: `KPI ${count + 1}`,
      table: `Tabela ${count + 1}`,
      text: `Texto ${count + 1}`,
      image: `Imagem ${count + 1}`,
      chart: `Gráfico ${count + 1}`,
      pivot: `Tabela Dinâmica ${count + 1}`
    };

    return titles[type];
  }

  /**
   * Serialize all layouts for persistence
   */
  serialize(): any {
    const layoutsArray: any[] = [];

    this.layouts.forEach((layout) => {
      layoutsArray.push({
        ...layout,
        created: layout.created.toISOString(),
        modified: layout.modified.toISOString(),
        widgets: layout.widgets.map(w => ({
          ...w,
          created: w.created.toISOString(),
          modified: w.modified.toISOString()
        }))
      });
    });

    return { layouts: layoutsArray };
  }

  /**
   * Deserialize layouts from persistence
   */
  deserialize(data: any): void {
    this.layouts.clear();

    if (data?.layouts) {
      data.layouts.forEach((layoutData: any) => {
        const layout: DashboardLayout = {
          ...layoutData,
          created: new Date(layoutData.created),
          modified: new Date(layoutData.modified),
          widgets: layoutData.widgets?.map((w: any) => ({
            ...w,
            created: new Date(w.created),
            modified: new Date(w.modified)
          })) || []
        };

        this.layouts.set(layout.sheetId, layout);
      });

      logger.info('[DashboardManager] Layouts deserialized', {
        count: this.layouts.size
      });
    }
  }

  /**
   * Get all layouts (for debugging)
   */
  listLayouts(): DashboardLayout[] {
    return Array.from(this.layouts.values());
  }
}

// Export singleton instance
export const dashboardManager = DashboardManager.getInstance();
