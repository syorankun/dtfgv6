/**
 * DJ DataForge v6 - Virtual Grid (Canvas-based)
 * 
 * FUTURE SPLIT POINTS:
 * - grid/viewport.ts (VirtualGrid class)
 * - grid/renderer.ts (CellRenderer)
 * - grid/selection.ts (SelectionManager)
 * - grid/editor.ts (InlineEditor)
 * - grid/keyboard.ts (KeyboardHandler)
 * - grid/clipboard.ts (ClipboardManager)
 * 
 * Este é o componente mais crítico - renderização de milhões de células com 60 FPS
 */

import type { Sheet } from '../@core/workbook-consolidated';
import type { Cell } from '../@core/types';
import { logger } from '../@core/storage-utils-consolidated';

// ============================================================================
// SELECTION MANAGER
// ============================================================================

interface Selection {
  start: { row: number; col: number };
  end: { row: number; col: number };
}

class SelectionManager {
  private selection: Selection = {
    start: { row: 0, col: 0 },
    end: { row: 0, col: 0 },
  };
  
  private isSelecting = false;
  
  getSelection(): Selection {
    return { ...this.selection };
  }
  
  startSelection(row: number, col: number): void {
    this.selection = {
      start: { row, col },
      end: { row, col },
    };
    this.isSelecting = true;
  }
  
  extendSelection(row: number, col: number): void {
    if (this.isSelecting) {
      this.selection.end = { row, col };
    }
  }
  
  endSelection(): void {
    this.isSelecting = false;
  }
  
  getActiveCell(): { row: number; col: number } {
    return { ...this.selection.start };
  }
  
  moveSelection(dRow: number, dCol: number): void {
    const newRow = Math.max(0, this.selection.start.row + dRow);
    const newCol = Math.max(0, this.selection.start.col + dCol);
    
    this.selection = {
      start: { row: newRow, col: newCol },
      end: { row: newRow, col: newCol },
    };
  }
  
  getRange(): { startRow: number; startCol: number; endRow: number; endCol: number } {
    return {
      startRow: Math.min(this.selection.start.row, this.selection.end.row),
      startCol: Math.min(this.selection.start.col, this.selection.end.col),
      endRow: Math.max(this.selection.start.row, this.selection.end.row),
      endCol: Math.max(this.selection.start.col, this.selection.end.col),
    };
  }
}

// ============================================================================
// CELL RENDERER
// ============================================================================

class CellRenderer {
  private ctx: CanvasRenderingContext2D;
  
  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }
  
  renderCell(
    x: number,
    y: number,
    width: number,
    height: number,
    cell: Cell | undefined,
    isSelected: boolean,
    isActive: boolean
  ): void {
    const ctx = this.ctx;
    
    // Background
    if (isActive) {
      ctx.fillStyle = '#fff9e6';
    } else if (isSelected) {
      ctx.fillStyle = '#e6f2ff';
    } else {
      ctx.fillStyle = '#ffffff';
    }
    ctx.fillRect(x, y, width, height);
    
    // Border
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);
    
    // Active cell highlight
    if (isActive) {
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, width, height);
    }
    
    // Content
    if (cell) {
      let displayValue = cell.value;
      
      // Format value
      if (cell.type === 'number' && typeof displayValue === 'number') {
        displayValue = displayValue.toLocaleString('pt-BR', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        });
      }
      
      // Text styling
      ctx.fillStyle = cell.format?.textColor || '#0f172a';
      ctx.font = `${cell.format?.bold ? 'bold' : ''} ${cell.format?.italic ? 'italic' : ''} 13px -apple-system, sans-serif`;
      ctx.textBaseline = 'middle';
      
      // Alignment
      const align = cell.format?.alignment || (cell.type === 'number' ? 'right' : 'left');
      ctx.textAlign = align as CanvasTextAlign;
      
      const textX = align === 'right' ? x + width - 8 : align === 'center' ? x + width / 2 : x + 8;
      const textY = y + height / 2;
      
      // Truncate text if too long
      const maxWidth = width - 16;
      let text = String(displayValue ?? '');
      
      if (ctx.measureText(text).width > maxWidth) {
        while (ctx.measureText(text + '...').width > maxWidth && text.length > 0) {
          text = text.slice(0, -1);
        }
        text += '...';
      }
      
      ctx.fillText(text, textX, textY);
      
      // Formula indicator
      if (cell.formula) {
        ctx.fillStyle = '#2563eb';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('fx', x + 2, y + 10);
      }
    }
  }
  
  renderHeader(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    isColumn: boolean
  ): void {
    const ctx = this.ctx;
    
    // Background
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(x, y, width, height);
    
    // Border
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);
    
    // Text
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 12px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + width / 2, y + height / 2);
  }
}

// ============================================================================
// CLIPBOARD MANAGER
// ============================================================================

class ClipboardManager {
  private data: any[][] | null = null;
  
  copy(sheet: Sheet, range: { startRow: number; startCol: number; endRow: number; endCol: number }): void {
    this.data = [];
    
    for (let r = range.startRow; r <= range.endRow; r++) {
      const row: any[] = [];
      for (let c = range.startCol; c <= range.endCol; c++) {
        const cell = sheet.getCell(r, c);
        row.push(cell?.value ?? '');
      }
      this.data.push(row);
    }
    
    logger.debug('[Clipboard] Copied', { rows: this.data.length, cols: this.data[0]?.length });
  }
  
  paste(sheet: Sheet, startRow: number, startCol: number): void {
    if (!this.data) return;
    
    for (let r = 0; r < this.data.length; r++) {
      for (let c = 0; c < this.data[r].length; c++) {
        sheet.setCell(startRow + r, startCol + c, this.data[r][c]);
      }
    }
    
    logger.debug('[Clipboard] Pasted', { at: `${startRow},${startCol}` });
  }
  
  hasData(): boolean {
    return this.data !== null;
  }
}

// ============================================================================
// VIRTUAL GRID
// ============================================================================

export class VirtualGrid {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private sheet?: Sheet;
  
  // Grid dimensions
  private cellWidth = 100;
  private cellHeight = 25;
  private headerWidth = 50;
  private headerHeight = 30;
  
  // Viewport
  private scrollX = 0;
  private scrollY = 0;
  private viewportWidth = 0;
  private viewportHeight = 0;
  
  // Components
  private selectionManager = new SelectionManager();
  private renderer: CellRenderer;
  private clipboardManager = new ClipboardManager();
  
  // Editor
  private isEditing = false;
  private editor?: HTMLInputElement;
  
  // Events
  private onCellChange?: (row: number, col: number, value: any) => void;
  private onSelectionChange?: (selection: Selection) => void;
  
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context not available');
    
    this.ctx = ctx;
    this.renderer = new CellRenderer(ctx);
    
    this.setupCanvas();
    this.setupEvents();
    
    // Initial render
    requestAnimationFrame(() => this.render());
  }
  
  // --------------------------------------------------------------------------
  // SETUP
  // --------------------------------------------------------------------------
  
  private setupCanvas(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    
    this.viewportWidth = rect.width;
    this.viewportHeight = rect.height;
    
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
  }
  
  private setupEvents(): void {
    // Mouse events
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.canvas.addEventListener('dblclick', this.handleDoubleClick.bind(this));
    
    // Keyboard events
    this.canvas.tabIndex = 0;
    this.canvas.addEventListener('keydown', this.handleKeyDown.bind(this));
    
    // Wheel events
    this.canvas.addEventListener('wheel', this.handleWheel.bind(this));
    
    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      this.setupCanvas();
      this.render();
    });
    resizeObserver.observe(this.canvas);
  }