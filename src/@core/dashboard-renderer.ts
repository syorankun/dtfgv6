/**
 * DJ DataForge v6 - Dashboard Renderer
 *
 * Renders dashboard widgets and handles interactions (drag, resize).
 * Works alongside VirtualGrid - when in dashboard mode, this takes over rendering.
 */

import type { WidgetConfig, DashboardLayout } from './types';
import type { Sheet } from './workbook-consolidated';
import { logger } from './storage-utils-consolidated';
import { widgetRegistry } from './widget-registry';
import {
  KPIWidgetRenderer,
  TextWidgetRenderer,
  ImageWidgetRenderer,
  TableWidgetRenderer
} from './dashboard-widgets';

// ============================================================================
// WIDGET RENDERER
// ============================================================================

class WidgetRenderer {
  private element: HTMLDivElement;
  private config: WidgetConfig;
  private sheet: Sheet;
  private onWidgetChange?: () => void;
  private internalRenderer: any;

  constructor(config: WidgetConfig, sheet: Sheet, onWidgetChange?: () => void) {
    this.config = config;
    this.sheet = sheet;
    this.onWidgetChange = onWidgetChange;
    this.element = this.createWidgetElement();
  }

  private createWidgetElement(): HTMLDivElement {
    const widget = document.createElement('div');
    widget.className = 'dashboard-widget';
    widget.id = `widget-${this.config.id}`;
    widget.style.position = 'absolute';
    widget.style.left = `${this.config.position.x}px`;
    widget.style.top = `${this.config.position.y}px`;
    widget.style.width = `${this.config.position.width}px`;
    widget.style.height = `${this.config.position.height}px`;
    widget.style.backgroundColor = this.config.backgroundColor || '#ffffff';
    widget.style.border = `${this.config.borderWidth || 1}px solid ${this.config.borderColor || '#e5e7eb'}`;
    widget.style.borderRadius = '8px';
    widget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
    widget.style.overflow = 'hidden';
    widget.style.display = 'flex';
    widget.style.flexDirection = 'column';
    widget.style.cursor = 'move';

    // Widget header (title bar)
    if (this.config.showTitle !== false) {
      const header = document.createElement('div');
      header.className = 'widget-header';
      header.style.padding = '12px 16px';
      header.style.borderBottom = '1px solid #e5e7eb';
      header.style.backgroundColor = '#f9fafb';
      header.style.fontWeight = '600';
      header.style.fontSize = '14px';
      header.style.display = 'flex';
      header.style.justifyContent = 'space-between';
      header.style.alignItems = 'center';
      header.style.cursor = 'move';

      const title = document.createElement('span');
      title.textContent = this.config.title;
      header.appendChild(title);

      // Widget controls
      const controls = document.createElement('div');
      controls.style.display = 'flex';
      controls.style.gap = '8px';

      // Settings button (only for table widgets)
      if (this.config.type === 'table') {
        const settingsBtn = document.createElement('button');
        settingsBtn.textContent = '⚙️';
        settingsBtn.style.border = 'none';
        settingsBtn.style.background = 'transparent';
        settingsBtn.style.cursor = 'pointer';
        settingsBtn.style.fontSize = '16px';
        settingsBtn.style.color = '#6b7280';
        settingsBtn.title = 'Configurar tabela';
        settingsBtn.onclick = (e) => {
          e.stopPropagation();
          this.element.dispatchEvent(new CustomEvent('widget-settings', {
            detail: { widgetId: this.config.id }
          }));
        };
        controls.appendChild(settingsBtn);
      }

      // Remove button
      const removeBtn = document.createElement('button');
      removeBtn.textContent = '✕';
      removeBtn.style.border = 'none';
      removeBtn.style.background = 'transparent';
      removeBtn.style.cursor = 'pointer';
      removeBtn.style.fontSize = '16px';
      removeBtn.style.color = '#6b7280';
      removeBtn.title = 'Remover widget';
      removeBtn.onclick = (e) => {
        e.stopPropagation();
        this.element.dispatchEvent(new CustomEvent('widget-remove', {
          detail: { widgetId: this.config.id }
        }));
      };
      controls.appendChild(removeBtn);

      header.appendChild(controls);
      widget.appendChild(header);
    }

    // Widget content
    const content = document.createElement('div');
    content.className = 'widget-content';
    content.style.flex = '1';
    content.style.overflow = 'auto';
    content.style.padding = '16px';
    content.style.cursor = 'default';

    this.renderContent(content);
    widget.appendChild(content);

    // Resize handles
    this.addResizeHandles(widget);

    return widget;
  }

  private renderContent(container: HTMLDivElement): void {
    try {
      const RendererClass = widgetRegistry.get(this.config.type);
      if (RendererClass) {
        this.internalRenderer = new RendererClass(this.config, this.sheet, container, this.onWidgetChange);
        this.internalRenderer.render();
      } else {
        const isKnownButNotReady = ['chart', 'pivot'].includes(this.config.type);
        if (isKnownButNotReady) {
          container.innerHTML = `<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #9ca3af; flex-direction: column; gap: 12px;"><div style="font-size: 48px;">📊</div><div>Widget tipo "${this.config.type}" em desenvolvimento</div></div>`;
        } else {
          container.innerHTML = `<div style="color: #ef4444; text-align: center; padding: 20px;">⚠️ Tipo de widget desconhecido: "${this.config.type}"</div>`;
        }
      }
    } catch (error) {
      logger.error('[WidgetRenderer] Error rendering widget', error);
      container.innerHTML = `<div style="color: #ef4444; text-align: center; padding: 20px;">❌ Erro ao renderizar widget</div>`;
    }
  }

  public renderSettings(container: HTMLElement): void {
    try {
      if (this.internalRenderer && 'renderSettings' in this.internalRenderer && typeof this.internalRenderer.renderSettings === 'function') {
        this.internalRenderer.renderSettings(container);
      } else {
        container.innerHTML = '<p style="font-size: 12px; color: #6b7280;">Este widget não possui configurações.</p>';
      }
    } catch (error) {
      logger.error('[WidgetRenderer] Error rendering settings', error);
      container.innerHTML = '<p style="color: #ef4444;">Erro ao renderizar configurações.</p>';
    }
  }

  private addResizeHandles(widget: HTMLDivElement): void {
    const handles = ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'];
    const positions: Record<string, any> = {
      nw: { top: '-4px', left: '-4px', cursor: 'nw-resize' },
      ne: { top: '-4px', right: '-4px', cursor: 'ne-resize' },
      sw: { bottom: '-4px', left: '-4px', cursor: 'sw-resize' },
      se: { bottom: '-4px', right: '-4px', cursor: 'se-resize' },
      n: { top: '-4px', left: '50%', transform: 'translateX(-50%)', cursor: 'n-resize' },
      s: { bottom: '-4px', left: '50%', transform: 'translateX(-50%)', cursor: 's-resize' },
      e: { top: '50%', right: '-4px', transform: 'translateY(-50%)', cursor: 'e-resize' },
      w: { top: '50%', left: '-4px', transform: 'translateY(-50%)', cursor: 'w-resize' }
    };

    handles.forEach(handle => {
      const handleEl = document.createElement('div');
      handleEl.className = `resize-handle resize-${handle}`;
      handleEl.style.position = 'absolute';
      handleEl.style.width = '8px';
      handleEl.style.height = '8px';
      handleEl.style.backgroundColor = '#3b82f6';
      handleEl.style.border = '1px solid #fff';
      handleEl.style.borderRadius = '50%';
      handleEl.style.zIndex = '1000';

      Object.assign(handleEl.style, positions[handle]);

      handleEl.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        this.element.dispatchEvent(new CustomEvent('widget-resize-start', {
          detail: { widgetId: this.config.id, handle, x: e.clientX, y: e.clientY }
        }));
      });

      widget.appendChild(handleEl);
    });
  }

  getElement(): HTMLDivElement {
    return this.element;
  }

  updatePosition(x: number, y: number): void {
    this.element.style.left = `${x}px`;
    this.element.style.top = `${y}px`;
  }

  updateSize(width: number, height: number): void {
    this.element.style.width = `${width}px`;
    this.element.style.height = `${height}px`;
  }

  destroy(): void {
    this.element.remove();
  }
}

// ============================================================================
// DASHBOARD RENDERER
// ============================================================================

export class DashboardRenderer {
  private container: HTMLElement;
  private sheet: Sheet;
  private layout: DashboardLayout;
  private widgets: Map<string, WidgetRenderer> = new Map();
  private selectedWidgetId: string | null = null;

  // Drag state
  private draggedWidget: string | null = null;
  private dragStartX = 0;
  private dragStartY = 0;
  private widgetStartX = 0;
  private widgetStartY = 0;

  // Resize state
  private resizedWidget: string | null = null;
  private resizeHandle: string | null = null;
  private resizeStartX = 0;
  private resizeStartY = 0;
  private widgetStartWidth = 0;
  private widgetStartHeight = 0;

  // Callbacks
  private onWidgetChange?: () => void;

  constructor(
    container: HTMLElement,
    sheet: Sheet,
    layout: DashboardLayout
  ) {
    this.container = container;
    this.sheet = sheet;
    this.layout = layout;

    this.setupContainer();
    this.setupEventListeners();
    this._registerWidgets();
    this.renderAllWidgets();
  }

  private _registerWidgets(): void {
    widgetRegistry.register('table', TableWidgetRenderer);
    widgetRegistry.register('kpi', KPIWidgetRenderer);
    widgetRegistry.register('text', TextWidgetRenderer);
    widgetRegistry.register('image', ImageWidgetRenderer);
  }

  private setupContainer(): void {
    this.container.style.position = 'relative';
    this.container.style.width = '100%';
    this.container.style.height = '100%';
    this.container.style.overflow = 'auto';
    this.container.style.backgroundColor = '#f9fafb';

    if (this.layout.gridVisible) {
      const gridSize = this.layout.gridSize || 20;
      this.container.style.backgroundImage = `
        linear-gradient(to right, #e5e7eb 1px, transparent 1px),
        linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
      `;
      this.container.style.backgroundSize = `${gridSize}px ${gridSize}px`;
    }
  }

  private setupEventListeners(): void {
    document.addEventListener('mousemove', this.handleMouseMove.bind(this));
    document.addEventListener('mouseup', this.handleMouseUp.bind(this));
  }

  private renderAllWidgets(): void {
    this.widgets.forEach(widget => widget.destroy());
    this.widgets.clear();
    this.layout.widgets.forEach(config => {
      this.renderWidget(config);
    });
    logger.info('[DashboardRenderer] Rendered all widgets', { count: this.layout.widgets.length });
  }

  private renderWidget(config: WidgetConfig): void {
    const renderer = new WidgetRenderer(config, this.sheet, () => {
      this.onWidgetChange?.();
    });
    const element = renderer.getElement();

    element.addEventListener('click', () => {
      if (this.selectedWidgetId === config.id) return;

      if (this.selectedWidgetId) {
        const oldRenderer = this.widgets.get(this.selectedWidgetId);
        if (oldRenderer) {
            oldRenderer.getElement().style.borderColor = config.borderColor || '#e5e7eb';
        }
      }

      this.selectedWidgetId = config.id;
      element.style.borderColor = '#2563eb';

      this.renderSelectedWidgetSettings();
    });

    element.addEventListener('mousedown', (e) => {
      if ((e.target as HTMLElement).classList.contains('resize-handle')) return;
      this.startDrag(config.id, e.clientX, e.clientY);
    });

    element.addEventListener('widget-remove', ((e: CustomEvent) => {
      this.removeWidget(e.detail.widgetId);
    }) as EventListener);

    element.addEventListener('widget-settings', ((e: CustomEvent) => {
      this.selectedWidgetId = e.detail.widgetId;
      this.renderSelectedWidgetSettings();
    }) as EventListener);

    element.addEventListener('widget-resize-start', ((e: CustomEvent) => {
      this.startResize(e.detail.widgetId, e.detail.handle, e.detail.x, e.detail.y);
    }) as EventListener);

    this.container.appendChild(element);
    this.widgets.set(config.id, renderer);
  }

  private startDrag(widgetId: string, clientX: number, clientY: number): void {
    const config = this.layout.widgets.find(w => w.id === widgetId);
    if (!config) return;

    this.draggedWidget = widgetId;
    this.dragStartX = clientX;
    this.dragStartY = clientY;
    this.widgetStartX = config.position.x;
    this.widgetStartY = config.position.y;

    logger.debug('[DashboardRenderer] Drag started', { widgetId });
  }

  private startResize(widgetId: string, handle: string, clientX: number, clientY: number): void {
    const config = this.layout.widgets.find(w => w.id === widgetId);
    if (!config) return;

    this.resizedWidget = widgetId;
    this.resizeHandle = handle;
    this.resizeStartX = clientX;
    this.resizeStartY = clientY;
    this.widgetStartX = config.position.x;
    this.widgetStartY = config.position.y;
    this.widgetStartWidth = config.position.width;
    this.widgetStartHeight = config.position.height;

    logger.debug('[DashboardRenderer] Resize started', { widgetId, handle });
  }

  private handleMouseMove(e: MouseEvent): void {
    if (this.draggedWidget) {
      this.handleDragMove(e);
    } else if (this.resizedWidget) {
      this.handleResizeMove(e);
    }
  }

  private handleDragMove(e: MouseEvent): void {
    if (!this.draggedWidget) return;

    const deltaX = e.clientX - this.dragStartX;
    const deltaY = e.clientY - this.dragStartY;

    let newX = this.widgetStartX + deltaX;
    let newY = this.widgetStartY + deltaY;

    if (this.layout.snapToGrid && this.layout.gridSize) {
      const gridSize = this.layout.gridSize;
      newX = Math.round(newX / gridSize) * gridSize;
      newY = Math.round(newY / gridSize) * gridSize;
    }

    const renderer = this.widgets.get(this.draggedWidget);
    if (renderer) {
      renderer.updatePosition(newX, newY);
    }
  }

  private handleResizeMove(e: MouseEvent): void {
    if (!this.resizedWidget || !this.resizeHandle) return;

    const deltaX = e.clientX - this.resizeStartX;
    const deltaY = e.clientY - this.resizeStartY;

    let newX = this.widgetStartX;
    let newY = this.widgetStartY;
    let newWidth = this.widgetStartWidth;
    let newHeight = this.widgetStartHeight;

    const handle = this.resizeHandle;

    if (handle.includes('e')) newWidth = this.widgetStartWidth + deltaX;
    if (handle.includes('w')) {
      newWidth = this.widgetStartWidth - deltaX;
      newX = this.widgetStartX + deltaX;
    }
    if (handle.includes('s')) newHeight = this.widgetStartHeight + deltaY;
    if (handle.includes('n')) {
      newHeight = this.widgetStartHeight - deltaY;
      newY = this.widgetStartY + deltaY;
    }

    newWidth = Math.max(200, newWidth);
    newHeight = Math.max(150, newHeight);

    if (this.layout.snapToGrid && this.layout.gridSize) {
      const gridSize = this.layout.gridSize;
      newWidth = Math.round(newWidth / gridSize) * gridSize;
      newHeight = Math.round(newHeight / gridSize) * gridSize;
      newX = Math.round(newX / gridSize) * gridSize;
      newY = Math.round(newY / gridSize) * gridSize;
    }

    const renderer = this.widgets.get(this.resizedWidget);
    if (renderer) {
      renderer.updatePosition(newX, newY);
      renderer.updateSize(newWidth, newHeight);
    }
  }

  private handleMouseUp(): void {
    if (this.draggedWidget) {
      const config = this.layout.widgets.find(w => w.id === this.draggedWidget);
      const renderer = this.widgets.get(this.draggedWidget!);

      if (config && renderer) {
        const element = renderer.getElement();
        config.position.x = parseInt(element.style.left);
        config.position.y = parseInt(element.style.top);
        config.modified = new Date();
        this.layout.modified = new Date();

        logger.info('[DashboardRenderer] Widget moved', { widgetId: this.draggedWidget, position: config.position });
        this.onWidgetChange?.();
      }

      this.draggedWidget = null;
    }

    if (this.resizedWidget) {
      const config = this.layout.widgets.find(w => w.id === this.resizedWidget);
      const renderer = this.widgets.get(this.resizedWidget!);

      if (config && renderer) {
        const element = renderer.getElement();
        config.position.x = parseInt(element.style.left);
        config.position.y = parseInt(element.style.top);
        config.position.width = parseInt(element.style.width);
        config.position.height = parseInt(element.style.height);
        config.modified = new Date();
        this.layout.modified = new Date();

        logger.info('[DashboardRenderer] Widget resized', { widgetId: this.resizedWidget, position: config.position });
        this.onWidgetChange?.();
      }

      this.resizedWidget = null;
      this.resizeHandle = null;
    }
  }

  private removeWidget(widgetId: string): void {
    const renderer = this.widgets.get(widgetId);
    if (renderer) {
      renderer.destroy();
      this.widgets.delete(widgetId);
    }

    const index = this.layout.widgets.findIndex(w => w.id === widgetId);
    if (index !== -1) {
      this.layout.widgets.splice(index, 1);
      this.layout.modified = new Date();

      logger.info('[DashboardRenderer] Widget removed', { widgetId });
      this.onWidgetChange?.();
    }
  }

  refresh(): void {
    this.renderAllWidgets();
  }

  addWidget(config: WidgetConfig): void {
    this.layout.widgets.push(config);
    this.renderWidget(config);
    this.onWidgetChange?.();
  }

  setChangeHandler(handler: () => void): void {
    this.onWidgetChange = handler;
  }

  private renderSelectedWidgetSettings(): void {
    const settingsContainer = document.getElementById('widget-specific-settings');
    if (!settingsContainer) return;

    settingsContainer.innerHTML = '';

    if (this.selectedWidgetId) {
      const renderer = this.widgets.get(this.selectedWidgetId);
      renderer?.renderSettings(settingsContainer);
    }
  }

  destroy(): void {
    this.widgets.forEach(widget => widget.destroy());
    this.widgets.clear();
    this.container.innerHTML = '';
  }
}
