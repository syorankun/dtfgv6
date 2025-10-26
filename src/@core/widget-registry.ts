/**
 * DJ DataForge v6 - Widget Renderer Registry
 *
 * Manages and provides access to different widget renderer classes.
 * This allows for a modular and extensible dashboard system.
 */

import type { WidgetConfig } from './types';
import type { Sheet } from './workbook-consolidated';

// Interface for a widget renderer class constructor
export interface IWidgetRenderer {
  new (config: WidgetConfig, sheet: Sheet, container: HTMLDivElement): {
    render(): void;
  };
}

class WidgetRegistry {
  private renderers = new Map<string, IWidgetRenderer>();

  /**
   * Register a new widget renderer class for a specific type.
   * @param type - The type of the widget (e.g., 'kpi', 'table').
   * @param rendererClass - The class that can render this widget type.
   */
  register(type: string, rendererClass: IWidgetRenderer): void {
    if (this.renderers.has(type)) {
      console.warn(`[WidgetRegistry] Overwriting renderer for type "${type}"`);
    }
    this.renderers.set(type, rendererClass);
  }

  /**
   * Get the renderer class for a given widget type.
   * @param type - The type of the widget.
   * @returns The renderer class or undefined if not found.
   */
  get(type: string): IWidgetRenderer | undefined {
    return this.renderers.get(type);
  }
}

// Export a singleton instance of the registry
export const widgetRegistry = new WidgetRegistry();
