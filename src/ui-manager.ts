import { kernel } from './@core/kernel';
import { VirtualGrid } from './@core/grid-virtual-consolidated';
import { logger } from './@core/storage-utils-consolidated';

export class UIManager {
  private app: HTMLElement;
  private grid?: VirtualGrid;

  constructor(app: HTMLElement) {
    this.app = app;
  }

  public setupGrid() {
    const canvas = document.getElementById('grid-canvas') as HTMLCanvasElement;
    if (canvas) {
      this.grid = new VirtualGrid(canvas, kernel);
      kernel.setGrid(this.grid);

      // Set initial sheet
      const activeSheet = kernel.workbookManager.getActiveSheet();
      if (activeSheet) {
        this.grid.setSheet(activeSheet);
      }

      // Handle cell changes
      this.grid.setCellChangeHandler((row, col, value) => {
        const sheet = this.grid?.getSheet();
        if (sheet) {
          if (String(value).startsWith('=')) {
            sheet.setCell(row, col, 0, { formula: String(value) });
            kernel.recalculate(sheet.id);
          } else {
            sheet.setCell(row, col, value);
          }
        }
      });

      // Handle selection changes
      this.grid.setSelectionChangeHandler((selection) => {
        const sheet = this.grid?.getSheet();
        if (sheet) {
          const cell = sheet.getCell(selection.start.row, selection.start.col);
          const cellName = sheet.getColumnName(selection.start.col) + (selection.start.row + 1);
          
          const nameBox = document.getElementById('name-box');
          if (nameBox) nameBox.textContent = cellName;

          const formulaInput = document.getElementById('formula-input') as HTMLInputElement;
          if (formulaInput) formulaInput.value = cell?.formula || cell?.value || '';
        }
      });
    }
  }

  public initUI() {
    const company = kernel.companyManager.getActiveCompany();
    const workbooks = kernel.workbookManager.listWorkbooks();

    this.applySavedTheme(); // Apply saved theme on load

    this.app.innerHTML = `
      <div class="app-container">
        <!-- Header -->
        <header class="app-header">
          <div class="header-left">
            <h1>🔧 DJ DataForge v6</h1>
            <span class="company-badge" id="company-badge">${company?.name || 'Sem empresa'}</span>
          </div>
          <div class="header-right">
            <button id="btn-toggle-dark-mode" class="btn" title="Alternar Modo Escuro">🌙</button>
            <button id="btn-clear-session" class="btn" title="Limpar Sessão">🗑️</button>
            <button id="btn-settings" class="btn" title="Configurações">⚙️</button>
          </div>
        </header>

        <!-- Excel-Style Ribbon Menu -->
        <div class="ribbon">
          <div class="ribbon-tabs">
            <button class="ribbon-tab active" data-tab="home">Início</button>
            <button class="ribbon-tab" data-tab="insert">Inserir</button>
            <button class="ribbon-tab" data-tab="formulas">Fórmulas</button>
            <button class="ribbon-tab" data-tab="data">Dados</button>
            <button class="ribbon-tab" data-tab="view">Exibir</button>
          </div>

          <!-- Home Tab Content -->
          <div class="ribbon-content" data-content="home">
            <div class="ribbon-group">
              <div class="ribbon-group-title">Arquivo</div>
              <div class="ribbon-buttons">
                <button id="btn-new-workbook" class="ribbon-btn">
                  <span class="ribbon-icon">📄</span>
                  <span class="ribbon-label">Novo</span>
                </button>
                <button id="btn-import" class="ribbon-btn">
                  <span class="ribbon-icon">📥</span>
                  <span class="ribbon-label">Importar</span>
                </button>
                <button id="btn-export" class="ribbon-btn">
                  <span class="ribbon-icon">📤</span>
                  <span class="ribbon-label">Exportar</span>
                </button>
              </div>
            </div>

            <div class="ribbon-group">
              <div class="ribbon-group-title">Formatação</div>
              <div class="ribbon-buttons">
                <button id="btn-bold" class="ribbon-btn">
                  <span class="ribbon-icon"><b>N</b></span>
                  <span class="ribbon-label">Negrito</span>
                </button>
                <button id="btn-italic" class="ribbon-btn">
                  <span class="ribbon-icon"><i>I</i></span>
                  <span class="ribbon-label">Itálico</span>
                </button>
                <button id="btn-color" class="ribbon-btn">
                  <span class="ribbon-icon">🎨</span>
                  <span class="ribbon-label">Cor</span>
                </button>
              </div>
            </div>

            <div class="ribbon-group">
              <div class="ribbon-group-title">Alinhamento</div>
              <div class="ribbon-buttons">
                <button id="btn-align-left" class="ribbon-btn">
                  <span class="ribbon-icon">⬅️</span>
                  <span class="ribbon-label">Esquerda</span>
                </button>
                <button id="btn-align-center" class="ribbon-btn">
                  <span class="ribbon-icon">↔️</span>
                  <span class="ribbon-label">Centro</span>
                </button>
                <button id="btn-align-right" class="ribbon-btn">
                  <span class="ribbon-icon">➡️</span>
                  <span class="ribbon-label">Direita</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Insert Tab Content -->
          <div class="ribbon-content hidden" data-content="insert">
            <div class="ribbon-group">
              <div class="ribbon-group-title">Ilustrações</div>
              <div class="ribbon-buttons" id="plugin-toolbar">
                <!-- Plugin buttons will be added here dynamically -->
              </div>
            </div>
          </div>

          <!-- Formulas Tab Content -->
          <div class="ribbon-content hidden" data-content="formulas">
            <div class="ribbon-group">
              <div class="ribbon-group-title">Biblioteca de Funções</div>
              <div class="ribbon-buttons">
                <button id="btn-autosum" class="ribbon-btn">
                  <span class="ribbon-icon">Σ</span>
                  <span class="ribbon-label">AutoSoma</span>
                </button>
                <button id="btn-math-functions" class="ribbon-btn">
                  <span class="ribbon-icon">📐</span>
                  <span class="ribbon-label">Matemática</span>
                </button>
                <button id="btn-stats-functions" class="ribbon-btn">
                  <span class="ribbon-icon">📊</span>
                  <span class="ribbon-label">Estatística</span>
                </button>
                <button id="btn-financial-functions" class="ribbon-btn">
                  <span class="ribbon-icon">💰</span>
                  <span class="ribbon-label">Financeira</span>
                </button>
              </div>
            </div>

            <div class="ribbon-group">
              <div class="ribbon-group-title">Plugins</div>
              <div class="ribbon-buttons" id="plugin-menu-items">
                <!-- Plugin menu items will be added here dynamically -->
              </div>
            </div>
          </div>

          <!-- Data Tab Content -->
          <div class="ribbon-content hidden" data-content="data">
            <div class="ribbon-group">
              <div class="ribbon-group-title">Ferramentas de Dados</div>
              <div class="ribbon-buttons">
                <button id="btn-filter-data" class="ribbon-btn">
                  <span class="ribbon-icon">🔍</span>
                  <span class="ribbon-label">Filtrar</span>
                </button>
                <button id="btn-sort-data" class="ribbon-btn">
                  <span class="ribbon-icon">↕️</span>
                  <span class="ribbon-label">Ordenar</span>
                </button>
                <button id="btn-data-validation" class="ribbon-btn">
                  <span class="ribbon-icon">🔗</span>
                  <span class="ribbon-label">Validação</span>
                </button>
              </div>
            </div>
          </div>

          <!-- View Tab Content -->
          <div class="ribbon-content hidden" data-content="view">
            <div class="ribbon-group">
              <div class="ribbon-group-title">Mostrar/Ocultar</div>
              <div class="ribbon-buttons">
                <button id="btn-toggle-sidebar" class="ribbon-btn">
                  <span class="ribbon-icon">📂</span>
                  <span class="ribbon-label">Barra Lateral</span>
                </button>
                <button id="btn-toggle-right-panel" class="ribbon-btn">
                  <span class="ribbon-icon">📊</span>
                  <span class="ribbon-label">Painel Info</span>
                </button>
                <button id="btn-toggle-formula-bar" class="ribbon-btn">
                  <span class="ribbon-icon">ƒx</span>
                  <span class="ribbon-label">Barra Fórmulas</span>
                </button>
                <button id="btn-toggle-gridlines" class="ribbon-btn">
                  <span class="ribbon-icon">🔲</span>
                  <span class="ribbon-label">Linhas Grade</span>
                </button>
              </div>
            </div>

            <div class="ribbon-group">
              <div class="ribbon-group-title">Zoom</div>
              <div class="ribbon-buttons">
                <button id="btn-zoom-in" class="ribbon-btn">
                  <span class="ribbon-icon">🔍+</span>
                  <span class="ribbon-label">Ampliar</span>
                </button>
                <button id="btn-zoom-out" class="ribbon-btn">
                  <span class="ribbon-icon">🔍−</span>
                  <span class="ribbon-label">Reduzir</span>
                </button>
                <button id="btn-zoom-reset" class="ribbon-btn">
                  <span class="ribbon-icon">100%</span>
                  <span class="ribbon-label">Redefinir</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Formula Bar -->
        <div class="formula-bar">
          <div class="name-box" id="name-box">A1</div>
          <input 
            type="text" 
            class="formula-input" 
            id="formula-input"
            placeholder="Digite um valor ou fórmula (ex: =SOMA(A1:A10))"
          />
        </div>
        
        <!-- Main Content -->
        <div class="app-content">
          <!-- Sidebar -->
          <aside class="sidebar">
            <h3>Workbooks</h3>
            <div id="workbook-list" class="workbook-list">
              ${this.renderWorkbookList(workbooks)}
            </div>
            
            <h3 style="margin-top: 24px;">Sheets</h3>
            <div id="sheet-list" class="sheet-list">
              ${this.renderSheetList()}
            </div>
          </aside>
          
          <!-- Grid Area -->
          <main class="grid-container">
            <div class="grid-wrapper">
              <canvas id="grid-canvas" class="grid-canvas" tabindex="0"></canvas>
              <div class="grid-scrollbar-vertical" id="grid-scrollbar-vertical">
                <div class="grid-scrollbar-content" id="grid-scrollbar-v-content"></div>
              </div>
              <div class="grid-scrollbar-horizontal" id="grid-scrollbar-horizontal">
                <div class="grid-scrollbar-content" id="grid-scrollbar-h-content"></div>
              </div>
              <div class="grid-scrollbar-corner"></div>
            </div>
          </main>
          
          <!-- Panels (right side) -->
          <aside class="panels">
            <div id="plugin-panels"></div>
            
            <div class="panel">
              <h4>📝 Console</h4>
              <div id="console-logs" class="console-logs"></div>
            </div>
            
            <div class="panel">
              <h4>ℹ️ Info</h4>
              <div id="cell-info" class="cell-info">
                <div><strong>Célula:</strong> <span id="info-cell">-</span></div>
                <div><strong>Valor:</strong> <span id="info-value">-</span></div>
                <div><strong>Fórmula:</strong> <span id="info-formula">-</span></div>
                <div><strong>Tipo:</strong> <span id="info-type">-</span></div>
              </div>
            </div>
          </aside>
        </div>
        
        <!-- Status Bar -->
        <footer class="status-bar">
          <span class="status-info">✅ Pronto | v${kernel.version} | FULL VERSION</span>
          <span class="status-company">Empresa: ${company?.name || 'N/A'}</span>
          <span class="status-workbook">Workbooks: ${workbooks.length}</span>
          <span class="status-plugins">Plugins: ${kernel['pluginHost'].getLoadedPlugins().length}</span>
        </footer>
      </div>
      
      <!-- Hidden file input -->
      <input type="file" id="file-input" accept=".csv,.xlsx,.xls,.json" style="display: none;" />
    `;

    this.setupGrid();
    this.listenForUIChanges();
    this.setupEventListeners();
  }

  public listenForUIChanges() {
    kernel.eventBus.on('ui:add-toolbar-button', ({ config }: { config: any }) => {
      this.addToolbarButton(config);
    });

    kernel.eventBus.on('ui:add-panel', ({ config }: { config: any }) => {
      this.addPanel(config);
    });

    kernel.eventBus.on('ui:add-menu-item', ({ config }: { config: any }) => {
      this.addMenuItem(config);
    });
  }

  public addToolbarButton(config: any) {
    const toolbar = document.getElementById('plugin-toolbar');
    if (toolbar) {
      // Prevent duplication
      if (document.getElementById(`plugin-btn-${config.id}`)) {
        return;
      }
      const btn = document.createElement('button');
      btn.id = `plugin-btn-${config.id}`;
      btn.className = 'ribbon-btn';
      btn.title = config.tooltip || '';
      btn.innerHTML = '<span class="ribbon-icon">' + (config.icon || '') + '</span><span class="ribbon-label">' + config.label + '</span>';
      btn.onclick = config.onClick;
      toolbar.appendChild(btn);
    }
  }

  public addPanel(config: any) {
    const container = document.getElementById('plugin-panels');
    if (container) {
      // Prevent duplication
      if (document.getElementById(`plugin-panel-${config.id}`)) {
        return;
      }
      const panel = document.createElement('div');
      panel.id = `plugin-panel-${config.id}`;
      panel.className = 'panel plugin-panel';
      
      const header = document.createElement('h4');
      header.textContent = config.title;
      panel.appendChild(header);
      
      const content = document.createElement('div');
      content.className = 'panel-content';
      panel.appendChild(content);
      
      config.render(content);
      
      container.appendChild(panel);
    }
  }

  public addMenuItem(config: any) {
    const menuContainer = document.getElementById('plugin-menu-items');
    if (menuContainer) {
      // Prevent duplication
      if (document.getElementById(`plugin-menu-item-${config.id}`)) {
        return;
      }
      const btn = document.createElement('button');
      btn.id = `plugin-menu-item-${config.id}`;
      btn.className = 'ribbon-btn';
      btn.title = config.tooltip || '';
      btn.innerHTML = '<span class="ribbon-icon">' + (config.icon || '') + '</span><span class="ribbon-label">' + config.label + '</span>';
      btn.onclick = config.onClick;
      menuContainer.appendChild(btn);
    }
  }

  public renderWorkbookList(workbooks: any[]): string {
    if (workbooks.length === 0) {
      return '<p class="empty-state">Nenhum workbook<br>Clique em "Novo" para criar</p>';
    }
    
    return workbooks.map(wb => `<div class="workbook-item ${wb.id === kernel.workbookManager.getActiveWorkbook()?.id ? 'active' : ''}" data-workbook-id="${wb.id}"><span class="workbook-name">${wb.name}</span><span class="workbook-sheets">${wb.sheets.size} sheets</span></div>`).join('');
  }

  public renderSheetList(): string {
    const wb = kernel.workbookManager.getActiveWorkbook();
    if (!wb) return '<p class="empty-state">Selecione um workbook</p>';
    
    const sheets = wb.listSheets();
    return sheets.map(sheet => `<div class="sheet-item ${sheet.id === wb.activeSheetId ? 'active' : ''}" data-sheet-id="${sheet.id}"><span class="sheet-name">${sheet.name}</span><span class="sheet-size">${sheet.rowCount}x${sheet.colCount}</span></div>`).join('');
  }

  public showLoading(): void {
    this.app.innerHTML = '<div class="loading-screen"><div class="loading-spinner"></div><h2>🔧 DJ DataForge v6</h2><p>Carregando todas as funcionalidades...</p><div style="margin-top: 20px; font-size: 12px; color: #64748b;"><div>✅ Kernel & Storage</div><div>✅ Calc Engine (20+ fórmulas)</div><div>✅ Virtual Grid</div><div>✅ Plugin System</div><div>✅ Multi-Company</div></div></div>';
  }

  public hideLoading(): void {
    const loading = this.app.querySelector('.loading-screen');
    if (loading) {
      loading.classList.add('fade-out');
      setTimeout(() => loading.remove(), 300);
    }
  }

  private applySavedTheme(): void {
    const isDarkMode = localStorage.getItem('theme') === 'dark';
    if (isDarkMode) {
      this.app.classList.add('dark');
    } else {
      this.app.classList.remove('dark');
    }
  }

  public showError(message: string): void {
    this.app.innerHTML = '<div class="error-screen"><h2>❌ Erro</h2><p>' + message + '</p><button onclick="location.reload()">Recarregar</button></div>';
  }

  public setupEventListeners(): void {
    // Ribbon tabs
    const ribbonTabs = document.querySelectorAll('.ribbon-tab');
    ribbonTabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        const targetTab = (e.target as HTMLElement).dataset.tab;
        if (!targetTab) return;

        // Update active tab
        ribbonTabs.forEach(t => t.classList.remove('active'));
        (e.target as HTMLElement).classList.add('active');

        // Show corresponding content
        const contents = document.querySelectorAll('.ribbon-content');
        contents.forEach(c => {
          const content = c as HTMLElement;
          if (content.dataset.content === targetTab) {
            content.classList.remove('hidden');
          } else {
            content.classList.add('hidden');
          }
        });
      });
    });

    // File operations
    document.getElementById('btn-new-workbook')?.addEventListener('click', () => {
      const name = prompt('Nome do novo workbook:');
      if (name) {
        kernel.workbookManager.createWorkbook(name);
        this.refreshWorkbookList();
        kernel.eventBus.emit('workbook:created', { name });
      }
    });

    document.getElementById('btn-import')?.addEventListener('click', () => {
      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      fileInput?.click();
    });

    document.getElementById('btn-export')?.addEventListener('click', async () => {
      const wb = kernel.workbookManager.getActiveWorkbook();
      if (!wb) {
        alert('Nenhum workbook ativo');
        return;
      }

      const format = prompt('Formato de exportação (csv, xlsx, json):', 'csv');
      if (!format || !['csv', 'xlsx', 'json'].includes(format.toLowerCase())) {
        return;
      }

      try {
        const { FileWriter } = await import('./@core/io-transform-consolidated');
        const sheet = wb.getActiveSheet();

        if (!sheet) {
          alert('Nenhuma sheet ativa');
          return;
        }

        let blob: Blob;
        let fileName: string;

        switch (format.toLowerCase()) {
          case 'csv':
            blob = FileWriter.exportCSV(sheet);
            fileName = `${wb.name}_${sheet.name}.csv`;
            break;
          case 'xlsx':
            blob = FileWriter.exportXLSX(wb);
            fileName = `${wb.name}.xlsx`;
            break;
          case 'json':
            blob = FileWriter.exportJSON(sheet);
            fileName = `${wb.name}_${sheet.name}.json`;
            break;
          default:
            return;
        }

        // Download file
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);

        logger.info('[UIManager] File exported', { fileName, format });
      } catch (error) {
        logger.error('[UIManager] Export failed', error);
        alert(`Erro ao exportar: ${error}`);
      }
    });

    // View toggle buttons
    document.getElementById('btn-toggle-sidebar')?.addEventListener('click', () => {
      const sidebar = document.querySelector('.sidebar');
      sidebar?.classList.toggle('collapsed');
    });

    document.getElementById('btn-toggle-right-panel')?.addEventListener('click', () => {
      const panels = document.querySelector('.panels');
      panels?.classList.toggle('collapsed');
    });

    document.getElementById('btn-toggle-formula-bar')?.addEventListener('click', () => {
      const formulaBar = document.querySelector('.formula-bar');
      formulaBar?.classList.toggle('hidden');
    });

    // Workbook list clicks
    document.getElementById('workbook-list')?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const workbookItem = target.closest('.workbook-item') as HTMLElement;
      if (workbookItem) {
        const workbookId = workbookItem.dataset.workbookId;
        if (workbookId) {
          kernel.workbookManager.setActiveWorkbook(workbookId);
          this.refreshWorkbookList();
          this.refreshSheetList();
          this.refreshGrid();
        }
      }
    });

    // Sheet list clicks
    document.getElementById('sheet-list')?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const sheetItem = target.closest('.sheet-item') as HTMLElement;
      if (sheetItem) {
        const sheetId = sheetItem.dataset.sheetId;
        const wb = kernel.workbookManager.getActiveWorkbook();
        if (sheetId && wb) {
          wb.setActiveSheet(sheetId);
          this.refreshSheetList();
          this.refreshGrid();
        }
      }
    });

    // Formula input
    const formulaInput = document.getElementById('formula-input') as HTMLInputElement;
    formulaInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const value = formulaInput.value;
        const selection = this.grid?.getSelection();
        if (selection && this.grid) {
          const sheet = this.grid.getSheet();
          if (sheet) {
            if (String(value).startsWith('=')) {
              sheet.setCell(selection.start.row, selection.start.col, 0, { formula: String(value) });
              kernel.recalculate(sheet.id);
            } else {
              sheet.setCell(selection.start.row, selection.start.col, value);
            }
            this.grid.render();
          }
        }
      }
    });

    // Header buttons
    document.getElementById('btn-toggle-dark-mode')?.addEventListener('click', () => {
      this.app.classList.toggle('dark'); // Alterado para this.app
      const isDarkMode = this.app.classList.contains('dark');
      if (isDarkMode) {
        localStorage.setItem('theme', 'dark');
      }
      else {
        localStorage.setItem('theme', 'light');
      }
      this.grid?.render(); // Adicionado: Re-renderiza a grid após a mudança de tema
    });

    document.getElementById('btn-clear-session')?.addEventListener('click', () => {
      if (confirm('Deseja limpar toda a sessão? Isso removerá todos os dados.')) {
        kernel.clearAllData();
        location.reload();
      }
    });

    document.getElementById('btn-settings')?.addEventListener('click', () => {
      this.showSettingsModal();
    });

    // Formatting buttons
    document.getElementById('btn-bold')?.addEventListener('click', () => {
      this.applyFormatting({ bold: true });
    });

    document.getElementById('btn-italic')?.addEventListener('click', () => {
      this.applyFormatting({ italic: true });
    });

    document.getElementById('btn-color')?.addEventListener('click', () => {
      const color = prompt('Digite a cor (ex: #ff0000, red, rgb(255,0,0)):');
      if (color) {
        this.applyFormatting({ textColor: color });
      }
    });

    document.getElementById('btn-align-left')?.addEventListener('click', () => {
      this.applyFormatting({ alignment: 'left' });
    });

    document.getElementById('btn-align-center')?.addEventListener('click', () => {
      this.applyFormatting({ alignment: 'center' });
    });

    document.getElementById('btn-align-right')?.addEventListener('click', () => {
      this.applyFormatting({ alignment: 'right' });
    });

    // File input change listener
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    fileInput?.addEventListener('change', async (e) => {
      await this.handleFileImport(e);
    });

    // Autosum button
    document.getElementById('btn-autosum')?.addEventListener('click', () => {
      this.insertAutoSum();
    });

    // Function helper buttons
    document.getElementById('btn-math-functions')?.addEventListener('click', () => {
      this.showFunctionHelper('math');
    });

    document.getElementById('btn-stats-functions')?.addEventListener('click', () => {
      this.showFunctionHelper('stats');
    });

    document.getElementById('btn-financial-functions')?.addEventListener('click', () => {
      this.showFunctionHelper('financial');
    });

    // Zoom buttons
    document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
      this.adjustZoom(1.1);
    });

    document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
      this.adjustZoom(0.9);
    });

    document.getElementById('btn-zoom-reset')?.addEventListener('click', () => {
      this.resetZoom();
    });

    // Toggle gridlines
    document.getElementById('btn-toggle-gridlines')?.addEventListener('click', () => {
      this.toggleGridlines();
    });

    // Data tools buttons
    document.getElementById('btn-filter-data')?.addEventListener('click', () => {
      alert('Filtrar dados: funcionalidade em desenvolvimento\n\nEm breve você poderá filtrar dados por coluna.');
    });

    document.getElementById('btn-sort-data')?.addEventListener('click', () => {
      alert('Ordenar dados: funcionalidade em desenvolvimento\n\nEm breve você poderá ordenar dados por coluna.');
    });

    document.getElementById('btn-data-validation')?.addEventListener('click', () => {
      alert('Validação de dados: funcionalidade em desenvolvimento\n\nEm breve você poderá definir regras de validação para células.');
    });

    logger.info('[UIManager] Event listeners configured');
  }

  private applyFormatting(format: Partial<import('./@core/types').CellFormat>): void {
    const selection = this.grid?.getSelection();
    const sheet = this.grid?.getSheet();

    if (!selection || !sheet) {
      alert('Selecione uma célula primeiro');
      return;
    }

    // Apply formatting to all cells in selection
    for (let row = selection.start.row; row <= selection.end.row; row++) {
      for (let col = selection.start.col; col <= selection.end.col; col++) {
        const cell = sheet.getCell(row, col) || { value: '', type: 'auto' as const };
        const currentFormat = cell.format || {};

        // Merge formats
        const newFormat = { ...currentFormat, ...format };

        sheet.setCell(row, col, cell.value, { ...cell, format: newFormat });
      }
    }

    this.grid?.render();
    logger.info('[UIManager] Formatting applied', format);
  }

  private async handleFileImport(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    try {
      const { FileReader: DataForgeFileReader } = await import('./@core/io-transform-consolidated');

      const data = await DataForgeFileReader.readAuto(file);

      // Create new workbook with imported data
      const wb = kernel.workbookManager.createWorkbook(file.name.replace(/\.[^/.]+$/, ''));
      const sheet = wb.getActiveSheet();

      if (sheet && data && data.length > 0) {
        // Populate sheet with data
        data.forEach((row: any[], rowIdx: number) => {
          row.forEach((value: any, colIdx: number) => {
            sheet.setCell(rowIdx, colIdx, value);
          });
        });

        kernel.workbookManager.setActiveWorkbook(wb.id);
        this.refreshWorkbookList();
        this.refreshSheetList();
        this.refreshGrid();

        logger.info('[UIManager] File imported successfully', { fileName: file.name, rows: data.length });
      }
    } catch (error) {
      logger.error('[UIManager] Import failed', error);
      alert(`Erro ao importar arquivo: ${error}`);
    }

    // Reset input
    input.value = '';
  }

  private insertAutoSum(): void {
    const selection = this.grid?.getSelection();
    const sheet = this.grid?.getSheet();

    if (!selection || !sheet) {
      alert('Selecione uma célula primeiro');
      return;
    }

    const row = selection.start.row;
    const col = selection.start.col;

    // Try to detect range above
    let rangeStart = row - 1;
    let rangeEnd = row - 1;

    while (rangeStart >= 0) {
      const cell = sheet.getCell(rangeStart, col);
      if (!cell || (cell.type !== 'number' && !cell.formula)) break;
      rangeEnd = rangeStart;
      rangeStart--;
    }

    if (rangeEnd < row - 1) {
      // Found numbers above
      const colName = sheet.getColumnName(col);
      const formula = `=SOMA(${colName}${rangeEnd + 1}:${colName}${row})`;
      sheet.setCell(row, col, 0, { formula });
      kernel.recalculate(sheet.id);
      this.grid?.render();
      logger.info('[UIManager] AutoSum inserted', { formula });
      return;
    }

    // Try to detect range to the left
    rangeStart = col - 1;
    rangeEnd = col - 1;

    while (rangeStart >= 0) {
      const cell = sheet.getCell(row, rangeStart);
      if (!cell || (cell.type !== 'number' && !cell.formula)) break;
      rangeEnd = rangeStart;
      rangeStart--;
    }

    if (rangeEnd < col - 1) {
      // Found numbers to the left
      const startColName = sheet.getColumnName(rangeEnd);
      const endColName = sheet.getColumnName(col - 1);
      const formula = `=SOMA(${startColName}${row + 1}:${endColName}${row + 1})`;
      sheet.setCell(row, col, 0, { formula });
      kernel.recalculate(sheet.id);
      this.grid?.render();
      logger.info('[UIManager] AutoSum inserted', { formula });
      return;
    }

    alert('Não foi possível detectar um range de números para somar');
  }

  private showFunctionHelper(category: string): void {
    const functions: Record<string, string[]> = {
      math: ['SOMA', 'MÉDIA', 'MÁXIMO', 'MÍNIMO', 'ARREDONDAR', 'ABS', 'RAIZ', 'POTÊNCIA'],
      stats: ['CONT.NÚM', 'CONT.VALORES', 'MÉDIA', 'MÁXIMO', 'MÍNIMO'],
      financial: ['PROCV', 'SE', 'E', 'OU']
    };

    const funcList = functions[category] || [];
    const funcNames = funcList.join(', ');

    alert(`Funções disponíveis (${category}):\n\n${funcNames}\n\nDigite na célula: =NOME_FUNÇÃO(argumentos)`);
  }

  private zoomLevel = 1.0;

  private adjustZoom(factor: number): void {
    this.zoomLevel *= factor;
    this.zoomLevel = Math.max(0.5, Math.min(2.0, this.zoomLevel));

    const gridWrapper = document.querySelector('.grid-wrapper') as HTMLElement;
    if (gridWrapper) {
      gridWrapper.style.transform = `scale(${this.zoomLevel})`;
      gridWrapper.style.transformOrigin = 'top left';
    }

    logger.info('[UIManager] Zoom adjusted', { level: this.zoomLevel });
  }

  private resetZoom(): void {
    this.zoomLevel = 1.0;
    const gridWrapper = document.querySelector('.grid-wrapper') as HTMLElement;
    if (gridWrapper) {
      gridWrapper.style.transform = 'scale(1)';
    }
    logger.info('[UIManager] Zoom reset');
  }

  private gridlinesVisible = true;

  private toggleGridlines(): void {
    this.gridlinesVisible = !this.gridlinesVisible;
    // This would need to be implemented in VirtualGrid
    // For now, just log
    logger.info('[UIManager] Gridlines toggled', { visible: this.gridlinesVisible });
    alert('Toggle gridlines: funcionalidade em desenvolvimento');
  }

  private showSettingsModal(): void {
    const modalId = 'settings-modal';
    // Remover modal existente para evitar duplicatas
    document.getElementById(modalId)?.remove();

    const currentTheme = localStorage.getItem('theme') || 'light';

    const modalHTML = `
      <div id="${modalId}" class="modal-overlay" style="background: var(--theme-overlay-background, rgba(0,0,0,0.5));">
        <div class="modal" id="settings-wizard-modal" style="background: var(--theme-bg-primary); box-shadow: var(--shadow-lg);">
          <div class="modal-header" id="settings-modal-header" style="border-bottom: 1px solid var(--theme-border-color);">
            <h2 style="color: var(--theme-text-primary);">⚙️ Configurações</h2>
            <button class="close-button" id="settings-modal-close">&times;</button>
          </div>
          <div class="modal-content">
            <div class="form-group">
              <label for="theme-select">Tema:</label>
              <select id="theme-select" class="form-control" style="background: var(--theme-bg-primary); color: var(--theme-text-primary);">
                <option value="light" ${currentTheme === 'light' ? 'selected' : ''}>Claro</option>
                <option value="dark" ${currentTheme === 'dark' ? 'selected' : ''}>Escuro</option>
              </select>
            </div>
            <div class="form-group">
              <label for="language-select">Idioma:</label>
              <select id="language-select" class="form-control" style="background: var(--theme-bg-primary); color: var(--theme-text-primary);">
                <option value="pt-BR" selected>Português (Brasil)</option>
                <option value="en-US">English (US)</option>
              </select>
            </div>
            <!-- Adicionar mais opções de configuração aqui -->
          </div>
          <div class="modal-actions">
            <button class="btn" id="settings-modal-cancel">Cancelar</button>
            <button class="btn btn-primary" id="settings-modal-save">Salvar</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const settingsModal = document.getElementById(modalId);
    const settingsWizardModal = document.getElementById('settings-wizard-modal');
    const settingsModalHeader = document.getElementById('settings-modal-header');

    if (settingsModal && settingsWizardModal && settingsModalHeader) {
      // Fechar modal
      document.getElementById('settings-modal-close')?.addEventListener('click', () => settingsModal.remove());
      document.getElementById('settings-modal-cancel')?.addEventListener('click', () => settingsModal.remove());

      // Salvar configurações
      document.getElementById('settings-modal-save')?.addEventListener('click', () => {
        const themeSelect = document.getElementById('theme-select') as HTMLSelectElement;
        const selectedTheme = themeSelect.value;

        // Aplicar e salvar tema
        if (selectedTheme === 'dark') {
          this.app.classList.add('dark');
          localStorage.setItem('theme', 'dark');
        } else {
          this.app.classList.remove('dark');
          localStorage.setItem('theme', 'light');
        }
        this.grid?.render(); // Re-renderiza a grid após a mudança de tema

        // Salvar outras configurações (ex: idioma)
        const languageSelect = document.getElementById('language-select') as HTMLSelectElement;
        // TODO: Implementar sistema de configurações globais
        // kernel.settings.set('language', languageSelect.value);
        localStorage.setItem('language', languageSelect.value);

        settingsModal.remove();
        logger.info('[UIManager] Configurações salvas.');
      });

      // Tornar modal arrastável
      this.makeModalDraggable(settingsWizardModal, settingsModalHeader);
    }
  }

  private makeModalDraggable(modalElement: HTMLElement, dragHandle: HTMLElement): void {
    let isDragging = false;
    let currentX: number;
    let currentY: number;
    let initialX: number;
    let initialY: number;
    let xOffset = 0;
    let yOffset = 0;

    dragHandle.addEventListener('mousedown', dragStart);
    document.addEventListener('mouseup', dragEnd);
    document.addEventListener('mousemove', drag);

    function dragStart(e: MouseEvent) {
      initialX = e.clientX - xOffset;
      initialY = e.clientY - yOffset;

      if (e.target === dragHandle) {
        isDragging = true;
      }
    }

    function dragEnd(_e: MouseEvent) {
      initialX = currentX;
      initialY = currentY;
      isDragging = false;
    }

    function drag(e: MouseEvent) {
      if (isDragging) {
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;

        xOffset = currentX;
        yOffset = currentY;

        setTranslate(currentX, currentY, modalElement);
      }
    }

    function setTranslate(xPos: number, yPos: number, el: HTMLElement) {
      el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
    }
  }

  public refreshWorkbookList(): void {
    const workbooks = kernel.workbookManager.listWorkbooks();
    const container = document.getElementById('workbook-list');
    if (container) {
      container.innerHTML = this.renderWorkbookList(workbooks);
    }
  }

  public refreshSheetList(): void {
    const container = document.getElementById('sheet-list');
    if (container) {
      container.innerHTML = this.renderSheetList();
    }
  }

  public refreshGrid(): void {
    const sheet = kernel.workbookManager.getActiveSheet();
    if (sheet && this.grid) {
      this.grid.setSheet(sheet);
      this.grid.render();
    }
  }
}