/**
 * DJ DataForge v6 - Calc Engine Consolidated Module
 *
 * FUTURE SPLIT POINTS:
 * - calc/parser.ts (FormulaParser class)
 * - calc/evaluator.ts (CalcEngine class)
 * - calc/registry.ts (FormulaRegistry class)
 * - calc/dag.ts (DependencyGraph class)
 * - calc/functions/ (individual function files)
 *
 * Combined for now to reduce artifact count during initial development.
 */

import type { Token, ASTNode, FunctionSpec, CellType } from "./types";
import type { Sheet } from "./workbook-consolidated";

export class CircularReferenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CircularReferenceError";
  }
}

// ============================================================================
// FORMULA PARSER
// ============================================================================

export class FormulaParser {
  /**
   * Tokenize formula string into tokens
   */
  tokenize(formula: string): Token[] {
    console.log(`[FormulaParser] Tokenizing formula: "${formula}"`);
    const tokens: Token[] = [];
    let i = 0;

    // Remove leading "="
    if (formula.startsWith("=")) {
      formula = formula.slice(1);
    }

    while (i < formula.length) {
      const char = formula[i];

      // Skip whitespace
      if (/\s/.test(char)) {
        i++;
        continue;
      }

      // Numbers
      if (/\d/.test(char) || (char === "." && /\d/.test(formula[i + 1]))) {
        let num = "";
        while (i < formula.length && /[\d.]/.test(formula[i])) {
          num += formula[i++];
        }
        tokens.push({ type: "NUMBER", value: num, position: i });
        continue;
      }

      // Strings
      if (char === '"') {
        let str = "";
        i++; // skip opening quote
        while (i < formula.length && formula[i] !== '"') {
          str += formula[i++];
        }
        i++; // skip closing quote
        tokens.push({ type: "STRING", value: str, position: i });
        continue;
      }

      // Cell references (A1, B2, AA10) and function names (with underscore support)
      // Support both uppercase and lowercase, but normalize to uppercase
      if (/[A-ZÀ-Úa-zà-ú]/.test(char)) {
        let ref = "";
        while (i < formula.length && /[A-Z0-9À-Ú_:a-zà-ú.]/.test(formula[i])) {
          ref += formula[i++];
        }

        // Normalize to uppercase for consistency
        const normalizedRef = ref.toUpperCase();

        // Check if it's a range (A1:B10) or cell ref
        if (normalizedRef.includes(":")) {
          tokens.push({ type: "RANGE_REF", value: normalizedRef, position: i });
        } else if (/^[A-Z]+\d+$/.test(normalizedRef)) {
          tokens.push({ type: "CELL_REF", value: normalizedRef, position: i });
        } else {
          // It's a function name
          tokens.push({ type: "FUNCTION", value: normalizedRef, position: i });
        }
        continue;
      }

      // Operators and delimiters
      switch (char) {
        case "+":
        case "-":
        case "*":
        case "/":
        case "^":
        case "=":
        case ">":
        case "<":
        case "%":
          // Check for two-char operators (>=, <=, <>)
          if (i + 1 < formula.length) {
            const next = formula[i + 1];
            if (
              (char === ">" || char === "<" || char === "=") &&
              next === "="
            ) {
              tokens.push({
                type: "OPERATOR",
                value: char + next,
                position: i,
              });
              i += 2;
              continue;
            }
            if (char === "<" && next === ">") {
              tokens.push({ type: "OPERATOR", value: "<>", position: i });
              i += 2;
              continue;
            }
          }
          tokens.push({ type: "OPERATOR", value: char, position: i++ });
          break;
        case "(":
          tokens.push({ type: "LPAREN", value: char, position: i++ });
          break;
        case ")":
          tokens.push({ type: "RPAREN", value: char, position: i++ });
          break;
        case ",":
          tokens.push({ type: "COMMA", value: char, position: i++ });
          break;
        case ":":
          tokens.push({ type: "COLON", value: char, position: i++ });
          break;
        default:
          throw new Error(`Unexpected character: ${char} at position ${i}`);
      }
    }

    return tokens;
  }

  /**
   * Parse tokens into AST
   */
  parse(tokens: Token[]): ASTNode {
    console.log(`[FormulaParser] Parsing tokens:`, tokens);
    let pos = 0;

    const parseExpression = (): ASTNode => {
      return parseComparison();
    };

    const parseComparison = (): ASTNode => {
      let left = parseAdditive();

      while (pos < tokens.length) {
        const token = tokens[pos];
        if (
          token.type === "OPERATOR" &&
          ["=", "<", ">", "<=", ">=", "<>"].includes(token.value)
        ) {
          pos++;
          const right = parseAdditive();
          left = {
            type: "BinaryOp",
            operator: token.value,
            left,
            right,
          };
        } else {
          break;
        }
      }

      return left;
    };

    const parseAdditive = (): ASTNode => {
      let left = parseMultiplicative();

      while (pos < tokens.length) {
        const token = tokens[pos];
        if (token.type === "OPERATOR" && ["+", "-"].includes(token.value)) {
          pos++;
          const right = parseMultiplicative();
          left = {
            type: "BinaryOp",
            operator: token.value,
            left,
            right,
          };
        } else {
          break;
        }
      }

      return left;
    };

    const parseMultiplicative = (): ASTNode => {
      let left = parseUnary();

      while (pos < tokens.length) {
        const token = tokens[pos];
        if (
          token.type === "OPERATOR" &&
          ["*", "/", "%"].includes(token.value)
        ) {
          pos++;
          const right = parseUnary();
          left = {
            type: "BinaryOp",
            operator: token.value,
            left,
            right,
          };
        } else {
          break;
        }
      }

      return left;
    };

    const parseUnary = (): ASTNode => {
      const token = tokens[pos];

      if (token.type === "OPERATOR" && ["+", "-"].includes(token.value)) {
        pos++;
        const operand = parseUnary();
        return {
          type: "UnaryOp",
          operator: token.value,
          operand,
        };
      }

      return parsePrimary();
    };

    const parsePrimary = (): ASTNode => {
      const token = tokens[pos++];

      if (!token) {
        throw new Error("Unexpected end of formula");
      }

      switch (token.type) {
        case "NUMBER":
          return { type: "Literal", value: parseFloat(token.value) };

        case "STRING":
          return { type: "Literal", value: token.value };

        case "CELL_REF":
          return { type: "CellRef", value: token.value };

        case "RANGE_REF":
          const [start, end] = token.value.split(":");
          return { type: "RangeRef", startCell: start, endCell: end };

        case "FUNCTION":
          return parseFunction(token.value);

        case "LPAREN":
          const expr = parseExpression();
          if (tokens[pos]?.type !== "RPAREN") {
            throw new Error("Expected closing parenthesis");
          }
          pos++;
          return expr;

        default:
          throw new Error(`Unexpected token: ${token.type}`);
      }
    };

    const parseFunction = (name: string): ASTNode => {
      console.log(`[FormulaParser] Parsing function: ${name}. Next token type: ${tokens[pos]?.type}`);
      if (tokens[pos]?.type !== "LPAREN") {
        throw new Error(`Expected '(' after function ${name}`);
      }
      pos++; // skip (

      const args: ASTNode[] = [];

      if (tokens[pos]?.type !== "RPAREN") {
        args.push(parseExpression());

        while (tokens[pos]?.type === "COMMA") {
          pos++; // skip comma
          args.push(parseExpression());
        }
      }

      if (tokens[pos]?.type !== "RPAREN") {
        throw new Error(`Expected ')' after function ${name} arguments`);
      }
      pos++; // skip )

      return {
        type: "FunctionCall",
        name,
        args,
      };
    };

    return parseExpression();
  }

  /**
   * Extract cell references from formula for dependency tracking
   */
  extractReferences(formula: string): string[] {
    const refs: string[] = [];
    const tokens = this.tokenize(formula);

    for (const token of tokens) {
      if (token.type === "CELL_REF") {
        refs.push(token.value);
      } else if (token.type === "RANGE_REF") {
        // Expand range to individual cells (for dependency graph)
        const [start, end] = token.value.split(":");
        const startCoord = this.cellRefToCoord(start);
        const endCoord = this.cellRefToCoord(end);

        for (let r = startCoord.row; r <= endCoord.row; r++) {
          for (let c = startCoord.col; c <= endCoord.col; c++) {
            refs.push(this.coordToCellRef(r, c));
          }
        }
      }
    }

    return refs;
  }

  private cellRefToCoord(ref: string): { row: number; col: number } {
    const match = ref.match(/([A-Z]+)(\d+)/);
    if (!match) throw new Error(`Invalid cell ref: ${ref}`);

    let col = 0;
    for (let i = 0; i < match[1].length; i++) {
      col = col * 26 + (match[1].charCodeAt(i) - 64);
    }
    col--;

    const row = parseInt(match[2]) - 1;
    return { row, col };
  }

  private coordToCellRef(row: number, col: number): string {
    let colRef = "";
    let n = col + 1;
    while (n > 0) {
      colRef = String.fromCharCode(64 + (n % 26 || 26)) + colRef;
      n = Math.floor((n - 1) / 26);
    }
    return `${colRef}${row + 1}`;
  }
}

// ============================================================================
// FUNCTION REGISTRY
// ============================================================================

export class FormulaRegistry {
  private functions: Map<string, FunctionSpec> = new Map();

  constructor() {
    this.registerBuiltins();
  }

  register(
    name: string,
    impl: (...args: any[]) => any,
    options?: Partial<FunctionSpec>
  ): void {
    const spec: FunctionSpec = {
      name: name.toUpperCase(),
      impl,
      argCount: options?.argCount ?? -1,
      async: options?.async ?? false,
      description: options?.description,
    };

    this.functions.set(spec.name, spec);
  }

  get(name: string): FunctionSpec | undefined {
    return this.functions.get(name.toUpperCase());
  }

  list(): FunctionSpec[] {
    return Array.from(this.functions.values());
  }

  private registerBuiltins(): void {
    // MATH FUNCTIONS
    this.register(
      "SOMA",
      (...args: any[]) => {
        const nums = this.flattenNumbers(args);
        return nums.reduce((sum, n) => sum + n, 0);
      },
      { description: "Soma todos os números" }
    );

    this.register(
      "MÉDIA",
      (...args: any[]) => {
        const nums = this.flattenNumbers(args);
        return nums.length > 0
          ? nums.reduce((sum, n) => sum + n, 0) / nums.length
          : 0;
      },
      { description: "Média aritmética" }
    );

    this.register(
      "MÁXIMO",
      (...args: any[]) => {
        const nums = this.flattenNumbers(args);
        return nums.length > 0 ? Math.max(...nums) : 0;
      },
      { description: "Valor máximo" }
    );

    this.register(
      "MÍNIMO",
      (...args: any[]) => {
        const nums = this.flattenNumbers(args);
        return nums.length > 0 ? Math.min(...nums) : 0;
      },
      { description: "Valor mínimo" }
    );

    this.register(
      "ARREDONDAR",
      (num: number, decimals: number = 0) => {
        const factor = Math.pow(10, decimals);
        return Math.round(num * factor) / factor;
      },
      { argCount: 2, description: "Arredondar número" }
    );

    this.register("ABS", (num: number) => Math.abs(num), {
      argCount: 1,
      description: "Valor absoluto",
    });

    this.register("RAIZ", (num: number) => Math.sqrt(num), {
      argCount: 1,
      description: "Raiz quadrada",
    });

    this.register(
      "POTÊNCIA",
      (base: number, exp: number) => Math.pow(base, exp),
      {
        argCount: 2,
        description: "Potência",
      }
    );

    // TEXT FUNCTIONS
    this.register(
      "CONCATENAR",
      (...args: any[]) => {
        return args
          .flat()
          .map((v) => String(v))
          .join("");
      },
      { description: "Concatenar textos" }
    );

    this.register("MAIÚSCULA", (text: string) => String(text).toUpperCase(), {
      argCount: 1,
      description: "Converter para maiúsculas",
    });

    this.register("MINÚSCULA", (text: string) => String(text).toLowerCase(), {
      argCount: 1,
      description: "Converter para minúsculas",
    });

    this.register(
      "TEXTO",
      (value: any, format?: string) => {
        // Simple formatting
        if (typeof value === "number" && format) {
          return value.toLocaleString("pt-BR");
        }
        return String(value);
      },
      { argCount: 2, description: "Formatar como texto" }
    );

    this.register("NÚM.CARACT", (text: string) => String(text).length, {
      argCount: 1,
      description: "Número de caracteres",
    });

    // LOGIC FUNCTIONS
    this.register(
      "SE",
      (condition: boolean, trueValue: any, falseValue: any) => {
        return condition ? trueValue : falseValue;
      },
      { argCount: 3, description: "Condicional SE" }
    );

    this.register(
      "E",
      (...args: any[]) => {
        return args.flat().every((v) => Boolean(v));
      },
      { description: "E lógico" }
    );

    this.register(
      "OU",
      (...args: any[]) => {
        return args.flat().some((v) => Boolean(v));
      },
      { description: "OU lógico" }
    );

    this.register("NÃO", (value: boolean) => !value, {
      argCount: 1,
      description: "Negação lógica",
    });

    // INFORMATION FUNCTIONS
    this.register(
      "ÉNÚM",
      (value: any) => typeof value === "number" && !isNaN(value),
      {
        argCount: 1,
        description: "Verifica se é número",
      }
    );

    this.register("ÉTEXTO", (value: any) => typeof value === "string", {
      argCount: 1,
      description: "Verifica se é texto",
    });

    this.register(
      "ÉVAZIO",
      (value: any) => value === null || value === undefined || value === "",
      {
        argCount: 1,
        description: "Verifica se está vazio",
      }
    );

    // LOOKUP FUNCTIONS
    this.register(
      "PROCV",
      (valor: any, tabela: any[][], coluna: number, exato: boolean = true) => {
        for (let i = 0; i < tabela.length; i++) {
          if (
            exato
              ? tabela[i][0] === valor
              : String(tabela[i][0]).includes(String(valor))
          ) {
            return tabela[i][coluna - 1] || "#N/D";
          }
        }
        return "#N/D";
      },
      { argCount: 4, description: "Procura vertical" }
    );

    // COUNT FUNCTIONS
    this.register(
      "CONT.NÚM",
      (...args: any[]) => {
        return this.flattenNumbers(args).length;
      },
      { description: "Contar números" }
    );

    this.register(
      "CONT.VALORES",
      (...args: any[]) => {
        return args.flat().filter((v) => v !== null && v !== undefined).length;
      },
      { description: "Contar valores não vazios" }
    );
  }

  private flattenNumbers(args: any[]): number[] {
    const result: number[] = [];

    const flatten = (item: any): void => {
      if (Array.isArray(item)) {
        // Recursively flatten arrays (handles Cell[][] from ranges)
        item.forEach(flatten);
      } else if (typeof item === "object" && item !== null && "value" in item) {
        // Handle Cell objects from getRange
        const val = item.value;
        if (typeof val === "number" && !isNaN(val)) {
          result.push(val);
        } else if (typeof val === "string") {
          // Try to parse string as number
          const parsed = parseFloat(val);
          if (!isNaN(parsed)) {
            result.push(parsed);
          }
        }
      } else if (typeof item === "number" && !isNaN(item)) {
        result.push(item);
      } else if (typeof item === "string") {
        // Try to parse string as number
        const parsed = parseFloat(item);
        if (!isNaN(parsed)) {
          result.push(parsed);
        }
      }
    };

    args.forEach(flatten);
    return result;
  }
}

// ============================================================================
// DEPENDENCY GRAPH (for recalculation order)
// ============================================================================

export class DependencyGraph {
  private edges: Map<string, Set<string>> = new Map();

  addEdge(from: string, to: string): void {
    if (!this.edges.has(from)) {
      this.edges.set(from, new Set());
    }
    this.edges.get(from)!.add(to);
  }

  /**
   * Topological sort for recalculation order
   */
  topologicalSort(): string[] {
    const visited = new Set<string>();
    const stack: string[] = [];
    const visiting = new Set<string>();

    const visit = (node: string): void => {
      if (visited.has(node)) return;

      if (visiting.has(node)) {
        throw new CircularReferenceError(`Circular reference detected at ${node}`);
      }

      visiting.add(node);

      const deps = this.edges.get(node);
      if (deps) {
        for (const dep of deps) {
          visit(dep);
        }
      }

      visiting.delete(node);
      visited.add(node);
      stack.push(node);
    };

    for (const node of this.edges.keys()) {
      visit(node);
    }

    return stack.reverse();
  }

  clear(): void {
    this.edges.clear();
  }
}

// ============================================================================
// CALC ENGINE (Main evaluator)
// ============================================================================

export class CalcEngine {
  private parser: FormulaParser;
  private registry: FormulaRegistry;
  private cache: Map<string, any> = new Map();
  private dependencyCache: Map<string, Set<string>> = new Map(); // cellRef -> Set of cells it depends on
  private reverseDependencyCache: Map<string, Set<string>> = new Map(); // cellRef -> Set of cells that depend on it

  constructor() {
    this.parser = new FormulaParser();
    this.registry = new FormulaRegistry();
  }

  async init(): Promise<void> {
    // Future: load custom functions from storage
  }

  /**
   * Invalidate cache for a cell and all cells that depend on it
   */
  invalidateCell(cellRef: string): void {
    // Clear the cell's own cache
    this.cache.delete(cellRef);

    // Get all cells that depend on this cell
    const dependents = this.reverseDependencyCache.get(cellRef);
    if (dependents) {
      // Recursively invalidate all dependents
      dependents.forEach(dependent => {
        if (this.cache.has(dependent)) {
          this.invalidateCell(dependent);
        }
      });
    }
  }

  /**
   * Clear all caches
   */
  clearAllCaches(): void {
    this.cache.clear();
    this.dependencyCache.clear();
    this.reverseDependencyCache.clear();
  }

  /**
   * Recalculate sheet or specific cell
   */
  async recalculate(
    sheet: Sheet,
    cellRef?: string,
    options?: { force?: boolean; async?: boolean }
  ): Promise<number> {
    let cellsProcessed = 0;

    // Build dependency graph and identify independent formulas
    const dag = new DependencyGraph();
    const independentCells: string[] = [];

    for (let r = 0; r < sheet.rowCount; r++) {
      for (let c = 0; c < sheet.colCount; c++) {
        const cell = sheet.getCell(r, c);
        if (cell?.formula) {
          const cellRef = this.coordToCellRef(r, c);
          console.log(`[CalcEngine] Building dependency graph: Found formula in cell ${cellRef}: "${cell.formula}"`);
          const refs = this.parser.extractReferences(cell.formula);

          if (refs.length === 0) {
            independentCells.push(cellRef);
          } else {
            refs.forEach((ref) => {
              dag.addEdge(cellRef, ref);
            });
          }
        }
      }
    }

    try {
      const dependentOrder = dag.topologicalSort();
      console.log(`[CalcEngine] Dependent recalculation order:`, dependentOrder);
      console.log(`[CalcEngine] Independent cells:`, independentCells);

      // Combine independent cells and dependent cells
      let cellsToRecalc = [...independentCells, ...dependentOrder];

      // Filter by cellRef if provided
      if (cellRef) {
        cellsToRecalc = cellsToRecalc.filter(
          (ref) =>
            ref === cellRef || cellsToRecalc.indexOf(ref) > cellsToRecalc.indexOf(cellRef)
        );
      }
      console.log(`[CalcEngine] Final cells to recalculate:`, cellsToRecalc);

      // Recalculate in order
      for (const ref of cellsToRecalc) {
        const coord = this.cellRefToCoord(ref);
        const cell = sheet.getCell(coord.row, coord.col);
        console.log(`[CalcEngine] Processing cell ${ref}. Has formula: ${!!cell?.formula}`);

        if (cell?.formula) {
          // If force is true, clear cache first to ensure recalculation
          if (options?.force) {
            this.cache.delete(ref);
          }

          // Recalculate if not in cache or if force is true
          if (options?.force || !this.cache.has(ref)) {
            await this.evalCell(ref, sheet);
            cellsProcessed++;
          }
        }
      }
    } catch (error) {
      console.error("[CalcEngine] Recalc failed:", error);
      throw error;
    }

    return cellsProcessed;
  }

  /**
   * Evaluate a single cell formula
   */
  async evalCell(cellRef: string, sheet: Sheet): Promise<void> {
    console.log(`[CalcEngine] Evaluating cell: ${cellRef}, formula: ${sheet.getCell(this.cellRefToCoord(cellRef).row, this.cellRefToCoord(cellRef).col)?.formula}`);
    const coord = this.cellRefToCoord(cellRef);
    const cell = sheet.getCell(coord.row, coord.col);

    if (!cell?.formula) return;

    try {
      // Track dependencies for this cell
      const dependencies = new Set<string>();

      const tokens = this.parser.tokenize(cell.formula);
      console.log(`[CalcEngine] Tokens for ${cellRef}:`, tokens);
      const ast = this.parser.parse(tokens);
      const result = await this.evalASTWithTracking(ast, sheet, dependencies);

      console.log(`[CalcEngine] Cell ${cellRef} formula "${cell.formula}" => result:`, result, typeof result);

      // Store dependency info
      this.dependencyCache.set(cellRef, dependencies);

      // Update reverse dependencies (which cells depend on this cell's dependencies)
      dependencies.forEach(depRef => {
        if (!this.reverseDependencyCache.has(depRef)) {
          this.reverseDependencyCache.set(depRef, new Set());
        }
        this.reverseDependencyCache.get(depRef)!.add(cellRef);
      });

      // Update cell value
      sheet.setCell(coord.row, coord.col, result, {
        formula: cell.formula,
        type: this.inferType(result),
      });

      this.cache.set(cellRef, result);
    } catch (error: any) {
      console.error(`[CalcEngine] Error in cell ${cellRef}:`, error);
      sheet.setCell(coord.row, coord.col, `#ERROR!`, {
        formula: cell.formula,
        type: "error",
      });
    }
  }

  private async evalASTWithTracking(node: ASTNode, sheet: Sheet, dependencies: Set<string>): Promise<any> {
    switch (node.type) {
      case "Literal":
        return node.value;

      case "CellRef":
        const cellRefValue = node.value!;
        dependencies.add(cellRefValue);
        const coord = this.cellRefToCoord(cellRefValue);
        return sheet.getCellValue(coord.row, coord.col);

      case "RangeRef":
        // Track all cells in the range as dependencies
        const start = this.cellRefToCoord(node.startCell!);
        const end = this.cellRefToCoord(node.endCell!);

        for (let r = start.row; r <= end.row; r++) {
          for (let c = start.col; c <= end.col; c++) {
            dependencies.add(this.coordToCellRef(r, c));
          }
        }

        return sheet.getRange(start.row, start.col, end.row, end.col);

      case "BinaryOp":
        const left = await this.evalASTWithTracking(node.left!, sheet, dependencies);
        const right = await this.evalASTWithTracking(node.right!, sheet, dependencies);
        return this.evalBinaryOp(node.operator!, left, right);

      case "UnaryOp":
        const operand = await this.evalASTWithTracking(node.operand!, sheet, dependencies);
        return this.evalUnaryOp(node.operator!, operand);

      case "FunctionCall":
        const fnSpec = this.registry.get(node.name!);
        if (!fnSpec) {
          throw new Error(`Unknown function: ${node.name}`);
        }

        const args = await Promise.all(
          (node.args || []).map(arg => this.evalASTWithTracking(arg, sheet, dependencies))
        );

        return fnSpec.impl(...args);

      default:
        throw new Error(`Unknown AST node type: ${node.type}`);
    }
  }

  private async evalAST(node: ASTNode, sheet: Sheet): Promise<any> {
    switch (node.type) {
      case "Literal":
        return node.value;

      case "CellRef":
        const coord = this.cellRefToCoord(node.value!);
        return sheet.getCellValue(coord.row, coord.col);

      case "RangeRef":
        const start = this.cellRefToCoord(node.startCell!);
        const end = this.cellRefToCoord(node.endCell!);
        return sheet.getRange(start.row, start.col, end.row, end.col);

      case "BinaryOp":
        const left = await this.evalAST(node.left!, sheet);
        const right = await this.evalAST(node.right!, sheet);
        return this.evalBinaryOp(node.operator!, left, right);

      case "UnaryOp":
        const operand = await this.evalAST(node.operand!, sheet);
        return this.evalUnaryOp(node.operator!, operand);

      case "FunctionCall":
        const fn = this.registry.get(node.name!);
        if (!fn) {
          throw new Error(`Unknown function: ${node.name}`);
        }

        const args = await Promise.all(
          node.args!.map((arg) => this.evalAST(arg, sheet))
        );

        return fn.impl(...args);

      default:
        throw new Error(`Unknown AST node type: ${node.type}`);
    }
  }

  private evalBinaryOp(op: string, a: any, b: any): any {
    switch (op) {
      case "+":
        return a + b;
      case "-":
        return a - b;
      case "*":
        return a * b;
      case "/":
        if (b === 0) throw new Error("#DIV/0!");
        return a / b;
      case "^":
        return Math.pow(a, b);
      case "%":
        return a % b;
      case "=":
        return a === b;
      case "<":
        return a < b;
      case ">":
        return a > b;
      case "<=":
        return a <= b;
      case ">=":
        return a >= b;
      case "<>":
        return a !== b;
      default:
        throw new Error(`Unknown operator: ${op}`);
    }
  }

  private evalUnaryOp(op: string, val: any): any {
    switch (op) {
      case "-":
        return -val;
      case "+":
        return +val;
      default:
        throw new Error(`Unknown unary operator: ${op}`);
    }
  }

  buildDependencyGraph(sheet: Sheet): DependencyGraph {
    const dag = new DependencyGraph();

    for (let r = 0; r < sheet.rowCount; r++) {
      for (let c = 0; c < sheet.colCount; c++) {
        const cell = sheet.getCell(r, c);
        if (cell?.formula) {
          const cellRef = this.coordToCellRef(r, c);
          console.log(`[CalcEngine] Building dependency graph: Found formula in cell ${cellRef}: "${cell.formula}"`);
          const refs = this.parser.extractReferences(cell.formula);

          refs.forEach((ref) => {
            dag.addEdge(cellRef, ref);
          });
        }
      }
    }

    return dag;
  }

  clearCache(): void {
    this.cache.clear();
  }

  getRegistry(): FormulaRegistry {
    return this.registry;
  }

  /**
   * Adjust a formula when copying from one cell to another
   * Handles relative and absolute references ($A$1, $A1, A$1, A1)
   */
  adjustFormula(formula: string, fromRow: number, fromCol: number, toRow: number, toCol: number): string {
    const rowOffset = toRow - fromRow;
    const colOffset = toCol - fromCol;

    if (rowOffset === 0 && colOffset === 0) {
      return formula;
    }

    // Remove the leading '=' if present
    const cleanFormula = formula.startsWith('=') ? formula.substring(1) : formula;

    // Replace cell references with adjusted ones
    const adjusted = cleanFormula.replace(
      /(\$?)([A-Z]+)(\$?)(\d+)/g,
      (_match, colAbs, col, rowAbs, row) => {
        // Convert column letters to number
        const colNum = this.columnNameToNumber(col);
        const rowNum = parseInt(row, 10) - 1; // Convert to 0-indexed

        // Adjust based on absolute/relative markers
        const newCol = colAbs === '$' ? colNum : colNum + colOffset;
        const newRow = rowAbs === '$' ? rowNum : rowNum + rowOffset;

        // Ensure we don't go negative
        const finalCol = Math.max(0, newCol);
        const finalRow = Math.max(0, newRow);

        // Convert back to column name
        const newColName = this.numberToColumnName(finalCol);
        const newRowName = finalRow + 1; // Convert back to 1-indexed

        return `${colAbs}${newColName}${rowAbs}${newRowName}`;
      }
    );

    return '=' + adjusted;
  }

  private columnNameToNumber(name: string): number {
    let result = 0;
    for (let i = 0; i < name.length; i++) {
      result = result * 26 + (name.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
    }
    return result - 1; // Convert to 0-indexed
  }

  private numberToColumnName(num: number): string {
    let result = '';
    let n = num + 1; // Convert to 1-indexed

    while (n > 0) {
      const remainder = (n - 1) % 26;
      result = String.fromCharCode('A'.charCodeAt(0) + remainder) + result;
      n = Math.floor((n - 1) / 26);
    }

    return result;
  }

  private cellRefToCoord(ref: string): { row: number; col: number } {
    const match = ref.match(/([A-Z]+)(\d+)/);
    if (!match) throw new Error(`Invalid cell ref: ${ref}`);

    let col = 0;
    for (let i = 0; i < match[1].length; i++) {
      col = col * 26 + (match[1].charCodeAt(i) - 64);
    }
    col--;

    const row = parseInt(match[2]) - 1;
    return { row, col };
  }

  private coordToCellRef(row: number, col: number): string {
    let colRef = "";
    let n = col + 1;
    while (n > 0) {
      colRef = String.fromCharCode(64 + (n % 26 || 26)) + colRef;
      n = Math.floor((n - 1) / 26);
    }
    return `${colRef}${row + 1}`;
  }

  private inferType(value: any): CellType {
    if (value === null || value === undefined) return "auto";
    if (typeof value === "number") return "number";
    if (typeof value === "string") return "string";
    if (typeof value === "boolean") return "boolean";
    if (value instanceof Date) return "date";
    return "auto";
  }
}
