/**
 * DJ DataForge v6 - Table Manager
 *
 * Manages structured tables with intelligent data type detection,
 * formatting, and advanced features.
 */

import { nanoid } from 'nanoid';
import type {
  StructuredTable,
  TableColumn,
  TableStyle,
  TableCreationOptions,
  TableColumnDataType,
  Range,
  CellFormat
} from './types';
import type { Sheet } from './workbook-consolidated';
import { logger } from './storage-utils-consolidated';

// ============================================================================
// TABLE STYLES PRESETS
// ============================================================================

export const TABLE_STYLES: Record<string, TableStyle> = {
  'modern-blue': {
    id: 'modern-blue',
    name: 'Azul Moderno',
    headerBg: '#2563eb',
    headerText: '#ffffff',
    evenRowBg: '#f8fafc',
    oddRowBg: '#ffffff',
    borderColor: '#e2e8f0',
    totalRowBg: '#3b82f6',
    highlightColor: '#dbeafe'
  },
  'dark-slate': {
    id: 'dark-slate',
    name: 'Ardósia Escura',
    headerBg: '#1e293b',
    headerText: '#ffffff',
    evenRowBg: '#f8fafc',
    oddRowBg: '#ffffff',
    borderColor: '#cbd5e1',
    totalRowBg: '#334155',
    highlightColor: '#e2e8f0'
  },
  'green-eco': {
    id: 'green-eco',
    name: 'Verde Eco',
    headerBg: '#059669',
    headerText: '#ffffff',
    evenRowBg: '#f0fdf4',
    oddRowBg: '#ffffff',
    borderColor: '#d1fae5',
    totalRowBg: '#10b981',
    highlightColor: '#d1fae5'
  },
  'purple-elegant': {
    id: 'purple-elegant',
    name: 'Roxo Elegante',
    headerBg: '#7c3aed',
    headerText: '#ffffff',
    evenRowBg: '#faf5ff',
    oddRowBg: '#ffffff',
    borderColor: '#e9d5ff',
    totalRowBg: '#8b5cf6',
    highlightColor: '#ede9fe'
  },
  'orange-vibrant': {
    id: 'orange-vibrant',
    name: 'Laranja Vibrante',
    headerBg: '#ea580c',
    headerText: '#ffffff',
    evenRowBg: '#fff7ed',
    oddRowBg: '#ffffff',
    borderColor: '#fed7aa',
    totalRowBg: '#f97316',
    highlightColor: '#ffedd5'
  },
  'minimal-gray': {
    id: 'minimal-gray',
    name: 'Cinza Minimalista',
    headerBg: '#6b7280',
    headerText: '#ffffff',
    evenRowBg: '#fafafa',
    oddRowBg: '#ffffff',
    borderColor: '#e5e7eb',
    totalRowBg: '#9ca3af',
    highlightColor: '#f3f4f6'
  }
};

// ============================================================================
// DATA TYPE DETECTION
// ============================================================================

export class DataTypeAnalyzer {
  /**
   * Analyze column data and determine the best data type
   */
  static analyzeColumn(values: any[]): TableColumnDataType {
    if (values.length === 0) return 'auto';

    const nonEmptyValues = values.filter(v => v !== null && v !== undefined && v !== '');
    if (nonEmptyValues.length === 0) return 'text';

    // Sample up to 100 values for performance
    const sample = nonEmptyValues.slice(0, Math.min(100, nonEmptyValues.length));

    // Check for specific patterns
    const typeCounts = {
      number: 0,
      currency: 0,
      percentage: 0,
      date: 0,
      datetime: 0,
      boolean: 0,
      email: 0,
      url: 0,
      text: 0
    };

    for (const value of sample) {
      const strValue = String(value).trim();

      if (this.isBoolean(strValue)) {
        typeCounts.boolean++;
      } else if (this.isEmail(strValue)) {
        typeCounts.email++;
      } else if (this.isURL(strValue)) {
        typeCounts.url++;
      } else if (this.isDateTime(strValue)) {
        typeCounts.datetime++;
      } else if (this.isDate(strValue)) {
        typeCounts.date++;
      } else if (this.isPercentage(strValue)) {
        typeCounts.percentage++;
      } else if (this.isCurrency(strValue)) {
        typeCounts.currency++;
      } else if (this.isNumber(value)) {
        typeCounts.number++;
      } else {
        typeCounts.text++;
      }
    }

    // Determine type by majority (>= 70% threshold)
    const threshold = sample.length * 0.7;

    if (typeCounts.boolean >= threshold) return 'boolean';
    if (typeCounts.email >= threshold) return 'email';
    if (typeCounts.url >= threshold) return 'url';
    if (typeCounts.datetime >= threshold) return 'datetime';
    if (typeCounts.date >= threshold) return 'date';
    if (typeCounts.percentage >= threshold) return 'percentage';
    if (typeCounts.currency >= threshold) return 'currency';
    if (typeCounts.number >= threshold) return 'number';

    // Check for category (repeated values)
    const uniqueValues = new Set(sample.map(v => String(v)));
    if (uniqueValues.size <= sample.length * 0.3 && uniqueValues.size <= 20) {
      return 'category';
    }

    return 'text';
  }

  private static isBoolean(value: string): boolean {
    const lower = value.toLowerCase();
    return ['true', 'false', 'yes', 'no', 'sim', 'não', 'verdadeiro', 'falso', '1', '0'].includes(lower);
  }

  private static isEmail(value: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  }

  private static isURL(value: string): boolean {
    const urlRegex = /^https?:\/\/.+/i;
    return urlRegex.test(value);
  }

  private static isDate(value: string): boolean {
    // Check common date formats
    const datePatterns = [
      /^\d{1,2}\/\d{1,2}\/\d{2,4}$/,  // DD/MM/YYYY or MM/DD/YYYY
      /^\d{4}-\d{2}-\d{2}$/,           // YYYY-MM-DD
      /^\d{1,2}-\d{1,2}-\d{2,4}$/     // DD-MM-YYYY
    ];

    return datePatterns.some(pattern => pattern.test(value)) && !isNaN(Date.parse(value));
  }

  private static isDateTime(value: string): boolean {
    // Check if it has time component
    return value.includes(':') && !isNaN(Date.parse(value));
  }

  private static isNumber(value: any): boolean {
    if (typeof value === 'number') return true;
    const str = String(value).trim().replace(/,/g, '');
    return !isNaN(parseFloat(str)) && isFinite(parseFloat(str));
  }

  private static isCurrency(value: string): boolean {
    // Check for currency symbols
    const currencyRegex = /^[R$€£¥]?\s*-?\d{1,3}([\.,]\d{3})*([\.,']\d{2})?$/;
    return currencyRegex.test(value.trim());
  }

  private static isPercentage(value: string): boolean {
    const percentRegex = /^-?\d+([.,]\d+)?%$/;
    return percentRegex.test(value.trim());
  }

  /**
   * Get suggested format based on data type
   */
  static getFormatForType(dataType: TableColumnDataType): CellFormat {
    const formats: Record<TableColumnDataType, CellFormat> = {
      'text': {},
      'number': { numberFormat: '#,##0.00' },
      'currency': { numberFormat: 'R$ #,##0.00' },
      'percentage': { numberFormat: '0.00%' },
      'date': { numberFormat: 'DD/MM/YYYY' },
      'datetime': { numberFormat: 'DD/MM/YYYY HH:mm' },
      'boolean': { alignment: 'center' },
      'category': {},
      'email': { textColor: '#2563eb' },
      'url': { textColor: '#2563eb', underline: true },
      'auto': {}
    };

    return formats[dataType] || {};
  }
}

// ============================================================================
// TABLE MANAGER (Singleton)
// ============================================================================

export class TableManager {
  private static instance: TableManager;
  private tables: Map<string, StructuredTable> = new Map();
  private tableNameCounter: number = 1;

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): TableManager {
    if (!TableManager.instance) {
      TableManager.instance = new TableManager();
    }
    return TableManager.instance;
  }

  /**
   * Create a new structured table
   */
  createTable(sheet: Sheet, options: TableCreationOptions = {}): StructuredTable {
    // Determine range
    let range: Range;
    if (options.range) {
      range = options.range;
    } else if (options.autoDetectRange) {
      range = this.detectDataRange(sheet);
    } else {
      throw new Error('Range ou autoDetectRange deve ser fornecido');
    }

    // Validate range has data
    if (range.endRow < range.startRow || range.endCol < range.startCol) {
      throw new Error('Intervalo inválido');
    }

    // Determine if has headers
    const hasHeaders = options.hasHeaders ?? true;

    // Create columns
    const columns = this.createColumnsFromRange(sheet, range, hasHeaders, options.analyzeDataTypes ?? true);

    // Generate table name
    const tableName = options.tableName || this.generateTableName();

    // Get style
    const style = options.styleName && TABLE_STYLES[options.styleName]
      ? TABLE_STYLES[options.styleName]
      : TABLE_STYLES['modern-blue'];

    // Create table object
    const table: StructuredTable = {
      id: nanoid(),
      name: tableName,
      sheetId: sheet.id,
      range,
      hasHeaders,
      columns,
      style,
      showTotalRow: false,
      showHeaderRow: true,
      showBandedRows: true,
      showBandedColumns: false,
      showFilterButtons: true,
      created: new Date(),
      modified: new Date()
    };

    this.tables.set(table.id, table);

    logger.info('[TableManager] Table created', {
      id: table.id,
      name: table.name,
      columns: columns.length,
      rows: range.endRow - range.startRow + 1
    });

    return table;
  }

  /**
   * Auto-detect data range from current selection or active cell
   */
  private detectDataRange(sheet: Sheet): Range {
    // Find the contiguous data region
    // For now, use simple detection - find first row/col and last row/col with data

    let minRow = Infinity, minCol = Infinity;
    let maxRow = -1, maxCol = -1;

    for (let r = 0; r < sheet.rowCount; r++) {
      for (let c = 0; c < sheet.colCount; c++) {
        const cell = sheet.getCell(r, c);
        if (cell && cell.value !== null && cell.value !== undefined && cell.value !== '') {
          minRow = Math.min(minRow, r);
          minCol = Math.min(minCol, c);
          maxRow = Math.max(maxRow, r);
          maxCol = Math.max(maxCol, c);
        }
      }
    }

    if (minRow === Infinity) {
      throw new Error('Nenhum dado encontrado na planilha');
    }

    return {
      startRow: minRow,
      startCol: minCol,
      endRow: maxRow,
      endCol: maxCol
    };
  }

  /**
   * Create table columns from range
   */
  private createColumnsFromRange(
    sheet: Sheet,
    range: Range,
    hasHeaders: boolean,
    analyzeTypes: boolean
  ): TableColumn[] {
    const columns: TableColumn[] = [];
    const numCols = range.endCol - range.startCol + 1;

    for (let colIdx = 0; colIdx < numCols; colIdx++) {
      const actualCol = range.startCol + colIdx;

      // Get header name
      let columnName: string;
      if (hasHeaders) {
        const headerCell = sheet.getCell(range.startRow, actualCol);
        columnName = headerCell?.value ? String(headerCell.value) : sheet.getColumnName(actualCol);
      } else {
        columnName = sheet.getColumnName(actualCol);
      }

      // Collect data for type analysis
      let dataType: TableColumnDataType = 'auto';
      if (analyzeTypes) {
        const dataStartRow = hasHeaders ? range.startRow + 1 : range.startRow;
        const values: any[] = [];

        for (let r = dataStartRow; r <= range.endRow; r++) {
          const cell = sheet.getCell(r, actualCol);
          if (cell) values.push(cell.value);
        }

        dataType = DataTypeAnalyzer.analyzeColumn(values);
      }

      const column: TableColumn = {
        id: nanoid(),
        name: columnName,
        dataType,
        index: colIdx,
        format: DataTypeAnalyzer.getFormatForType(dataType)
      };

      columns.push(column);
    }

    return columns;
  }

  /**
   * Generate unique table name
   */
  private generateTableName(): string {
    const name = `Tabela${this.tableNameCounter}`;
    this.tableNameCounter++;
    return name;
  }

  /**
   * Get table by ID
   */
  getTable(id: string): StructuredTable | undefined {
    return this.tables.get(id);
  }

  /**
   * Get all tables for a sheet
   */
  getTablesBySheet(sheetId: string): StructuredTable[] {
    return Array.from(this.tables.values()).filter(t => t.sheetId === sheetId);
  }

  /**
   * Update table
   */
  updateTable(id: string, updates: Partial<StructuredTable>): void {
    const table = this.tables.get(id);
    if (!table) throw new Error(`Table not found: ${id}`);

    Object.assign(table, updates);
    table.modified = new Date();

    logger.info('[TableManager] Table updated', { id, updates: Object.keys(updates) });
  }

  /**
   * Delete table
   */
  deleteTable(id: string): boolean {
    const deleted = this.tables.delete(id);
    if (deleted) {
      logger.info('[TableManager] Table deleted', { id });
    }
    return deleted;
  }

  /**
   * Apply table formatting to sheet
   */
  applyTableFormatting(table: StructuredTable, sheet: Sheet): void {
    const { range, style, hasHeaders, showBandedRows, showHeaderRow, showTotalRow } = table;

    logger.info('[TableManager] Applying table formatting', {
      tableId: table.id,
      range,
      style: style.name,
      showHeaderRow,
      showBandedRows,
      showTotalRow
    });

    // Apply header formatting
    if (showHeaderRow && hasHeaders) {
      for (let col = range.startCol; col <= range.endCol; col++) {
        let cell = sheet.getCell(range.startRow, col);

        // If cell doesn't exist, create it
        if (!cell) {
          const value = sheet.getCell(range.startRow, col)?.value || '';
          sheet.setCell(range.startRow, col, value);
          cell = sheet.getCell(range.startRow, col);
        }

        if (cell) {
          cell.format = {
            ...cell.format,
            bgColor: style.headerBg,
            textColor: style.headerText,
            bold: true
          };
          logger.debug('[TableManager] Header cell formatted', { row: range.startRow, col, bgColor: style.headerBg });
        }
      }
    }

    // Apply banded rows
    const dataStartRow = hasHeaders ? range.startRow + 1 : range.startRow;
    const dataEndRow = showTotalRow ? range.endRow - 1 : range.endRow;

    if (showBandedRows) {
      for (let row = dataStartRow; row <= dataEndRow; row++) {
        const isEven = (row - dataStartRow) % 2 === 0;
        const bgColor = isEven ? style.evenRowBg : style.oddRowBg;

        for (let col = range.startCol; col <= range.endCol; col++) {
          let cell = sheet.getCell(row, col);

          // Ensure cell exists
          if (!cell) {
            sheet.setCell(row, col, '');
            cell = sheet.getCell(row, col);
          }

          if (cell) {
            cell.format = {
              ...cell.format,
              bgColor
            };
          }
        }
      }
      logger.debug('[TableManager] Banded rows applied', { dataStartRow, dataEndRow });
    }

    // Apply total row formatting
    if (showTotalRow) {
      for (let col = range.startCol; col <= range.endCol; col++) {
        const cell = sheet.getCell(range.endRow, col);
        if (cell) {
          cell.format = {
            ...cell.format,
            bgColor: style.totalRowBg,
            textColor: style.headerText,
            bold: true
          };
        }
      }
    }

    // Apply column-specific formatting
    table.columns.forEach(column => {
      const actualCol = range.startCol + column.index;

      for (let row = dataStartRow; row <= dataEndRow; row++) {
        const cell = sheet.getCell(row, actualCol);
        if (cell && column.format) {
          cell.format = {
            ...cell.format,
            ...column.format
          };
        }
      }
    });

    logger.info('[TableManager] Table formatting applied', { tableId: table.id });
  }

  /**
   * Calculate and apply totals using FORMULAS (not static values)
   */
  applyTotals(table: StructuredTable, sheet: Sheet): void {
    if (!table.showTotalRow) return;

    const { range, columns, hasHeaders } = table;
    const dataStartRow = hasHeaders ? range.startRow + 1 : range.startRow;
    const totalRow = range.endRow;

    columns.forEach(column => {
      if (!column.totalFunction || column.totalFunction === 'none') return;

      const actualCol = range.startCol + column.index;

      // Build cell range string (e.g., "B2:B10")
      const startCellRef = this.cellToRef(dataStartRow, actualCol);
      const endCellRef = this.cellToRef(totalRow - 1, actualCol);
      const rangeRef = `${startCellRef}:${endCellRef}`;

      // Build formula based on function type
      let formula: string;

      switch (column.totalFunction) {
        case 'sum':
          formula = `=SOMA(${rangeRef})`;
          break;
        case 'average':
          formula = `=MÉDIA(${rangeRef})`;
          break;
        case 'count':
          formula = `=CONT.VALORES(${rangeRef})`;
          break;
        case 'countNumbers':
          formula = `=CONT.NÚM(${rangeRef})`;
          break;
        case 'min':
          formula = `=MÍNIMO(${rangeRef})`;
          break;
        case 'max':
          formula = `=MÁXIMO(${rangeRef})`;
          break;
        case 'stdDev':
          formula = `=DESVPAD(${rangeRef})`;
          break;
        case 'var':
          formula = `=VAR(${rangeRef})`;
          break;
        case 'median':
          formula = `=MEDIANA(${rangeRef})`;
          break;
        case 'product':
          formula = `=MULT(${rangeRef})`;
          break;
        case 'countUnique':
          // Count unique requires more complex formula
          formula = `=CONT.VALORES(${rangeRef})`;
          break;
        default:
          return;
      }

      // Set cell with formula
      sheet.setCell(totalRow, actualCol, formula, {
        formula: formula,
        type: 'formula'
      });

      logger.debug('[TableManager] Total formula set', {
        column: column.name,
        function: column.totalFunction,
        formula
      });
    });

    logger.info('[TableManager] Totals applied with formulas', { tableId: table.id });
  }

  /**
   * Convert row/col to cell reference (e.g., 0,0 -> "A1")
   */
  private cellToRef(row: number, col: number): string {
    let colName = '';
    let c = col;
    while (c >= 0) {
      colName = String.fromCharCode(65 + (c % 26)) + colName;
      c = Math.floor(c / 26) - 1;
    }
    return `${colName}${row + 1}`;
  }

  /**
   * Add filter/sort buttons to table headers (Google Sheets style)
   */
  addHeaderButtons(table: StructuredTable, sheet: Sheet): void {
    if (!table.showFilterButtons || !table.showHeaderRow || !table.hasHeaders) {
      return;
    }

    const { range } = table;
    const headerRow = range.startRow;

    // Add a special marker to each header cell to indicate it has buttons
    for (let col = range.startCol; col <= range.endCol; col++) {
      const cell = sheet.getCell(headerRow, col);
      if (cell) {
        // Add a visual indicator (▼ triangle) to the header value
        const originalValue = cell.value ? String(cell.value) : '';
        if (!originalValue.includes(' ▼')) {
          cell.value = originalValue + ' ▼';
        }
      }
    }

    logger.info('[TableManager] Header buttons added', { tableId: table.id });
  }

  /**
   * Handle header click for filter/sort menu (Google Sheets style)
   */
  showHeaderMenu(
    table: StructuredTable,
    _sheet: Sheet,
    columnIndex: number,
    x: number,
    y: number,
    onSort: (ascending: boolean) => void,
    onFilter: () => void
  ): void {
    // Remove existing menu if any
    const existingMenu = document.getElementById('table-header-menu');
    if (existingMenu) {
      existingMenu.remove();
    }

    const columnName = table.columns[columnIndex]?.name || `Coluna ${columnIndex + 1}`;

    const menuHTML = `
      <div id="table-header-menu" style="
        position: fixed;
        left: ${x}px;
        top: ${y}px;
        background: var(--theme-bg-primary);
        border: 1px solid var(--theme-border-color);
        border-radius: 4px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        min-width: 200px;
        padding: 4px 0;
        color: var(--theme-text-primary);
      ">
        <div style="padding: 8px 12px; font-weight: bold; border-bottom: 1px solid var(--theme-border-color);">
          ${columnName}
        </div>
        <div class="menu-item" data-action="sort-asc" style="
          padding: 8px 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
        ">
          <span>⬆️</span>
          <span>Ordenar de A a Z</span>
        </div>
        <div class="menu-item" data-action="sort-desc" style="
          padding: 8px 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
        ">
          <span>⬇️</span>
          <span>Ordenar de Z a A</span>
        </div>
        <div style="border-top: 1px solid var(--theme-border-color); margin: 4px 0;"></div>
        <div class="menu-item" data-action="filter" style="
          padding: 8px 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
        ">
          <span>🔍</span>
          <span>Filtrar...</span>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', menuHTML);

    const menu = document.getElementById('table-header-menu');
    if (!menu) return;

    // Add hover effects
    const menuItems = menu.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
      item.addEventListener('mouseenter', () => {
        (item as HTMLElement).style.backgroundColor = 'var(--theme-bg-hover)';
      });
      item.addEventListener('mouseleave', () => {
        (item as HTMLElement).style.backgroundColor = 'transparent';
      });

      item.addEventListener('click', () => {
        const action = item.getAttribute('data-action');

        switch (action) {
          case 'sort-asc':
            onSort(true);
            break;
          case 'sort-desc':
            onSort(false);
            break;
          case 'filter':
            onFilter();
            break;
        }

        menu.remove();
      });
    });

    // Close menu when clicking outside
    const closeHandler = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node)) {
        menu.remove();
        document.removeEventListener('click', closeHandler);
      }
    };

    setTimeout(() => {
      document.addEventListener('click', closeHandler);
    }, 100);
  }

  /**
   * Get available table styles
   */
  getAvailableStyles(): TableStyle[] {
    return Object.values(TABLE_STYLES);
  }

  /**
   * List all tables
   */
  listTables(): StructuredTable[] {
    return Array.from(this.tables.values());
  }

  /**
   * Sort table by column
   */
  sortTableByColumn(
    table: StructuredTable,
    sheet: Sheet,
    columnIndex: number,
    ascending: boolean = true
  ): void {
    const { range, hasHeaders } = table;
    const dataStartRow = hasHeaders ? range.startRow + 1 : range.startRow;
    const dataEndRow = table.showTotalRow ? range.endRow - 1 : range.endRow;

    // Collect rows with their data
    const rows: Array<{ rowIndex: number; values: any[]; formats: any[] }> = [];

    for (let row = dataStartRow; row <= dataEndRow; row++) {
      const values: any[] = [];
      const formats: any[] = [];

      for (let col = range.startCol; col <= range.endCol; col++) {
        const cell = sheet.getCell(row, col);
        values.push(cell?.value);
        formats.push(cell?.format);
      }

      rows.push({ rowIndex: row, values, formats });
    }

    // Sort rows based on sort column
    rows.sort((a, b) => {
      const aVal = a.values[columnIndex];
      const bVal = b.values[columnIndex];

      // Handle null/undefined
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return ascending ? 1 : -1;
      if (bVal == null) return ascending ? -1 : 1;

      // Compare values
      let comparison = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }

      return ascending ? comparison : -comparison;
    });

    // Write sorted data back
    rows.forEach((row, idx) => {
      const targetRow = dataStartRow + idx;
      row.values.forEach((value, colIdx) => {
        const actualCol = range.startCol + colIdx;
        sheet.setCell(targetRow, actualCol, value, { format: row.formats[colIdx] });
      });
    });

    logger.info('[TableManager] Table sorted', {
      tableId: table.id,
      columnIndex,
      ascending,
      rowsSorted: rows.length
    });
  }

  /**
   * Filter table by column value
   */
  filterTableByColumn(
    table: StructuredTable,
    sheet: Sheet,
    columnIndex: number,
    filterValue: string | null
  ): void {
    const { range, hasHeaders } = table;
    const dataStartRow = hasHeaders ? range.startRow + 1 : range.startRow;
    const dataEndRow = table.showTotalRow ? range.endRow - 1 : range.endRow;
    const filterCol = range.startCol + columnIndex;

    // If no filter, show all rows
    if (!filterValue) {
      for (let row = dataStartRow; row <= dataEndRow; row++) {
        this.setRowVisible(sheet, row, range, true);
      }
      logger.info('[TableManager] Filter cleared', { tableId: table.id });
      return;
    }

    // Apply filter
    let visibleCount = 0;
    for (let row = dataStartRow; row <= dataEndRow; row++) {
      const cell = sheet.getCell(row, filterCol);
      const cellValue = cell?.value != null ? String(cell.value).toLowerCase() : '';
      const matchesFilter = cellValue.includes(filterValue.toLowerCase());

      this.setRowVisible(sheet, row, range, matchesFilter);
      if (matchesFilter) visibleCount++;
    }

    logger.info('[TableManager] Table filtered', {
      tableId: table.id,
      columnIndex,
      filterValue,
      visibleRows: visibleCount
    });
  }

  /**
   * Set row visibility (mock implementation - would need proper row hiding)
   */
  private setRowVisible(sheet: Sheet, row: number, range: any, visible: boolean): void {
    // For now, we'll use a visual indicator by changing opacity
    // In a full implementation, this would hide the row entirely
    for (let col = range.startCol; col <= range.endCol; col++) {
      const cell = sheet.getCell(row, col);
      if (cell && cell.format) {
        if (!visible) {
          // Mark as hidden (in real impl, would actually hide)
          cell.format.textColor = cell.format.textColor || '#999999';
        }
      }
    }
  }

  /**
   * Get unique values from column for filter dropdown
   */
  getColumnUniqueValues(table: StructuredTable, sheet: Sheet, columnIndex: number): string[] {
    const { range, hasHeaders } = table;
    const dataStartRow = hasHeaders ? range.startRow + 1 : range.startRow;
    const dataEndRow = table.showTotalRow ? range.endRow - 1 : range.endRow;
    const col = range.startCol + columnIndex;

    const uniqueValues = new Set<string>();

    for (let row = dataStartRow; row <= dataEndRow; row++) {
      const cell = sheet.getCell(row, col);
      if (cell && cell.value != null && cell.value !== '') {
        uniqueValues.add(String(cell.value));
      }
    }

    return Array.from(uniqueValues).sort();
  }
}
