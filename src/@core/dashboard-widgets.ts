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

  constructor(config: WidgetConfig, _sheet: Sheet, container: HTMLDivElement) {
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

  constructor(config: WidgetConfig, _sheet: Sheet, container: HTMLDivElement) {
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
  private container: HTMLDivElement;
  private tableManager: TableManager;
  private onWidgetChange?: () => void;

  constructor(config: WidgetConfig, _sheet: Sheet, container: HTMLDivElement, onWidgetChange?: () => void) {
    this.config = config;
    this.container = container;
    this.tableManager = TableManager.getInstance();
    this.onWidgetChange = onWidgetChange;
  }

  render(): void {
    this.config.tableWidgetConfig = this.config.tableWidgetConfig || {};
    this.container.innerHTML = ''; // Clear previous content

    if (!this.config.tableId) {
      this.container.innerHTML = '<div style="color: #ef4444;">Erro: Tabela não especificada</div>';
      return;
    }
    const table = this.tableManager.getTable(this.config.tableId);
    if (!table) {
      this.container.innerHTML = '<div style="color: #ef4444;">Erro: Tabela não encontrada</div>';
      return;
    }

    const tableWrapper = document.createElement('div');
    tableWrapper.style.width = '100%';
    tableWrapper.style.height = '100%';
    tableWrapper.style.display = 'flex';
    tableWrapper.style.flexDirection = 'column';
    this.container.appendChild(tableWrapper);

    const scrollArea = document.createElement('div');
    scrollArea.style.flex = '1';
    scrollArea.style.overflow = 'auto';
    tableWrapper.appendChild(scrollArea);

    const { htmlTable, paginationInfo } = this.createTable(table);
    scrollArea.appendChild(htmlTable);

    // Add pagination controls if needed
    if (paginationInfo) {
      const paginationControls = this.createPaginationControls(paginationInfo);
      tableWrapper.appendChild(paginationControls);
    }
  }

  public renderSettings(container: HTMLElement): void {
    const config = this.config.tableWidgetConfig || {};
    const table = this.tableManager.getTable(this.config.tableId!)
    if (!table) {
        container.innerHTML = '<p style="color: #ef4444;">Tabela associada não encontrada.</p>';
        return;
    }

    const hidden = config.hiddenColumns || [];
    const sort = config.sort;
    const topN = config.topN;
    const showTotal = config.showTotalRow ?? table.showTotalRow;

    const columnsOptions = table.columns.map(col => `<option value="${col.id}" ${sort?.columnId === col.id ? 'selected' : ''}>${col.name}</option>`).join('');

    container.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 8px; max-width: 100%; overflow: hidden;">
            <!-- Colunas -->
            <div class="accordion-section" data-section="columns">
                <div class="accordion-header" style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #f3f4f6; cursor: pointer; border-radius: 4px; user-select: none;">
                    <span style="font-weight: 600; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">📋 Colunas</span>
                    <span class="accordion-icon" style="font-size: 12px; flex-shrink: 0; margin-left: 8px;">▼</span>
                </div>
                <div class="accordion-content" style="padding: 10px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 4px 4px; box-sizing: border-box;">
                    <div style="max-height: 150px; overflow-y: auto; overflow-x: hidden; background: #fff; padding: 8px; border-radius: 4px; border: 1px solid #ddd; box-sizing: border-box;">
                        ${table.columns.map(col => `
                            <div style="display: flex; align-items: center; margin-bottom: 4px; overflow: hidden;">
                                <label style="flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 12px; min-width: 0;">
                                    <input type="checkbox" class="table-widget-col-toggle" data-col-id="${col.id}" ${hidden.includes(col.id) ? '' : 'checked'} style="flex-shrink: 0;">
                                    ${col.name}
                                </label>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>

            <!-- Ordenação -->
            <div class="accordion-section" data-section="sort">
                <div class="accordion-header" style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #f3f4f6; cursor: pointer; border-radius: 4px; user-select: none;">
                    <span style="font-weight: 600; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">↕️ Ordenação</span>
                    <span class="accordion-icon" style="font-size: 12px; flex-shrink: 0; margin-left: 8px;">▶</span>
                </div>
                <div class="accordion-content" style="display: none; padding: 10px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 4px 4px; box-sizing: border-box;">
                    <div style="display: flex; gap: 8px; max-width: 100%;">
                        <select class="table-widget-sort-col" style="flex: 1; min-width: 0; font-size: 12px; padding: 4px; box-sizing: border-box;">
                            <option value="">Nenhuma</option>
                            ${columnsOptions}
                        </select>
                        <button class="table-widget-sort-dir" style="font-size: 12px; padding: 4px 8px; cursor: pointer; flex-shrink: 0; border: 1px solid #ddd; background: #fff; border-radius: 4px;">${sort?.direction === 'desc' ? '🔽' : '🔼'}</button>
                    </div>
                </div>
            </div>

            <!-- Filtro -->
            <div class="accordion-section" data-section="filter">
                <div class="accordion-header" style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #f3f4f6; cursor: pointer; border-radius: 4px; user-select: none;">
                    <span style="font-weight: 600; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">🔍 Filtro de Texto</span>
                    <span class="accordion-icon" style="font-size: 12px; flex-shrink: 0; margin-left: 8px;">▶</span>
                </div>
                <div class="accordion-content" style="display: none; padding: 10px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 4px 4px; box-sizing: border-box;">
                    <input type="text" class="table-widget-text-filter" placeholder="Buscar..." value="${config.textFilter || ''}" style="width: 100%; padding: 6px 8px; font-size: 12px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;">
                </div>
            </div>

            <!-- Visualização -->
            <div class="accordion-section" data-section="display">
                <div class="accordion-header" style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #f3f4f6; cursor: pointer; border-radius: 4px; user-select: none;">
                    <span style="font-weight: 600; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">👁️ Visualização</span>
                    <span class="accordion-icon" style="font-size: 12px; flex-shrink: 0; margin-left: 8px;">▶</span>
                </div>
                <div class="accordion-content" style="display: none; padding: 10px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 4px 4px; box-sizing: border-box; overflow: hidden;">
                    <div style="font-size: 12px; margin-bottom: 8px; overflow: hidden;">
                        <div style="margin-bottom: 4px;">Top N:</div>
                        <input type="number" class="table-widget-top-n" value="${topN || ''}" placeholder="Todos" style="width: 100%; max-width: 80px; padding: 4px; font-size: 12px; box-sizing: border-box;">
                    </div>
                    <label style="font-size: 12px; display: flex; align-items: center; margin-bottom: 8px; overflow: hidden;">
                        <input type="checkbox" class="table-widget-total-row" ${showTotal ? 'checked' : ''} style="flex-shrink: 0; margin-right: 6px;">
                        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Linha de totais</span>
                    </label>
                    <label style="font-size: 12px; display: flex; align-items: center; overflow: hidden;">
                        <input type="checkbox" class="table-widget-alternating" ${config.showAlternatingRows ?? table.showBandedRows ? 'checked' : ''} style="flex-shrink: 0; margin-right: 6px;">
                        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Linhas alternadas</span>
                    </label>
                </div>
            </div>

            <!-- Paginação -->
            <div class="accordion-section" data-section="pagination">
                <div class="accordion-header" style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #f3f4f6; cursor: pointer; border-radius: 4px; user-select: none;">
                    <span style="font-weight: 600; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">📄 Paginação</span>
                    <span class="accordion-icon" style="font-size: 12px; flex-shrink: 0; margin-left: 8px;">▶</span>
                </div>
                <div class="accordion-content" style="display: none; padding: 10px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 4px 4px; box-sizing: border-box; overflow: hidden;">
                    <div style="font-size: 12px;">
                        <div style="margin-bottom: 4px;">Itens/página:</div>
                        <input type="number" class="table-widget-items-per-page" value="${config.itemsPerPage || ''}" placeholder="Todos" style="width: 100%; max-width: 80px; padding: 4px; font-size: 12px; box-sizing: border-box;">
                    </div>
                </div>
            </div>
        </div>
    `;

    // Accordion toggle functionality
    const accordionHeaders = container.querySelectorAll('.accordion-header');
    accordionHeaders.forEach((header) => {
        // Hover effect
        header.addEventListener('mouseenter', () => {
            (header as HTMLElement).style.backgroundColor = '#e5e7eb';
        });
        header.addEventListener('mouseleave', () => {
            (header as HTMLElement).style.backgroundColor = '#f3f4f6';
        });

        // Toggle click
        header.addEventListener('click', () => {
            const section = header.parentElement;
            const content = section?.querySelector('.accordion-content') as HTMLElement;
            const icon = header.querySelector('.accordion-icon');

            if (content && icon) {
                const isExpanded = content.style.display !== 'none';
                content.style.display = isExpanded ? 'none' : 'block';
                icon.textContent = isExpanded ? '▶' : '▼';
            }
        });
    });

    // --- Event Listeners ---
    container.querySelectorAll('.table-widget-col-toggle').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const target = e.target as HTMLInputElement;
            const colId = target.dataset.colId;
            if (!colId) return;

            if (!this.config.tableWidgetConfig) this.config.tableWidgetConfig = {};
            const currentHidden = this.config.tableWidgetConfig.hiddenColumns || [];
            if (target.checked) {
                this.config.tableWidgetConfig.hiddenColumns = currentHidden.filter(id => id !== colId);
            } else {
                this.config.tableWidgetConfig.hiddenColumns = [...currentHidden, colId];
            }
            this.render();
            this.onWidgetChange?.();
        });
    });

    const sortColSelect = container.querySelector('.table-widget-sort-col') as HTMLSelectElement;
    sortColSelect.addEventListener('change', () => {
        if (!this.config.tableWidgetConfig) this.config.tableWidgetConfig = {};
        const colId = sortColSelect.value;
        if (colId) {
            this.config.tableWidgetConfig.sort = {
                columnId: colId,
                direction: this.config.tableWidgetConfig.sort?.direction || 'asc'
            };
        } else {
            delete this.config.tableWidgetConfig.sort;
        }
        this.render();
        this.onWidgetChange?.();
    });

    const sortDirButton = container.querySelector('.table-widget-sort-dir') as HTMLButtonElement;
    sortDirButton.addEventListener('click', () => {
        if (!this.config.tableWidgetConfig) this.config.tableWidgetConfig = {};
        if (this.config.tableWidgetConfig.sort) {
            this.config.tableWidgetConfig.sort.direction = this.config.tableWidgetConfig.sort.direction === 'asc' ? 'desc' : 'asc';
            this.render();
            this.onWidgetChange?.();
        }
    });

    const topNInput = container.querySelector('.table-widget-top-n') as HTMLInputElement;
    topNInput.addEventListener('change', () => {
        if (!this.config.tableWidgetConfig) this.config.tableWidgetConfig = {};
        const value = parseInt(topNInput.value, 10);
        this.config.tableWidgetConfig.topN = isNaN(value) || value <= 0 ? null : value;
        this.render();
        this.onWidgetChange?.();
    });

    const totalRowCheckbox = container.querySelector('.table-widget-total-row') as HTMLInputElement;
    totalRowCheckbox.addEventListener('change', () => {
        if (!this.config.tableWidgetConfig) this.config.tableWidgetConfig = {};
        this.config.tableWidgetConfig.showTotalRow = totalRowCheckbox.checked;
        this.render();
        this.onWidgetChange?.();
    });

    const alternatingCheckbox = container.querySelector('.table-widget-alternating') as HTMLInputElement;
    alternatingCheckbox.addEventListener('change', () => {
        if (!this.config.tableWidgetConfig) this.config.tableWidgetConfig = {};
        this.config.tableWidgetConfig.showAlternatingRows = alternatingCheckbox.checked;
        this.render();
        this.onWidgetChange?.();
    });

    const textFilterInput = container.querySelector('.table-widget-text-filter') as HTMLInputElement;
    textFilterInput.addEventListener('input', () => {
        if (!this.config.tableWidgetConfig) this.config.tableWidgetConfig = {};
        this.config.tableWidgetConfig.textFilter = textFilterInput.value;
        this.config.tableWidgetConfig.currentPage = 0; // Reset to first page on filter
        this.render();
        this.onWidgetChange?.();
    });

    const itemsPerPageInput = container.querySelector('.table-widget-items-per-page') as HTMLInputElement;
    itemsPerPageInput.addEventListener('change', () => {
        if (!this.config.tableWidgetConfig) this.config.tableWidgetConfig = {};
        const value = parseInt(itemsPerPageInput.value, 10);
        this.config.tableWidgetConfig.itemsPerPage = isNaN(value) || value <= 0 ? null : value;
        this.config.tableWidgetConfig.currentPage = 0; // Reset to first page
        this.render();
        this.onWidgetChange?.();
    });
  }

  private createTable(table: StructuredTable): {
    htmlTable: HTMLTableElement;
    paginationInfo: { currentPage: number; totalPages: number; totalRows: number; itemsPerPage: number } | null
  } {
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
        return { htmlTable, paginationInfo: null };
    }

    const config = this.config.tableWidgetConfig || {};
    const hiddenCols = config.hiddenColumns || [];
    const visibleCols = table.columns.filter(c => !hiddenCols.includes(c.id));

    // --- Data Transformation ---
    let displayRows: { [key: string]: any }[] = [];
    const dataStartRow = table.hasHeaders ? table.range.startRow + 1 : table.range.startRow;
    const dataEndRow = table.showTotalRow ? table.range.endRow - 1 : table.range.endRow;

    for (let r = dataStartRow; r <= dataEndRow; r++) {
        const rowData: { [key: string]: any } = {};
        table.columns.forEach((col, colIndex) => {
            const cell = tableSheet.getCell(r, table.range.startCol + colIndex);
            rowData[col.id] = cell?.value;
        });
        displayRows.push(rowData);
    }

    // Text Filter
    if (config.textFilter && config.textFilter.trim()) {
        const filterText = config.textFilter.toLowerCase();
        displayRows = displayRows.filter(row => {
            return visibleCols.some(col => {
                const value = row[col.id];
                return value != null && String(value).toLowerCase().includes(filterText);
            });
        });
    }

    // Sorting
    if (config.sort) {
        const { columnId, direction } = config.sort;
        displayRows.sort((a, b) => {
            const valA = a[columnId];
            const valB = b[columnId];
            if (valA == null) return 1;
            if (valB == null) return -1;
            if (typeof valA === 'number' && typeof valB === 'number') {
                return direction === 'asc' ? valA - valB : valB - valA;
            }
            const strA = String(valA).toLocaleLowerCase();
            const strB = String(valB).toLocaleLowerCase();
            if (strA < strB) return direction === 'asc' ? -1 : 1;
            if (strA > strB) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    }

    // Top N with "Others" row
    if (config.topN && config.topN > 0 && config.topN < displayRows.length) {
        const topRows = displayRows.slice(0, config.topN);
        const otherRows = displayRows.slice(config.topN);
        const othersData: { [key: string]: any } = {};

        visibleCols.forEach((col, index) => {
            if (index === 0) {
                othersData[col.id] = `Outros (${otherRows.length})`;
            } else if (col.dataType === 'number' || col.dataType === 'currency') {
                othersData[col.id] = otherRows.reduce((sum, row) => sum + (Number(row[col.id]) || 0), 0);
            } else {
                othersData[col.id] = '';
            }
        });
        displayRows = [...topRows, othersData];
    }

    // Pagination
    const totalRows = displayRows.length;
    let currentPage = config.currentPage ?? 0;
    const itemsPerPage = config.itemsPerPage;
    const hasPagination = itemsPerPage && itemsPerPage > 0;
    const totalPages = hasPagination ? Math.ceil(totalRows / itemsPerPage) : 1;

    // Ensure currentPage is valid
    if (currentPage >= totalPages) currentPage = Math.max(0, totalPages - 1);
    if (currentPage < 0) currentPage = 0;

    if (hasPagination) {
        const startIdx = currentPage * itemsPerPage;
        const endIdx = Math.min(startIdx + itemsPerPage, totalRows);
        displayRows = displayRows.slice(startIdx, endIdx);
    }

    // --- Rendering ---
    const showTotalRow = config.showTotalRow ?? table.showTotalRow;
    const showAlternating = config.showAlternatingRows ?? table.showBandedRows;

    // Headers
    if (table.hasHeaders && table.showHeaderRow) {
      const thead = document.createElement('thead');
      thead.style.position = 'sticky';
      thead.style.top = '0';
      thead.style.zIndex = '1';
      const headerRow = document.createElement('tr');
      visibleCols.forEach((column) => {
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
    displayRows.forEach((rowData, rowIndex) => {
      const tr = document.createElement('tr');
      const isEven = rowIndex % 2 === 0;
      const isOthersRow = rowIndex === displayRows.length - 1 && config.topN && config.topN < (config.sort ? displayRows.length : dataEndRow - dataStartRow + 1);

      tr.style.backgroundColor = showAlternating ? (isEven ? table.style.evenRowBg : table.style.oddRowBg) : 'transparent';
      if (isOthersRow) {
        tr.style.fontWeight = 'bold';
        tr.style.backgroundColor = '#f3f4f6';
      }

      visibleCols.forEach((column) => {
        const td = document.createElement('td');
        const cellValue = rowData[column.id];
        td.textContent = cellValue != null ? String(cellValue) : '';
        td.style.padding = '10px 12px';
        td.style.borderBottom = `1px solid ${table.style.borderColor}`;
        if (column?.format) {
          if (column.format.textColor) td.style.color = column.format.textColor;
          if (column.format.alignment) td.style.textAlign = column.format.alignment;
          if (column.format.bold) td.style.fontWeight = 'bold';
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    htmlTable.appendChild(tbody);

    // Total row
    if (showTotalRow) {
      const tfoot = document.createElement('tfoot');
      tfoot.style.position = 'sticky';
      tfoot.style.bottom = '0';
      const totalRowTr = document.createElement('tr');
      visibleCols.forEach((column) => {
        const td = document.createElement('td');
        const cell = tableSheet.getCell(table.range.endRow, table.range.startCol + column.index);
        td.textContent = cell?.value != null ? String(cell.value) : '';
        td.style.padding = '12px';
        td.style.backgroundColor = table.style.totalRowBg;
        td.style.color = table.style.headerText;
        td.style.fontWeight = 'bold';
        td.style.borderTop = `2px solid ${table.style.borderColor}`;
        totalRowTr.appendChild(td);
      });
      tfoot.appendChild(totalRowTr);
      htmlTable.appendChild(tfoot);
    }

    // Return table and pagination info
    const paginationInfo = hasPagination ? {
      currentPage,
      totalPages,
      totalRows,
      itemsPerPage: itemsPerPage!
    } : null;

    return { htmlTable, paginationInfo };
  }

  private createPaginationControls(info: { currentPage: number; totalPages: number; totalRows: number; itemsPerPage: number }): HTMLDivElement {
    const controls = document.createElement('div');
    controls.style.display = 'flex';
    controls.style.justifyContent = 'space-between';
    controls.style.alignItems = 'center';
    controls.style.padding = '8px 12px';
    controls.style.borderTop = '1px solid #e5e7eb';
    controls.style.backgroundColor = '#f9fafb';
    controls.style.fontSize = '12px';

    // Info text
    const infoText = document.createElement('div');
    const startItem = info.currentPage * info.itemsPerPage + 1;
    const endItem = Math.min((info.currentPage + 1) * info.itemsPerPage, info.totalRows);
    infoText.textContent = `Mostrando ${startItem}-${endItem} de ${info.totalRows}`;
    infoText.style.color = '#6b7280';
    controls.appendChild(infoText);

    // Navigation buttons
    const navButtons = document.createElement('div');
    navButtons.style.display = 'flex';
    navButtons.style.gap = '4px';

    const prevBtn = document.createElement('button');
    prevBtn.textContent = '← Anterior';
    prevBtn.style.padding = '4px 8px';
    prevBtn.style.fontSize = '12px';
    prevBtn.style.border = '1px solid #d1d5db';
    prevBtn.style.borderRadius = '4px';
    prevBtn.style.backgroundColor = '#ffffff';
    prevBtn.style.cursor = info.currentPage > 0 ? 'pointer' : 'not-allowed';
    prevBtn.disabled = info.currentPage === 0;
    prevBtn.onclick = () => {
      if (info.currentPage > 0) {
        if (!this.config.tableWidgetConfig) this.config.tableWidgetConfig = {};
        this.config.tableWidgetConfig.currentPage = info.currentPage - 1;
        this.render();
        this.onWidgetChange?.();
      }
    };
    navButtons.appendChild(prevBtn);

    const pageInfo = document.createElement('span');
    pageInfo.textContent = `Página ${info.currentPage + 1} de ${info.totalPages}`;
    pageInfo.style.padding = '4px 8px';
    pageInfo.style.color = '#374151';
    navButtons.appendChild(pageInfo);

    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Próxima →';
    nextBtn.style.padding = '4px 8px';
    nextBtn.style.fontSize = '12px';
    nextBtn.style.border = '1px solid #d1d5db';
    nextBtn.style.borderRadius = '4px';
    nextBtn.style.backgroundColor = '#ffffff';
    nextBtn.style.cursor = info.currentPage < info.totalPages - 1 ? 'pointer' : 'not-allowed';
    nextBtn.disabled = info.currentPage >= info.totalPages - 1;
    nextBtn.onclick = () => {
      if (info.currentPage < info.totalPages - 1) {
        if (!this.config.tableWidgetConfig) this.config.tableWidgetConfig = {};
        this.config.tableWidgetConfig.currentPage = info.currentPage + 1;
        this.render();
        this.onWidgetChange?.();
      }
    };
    navButtons.appendChild(nextBtn);

    controls.appendChild(navButtons);
    return controls;
  }
}
