/**
 * DJ DataForge v6 - Workbook Consolidated Module
 *
 * FUTURE SPLIT POINTS:
 * - workbook/workbook.ts (Workbook class)
 * - workbook/sheet.ts (Sheet class)
 * - workbook/column.ts (Column class)
 * - workbook/cell.ts (Cell utilities)
 * - workbook/manager.ts (WorkbookManager class)
 *
 * Combined for now to reduce artifact count during initial development.
 */

import { nanoid } from "nanoid";
import type {
  Cell,
  CellType,
  CellFormat,
  ValidationRule,
  WorkbookOptions,
  WorkbookMetadata,
} from "./types";

// ============================================================================
// COLUMN CLASS
// ============================================================================

export class Column {
  readonly id: string;
  name: string;
  type: CellType;
  width: number = 100;
  hidden: boolean = false;
  frozen: boolean = false;
  validation?: ValidationRule;

  constructor(name: string, type: CellType = "auto") {
    this.id = nanoid();
    this.name = name;
    this.type = type;
  }

  clone(): Column {
    const col = new Column(this.name, this.type);
    col.width = this.width;
    col.hidden = this.hidden;
    col.frozen = this.frozen;
    col.validation = this.validation ? { ...this.validation } : undefined;
    return col;
  }
}

// ============================================================================
// SHEET CLASS
// ============================================================================

export class Sheet {
  readonly id: string;
  name: string;
  columns: Map<number, Column> = new Map();
  rows: Map<number, Map<number, Cell>> = new Map();
  rowCount: number = 1000;
  colCount: number = 26;

  constructor(name: string = "Sheet1", id?: string) {
    this.id = id || nanoid();
    this.name = name;
    this.initDefaultColumns();
  }

  private initDefaultColumns(): void {
    for (let i = 0; i < this.colCount; i++) {
      const colName = this.indexToColumnName(i);
      this.columns.set(i, new Column(colName, "auto"));
    }
  }

  private indexToColumnName(idx: number): string {
    let name = "";
    let n = idx + 1;
    while (n > 0) {
      const remainder = (n - 1) % 26;
      name = String.fromCharCode(65 + remainder) + name;
      n = Math.floor((n - 1) / 26);
    }
    return name;
  }

  private columnNameToIndex(name: string): number {
    let index = 0;
    for (let i = 0; i < name.length; i++) {
      index = index * 26 + (name.charCodeAt(i) - 64);
    }
    return index - 1;
  }

  getRangeFromString(rangeStr: string): { start: { row: number; col: number }; end: { row: number; col: number } } | undefined {
    const parts = rangeStr.split(':');
    if (parts.length !== 2) return undefined;

    const startCell = parts[0].match(/([A-Z]+)(\d+)/);
    const endCell = parts[1].match(/([A-Z]+)(\d+)/);

    if (!startCell || !endCell) return undefined;

    const startCol = this.columnNameToIndex(startCell[1]);
    const startRow = parseInt(startCell[2], 10) - 1;
    const endCol = this.columnNameToIndex(endCell[1]);
    const endRow = parseInt(endCell[2], 10) - 1;

    return {
      start: { row: startRow, col: startCol },
      end: { row: endRow, col: endCol },
    };
  }

  // --------------------------------------------------------------------------
  // CELL OPERATIONS
  // --------------------------------------------------------------------------

  setCell(
    row: number,
    col: number,
    value: any,
    options?: { formula?: string; type?: CellType; format?: CellFormat }
  ): void {
    if (row < 0 || col < 0) {
      throw new Error(`Invalid cell coordinate: [${row}, ${col}]`);
    }

    // Expand if needed
    if (row >= this.rowCount) this.rowCount = row + 1;
    if (col >= this.colCount) this.expandColumns(col + 1);

    let rowMap = this.rows.get(row);
    if (!rowMap) {
      rowMap = new Map();
      this.rows.set(row, rowMap);
    }

    const cell: Cell = {
      value,
      type: options?.type || this.inferType(value),
      formula: options?.formula,
      format: options?.format,
    };

    rowMap.set(col, cell);
  }

  getCell(row: number, col: number): Cell | undefined {
    return this.rows.get(row)?.get(col);
  }

  getCellValue(row: number, col: number): any {
    const cell = this.getCell(row, col);
    return cell?.value;
  }

  getCellFormula(row: number, col: number): string | undefined {
    return this.getCell(row, col)?.formula;
  }

  clearCell(row: number, col: number): void {
    this.rows.get(row)?.delete(col);
  }

  clearRange(r1: number, c1: number, r2: number, c2: number): void {
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        this.clearCell(r, c);
      }
    }
  }

  // --------------------------------------------------------------------------
  // COLUMN OPERATIONS
  // --------------------------------------------------------------------------

  addColumn(idx: number, name: string, type: CellType = "auto"): Column {
    const col = new Column(name, type);
    this.columns.set(idx, col);
    if (idx >= this.colCount) this.colCount = idx + 1;
    return col;
  }

  getColumn(idx: number): Column | undefined {
    return this.columns.get(idx);
  }

  getColumnName(idx: number): string {
    const col = this.columns.get(idx);
    return col?.name || this.indexToColumnName(idx);
  }

  renameColumn(idx: number, newName: string): void {
    const col = this.columns.get(idx);
    if (col) col.name = newName;
  }

  private expandColumns(newColCount: number): void {
    const oldCount = this.colCount;
    this.colCount = newColCount;

    for (let i = oldCount; i < newColCount; i++) {
      if (!this.columns.has(i)) {
        const colName = this.indexToColumnName(i);
        this.columns.set(i, new Column(colName, "auto"));
      }
    }
  }

  // --------------------------------------------------------------------------
  // ROW OPERATIONS
  // --------------------------------------------------------------------------

  getRow(row: number): Map<number, Cell> | undefined {
    return this.rows.get(row);
  }

  insertRows(at: number, count: number = 1): void {
    // Shift rows down
    const rowsToShift: [number, Map<number, Cell>][] = [];
    this.rows.forEach((cells, rowIdx) => {
      if (rowIdx >= at) {
        rowsToShift.push([rowIdx, cells]);
      }
    });

    rowsToShift.sort((a, b) => b[0] - a[0]); // Sort descending
    rowsToShift.forEach(([oldRow, cells]) => {
      this.rows.delete(oldRow);
      this.rows.set(oldRow + count, cells);
    });

    this.rowCount += count;
  }

  deleteRows(at: number, count: number = 1): void {
    // Delete rows
    for (let i = at; i < at + count; i++) {
      this.rows.delete(i);
    }

    // Shift rows up
    const rowsToShift: [number, Map<number, Cell>][] = [];
    this.rows.forEach((cells, rowIdx) => {
      if (rowIdx > at + count - 1) {
        rowsToShift.push([rowIdx, cells]);
      }
    });

    rowsToShift.sort((a, b) => a[0] - b[0]); // Sort ascending
    rowsToShift.forEach(([oldRow, cells]) => {
      this.rows.delete(oldRow);
      this.rows.set(oldRow - count, cells);
    });

    this.rowCount = Math.max(0, this.rowCount - count);
  }

  // --------------------------------------------------------------------------
  // RANGE OPERATIONS
  // --------------------------------------------------------------------------

  getRange(r1: number, c1: number, r2: number, c2: number): Cell[][] {
    const result: Cell[][] = [];

    for (let r = r1; r <= r2; r++) {
      const row: Cell[] = [];
      for (let c = c1; c <= c2; c++) {
        const cell = this.getCell(r, c);
        row.push(cell || { value: null, type: "auto" });
      }
      result.push(row);
    }

    return result;
  }

  setRange(r1: number, c1: number, data: any[][]): void {
    for (let r = 0; r < data.length; r++) {
      for (let c = 0; c < data[r].length; c++) {
        this.setCell(r1 + r, c1 + c, data[r][c]);
      }
    }
  }

  // --------------------------------------------------------------------------
  // TYPE INFERENCE
  // --------------------------------------------------------------------------

  private inferType(value: any): CellType {
    if (value === null || value === undefined) return "auto";
    if (typeof value === "number") return "number";
    if (typeof value === "boolean") return "boolean";
    if (value instanceof Date) return "date";
    if (typeof value === "string") {
      if (value.startsWith("=")) return "formula";
      if (!isNaN(Date.parse(value))) return "date";
      if (!isNaN(parseFloat(value)) && isFinite(value as any)) return "number";
    }
    return "string";
  }

  // --------------------------------------------------------------------------
  // SERIALIZATION
  // --------------------------------------------------------------------------

  serialize(): any {
    const data: any = {
      id: this.id,
      name: this.name,
      rowCount: this.rowCount,
      colCount: this.colCount,
      cells: [],
      columns: [],
    };

    // Serialize cells
    this.rows.forEach((rowMap, r) => {
      rowMap.forEach((cell, c) => {
        data.cells.push({ r, c, ...cell });
      });
    });

    // Serialize columns
    this.columns.forEach((col, idx) => {
      data.columns.push({
        idx,
        id: col.id,
        name: col.name,
        type: col.type,
        width: col.width,
        hidden: col.hidden,
        frozen: col.frozen,
        validation: col.validation,
      });
    });

    return data;
  }

  static deserialize(data: any): Sheet {
    const sheet = new Sheet(data.name, data.id);
    sheet.rowCount = data.rowCount;
    sheet.colCount = data.colCount;

    // Restore cells
    data.cells?.forEach((cellData: any) => {
      sheet.setCell(cellData.r, cellData.c, cellData.value, {
        formula: cellData.formula,
        type: cellData.type,
        format: cellData.format,
      });
    });

    // Restore columns
    sheet.columns.clear();
    data.columns?.forEach((colData: any) => {
      const col = new Column(colData.name, colData.type);
      col.width = colData.width;
      col.hidden = colData.hidden;
      col.frozen = colData.frozen;
      col.validation = colData.validation;
      sheet.columns.set(colData.idx, col);
    });

    return sheet;
  }
}

// ============================================================================
// WORKBOOK CLASS
// ============================================================================

export class Workbook {
  readonly id: string;
  name: string;
  sheets: Map<string, Sheet> = new Map();
  activeSheetId?: string;
  version = "6.0.0";
  created: Date;
  modified: Date;
  author?: string;
  companyId?: string;
  private eventBus?: any;

  constructor(options: WorkbookOptions = {}, eventBus?: any) {
    this.id = options.id || nanoid();
    this.name = options.name || "Sem título";
    this.created = options.created || new Date();
    this.modified = new Date();
    this.author = options.author;
    this.eventBus = eventBus;
  }

  // --------------------------------------------------------------------------
  // SHEET OPERATIONS
  // --------------------------------------------------------------------------

  addSheet(name: string, _options?: { at?: number }): Sheet {
    const sheet = new Sheet(name);

    // Insert at position (simple implementation - just add to map)
    this.sheets.set(sheet.id, sheet);

    if (!this.activeSheetId) {
      this.activeSheetId = sheet.id;
    }

    this.modified = new Date();
    this.eventBus?.emit("sheet:created", { sheetId: sheet.id, workbookId: this.id });
    return sheet;
  }

  getSheet(id: string): Sheet | undefined {
    return this.sheets.get(id);
  }

  getActiveSheet(): Sheet | undefined {
    return this.activeSheetId ? this.sheets.get(this.activeSheetId) : undefined;
  }

  setActiveSheet(id: string): void {
    if (this.sheets.has(id)) {
      this.activeSheetId = id;
    }
  }

  renameSheet(id: string, newName: string): void {
    const sheet = this.sheets.get(id);
    if (sheet) {
      sheet.name = newName;
      this.modified = new Date();
    }
  }

  deleteSheet(id: string): boolean {
    if (this.sheets.size <= 1) {
      return false; // Can't delete last sheet
    }

    const deleted = this.sheets.delete(id);

    if (deleted && this.activeSheetId === id) {
      // Set first sheet as active
      this.activeSheetId = this.sheets.keys().next().value;
    }

    if (deleted) {
      this.modified = new Date();
      this.eventBus?.emit("sheet:deleted", { sheetId: id, workbookId: this.id });
    }

    return deleted;
  }

  listSheets(): Sheet[] {
    return Array.from(this.sheets.values());
  }

  // --------------------------------------------------------------------------
  // METADATA
  // --------------------------------------------------------------------------

  getMetadata(): WorkbookMetadata {
    return {
      id: this.id,
      name: this.name,
      version: this.version,
      created: this.created,
      modified: this.modified,
      author: this.author,
      companyId: this.companyId,
    };
  }

  // --------------------------------------------------------------------------
  // SERIALIZATION
  // --------------------------------------------------------------------------

  serialize(): any {
    const sheets: any[] = [];
    this.sheets.forEach((sheet) => {
      sheets.push(sheet.serialize());
    });
    return {
      id: this.id,
      name: this.name,
      version: this.version,
      created: this.created.toISOString(),
      modified: this.modified.toISOString(),
      author: this.author,
      companyId: this.companyId,
      activeSheetId: this.activeSheetId,
      sheets,
    };
  }

  static deserialize(data: any): Workbook {
    const wb = new Workbook({
      id: data.id,
      name: data.name,
      created: new Date(data.created),
      author: data.author,
    });
    wb.modified = new Date(data.modified);
    wb.companyId = data.companyId;
    wb.activeSheetId = data.activeSheetId;

    // Restore sheets
    wb.sheets.clear();
    data.sheets?.forEach((sheetData: any) => {
      const sheet = Sheet.deserialize(sheetData);
      wb.sheets.set(sheet.id, sheet);
    });

    return wb;
  }
}

// ============================================================================
// WORKBOOK MANAGER CLASS
// ============================================================================

export class WorkbookManager {
  private workbooks: Map<string, Workbook> = new Map();
  private activeWorkbookId?: string;
  private eventBus?: any;

  constructor(eventBus?: any) {
    this.eventBus = eventBus;
  }

  setEventBus(eventBus: any) {
    this.eventBus = eventBus;
    this.workbooks.forEach(wb => (wb as any).eventBus = eventBus);
  }

  // --------------------------------------------------------------------------
  // WORKBOOK CRUD
  // --------------------------------------------------------------------------

  createWorkbook(name?: string, options?: WorkbookOptions): Workbook {
    const wb = new Workbook({ ...options, name: name || "Sem título" }, this.eventBus);

    // Add default sheet
    wb.addSheet("Sheet1");

    this.workbooks.set(wb.id, wb);
    this.activeWorkbookId = wb.id;

    return wb;
  }

  getWorkbook(id: string): Workbook | undefined {
    return this.workbooks.get(id);
  }

  getActiveWorkbook(): Workbook | undefined {
    return this.activeWorkbookId
      ? this.workbooks.get(this.activeWorkbookId)
      : undefined;
  }

  setActiveWorkbook(id: string): boolean {
    if (this.workbooks.has(id)) {
      this.activeWorkbookId = id;
      return true;
    }
    return false;
  }

  deleteWorkbook(id: string): boolean {
    const deleted = this.workbooks.delete(id);

    if (deleted && this.activeWorkbookId === id) {
      // Set first workbook as active
      this.activeWorkbookId = this.workbooks.keys().next().value;
    }

    return deleted;
  }

  listWorkbooks(): Workbook[] {
    return Array.from(this.workbooks.values());
  }

  // --------------------------------------------------------------------------
  // SHEET OPERATIONS (convenience methods)
  // --------------------------------------------------------------------------

  getSheet(sheetId: string): Sheet | undefined {
    for (const wb of this.workbooks.values()) {
      const sheet = wb.getSheet(sheetId);
      if (sheet) return sheet;
    }
    return undefined;
  }

  getActiveSheet(): Sheet | undefined {
    const wb = this.getActiveWorkbook();
    return wb?.getActiveSheet();
  }

  // --------------------------------------------------------------------------
  // SERIALIZATION
  // --------------------------------------------------------------------------

  serialize(): any {
    const workbooks: any[] = [];
    this.workbooks.forEach((wb) => {
      workbooks.push(wb.serialize());
    });

    return {
      activeWorkbookId: this.activeWorkbookId,
      workbooks,
    };
  }

  deserialize(data: any): void {
    this.workbooks.clear();

    data.workbooks?.forEach((wbData: any) => {
      const wb = Workbook.deserialize(wbData);
      this.workbooks.set(wb.id, wb);
    });

    this.activeWorkbookId = data.activeWorkbookId;
  }
}
