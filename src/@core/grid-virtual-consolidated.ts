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

import type { Sheet } from "../@core/workbook-consolidated";
import type { Cell } from "../@core/types";
import { logger } from "../@core/storage-utils-consolidated";

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

  getRange(): {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  } {
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
      ctx.fillStyle = "#fff9e6";
    } else if (isSelected) {
      ctx.fillStyle = "#e6f2ff";
    } else {
      ctx.fillStyle = "#ffffff";
    }
    ctx.fillRect(x, y, width, height);

    // Border
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);

    // Active cell highlight
    if (isActive) {
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, width, height);
    }

    // Content
    if (cell) {
      let displayValue = cell.value;

      // Format value
      if (cell.type === "number" && typeof displayValue === "number") {
        displayValue = displayValue.toLocaleString("pt-BR", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        });
      }

      // Text styling
      ctx.fillStyle = cell.format?.textColor || "#0f172a";
      ctx.font = `${cell.format?.bold ? "bold" : ""} ${cell.format?.italic ? "italic" : ""} 13px -apple-system, sans-serif`;
      ctx.textBaseline = "middle";

      // Alignment
      const align =
        cell.format?.alignment || (cell.type === "number" ? "right" : "left");
      ctx.textAlign = align as CanvasTextAlign;

      const textX =
        align === "right"
          ? x + width - 8
          : align === "center"
            ? x + width / 2
            : x + 8;
      const textY = y + height / 2;

      // Truncate text if too long
      const maxWidth = width - 16;
      let text = String(displayValue ?? "");

      if (ctx.measureText(text).width > maxWidth) {
        while (
          ctx.measureText(text + "...").width > maxWidth &&
          text.length > 0
        ) {
          text = text.slice(0, -1);
        }
        text += "...";
      }

      ctx.fillText(text, textX, textY);

      // Formula indicator
      if (cell.formula) {
        ctx.fillStyle = "#2563eb";
        ctx.font = "bold 9px monospace";
        ctx.textAlign = "left";
        ctx.fillText("fx", x + 2, y + 10);
      }
    }
  }

  renderHeader(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    _isColumn: boolean
  ): void {
    const ctx = this.ctx;

    // Background
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(x, y, width, height);

    // Border
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);

    // Text
    ctx.fillStyle = "#475569";
    ctx.font = "bold 12px -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + width / 2, y + height / 2);
  }
}

// ============================================================================
// CLIPBOARD MANAGER
// ============================================================================

class ClipboardManager {
  private data: any[][] | null = null;

  copy(
    sheet: Sheet,
    range: {
      startRow: number;
      startCol: number;
      endRow: number;
      endCol: number;
    }
  ): void {
    this.data = [];

    for (let r = range.startRow; r <= range.endRow; r++) {
      const row: any[] = [];
      for (let c = range.startCol; c <= range.endCol; c++) {
        const cell = sheet.getCell(r, c);
        row.push(cell?.value ?? "");
      }
      this.data.push(row);
    }

    logger.debug("[Clipboard] Copied", {
      rows: this.data.length,
      cols: this.data[0]?.length,
    });
  }

  paste(sheet: Sheet, startRow: number, startCol: number): void {
    if (!this.data) return;

    for (let r = 0; r < this.data.length; r++) {
      for (let c = 0; c < this.data[r].length; c++) {
        sheet.setCell(startRow + r, startCol + c, this.data[r][c]);
      }
    }

    logger.debug("[Clipboard] Pasted", { at: `${startRow},${startCol}` });
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
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context not available");

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

    this.canvas.style.width = rect.width + "px";
    this.canvas.style.height = rect.height + "px";
  }

  private setupEvents(): void {
    // Mouse events
    this.canvas.addEventListener("mousedown", this.handleMouseDown.bind(this));
    this.canvas.addEventListener("mousemove", this.handleMouseMove.bind(this));
    this.canvas.addEventListener("mouseup", this.handleMouseUp.bind(this));
    this.canvas.addEventListener("dblclick", this.handleDoubleClick.bind(this));

    // Keyboard events
    this.canvas.tabIndex = 0;
    this.canvas.addEventListener("keydown", this.handleKeyDown.bind(this));

    // Wheel events
    this.canvas.addEventListener("wheel", this.handleWheel.bind(this));

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      this.setupCanvas();
      this.render();
    });
    resizeObserver.observe(this.canvas);
  }

  // --------------------------------------------------------------------------
  // EVENT HANDLERS
  // --------------------------------------------------------------------------

  private handleMouseDown(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const cellPos = this.getCellAt(x, y);
    if (cellPos) {
      this.selectionManager.startSelection(cellPos.row, cellPos.col);
      this.onSelectionChange?.(this.selectionManager.getSelection());
      this.render();
    }
  }

  private handleMouseMove(e: MouseEvent): void {
    if (e.buttons === 1) { // Left mouse button
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const cellPos = this.getCellAt(x, y);
      if (cellPos) {
        this.selectionManager.extendSelection(cellPos.row, cellPos.col);
        this.onSelectionChange?.(this.selectionManager.getSelection());
        this.render();
      }
    }
  }

  private handleMouseUp(_e: MouseEvent): void {
    this.selectionManager.endSelection();
  }

  private handleDoubleClick(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const cellPos = this.getCellAt(x, y);
    if (cellPos && this.sheet) {
      this.startEditing(cellPos.row, cellPos.col);
    }
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (this.isEditing) return;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        this.selectionManager.moveSelection(-1, 0);
        this.onSelectionChange?.(this.selectionManager.getSelection());
        this.render();
        break;
      case 'ArrowDown':
      case 'Enter':
        e.preventDefault();
        this.selectionManager.moveSelection(1, 0);
        this.onSelectionChange?.(this.selectionManager.getSelection());
        this.render();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        this.selectionManager.moveSelection(0, -1);
        this.onSelectionChange?.(this.selectionManager.getSelection());
        this.render();
        break;
      case 'ArrowRight':
      case 'Tab':
        e.preventDefault();
        this.selectionManager.moveSelection(0, 1);
        this.onSelectionChange?.(this.selectionManager.getSelection());
        this.render();
        break;
      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        this.deleteSelection();
        break;
      case 'c':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          this.copySelection();
        }
        break;
      case 'v':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          this.pasteSelection();
        }
        break;
      case 'F2':
        e.preventDefault();
        const activeCell = this.selectionManager.getActiveCell();
        this.startEditing(activeCell.row, activeCell.col);
        break;
      default:
        // Start editing on printable character
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
          const activeCell = this.selectionManager.getActiveCell();
          this.startEditing(activeCell.row, activeCell.col, e.key);
        }
        break;
    }
  }

  private handleWheel(e: WheelEvent): void {
    e.preventDefault();

    this.scrollY += e.deltaY;
    this.scrollX += e.deltaX;

    // Clamp scroll
    this.scrollY = Math.max(0, this.scrollY);
    this.scrollX = Math.max(0, this.scrollX);

    this.render();
  }

  // --------------------------------------------------------------------------
  // RENDERING
  // --------------------------------------------------------------------------

  private render(): void {
    if (!this.sheet) {
      this.renderEmpty();
      return;
    }

    this.ctx.clearRect(0, 0, this.viewportWidth, this.viewportHeight);

    const selection = this.selectionManager.getSelection();
    const range = this.selectionManager.getRange();

    // Calculate visible cells
    const startCol = Math.floor(this.scrollX / this.cellWidth);
    const endCol = Math.ceil((this.scrollX + this.viewportWidth) / this.cellWidth);
    const startRow = Math.floor(this.scrollY / this.cellHeight);
    const endRow = Math.ceil((this.scrollY + this.viewportHeight) / this.cellHeight);

    // Render column headers
    for (let col = startCol; col < endCol; col++) {
      const x = this.headerWidth + (col * this.cellWidth) - this.scrollX;
      const label = this.sheet.getColumnName(col);
      this.renderer.renderHeader(x, 0, this.cellWidth, this.headerHeight, label, true);
    }

    // Render row headers
    for (let row = startRow; row < endRow; row++) {
      const y = this.headerHeight + (row * this.cellHeight) - this.scrollY;
      const label = String(row + 1);
      this.renderer.renderHeader(0, y, this.headerWidth, this.cellHeight, label, false);
    }

    // Render cells
    for (let row = startRow; row < endRow; row++) {
      for (let col = startCol; col < endCol; col++) {
        const x = this.headerWidth + (col * this.cellWidth) - this.scrollX;
        const y = this.headerHeight + (row * this.cellHeight) - this.scrollY;

        const cell = this.sheet.getCell(row, col);
        const isInRange = row >= range.startRow && row <= range.endRow &&
                         col >= range.startCol && col <= range.endCol;
        const isActive = row === selection.start.row && col === selection.start.col;

        this.renderer.renderCell(x, y, this.cellWidth, this.cellHeight, cell, isInRange, isActive);
      }
    }

    // Render corner header
    this.renderer.renderHeader(0, 0, this.headerWidth, this.headerHeight, '', false);
  }

  private renderEmpty(): void {
    this.ctx.clearRect(0, 0, this.viewportWidth, this.viewportHeight);

    this.ctx.fillStyle = '#94a3b8';
    this.ctx.font = '14px -apple-system, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(
      'Selecione uma planilha para visualizar',
      this.viewportWidth / 2,
      this.viewportHeight / 2
    );
  }

  // --------------------------------------------------------------------------
  // EDITING
  // --------------------------------------------------------------------------

  private startEditing(row: number, col: number, initialValue?: string): void {
    if (!this.sheet) return;

    this.isEditing = true;

    const cell = this.sheet.getCell(row, col);
    const value = initialValue ?? (cell?.formula || cell?.value || '');

    // Create editor input
    const rect = this.canvas.getBoundingClientRect();
    const x = rect.left + this.headerWidth + (col * this.cellWidth) - this.scrollX;
    const y = rect.top + this.headerHeight + (row * this.cellHeight) - this.scrollY;

    this.editor = document.createElement('input');
    this.editor.type = 'text';
    this.editor.value = String(value);
    this.editor.style.position = 'absolute';
    this.editor.style.left = x + 'px';
    this.editor.style.top = y + 'px';
    this.editor.style.width = this.cellWidth + 'px';
    this.editor.style.height = this.cellHeight + 'px';
    this.editor.style.border = '2px solid #2563eb';
    this.editor.style.outline = 'none';
    this.editor.style.fontSize = '13px';
    this.editor.style.padding = '0 8px';
    this.editor.style.zIndex = '1000';

    document.body.appendChild(this.editor);
    this.editor.focus();
    this.editor.select();

    // Handle editor events
    this.editor.addEventListener('blur', () => this.stopEditing(row, col, true));
    this.editor.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.stopEditing(row, col, true);
        this.selectionManager.moveSelection(1, 0);
        this.onSelectionChange?.(this.selectionManager.getSelection());
        this.render();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.stopEditing(row, col, false);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        this.stopEditing(row, col, true);
        this.selectionManager.moveSelection(0, 1);
        this.onSelectionChange?.(this.selectionManager.getSelection());
        this.render();
      }
    });
  }

  private stopEditing(row: number, col: number, save: boolean): void {
    if (!this.isEditing || !this.editor) return;

    // Immediately clear editing state to prevent re-entry
    const editor = this.editor;
    this.editor = undefined;
    this.isEditing = false;

    if (save && this.sheet) {
      const value = editor.value;

      // Check if it's a formula
      if (value.startsWith('=')) {
        this.sheet.setCell(row, col, value, {
          formula: value,
          type: 'formula',
        });
      } else {
        // Try to parse as number
        const numValue = parseFloat(value);
        if (!isNaN(numValue) && value.trim() !== '') {
          this.sheet.setCell(row, col, numValue);
        } else {
          this.sheet.setCell(row, col, value);
        }
      }

      this.onCellChange?.(row, col, value);
    }

    // Safely remove editor element with error handling
    try {
      if (editor.parentElement) {
        editor.remove();
      }
    } catch (e) {
      // Element already removed, ignore error
    }

    this.canvas.focus();
    this.render();
  }

  // --------------------------------------------------------------------------
  // CLIPBOARD OPERATIONS
  // --------------------------------------------------------------------------

  private copySelection(): void {
    if (!this.sheet) return;

    const range = this.selectionManager.getRange();
    this.clipboardManager.copy(this.sheet, range);
  }

  private pasteSelection(): void {
    if (!this.sheet) return;

    const activeCell = this.selectionManager.getActiveCell();
    this.clipboardManager.paste(this.sheet, activeCell.row, activeCell.col);
    this.render();
  }

  private deleteSelection(): void {
    if (!this.sheet) return;

    const range = this.selectionManager.getRange();

    for (let row = range.startRow; row <= range.endRow; row++) {
      for (let col = range.startCol; col <= range.endCol; col++) {
        this.sheet.setCell(row, col, '');
        this.onCellChange?.(row, col, '');
      }
    }

    this.render();
  }

  // --------------------------------------------------------------------------
  // UTILITIES
  // --------------------------------------------------------------------------

  private getCellAt(x: number, y: number): { row: number; col: number } | null {
    if (x < this.headerWidth || y < this.headerHeight) {
      return null;
    }

    const col = Math.floor((x - this.headerWidth + this.scrollX) / this.cellWidth);
    const row = Math.floor((y - this.headerHeight + this.scrollY) / this.cellHeight);

    return { row, col };
  }

  // --------------------------------------------------------------------------
  // PUBLIC API
  // --------------------------------------------------------------------------

  setSheet(sheet: Sheet): void {
    this.sheet = sheet;
    this.scrollX = 0;
    this.scrollY = 0;
    this.selectionManager.startSelection(0, 0);
    this.selectionManager.endSelection();
    this.render();
  }

  getSheet(): Sheet | undefined {
    return this.sheet;
  }

  refresh(): void {
    this.render();
  }

  getSelection(): Selection {
    return this.selectionManager.getSelection();
  }

  setCellChangeHandler(handler: (row: number, col: number, value: any) => void): void {
    this.onCellChange = handler;
  }

  setSelectionChangeHandler(handler: (selection: Selection) => void): void {
    this.onSelectionChange = handler;
  }

  focusCell(row: number, col: number): void {
    this.selectionManager.startSelection(row, col);
    this.selectionManager.endSelection();

    // Scroll to cell if not visible
    const cellX = col * this.cellWidth;
    const cellY = row * this.cellHeight;

    if (cellX < this.scrollX) {
      this.scrollX = cellX;
    } else if (cellX + this.cellWidth > this.scrollX + this.viewportWidth - this.headerWidth) {
      this.scrollX = cellX + this.cellWidth - this.viewportWidth + this.headerWidth;
    }

    if (cellY < this.scrollY) {
      this.scrollY = cellY;
    } else if (cellY + this.cellHeight > this.scrollY + this.viewportHeight - this.headerHeight) {
      this.scrollY = cellY + this.cellHeight - this.viewportHeight + this.headerHeight;
    }

    this.render();
  }
}
