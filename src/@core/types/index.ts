/**
 * DJ DataForge v6 - Core Type Definitions
 *
 * FUTURE SPLIT POINTS:
 * - workbook.types.ts (Workbook, Sheet, Cell, Column)
 * - plugin.types.ts (Plugin interfaces)
 * - formula.types.ts (Formula, AST, Tokens)
 * - transform.types.ts (TransformStep, FilterOp, etc)
 * - company.types.ts (CompanyContext, Session)
 */

// ============================================================================
// CELL & COLUMN TYPES
// ============================================================================

export type CellType =
  | "string"
  | "number"
  | "date"
  | "boolean"
  | "formula"
  | "auto"
  | "error";

export interface CellFormat {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  textColor?: string;
  bgColor?: string;
  numberFormat?: string;
  alignment?: "left" | "center" | "right";
}

export interface Cell {
  value: any;
  type: CellType;
  formula?: string;
  error?: string;
  note?: string;
  format?: CellFormat;
}

export interface ValidationRule {
  type: "list" | "number" | "date" | "custom";
  formula?: string;
  min?: number;
  max?: number;
  list?: string[];
}

// ============================================================================
// WORKBOOK TYPES
// ============================================================================

export interface WorkbookOptions {
  id?: string;
  name?: string;
  created?: Date;
  author?: string;
}

export interface WorkbookMetadata {
  id: string;
  name: string;
  version: string;
  created: Date;
  modified: Date;
  author?: string;
  companyId?: string;
}

// ============================================================================
// FORMULA TYPES
// ============================================================================

export interface Token {
  type:
    | "NUMBER"
    | "STRING"
    | "CELL_REF"
    | "RANGE_REF"
    | "FUNCTION"
    | "OPERATOR"
    | "LPAREN"
    | "RPAREN"
    | "COMMA"
    | "COLON";
  value: string;
  position: number;
}

export interface ASTNode {
  type:
    | "Literal"
    | "CellRef"
    | "RangeRef"
    | "FunctionCall"
    | "BinaryOp"
    | "UnaryOp";
  value?: any;
  operator?: string;
  left?: ASTNode;
  right?: ASTNode;
  operand?: ASTNode;
  name?: string;
  args?: ASTNode[];
  startCell?: string;
  endCell?: string;
}

export interface FunctionSpec {
  name: string;
  impl: (...args: any[]) => any;
  argCount: number; // -1 = variadic
  async?: boolean;
  description?: string;
}

// ============================================================================
// TRANSFORM TYPES
// ============================================================================

export type TransformStepType =
  | "filter"
  | "sort"
  | "group"
  | "pivot"
  | "join"
  | "aggregate";

export interface TransformStep {
  id: string;
  type: TransformStepType;
  params: any;
  enabled: boolean;
  timestamp: Date;
}

export interface FilterCondition {
  column: number;
  operator:
    | "="
    | "!="
    | ">"
    | "<"
    | ">="
    | "<="
    | "contains"
    | "startsWith"
    | "endsWith";
  value: any;
}

export interface SortSpec {
  column: number;
  direction: "asc" | "desc";
}

// ============================================================================
// PLUGIN TYPES
// ============================================================================

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  permissions: PluginPermission[];
  entryPoint: string;
}

export type PluginPermission =
  | "read:workbook"
  | "write:workbook"
  | "read:storage"
  | "write:storage"
  | "ui:toolbar"
  | "ui:panel"
  | "ui:menu"
  | "formula:register"
  | "transform:register"
  | "network:fetch";

export interface PluginContext {
  pluginId: string;
  manifest: PluginManifest;
  kernel: any; // KernelContext
  storage: PluginStorageAPI;
  ui: PluginUIAPI;
  events: PluginEventAPI;
  widgets: PluginWidgetAPI;  // Nova API para widgets
}

export interface PluginStorageAPI {
  get(key: string): Promise<any>;
  set(key: string, value: any): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

export interface PluginUIAPI {
  addToolbarButton(config: ToolbarButtonConfig): void;
  addDashboardButton(config: DashboardButtonConfig): void;
  addPanel(config: PanelConfig): void;
  addMenuItem(config: MenuItemConfig): void;
  showToast(
    message: string,
    type: "info" | "success" | "warning" | "error"
  ): void;
}

export interface PluginEventAPI {
  on(event: string, handler: (...args: any[]) => void): void;
  off(event: string, handler: (...args: any[]) => void): void;
  emit(event: string, ...args: any[]): void;
}

export interface PluginWidgetAPI {
  register(type: string, rendererClass: any): void;
  unregister(type: string): void;
  create(sheetId: string, type: string, config: Partial<WidgetConfig>): WidgetConfig;
  getAvailableTypes(): string[];  // List all registered widget types
  isTypeAvailable(type: string): boolean;  // Check if a widget type is registered
}

export interface ToolbarButtonConfig {
  id: string;
  label: string;
  icon?: string;
  tooltip?: string;
  onClick: () => void;
}

export interface DashboardButtonConfig {
  id: string;
  label: string;
  icon: string;
  onClick: () => void;
}

export interface PanelConfig {
  id: string;
  title: string;
  render: (container: HTMLElement) => void;
  position?: "left" | "right" | "bottom";
}

export interface MenuItemConfig {
  id: string;
  label: string;
  parent?: string;
  onClick: () => void;
  separator?: boolean;
}

// ============================================================================
// COMPANY / MULTI-TENANT TYPES
// ============================================================================

export interface CompanyContext {
  id: string;
  name: string;
  logo?: string;
  settings: CompanySettings;
  workbooks: string[]; // workbook IDs
  plugins: PluginRef[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CompanySettings {
  locale: string;
  currency: string;
  dateFormat: string;
  numberFormat: string;
  decimals: number;
  timezone: string;
}

export interface PluginRef {
  id: string;
  url: string;
  version: string;
  enabled: boolean;
  autoLoad: boolean;
}

export interface Session {
  id: string;
  companyId: string;
  userId?: string;
  startedAt: Date;
  lastActivityAt: Date;
  activeWorkbookId?: string;
}

// ============================================================================
// KERNEL TYPES
// ============================================================================

export type KernelState = "init" | "ready" | "computing" | "idle" | "shutdown";

export interface KernelContext {
  kernel: any; // DJDataForgeKernel
  version: string;
  workbookManager: any;
  calcEngine: any;
  transformPipeline: any;
  companyManager: any;
  eventBus: any;
  storage: any;
  tableManager: any;      // TableManager for structured tables
  dashboardManager: any;  // DashboardManager for dashboard layouts
  getGrid: () => any;
}

// ============================================================================
// EVENT TYPES
// ============================================================================

export interface EventPayload {
  [key: string]: any;
}

export type EventHandler = (payload: EventPayload) => void;

// ============================================================================
// LOGGER TYPES
// ============================================================================

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  level: LogLevel;
  timestamp: Date;
  source: string;
  message: string;
  data?: any;
}

// ============================================================================
// I/O TYPES
// ============================================================================

export type FileFormat = "csv" | "xlsx" | "json" | "xml";

export interface ImportOptions {
  hasHeaders?: boolean;
  delimiter?: string;
  encoding?: string;
  skipRows?: number;
  sheetIndex?: number;
}

export interface ExportOptions {
  format: FileFormat;
  includeHeaders?: boolean;
  sheetName?: string;
  formatting?: boolean;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export interface Range {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export interface CellCoordinate {
  row: number;
  col: number;
}

export type Comparator<T> = (a: T, b: T) => number;

// ============================================================================
// STRUCTURED TABLE TYPES (Phase 1)
// ============================================================================

export type TableColumnDataType =
  | 'text'
  | 'number'
  | 'currency'
  | 'percentage'
  | 'date'
  | 'datetime'
  | 'boolean'
  | 'category'
  | 'email'
  | 'url'
  | 'auto';

export type TableTotalFunction =
  | 'none'
  | 'sum'
  | 'average'
  | 'count'
  | 'countNumbers'
  | 'min'
  | 'max'
  | 'stdDev'
  | 'var'
  | 'median'
  | 'product'
  | 'countUnique';

export interface TableColumn {
  id: string;
  name: string;
  dataType: TableColumnDataType;
  index: number;
  totalFunction?: TableTotalFunction;
  formula?: string; // For calculated columns
  format?: CellFormat;
  validation?: ValidationRule;
}

export interface TableStyle {
  id: string;
  name: string;
  headerBg: string;
  headerText: string;
  evenRowBg: string;
  oddRowBg: string;
  borderColor: string;
  totalRowBg: string;
  highlightColor?: string;
}

export interface StructuredTable {
  id: string;
  name: string;
  sheetId: string;
  range: Range;
  hasHeaders: boolean;
  columns: TableColumn[];
  style: TableStyle;
  showTotalRow: boolean;
  showHeaderRow: boolean;
  showBandedRows: boolean;
  showBandedColumns: boolean;
  showFilterButtons: boolean;
  created: Date;
  modified: Date;
}

export interface TableCreationOptions {
  range?: Range;
  hasHeaders?: boolean;
  autoDetectRange?: boolean;
  styleName?: string;
  tableName?: string;
  analyzeDataTypes?: boolean;
  startPosition?: { row: number; col: number }; // Starting position for range detection
}

// ============================================================================
// DASHBOARD TYPES (Phase 1)
// ============================================================================

export type DashboardMode = 'grid' | 'dashboard';

export type WidgetType = 'kpi' | 'table' | 'text' | 'image' | 'chart' | 'pivot';

export interface WidgetPosition {
  x: number;      // Position in pixels from left
  y: number;      // Position in pixels from top
  width: number;  // Width in pixels
  height: number; // Height in pixels
}

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  position: WidgetPosition;
  title: string;

  // Type-specific configuration
  tableId?: string;      // For table widgets - reference to StructuredTable
  chartConfig?: any;     // For chart widgets (future)
  pivotConfig?: any;     // For pivot widgets (future)

  // KPI widget configuration
  kpiConfig?: KPIConfig;

  // Text widget configuration
  textConfig?: TextConfig;

  // Image widget configuration
  imageConfig?: ImageConfig;

  // Table widget configuration
  tableWidgetConfig?: TableWidgetConfig;

  // Visual settings
  showTitle?: boolean;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;

  // Metadata
  created: Date;
  modified: Date;
}

// ============================================================================
// KPI WIDGET TYPES
// ============================================================================

export type KPIValueSource = 'cell' | 'formula' | 'aggregation';
export type KPIAggregation = 'sum' | 'average' | 'min' | 'max' | 'count';
export type KPIFormat = 'number' | 'currency' | 'percentage';
export type KPIComparisonType = 'none' | 'target' | 'previous';

export interface KPIConfig {
  // Data source
  valueSource: KPIValueSource;
  cellRef?: string;           // If source is 'cell' (e.g., "A1")
  formula?: string;           // If source is 'formula' (e.g., "=SOMA(A1:A10)")
  tableId?: string;           // If source is 'aggregation'
  columnIndex?: number;       // If source is 'aggregation'
  aggregation?: KPIAggregation;

  // Formatting
  format: KPIFormat;
  decimals?: number;
  prefix?: string;            // e.g., "R$", "$"
  suffix?: string;            // e.g., "%", "un"

  // Visual
  icon?: string;              // Emoji or icon character
  iconColor?: string;
  valueColor?: string;
  fontSize?: number;          // Value font size in px

  // Conditional formatting
  conditionalColors?: KPIConditionalColor[];

  // Comparison (optional)
  comparison?: KPIComparisonType;
  targetValue?: number;       // For 'target' comparison
  previousValue?: number;     // For 'previous' comparison (stored, not configured)
}

export interface KPIConditionalColor {
  condition: 'greater' | 'less' | 'equal' | 'between';
  value: number;
  value2?: number;            // For 'between'
  color: string;
}

// ============================================================================
// TEXT WIDGET TYPES
// ============================================================================

export type TextAlignment = 'left' | 'center' | 'right' | 'justify';
export type TextFontSize = 'small' | 'medium' | 'large' | 'xlarge';

export interface TextConfig {
  content: string;            // HTML content
  fontSize?: TextFontSize;
  alignment?: TextAlignment;
  textColor?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;

  // Background
  backgroundColor?: string;
  padding?: number;           // Padding in px
}

// ============================================================================
// IMAGE WIDGET TYPES
// ============================================================================

export type ImageFit = 'contain' | 'cover' | 'fill' | 'none';

export interface ImageConfig {
  source: string;             // URL or base64
  alt?: string;               // Alt text
  fit?: ImageFit;             // How image fits in widget
  opacity?: number;           // 0-1
  borderRadius?: number;      // Border radius in px
}

// ============================================================================
// TABLE WIDGET TYPES
// ============================================================================

export interface TableWidgetConfig {
  hiddenColumns?: string[];        // Column IDs to hide
  sort?: {
    columnId: string;
    direction: 'asc' | 'desc';
  };
  topN?: number | null;            // Show only top N rows (rest grouped as "Others")
  showTotalRow?: boolean;          // Override table's showTotalRow setting
  textFilter?: string;             // Filter rows by text search
  itemsPerPage?: number | null;    // Pagination: items per page
  currentPage?: number;            // Pagination: current page (0-indexed)
  showAlternatingRows?: boolean;   // Override table's showBandedRows
}

export interface DashboardLayout {
  id: string;
  sheetId: string;           // Dashboard belongs to a sheet
  mode: DashboardMode;       // Current mode
  widgets: WidgetConfig[];   // List of widgets
  gridVisible?: boolean;     // Show grid lines in dashboard mode
  snapToGrid?: boolean;      // Snap widgets to grid when moving
  gridSize?: number;         // Grid size in pixels (default 20)
  created: Date;
  modified: Date;
}
