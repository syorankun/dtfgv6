
import type { Token, ASTNode } from "../types";

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
