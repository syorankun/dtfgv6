/**
 * DJ DataForge v6 - I/O & Transform Consolidated Module
 *
 * FUTURE SPLIT POINTS:
 * - io/readers.ts (CSV, XLSX, JSON readers)
 * - io/writers.ts (Export functionality)
 * - io/sniffer.ts (Format detection)
 * - io/schema.ts (Type inference)
 * - transform/steps.ts (Filter, Sort, Group, Pivot)
 * - transform/pipeline.ts (Transform orchestrator)
 * - transform/undo-redo.ts (Command pattern)
 */

import Papa from "papaparse";
import * as XLSX from "xlsx";
import { Sheet, Workbook } from "./workbook-consolidated";
// import { logger } from "./storage-utils-consolidated";
import type {
  // FileFormat,
  ImportOptions,
  ExportOptions,
  // TransformStep,
  FilterCondition,
  SortSpec,
} from "./types";

// ============================================================================
// FILE READERS
// ============================================================================

export class FileReader {
  /**
   * Read CSV file
   */
  static async readCSV(file: File, options?: ImportOptions): Promise<any[][]> {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        complete: (results) => {
          let data = results.data as any[][];

          // Skip rows if specified
          if (options?.skipRows) {
            data = data.slice(options.skipRows);
          }

          resolve(data);
        },
        error: (error) => reject(error),
        delimiter: options?.delimiter || ",",
        encoding: options?.encoding || "UTF-8",
      });
    });
  }

  /**
   * Read XLSX file
   */
  static async readXLSX(file: File, options?: ImportOptions): Promise<any[][]> {
    return new Promise((resolve, reject) => {
      const fileReader = new (window as any).FileReader();

      fileReader.onload = (e: any) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });

          const sheetIndex = options?.sheetIndex || 0;
          const sheetName = workbook.SheetNames[sheetIndex];
          const worksheet = workbook.Sheets[sheetName];

          const jsonData = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            defval: null,
          }) as any[][];

          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      };

      fileReader.onerror = () => reject(fileReader.error);
      fileReader.readAsArrayBuffer(file);
    });
  }

  /**
   * Read JSON file
   */
  static async readJSON(file: File): Promise<any> {
    return new Promise((resolve, reject) => {
      const fileReader = new (window as any).FileReader();

      fileReader.onload = (e: any) => {
        try {
          const json = JSON.parse(e.target?.result as string);
          resolve(json);
        } catch (error) {
          reject(error);
        }
      };

      fileReader.onerror = () => reject(fileReader.error);
      fileReader.readAsText(file);
    });
  }

  /**
   * Auto-detect format and read
   */
  static async readAuto(file: File, options?: ImportOptions): Promise<any[][]> {
    const ext = file.name.split(".").pop()?.toLowerCase();

    switch (ext) {
      case "csv":
        return this.readCSV(file, options);
      case "xlsx":
      case "xls":
        return this.readXLSX(file, options);
      case "json":
        const json = await this.readJSON(file);
        // Convert JSON to 2D array
        if (Array.isArray(json)) {
          return json;
        }
        return [[json]];
      default:
        throw new Error(`Unsupported file format: ${ext}`);
    }
  }
}

// ============================================================================
// FILE WRITERS
// ============================================================================

export class FileWriter {
  /**
   * Export sheet to CSV
   */
  static exportCSV(sheet: Sheet, options?: ExportOptions): Blob {
    const rows: any[][] = [];

    // Add headers
    if (options?.includeHeaders !== false) {
      const headers: any[] = [];
      for (let c = 0; c < sheet.colCount; c++) {
        headers.push(sheet.getColumnName(c));
      }
      rows.push(headers);
    }

    // Add data
    for (let r = 0; r < sheet.rowCount; r++) {
      const row: any[] = [];
      for (let c = 0; c < sheet.colCount; c++) {
        const value = sheet.getCellValue(r, c);
        row.push(value ?? "");
      }

      // Skip empty rows
      if (row.some((v) => v !== "")) {
        rows.push(row);
      }
    }

    const csv = Papa.unparse(rows);
    return new Blob([csv], { type: "text/csv;charset=utf-8;" });
  }

  /**
   * Export sheet to XLSX
   */
  static exportXLSX(workbook: Workbook, options?: ExportOptions): Blob {
    const wb = XLSX.utils.book_new();

    workbook.sheets.forEach((sheet, _id) => {
      const data: any[][] = [];

      // Add headers
      if (options?.includeHeaders !== false) {
        const headers: any[] = [];
        for (let c = 0; c < sheet.colCount; c++) {
          headers.push(sheet.getColumnName(c));
        }
        data.push(headers);
      }

      // Add data
      for (let r = 0; r < sheet.rowCount; r++) {
        const row: any[] = [];
        for (let c = 0; c < sheet.colCount; c++) {
          const cell = sheet.getCell(r, c);
          row.push((cell?.formula || cell?.value) ?? "");
        }

        if (row.some((v) => v !== "")) {
          data.push(row);
        }
      }

      const ws = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, sheet.name);
    });

    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    return new Blob([wbout], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  }

  /**
   * Export sheet to JSON
   */
  static exportJSON(sheet: Sheet, _options?: ExportOptions): Blob {
    const data: any[] = [];

    // Get column names
    const columns: string[] = [];
    for (let c = 0; c < sheet.colCount; c++) {
      columns.push(sheet.getColumnName(c));
    }

    // Convert rows to objects
    for (let r = 0; r < sheet.rowCount; r++) {
      const obj: any = {};
      let hasData = false;

      for (let c = 0; c < sheet.colCount; c++) {
        const value = sheet.getCellValue(r, c);
        if (value !== null && value !== undefined) {
          obj[columns[c]] = value;
          hasData = true;
        }
      }

      if (hasData) {
        data.push(obj);
      }
    }

    const json = JSON.stringify(data, null, 2);
    return new Blob([json], { type: "application/json;charset=utf-8;" });
  }

  /**
   * Trigger download
   */
  static download(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

// ============================================================================
// SCHEMA INFERENCE
// ============================================================================

export class SchemaInference {
  /**
   * Infer column types from data
   */
  static inferSchema(
    data: any[][],
    hasHeaders: boolean = true
  ): Map<number, string> {
    const schema = new Map<number, string>();

    const startRow = hasHeaders ? 1 : 0;
    const sampleSize = Math.min(100, data.length - startRow);

    for (let c = 0; c < data[0]?.length || 0; c++) {
      const samples: any[] = [];

      for (let r = startRow; r < startRow + sampleSize; r++) {
        const value = data[r]?.[c];
        if (value !== null && value !== undefined && value !== "") {
          samples.push(value);
        }
      }

      const type = this.inferColumnType(samples);
      schema.set(c, type);
    }

    return schema;
  }

  private static inferColumnType(samples: any[]): string {
    if (samples.length === 0) return "string";

    let numberCount = 0;
    let dateCount = 0;
    let boolCount = 0;

    for (const sample of samples) {
      if (typeof sample === "number") {
        numberCount++;
      } else if (typeof sample === "boolean") {
        boolCount++;
      } else if (typeof sample === "string") {
        // Check if it's a number
        if (!isNaN(parseFloat(sample)) && isFinite(sample as any)) {
          numberCount++;
        }
        // Check if it's a date
        else if (!isNaN(Date.parse(sample))) {
          dateCount++;
        }
      }
    }

    const total = samples.length;

    if (numberCount / total > 0.8) return "number";
    if (dateCount / total > 0.8) return "date";
    if (boolCount / total > 0.8) return "boolean";

    return "string";
  }
}

// ============================================================================
// TRANSFORM OPERATIONS
// ============================================================================

export class TransformOps {
  /**
   * Filter rows
   */
  static filter(sheet: Sheet, conditions: FilterCondition[]): Sheet {
    const filtered = new Sheet(sheet.name + " (Filtered)");

    // Copy columns
    sheet.columns.forEach((col, idx) => {
      filtered.columns.set(idx, col.clone());
    });

    let targetRow = 0;

    for (let r = 0; r < sheet.rowCount; r++) {
      if (this.matchesConditions(sheet, r, conditions)) {
        for (let c = 0; c < sheet.colCount; c++) {
          const cell = sheet.getCell(r, c);
          if (cell) {
            filtered.setCell(targetRow, c, cell.value, {
              formula: cell.formula,
              type: cell.type,
              format: cell.format,
            });
          }
        }
        targetRow++;
      }
    }

    filtered.rowCount = targetRow;
    return filtered;
  }

  private static matchesConditions(
    sheet: Sheet,
    row: number,
    conditions: FilterCondition[]
  ): boolean {
    for (const cond of conditions) {
      const value = sheet.getCellValue(row, cond.column);

      if (!this.matchesCondition(value, cond.operator, cond.value)) {
        return false;
      }
    }
    return true;
  }

  private static matchesCondition(
    value: any,
    operator: string,
    target: any
  ): boolean {
    switch (operator) {
      case "=":
        return value === target;
      case "!=":
        return value !== target;
      case ">":
        return value > target;
      case "<":
        return value < target;
      case ">=":
        return value >= target;
      case "<=":
        return value <= target;
      case "contains":
        return String(value)
          .toLowerCase()
          .includes(String(target).toLowerCase());
      case "startsWith":
        return String(value)
          .toLowerCase()
          .startsWith(String(target).toLowerCase());
      case "endsWith":
        return String(value)
          .toLowerCase()
          .endsWith(String(target).toLowerCase());
      default:
        return false;
    }
  }

  /**
   * Sort rows
   */
  static sort(sheet: Sheet, specs: SortSpec[]): Sheet {
    const sorted = new Sheet(sheet.name + " (Sorted)");

    // Copy columns
    sheet.columns.forEach((col, idx) => {
      sorted.columns.set(idx, col.clone());
    });

    // Collect all rows with data
    const rows: { index: number; cells: Map<number, any> }[] = [];

    for (let r = 0; r < sheet.rowCount; r++) {
      const rowData = sheet.getRow(r);
      if (rowData && rowData.size > 0) {
        rows.push({ index: r, cells: rowData });
      }
    }

    // Sort rows
    rows.sort((a, b) => {
      for (const spec of specs) {
        const aVal = sheet.getCellValue(a.index, spec.column);
        const bVal = sheet.getCellValue(b.index, spec.column);

        let cmp = 0;
        if (aVal < bVal) cmp = -1;
        else if (aVal > bVal) cmp = 1;

        if (cmp !== 0) {
          return spec.direction === "asc" ? cmp : -cmp;
        }
      }
      return 0;
    });

    // Copy sorted rows
    rows.forEach((row, targetRow) => {
      for (let c = 0; c < sheet.colCount; c++) {
        const cell = sheet.getCell(row.index, c);
        if (cell) {
          sorted.setCell(targetRow, c, cell.value, {
            formula: cell.formula,
            type: cell.type,
            format: cell.format,
          });
        }
      }
    });

    sorted.rowCount = rows.length;
    return sorted;
  }

  /**
   * Group by column
   */
  static groupBy(
    sheet: Sheet,
    column: number,
    aggregations: { column: number; func: string }[]
  ): Sheet {
    const grouped = new Sheet(sheet.name + " (Grouped)");

    // Build groups
    const groups = new Map<any, number[]>();

    for (let r = 0; r < sheet.rowCount; r++) {
      const key = sheet.getCellValue(r, column);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(r);
    }

    // Set columns
    grouped.addColumn(0, sheet.getColumnName(column), "string");
    aggregations.forEach((agg, idx) => {
      grouped.addColumn(
        idx + 1,
        `${agg.func}(${sheet.getColumnName(agg.column)})`,
        "number"
      );
    });

    // Calculate aggregations
    let targetRow = 0;
    groups.forEach((rows, key) => {
      grouped.setCell(targetRow, 0, key);

      aggregations.forEach((agg, idx) => {
        const values = rows
          .map((r) => sheet.getCellValue(r, agg.column))
          .filter((v) => typeof v === "number");

        let result = 0;
        switch (agg.func.toUpperCase()) {
          case "SUM":
            result = values.reduce((sum, v) => sum + v, 0);
            break;
          case "AVG":
            result =
              values.length > 0
                ? values.reduce((sum, v) => sum + v, 0) / values.length
                : 0;
            break;
          case "COUNT":
            result = values.length;
            break;
          case "MIN":
            result = values.length > 0 ? Math.min(...values) : 0;
            break;
          case "MAX":
            result = values.length > 0 ? Math.max(...values) : 0;
            break;
        }

        grouped.setCell(targetRow, idx + 1, result);
      });

      targetRow++;
    });

    grouped.rowCount = targetRow;
    return grouped;
  }
}

// ============================================================================
// UNDO/REDO SYSTEM
// ============================================================================

interface Command {
  execute(): void;
  undo(): void;
}

export class UndoRedoManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private maxStack = 100;

  execute(command: Command): void {
    command.execute();
    this.undoStack.push(command);
    this.redoStack = []; // Clear redo stack

    // Limit stack size
    if (this.undoStack.length > this.maxStack) {
      this.undoStack.shift();
    }
  }

  undo(): boolean {
    const command = this.undoStack.pop();
    if (!command) return false;

    command.undo();
    this.redoStack.push(command);
    return true;
  }

  redo(): boolean {
    const command = this.redoStack.pop();
    if (!command) return false;

    command.execute();
    this.undoStack.push(command);
    return true;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}

// Command implementations
export class SetCellCommand implements Command {
  constructor(
    private sheet: Sheet,
    private row: number,
    private col: number,
    private newValue: any,
    private oldValue: any,
    private options?: any
  ) {}

  execute(): void {
    this.sheet.setCell(this.row, this.col, this.newValue, this.options);
  }

  undo(): void {
    if (this.oldValue === undefined) {
      this.sheet.clearCell(this.row, this.col);
    } else {
      this.sheet.setCell(this.row, this.col, this.oldValue);
    }
  }
}
