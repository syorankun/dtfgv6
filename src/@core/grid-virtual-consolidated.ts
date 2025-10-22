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
  private isEditingFormula = false;
  private editingRow = -1;
  private editingCol = -1;
  private editor?: HTMLInputElement;

  // Formula visual feedback
  private formulaReferencedCells: Set<string> = new Set();
  private formulaReferenceColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'];
  private currentColorIndex = 0;

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
      // If editing a formula, add cell reference instead of changing selection
      if (this.isEditingFormula && this.editor) {
        this.addCellReferenceToFormula(cellPos.row, cellPos.col);
        e.preventDefault();
        this.editor.focus();
        return;
      }

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
        // If editing formula, extend the range reference
        if (this.isEditingFormula && this.editor) {
          this.extendRangeReferenceInFormula(cellPos.row, cellPos.col);
          return;
        }

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

    const selection = this.selectionManager.getSelection();
    const currentRow = selection.start.row;
    const currentCol = selection.start.col;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) {
          // Ctrl+Up: Jump to top
          this.selectionManager.setSelection(0, currentCol, 0, currentCol);
        } else {
          this.selectionManager.moveSelection(-1, 0);
        }
        this.onSelectionChange?.(this.selectionManager.getSelection());
        this.ensureCellVisible(this.selectionManager.getSelection().start.row, currentCol);
        this.render();
        break;

      case 'ArrowDown':
      case 'Enter':
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) {
          // Ctrl+Down: Jump to last row with data
          const lastRow = this.sheet ? this.sheet.rowCount - 1 : 0;
          this.selectionManager.setSelection(lastRow, currentCol, lastRow, currentCol);
        } else {
          this.selectionManager.moveSelection(1, 0);
        }
        this.onSelectionChange?.(this.selectionManager.getSelection());
        this.ensureCellVisible(this.selectionManager.getSelection().start.row, currentCol);
        this.render();
        break;

      case 'ArrowLeft':
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) {
          // Ctrl+Left: Jump to first column
          this.selectionManager.setSelection(currentRow, 0, currentRow, 0);
        } else {
          this.selectionManager.moveSelection(0, -1);
        }
        this.onSelectionChange?.(this.selectionManager.getSelection());
        this.ensureCellVisible(currentRow, this.selectionManager.getSelection().start.col);
        this.render();
        break;

      case 'ArrowRight':
      case 'Tab':
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) {
          // Ctrl+Right: Jump to last column with data
          const lastCol = this.sheet ? this.sheet.colCount - 1 : 0;
          this.selectionManager.setSelection(currentRow, lastCol, currentRow, lastCol);
        } else {
          this.selectionManager.moveSelection(0, 1);
        }
        this.onSelectionChange?.(this.selectionManager.getSelection());
        this.ensureCellVisible(currentRow, this.selectionManager.getSelection().start.col);
        this.render();
        break;

      case 'PageUp':
        e.preventDefault();
        const pageUpRows = Math.floor(this.viewportHeight / this.cellHeight) - 1;
        const newRowUp = Math.max(0, currentRow - pageUpRows);
        this.selectionManager.setSelection(newRowUp, currentCol, newRowUp, currentCol);
        this.onSelectionChange?.(this.selectionManager.getSelection());
        this.ensureCellVisible(newRowUp, currentCol);
        this.render();
        break;

      case 'PageDown':
        e.preventDefault();
        const pageDownRows = Math.floor(this.viewportHeight / this.cellHeight) - 1;
        const maxRow = this.sheet ? this.sheet.rowCount - 1 : 0;
        const newRowDown = Math.min(maxRow, currentRow + pageDownRows);
        this.selectionManager.setSelection(newRowDown, currentCol, newRowDown, currentCol);
        this.onSelectionChange?.(this.selectionManager.getSelection());
        this.ensureCellVisible(newRowDown, currentCol);
        this.render();
        break;

      case 'Home':
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) {
          // Ctrl+Home: Go to A1
          this.selectionManager.setSelection(0, 0, 0, 0);
          this.scrollX = 0;
          this.scrollY = 0;
        } else {
          // Home: Go to first column
          this.selectionManager.setSelection(currentRow, 0, currentRow, 0);
          this.scrollX = 0;
        }
        this.onSelectionChange?.(this.selectionManager.getSelection());
        this.render();
        break;

      case 'End':
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) {
          // Ctrl+End: Go to last cell with data
          const lastRow = this.sheet ? this.sheet.rowCount - 1 : 0;
          const lastCol = this.sheet ? this.sheet.colCount - 1 : 0;
          this.selectionManager.setSelection(lastRow, lastCol, lastRow, lastCol);
          this.ensureCellVisible(lastRow, lastCol);
        } else {
          // End: Go to last column
          const lastCol = this.sheet ? this.sheet.colCount - 1 : 0;
          this.selectionManager.setSelection(currentRow, lastCol, currentRow, lastCol);
          this.ensureCellVisible(currentRow, lastCol);
        }
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

    // Smooth scrolling multiplier
    const scrollSpeed = 1.0;
    this.scrollY += e.deltaY * scrollSpeed;
    this.scrollX += e.deltaX * scrollSpeed;

    // Clamp scroll
    const maxScrollY = Math.max(0, (this.sheet?.rowCount || 0) * this.cellHeight - this.viewportHeight + this.headerHeight);
    const maxScrollX = Math.max(0, (this.sheet?.colCount || 0) * this.cellWidth - this.viewportWidth + this.headerWidth);

    this.scrollY = Math.max(0, Math.min(maxScrollY, this.scrollY));
    this.scrollX = Math.max(0, Math.min(maxScrollX, this.scrollX));

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

    // Render formula reference highlights (original visual style)
    if (this.isEditingFormula && this.formulaReferencedCells.size > 0) {
      this.renderFormulaReferences(startRow, endRow, startCol, endCol);
    }

    // Render corner header
    this.renderer.renderHeader(0, 0, this.headerWidth, this.headerHeight, '', false);
  }

  private renderFormulaReferences(startRow: number, endRow: number, startCol: number, endCol: number): void {
    const ctx = this.ctx;
    let colorIdx = 0;

    this.formulaReferencedCells.forEach(cellKey => {
      const [rowStr, colStr] = cellKey.split(',');
      const row = parseInt(rowStr);
      const col = parseInt(colStr);

      // Only render if in viewport
      if (row >= startRow && row < endRow && col >= startCol && col < endCol) {
        const x = this.headerWidth + (col * this.cellWidth) - this.scrollX;
        const y = this.headerHeight + (row * this.cellHeight) - this.scrollY;
        const color = this.formulaReferenceColors[colorIdx % this.formulaReferenceColors.length];

        // Draw pulsing border effect (original style)
        ctx.save();

        // Outer glow
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 2, y + 2, this.cellWidth - 4, this.cellHeight - 4);

        // Inner highlight
        ctx.shadowBlur = 0;
        ctx.fillStyle = color + '20'; // 20 = 12.5% opacity
        ctx.fillRect(x + 1, y + 1, this.cellWidth - 2, this.cellHeight - 2);

        // Corner indicator (small circle in top-right)
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x + this.cellWidth - 8, y + 8, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
        colorIdx++;
      }
    });
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
    this.editingRow = row;
    this.editingCol = col;

    // Clear formula reference tracking
    this.formulaReferencedCells.clear();
    this.currentColorIndex = 0;

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

    // Check if editing a formula
    this.updateFormulaEditingState();

    // Handle editor events
    this.editor.addEventListener('input', () => this.updateFormulaEditingState());
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
    this.isEditingFormula = false;
    this.editingRow = -1;
    this.editingCol = -1;
    this.formulaReferencedCells.clear();
    this.currentColorIndex = 0;

    if (save && this.sheet) {
      const value = editor.value.trim();

      // Check if it's a formula
      if (value.startsWith('=')) {
        // Set formula - CalcEngine will compute it
        this.sheet.setCell(row, col, 0, {
          formula: value,
          type: 'formula',
        });

        // Trigger immediate recalculation - DON'T render yet, wait for callback
        this.onCellChange?.(row, col, value);
      } else {
        // Try to parse as number
        const numValue = parseFloat(value);
        if (!isNaN(numValue) && value !== '') {
          this.sheet.setCell(row, col, numValue);
        } else {
          this.sheet.setCell(row, col, value);
        }

        this.onCellChange?.(row, col, value);
      }
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

    // Always render, but for formulas, schedule another render after recalc
    this.render();

    // For formulas, wait a bit and render again to ensure calculated value shows
    if (save && value.startsWith('=')) {
      setTimeout(() => {
        this.render();
      }, 50);
    }
  }

  // --------------------------------------------------------------------------
  // FORMULA EDITING HELPERS
  // --------------------------------------------------------------------------

  private updateFormulaEditingState(): void {
    if (!this.editor) return;
    this.isEditingFormula = this.editor.value.startsWith('=');
  }

  private addCellReferenceToFormula(row: number, col: number): void {
    if (!this.editor || !this.sheet) return;

    const cellRef = this.getCellReference(row, col);
    const currentValue = this.editor.value;
    const cursorPos = this.editor.selectionStart || currentValue.length;

    // Insert cell reference at cursor position
    const newValue = currentValue.substring(0, cursorPos) + cellRef + currentValue.substring(cursorPos);
    this.editor.value = newValue;

    // Move cursor after the inserted reference
    const newCursorPos = cursorPos + cellRef.length;
    this.editor.setSelectionRange(newCursorPos, newCursorPos);
    this.editor.focus();

    // Add to visual feedback tracking
    this.formulaReferencedCells.add(`${row},${col}`);
    this.render(); // Re-render to show visual feedback
  }

  private extendRangeReferenceInFormula(row: number, col: number): void {
    if (!this.editor || !this.sheet) return;

    const cellRef = this.getCellReference(row, col);
    const currentValue = this.editor.value;

    // Find the last cell reference in the formula
    const lastRefMatch = currentValue.match(/([A-Z]+\d+)(?!.*[A-Z]+\d+)/);

    if (lastRefMatch) {
      const lastRef = lastRefMatch[1];
      const lastRefIndex = currentValue.lastIndexOf(lastRef);

      // Check if it's already a range
      const beforeLastRef = currentValue.substring(0, lastRefIndex);
      if (beforeLastRef.endsWith(':')) {
        // Replace the end of the range
        const newValue = currentValue.substring(0, lastRefIndex) + cellRef;
        this.editor.value = newValue;
      } else {
        // Convert to range
        const newValue = currentValue.substring(0, lastRefIndex + lastRef.length) + ':' + cellRef + currentValue.substring(lastRefIndex + lastRef.length);
        this.editor.value = newValue;
      }

      // Move cursor to the end
      this.editor.setSelectionRange(this.editor.value.length, this.editor.value.length);
      this.editor.focus();

      // Add to visual feedback tracking
      this.formulaReferencedCells.add(`${row},${col}`);
      this.render(); // Re-render to show visual feedback
    }
  }

  private getCellReference(row: number, col: number): string {
    if (!this.sheet) return '';
    return this.sheet.getColumnName(col) + (row + 1);
  }

  private ensureCellVisible(row: number, col: number): void {
    // Calculate cell position
    const cellX = col * this.cellWidth;
    const cellY = row * this.cellHeight;

    // Calculate viewport boundaries
    const viewportLeft = this.scrollX;
    const viewportRight = this.scrollX + this.viewportWidth - this.headerWidth;
    const viewportTop = this.scrollY;
    const viewportBottom = this.scrollY + this.viewportHeight - this.headerHeight;

    // Smooth scroll to make cell visible
    let needsScroll = false;

    // Horizontal scroll
    if (cellX < viewportLeft) {
      this.scrollX = Math.max(0, cellX - this.cellWidth);
      needsScroll = true;
    } else if (cellX + this.cellWidth > viewportRight) {
      this.scrollX = cellX + this.cellWidth - (this.viewportWidth - this.headerWidth) + this.cellWidth;
      needsScroll = true;
    }

    // Vertical scroll
    if (cellY < viewportTop) {
      this.scrollY = Math.max(0, cellY - this.cellHeight);
      needsScroll = true;
    } else if (cellY + this.cellHeight > viewportBottom) {
      this.scrollY = cellY + this.cellHeight - (this.viewportHeight - this.headerHeight) + this.cellHeight;
      needsScroll = true;
    }

    // Clamp scroll values
    this.scrollX = Math.max(0, this.scrollX);
    this.scrollY = Math.max(0, this.scrollY);

    if (needsScroll) {
      this.render();
    }
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
