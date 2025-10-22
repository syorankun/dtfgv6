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

// ============================================================================
// FORMULA PARSER
// ============================================================================

export class FormulaParser {
  /**
   * Tokenize formula string into tokens
   */
  tokenize(formula: string): Token[] {
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

      // Cell references (A1, B2, AA10)
      if (/[A-Z]/.test(char)) {
        let ref = "";
        while (i < formula.length && /[A-Z0-9:]/.test(formula[i])) {
          ref += formula[i++];
        }

        // Check if it's a range (A1:B10) or cell ref
        if (ref.includes(":")) {
          tokens.push({ type: "RANGE_REF", value: ref, position: i });
        } else if (/^[A-Z]+\d+$/.test(ref)) {
          tokens.push({ type: "CELL_REF", value: ref, position: i });
        } else {
          // It's a function name
          tokens.push({ type: "FUNCTION", value: ref, position: i });
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

    for (const arg of args) {
      if (Array.isArray(arg)) {
        result.push(...this.flattenNumbers(arg));
      } else if (typeof arg === "number" && !isNaN(arg)) {
        result.push(arg);
      }
    }

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
        throw new Error(`Circular reference detected at ${node}`);
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

  constructor() {
    this.parser = new FormulaParser();
    this.registry = new FormulaRegistry();
  }

  async init(): Promise<void> {
    // Future: load custom functions from storage
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

    // Build dependency graph
    const dag = this.buildDependencyGraph(sheet);

    try {
      const order = dag.topologicalSort();

      // Filter by cellRef if provided
      const cellsToRecalc = cellRef
        ? order.filter(
            (ref) =>
              ref === cellRef || order.indexOf(ref) > order.indexOf(cellRef)
          )
        : order;

      // Recalculate in order
      for (const ref of cellsToRecalc) {
        const coord = this.cellRefToCoord(ref);
        const cell = sheet.getCell(coord.row, coord.col);

        if (cell?.formula && (options?.force || !this.cache.has(ref))) {
          await this.evalCell(ref, sheet);
          cellsProcessed++;
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
    const coord = this.cellRefToCoord(cellRef);
    const cell = sheet.getCell(coord.row, coord.col);

    if (!cell?.formula) return;

    try {
      const tokens = this.parser.tokenize(cell.formula);
      const ast = this.parser.parse(tokens);
      const result = await this.evalAST(ast, sheet);

      // Update cell value
      sheet.setCell(coord.row, coord.col, result, {
        formula: cell.formula,
        type: this.inferType(result),
      });

      this.cache.set(cellRef, result);
    } catch (error: any) {
      sheet.setCell(coord.row, coord.col, `#ERROR!`, {
        formula: cell.formula,
        type: "error",
      });
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
        return b === 0 ? "#DIV/0!" : a / b;
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
