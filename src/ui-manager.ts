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
              <div class="ribbon-group-title">Funções Rápidas</div>
              <div class="ribbon-buttons">
                <button id="btn-autosum" class="ribbon-btn">
                  <span class="ribbon-icon">Σ</span>
                  <span class="ribbon-label">AutoSoma</span>
                </button>
                <button id="btn-all-functions" class="ribbon-btn ribbon-btn-primary">
                  <span class="ribbon-icon">🧮</span>
                  <span class="ribbon-label">Todas</span>
                </button>
              </div>
            </div>

            <div class="ribbon-group">
              <div class="ribbon-group-title">Biblioteca de Funções</div>
              <div class="ribbon-buttons">
                <button id="btn-math-functions" class="ribbon-btn">
                  <span class="ribbon-icon">📐</span>
                  <span class="ribbon-label">Matemática</span>
                </button>
                <button id="btn-stats-functions" class="ribbon-btn">
                  <span class="ribbon-icon">📊</span>
                  <span class="ribbon-label">Estatística</span>
                </button>
                <button id="btn-text-functions" class="ribbon-btn">
                  <span class="ribbon-icon">📝</span>
                  <span class="ribbon-label">Texto</span>
                </button>
                <button id="btn-logic-functions" class="ribbon-btn">
                  <span class="ribbon-icon">🔀</span>
                  <span class="ribbon-label">Lógica</span>
                </button>
                <button id="btn-lookup-functions" class="ribbon-btn">
                  <span class="ribbon-icon">🔍</span>
                  <span class="ribbon-label">Pesquisa</span>
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
          <button id="btn-open-formula-builder" class="btn-formula-builder" title="Construtor de Fórmulas">
            <span style="font-weight: bold; font-style: italic;">fx</span>
          </button>
          <input
            type="text"
            class="formula-input"
            id="formula-input"
          />
          <div id="formula-autocomplete-suggestions" class="autocomplete-suggestions"></div>
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
    const suggestionsContainer = document.getElementById('formula-autocomplete-suggestions');

    formulaInput?.addEventListener('input', () => {
      const value = formulaInput.value.trim();
      if (value.startsWith('=')) {
        this.showAutocompleteSuggestions(value.substring(1));
      } else {
        this.hideAutocompleteSuggestions();
      }
    });

    formulaInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const activeSuggestion = suggestionsContainer?.querySelector('.autocomplete-item.active') as HTMLElement;
        if (activeSuggestion) {
          e.preventDefault(); // Prevent form submission
          const functionName = activeSuggestion.dataset.function;
          if (functionName) {
            this.selectAutocompleteSuggestion(functionName);
          }
        } else {
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
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (suggestionsContainer && suggestionsContainer.style.display === 'block') {
          e.preventDefault();
          const items = Array.from(suggestionsContainer.querySelectorAll('.autocomplete-item')) as HTMLElement[];
          if (items.length === 0) return;

          let currentIndex = items.findIndex(item => item.classList.contains('active'));
          items[currentIndex]?.classList.remove('active');

          if (e.key === 'ArrowDown') {
            currentIndex = (currentIndex + 1) % items.length;
          } else { // ArrowUp
            currentIndex = (currentIndex - 1 + items.length) % items.length;
          }
          items[currentIndex].classList.add('active');
          items[currentIndex].scrollIntoView({ block: 'nearest' });
        }
      } else if (e.key === 'Escape') {
        this.hideAutocompleteSuggestions();
      }
    });

    formulaInput?.addEventListener('blur', () => {
      // Delay hiding to allow click event on suggestion to fire
      setTimeout(() => {
        this.hideAutocompleteSuggestions();
      }, 100);
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

    // Formula builder button in formula bar
    document.getElementById('btn-open-formula-builder')?.addEventListener('click', () => {
      this.showFormulaBuilder();
    });

    // Function helper buttons
    document.getElementById('btn-all-functions')?.addEventListener('click', () => {
      this.showFunctionHelper('all');
    });

    document.getElementById('btn-math-functions')?.addEventListener('click', () => {
      this.showFunctionHelper('math');
    });

    document.getElementById('btn-stats-functions')?.addEventListener('click', () => {
      this.showFunctionHelper('stats');
    });

    document.getElementById('btn-text-functions')?.addEventListener('click', () => {
      this.showFunctionHelper('text');
    });

    document.getElementById('btn-logic-functions')?.addEventListener('click', () => {
      this.showFunctionHelper('logic');
    });

    document.getElementById('btn-lookup-functions')?.addEventListener('click', () => {
      this.showFunctionHelper('lookup');
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

    // Use detectDataRange to find a suitable range
    const detectedRange = this.detectDataRange(sheet, row, col);

    if (detectedRange) {
      const formula = `=SOMA(${detectedRange})`;
      sheet.setCell(row, col, '', { formula, type: 'formula' });
      kernel.recalculate(sheet.id);
      this.grid?.render();
      logger.info('[UIManager] AutoSum inserted', { formula, detectedRange });
      return;
    }

    alert('Não foi possível detectar um range de números para somar');
  }

  private showFunctionHelper(category: string): void {
    this.showFormulaBuilder(category);
  }

  private showFormulaBuilder(initialCategory: string = 'all'): void {
    const modalId = 'formula-builder-modal';
    document.getElementById(modalId)?.remove();

    // Store the target cell where formula will be inserted
    const selection = this.grid?.getSelection();
    if (selection) {
      this.formulaTargetCell = {
        row: selection.start.row,
        col: selection.start.col
      };
    }

    const allFunctions = this.getAllFunctions();
    const categories = this.getFunctionCategories();

    const modalHTML = `
      <div id="${modalId}" class="modal-overlay" style="background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);">
        <div class="modal formula-builder-modal" style="max-width: 900px; max-height: 90vh; display: flex; flex-direction: column;">
          <div class="modal-header" style="border-bottom: 1px solid var(--theme-border-color); padding: var(--spacing-lg); cursor: move; flex-shrink: 0;">
            <h2 style="color: var(--theme-text-primary); margin: 0;">🧮 Construtor de Fórmulas</h2>
            <button class="btn" id="formula-builder-close" style="min-width: auto; padding: var(--spacing-xs) var(--spacing-sm);">&times;</button>
          </div>

          <div style="display: flex; flex: 1; overflow: hidden;">
            <!-- Function List Sidebar -->
            <div class="formula-sidebar" style="width: 280px; border-right: 1px solid var(--theme-border-color); display: flex; flex-direction: column; background: var(--theme-bg-secondary);">
              <!-- Search -->
              <div style="padding: var(--spacing-md); border-bottom: 1px solid var(--theme-border-color); flex-shrink: 0;">
                <input type="text" id="formula-search" class="form-control" placeholder="🔍 Buscar função..." style="margin-bottom: var(--spacing-sm);">
                <select id="formula-category-filter" class="form-control" style="font-size: 12px;">
                  <option value="all">📚 Todas as Categorias</option>
                  ${Object.entries(categories).map(([key, cat]) =>
                    `<option value="${key}" ${key === initialCategory ? 'selected' : ''}>${cat.icon} ${cat.name}</option>`
                  ).join('')}
                </select>
              </div>

              <!-- Function List -->
              <div id="formula-function-list" style="flex: 1; overflow-y: auto; padding: var(--spacing-sm);"></div>
            </div>

            <!-- Function Details & Builder -->
            <div class="formula-builder-content" style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
              <div id="formula-builder-main" style="flex: 1; overflow-y: auto; padding: var(--spacing-lg);">
                <div class="formula-welcome" style="text-align: center; padding: var(--spacing-3xl); color: var(--theme-text-tertiary);">
                  <div style="font-size: 48px; margin-bottom: var(--spacing-lg);">🧮</div>
                  <h3 style="font-size: 18px; margin-bottom: var(--spacing-md); color: var(--theme-text-secondary);">Selecione uma função</h3>
                  <p style="font-size: 14px;">Escolha uma função na lista ao lado para começar a construir sua fórmula</p>
                </div>
              </div>

              <!-- Formula Preview & Actions -->
              <div class="formula-preview-bar" style="border-top: 1px solid var(--theme-border-color); padding: var(--spacing-lg); background: var(--theme-bg-tertiary); flex-shrink: 0;">
                <div style="margin-bottom: var(--spacing-sm);">
                  <label style="font-size: 12px; color: var(--theme-text-secondary); font-weight: 600; display: block; margin-bottom: 4px;">📝 PREVIEW DA FÓRMULA:</label>
                  <div id="formula-preview" style="font-family: var(--font-mono); font-size: 14px; padding: var(--spacing-sm); background: var(--theme-bg-primary); border: 1px solid var(--theme-border-color); border-radius: var(--border-radius); color: var(--theme-color-primary); font-weight: 500; min-height: 36px; display: flex; align-items: center;">=</div>
                </div>
                <div style="display: flex; gap: var(--spacing-sm);">
                  <button class="btn" id="formula-cancel" style="flex: 1;">Cancelar</button>
                  <button class="btn btn-primary" id="formula-insert" style="flex: 2;">✓ Inserir Fórmula na Célula</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const modal = document.getElementById(modalId);
    if (!modal) return;

    // Setup event listeners
    this.setupFormulaBuilderEvents(modal, allFunctions);

    // Initial render
    this.renderFunctionList(allFunctions, initialCategory);
  }

  private getAllFunctions(): any[] {
    const registry = kernel.calcEngine.getRegistry();
    const functions = registry.list();

    return functions.map(fn => {
      const info = this.getFunctionInfo(fn.name);
      return {
        name: fn.name,
        description: fn.description || 'Sem descrição',
        category: info.category,
        args: info.args,
        example: info.example,
        returns: info.returns
      };
    });
  }

  private getFunctionCategories(): Record<string, { name: string; icon: string }> {
    return {
      math: { name: 'Matemática', icon: '📐' },
      stats: { name: 'Estatística', icon: '📊' },
      text: { name: 'Texto', icon: '📝' },
      logic: { name: 'Lógica', icon: '🔀' },
      lookup: { name: 'Pesquisa', icon: '🔍' },
      info: { name: 'Informação', icon: 'ℹ️' }
    };
  }

  private getFunctionInfo(name: string): any {
    const functionData: Record<string, any> = {
      // MATH
      'SOMA': {
        category: 'math',
        args: [{ name: 'número1', type: 'number|range', optional: false }, { name: 'número2', type: 'number|range', optional: true, repeating: true }],
        example: 'SOMA(A1:A10)',
        returns: 'A soma de todos os números'
      },
      'MÉDIA': {
        category: 'stats',
        args: [{ name: 'número1', type: 'number|range', optional: false }, { name: 'número2', type: 'number|range', optional: true, repeating: true }],
        example: 'MÉDIA(B1:B10)',
        returns: 'A média aritmética dos números'
      },
      'MÁXIMO': {
        category: 'stats',
        args: [{ name: 'número1', type: 'number|range', optional: false }, { name: 'número2', type: 'number|range', optional: true, repeating: true }],
        example: 'MÁXIMO(C1:C10)',
        returns: 'O maior valor'
      },
      'MÍNIMO': {
        category: 'stats',
        args: [{ name: 'número1', type: 'number|range', optional: false }, { name: 'número2', type: 'number|range', optional: true, repeating: true }],
        example: 'MÍNIMO(D1:D10)',
        returns: 'O menor valor'
      },
      'ARREDONDAR': {
        category: 'math',
        args: [{ name: 'número', type: 'number', optional: false }, { name: 'decimais', type: 'number', optional: false }],
        example: 'ARREDONDAR(3.14159, 2)',
        returns: 'Número arredondado'
      },
      'ABS': {
        category: 'math',
        args: [{ name: 'número', type: 'number', optional: false }],
        example: 'ABS(-5)',
        returns: 'Valor absoluto (sem sinal)'
      },
      'RAIZ': {
        category: 'math',
        args: [{ name: 'número', type: 'number', optional: false }],
        example: 'RAIZ(16)',
        returns: 'Raiz quadrada'
      },
      'POTÊNCIA': {
        category: 'math',
        args: [{ name: 'base', type: 'number', optional: false }, { name: 'expoente', type: 'number', optional: false }],
        example: 'POTÊNCIA(2, 3)',
        returns: 'Base elevada ao expoente'
      },
      // TEXT
      'CONCATENAR': {
        category: 'text',
        args: [{ name: 'texto1', type: 'text', optional: false }, { name: 'texto2', type: 'text', optional: true, repeating: true }],
        example: 'CONCATENAR("Olá", " ", "Mundo")',
        returns: 'Textos unidos'
      },
      'MAIÚSCULA': {
        category: 'text',
        args: [{ name: 'texto', type: 'text', optional: false }],
        example: 'MAIÚSCULA("hello")',
        returns: 'Texto em maiúsculas'
      },
      'MINÚSCULA': {
        category: 'text',
        args: [{ name: 'texto', type: 'text', optional: false }],
        example: 'MINÚSCULA("HELLO")',
        returns: 'Texto em minúsculas'
      },
      'TEXTO': {
        category: 'text',
        args: [{ name: 'valor', type: 'any', optional: false }, { name: 'formato', type: 'text', optional: true }],
        example: 'TEXTO(1234.5, "pt-BR")',
        returns: 'Valor formatado como texto'
      },
      'NÚM.CARACT': {
        category: 'text',
        args: [{ name: 'texto', type: 'text', optional: false }],
        example: 'NÚM.CARACT("Hello")',
        returns: 'Número de caracteres'
      },
      // LOGIC
      'SE': {
        category: 'logic',
        args: [
          { name: 'condição', type: 'boolean', optional: false },
          { name: 'se_verdadeiro', type: 'any', optional: false },
          { name: 'se_falso', type: 'any', optional: false }
        ],
        example: 'SE(A1>100, "Alto", "Baixo")',
        returns: 'Valor baseado na condição'
      },
      'E': {
        category: 'logic',
        args: [{ name: 'lógico1', type: 'boolean', optional: false }, { name: 'lógico2', type: 'boolean', optional: true, repeating: true }],
        example: 'E(A1>0, B1<100)',
        returns: 'VERDADEIRO se todas as condições forem verdadeiras'
      },
      'OU': {
        category: 'logic',
        args: [{ name: 'lógico1', type: 'boolean', optional: false }, { name: 'lógico2', type: 'boolean', optional: true, repeating: true }],
        example: 'OU(A1>0, B1>0)',
        returns: 'VERDADEIRO se alguma condição for verdadeira'
      },
      'NÃO': {
        category: 'logic',
        args: [{ name: 'lógico', type: 'boolean', optional: false }],
        example: 'NÃO(A1>100)',
        returns: 'Inverte o valor lógico'
      },
      // INFO
      'ÉNÚM': {
        category: 'info',
        args: [{ name: 'valor', type: 'any', optional: false }],
        example: 'ÉNÚM(A1)',
        returns: 'VERDADEIRO se for número'
      },
      'ÉTEXTO': {
        category: 'info',
        args: [{ name: 'valor', type: 'any', optional: false }],
        example: 'ÉTEXTO(A1)',
        returns: 'VERDADEIRO se for texto'
      },
      'ÉVAZIO': {
        category: 'info',
        args: [{ name: 'valor', type: 'any', optional: false }],
        example: 'ÉVAZIO(A1)',
        returns: 'VERDADEIRO se estiver vazio'
      },
      // LOOKUP
      'PROCV': {
        category: 'lookup',
        args: [
          { name: 'valor_procurado', type: 'any', optional: false },
          { name: 'tabela', type: 'range', optional: false },
          { name: 'coluna', type: 'number', optional: false },
          { name: 'procurar_exato', type: 'boolean', optional: true }
        ],
        example: 'PROCV("João", A1:C10, 2, VERDADEIRO)',
        returns: 'Valor encontrado na tabela'
      },
      // COUNT
      'CONT.NÚM': {
        category: 'stats',
        args: [{ name: 'valor1', type: 'number|range', optional: false }, { name: 'valor2', type: 'number|range', optional: true, repeating: true }],
        example: 'CONT.NÚM(A1:A10)',
        returns: 'Quantidade de números'
      },
      'CONT.VALORES': {
        category: 'stats',
        args: [{ name: 'valor1', type: 'any', optional: false }, { name: 'valor2', type: 'any', optional: true, repeating: true }],
        example: 'CONT.VALORES(A1:A10)',
        returns: 'Quantidade de valores não vazios'
      }
    };

    return functionData[name] || {
      category: 'math',
      args: [],
      example: `${name}()`,
      returns: 'Resultado da função'
    };
  }

  private currentFormulaFunction: any = null;
  private currentFormulaArgs: string[] = [];
  private formulaTargetCell: { row: number; col: number } | null = null;

  private setupFormulaBuilderEvents(modal: HTMLElement, allFunctions: any[]): void {
    // Close button
    modal.querySelector('#formula-builder-close')?.addEventListener('click', () => modal.remove());
    modal.querySelector('#formula-cancel')?.addEventListener('click', () => modal.remove());

    // Search
    const searchInput = modal.querySelector('#formula-search') as HTMLInputElement;
    searchInput?.addEventListener('input', () => {
      const query = searchInput.value.toLowerCase();
      const category = (modal.querySelector('#formula-category-filter') as HTMLSelectElement)?.value || 'all';
      this.renderFunctionList(allFunctions, category, query);
    });

    // Category filter
    const categoryFilter = modal.querySelector('#formula-category-filter') as HTMLSelectElement;
    categoryFilter?.addEventListener('change', () => {
      const category = categoryFilter.value;
      const query = searchInput?.value.toLowerCase() || '';
      this.renderFunctionList(allFunctions, category, query);
    });

    // Insert button
    modal.querySelector('#formula-insert')?.addEventListener('click', () => {
      const preview = modal.querySelector('#formula-preview')?.textContent;
      if (preview && preview !== '=') {
        this.insertFormula(preview);
        modal.remove();
      } else {
        alert('Construa uma fórmula primeiro!');
      }
    });

    // Keyboard shortcuts
    const keyHandler = (e: KeyboardEvent) => {
      // Escape - close modal
      if (e.key === 'Escape') {
        if (!this.cellSelectionMode) {
          modal.remove();
          document.removeEventListener('keydown', keyHandler);
        }
      }

      // Enter - insert formula
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
        const preview = modal.querySelector('#formula-preview')?.textContent;
        if (preview && preview !== '=') {
          e.preventDefault();
          this.insertFormula(preview);
          modal.remove();
          document.removeEventListener('keydown', keyHandler);
        }
      }

      // Ctrl+F - focus search
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        const searchInput = modal.querySelector('#formula-search') as HTMLInputElement;
        searchInput?.focus();
      }

      // Arrow Up/Down - navigate function list
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const functionList = modal.querySelectorAll('.formula-function-item');
        const selected = modal.querySelector('.formula-function-item.selected');

        if (functionList.length > 0) {
          e.preventDefault();
          let newIndex = 0;

          if (selected) {
            const currentIndex = Array.from(functionList).indexOf(selected);
            if (e.key === 'ArrowDown') {
              newIndex = Math.min(currentIndex + 1, functionList.length - 1);
            } else {
              newIndex = Math.max(currentIndex - 1, 0);
            }
          }

          const newSelected = functionList[newIndex] as HTMLElement;
          newSelected?.click();
          newSelected?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }
    };

    document.addEventListener('keydown', keyHandler);

    // Make modal draggable
    const header = modal.querySelector('.modal-header') as HTMLElement;
    const modalContent = modal.querySelector('.formula-builder-modal') as HTMLElement;
    if (header && modalContent) {
      this.makeModalDraggable(modalContent, header);
    }
  }

  private renderFunctionList(allFunctions: any[], category: string = 'all', query: string = ''): void {
    const container = document.getElementById('formula-function-list');
    if (!container) return;

    let filtered = allFunctions;

    // Filter by category
    if (category !== 'all') {
      filtered = filtered.filter(fn => fn.category === category);
    }

    // Filter by search query
    if (query) {
      filtered = filtered.filter(fn =>
        fn.name.toLowerCase().includes(query) ||
        fn.description.toLowerCase().includes(query)
      );
    }

    if (filtered.length === 0) {
      container.innerHTML = '<p style="text-align: center; color: var(--theme-text-tertiary); padding: var(--spacing-lg); font-size: 12px;">Nenhuma função encontrada</p>';
      return;
    }

    container.innerHTML = filtered.map(fn => `
      <div class="function-item" data-function="${fn.name}" style="padding: var(--spacing-sm); margin-bottom: 2px; border-radius: var(--border-radius); cursor: pointer; transition: background var(--transition-fast);">
        <div style="font-weight: 500; font-size: 13px; color: var(--theme-text-primary); margin-bottom: 2px;">${fn.name}</div>
        <div style="font-size: 11px; color: var(--theme-text-tertiary); line-height: 1.3;">${fn.description}</div>
      </div>
    `).join('');

    // Add click handlers
    container.querySelectorAll('.function-item').forEach(item => {
      item.addEventListener('click', () => {
        const functionName = (item as HTMLElement).dataset.function;
        const fn = allFunctions.find(f => f.name === functionName);
        if (fn) {
          this.renderFunctionDetail(fn);

          // Highlight selected
          container.querySelectorAll('.function-item').forEach(i => {
            (i as HTMLElement).style.background = 'transparent';
          });
          (item as HTMLElement).style.background = 'var(--theme-bg-hover)';
        }
      });

      item.addEventListener('mouseenter', () => {
        (item as HTMLElement).style.background = 'var(--theme-bg-hover)';
      });

      item.addEventListener('mouseleave', () => {
        if ((item as HTMLElement).dataset.function !== this.currentFormulaFunction?.name) {
          (item as HTMLElement).style.background = 'transparent';
        }
      });
    });
  }

  private renderFunctionDetail(fn: any): void {
    this.currentFormulaFunction = fn;
    this.currentFormulaArgs = new Array(fn.args.length).fill('');

    const container = document.getElementById('formula-builder-main');
    if (!container) return;

    const categories = this.getFunctionCategories();
    const categoryInfo = categories[fn.category as keyof typeof categories];

    container.innerHTML = `
      <div class="function-detail">
        <div style="margin-bottom: var(--spacing-lg);">
          <div style="display: flex; align-items: center; gap: var(--spacing-sm); margin-bottom: var(--spacing-sm);">
            <h3 style="font-size: 24px; font-weight: 700; color: var(--theme-color-primary); margin: 0;">${fn.name}</h3>
            <span style="padding: 2px 8px; background: var(--theme-bg-tertiary); border-radius: var(--border-radius); font-size: 11px; color: var(--theme-text-secondary);">${categoryInfo ? `${categoryInfo.icon} ${categoryInfo.name}` : ''}</span>
          </div>
          <p style="color: var(--theme-text-secondary); font-size: 14px; line-height: 1.6;">${fn.description}</p>
        </div>

        ${fn.args.length > 0 ? `
          <div style="margin-bottom: var(--spacing-lg);">
            <h4 style="font-size: 14px; font-weight: 600; margin-bottom: var(--spacing-md); color: var(--theme-text-primary);">📋 Argumentos:</h4>
            ${fn.args.map((arg: any, index: number) => `
              <div class="form-group" style="margin-bottom: var(--spacing-md);">
                <label style="display: flex; align-items: center; gap: var(--spacing-xs); margin-bottom: 4px;">
                  <span style="font-weight: 500; font-size: 13px;">${arg.name}</span>
                  <span style="font-size: 11px; color: var(--theme-text-tertiary);">(${this.getTypeLabel(arg.type)})</span>
                  ${arg.optional ? '<span style="font-size: 10px; padding: 2px 6px; background: var(--theme-bg-tertiary); border-radius: 3px; color: var(--theme-text-tertiary);">opcional</span>' : '<span style="font-size: 10px; padding: 2px 6px; background: var(--theme-color-error); color: white; border-radius: 3px;">obrigatório</span>'}
                  ${arg.repeating ? '<span style="font-size: 10px; padding: 2px 6px; background: var(--theme-color-info); color: white; border-radius: 3px;">...</span>' : ''}
                </label>
                <div style="display: flex; gap: 4px; align-items: stretch; position: relative;">
                  <input
                    type="text"
                    class="form-control formula-arg-input"
                    data-arg-index="${index}"
                    placeholder="${this.getPlaceholder(arg)}"
                    style="font-family: var(--font-mono); font-size: 13px; flex: 1; padding-right: 30px;">
                  ${this.shouldShowCellSelector(arg.type) ? `
                    <span class="cell-selector-icon" data-arg-index="${index}" title="Clique para selecionar células ou arraste na grade" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); cursor: pointer; color: var(--theme-text-tertiary); font-size: 14px;">📍</span>
                  ` : ''}
                </div>
                <small style="font-size: 11px; color: var(--theme-text-tertiary); margin-top: 4px; display: block;">${this.getArgHelp(arg)}</small>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <div style="margin-bottom: var(--spacing-lg); padding: var(--spacing-md); background: var(--theme-bg-secondary); border-radius: var(--border-radius); border-left: 3px solid var(--theme-color-info);">
          <h4 style="font-size: 13px; font-weight: 600; margin-bottom: var(--spacing-sm); color: var(--theme-text-primary);">💡 Exemplo:</h4>
          <code style="font-family: var(--font-mono); font-size: 12px; color: var(--theme-color-primary); background: var(--theme-bg-primary); padding: var(--spacing-xs) var(--spacing-sm); border-radius: var(--border-radius-sm); display: inline-block;">=${fn.example}</code>
        </div>

        <div style="padding: var(--spacing-md); background: var(--theme-bg-secondary); border-radius: var(--border-radius); border-left: 3px solid var(--theme-color-success);">
          <h4 style="font-size: 13px; font-weight: 600; margin-bottom: var(--spacing-sm); color: var(--theme-text-primary);">📤 Retorna:</h4>
          <p style="font-size: 12px; color: var(--theme-text-secondary); margin: 0;">${fn.returns}</p>
        </div>
      </div>
    `;

    // Add input listeners
    container.querySelectorAll('.formula-arg-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const index = parseInt((e.target as HTMLElement).dataset.argIndex || '0');
        this.currentFormulaArgs[index] = (e.target as HTMLInputElement).value;
        this.updateFormulaPreview();
      });

      // Add focus listener to trigger cell selection
      input.addEventListener('focus', (e) => {
        const targetInput = e.target as HTMLInputElement; // Cast to HTMLInputElement
        const index = parseInt(targetInput.dataset.argIndex || '0');
        // Only start selection if the input is empty or contains a cell/range reference
        if (!targetInput.value || /^[A-Z]+\d+(:[A-Z]+\d+)?$/.test(targetInput.value)) {
          this.startCellSelection(index, targetInput);
        }
      });
    });

    // Add click listener for the cell selector icon
    container.querySelectorAll('.cell-selector-icon').forEach(icon => {
      icon.addEventListener('click', (e) => {
        const index = parseInt((e.target as HTMLElement).dataset.argIndex || '0');
        const input = (e.target as HTMLElement).previousElementSibling as HTMLInputElement; // Get the associated input
        this.startCellSelection(index, input);
      });
    });
  }

  private shouldShowCellSelector(type: string): boolean {
    return type.includes('number') || type.includes('range') || type === 'any';
  }

  private cellSelectionMode = false;
  private activeFormulaInput: HTMLInputElement | null = null;
  private cellSelectionArgIndex = -1;
  private cellSelectionStart: { row: number; col: number } | null = null;

  private startCellSelection(argIndex: number, inputElement: HTMLInputElement): void {
    this.cellSelectionMode = true;
    this.cellSelectionArgIndex = argIndex;
    this.cellSelectionStart = null;
    this.activeFormulaInput = inputElement; // Store the input element

    // Hide formula builder modal completely so it doesn't block the view
    const modal = document.getElementById('formula-builder-modal');
    if (modal) {
      (modal as HTMLElement).style.display = 'none';
    }

    // Show instruction overlay
    this.showCellSelectionOverlay();

    // Listen for grid clicks
    this.enableCellSelectionOnGrid();
  }

  private showCellSelectionOverlay(): void {
    const overlay = document.createElement('div');
    overlay.id = 'cell-selection-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(37, 99, 235, 0.05);
      z-index: 9998;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    `;
    overlay.innerHTML = `
      <div style="background: var(--theme-bg-primary); padding: var(--spacing-xl); border-radius: var(--border-radius-xl); box-shadow: var(--shadow-xl); border: 2px solid var(--theme-color-primary); max-width: 400px; text-align: center;">
        <div style="font-size: 32px; margin-bottom: var(--spacing-md);">🎯</div>
        <h3 style="font-size: 18px; font-weight: 600; margin-bottom: var(--spacing-sm); color: var(--theme-color-primary);">Selecione as células</h3>
        <p style="color: var(--theme-text-secondary); font-size: 14px; margin-bottom: var(--spacing-md);">
          Clique em uma célula ou arraste para selecionar um intervalo
        </p>
        <button id="cancel-cell-selection" class="btn" style="pointer-events: all;">Cancelar (Esc)</button>
      </div>
    `;
    document.body.appendChild(overlay);

    // Cancel button
    document.getElementById('cancel-cell-selection')?.addEventListener('click', () => {
      this.cancelCellSelection();
    });

    // ESC key to cancel
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.cancelCellSelection();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  }

  private enableCellSelectionOnGrid(): void {
    if (!this.grid) return;

    const canvas = document.getElementById('grid-canvas') as HTMLCanvasElement;
    if (!canvas) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (!this.cellSelectionMode) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Use grid's built-in method to get cell coordinates
      const cellPos = this.grid?.getCellAt(x, y);
      if (cellPos) {
        this.cellSelectionStart = cellPos;
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!this.cellSelectionMode || !this.cellSelectionStart) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Use grid's built-in method to get cell coordinates
      const cellPos = this.grid?.getCellAt(x, y);
      if (!cellPos) return;

      const sheet = this.grid?.getSheet();
      if (!sheet) return;

      // Build range string
      let range: string;
      if (this.cellSelectionStart.row === cellPos.row && this.cellSelectionStart.col === cellPos.col) {
        // Single cell
        range = sheet.getColumnName(cellPos.col) + (cellPos.row + 1);
      } else {
        // Range
        const startCol = sheet.getColumnName(Math.min(this.cellSelectionStart.col, cellPos.col));
        const endCol = sheet.getColumnName(Math.max(this.cellSelectionStart.col, cellPos.col));
        const startRow = Math.min(this.cellSelectionStart.row, cellPos.row) + 1;
        const endRow = Math.max(this.cellSelectionStart.row, cellPos.row) + 1;
        range = `${startCol}${startRow}:${endCol}${endRow}`;
      }

      this.completeCellSelection(range);
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);

    // Store handlers for cleanup
    (canvas as any)._cellSelectionHandlers = { handleMouseDown, handleMouseUp };
  }

  private completeCellSelection(range: string): void {
    // Update the input field
    if (this.activeFormulaInput) {
      this.activeFormulaInput.value = range;
      this.currentFormulaArgs[this.cellSelectionArgIndex] = range;
      this.updateFormulaPreview();
    }

    this.cancelCellSelection();
  }

  private cancelCellSelection(): void {
    this.cellSelectionMode = false;
    this.cellSelectionArgIndex = -1;
    this.cellSelectionStart = null;
    this.activeFormulaInput = null; // Clear the active input

    // Restore formula builder modal
    const modal = document.getElementById('formula-builder-modal');
    if (modal) {
      (modal as HTMLElement).style.display = 'flex';
    }

    // Remove overlay
    document.getElementById('cell-selection-overlay')?.remove();

    // Remove grid event listeners
    const canvas = document.getElementById('grid-canvas') as HTMLCanvasElement;
    if (canvas && (canvas as any)._cellSelectionHandlers) {
      const { handleMouseDown, handleMouseUp } = (canvas as any)._cellSelectionHandlers;
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseup', handleMouseUp);
      delete (canvas as any)._cellSelectionHandlers;
    }
  }



  private isCellEmpty(cell: any): boolean {
    if (!cell) return true;
    if (cell.value === null || cell.value === undefined) return true;
    if (typeof cell.value === 'string' && cell.value.trim() === '') return true;
    return false;
  }

  private detectDataRange(sheet: any, startRow: number, startCol: number): string | null {
    const currentCell = sheet.getCell(startRow, startCol);
    if (!currentCell || this.isCellEmpty(currentCell)) {
      return null;
    }

    // Strategy 1: Look for continuous vertical data (column-based detection)
    const columnRange = this.detectColumnRange(sheet, startRow, startCol);

    // Strategy 2: Look for table structure (header + data rows)
    const tableRange = this.detectTableRange(sheet, startRow, startCol);

    // Return the more specific detection (table > column)
    if (tableRange && tableRange.cols > 1) {
      return tableRange.range;
    } else if (columnRange) {
      return columnRange;
    } else if (tableRange) {
      return tableRange.range;
    }

    return null;
  }

  private detectColumnRange(sheet: any, startRow: number, startCol: number): string | null {
    const currentCell = sheet.getCell(startRow, startCol);
    if (!currentCell || this.isCellEmpty(currentCell)) return null;

    let dataStartRow = startRow;

    // Check if current cell is a header
    const cellBelow = sheet.getCell(startRow + 1, startCol);
    if (cellBelow && !this.isCellEmpty(cellBelow)) {
      // Header heuristic: text followed by different type
      if (currentCell.type === 'text' && cellBelow.type !== 'text') {
        dataStartRow = startRow + 1;
      }
    }

    // Find end of continuous data
    let endRow = dataStartRow;
    let emptyCount = 0;
    const maxEmptyGap = 1; // Allow 1 empty cell

    while (endRow < 10000) {
      const cell = sheet.getCell(endRow, startCol);
      if (!cell || this.isCellEmpty(cell)) {
        emptyCount++;
        if (emptyCount > maxEmptyGap) break;
      } else {
        emptyCount = 0;
      }
      endRow++;
    }

    endRow = endRow - emptyCount - 1;

    // Need at least 2 data cells for a valid range
    if (endRow - dataStartRow < 1) {
      return null;
    }

    const colName = sheet.getColumnName(startCol);
    return `${colName}${dataStartRow + 1}:${colName}${endRow + 1}`;
  }

  private detectTableRange(sheet: any, startRow: number, startCol: number): { range: string; cols: number } | null {
    // First, try to identify if we're in a table by looking for headers
    let headerRow = -1;
    let dataStartRow = startRow;

    // Check current row and row above for headers
    for (let checkRow = Math.max(0, startRow - 1); checkRow <= startRow; checkRow++) {
      const cell = sheet.getCell(checkRow, startCol);
      if (!cell || this.isCellEmpty(cell)) continue;

      // Check if this looks like a header row
      if (this.isLikelyHeaderRow(sheet, checkRow, startCol)) {
        headerRow = checkRow;
        dataStartRow = checkRow + 1;
        break;
      }
    }

    if (headerRow < 0) {
      // No header found, try from current position
      dataStartRow = startRow;
    }

    // Find table boundaries
    const bounds = this.findTableBounds(sheet, dataStartRow, startCol, headerRow);
    if (!bounds) return null;

    const { startCol: tableStartCol, endCol: tableEndCol, startRow: tableStartRow, endRow: tableEndRow } = bounds;

    // Validate we found a meaningful table
    const numRows = tableEndRow - tableStartRow + 1;
    const numCols = tableEndCol - tableStartCol + 1;

    if (numRows < 2 || numCols < 1) return null;

    const startColName = sheet.getColumnName(tableStartCol);
    const endColName = sheet.getColumnName(tableEndCol);
    const range = `${startColName}${tableStartRow + 1}:${endColName}${tableEndRow + 1}`;

    return { range, cols: numCols };
  }

  private isLikelyHeaderRow(sheet: any, row: number, aroundCol: number): boolean {
    // Check cells in current row and next row
    let textCount = 0;
    let dataTypeChangeCount = 0;

    for (let col = Math.max(0, aroundCol - 2); col <= aroundCol + 2; col++) {
      const headerCell = sheet.getCell(row, col);
      const dataCell = sheet.getCell(row + 1, col);

      if (!headerCell || this.isCellEmpty(headerCell)) continue;

      if (headerCell.type === 'text') textCount++;

      if (dataCell && !this.isCellEmpty(dataCell)) {
        if (headerCell.type !== dataCell.type) {
          dataTypeChangeCount++;
        }
      }
    }

    // Header heuristic: mostly text, and types change below
    return textCount >= 2 && dataTypeChangeCount >= 1;
  }

  private findTableBounds(sheet: any, dataStartRow: number, seedCol: number, headerRow: number): {
    startCol: number;
    endCol: number;
    startRow: number;
    endRow: number;
  } | null {
    // Find left boundary
    let startCol = seedCol;
    while (startCol > 0) {
      const hasData = this.columnHasData(sheet, dataStartRow, startCol - 1);
      if (!hasData) break;

      // If we have a header row, check header continuity
      if (headerRow >= 0) {
        const headerCell = sheet.getCell(headerRow, startCol - 1);
        if (!headerCell || this.isCellEmpty(headerCell)) break;
      }

      startCol--;
    }

    // Find right boundary
    let endCol = seedCol;
    while (endCol < 100) {
      const hasData = this.columnHasData(sheet, dataStartRow, endCol + 1);
      if (!hasData) break;

      // If we have a header row, check header continuity
      if (headerRow >= 0) {
        const headerCell = sheet.getCell(headerRow, endCol + 1);
        if (!headerCell || this.isCellEmpty(headerCell)) break;
      }

      endCol++;
    }

    // Find bottom boundary (check all columns in range)
    let endRow = dataStartRow;
    let consecutiveEmptyRows = 0;

    while (endRow < 10000 && consecutiveEmptyRows < 2) {
      let hasDataInRow = false;

      for (let col = startCol; col <= endCol; col++) {
        const cell = sheet.getCell(endRow, col);
        if (cell && !this.isCellEmpty(cell)) {
          hasDataInRow = true;
          break;
        }
      }

      if (hasDataInRow) {
        consecutiveEmptyRows = 0;
      } else {
        consecutiveEmptyRows++;
      }

      endRow++;
    }

    endRow = endRow - consecutiveEmptyRows - 1;

    // Validate bounds
    if (endRow < dataStartRow || endCol < startCol) {
      return null;
    }

    return {
      startCol,
      endCol,
      startRow: dataStartRow,
      endRow
    };
  }

  private columnHasData(sheet: any, startRow: number, col: number): boolean {
    // Check if column has at least 2 cells with data
    let count = 0;
    for (let row = startRow; row < Math.min(startRow + 10, 10000); row++) {
      const cell = sheet.getCell(row, col);
      if (cell && !this.isCellEmpty(cell)) {
        count++;
        if (count >= 2) return true;
      }
    }
    return false;
  }



  private getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      'number': 'número',
      'text': 'texto',
      'boolean': 'lógico',
      'range': 'intervalo',
      'any': 'qualquer',
      'number|range': 'número ou intervalo',
      'text|range': 'texto ou intervalo'
    };
    return labels[type] || type;
  }

  private getPlaceholder(arg: any): string {
    const placeholders: Record<string, string> = {
      'number': 'Ex: 42 ou A1',
      'text': 'Ex: "Texto" ou B1',
      'boolean': 'Ex: VERDADEIRO ou A1>10',
      'range': 'Ex: A1:B10',
      'any': 'Ex: A1 ou "valor"',
      'number|range': 'Ex: 42 ou A1:A10',
      'text|range': 'Ex: "Texto" ou A1:B5'
    };
    return placeholders[arg.type] || `Digite ${arg.name}`;
  }

  private getArgHelp(arg: any): string {
    const helps: Record<string, string> = {
      'number': 'Digite um número ou referência de célula (ex: A1)',
      'text': 'Digite texto entre aspas ou referência de célula',
      'boolean': 'Digite VERDADEIRO/FALSO ou uma comparação',
      'range': 'Digite um intervalo de células (ex: A1:B10)',
      'number|range': 'Digite um número, célula ou intervalo',
      'any': 'Digite qualquer valor ou referência'
    };
    return helps[arg.type] || '';
  }

  private updateFormulaPreview(): void {
    const preview = document.getElementById('formula-preview');
    if (!preview || !this.currentFormulaFunction) return;

    const args = this.currentFormulaArgs.filter((arg, index) => {
      const argDef = this.currentFormulaFunction.args[index];
      return arg.trim() !== '' || !argDef?.optional;
    });

    const formula = `=${this.currentFormulaFunction.name}(${args.join(', ')})`;
    preview.innerHTML = this.highlightFormula(formula);
  }

  private highlightFormula(formula: string): string {
    // Start with equals sign
    let highlighted = '<span style="color: var(--theme-text-secondary);">=</span>';

    // Remove the = sign for processing
    const content = formula.substring(1);

    // Match function name
    const funcMatch = content.match(/^([A-ZÀ-Ú.]+)\(/);
    if (funcMatch) {
      const funcName = funcMatch[1];
      highlighted += `<span style="color: var(--theme-color-primary); font-weight: 600;">${funcName}</span>`;
      highlighted += '<span style="color: var(--theme-text-secondary);">(</span>';

      // Get arguments part
      const argsStart = funcName.length + 1;
      const argsEnd = content.lastIndexOf(')');
      const argsContent = content.substring(argsStart, argsEnd);

      if (argsContent.trim()) {
        // Split by comma but preserve strings
        const args = this.splitFormulaArgs(argsContent);
        highlighted += args.map(arg => this.highlightArgument(arg.trim())).join('<span style="color: var(--theme-text-secondary);">, </span>');
      }

      highlighted += '<span style="color: var(--theme-text-secondary);">)</span>';
    } else {
      // Fallback: just highlight the whole thing
      highlighted += `<span style="color: var(--theme-text-primary);">${content}</span>`;
    }

    return highlighted;
  }

  private splitFormulaArgs(argsStr: string): string[] {
    const args: string[] = [];
    let current = '';
    let inString = false;
    let depth = 0;

    for (let i = 0; i < argsStr.length; i++) {
      const char = argsStr[i];

      if (char === '"') {
        inString = !inString;
        current += char;
      } else if (!inString && char === '(') {
        depth++;
        current += char;
      } else if (!inString && char === ')') {
        depth--;
        current += char;
      } else if (!inString && char === ',' && depth === 0) {
        args.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    if (current) args.push(current);
    return args;
  }

  private highlightArgument(arg: string): string {
    // String literal
    if (arg.startsWith('"') && arg.endsWith('"')) {
      return `<span style="color: #22c55e;">${arg}</span>`;
    }

    // Number
    if (/^-?\d+(\.\d+)?$/.test(arg)) {
      return `<span style="color: #a855f7;">${arg}</span>`;
    }

    // Range reference (A1:B10)
    if (/^[A-Z]+\d+:[A-Z]+\d+$/.test(arg)) {
      return `<span style="color: #f59e0b; font-weight: 500;">${arg}</span>`;
    }

    // Cell reference (A1, $A$1)
    if (/^(\$?[A-Z]+\$?\d+)$/.test(arg)) {
      return `<span style="color: #f59e0b; font-weight: 500;">${arg}</span>`;
    }

    // Boolean
    if (arg === 'VERDADEIRO' || arg === 'FALSO') {
      return `<span style="color: #3b82f6; font-weight: 500;">${arg}</span>`;
    }

    // Nested function
    if (/^[A-ZÀ-Ú.]+\(/.test(arg)) {
      return this.highlightFormula('=' + arg).substring(58); // Remove the = wrapper
    }

    // Operator expression (A1>10)
    if (/[><=]/.test(arg)) {
      return arg.replace(/([><=]+)/g, '<span style="color: #f59e0b;">$1</span>');
    }

    // Default: regular text
    return `<span style="color: var(--theme-text-primary);">${arg}</span>`;
  }

  private showAutocompleteSuggestions(query: string): void {
    const suggestionsContainer = document.getElementById('formula-autocomplete-suggestions');
    if (!suggestionsContainer) return;

    const allFunctions = kernel.calcEngine.getRegistry().list();
    const filteredFunctions = allFunctions.filter(fn =>
      fn.name.toLowerCase().startsWith(query.toLowerCase())
    );

    if (filteredFunctions.length > 0 && query.length > 0) {
      suggestionsContainer.innerHTML = filteredFunctions.map(fn => `
        <div class="autocomplete-item" data-function="${fn.name}" style="padding: 8px; cursor: pointer; background: var(--theme-bg-primary); border-bottom: 1px solid var(--theme-border-color);">
          <strong>${fn.name}</strong> - ${fn.description}
        </div>
      `).join('');
      suggestionsContainer.style.display = 'block';

      suggestionsContainer.querySelectorAll('.autocomplete-item').forEach(item => {
        item.addEventListener('click', () => {
          const functionName = (item as HTMLElement).dataset.function;
          if (functionName) {
            this.selectAutocompleteSuggestion(functionName);
          }
        });
      });
    } else {
      this.hideAutocompleteSuggestions();
    }
  }

  private hideAutocompleteSuggestions(): void {
    const suggestionsContainer = document.getElementById('formula-autocomplete-suggestions');
    if (suggestionsContainer) {
      suggestionsContainer.innerHTML = '';
      suggestionsContainer.style.display = 'none';
    }
  }

  private selectAutocompleteSuggestion(functionName: string): void {
    const formulaInput = document.getElementById('formula-input') as HTMLInputElement;
    if (formulaInput) {
      formulaInput.value = `=${functionName}(`;
      formulaInput.focus();
      this.hideAutocompleteSuggestions();
    }
  }

  private insertFormula(formula: string): void {
    const sheet = this.grid?.getSheet();

    if (!this.formulaTargetCell || !sheet) {
      alert('Erro: célula alvo não definida');
      return;
    }

    const row = this.formulaTargetCell.row;
    const col = this.formulaTargetCell.col;

    // Insert formula - let the engine calculate the value
    sheet.setCell(row, col, '', { formula, type: 'formula' });

    // Recalculate the sheet
    kernel.recalculate(sheet.id);

    // Re-render the grid to show updated values
    this.grid?.render();

    logger.info('[UIManager] Formula inserted', { formula, row, col });

    // Clear target cell
    this.formulaTargetCell = null;
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

  private renderPluginsList(plugins: any[]): string {
    if (plugins.length === 0) {
      return '<p style="text-align: center; color: var(--theme-text-tertiary); padding: var(--spacing-lg);">Nenhum plugin instalado</p>';
    }

    return plugins.map(plugin => `
      <div class="plugin-item" style="padding: var(--spacing-sm); border-bottom: 1px solid var(--theme-border-color); display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-weight: 500; margin-bottom: 2px;">${plugin.name}</div>
          <div style="font-size: 11px; color: var(--theme-text-tertiary);">v${plugin.version} • ${plugin.id}</div>
        </div>
        <button class="btn-uninstall-plugin" data-plugin-id="${plugin.id}" style="padding: 4px 8px; font-size: 11px; background: var(--theme-color-error); color: white; border: none; border-radius: var(--border-radius); cursor: pointer;">Desinstalar</button>
      </div>
    `).join('');
  }

  private async installPluginFromURL(): Promise<void> {
    const input = document.getElementById('plugin-url-input') as HTMLInputElement;
    const url = input?.value.trim();

    if (!url) {
      alert('Digite uma URL válida');
      return;
    }

    try {
      logger.info('[UIManager] Loading plugin from URL', { url });
      const code = await this.fetchPluginCode(url);
      await this.loadPluginFromCode(code);
      input.value = '';
      this.refreshPluginsList();
      alert('Plugin instalado com sucesso!');
    } catch (error) {
      logger.error('[UIManager] Failed to install plugin from URL', error);
      alert(`Erro ao instalar plugin: ${error}`);
    }
  }

  private async installPluginFromFile(): Promise<void> {
    const input = document.getElementById('plugin-file-input') as HTMLInputElement;
    const file = input?.files?.[0];

    if (!file) {
      alert('Selecione um arquivo .js');
      return;
    }

    try {
      logger.info('[UIManager] Loading plugin from file', { fileName: file.name });
      const code = await this.readFileAsText(file);
      await this.loadPluginFromCode(code);
      input.value = '';
      this.refreshPluginsList();
      alert('Plugin instalado com sucesso!');
    } catch (error) {
      logger.error('[UIManager] Failed to install plugin from file', error);
      alert(`Erro ao instalar plugin: ${error}`);
    }
  }

  private async installPluginFromCode(): Promise<void> {
    const textarea = document.getElementById('plugin-code-input') as HTMLTextAreaElement;
    const code = textarea?.value.trim();

    if (!code) {
      alert('Cole o código do plugin');
      return;
    }

    try {
      logger.info('[UIManager] Loading plugin from code');
      await this.loadPluginFromCode(code);
      textarea.value = '';
      this.refreshPluginsList();
      alert('Plugin instalado com sucesso!');
    } catch (error) {
      logger.error('[UIManager] Failed to install plugin from code', error);
      alert(`Erro ao instalar plugin: ${error}`);
    }
  }

  private async fetchPluginCode(url: string): Promise<string> {
    // Try direct fetch first
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      // If CORS fails, try with CORS proxy
      logger.warn('[UIManager] Direct fetch failed, trying CORS proxy', error);

      const corsProxies = [
        `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
        `https://corsproxy.io/?${encodeURIComponent(url)}`,
      ];

      for (const proxyUrl of corsProxies) {
        try {
          const response = await fetch(proxyUrl);
          if (response.ok) {
            logger.info('[UIManager] Successfully loaded via CORS proxy');
            return await response.text();
          }
        } catch (proxyError) {
          logger.warn('[UIManager] CORS proxy failed', { proxy: proxyUrl, error: proxyError });
        }
      }

      throw new Error('Não foi possível carregar o plugin. Verifique se a URL está correta ou tente fazer upload do arquivo.');
    }
  }

  private readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  private async loadPluginFromCode(code: string): Promise<void> {
    // Create a safe execution context
    // Wrap the code to export the plugin class
    const wrappedCode = `
      ${code}

      // Auto-detect and export the plugin class
      (function() {
        const exports = {};

        // Try to find the plugin class in the code
        const classMatch = code.match(/class\\s+(\\w+)/);
        if (classMatch) {
          const className = classMatch[1];
          if (typeof eval(className) !== 'undefined') {
            exports.default = eval(className);
            return exports;
          }
        }

        // If no class found, assume the code defines window.PluginClass or similar
        for (const key of Object.keys(window)) {
          const value = (window as any)[key];
          if (value && typeof value === 'function' && value.prototype && value.prototype.init) {
            exports.default = value;
            return exports;
          }
        }

        throw new Error('Plugin class not found. Make sure your plugin exports a class with an init() method.');
      })();
    `;

    try {
      // Execute the code in a sandboxed context
      const pluginModule = new Function('return ' + wrappedCode)();

      if (!pluginModule.default) {
        throw new Error('Plugin deve exportar uma classe default');
      }

      // Create instance to get manifest
      const instance = new pluginModule.default();

      if (!instance.manifest) {
        throw new Error('Plugin deve ter uma propriedade manifest');
      }

      // Check if already loaded
      if (kernel['pluginHost'].isLoaded(instance.manifest.id)) {
        throw new Error(`Plugin ${instance.manifest.id} já está instalado`);
      }

      // Load the plugin
      await kernel['pluginHost'].loadPlugin(pluginModule, instance.manifest);

      // Save plugin code to localStorage for persistence
      this.savePluginCode(instance.manifest.id, code);

      logger.info('[UIManager] Plugin loaded successfully', { id: instance.manifest.id });
      this.refreshPluginCount();
    } catch (error) {
      throw new Error(`Erro ao carregar plugin: ${error}`);
    }
  }

  private savePluginCode(pluginId: string, code: string): void {
    const savedPlugins = JSON.parse(localStorage.getItem('custom-plugins') || '{}');
    savedPlugins[pluginId] = code;
    localStorage.setItem('custom-plugins', JSON.stringify(savedPlugins));
  }

  public async loadSavedPlugins(): Promise<void> {
    const savedPlugins = JSON.parse(localStorage.getItem('custom-plugins') || '{}');

    for (const [pluginId, code] of Object.entries(savedPlugins)) {
      try {
        if (!kernel['pluginHost'].isLoaded(pluginId)) {
          await this.loadPluginFromCode(code as string);
          logger.info('[UIManager] Loaded saved plugin', { pluginId });
        }
      } catch (error) {
        logger.error('[UIManager] Failed to load saved plugin', { pluginId, error });
      }
    }
  }

  private refreshPluginsList(): void {
    const plugins = kernel['pluginHost'].getLoadedPlugins();
    const container = document.getElementById('installed-plugins-list');
    if (container) {
      container.innerHTML = this.renderPluginsList(plugins);

      // Re-attach uninstall handlers
      container.querySelectorAll('.btn-uninstall-plugin').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const pluginId = (e.target as HTMLElement).dataset.pluginId;
          if (pluginId && confirm(`Deseja realmente desinstalar o plugin ${pluginId}?`)) {
            try {
              await kernel['pluginHost'].unloadPlugin(pluginId);

              // Remove from saved plugins
              const savedPlugins = JSON.parse(localStorage.getItem('custom-plugins') || '{}');
              delete savedPlugins[pluginId];
              localStorage.setItem('custom-plugins', JSON.stringify(savedPlugins));

              this.refreshPluginsList();
              this.refreshPluginCount();
              alert('Plugin desinstalado com sucesso!');
            } catch (error) {
              logger.error('[UIManager] Failed to uninstall plugin', error);
              alert(`Erro ao desinstalar: ${error}`);
            }
          }
        });
      });
    }

    // Update tab count
    const pluginTab = document.querySelector('.settings-tab[data-tab="plugins"]');
    if (pluginTab) {
      pluginTab.textContent = `Plugins (${plugins.length})`;
    }
  }

  private showSettingsModal(): void {
    const modalId = 'settings-modal';
    // Remover modal existente para evitar duplicatas
    document.getElementById(modalId)?.remove();

    const currentTheme = localStorage.getItem('theme') || 'light';
    const plugins = kernel['pluginHost'].getLoadedPlugins();

    const modalHTML = `
      <div id="${modalId}" class="modal-overlay" style="background: rgba(0,0,0,0.4); backdrop-filter: blur(4px);">
        <div class="modal settings-modal" id="settings-wizard-modal" style="max-width: 800px; max-height: 90vh;">
          <div class="modal-header" id="settings-modal-header" style="border-bottom: 1px solid var(--theme-border-color); padding: var(--spacing-lg); cursor: move;">
            <h2 style="color: var(--theme-text-primary); margin: 0;">⚙️ Configurações</h2>
            <button class="btn" id="settings-modal-close" style="min-width: auto; padding: var(--spacing-xs) var(--spacing-sm);">&times;</button>
          </div>

          <!-- Settings Tabs -->
          <div class="settings-tabs" style="display: flex; border-bottom: 1px solid var(--theme-border-color); background: var(--theme-bg-secondary);">
            <button class="settings-tab active" data-tab="general" style="padding: var(--spacing-sm) var(--spacing-lg); background: transparent; border: none; border-bottom: 2px solid var(--theme-color-primary); color: var(--theme-color-primary); cursor: pointer; font-weight: 500;">Geral</button>
            <button class="settings-tab" data-tab="plugins" style="padding: var(--spacing-sm) var(--spacing-lg); background: transparent; border: none; border-bottom: 2px solid transparent; color: var(--theme-text-secondary); cursor: pointer; font-weight: 500;">Plugins (${plugins.length})</button>
          </div>

          <!-- General Tab -->
          <div class="modal-content settings-tab-content" data-content="general" style="padding: var(--spacing-lg);">
            <div class="form-group">
              <label for="theme-select">Tema:</label>
              <select id="theme-select" class="form-control">
                <option value="light" ${currentTheme === 'light' ? 'selected' : ''}>Claro</option>
                <option value="dark" ${currentTheme === 'dark' ? 'selected' : ''}>Escuro</option>
              </select>
            </div>
            <div class="form-group">
              <label for="language-select">Idioma:</label>
              <select id="language-select" class="form-control">
                <option value="pt-BR" selected>Português (Brasil)</option>
                <option value="en-US">English (US)</option>
              </select>
            </div>
          </div>

          <!-- Plugins Tab -->
          <div class="modal-content settings-tab-content hidden" data-content="plugins" style="padding: var(--spacing-lg);">
            <div style="margin-bottom: var(--spacing-lg);">
              <h3 style="font-size: 16px; margin-bottom: var(--spacing-md);">📦 Plugins Instalados (${plugins.length})</h3>
              <div id="installed-plugins-list" style="max-height: 200px; overflow-y: auto; border: 1px solid var(--theme-border-color); border-radius: var(--border-radius); padding: var(--spacing-sm);">
                ${this.renderPluginsList(plugins)}
              </div>
            </div>

            <hr style="border: none; border-top: 1px solid var(--theme-border-color); margin: var(--spacing-lg) 0;">

            <div>
              <h3 style="font-size: 16px; margin-bottom: var(--spacing-md);">➕ Instalar Novo Plugin</h3>

              <div class="plugin-install-tabs" style="display: flex; gap: var(--spacing-xs); margin-bottom: var(--spacing-md);">
                <button class="plugin-install-tab active" data-install-tab="url" style="padding: var(--spacing-xs) var(--spacing-sm); background: var(--theme-bg-tertiary); border: 1px solid var(--theme-border-color); border-radius: var(--border-radius); cursor: pointer; font-size: 12px;">URL</button>
                <button class="plugin-install-tab" data-install-tab="file" style="padding: var(--spacing-xs) var(--spacing-sm); background: var(--theme-bg-secondary); border: 1px solid var(--theme-border-color); border-radius: var(--border-radius); cursor: pointer; font-size: 12px;">Arquivo</button>
                <button class="plugin-install-tab" data-install-tab="code" style="padding: var(--spacing-xs) var(--spacing-sm); background: var(--theme-bg-secondary); border: 1px solid var(--theme-border-color); border-radius: var(--border-radius); cursor: pointer; font-size: 12px;">Código</button>
              </div>

              <!-- URL Input -->
              <div class="plugin-install-content" data-install-content="url">
                <div class="form-group">
                  <label for="plugin-url-input">URL do plugin (.js):</label>
                  <input type="text" id="plugin-url-input" class="form-control" placeholder="https://exemplo.com/meu-plugin.js">
                  <small style="color: var(--theme-text-tertiary); font-size: 12px;">O plugin será carregado via CORS ou proxy interno</small>
                </div>
                <button id="btn-install-from-url" class="btn btn-primary" style="width: 100%;">Instalar da URL</button>
              </div>

              <!-- File Input -->
              <div class="plugin-install-content hidden" data-install-content="file">
                <div class="form-group">
                  <label for="plugin-file-input">Selecione o arquivo .js:</label>
                  <input type="file" id="plugin-file-input" class="form-control" accept=".js">
                  <small style="color: var(--theme-text-tertiary); font-size: 12px;">O arquivo será lido e executado localmente</small>
                </div>
                <button id="btn-install-from-file" class="btn btn-primary" style="width: 100%;">Instalar do Arquivo</button>
              </div>

              <!-- Code Input -->
              <div class="plugin-install-content hidden" data-install-content="code">
                <div class="form-group">
                  <label for="plugin-code-input">Cole o código do plugin:</label>
                  <textarea id="plugin-code-input" class="form-control" rows="6" placeholder="// Código do plugin
class MeuPlugin {
  manifest = {
    id: 'meu-plugin',
    name: 'Meu Plugin',
    version: '1.0.0',
    ...
  };
  async init(context) {
    // Sua lógica aqui
  }
}" style="font-family: var(--font-mono); font-size: 12px;"></textarea>
                  <small style="color: var(--theme-text-tertiary); font-size: 12px;">Cole o código JavaScript completo do plugin</small>
                </div>
                <button id="btn-install-from-code" class="btn btn-primary" style="width: 100%;">Instalar do Código</button>
              </div>
            </div>
          </div>

          <div class="modal-actions" style="border-top: 1px solid var(--theme-border-color); padding: var(--spacing-lg);">
            <button class="btn" id="settings-modal-cancel">Fechar</button>
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
      // Settings tabs switching
      document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
          const targetTab = (e.target as HTMLElement).dataset.tab;
          if (!targetTab) return;

          // Update active tab
          document.querySelectorAll('.settings-tab').forEach(t => {
            t.classList.remove('active');
            (t as HTMLElement).style.borderBottomColor = 'transparent';
            (t as HTMLElement).style.color = 'var(--theme-text-secondary)';
          });
          (e.target as HTMLElement).classList.add('active');
          (e.target as HTMLElement).style.borderBottomColor = 'var(--theme-color-primary)';
          (e.target as HTMLElement).style.color = 'var(--theme-color-primary)';

          // Show corresponding content
          document.querySelectorAll('.settings-tab-content').forEach(c => {
            const content = c as HTMLElement;
            if (content.dataset.content === targetTab) {
              content.classList.remove('hidden');
            } else {
              content.classList.add('hidden');
            }
          });
        });
      });

      // Plugin install tabs switching
      document.querySelectorAll('.plugin-install-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
          const targetTab = (e.target as HTMLElement).dataset.installTab;
          if (!targetTab) return;

          // Update active tab
          document.querySelectorAll('.plugin-install-tab').forEach(t => {
            t.classList.remove('active');
            (t as HTMLElement).style.background = 'var(--theme-bg-secondary)';
          });
          (e.target as HTMLElement).classList.add('active');
          (e.target as HTMLElement).style.background = 'var(--theme-bg-tertiary)';

          // Show corresponding content
          document.querySelectorAll('.plugin-install-content').forEach(c => {
            const content = c as HTMLElement;
            if (content.dataset.installContent === targetTab) {
              content.classList.remove('hidden');
            } else {
              content.classList.add('hidden');
            }
          });
        });
      });

      // Plugin installation buttons
      document.getElementById('btn-install-from-url')?.addEventListener('click', async () => {
        await this.installPluginFromURL();
      });

      document.getElementById('btn-install-from-file')?.addEventListener('click', async () => {
        await this.installPluginFromFile();
      });

      document.getElementById('btn-install-from-code')?.addEventListener('click', async () => {
        await this.installPluginFromCode();
      });

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

  public refreshPluginCount(): void {
    const count = kernel['pluginHost'].getLoadedPlugins().length;
    const element = document.querySelector('.status-plugins');
    if (element) {
      element.textContent = `Plugins: ${count}`;
    }
  }
}