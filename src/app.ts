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
            <button id="btn-settings" class="btn">⚙️</button>
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
                <button class="ribbon-btn">
                  <span class="ribbon-icon"><b>N</b></span>
                  <span class="ribbon-label">Negrito</span>
                </button>
                <button class="ribbon-btn">
                  <span class="ribbon-icon"><i>I</i></span>
                  <span class="ribbon-label">Itálico</span>
                </button>
                <button class="ribbon-btn">
                  <span class="ribbon-icon">🎨</span>
                  <span class="ribbon-label">Cor</span>
                </button>
              </div>
            </div>

            <div class="ribbon-group">
              <div class="ribbon-group-title">Alinhamento</div>
              <div class="ribbon-buttons">
                <button class="ribbon-btn">
                  <span class="ribbon-icon">⬅️</span>
                  <span class="ribbon-label">Esquerda</span>
                </button>
                <button class="ribbon-btn">
                  <span class="ribbon-icon">↔️</span>
                  <span class="ribbon-label">Centro</span>
                </button>
                <button class="ribbon-btn">
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
                <button id="btn-insert-chart" class="ribbon-btn">
                  <span class="ribbon-icon">📊</span>
                  <span class="ribbon-label">Gráfico</span>
                </button>
                <button id="btn-insert-pivot" class="ribbon-btn">
                  <span class="ribbon-icon">🔄</span>
                  <span class="ribbon-label">Tabela Dinâmica</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Formulas Tab Content -->
          <div class="ribbon-content hidden" data-content="formulas">
            <div class="ribbon-group">
              <div class="ribbon-group-title">Biblioteca de Funções</div>
              <div class="ribbon-buttons">
                <button class="ribbon-btn">
                  <span class="ribbon-icon">Σ</span>
                  <span class="ribbon-label">AutoSoma</span>
                </button>
                <button class="ribbon-btn">
                  <span class="ribbon-icon">📐</span>
                  <span class="ribbon-label">Matemática</span>
                </button>
                <button class="ribbon-btn">
                  <span class="ribbon-icon">📊</span>
                  <span class="ribbon-label">Estatística</span>
                </button>
                <button class="ribbon-btn">
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
              <div class="ribbon-group-title">Exibir</div>
              <div class="ribbon-buttons">
                <button class="ribbon-btn">
                  <span class="ribbon-icon">📏</span>
                  <span class="ribbon-label">Régua</span>
                </button>
                <button class="ribbon-btn">
                  <span class="ribbon-icon">🔲</span>
                  <span class="ribbon-label">Linhas de Grade</span>
                </button>
                <button class="ribbon-btn">
                  <span class="ribbon-icon">🔍</span>
                  <span class="ribbon-label">Zoom</span>
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
      
      // Trigger recalculation if formula
      if (sheet && String(value).startsWith('=')) {
        await kernel.recalculate(sheet.id);
        this.grid?.refresh();
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
        const wb = kernel.createWorkbook(name);
        wb.addSheet("Sheet1");
        this.refreshUI();
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
  }
  
  private async commitFormulaBarValue(): Promise<void> {
    const formulaInput = document.getElementById('formula-input') as HTMLInputElement;
    if (!formulaInput || !this.grid) return;
    
    const value = formulaInput.value;
    const selection = this.grid.getSelection();
    const sheet = this.grid.getSheet();
    
    if (!sheet) return;
    
    // Set cell value
    if (value.startsWith('=')) {
      // Set formula with 0 as initial value - CalcEngine will compute it
      sheet.setCell(selection.start.row, selection.start.col, 0, {
        formula: value,
        type: 'formula',
      });

      // Recalculate
      await kernel.recalculate(sheet.id);
    } else {
      sheet.setCell(selection.start.row, selection.start.col, value);
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
