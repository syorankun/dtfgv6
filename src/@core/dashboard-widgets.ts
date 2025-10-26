/**
 * DJ DataForge v6 - Dashboard Widget Renderers
 *
 * Módulo de renderização de widgets individuais para dashboards.
 * Cada widget é simples, modular e facilmente expansível.
 *
 * Widgets disponíveis:
 * - KPI: Indicadores chave de desempenho
 * - Table: Tabelas estruturadas
 * - Text: Conteúdo de texto formatado
 * - Image: Imagens e logos
 */

import type {
  WidgetConfig,
  KPIConfig,
  KPIConditionalColor,
  StructuredTable
} from './types';
import type { Sheet } from './workbook-consolidated';
import { TableManager } from './table-manager';
import { logger } from './storage-utils-consolidated';

// ============================================================================
// KPI WIDGET RENDERER
// ============================================================================

/**
 * Renderiza um widget de KPI (Key Performance Indicator)
 *
 * Características:
 * - Valor grande e destacado
 * - Ícone opcional
 * - Formatação condicional por cor
 * - Comparação com meta (opcional)
 * - Suporta múltiplas fontes de dados
 */
export class KPIWidgetRenderer {
  private config: WidgetConfig;
  private sheet: Sheet;
  private container: HTMLDivElement;

  constructor(config: WidgetConfig, sheet: Sheet, container: HTMLDivElement) {
    this.config = config;
    this.sheet = sheet;
    this.container = container;
  }

  render(): void {
    const kpiConfig = this.config.kpiConfig;
    if (!kpiConfig) {
      this.container.innerHTML = '<div style="color: #ef4444;">Erro: Configuração KPI não encontrada</div>';
      return;
    }

    // Calcular valor
    const value = this.calculateValue(kpiConfig);
    if (value === null || value === undefined) {
      this.container.innerHTML = '<div style="color: #9ca3af;">Sem dados</div>';
      return;
    }

    // Formatar valor
    const formattedValue = this.formatValue(value, kpiConfig);

    // Determinar cor (condicional ou padrão)
    const valueColor = this.getConditionalColor(value, kpiConfig) || kpiConfig.valueColor || '#1f2937';

    // Calcular comparação (se houver)
    const comparisonHTML = this.renderComparison(value, kpiConfig);

    // Renderizar KPI
    this.container.innerHTML = `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        padding: 24px;
        text-align: center;
      ">
        ${kpiConfig.icon ? `
          <div style="
            font-size: 48px;
            margin-bottom: 16px;
            color: ${kpiConfig.iconColor || '#6b7280'};
          ">
            ${kpiConfig.icon}
          </div>
        ` : ''}

        <div style="
          font-size: ${kpiConfig.fontSize || 48}px;
          font-weight: bold;
          color: ${valueColor};
          line-height: 1.2;
          margin-bottom: 8px;
        ">
          ${kpiConfig.prefix || ''}${formattedValue}${kpiConfig.suffix || ''}
        </div>

        ${comparisonHTML}
      </div>
    `;

    logger.debug('[KPIWidget] Rendered', { value, formattedValue });
  }

  /**
   * Calcula o valor do KPI baseado na fonte configurada
   */
  private calculateValue(config: KPIConfig): number | null {
    switch (config.valueSource) {
      case 'cell':
        return this.getValueFromCell(config.cellRef);

      case 'formula':
        return this.getValueFromFormula(config.formula);

      case 'aggregation':
        return this.getValueFromAggregation(config);

      default:
        logger.warn('[KPIWidget] Unknown value source', { source: config.valueSource });
        return null;
    }
  }

  /**
   * Obtém valor de uma célula específica
   */
  private getValueFromCell(cellRef?: string): number | null {
    if (!cellRef) return null;

    // Parse cell reference (e.g., "A1" -> row: 0, col: 0)
    const match = cellRef.match(/([A-Z]+)(\d+)/);
    if (!match) return null;

    const col = this.columnNameToIndex(match[1]);
    const row = parseInt(match[2]) - 1;

    const cell = this.sheet.getCell(row, col);
    const value = cell?.value;

    return typeof value === 'number' ? value : null;
  }

  /**
   * Obtém valor de uma fórmula
   */
  private getValueFromFormula(formula?: string): number | null {
    if (!formula) return null;

    // Procurar célula com essa fórmula (simplificado)
    // Em uma implementação completa, avaliaríamos a fórmula aqui
    for (let r = 0; r < this.sheet.rowCount; r++) {
      for (let c = 0; c < this.sheet.colCount; c++) {
        const cell = this.sheet.getCell(r, c);
        if (cell?.formula === formula) {
          return typeof cell.value === 'number' ? cell.value : null;
        }
      }
    }

    return null;
  }

  /**
   * Obtém valor de uma agregação de coluna de tabela
   */
  private getValueFromAggregation(config: KPIConfig): number | null {
    if (!config.tableId || config.columnIndex === undefined || !config.aggregation) {
      return null;
    }

    const tableManager = TableManager.getInstance();
    const table = tableManager.getTable(config.tableId);
    if (!table) return null;

    // Coletar valores da coluna
    const values: number[] = [];
    const dataStartRow = table.hasHeaders ? table.range.startRow + 1 : table.range.startRow;
    const dataEndRow = table.showTotalRow ? table.range.endRow - 1 : table.range.endRow;
    const col = table.range.startCol + config.columnIndex;

    for (let row = dataStartRow; row <= dataEndRow; row++) {
      const cell = this.sheet.getCell(row, col);
      if (typeof cell?.value === 'number') {
        values.push(cell.value);
      }
    }

    if (values.length === 0) return null;

    // Aplicar agregação
    switch (config.aggregation) {
      case 'sum':
        return values.reduce((a, b) => a + b, 0);
      case 'average':
        return values.reduce((a, b) => a + b, 0) / values.length;
      case 'min':
        return Math.min(...values);
      case 'max':
        return Math.max(...values);
      case 'count':
        return values.length;
      default:
        return null;
    }
  }

  /**
   * Formata o valor numérico de acordo com as configurações
   */
  private formatValue(value: number, config: KPIConfig): string {
    const decimals = config.decimals ?? 2;

    switch (config.format) {
      case 'currency':
        return value.toLocaleString('pt-BR', {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals
        });

      case 'percentage':
        return (value * 100).toLocaleString('pt-BR', {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals
        });

      case 'number':
      default:
        return value.toLocaleString('pt-BR', {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals
        });
    }
  }

  /**
   * Determina a cor do valor baseado em regras condicionais
   */
  private getConditionalColor(value: number, config: KPIConfig): string | null {
    if (!config.conditionalColors || config.conditionalColors.length === 0) {
      return null;
    }

    for (const rule of config.conditionalColors) {
      if (this.matchesCondition(value, rule)) {
        return rule.color;
      }
    }

    return null;
  }

  /**
   * Verifica se o valor atende a uma condição
   */
  private matchesCondition(value: number, rule: KPIConditionalColor): boolean {
    switch (rule.condition) {
      case 'greater':
        return value > rule.value;
      case 'less':
        return value < rule.value;
      case 'equal':
        return value === rule.value;
      case 'between':
        return rule.value2 !== undefined && value >= rule.value && value <= rule.value2;
      default:
        return false;
    }
  }

  /**
   * Renderiza comparação com meta ou valor anterior
   */
  private renderComparison(currentValue: number, config: KPIConfig): string {
    if (!config.comparison || config.comparison === 'none') {
      return '';
    }

    let referenceValue: number | null = null;
    let label = '';

    if (config.comparison === 'target' && config.targetValue !== undefined) {
      referenceValue = config.targetValue;
      label = 'vs Meta';
    } else if (config.comparison === 'previous' && config.previousValue !== undefined) {
      referenceValue = config.previousValue;
      label = 'vs Anterior';
    }

    if (referenceValue === null) return '';

    const difference = currentValue - referenceValue;
    const percentChange = (difference / referenceValue) * 100;
    const isPositive = difference >= 0;

    const icon = isPositive ? '📈' : '📉';
    const color = isPositive ? '#10b981' : '#ef4444';
    const sign = isPositive ? '+' : '';

    return `
      <div style="
        font-size: 14px;
        color: ${color};
        display: flex;
        align-items: center;
        gap: 4px;
        margin-top: 8px;
      ">
        <span>${icon}</span>
        <span style="font-weight: 600;">
          ${sign}${percentChange.toFixed(1)}%
        </span>
        <span style="color: #6b7280; font-size: 12px;">
          ${label}
        </span>
      </div>
    `;
  }

  /**
   * Converte nome de coluna (A-Z) para índice numérico
   */
  private columnNameToIndex(name: string): number {
    let index = 0;
    for (let i = 0; i < name.length; i++) {
      index = index * 26 + (name.charCodeAt(i) - 64);
    }
    return index - 1;
  }
}

// ============================================================================
// TEXT WIDGET RENDERER
// ============================================================================

/**
 * Renderiza um widget de texto formatado
 *
 * Características:
 * - Suporta formatação rica (negrito, itálico, sublinhado)
 * - Alinhamento configurável
 * - Tamanhos de fonte
 * - Cores personalizáveis
 */
export class TextWidgetRenderer {
  private config: WidgetConfig;
  private container: HTMLDivElement;

  constructor(config: WidgetConfig, container: HTMLDivElement) {
    this.config = config;
    this.container = container;
  }

  render(): void {
    const textConfig = this.config.textConfig;
    if (!textConfig) {
      this.container.innerHTML = '<div style="color: #ef4444;">Erro: Configuração de texto não encontrada</div>';
      return;
    }

    // Mapear tamanhos de fonte
    const fontSizes = {
      small: '14px',
      medium: '16px',
      large: '20px',
      xlarge: '28px'
    };

    const fontSize = fontSizes[textConfig.fontSize || 'medium'];
    const padding = textConfig.padding ?? 16;

    // Construir estilos de texto
    let fontStyle = '';
    if (textConfig.bold) fontStyle += 'font-weight: bold; ';
    if (textConfig.italic) fontStyle += 'font-style: italic; ';
    if (textConfig.underline) fontStyle += 'text-decoration: underline; ';

    this.container.innerHTML = `
      <div style="
        height: 100%;
        overflow: auto;
        padding: ${padding}px;
        font-size: ${fontSize};
        text-align: ${textConfig.alignment || 'left'};
        color: ${textConfig.textColor || '#1f2937'};
        background-color: ${textConfig.backgroundColor || 'transparent'};
        ${fontStyle}
        line-height: 1.6;
        word-wrap: break-word;
      ">
        ${this.sanitizeHTML(textConfig.content || 'Digite seu texto aqui...')}
      </div>
    `;

    logger.debug('[TextWidget] Rendered');
  }

  /**
   * Sanitização básica de HTML (expansível para XSS protection completo)
   */
  private sanitizeHTML(html: string): string {
    // Por enquanto, apenas escape de tags script
    // TODO: Implementar sanitização completa com biblioteca como DOMPurify
    return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  }
}

// ============================================================================
// IMAGE WIDGET RENDERER
// ============================================================================

/**
 * Renderiza um widget de imagem
 *
 * Características:
 * - Suporta URL ou base64
 * - Modos de ajuste (contain, cover, fill, none)
 * - Opacidade configurável
 * - Bordas arredondadas
 */
export class ImageWidgetRenderer {
  private config: WidgetConfig;
  private container: HTMLDivElement;

  constructor(config: WidgetConfig, container: HTMLDivElement) {
    this.config = config;
    this.container = container;
  }

  render(): void {
    const imageConfig = this.config.imageConfig;
    if (!imageConfig) {
      this.container.innerHTML = '<div style="color: #ef4444;">Erro: Configuração de imagem não encontrada</div>';
      return;
    }

    if (!imageConfig.source) {
      this.container.innerHTML = `
        <div style="
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #9ca3af;
          font-size: 48px;
        ">
          🖼️
        </div>
      `;
      return;
    }

    // Mapear modos de ajuste para CSS object-fit
    const objectFitMap = {
      contain: 'contain',
      cover: 'cover',
      fill: 'fill',
      none: 'none'
    };

    const objectFit = objectFitMap[imageConfig.fit || 'contain'];
    const opacity = imageConfig.opacity ?? 1;
    const borderRadius = imageConfig.borderRadius ?? 0;

    this.container.innerHTML = `
      <div style="
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      ">
        <img
          src="${this.escapeHTML(imageConfig.source)}"
          alt="${this.escapeHTML(imageConfig.alt || 'Imagem do dashboard')}"
          style="
            max-width: 100%;
            max-height: 100%;
            object-fit: ${objectFit};
            opacity: ${opacity};
            border-radius: ${borderRadius}px;
          "
          onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\\'color:#ef4444;\\'>❌ Erro ao carregar imagem</div>';"
        />
      </div>
    `;

    logger.debug('[ImageWidget] Rendered', { source: imageConfig.source.substring(0, 50) });
  }

  /**
   * Escape de HTML para prevenir XSS
   */
  private escapeHTML(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

import { kernel } from './kernel';

// ============================================================================
// TABLE WIDGET RENDERER (Melhorado)
// ============================================================================

/**
 * Renderiza um widget de tabela estruturada
 *
 * Reutiliza a lógica do DashboardRenderer mas com melhorias:
 * - Melhor responsividade
 * - Suporte a scroll interno
 * - Destaque de colunas/linhas
 */
export class TableWidgetRenderer {
  private config: WidgetConfig;
  private sheet: Sheet;
  private container: HTMLDivElement;
  private tableManager: TableManager;

  constructor(config: WidgetConfig, sheet: Sheet, container: HTMLDivElement) {
    this.config = config;
    this.sheet = sheet;
    this.container = container;
    this.tableManager = TableManager.getInstance();
  }

  render(): void {
    if (!this.config.tableId) {
      this.container.innerHTML = '<div style="color: #ef4444;">Erro: Tabela não especificada</div>';
      return;
    }

    const table = this.tableManager.getTable(this.config.tableId);
    if (!table) {
      this.container.innerHTML = '<div style="color: #ef4444;">Erro: Tabela não encontrada</div>';
      return;
    }

    // Container com scroll
    const wrapper = document.createElement('div');
    wrapper.style.width = '100%';
    wrapper.style.height = '100%';
    wrapper.style.overflow = 'auto';

    // Create HTML table
    const htmlTable = this.createTable(table);
    wrapper.appendChild(htmlTable);
    this.container.appendChild(wrapper);

    logger.debug('[TableWidget] Rendered', { tableId: this.config.tableId });
  }

  private createTable(table: StructuredTable): HTMLTableElement {
    const htmlTable = document.createElement('table');
    htmlTable.style.width = '100%';
    htmlTable.style.borderCollapse = 'collapse';
    htmlTable.style.fontSize = '13px';

    const tableSheet = kernel.workbookManager.getSheet(table.sheetId);

    if (!tableSheet) {
        const errorRow = document.createElement('tr');
        const errorCell = document.createElement('td');
        errorCell.colSpan = table.columns.length || 1;
        errorCell.innerHTML = `<div style="color: #ef4444; padding: 20px; text-align: center;">Erro: A planilha de origem da tabela (ID: ${table.sheetId}) não foi encontrada.</div>`;
        errorRow.appendChild(errorCell);
        htmlTable.appendChild(errorRow);
        return htmlTable;
    }

    // Headers
    if (table.hasHeaders && table.showHeaderRow) {
      const thead = document.createElement('thead');
      thead.style.position = 'sticky';
      thead.style.top = '0';
      thead.style.zIndex = '1';

      const headerRow = document.createElement('tr');
      table.columns.forEach((column) => {
        const th = document.createElement('th');
        th.textContent = column.name;
        th.style.padding = '12px';
        th.style.textAlign = 'left';
        th.style.backgroundColor = table.style.headerBg;
        th.style.color = table.style.headerText;
        th.style.fontWeight = 'bold';
        th.style.borderBottom = `2px solid ${table.style.borderColor}`;
        th.style.whiteSpace = 'nowrap';
        headerRow.appendChild(th);
      });

      thead.appendChild(headerRow);
      htmlTable.appendChild(thead);
    }

    // Data rows
    const tbody = document.createElement('tbody');
    const dataStartRow = table.hasHeaders ? table.range.startRow + 1 : table.range.startRow;
    const dataEndRow = table.showTotalRow ? table.range.endRow - 1 : table.range.endRow;

    for (let r = dataStartRow; r <= dataEndRow; r++) {
      const tr = document.createElement('tr');
      const isEven = (r - dataStartRow) % 2 === 0;

      // Hover effect
      tr.addEventListener('mouseenter', () => {
        tr.style.backgroundColor = table.style.highlightColor || '#f3f4f6';
      });
      tr.addEventListener('mouseleave', () => {
        tr.style.backgroundColor = table.showBandedRows
          ? (isEven ? table.style.evenRowBg : table.style.oddRowBg)
          : 'transparent';
      });

      if (table.showBandedRows) {
        tr.style.backgroundColor = isEven ? table.style.evenRowBg : table.style.oddRowBg;
      }

      for (let c = table.range.startCol; c <= table.range.endCol; c++) {
        const cell = tableSheet.getCell(r, c);
        const td = document.createElement('td');
        td.textContent = cell?.value != null ? String(cell.value) : '';
        td.style.padding = '10px 12px';
        td.style.borderBottom = `1px solid ${table.style.borderColor}`;

        // Apply column format
        const column = table.columns[c - table.range.startCol];
        if (column?.format) {
          if (column.format.textColor) td.style.color = column.format.textColor;
          if (column.format.alignment) td.style.textAlign = column.format.alignment;
          if (column.format.bold) td.style.fontWeight = 'bold';
        }

        tr.appendChild(td);
      }

      tbody.appendChild(tr);
    }

    htmlTable.appendChild(tbody);

    // Total row
    if (table.showTotalRow) {
      const tfoot = document.createElement('tfoot');
      tfoot.style.position = 'sticky';
      tfoot.style.bottom = '0';

      const totalRow = document.createElement('tr');
      for (let c = table.range.startCol; c <= table.range.endCol; c++) {
        const cell = tableSheet.getCell(table.range.endRow, c);
        const td = document.createElement('td');
        td.textContent = cell?.value != null ? String(cell.value) : '';
        td.style.padding = '12px';
        td.style.backgroundColor = table.style.totalRowBg;
        td.style.color = table.style.headerText;
        td.style.fontWeight = 'bold';
        td.style.borderTop = `2px solid ${table.style.borderColor}`;
        totalRow.appendChild(td);
      }

      tfoot.appendChild(totalRow);
      htmlTable.appendChild(tfoot);
    }

    return htmlTable;
  }
}
