/**
 * DJ DataForge v6 - Application Entry Point (FULL VERSION)
 * 
 * Todas as fases implementadas:
 * - Fase 1: Foundation ✅
 * - Fase 2-3: I/O & Transform ✅
 * - Fase 4: Virtual Grid ✅
 * - Fase 5: Plugin System ✅
 * - Fase 6-7: Polish & Multi-Company ✅
 */

import { kernel } from './@core/kernel';
import { logger } from './@core/storage-utils-consolidated';
import { VirtualGrid } from './@core/grid-virtual-consolidated';
import { FileReader, FileWriter } from './@core/io-transform-consolidated';
import { FXPackPlugin, ChartsPlugin, PivotPlugin } from './@core/plugin-system-consolidated';
import './style.css';

// ============================================================================
// APP INITIALIZATION
// ============================================================================

class DJDataForgeApp {
  private grid?: VirtualGrid;
  private refreshTimeout?: number;
  
  async init(): Promise<void> {
    try {
      logger.info("[App] Starting DJ DataForge v6 FULL...");

      // Show loading screen
      this.showLoading();

      // Initialize kernel
      await kernel.init();

      // Initialize UI first so plugin-toolbar element exists
      await this.initUI();

      // Load built-in plugins after UI is ready
      await this.loadBuiltInPlugins();

      // Hide loading screen
      this.hideLoading();

      // Setup global error handler
      this.setupErrorHandler();

      logger.info("[App] Application ready - ALL PHASES COMPLETE!");
    } catch (error) {
      logger.error("[App] Initialization failed", error);
      this.showError("Falha ao inicializar aplicação. Veja o console para detalhes.");
    }
  }
  
  private showLoading(): void {
    const app = document.getElementById('app');
    if (app) {
      app.innerHTML = `
        <div class="loading-screen">
          <div class="loading-spinner"></div>
          <h2>🔧 DJ DataForge v6</h2>
          <p>Carregando todas as funcionalidades...</p>
          <div style="margin-top: 20px; font-size: 12px; color: #64748b;">
            <div>✅ Kernel & Storage</div>
            <div>✅ Calc Engine (20+ fórmulas)</div>
            <div>✅ Virtual Grid</div>
            <div>✅ Plugin System</div>
            <div>✅ Multi-Company</div>
          </div>
        </div>
      `;
    }
  }
  
  private hideLoading(): void {
    const loading = document.querySelector('.loading-screen');
    if (loading) {
      loading.classList.add('fade-out');
      setTimeout(() => loading.remove(), 300);
    }
  }
  
  private async loadBuiltInPlugins(): Promise<void> {
    try {
      // Load FX Pack
      await kernel['pluginHost'].loadPlugin(
        { default: FXPackPlugin },
        new FXPackPlugin().manifest
      );
      
      // Load Charts
      await kernel['pluginHost'].loadPlugin(
        { default: ChartsPlugin },
        new ChartsPlugin().manifest
      );
      
      // Load Pivot
      await kernel['pluginHost'].loadPlugin(
        { default: PivotPlugin },
        new PivotPlugin().manifest
      );
      
      logger.info('[App] Built-in plugins loaded');
    } catch (error) {
      logger.error('[App] Failed to load plugins', error);
    }
  }
  
  private async initUI(): Promise<void> {
    const app = document.getElementById('app');
    if (!app) throw new Error("App container not found");
    
    const company = kernel.companyManager.getActiveCompany();
    const workbooks = kernel.workbookManager.listWorkbooks();
    
    app.innerHTML = `
      <div class="app-container">
        <!-- Header -->
        <header class="app-header">
          <div class="header-left">
            <h1>🔧 DJ DataForge v6</h1>
            <span class="company-badge" id="company-badge">${company?.name || 'Sem empresa'}</span>
          </div>
          <div class="header-right">
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
          </div>

          <!-- Data Tab Content -->
          <div class="ribbon-content hidden" data-content="data">
            <div class="ribbon-group">
              <div class="ribbon-group-title">Ferramentas de Dados</div>
              <div class="ribbon-buttons">
                <button class="ribbon-btn">
                  <span class="ribbon-icon">🔍</span>
                  <span class="ribbon-label">Filtrar</span>
                </button>
                <button class="ribbon-btn">
                  <span class="ribbon-icon">↕️</span>
                  <span class="ribbon-label">Ordenar</span>
                </button>
                <button class="ribbon-btn">
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
            <canvas id="grid-canvas" class="grid-canvas" tabindex="0"></canvas>
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
    
    // Initialize virtual grid
    await this.initGrid();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Setup console logger
    this.setupConsoleLogger();
    
    // Setup kernel event listeners
    this.setupKernelEventListeners();
    
    // Update formula bar
    this.updateFormulaBar();
  }
  
  private renderWorkbookList(workbooks: any[]): string {
    if (workbooks.length === 0) {
      return '<p class="empty-state">Nenhum workbook<br>Clique em "Novo" para criar</p>';
    }
    
    return workbooks.map(wb => `
      <div class="workbook-item ${wb.id === kernel.workbookManager.getActiveWorkbook()?.id ? 'active' : ''}"
           data-workbook-id="${wb.id}">
        <span class="workbook-name">${wb.name}</span>
        <span class="workbook-sheets">${wb.sheets.size} sheets</span>
      </div>
    `).join('');
  }
  
  private renderSheetList(): string {
    const wb = kernel.workbookManager.getActiveWorkbook();
    if (!wb) return '<p class="empty-state">Selecione um workbook</p>';
    
    const sheets = wb.listSheets();
    return sheets.map(sheet => `
      <div class="sheet-item ${sheet.id === wb.activeSheetId ? 'active' : ''}"
           data-sheet-id="${sheet.id}">
        <span class="sheet-name">${sheet.name}</span>
        <span class="sheet-size">${sheet.rowCount}x${sheet.colCount}</span>
      </div>
    `).join('');
  }
  
  private async initGrid(): Promise<void> {
    const canvas = document.getElementById('grid-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    
    this.grid = new VirtualGrid(canvas);
    
    // Set initial sheet
    const wb = kernel.workbookManager.getActiveWorkbook();
    const sheet = wb?.getActiveSheet();
    
    if (sheet) {
      this.grid.setSheet(sheet);
    }
    
    // Handle cell changes
    this.grid.setCellChangeHandler(async (row, col, value) => {
      logger.debug('[App] Cell changed', { row, col, value });

      // Get current sheet (not captured variable - fixes sheet switching bug)
      const currentSheet = this.grid?.getSheet();

      // Always trigger recalculation after cell change
      // This ensures formulas that depend on this cell are updated
      if (currentSheet) {
        try {
          const result = await kernel.recalculate(currentSheet.id, undefined, { force: true });
          logger.debug('[App] Recalculated', { cellsRecalc: result.cellsRecalc });

          // Force multiple refreshes to ensure formulas are updated
          this.grid?.refresh();
          setTimeout(() => this.grid?.refresh(), 50);
          setTimeout(() => this.grid?.refresh(), 100);
        } catch (error) {
          logger.error('[App] Recalculation failed', error);
        }
      }

      this.updateCellInfo(row, col);
    });
    
    // Handle selection changes
    this.grid.setSelectionChangeHandler((selection) => {
      this.updateNameBox(selection);
      this.updateCellInfo(selection.start.row, selection.start.col);
    });
    
    logger.info('[App] Virtual grid initialized');
  }
  
  private setupEventListeners(): void {
    // Ribbon tabs
    document.querySelectorAll('.ribbon-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const tabName = target.getAttribute('data-tab');
        if (!tabName) return;

        // Remove active class from all tabs and contents
        document.querySelectorAll('.ribbon-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.ribbon-content').forEach(c => c.classList.add('hidden'));

        // Add active class to clicked tab and show corresponding content
        target.classList.add('active');
        const content = document.querySelector(`[data-content="${tabName}"]`);
        if (content) {
          content.classList.remove('hidden');
        }
      });
    });

    // New workbook button
    document.getElementById('btn-new-workbook')?.addEventListener('click', () => {
      const name = prompt("Nome do workbook:", "Novo Workbook");
      if (name) {
        kernel.createWorkbook(name);
        // Don't call refreshUI here - the 'workbook:created' event will trigger it
        // This prevents duplicate rendering
      }
    });
    
    // Import button
    document.getElementById('btn-import')?.addEventListener('click', () => {
      const input = document.getElementById('file-input') as HTMLInputElement;
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        
        try {
          const data = await FileReader.readAuto(file);
          await this.importData(data);
        } catch (error) {
          logger.error('[App] Import failed', error);
          alert('Falha ao importar arquivo');
        }
      };
      input.click();
    });
    
    // Export button
    document.getElementById('btn-export')?.addEventListener('click', () => {
      this.showExportDialog();
    });
    
    // Settings button
    document.getElementById('btn-settings')?.addEventListener('click', () => {
      this.showSettingsDialog();
    });

    // Clear session button
    document.getElementById('btn-clear-session')?.addEventListener('click', () => {
      this.clearSession();
    });

    // View tab buttons
    document.getElementById('btn-toggle-sidebar')?.addEventListener('click', () => this.toggleSidebar());
    document.getElementById('btn-toggle-right-panel')?.addEventListener('click', () => this.toggleRightPanel());
    document.getElementById('btn-toggle-formula-bar')?.addEventListener('click', () => this.toggleFormulaBar());
    document.getElementById('btn-toggle-gridlines')?.addEventListener('click', () => this.toggleGridlines());
    document.getElementById('btn-zoom-in')?.addEventListener('click', () => this.zoom(1.2));
    document.getElementById('btn-zoom-out')?.addEventListener('click', () => this.zoom(0.8));
    document.getElementById('btn-zoom-reset')?.addEventListener('click', () => this.zoom(1, true));
    
    // Formula input
    const formulaInput = document.getElementById('formula-input') as HTMLInputElement;
    formulaInput?.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        await this.commitFormulaBarValue();
      }
    });
    
    // Workbook list items
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const workbookItem = target.closest('.workbook-item');

      if (workbookItem) {
        const workbookId = workbookItem.getAttribute('data-workbook-id');
        if (workbookId) {
          kernel.workbookManager.setActiveWorkbook(workbookId);
          kernel.sessionManager.setActiveWorkbook(workbookId);
          this.refreshUI();
        }
      }

      const sheetItem = target.closest('.sheet-item');
      if (sheetItem) {
        const sheetId = sheetItem.getAttribute('data-sheet-id');
        const wb = kernel.workbookManager.getActiveWorkbook();
        if (sheetId && wb) {
          wb.setActiveSheet(sheetId);
          const sheet = wb.getActiveSheet();
          if (sheet && this.grid) {
            this.grid.setSheet(sheet);
          }
          this.refreshUI();
        }
      }
    });

    // Context menu for workbooks and sheets
    document.addEventListener('contextmenu', (e) => {
      const target = e.target as HTMLElement;
      const workbookItem = target.closest('.workbook-item');
      const sheetItem = target.closest('.sheet-item');

      if (workbookItem || sheetItem) {
        e.preventDefault();
        this.showContextMenu(e.clientX, e.clientY, workbookItem, sheetItem);
      }
    });

    // Formatting buttons
    document.getElementById('btn-bold')?.addEventListener('click', () => this.applyFormatting('bold'));
    document.getElementById('btn-italic')?.addEventListener('click', () => this.applyFormatting('italic'));
    document.getElementById('btn-color')?.addEventListener('click', () => this.applyTextColor());

    // Alignment buttons
    document.getElementById('btn-align-left')?.addEventListener('click', () => this.applyAlignment('left'));
    document.getElementById('btn-align-center')?.addEventListener('click', () => this.applyAlignment('center'));
    document.getElementById('btn-align-right')?.addEventListener('click', () => this.applyAlignment('right'));

    // Formula buttons
    document.getElementById('btn-autosum')?.addEventListener('click', () => this.insertAutoSum());
    document.getElementById('btn-math-functions')?.addEventListener('click', () => this.showFunctionList('math'));
    document.getElementById('btn-stats-functions')?.addEventListener('click', () => this.showFunctionList('stats'));
    document.getElementById('btn-financial-functions')?.addEventListener('click', () => this.showFunctionList('financial'));
  }

  private async importData(data: any[][]): Promise<void> {
    const wb = kernel.workbookManager.getActiveWorkbook();
    if (!wb) {
      logger.warn('[App] No active workbook');
      return;
    }
    
    const sheet = wb.getActiveSheet();
    if (!sheet) {
      logger.warn('[App] No active sheet');
      return;
    }
    
    // Import data
    sheet.setRange(0, 0, data);
    
    if (this.grid) {
      this.grid.refresh();
    }
    
    logger.info('[App] Data imported', { rows: data.length, cols: data[0]?.length });
  }
  
  private showExportDialog(): void {
    const format = prompt("Formato (csv/xlsx/json):", "xlsx");
    if (!format) return;
    
    const wb = kernel.workbookManager.getActiveWorkbook();
    const sheet = wb?.getActiveSheet();
    
    if (!sheet) {
      alert('Nenhuma planilha ativa');
      return;
    }
    
    try {
      let blob: Blob;
      let filename: string;
      
      switch (format.toLowerCase()) {
        case 'csv':
          blob = FileWriter.exportCSV(sheet);
          filename = `${wb?.name || 'export'}.csv`;
          break;
        case 'xlsx':
          if (!wb) return;
          blob = FileWriter.exportXLSX(wb);
          filename = `${wb.name}.xlsx`;
          break;
        case 'json':
          blob = FileWriter.exportJSON(sheet);
          filename = `${wb?.name || 'export'}.json`;
          break;
        default:
          alert('Formato inválido');
          return;
      }
      
      FileWriter.download(blob, filename);
      logger.info('[App] File exported', { format, filename });
    } catch (error) {
      logger.error('[App] Export failed', error);
      alert('Falha ao exportar');
    }
  }
  
  private showSettingsDialog(): void {
    const companies = kernel.companyManager.listCompanies();
    const activeCompany = kernel.companyManager.getActiveCompany();
    
    const html = `
      <div class="modal-overlay" id="settings-modal">
        <div class="modal">
          <h2>⚙️ Configurações</h2>
          
          <div class="form-group">
            <label>Empresa Ativa:</label>
            <select id="company-select" class="form-control">
              ${companies.map(c => `
                <option value="${c.id}" ${c.id === activeCompany?.id ? 'selected' : ''}>
                  ${c.name}
                </option>
              `).join('')}
            </select>
          </div>
          
          <div class="form-group">
            <button id="btn-new-company" class="btn">➕ Nova Empresa</button>
          </div>
          
          <hr>
          
          <div class="form-group">
            <h3>Plugins Carregados:</h3>
            <ul>
              ${kernel['pluginHost'].getLoadedPlugins().map(p => `
                <li>${p.name} v${p.version}</li>
              `).join('')}
            </ul>
            <button id="btn-import-plugin" class="btn">📦 Importar Plugin</button>
            <input type="file" id="plugin-file-input" accept=".js" style="display: none;" />
          </div>

          <div class="modal-actions">
            <button id="btn-close-settings" class="btn btn-primary">Fechar</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', html);
    
    // Event listeners
    document.getElementById('btn-close-settings')?.addEventListener('click', () => {
      document.getElementById('settings-modal')?.remove();
    });
    
    document.getElementById('company-select')?.addEventListener('change', async (e) => {
      const companyId = (e.target as HTMLSelectElement).value;
      await kernel.companyManager.setActiveCompany(companyId);
      this.refreshUI();
    });
    
    document.getElementById('btn-new-company')?.addEventListener('click', async () => {
      const name = prompt('Nome da nova empresa:');
      if (name) {
        await kernel.companyManager.createCompany(name);
        this.refreshUI();
        document.getElementById('settings-modal')?.remove();
      }
    });

    // Import plugin button
    document.getElementById('btn-import-plugin')?.addEventListener('click', () => {
      const input = document.getElementById('plugin-file-input') as HTMLInputElement;
      input?.click();
    });

    document.getElementById('plugin-file-input')?.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      // Security and validation checks
      try {
        // Validate file type
        if (!file.name.endsWith('.js')) {
          throw new Error('Arquivo deve ter extensão .js');
        }

        // Limit file size to 5MB to prevent memory issues
        const MAX_SIZE = 5 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
          throw new Error('Arquivo muito grande (máximo 5MB)');
        }

        const text = await file.text();

        // SECURITY NOTE: Using Blob URLs for plugin loading
        // - Blob URLs are local and don't involve CORS
        // - No network requests or cross-origin issues
        // - URL is revoked after use to prevent memory leaks
        // WARNING: Only load plugins from trusted sources!
        const blob = new Blob([text], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);

        try {
          // Dynamic import of the plugin (Vite ignore for blob URLs)
          const module = await import(/* @vite-ignore */ url);

          // Get the plugin class (usually default export)
          const PluginClass = module.default || module.Plugin;

          if (!PluginClass) {
            throw new Error('Plugin deve exportar uma classe como default export');
          }

          // Create instance and validate manifest
          const pluginInstance = new PluginClass();

          if (!pluginInstance.manifest) {
            throw new Error('Plugin deve ter um manifest');
          }

          // Validate manifest structure
          if (!pluginInstance.manifest.name || !pluginInstance.manifest.version) {
            throw new Error('Manifest deve conter name e version');
          }

          // Load the plugin
          await kernel['pluginHost'].loadPlugin(module, pluginInstance.manifest);

          logger.info('[App] Plugin imported successfully', { name: pluginInstance.manifest.name });
          alert(`✅ Plugin "${pluginInstance.manifest.name}" importado com sucesso!`);

          // Refresh the settings dialog
          document.getElementById('settings-modal')?.remove();
          this.showSettingsDialog();

        } finally {
          // Always revoke the blob URL to prevent memory leaks
          URL.revokeObjectURL(url);
        }

      } catch (error) {
        logger.error('[App] Failed to import plugin', error);
        alert(`❌ Erro ao importar plugin: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      }

      // Clear input to allow re-importing the same file
      (e.target as HTMLInputElement).value = '';
    });
  }
  
  private async commitFormulaBarValue(): Promise<void> {
    const formulaInput = document.getElementById('formula-input') as HTMLInputElement;
    if (!formulaInput || !this.grid) return;
    
    const value = formulaInput.value;
    const selection = this.grid.getSelection();
    const sheet = this.grid.getSheet();
    
    if (!sheet) return;
    
    // Set cell value
    const trimmedValue = value.trim();
    if (trimmedValue.startsWith('=')) {
      // Set formula with 0 as initial value - CalcEngine will compute it
      sheet.setCell(selection.start.row, selection.start.col, 0, {
        formula: trimmedValue,
        type: 'formula',
      });

      // Recalculate with force to ensure immediate update
      try {
        await kernel.recalculate(sheet.id, undefined, { force: true });
        logger.debug('[App] Formula recalculated from formula bar');
      } catch (error) {
        logger.error('[App] Formula recalculation failed', error);
      }
    } else {
      const numValue = parseFloat(trimmedValue);
      if (!isNaN(numValue) && trimmedValue !== '') {
        sheet.setCell(selection.start.row, selection.start.col, numValue);
      } else {
        sheet.setCell(selection.start.row, selection.start.col, trimmedValue);
      }
    }

    this.grid.refresh();
    this.updateCellInfo(selection.start.row, selection.start.col);
  }
  
  private updateFormulaBar(): void {
    if (!this.grid) return;
    
    const selection = this.grid.getSelection();
    const sheet = this.grid.getSheet();
    
    if (!sheet) return;
    
    const cell = sheet.getCell(selection.start.row, selection.start.col);
    const value = cell?.formula || cell?.value || '';
    
    const formulaInput = document.getElementById('formula-input') as HTMLInputElement;
    if (formulaInput) {
      formulaInput.value = String(value);
    }
  }
  
  private updateNameBox(selection: any): void {
    const nameBox = document.getElementById('name-box');
    if (!nameBox || !this.grid) return;
    
    const sheet = this.grid.getSheet();
    if (!sheet) return;
    
    const start = `${sheet.getColumnName(selection.start.col)}${selection.start.row + 1}`;
    const end = `${sheet.getColumnName(selection.end.col)}${selection.end.row + 1}`;
    
    nameBox.textContent = start === end ? start : `${start}:${end}`;
  }
  
  private updateCellInfo(row: number, col: number): void {
    if (!this.grid) return;
    
    const sheet = this.grid.getSheet();
    if (!sheet) return;
    
    const cell = sheet.getCell(row, col);
    
    document.getElementById('info-cell')!.textContent = `${sheet.getColumnName(col)}${row + 1}`;
    document.getElementById('info-value')!.textContent = String(cell?.value ?? '-');
    document.getElementById('info-formula')!.textContent = cell?.formula || '-';
    document.getElementById('info-type')!.textContent = cell?.type || '-';
    
    this.updateFormulaBar();
  }
  
  private setupConsoleLogger(): void {
    const consoleEl = document.getElementById('console-logs');
    if (!consoleEl) return;
    
    // Display last 20 log entries
    const logs = logger.getHistory().slice(-20);
    
    consoleEl.innerHTML = logs.map(log => {
      const levelClass = `log-${log.level}`;
      const time = new Date(log.timestamp).toLocaleTimeString('pt-BR');
      return `
        <div class="log-entry ${levelClass}">
          <span class="log-time">${time}</span>
          <span class="log-source">${log.source}</span>
          <span class="log-message">${log.message}</span>
        </div>
      `;
    }).join('');
    
    // Auto-scroll to bottom
    consoleEl.scrollTop = consoleEl.scrollHeight;
  }
  
  private setupKernelEventListeners(): void {
    // Listen to workbook created
    kernel.eventBus.on('workbook:created', () => {
      this.refreshUI();
    });
    
    // Listen to recalc done
    kernel.eventBus.on('kernel:recalc-done', () => {
      this.grid?.refresh();
      this.setupConsoleLogger();
    });
    
    // Listen to auto-save
    kernel.eventBus.on('kernel:autosave-done', () => {
      this.setupConsoleLogger();
    });
  }
  
  private refreshUI(): void {
    // Debounce to prevent duplicate rapid refreshes
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }

    this.refreshTimeout = window.setTimeout(() => {
      // Update workbook list
      const workbookList = document.getElementById('workbook-list');
      if (workbookList) {
        workbookList.innerHTML = this.renderWorkbookList(kernel.workbookManager.listWorkbooks());
      }

      // Update sheet list
      const sheetList = document.getElementById('sheet-list');
      if (sheetList) {
        sheetList.innerHTML = this.renderSheetList();
      }

      // Update company badge
      const company = kernel.companyManager.getActiveCompany();
      const companyBadge = document.getElementById('company-badge');
      if (companyBadge) {
        companyBadge.textContent = company?.name || 'Sem empresa';
      }

      // Update grid
      const wb = kernel.workbookManager.getActiveWorkbook();
      const sheet = wb?.getActiveSheet();
      if (sheet && this.grid) {
        this.grid.setSheet(sheet);
      }

      // Update console
      this.setupConsoleLogger();

      this.refreshTimeout = undefined;
    }, 10); // 10ms debounce
  }
  
  private setupErrorHandler(): void {
    window.addEventListener('error', (event) => {
      logger.error('[App] Uncaught error', event.error);
    });
    
    window.addEventListener('unhandledrejection', (event) => {
      logger.error('[App] Unhandled promise rejection', event.reason);
    });
  }
  
  private showError(message: string): void {
    const app = document.getElementById('app');
    if (app) {
      app.innerHTML = `
        <div class="error-screen">
          <h2>❌ Erro</h2>
          <p>${message}</p>
          <button onclick="location.reload()">Recarregar</button>
        </div>
      `;
    }
  }

  // ============================================================================
  // RIBBON FUNCTIONALITY METHODS
  // ============================================================================

  private applyFormatting(type: 'bold' | 'italic'): void {
    if (!this.grid) return;

    const selection = this.grid.getSelection();
    const sheet = this.grid.getSheet();
    if (!sheet) return;

    // Apply formatting to all cells in selection
    for (let row = selection.start.row; row <= selection.end.row; row++) {
      for (let col = selection.start.col; col <= selection.end.col; col++) {
        const cell = sheet.getCell(row, col);
        const currentFormat = cell?.format || {};

        // Toggle the formatting
        const newFormat = {
          ...currentFormat,
          [type]: !currentFormat[type]
        };

        sheet.setCell(row, col, cell?.value ?? '', {
          ...cell,
          format: newFormat
        });
      }
    }

    this.grid.refresh();
    logger.info(`[App] Applied ${type} formatting to selection`);
  }

  private applyTextColor(): void {
    if (!this.grid) return;

    const selection = this.grid.getSelection();
    const sheet = this.grid.getSheet();
    if (!sheet) return;

    // Show color picker dialog
    const color = prompt('Cor do texto (ex: #FF0000, red, rgb(255,0,0)):', '#000000');
    if (!color) return;

    // Apply color to all cells in selection
    for (let row = selection.start.row; row <= selection.end.row; row++) {
      for (let col = selection.start.col; col <= selection.end.col; col++) {
        const cell = sheet.getCell(row, col);
        const currentFormat = cell?.format || {};

        const newFormat = {
          ...currentFormat,
          textColor: color
        };

        sheet.setCell(row, col, cell?.value ?? '', {
          ...cell,
          format: newFormat
        });
      }
    }

    this.grid.refresh();
    logger.info(`[App] Applied text color ${color} to selection`);
  }

  private applyAlignment(alignment: 'left' | 'center' | 'right'): void {
    if (!this.grid) return;

    const selection = this.grid.getSelection();
    const sheet = this.grid.getSheet();
    if (!sheet) return;

    // Apply alignment to all cells in selection
    for (let row = selection.start.row; row <= selection.end.row; row++) {
      for (let col = selection.start.col; col <= selection.end.col; col++) {
        const cell = sheet.getCell(row, col);
        const currentFormat = cell?.format || {};

        const newFormat = {
          ...currentFormat,
          alignment: alignment
        };

        sheet.setCell(row, col, cell?.value ?? '', {
          ...cell,
          format: newFormat
        });
      }
    }

    this.grid.refresh();
    logger.info(`[App] Applied ${alignment} alignment to selection`);
  }

  private insertAutoSum(): void {
    if (!this.grid) return;

    const selection = this.grid.getSelection();
    const sheet = this.grid.getSheet();
    if (!sheet) return;

    const row = selection.start.row;
    const col = selection.start.col;

    // Auto-detect range to sum
    let range = '';

    // Try to detect range above (most common case)
    let rangeAbove = 0;
    for (let r = row - 1; r >= 0; r--) {
      const cell = sheet.getCell(r, col);
      if (cell && typeof cell.value === 'number') {
        rangeAbove++;
      } else {
        break;
      }
    }

    // Try to detect range to the left
    let rangeLeft = 0;
    for (let c = col - 1; c >= 0; c--) {
      const cell = sheet.getCell(row, c);
      if (cell && typeof cell.value === 'number') {
        rangeLeft++;
      } else {
        break;
      }
    }

    // Use the larger range
    if (rangeAbove > rangeLeft && rangeAbove > 0) {
      const startCell = `${sheet.getColumnName(col)}${row - rangeAbove + 1}`;
      const endCell = `${sheet.getColumnName(col)}${row}`;
      range = `${startCell}:${endCell}`;
    } else if (rangeLeft > 0) {
      const startCell = `${sheet.getColumnName(col - rangeLeft)}${row + 1}`;
      const endCell = `${sheet.getColumnName(col - 1)}${row + 1}`;
      range = `${startCell}:${endCell}`;
    }

    // If no range detected, show a default formula
    const formula = range ? `=SOMA(${range})` : '=SOMA(A1:A10)';

    // Set the formula
    sheet.setCell(row, col, 0, {
      formula: formula,
      type: 'formula',
    });

    // Recalculate
    kernel.recalculate(sheet.id, undefined, { force: true }).then(() => {
      this.grid?.refresh();
      this.updateCellInfo(row, col);
    });

    logger.info(`[App] Inserted AutoSum: ${formula}`);
  }

  private showFunctionList(category: 'math' | 'stats' | 'financial'): void {
    // Define function lists by category - Using correct Portuguese syntax
    const functions: Record<string, { name: string; description: string; syntax: string }[]> = {
      math: [
        { name: 'SOMA', description: 'Soma valores', syntax: '=SOMA(A1:A10)' },
        { name: 'MULT', description: 'Multiplica valores', syntax: '=MULT(A1:A10)' },
        { name: 'RAIZ', description: 'Raiz quadrada', syntax: '=RAIZ(A1)' },
        { name: 'POTÊNCIA', description: 'Eleva à potência', syntax: '=POTÊNCIA(A1; 2)' },
        { name: 'ABS', description: 'Valor absoluto', syntax: '=ABS(A1)' },
        { name: 'TRUNCAR', description: 'Trunca decimais', syntax: '=TRUNCAR(A1; 2)' },
        { name: 'ARREDONDAR', description: 'Arredonda número', syntax: '=ARREDONDAR(A1; 2)' },
        { name: 'INT', description: 'Parte inteira', syntax: '=INT(A1)' },
        { name: 'CONCATENAR', description: 'Junta textos', syntax: '=CONCATENAR(A1; A2)' },
      ],
      stats: [
        { name: 'MÉDIA', description: 'Média aritmética', syntax: '=MÉDIA(A1:A10)' },
        { name: 'MED', description: 'Mediana', syntax: '=MED(A1:A10)' },
        { name: 'MODO', description: 'Valor mais frequente', syntax: '=MODO(A1:A10)' },
        { name: 'MÁXIMO', description: 'Valor máximo', syntax: '=MÁXIMO(A1:A10)' },
        { name: 'MÍNIMO', description: 'Valor mínimo', syntax: '=MÍNIMO(A1:A10)' },
        { name: 'CONT.NÚM', description: 'Conta números', syntax: '=CONT.NÚM(A1:A10)' },
        { name: 'CONT.VALORES', description: 'Conta valores', syntax: '=CONT.VALORES(A1:A10)' },
        { name: 'DESVPAD', description: 'Desvio padrão', syntax: '=DESVPAD(A1:A10)' },
        { name: 'VAR', description: 'Variância', syntax: '=VAR(A1:A10)' },
      ],
      financial: [
        { name: 'VP', description: 'Valor presente', syntax: '=VP(taxa; nper; pgto)' },
        { name: 'VF', description: 'Valor futuro', syntax: '=VF(taxa; nper; pgto)' },
        { name: 'PGTO', description: 'Pagamento', syntax: '=PGTO(taxa; nper; vp)' },
        { name: 'TAXA', description: 'Taxa de juros', syntax: '=TAXA(nper; pgto; vp)' },
        { name: 'NPER', description: 'Número de períodos', syntax: '=NPER(taxa; pgto; vp)' },
      ]
    };

    const categoryFunctions = functions[category] || [];

    // Create modal HTML
    const html = `
      <div class="modal-overlay" id="functions-modal">
        <div class="modal" style="max-width: 600px;">
          <h2>📚 Funções ${category === 'math' ? 'Matemáticas' : category === 'stats' ? 'Estatísticas' : 'Financeiras'}</h2>

          <div style="max-height: 400px; overflow-y: auto; margin: 20px 0;">
            ${categoryFunctions.map(fn => `
              <div class="function-item" style="padding: 12px; border-bottom: 1px solid #e2e8f0; cursor: pointer;"
                   data-syntax="${fn.syntax}">
                <div style="font-weight: bold; color: #2563eb; margin-bottom: 4px;">${fn.name}</div>
                <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">${fn.description}</div>
                <div style="font-family: monospace; font-size: 11px; color: #059669;">${fn.syntax}</div>
              </div>
            `).join('')}
          </div>

          <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px;">
            💡 Clique em uma função para inserir na célula selecionada
          </div>

          <div class="modal-actions">
            <button id="btn-close-functions" class="btn btn-primary">Fechar</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);

    // Event listener for closing
    document.getElementById('btn-close-functions')?.addEventListener('click', () => {
      document.getElementById('functions-modal')?.remove();
    });

    // Event listener for clicking on function items
    document.querySelectorAll('.function-item').forEach(item => {
      item.addEventListener('click', () => {
        const syntax = item.getAttribute('data-syntax');
        if (syntax && this.grid) {
          const selection = this.grid.getSelection();
          const sheet = this.grid.getSheet();

          if (sheet) {
            const row = selection.start.row;
            const col = selection.start.col;

            // Set the formula
            sheet.setCell(row, col, 0, {
              formula: syntax,
              type: 'formula',
            });

            // Recalculate
            kernel.recalculate(sheet.id, undefined, { force: true }).then(() => {
              this.grid?.refresh();
              this.updateCellInfo(row, col);
            });

            logger.info(`[App] Inserted function: ${syntax}`);
          }

          document.getElementById('functions-modal')?.remove();
        }
      });
    });

    logger.info(`[App] Showing ${category} functions list`);
  }

  // ============================================================================
  // UI UTILITIES
  // ============================================================================

  private toggleSidebar(): void {
    const sidebar = document.querySelector('.sidebar') as HTMLElement;
    if (!sidebar) return;

    if (sidebar.style.display === 'none') {
      sidebar.style.display = '';
      logger.info('[App] Sidebar shown');
    } else {
      sidebar.style.display = 'none';
      logger.info('[App] Sidebar hidden');
    }
    // ResizeObserver will handle grid resize automatically
  }

  private toggleRightPanel(): void {
    const panel = document.querySelector('.panels') as HTMLElement;
    if (!panel) return;

    if (panel.style.display === 'none') {
      panel.style.display = '';
      logger.info('[App] Right panel shown');
    } else {
      panel.style.display = 'none';
      logger.info('[App] Right panel hidden');
    }
    // ResizeObserver will handle grid resize automatically
  }

  private toggleFormulaBar(): void {
    const formulaBar = document.querySelector('.formula-bar') as HTMLElement;
    if (!formulaBar) return;

    if (formulaBar.style.display === 'none') {
      formulaBar.style.display = '';
      logger.info('[App] Formula bar shown');
    } else {
      formulaBar.style.display = 'none';
      logger.info('[App] Formula bar hidden');
    }
    // ResizeObserver will handle grid resize automatically
  }

  private toggleGridlines(): void {
    if (!this.grid) return;

    // Toggle gridlines rendering
    // This requires modifying the grid's render method
    // For now, we'll toggle the grid canvas border as a visual indicator
    const canvas = document.getElementById('grid-canvas') as HTMLCanvasElement;
    if (!canvas) return;

    const currentBorder = canvas.style.border;
    if (currentBorder && currentBorder !== 'none') {
      canvas.style.border = 'none';
      logger.info('[App] Gridlines hidden');
    } else {
      canvas.style.border = '1px solid #e2e8f0';
      logger.info('[App] Gridlines shown');
    }

    this.grid.refresh();
  }

  private currentZoom: number = 1;

  private zoom(factor: number, reset: boolean = false): void {
    const gridContainer = document.querySelector('.grid-container') as HTMLElement;
    if (!gridContainer) return;

    if (reset) {
      this.currentZoom = 1;
    } else {
      this.currentZoom *= factor;
      // Limit zoom between 50% and 200%
      this.currentZoom = Math.max(0.5, Math.min(2, this.currentZoom));
    }

    gridContainer.style.transform = `scale(${this.currentZoom})`;
    gridContainer.style.transformOrigin = 'top left';

    logger.info(`[App] Zoom set to ${Math.round(this.currentZoom * 100)}%`);
  }

  private clearSession(): void {
    const confirmed = confirm(
      '⚠️ Isso irá limpar TODOS os dados da sessão atual:\n\n' +
      '- Todos os workbooks serão removidos\n' +
      '- Todos os dados não salvos serão perdidos\n' +
      '- A página será recarregada\n\n' +
      'Tem certeza que deseja continuar?'
    );

    if (!confirmed) return;

    try {
      // Clear all storage
      localStorage.clear();
      sessionStorage.clear();

      logger.info('[App] Session data cleared');

      // Show success message
      alert('✅ Sessão limpa com sucesso! A página será recarregada.');

      // Reload page
      window.location.reload();
    } catch (error) {
      logger.error('[App] Failed to clear session', error);
      alert('❌ Erro ao limpar sessão. Veja o console para detalhes.');
    }
  }

  private showContextMenu(x: number, y: number, workbookItem?: Element | null, sheetItem?: Element | null): void {
    // Remove existing context menu
    document.getElementById('context-menu')?.remove();

    const menu = document.createElement('div');
    menu.id = 'context-menu';
    menu.style.position = 'fixed';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.style.backgroundColor = 'white';
    menu.style.border = '1px solid #cbd5e1';
    menu.style.borderRadius = '6px';
    menu.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
    menu.style.zIndex = '10000';
    menu.style.minWidth = '180px';
    menu.style.padding = '4px 0';

    if (workbookItem) {
      const workbookId = workbookItem.getAttribute('data-workbook-id');
      menu.innerHTML = `
        <div class="context-menu-item" data-action="delete-workbook" data-id="${workbookId}">
          <span style="color: #ef4444;">🗑️ Excluir Workbook</span>
        </div>
      `;
    } else if (sheetItem) {
      const sheetId = sheetItem.getAttribute('data-sheet-id');
      menu.innerHTML = `
        <div class="context-menu-item" data-action="delete-sheet" data-id="${sheetId}">
          <span style="color: #ef4444;">🗑️ Excluir Sheet</span>
        </div>
      `;
    }

    document.body.appendChild(menu);

    // Add styles for menu items
    const style = document.createElement('style');
    style.textContent = `
      .context-menu-item {
        padding: 8px 16px;
        cursor: pointer;
        font-size: 14px;
      }
      .context-menu-item:hover {
        background-color: #f1f5f9;
      }
    `;
    document.head.appendChild(style);

    // Handle menu item clicks
    menu.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const menuItem = target.closest('.context-menu-item') as HTMLElement;

      if (menuItem) {
        const action = menuItem.getAttribute('data-action');
        const id = menuItem.getAttribute('data-id');

        if (action === 'delete-workbook' && id) {
          this.deleteWorkbook(id);
        } else if (action === 'delete-sheet' && id) {
          this.deleteSheet(id);
        }
      }

      menu.remove();
    });

    // Close menu when clicking outside
    const closeMenu = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    };

    setTimeout(() => {
      document.addEventListener('click', closeMenu);
    }, 100);
  }

  private deleteWorkbook(workbookId: string): void {
    const wb = kernel.workbookManager['workbooks'].get(workbookId);
    if (!wb) return;

    const confirmed = confirm(`Tem certeza que deseja excluir o workbook "${wb.name}"?\n\nEsta ação não pode ser desfeita.`);
    if (!confirmed) return;

    kernel.workbookManager['workbooks'].delete(workbookId);

    // If this was the active workbook, switch to another
    if (kernel.workbookManager.getActiveWorkbook()?.id === workbookId) {
      const workbooks = kernel.workbookManager.listWorkbooks();
      if (workbooks.length > 0) {
        kernel.workbookManager.setActiveWorkbook(workbooks[0].id);
      }
    }

    this.refreshUI();
    logger.info('[App] Workbook deleted', { id: workbookId });
  }

  private deleteSheet(sheetId: string): void {
    const wb = kernel.workbookManager.getActiveWorkbook();
    if (!wb) return;

    const sheet = wb['sheets'].get(sheetId);
    if (!sheet) return;

    const sheetCount = wb.listSheets().length;
    if (sheetCount <= 1) {
      alert('Não é possível excluir a última sheet do workbook.');
      return;
    }

    const confirmed = confirm(`Tem certeza que deseja excluir a sheet "${sheet.name}"?\n\nEsta ação não pode ser desfeita.`);
    if (!confirmed) return;

    wb['sheets'].delete(sheetId);

    // If this was the active sheet, switch to another
    if (wb.activeSheetId === sheetId) {
      const sheets = wb.listSheets();
      if (sheets.length > 0) {
        wb.setActiveSheet(sheets[0].id);
        const newSheet = wb.getActiveSheet();
        if (newSheet && this.grid) {
          this.grid.setSheet(newSheet);
        }
      }
    }

    this.refreshUI();
    logger.info('[App] Sheet deleted', { id: sheetId });
  }
}

// ============================================================================
// START APPLICATION
// ============================================================================

const app = new DJDataForgeApp();
app.init();

// Expose to window for debugging
if (typeof window !== 'undefined') {
  (window as any).DJApp = app;
}
