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
}

export interface PluginStorageAPI {
  get(key: string): Promise<any>;
  set(key: string, value: any): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

export interface PluginUIAPI {
  addToolbarButton(config: ToolbarButtonConfig): void;
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

export interface ToolbarButtonConfig {
  id: string;
  label: string;
  icon?: string;
  tooltip?: string;
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
