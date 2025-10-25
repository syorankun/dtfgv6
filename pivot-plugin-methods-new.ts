// NOVO CÓDIGO ROBUSTO PARA PIVOT PLUGIN - Para ser inserido no lugar dos métodos antigos

/**
 * Show Styles Gallery with live preview - Excel/Google Sheets style
 * FEATURE 1: Table Styles Gallery (Excel)
 */
private showStylesGallery(): void {
  if (!this.context || !this.tableManager) return;

  const sheet = this.context.kernel.workbookManager.getActiveSheet();
  if (!sheet) {
    this.context.ui.showToast('Selecione uma planilha primeiro', 'warning');
    return;
  }

  const grid = this.context.kernel.getGrid();
  const activeTable = grid ? this.findTableAtCell(sheet, grid.activeRow, grid.activeCol) : null;

  if (!activeTable) {
    this.context.ui.showToast('Selecione uma célula dentro de uma tabela para aplicar estilos', 'warning');
    return;
  }

  // Get all available styles
  const styles = this.tableManager.getAvailableStyles();
  const currentStyle = activeTable.style.id;

  const stylesHTML = styles.map(style => `
    <div class="style-card" data-style-id="${style.id}" style="
      padding: 16px;
      background: var(--theme-bg-secondary);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.3s;
      border: 3px solid ${currentStyle === style.id ? '#667eea' : 'transparent'};
      position: relative;
    ">
      ${currentStyle === style.id ? '<div style="position: absolute; top: 8px; right: 8px; background: #667eea; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 14px;">✓</div>' : ''}

      <!-- Preview da tabela -->
      <div style="margin-bottom: 12px; border-radius: 4px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <!-- Header -->
        <div style="background: ${style.headerBg}; color: ${style.headerText}; padding: 8px; font-weight: 600; font-size: 11px; text-align: center;">
          ${style.name}
        </div>
        <!-- Rows -->
        <div style="background: ${style.evenRowBg}; padding: 6px 8px; font-size: 10px; border-bottom: 1px solid ${style.borderColor};">Linha Par</div>
        <div style="background: ${style.oddRowBg}; padding: 6px 8px; font-size: 10px; border-bottom: 1px solid ${style.borderColor};">Linha Ímpar</div>
        ${style.id !== 'minimal-gray' ? `<div style="background: ${style.totalRowBg}; color: ${style.headerText}; padding: 6px 8px; font-size: 10px; font-weight: 600;">Total</div>` : ''}
      </div>

      <div style="font-weight: 600; font-size: 13px; color: var(--theme-text-primary); margin-bottom: 4px;">${style.name}</div>
      <div style="font-size: 11px; color: var(--theme-text-secondary);">
        ${currentStyle === style.id ? 'Estilo atual' : 'Clique para aplicar'}
      </div>
    </div>
  `).join('');

  const modalHTML = `
    <div id="styles-gallery-modal" class="modal-overlay" style="background: rgba(0,0,0,0.7); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 10000;">
      <div class="modal" style="background: var(--theme-bg-primary); border-radius: 12px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); max-width: 900px; width: 95%; max-height: 90vh; overflow: auto;">
        <!-- Header -->
        <div style="padding: 24px; border-bottom: 2px solid var(--theme-border-color); background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 12px 12px 0 0; position: sticky; top: 0; z-index: 1;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h3 style="margin: 0 0 8px 0; font-size: 26px; font-weight: 700;">🎨 Galeria de Estilos</h3>
              <p style="margin: 0; opacity: 0.9; font-size: 14px;">Escolha um estilo para a tabela "${activeTable.name}"</p>
            </div>
            <button id="close-styles-gallery" style="background: rgba(255,255,255,0.2); border: none; font-size: 28px; cursor: pointer; color: white; width: 42px; height: 42px; border-radius: 50%; transition: all 0.2s;">&times;</button>
          </div>
        </div>

        <!-- Content -->
        <div style="padding: 24px;">
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px;">
            ${stylesHTML}
          </div>
        </div>

        <!-- Footer -->
        <div style="padding: 16px 24px; border-top: 1px solid var(--theme-border-color); background: var(--theme-bg-secondary); border-radius: 0 0 12px 12px; position: sticky; bottom: 0;">
          <div style="font-size: 12px; color: var(--theme-text-secondary); text-align: center;">
            💡 Dica: O estilo será aplicado imediatamente à tabela selecionada
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHTML);

  // Event listeners
  document.getElementById('close-styles-gallery')?.addEventListener('click', () => {
    document.getElementById('styles-gallery-modal')?.remove();
  });

  // Style card handlers
  const styleCards = document.querySelectorAll('.style-card');
  styleCards.forEach(card => {
    card.addEventListener('mouseenter', () => {
      const styleId = card.getAttribute('data-style-id');
      if (styleId !== currentStyle) {
        (card as HTMLElement).style.borderColor = '#667eea55';
        (card as HTMLElement).style.transform = 'translateY(-4px)';
        (card as HTMLElement).style.boxShadow = '0 8px 20px rgba(102, 126, 234, 0.3)';
      }
    });
    card.addEventListener('mouseleave', () => {
      const styleId = card.getAttribute('data-style-id');
      if (styleId !== currentStyle) {
        (card as HTMLElement).style.borderColor = 'transparent';
        (card as HTMLElement).style.transform = 'translateY(0)';
        (card as HTMLElement).style.boxShadow = 'none';
      }
    });
    card.addEventListener('click', () => {
      const styleId = card.getAttribute('data-style-id');
      if (styleId && styleId !== currentStyle) {
        this.applyStyleToTable(activeTable, sheet, styleId);
        document.getElementById('styles-gallery-modal')?.remove();
      }
    });
  });
}

/**
 * Apply style to table
 */
private applyStyleToTable(table: any, sheet: any, styleId: string): void {
  if (!this.tableManager || !this.context) return;

  const styles = this.tableManager.getAvailableStyles();
  const newStyle = styles.find(s => s.id === styleId);

  if (!newStyle) return;

  table.style = newStyle;
  this.tableManager.applyTableFormatting(table, sheet);

  const grid = this.context.kernel.getGrid();
  if (grid) grid.render();

  this.context.ui.showToast(`Estilo "${newStyle.name}" aplicado com sucesso!`, 'success');
  this.refreshTableStudioPanel();
}

/**
 * Toggle table conversion (Table <-> Range)
 * FEATURE 2: Convert to/from table (Excel)
 */
private toggleTableConversion(): void {
  if (!this.context || !this.tableManager) return;

  const sheet = this.context.kernel.workbookManager.getActiveSheet();
  if (!sheet) {
    this.context.ui.showToast('Selecione uma planilha primeiro', 'warning');
    return;
  }

  const grid = this.context.kernel.getGrid();
  const activeTable = grid ? this.findTableAtCell(sheet, grid.activeRow, grid.activeCol) : null;

  if (activeTable) {
    // Convert table to range
    this.convertTableToRange(activeTable, sheet);
  } else {
    // Convert range to table
    this.convertRangeToTable(sheet);
  }
}

/**
 * Convert table to normal range
 */
private convertTableToRange(table: any, sheet: any): void {
  if (!this.context || !this.tableManager) return;

  const confirm = window.confirm(`Converter tabela "${table.name}" para intervalo normal?\n\nIsso removerá a formatação estruturada, mas manterá os dados e estilos de célula.`);

  if (!confirm) return;

  try {
    // Keep cell data and formatting, but remove table structure
    const { range } = table;

    // Remove table from manager
    this.tableManager.deleteTable(table.id);

    const grid = this.context.kernel.getGrid();
    if (grid) grid.render();

    this.context.ui.showToast(`Tabela convertida para intervalo normal!`, 'success');
    this.refreshTableStudioPanel();
  } catch (error) {
    logger.error('[TableStudio] Failed to convert table to range', error);
    this.context.ui.showToast(`Erro ao converter: ${error}`, 'error');
  }
}

/**
 * Convert range to table
 */
private convertRangeToTable(sheet: any): void {
  if (!this.context) return;

  // Check if there's data
  const hasData = this.checkIfSheetHasData(sheet);
  if (!hasData) {
    this.context.ui.showToast('Selecione um intervalo com dados primeiro', 'warning');
    return;
  }

  // Open create table dialog
  this.showCreateTableDialog();
}

/**
 * Show resize table dialog
 * FEATURE 3: Resize table dynamically (Excel)
 */
private showResizeTableDialog(): void {
  if (!this.context || !this.tableManager) return;

  const sheet = this.context.kernel.workbookManager.getActiveSheet();
  if (!sheet) {
    this.context.ui.showToast('Selecione uma planilha primeiro', 'warning');
    return;
  }

  const grid = this.context.kernel.getGrid();
  const activeTable = grid ? this.findTableAtCell(sheet, grid.activeRow, grid.activeCol) : null;

  if (!activeTable) {
    this.context.ui.showToast('Selecione uma célula dentro de uma tabela', 'warning');
    return;
  }

  const { range } = activeTable;
  const currentRows = range.endRow - range.startRow + 1;
  const currentCols = range.endCol - range.startCol + 1;

  const modalHTML = `
    <div id="resize-table-modal" class="modal-overlay" style="background: rgba(0,0,0,0.7); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 10000;">
      <div class="modal" style="background: var(--theme-bg-primary); border-radius: 12px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); max-width: 500px; width: 90%;">
        <!-- Header -->
        <div style="padding: 24px; border-bottom: 2px solid var(--theme-border-color); background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 12px 12px 0 0;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h3 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 700;">↔️ Redimensionar Tabela</h3>
              <p style="margin: 0; opacity: 0.9; font-size: 14px;">${activeTable.name}</p>
            </div>
            <button id="close-resize-modal" style="background: rgba(255,255,255,0.2); border: none; font-size: 28px; cursor: pointer; color: white; width: 40px; height: 40px; border-radius: 50%; transition: all 0.2s;">&times;</button>
          </div>
        </div>

        <!-- Content -->
        <div style="padding: 24px;">
          <div style="margin-bottom: 20px; padding: 16px; background: var(--theme-bg-secondary); border-radius: 8px;">
            <div style="font-weight: 600; margin-bottom: 12px; color: var(--theme-text-primary);">Tamanho Atual</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13px;">
              <div>
                <div style="color: var(--theme-text-secondary); margin-bottom: 4px;">Linhas</div>
                <div style="font-size: 20px; font-weight: 700; color: var(--theme-color-primary);">${currentRows}</div>
              </div>
              <div>
                <div style="color: var(--theme-text-secondary); margin-bottom: 4px;">Colunas</div>
                <div style="font-size: 20px; font-weight: 700; color: var(--theme-color-primary);">${currentCols}</div>
              </div>
            </div>
          </div>

          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--theme-text-primary);">Novo Número de Linhas</label>
            <input type="number" id="new-rows" min="${activeTable.hasHeaders ? 2 : 1}" value="${currentRows}" style="
              width: 100%;
              padding: 12px;
              border: 2px solid var(--theme-border-color);
              border-radius: 6px;
              font-size: 16px;
              background: var(--theme-bg-secondary);
              color: var(--theme-text-primary);
            ">
            <div style="font-size: 11px; color: var(--theme-text-secondary); margin-top: 4px;">
              ${activeTable.hasHeaders ? 'Mínimo 2 linhas (cabeçalho + dados)' : 'Mínimo 1 linha'}
            </div>
          </div>

          <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--theme-text-primary);">Novo Número de Colunas</label>
            <input type="number" id="new-cols" min="1" value="${currentCols}" style="
              width: 100%;
              padding: 12px;
              border: 2px solid var(--theme-border-color);
              border-radius: 6px;
              font-size: 16px;
              background: var(--theme-bg-secondary);
              color: var(--theme-text-primary);
            ">
            <div style="font-size: 11px; color: var(--theme-text-secondary); margin-top: 4px;">Mínimo 1 coluna</div>
          </div>

          <div style="padding: 12px; background: rgba(102, 126, 234, 0.1); border-radius: 6px; border-left: 4px solid #667eea;">
            <div style="font-size: 12px; color: var(--theme-text-primary); line-height: 1.5;">
              <strong>⚠️ Atenção:</strong> Reduzir o tamanho pode resultar em perda de dados. Expandir adicionará células vazias.
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div style="padding: 16px 24px; border-top: 1px solid var(--theme-border-color); background: var(--theme-bg-secondary); border-radius: 0 0 12px 12px; display: flex; gap: 12px; justify-content: flex-end;">
          <button id="cancel-resize-btn" style="padding: 10px 20px; background: var(--theme-bg-primary); color: var(--theme-text-primary); border: 1px solid var(--theme-border-color); border-radius: 6px; cursor: pointer; font-weight: 600;">Cancelar</button>
          <button id="apply-resize-btn" style="padding: 10px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">Aplicar Redimensionamento</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHTML);

  // Event listeners
  document.getElementById('close-resize-modal')?.addEventListener('click', () => {
    document.getElementById('resize-table-modal')?.remove();
  });
  document.getElementById('cancel-resize-btn')?.addEventListener('click', () => {
    document.getElementById('resize-table-modal')?.remove();
  });
  document.getElementById('apply-resize-btn')?.addEventListener('click', () => {
    const newRows = parseInt((document.getElementById('new-rows') as HTMLInputElement).value);
    const newCols = parseInt((document.getElementById('new-cols') as HTMLInputElement).value);

    if (isNaN(newRows) || isNaN(newCols) || newRows < 1 || newCols < 1) {
      this.context?.ui.showToast('Valores inválidos!', 'error');
      return;
    }

    this.resizeTable(activeTable, sheet, newRows, newCols);
    document.getElementById('resize-table-modal')?.remove();
  });
}

/**
 * Resize table to new dimensions
 */
private resizeTable(table: any, sheet: any, newRows: number, newCols: number): void {
  if (!this.context || !this.tableManager) return;

  try {
    const { range, hasHeaders } = table;
    const minRows = hasHeaders ? 2 : 1;

    if (newRows < minRows) {
      this.context.ui.showToast(`A tabela precisa de pelo menos ${minRows} linhas!`, 'error');
      return;
    }

    // Update range
    const newEndRow = range.startRow + newRows - 1;
    const newEndCol = range.startCol + newCols - 1;

    table.range.endRow = newEndRow;
    table.range.endCol = newEndCol;

    // Update columns if needed
    const currentCols = table.columns.length;
    if (newCols > currentCols) {
      // Add new columns
      for (let i = currentCols; i < newCols; i++) {
        const colName = sheet.getColumnName(range.startCol + i);
        table.columns.push({
          id: nanoid(),
          name: hasHeaders ? `Nova${i + 1}` : colName,
          dataType: 'auto',
          index: i,
          format: {}
        });
      }
    } else if (newCols < currentCols) {
      // Remove columns
      table.columns.splice(newCols);
    }

    // Reapply formatting
    this.tableManager.applyTableFormatting(table, sheet);
    this.tableManager.addHeaderButtons(table, sheet);

    if (table.showTotalRow) {
      this.tableManager.applyTotals(table, sheet);
    }

    const grid = this.context.kernel.getGrid();
    if (grid) grid.render();

    this.context.ui.showToast(`Tabela redimensionada para ${newRows}x${newCols}!`, 'success');
    this.refreshTableStudioPanel();
  } catch (error) {
    logger.error('[TableStudio] Failed to resize table', error);
    this.context.ui.showToast(`Erro ao redimensionar: ${error}`, 'error');
  }
}

/**
 * FEATURE 4: Structured References / Table Formula Names (Excel)
 * Get structured reference for a cell in a table
 */
private getStructuredReference(table: any, sheet: any, row: number, col: number): string {
  const { range, hasHeaders, columns, name } = table;
  
  // Check if cell is within table
  if (row < range.startRow || row > range.endRow || col < range.startCol || col > range.endCol) {
    return '';
  }

  const columnIndex = col - range.startCol;
  const column = columns[columnIndex];
  
  if (!column) return '';

  const tableName = name.replace(/\s+/g, '_');
  const columnName = column.name.replace(/\s+/g, '_');

  // If header row
  if (hasHeaders && row === range.startRow) {
    return `${tableName}[#Cabeçalhos][@[${columnName}]]`;
  }

  // If total row
  if (table.showTotalRow && row === range.endRow) {
    return `${tableName}[#Totais][@[${columnName}]]`;
  }

  // If data row
  const dataRow = hasHeaders ? row - range.startRow - 1 : row - range.startRow;
  return `${tableName}[[#Esta Linha];[${columnName}]]`;
}

/**
 * FEATURE 5: Enhanced Total Row with multiple functions (Excel)
 * Show total row configuration dialog
 */
private showTotalRowConfig(table: any, sheet: any): void {
  if (!this.context || !this.tableManager) return;

  const totalFunctions = [
    { id: 'none', name: 'Nenhuma', icon: '—' },
    { id: 'sum', name: 'Soma', icon: '∑' },
    { id: 'average', name: 'Média', icon: '⌀' },
    { id: 'count', name: 'Contagem', icon: '#' },
    { id: 'countNumbers', name: 'Cont.Núm', icon: '№' },
    { id: 'min', name: 'Mínimo', icon: '↓' },
    { id: 'max', name: 'Máximo', icon: '↑' },
    { id: 'stdDev', name: 'Desvio Padrão', icon: 'σ' },
    { id: 'var', name: 'Variância', icon: 's²' },
    { id: 'median', name: 'Mediana', icon: 'M' },
    { id: 'product', name: 'Produto', icon: '×' }
  ];

  const columnsHTML = table.columns.map((col: any) => {
    const currentFunction = col.totalFunction || 'none';
    const optionsHTML = totalFunctions.map(fn => 
      `<option value="${fn.id}" ${currentFunction === fn.id ? 'selected' : ''}>${fn.icon} ${fn.name}</option>`
    ).join('');

    return `
      <div style="padding: 12px; background: var(--theme-bg-secondary); border-radius: 6px; margin-bottom: 8px;">
        <div style="font-weight: 600; margin-bottom: 8px; color: var(--theme-text-primary);">${col.name}</div>
        <select class="total-function-select" data-column-index="${col.index}" style="
          width: 100%;
          padding: 8px 12px;
          border: 2px solid var(--theme-border-color);
          border-radius: 4px;
          background: var(--theme-bg-primary);
          color: var(--theme-text-primary);
          font-size: 13px;
          cursor: pointer;
        ">
          ${optionsHTML}
        </select>
      </div>
    `;
  }).join('');

  const modalHTML = `
    <div id="total-row-config-modal" class="modal-overlay" style="background: rgba(0,0,0,0.7); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 10000;">
      <div class="modal" style="background: var(--theme-bg-primary); border-radius: 12px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); max-width: 600px; width: 90%; max-height: 85vh; overflow: auto;">
        <!-- Header -->
        <div style="padding: 24px; border-bottom: 2px solid var(--theme-border-color); background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 12px 12px 0 0; position: sticky; top: 0; z-index: 1;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h3 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 700;">∑ Configurar Linha de Totais</h3>
              <p style="margin: 0; opacity: 0.9; font-size: 14px;">${table.name}</p>
            </div>
            <button id="close-total-config" style="background: rgba(255,255,255,0.2); border: none; font-size: 28px; cursor: pointer; color: white; width: 40px; height: 40px; border-radius: 50%; transition: all 0.2s;">&times;</button>
          </div>
        </div>

        <!-- Content -->
        <div style="padding: 24px;">
          <div style="margin-bottom: 20px; padding: 16px; background: rgba(102, 126, 234, 0.1); border-radius: 8px; border-left: 4px solid #667eea;">
            <div style="font-size: 13px; color: var(--theme-text-primary); line-height: 1.5;">
              <strong>💡 Dica:</strong> Escolha uma função de agregação diferente para cada coluna. As fórmulas serão atualizadas automaticamente.
            </div>
          </div>

          <div style="margin-bottom: 16px;">
            <label style="display: flex; align-items: center; cursor: pointer; padding: 12px; background: var(--theme-bg-secondary); border-radius: 6px;">
              <input type="checkbox" id="show-total-row" ${table.showTotalRow ? 'checked' : ''} style="margin-right: 12px; width: 18px; height: 18px; cursor: pointer;">
              <span style="font-weight: 600; color: var(--theme-text-primary);">Exibir Linha de Totais</span>
            </label>
          </div>

          <div id="total-functions-container" style="display: ${table.showTotalRow ? 'block' : 'none'};">
            <h4 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: var(--theme-text-secondary); text-transform: uppercase;">Função por Coluna</h4>
            ${columnsHTML}
          </div>
        </div>

        <!-- Footer -->
        <div style="padding: 16px 24px; border-top: 1px solid var(--theme-border-color); background: var(--theme-bg-secondary); border-radius: 0 0 12px 12px; display: flex; gap: 12px; justify-content: flex-end; position: sticky; bottom: 0;">
          <button id="cancel-total-config" style="padding: 10px 20px; background: var(--theme-bg-primary); color: var(--theme-text-primary); border: 1px solid var(--theme-border-color); border-radius: 6px; cursor: pointer; font-weight: 600;">Cancelar</button>
          <button id="apply-total-config" style="padding: 10px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">Aplicar Configuração</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHTML);

  // Event listeners
  const showTotalCheckbox = document.getElementById('show-total-row') as HTMLInputElement;
  const totalFunctionsContainer = document.getElementById('total-functions-container');

  showTotalCheckbox?.addEventListener('change', () => {
    if (totalFunctionsContainer) {
      totalFunctionsContainer.style.display = showTotalCheckbox.checked ? 'block' : 'none';
    }
  });

  document.getElementById('close-total-config')?.addEventListener('click', () => {
    document.getElementById('total-row-config-modal')?.remove();
  });

  document.getElementById('cancel-total-config')?.addEventListener('click', () => {
    document.getElementById('total-row-config-modal')?.remove();
  });

  document.getElementById('apply-total-config')?.addEventListener('click', () => {
    this.applyTotalRowConfig(table, sheet);
    document.getElementById('total-row-config-modal')?.remove();
  });
}

/**
 * Apply total row configuration
 */
private applyTotalRowConfig(table: any, sheet: any): void {
  if (!this.tableManager || !this.context) return;

  try {
    const showTotalRow = (document.getElementById('show-total-row') as HTMLInputElement).checked;
    table.showTotalRow = showTotalRow;

    // Update column total functions
    const selects = document.querySelectorAll('.total-function-select');
    selects.forEach(select => {
      const columnIndex = parseInt((select as HTMLSelectElement).dataset.columnIndex || '0');
      const totalFunction = (select as HTMLSelectElement).value;
      const column = table.columns[columnIndex];
      if (column) {
        column.totalFunction = totalFunction;
      }
    });

    // Reapply formatting and totals
    this.tableManager.applyTableFormatting(table, sheet);
    
    if (showTotalRow) {
      this.tableManager.applyTotals(table, sheet);
    }

    const grid = this.context.kernel.getGrid();
    if (grid) grid.render();

    this.context.ui.showToast('Configuração de totais aplicada!', 'success');
    this.refreshTableStudioPanel();
  } catch (error) {
    logger.error('[TableStudio] Failed to apply total row config', error);
    this.context.ui.showToast(`Erro ao aplicar configuração: ${error}`, 'error');
  }
}

