/**
 * DJ DataForge v6 - Plugin System Consolidated
 * 
 * FUTURE SPLIT POINTS:
 * - plugin/host.ts (PluginHost)
 * - plugin/api.ts (PluginContext, APIs)
 * - plugin/loader.ts (Dynamic loading)
 * - plugin/security.ts (Permissions, sandbox)
 * - plugin/registry.ts (Plugin registry)
 */

import type { 
    PluginManifest, 
    PluginContext, 
    PluginPermission,
    PluginStorageAPI,
    PluginUIAPI,
    PluginEventAPI,
    ToolbarButtonConfig,
    PanelConfig,
    MenuItemConfig
  } from './types';
  import { PersistenceManager, logger } from './storage-utils-consolidated';
  import type { DJDataForgeKernel } from './kernel';
  
  // ============================================================================
  // PLUGIN INTERFACE
  // ============================================================================
  
  export interface Plugin {
    manifest: PluginManifest;
    init(context: PluginContext): Promise<void>;
    dispose?(): Promise<void>;
  }
  
  // ============================================================================
  // PLUGIN STORAGE API
  // ============================================================================
  
  class PluginStorageAPIImpl implements PluginStorageAPI {
    constructor(
      private pluginId: string,
      private storage: PersistenceManager
    ) {}
    
    async get(key: string): Promise<any> {
      return await this.storage.getPluginData(this.pluginId, key);
    }
    
    async set(key: string, value: any): Promise<void> {
      await this.storage.savePluginData(this.pluginId, key, value);
    }
    
    async delete(key: string): Promise<void> {
      await this.storage.deletePluginData(this.pluginId, key);
    }
    
    async clear(): Promise<void> {
      await this.storage.clearPluginData(this.pluginId);
    }
  }
  
  // ============================================================================
  // PLUGIN UI API
  // ============================================================================
  
  class PluginUIAPIImpl implements PluginUIAPI {
    private toolbarButtons: Map<string, ToolbarButtonConfig> = new Map();
    private panels: Map<string, PanelConfig> = new Map();
    private menuItems: Map<string, MenuItemConfig> = new Map();
    
    constructor(private pluginId: string, private eventBus: any) {}
    
    addToolbarButton(config: ToolbarButtonConfig): void {
      this.toolbarButtons.set(config.id, config);
      this.eventBus.emit('ui:add-toolbar-button', { pluginId: this.pluginId, config });
      logger.debug(`[Plugin] Toolbar button added`, { pluginId: this.pluginId, id: config.id });
    }
    
    addPanel(config: PanelConfig): void {
      this.panels.set(config.id, config);
      this.eventBus.emit('ui:add-panel', { pluginId: this.pluginId, config });
      logger.debug(`[Plugin] Panel added`, { pluginId: this.pluginId, id: config.id });
    }
    
    addMenuItem(config: MenuItemConfig): void {
      this.menuItems.set(config.id, config);
      this.eventBus.emit('ui:add-menu-item', { pluginId: this.pluginId, config });
      logger.debug(`[Plugin] Menu item added`, { pluginId: this.pluginId, id: config.id });
    }
    
    showToast(message: string, type: "info" | "success" | "warning" | "error"): void {
      const toastId = `toast-${Date.now()}`;
      const toast = document.createElement('div');
      toast.id = toastId;
      toast.className = `toast toast-${type}`;
      
      const icon = document.createElement('span');
      icon.className = 'toast-icon';
      if (type === 'success') icon.textContent = '✅';
      if (type === 'error') icon.textContent = '❌';
      if (type === 'info') icon.textContent = 'ℹ️';
      if (type === 'warning') icon.textContent = '⚠️';
      
      const messageSpan = document.createElement('span');
      messageSpan.textContent = message;
      
      const closeButton = document.createElement('button');
      closeButton.textContent = '×';
      closeButton.className = 'toast-close';
      closeButton.onclick = () => {
        toast.classList.add('slideOut');
        setTimeout(() => toast.remove(), 300);
      };
      
      toast.appendChild(icon);
      toast.appendChild(messageSpan);
      toast.appendChild(closeButton);
      
      document.body.appendChild(toast);
      
      setTimeout(() => {
        const el = document.getElementById(toastId);
        if (el) {
          el.classList.add('slideOut');
          setTimeout(() => el.remove(), 300);
        }
      }, 5000);
    }
    
    cleanup(): void {
      // Remove all UI elements
      this.toolbarButtons.forEach((_, id) => {
        document.getElementById(`plugin-btn-${id}`)?.remove();
      });
      
      this.panels.forEach((_, id) => {
        document.getElementById(`plugin-panel-${id}`)?.remove();
      });
      
      this.toolbarButtons.clear();
      this.panels.clear();
      this.menuItems.clear();
    }
  }
  
  // ============================================================================
  // PLUGIN EVENT API
  // ============================================================================
  
  class PluginEventAPIImpl implements PluginEventAPI {
    private handlers: Map<string, Set<Function>> = new Map();
    
    constructor(private pluginId: string, private eventBus: any) {}
    
    on(event: string, handler: (...args: any[]) => void): void {
      if (!this.handlers.has(event)) {
        this.handlers.set(event, new Set());
      }
      this.handlers.get(event)!.add(handler);
      this.eventBus.on(event, handler);
    }
    
    off(event: string, handler: (...args: any[]) => void): void {
      this.handlers.get(event)?.delete(handler);
      this.eventBus.off(event, handler);
    }
    
    emit(event: string, ...args: any[]): void {
      // Prefix with plugin ID to avoid conflicts
      this.eventBus.emit(`plugin:${this.pluginId}:${event}`, ...args);
    }
    
    cleanup(): void {
      // Remove all handlers
      this.handlers.forEach((handlers, event) => {
        handlers.forEach(handler => {
          this.eventBus.off(event, handler);
        });
      });
      this.handlers.clear();
    }
  }
  
  // ============================================================================
  // PLUGIN HOST
  // ============================================================================
  
  export class PluginHost {
    private plugins: Map<string, Plugin> = new Map();
    private contexts: Map<string, PluginContext> = new Map();
    private kernel: DJDataForgeKernel;
    private storage: PersistenceManager;
    
    constructor(kernel: DJDataForgeKernel, storage: PersistenceManager) {
      this.kernel = kernel;
      this.storage = storage;
    }
    
    /**
     * Load plugin from module
     */
    async loadPlugin(pluginModule: any, manifest: PluginManifest): Promise<void> {
      try {
        // Validate permissions
        this.validatePermissions(manifest.permissions);
        
        // Create plugin instance
        const plugin: Plugin = new pluginModule.default();
        plugin.manifest = manifest;
        
        // Create context
        const context = this.createContext(manifest);
        
        // Initialize plugin
        await plugin.init(context);
        
        // Store
        this.plugins.set(manifest.id, plugin);
        this.contexts.set(manifest.id, context);
        
        logger.info(`[PluginHost] Plugin loaded`, { id: manifest.id, name: manifest.name });
        
        // Emit event
        this.kernel.eventBus.emit('plugin:loaded', { pluginId: manifest.id });
      } catch (error) {
        logger.error(`[PluginHost] Failed to load plugin`, error);
        throw error;
      }
    }
    
    /**
     * Unload plugin
     */
    async unloadPlugin(pluginId: string): Promise<void> {
      const plugin = this.plugins.get(pluginId);
      const context = this.contexts.get(pluginId);
      
      if (!plugin || !context) {
        logger.warn(`[PluginHost] Plugin not found`, { pluginId });
        return;
      }
      
      try {
        // Call dispose if exists
        if (plugin.dispose) {
          await plugin.dispose();
        }
        
        // Cleanup UI
        (context.ui as PluginUIAPIImpl).cleanup();
        
        // Cleanup events
        (context.events as PluginEventAPIImpl).cleanup();
        
        // Remove from maps
        this.plugins.delete(pluginId);
        this.contexts.delete(pluginId);
        
        logger.info(`[PluginHost] Plugin unloaded`, { pluginId });
        
        // Emit event
        this.kernel.eventBus.emit('plugin:unloaded', { pluginId });
      } catch (error) {
        logger.error(`[PluginHost] Failed to unload plugin`, error);
        throw error;
      }
    }
    
    /**
     * Get loaded plugins
     */
    getLoadedPlugins(): PluginManifest[] {
      return Array.from(this.plugins.values()).map(p => p.manifest);
    }
    
    /**
     * Check if plugin is loaded
     */
    isLoaded(pluginId: string): boolean {
      return this.plugins.has(pluginId);
    }
    
    private createContext(manifest: PluginManifest): PluginContext {
      const storage = new PluginStorageAPIImpl(manifest.id, this.storage);
      const ui = new PluginUIAPIImpl(manifest.id, this.kernel.eventBus);
      const events = new PluginEventAPIImpl(manifest.id, this.kernel.eventBus);
      
      return {
        pluginId: manifest.id,
        manifest,
        kernel: this.kernel.getContext(),
        storage,
        ui,
        events,
      };
    }
    
    private validatePermissions(permissions: PluginPermission[]): void {
      // TODO: Implement proper permission checks
      // For now, just log
      logger.debug(`[PluginHost] Validating permissions`, { permissions });
    }
    
    /**
     * Unload all plugins
     */
    async unloadAllPlugins(): Promise<void> {
      const pluginIds = Array.from(this.plugins.keys());
      
      for (const id of pluginIds) {
        await this.unloadPlugin(id);
      }
    }
  }
  
  // ============================================================================
  // BUILT-IN PLUGIN: PIVOT TABLE & STRUCTURED TABLES (PHASE 1)
  // ============================================================================

  export class PivotPlugin implements Plugin {
    private tableManager?: any; // Will be initialized with TableManager
    private context?: PluginContext;

    manifest: PluginManifest = {
      id: 'pivot',
      name: 'Tabelas & Pivot',
      version: '2.0.0',
      author: 'DJ DataForge Team',
      description: 'Tabelas estruturadas e tabelas dinâmicas para análise de dados',
      permissions: ['read:workbook', 'write:workbook', 'ui:panel', 'ui:toolbar'],
      entryPoint: 'pivot.js',
    };

    async init(context: PluginContext): Promise<void> {
      logger.info('[PivotPlugin] Starting initialization...');
      this.context = context;

      try {
        // Dynamic import of TableManager to avoid circular dependencies
        logger.debug('[PivotPlugin] Importing TableManager...');
        const { TableManager } = await import('./table-manager');
        this.tableManager = TableManager.getInstance();
        logger.debug('[PivotPlugin] TableManager singleton instance acquired');

        // Add "Create Table" button in Data tab
        logger.debug('[PivotPlugin] Adding Create Table button...');
        context.ui.addToolbarButton({
          id: 'create-structured-table',
          label: 'Criar Tabela',
          icon: '📊',
          tooltip: 'Criar tabela estruturada com formatação inteligente',
          onClick: () => {
            logger.info('[PivotPlugin] Create Table button clicked!');
            this.showCreateTableDialog();
          },
        });

        // Add "Table Styles" button
        logger.debug('[PivotPlugin] Adding Table Styles button...');
        context.ui.addToolbarButton({
          id: 'table-styles',
          label: 'Estilos de Tabela',
          icon: '🎨',
          tooltip: 'Aplicar estilos de tabela',
          onClick: () => {
            logger.info('[PivotPlugin] Table Styles button clicked!');
            this.showTableStylesDialog();
          },
        });

        // Add "Sort Ascending" button
        logger.debug('[PivotPlugin] Adding Sort Ascending button...');
        context.ui.addToolbarButton({
          id: 'sort-column-asc',
          label: 'Ordenar ↑',
          icon: '⬆️',
          tooltip: 'Ordenar coluna selecionada em ordem crescente',
          onClick: () => {
            logger.info('[PivotPlugin] Sort Ascending button clicked!');
            this.sortActiveColumn(true);
          },
        });

        // Add "Sort Descending" button
        logger.debug('[PivotPlugin] Adding Sort Descending button...');
        context.ui.addToolbarButton({
          id: 'sort-column-desc',
          label: 'Ordenar ↓',
          icon: '⬇️',
          tooltip: 'Ordenar coluna selecionada em ordem decrescente',
          onClick: () => {
            logger.info('[PivotPlugin] Sort Descending button clicked!');
            this.sortActiveColumn(false);
          },
        });

        // Add "Filter Column" button
        logger.debug('[PivotPlugin] Adding Filter Column button...');
        context.ui.addToolbarButton({
          id: 'filter-column',
          label: 'Filtrar',
          icon: '🔍',
          tooltip: 'Filtrar coluna selecionada',
          onClick: () => {
            logger.info('[PivotPlugin] Filter Column button clicked!');
            this.filterActiveColumn();
          },
        });

        // Add "Clear Filter" button
        logger.debug('[PivotPlugin] Adding Clear Filter button...');
        context.ui.addToolbarButton({
          id: 'clear-filter',
          label: 'Limpar Filtro',
          icon: '🗑️',
          tooltip: 'Limpar todos os filtros da tabela',
          onClick: () => {
            logger.info('[PivotPlugin] Clear Filter button clicked!');
            this.clearFilters();
          },
        });

        // Add "Table Tools" panel
        logger.debug('[PivotPlugin] Adding Table Tools panel...');
        context.ui.addPanel({
          id: 'table-tools-panel',
          title: '🔧 Ferramentas de Tabela',
          render: (container: HTMLElement) => {
            container.innerHTML = '<div id="table-tools-content"></div>';
          },
          position: 'right',
        });

        context.ui.showToast('Tabelas Estruturadas v2.0 carregado!', 'success');
        logger.info('[PivotPlugin] Initialized successfully with structured tables');
      } catch (error) {
        logger.error('[PivotPlugin] Initialization failed', error);
        context.ui.showToast('Erro ao carregar plugin de tabelas', 'error');
      }
    }

    private showCreateTableDialog(): void {
      logger.info('[PivotPlugin] showCreateTableDialog called');

      if (!this.context) {
        logger.error('[PivotPlugin] Context is null');
        return;
      }

      const sheet = this.context.kernel.workbookManager.getActiveSheet();
      if (!sheet) {
        logger.warn('[PivotPlugin] No active sheet');
        this.context.ui.showToast('Selecione uma planilha primeiro', 'warning');
        return;
      }

      logger.info('[PivotPlugin] Creating table dialog...', { sheetId: sheet.id });

      // Check if sheet has data, if not, offer to add sample data
      const hasData = this.checkIfSheetHasData(sheet);
      if (!hasData) {
        const addSampleData = confirm('A planilha está vazia. Deseja adicionar dados de exemplo para testar a tabela?');
        if (addSampleData) {
          this.addSampleData(sheet);
          this.context.kernel.getGrid()?.render();
        }
      }

      // Create modal
      const modalId = 'create-table-modal';
      logger.debug('[PivotPlugin] Removing existing modal if any...');
      const existingModal = document.getElementById(modalId);
      if (existingModal) {
        existingModal.remove();
        logger.debug('[PivotPlugin] Existing modal removed');
      }

      logger.debug('[PivotPlugin] Getting style options...');
      let styleOptionsHTML = '';
      try {
        styleOptionsHTML = this.getStyleOptions();
        logger.debug('[PivotPlugin] Style options generated', { length: styleOptionsHTML.length });
      } catch (error) {
        logger.error('[PivotPlugin] Failed to get style options', error);
        styleOptionsHTML = '<option value="modern-blue">Azul Moderno</option>';
      }

      logger.debug('[PivotPlugin] Creating modal HTML...');
      const modalHTML = `
        <div id="${modalId}" class="modal-overlay" style="background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 10000;">
          <div class="modal" style="background: var(--theme-bg-primary); border-radius: 8px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.3); max-width: 600px; width: 90%; max-height: 90vh; overflow: auto;">
            <div class="modal-header" style="padding: 20px; border-bottom: 1px solid var(--theme-border-color); display: flex; justify-content: space-between; align-items: center;">
              <h2 style="margin: 0; color: var(--theme-text-primary); font-size: 20px;">📊 Criar Tabela Estruturada</h2>
              <button id="close-table-modal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--theme-text-secondary);">&times;</button>
            </div>

            <div class="modal-body" style="padding: 20px;">
              <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--theme-text-primary);">
                  Nome da Tabela
                </label>
                <input type="text" id="table-name-input" placeholder="Tabela1" class="form-control" style="width: 100%; padding: 8px 12px; border: 1px solid var(--theme-border-color); border-radius: 4px; background: var(--theme-bg-secondary); color: var(--theme-text-primary);" />
              </div>

              <div style="margin-bottom: 20px;">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                  <input type="checkbox" id="has-headers-checkbox" checked style="width: 18px; height: 18px;" />
                  <span style="color: var(--theme-text-primary);">Minha tabela tem cabeçalhos</span>
                </label>
              </div>

              <div style="margin-bottom: 20px;">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                  <input type="checkbox" id="analyze-types-checkbox" checked style="width: 18px; height: 18px;" />
                  <span style="color: var(--theme-text-primary);">Detectar tipos de dados automaticamente</span>
                </label>
              </div>

              <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--theme-text-primary);">
                  Estilo da Tabela
                </label>
                <select id="table-style-select" class="form-control" style="width: 100%; padding: 8px 12px; border: 1px solid var(--theme-border-color); border-radius: 4px; background: var(--theme-bg-secondary); color: var(--theme-text-primary);">
                  ${styleOptionsHTML}
                </select>
              </div>

              <div style="margin-bottom: 20px;">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                  <input type="checkbox" id="show-total-row-checkbox" style="width: 18px; height: 18px;" />
                  <span style="color: var(--theme-text-primary);">Adicionar linha de totais</span>
                </label>
              </div>

              <div style="background: var(--theme-bg-secondary); padding: 12px; border-radius: 4px; margin-bottom: 20px;">
                <div style="font-size: 12px; color: var(--theme-text-secondary);">
                  💡 <strong>Dica:</strong> A tabela será criada automaticamente detectando o intervalo de dados na planilha ativa.
                </div>
              </div>
            </div>

            <div class="modal-footer" style="padding: 16px 20px; border-top: 1px solid var(--theme-border-color); display: flex; gap: 12px; justify-content: flex-end;">
              <button id="cancel-table-btn" class="btn" style="padding: 8px 16px; border: 1px solid var(--theme-border-color); border-radius: 4px; background: var(--theme-bg-secondary); color: var(--theme-text-primary); cursor: pointer;">
                Cancelar
              </button>
              <button id="create-table-btn" class="btn" style="padding: 8px 16px; border: none; border-radius: 4px; background: var(--theme-color-primary); color: white; cursor: pointer; font-weight: 600;">
                Criar Tabela
              </button>
            </div>
          </div>
        </div>
      `;

      logger.debug('[PivotPlugin] Inserting modal into DOM...');
      try {
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        logger.info('[PivotPlugin] Modal HTML inserted successfully');

        // Verify modal was added
        const insertedModal = document.getElementById(modalId);
        if (insertedModal) {
          logger.info('[PivotPlugin] Modal element found in DOM', { id: modalId });
        } else {
          logger.error('[PivotPlugin] Modal element NOT found in DOM after insertion!');
          return;
        }

        // Event listeners
        logger.debug('[PivotPlugin] Setting up modal event listeners...');

        const closeBtn = document.getElementById('close-table-modal');
        if (closeBtn) {
          closeBtn.addEventListener('click', () => {
            logger.info('[PivotPlugin] Close button clicked');
            document.getElementById(modalId)?.remove();
          });
          logger.debug('[PivotPlugin] Close button listener added');
        } else {
          logger.error('[PivotPlugin] Close button not found!');
        }

        const cancelBtn = document.getElementById('cancel-table-btn');
        if (cancelBtn) {
          cancelBtn.addEventListener('click', () => {
            logger.info('[PivotPlugin] Cancel button clicked');
            document.getElementById(modalId)?.remove();
          });
          logger.debug('[PivotPlugin] Cancel button listener added');
        } else {
          logger.error('[PivotPlugin] Cancel button not found!');
        }

        const createBtn = document.getElementById('create-table-btn');
        if (createBtn) {
          createBtn.addEventListener('click', () => {
            logger.info('[PivotPlugin] Create button clicked');
            this.createTable();
          });
          logger.debug('[PivotPlugin] Create button listener added');
        } else {
          logger.error('[PivotPlugin] Create button not found!');
        }

        logger.info('[PivotPlugin] Modal dialog created and displayed successfully');

      } catch (error) {
        logger.error('[PivotPlugin] Failed to insert modal', error);
        this.context?.ui.showToast('Erro ao abrir dialog', 'error');
      }
    }

    private getStyleOptions(): string {
      if (!this.tableManager) {
        logger.warn('[PivotPlugin] TableManager not initialized, using default styles');
        return `
          <option value="modern-blue">Azul Moderno</option>
          <option value="dark-slate">Ardósia Escura</option>
          <option value="green-eco">Verde Eco</option>
          <option value="purple-elegant">Roxo Elegante</option>
          <option value="orange-vibrant">Laranja Vibrante</option>
          <option value="minimal-gray">Cinza Minimalista</option>
        `;
      }

      try {
        const styles = this.tableManager.getAvailableStyles();
        return styles.map((style: any) => `
          <option value="${style.id}">${style.name}</option>
        `).join('');
      } catch (error) {
        logger.error('[PivotPlugin] Failed to get styles from TableManager', error);
        return '<option value="modern-blue">Azul Moderno</option>';
      }
    }

    private async createTable(): Promise<void> {
      if (!this.context || !this.tableManager) return;

      const sheet = this.context.kernel.workbookManager.getActiveSheet();
      if (!sheet) {
        this.context.ui.showToast('Planilha não encontrada', 'error');
        return;
      }

      try {
        // Get options from form
        const tableName = (document.getElementById('table-name-input') as HTMLInputElement)?.value || undefined;
        const hasHeaders = (document.getElementById('has-headers-checkbox') as HTMLInputElement)?.checked ?? true;
        const analyzeTypes = (document.getElementById('analyze-types-checkbox') as HTMLInputElement)?.checked ?? true;
        const styleName = (document.getElementById('table-style-select') as HTMLSelectElement)?.value || 'modern-blue';
        const showTotalRow = (document.getElementById('show-total-row-checkbox') as HTMLInputElement)?.checked ?? false;

        // Create table
        const table = this.tableManager.createTable(sheet, {
          autoDetectRange: true,
          hasHeaders,
          analyzeDataTypes: analyzeTypes,
          styleName,
          tableName
        });

        // Update table properties
        this.tableManager.updateTable(table.id, { showTotalRow });

        // Apply formatting
        this.tableManager.applyTableFormatting(table, sheet);

        // Apply totals if enabled
        if (showTotalRow) {
          // Set default total functions
          table.columns.forEach((col: any) => {
            if (col.dataType === 'number' || col.dataType === 'currency' || col.dataType === 'percentage') {
              col.totalFunction = 'sum';
            }
          });
          this.tableManager.applyTotals(table, sheet);
        }

        // Add header buttons (Google Sheets style)
        this.tableManager.addHeaderButtons(table, sheet);

        // Setup header click handler
        this.setupHeaderClickHandler(table, sheet);

        // Refresh grid
        const grid = this.context.kernel.getGrid();
        if (grid) {
          grid.render();
        }

        // Recalculate formulas if totals were added
        if (showTotalRow) {
          this.context.kernel.recalculate(sheet.id);
        }

        // Close modal
        document.getElementById('create-table-modal')?.remove();

        // Show success message
        this.context.ui.showToast(`Tabela "${table.name}" criada com sucesso!`, 'success');

        logger.info('[PivotPlugin] Table created successfully', {
          tableId: table.id,
          name: table.name,
          columns: table.columns.length
        });

      } catch (error) {
        logger.error('[PivotPlugin] Failed to create table', error);
        this.context.ui.showToast(`Erro ao criar tabela: ${error}`, 'error');
      }
    }

    private showTableStylesDialog(): void {
      if (!this.context) return;

      this.context.ui.showToast('Galeria de estilos: em breve!', 'info');
      // TODO: Implement styles gallery
    }

    private checkIfSheetHasData(sheet: any): boolean {
      for (let r = 0; r < Math.min(sheet.rowCount, 100); r++) {
        for (let c = 0; c < Math.min(sheet.colCount, 26); c++) {
          const cell = sheet.getCell(r, c);
          if (cell && cell.value !== null && cell.value !== undefined && cell.value !== '') {
            return true;
          }
        }
      }
      return false;
    }

    private addSampleData(sheet: any): void {
      // Headers
      const headers = ['Nome', 'Departamento', 'Salário', 'Data Contratação', 'Email', 'Ativo'];
      headers.forEach((header, col) => {
        sheet.setCell(0, col, header);
      });

      // Sample data
      const sampleData = [
        ['Ana Silva', 'Vendas', 5500.00, '15/03/2020', 'ana.silva@empresa.com', 'Sim'],
        ['Carlos Santos', 'TI', 7200.50, '22/08/2019', 'carlos.santos@empresa.com', 'Sim'],
        ['Maria Oliveira', 'Marketing', 4800.00, '10/01/2021', 'maria.oliveira@empresa.com', 'Sim'],
        ['João Costa', 'Vendas', 6100.00, '05/11/2018', 'joao.costa@empresa.com', 'Não'],
        ['Paula Ferreira', 'RH', 5300.00, '18/06/2020', 'paula.ferreira@empresa.com', 'Sim'],
        ['Ricardo Lima', 'TI', 8500.00, '30/04/2017', 'ricardo.lima@empresa.com', 'Sim'],
        ['Fernanda Rocha', 'Financeiro', 6800.00, '12/09/2019', 'fernanda.rocha@empresa.com', 'Sim'],
        ['Pedro Alves', 'Marketing', 5100.00, '25/02/2022', 'pedro.alves@empresa.com', 'Sim']
      ];

      sampleData.forEach((row, rowIdx) => {
        row.forEach((value, colIdx) => {
          sheet.setCell(rowIdx + 1, colIdx, value);
        });
      });

      logger.info('[PivotPlugin] Sample data added to sheet');
    }

    /**
     * Setup click handler for table headers
     */
    private setupHeaderClickHandler(table: any, sheet: any): void {
      if (!this.context) return;

      const grid = this.context.kernel.getGrid();
      if (!grid || !grid.canvas) return;

      const canvas = grid.canvas;

      // Store reference to this plugin
      const plugin = this;

      // Add click event listener
      const clickHandler = (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Calculate which cell was clicked
        const col = Math.floor((x + grid.scrollX) / grid.cellWidth);
        const row = Math.floor((y + grid.scrollY) / grid.cellHeight);

        // Check if click is within table header row
        if (row === table.range.startRow &&
            col >= table.range.startCol &&
            col <= table.range.endCol &&
            table.hasHeaders) {

          const columnIndex = col - table.range.startCol;

          logger.debug('[PivotPlugin] Table header clicked', { row, col, columnIndex });

          // Show header menu at click position
          if (plugin.tableManager) {
            plugin.tableManager.showHeaderMenu(
              table,
              sheet,
              columnIndex,
              e.clientX,
              e.clientY,
              (ascending: boolean) => {
                // Sort callback
                plugin.sortTableColumn(table, sheet, columnIndex, ascending);
              },
              () => {
                // Filter callback
                plugin.filterTableColumn(table, sheet, columnIndex);
              }
            );
          }
        }
      };

      // Store handler so we can remove it later if needed
      canvas.addEventListener('click', clickHandler);

      logger.debug('[PivotPlugin] Header click handler setup', { tableId: table.id });
    }

    /**
     * Sort a specific table column
     */
    private sortTableColumn(table: any, sheet: any, columnIndex: number, ascending: boolean): void {
      if (!this.tableManager || !this.context) return;

      try {
        this.tableManager.sortTableByColumn(table, sheet, columnIndex, ascending);
        const grid = this.context.kernel.getGrid();
        if (grid) grid.render();

        const direction = ascending ? 'crescente' : 'decrescente';
        const columnName = table.columns[columnIndex]?.name || `Coluna ${columnIndex + 1}`;
        this.context.ui.showToast(`Ordenado por "${columnName}" (${direction})`, 'success');
      } catch (error) {
        logger.error('[PivotPlugin] Sort failed', error);
        this.context.ui.showToast(`Erro ao ordenar: ${error}`, 'error');
      }
    }

    /**
     * Filter a specific table column
     */
    private filterTableColumn(table: any, sheet: any, columnIndex: number): void {
      if (!this.tableManager || !this.context) return;

      try {
        const uniqueValues = this.tableManager.getColumnUniqueValues(table, sheet, columnIndex);
        const columnName = table.columns[columnIndex]?.name || `Coluna ${columnIndex + 1}`;

        this.showFilterDialog(table, sheet, columnIndex, columnName, uniqueValues);
      } catch (error) {
        logger.error('[PivotPlugin] Filter setup failed', error);
        this.context.ui.showToast(`Erro ao configurar filtro: ${error}`, 'error');
      }
    }

    /**
     * Find table containing the active cell
     */
    private findTableAtCell(sheet: any, row: number, col: number): any {
      if (!this.tableManager) return null;

      const tables = this.tableManager.listTables();

      for (const table of tables) {
        if (table.sheetId === sheet.id) {
          const { range } = table;
          if (row >= range.startRow && row <= range.endRow &&
              col >= range.startCol && col <= range.endCol) {
            return table;
          }
        }
      }

      return null;
    }

    /**
     * Sort the active column
     */
    private sortActiveColumn(ascending: boolean): void {
      if (!this.context || !this.tableManager) {
        this.context?.ui.showToast('TableManager não inicializado', 'error');
        return;
      }

      const sheet = this.context.kernel.workbookManager.getActiveSheet();
      if (!sheet) {
        this.context.ui.showToast('Nenhuma planilha ativa', 'error');
        return;
      }

      // Get active cell from grid
      const grid = this.context.kernel.getGrid();
      if (!grid) {
        this.context.ui.showToast('Grid não encontrado', 'error');
        return;
      }

      const activeRow = grid.activeRow;
      const activeCol = grid.activeCol;

      // Find table containing active cell
      const table = this.findTableAtCell(sheet, activeRow, activeCol);
      if (!table) {
        this.context.ui.showToast('Célula ativa não está em uma tabela', 'warning');
        return;
      }

      // Calculate column index within table
      const columnIndex = activeCol - table.range.startCol;

      if (columnIndex < 0 || columnIndex >= table.columns.length) {
        this.context.ui.showToast('Coluna inválida', 'error');
        return;
      }

      // Perform sort
      try {
        this.tableManager.sortTableByColumn(table, sheet, columnIndex, ascending);
        grid.render();

        const direction = ascending ? 'crescente' : 'decrescente';
        const columnName = table.columns[columnIndex].name;
        this.context.ui.showToast(`Tabela ordenada por "${columnName}" (${direction})`, 'success');
      } catch (error) {
        logger.error('[PivotPlugin] Sort failed', error);
        this.context.ui.showToast(`Erro ao ordenar: ${error}`, 'error');
      }
    }

    /**
     * Filter the active column
     */
    private filterActiveColumn(): void {
      if (!this.context || !this.tableManager) {
        this.context?.ui.showToast('TableManager não inicializado', 'error');
        return;
      }

      const sheet = this.context.kernel.workbookManager.getActiveSheet();
      if (!sheet) {
        this.context.ui.showToast('Nenhuma planilha ativa', 'error');
        return;
      }

      // Get active cell from grid
      const grid = this.context.kernel.getGrid();
      if (!grid) {
        this.context.ui.showToast('Grid não encontrado', 'error');
        return;
      }

      const activeRow = grid.activeRow;
      const activeCol = grid.activeCol;

      // Find table containing active cell
      const table = this.findTableAtCell(sheet, activeRow, activeCol);
      if (!table) {
        this.context.ui.showToast('Célula ativa não está em uma tabela', 'warning');
        return;
      }

      // Calculate column index within table
      const columnIndex = activeCol - table.range.startCol;

      if (columnIndex < 0 || columnIndex >= table.columns.length) {
        this.context.ui.showToast('Coluna inválida', 'error');
        return;
      }

      // Get unique values for filter
      const uniqueValues = this.tableManager.getColumnUniqueValues(table, sheet, columnIndex);
      const columnName = table.columns[columnIndex].name;

      // Show filter dialog
      this.showFilterDialog(table, sheet, columnIndex, columnName, uniqueValues);
    }

    /**
     * Show filter dialog with unique values
     */
    private showFilterDialog(table: any, sheet: any, columnIndex: number, columnName: string, uniqueValues: string[]): void {
      if (!this.context) return;

      const modalId = 'filter-column-modal';

      // Remove existing modal if any
      document.getElementById(modalId)?.remove();

      const modalHTML = `
        <div id="${modalId}" style="
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
        ">
          <div style="
            background: var(--theme-bg-primary);
            color: var(--theme-text-primary);
            padding: 24px;
            border-radius: 8px;
            min-width: 400px;
            max-width: 500px;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 10px 25px rgba(0,0,0,0.3);
          ">
            <h3 style="margin-top: 0;">🔍 Filtrar: ${columnName}</h3>

            <div style="margin-bottom: 16px;">
              <label style="display: block; margin-bottom: 8px;">Valor do filtro:</label>
              <input type="text" id="filter-value-input" placeholder="Digite para filtrar..."
                style="width: 100%; padding: 8px; border: 1px solid var(--theme-border-color);
                border-radius: 4px; background: var(--theme-bg-secondary);
                color: var(--theme-text-primary);" />
            </div>

            <div style="margin-bottom: 16px;">
              <label style="display: block; margin-bottom: 8px;">Ou selecione um valor:</label>
              <select id="filter-value-select" size="8"
                style="width: 100%; padding: 8px; border: 1px solid var(--theme-border-color);
                border-radius: 4px; background: var(--theme-bg-secondary);
                color: var(--theme-text-primary);">
                ${uniqueValues.map(val => `<option value="${val}">${val}</option>`).join('')}
              </select>
            </div>

            <div style="display: flex; gap: 8px; justify-content: flex-end;">
              <button id="apply-filter-btn" style="
                padding: 8px 16px;
                background: var(--theme-color-primary);
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
              ">Aplicar</button>
              <button id="close-filter-modal-btn" style="
                padding: 8px 16px;
                background: var(--theme-bg-tertiary);
                color: var(--theme-text-primary);
                border: 1px solid var(--theme-border-color);
                border-radius: 4px;
                cursor: pointer;
              ">Cancelar</button>
            </div>
          </div>
        </div>
      `;

      document.body.insertAdjacentHTML('beforeend', modalHTML);

      // Setup event listeners
      const modal = document.getElementById(modalId);
      const closeBtn = document.getElementById('close-filter-modal-btn');
      const applyBtn = document.getElementById('apply-filter-btn');
      const filterInput = document.getElementById('filter-value-input') as HTMLInputElement;
      const filterSelect = document.getElementById('filter-value-select') as HTMLSelectElement;

      // When select changes, update input
      filterSelect?.addEventListener('change', () => {
        if (filterInput && filterSelect.value) {
          filterInput.value = filterSelect.value;
        }
      });

      closeBtn?.addEventListener('click', () => {
        modal?.remove();
      });

      applyBtn?.addEventListener('click', () => {
        const filterValue = filterInput?.value || filterSelect?.value || null;

        if (filterValue && this.tableManager) {
          try {
            this.tableManager.filterTableByColumn(table, sheet, columnIndex, filterValue);
            const grid = this.context?.kernel.getGrid();
            if (grid) grid.render();
            this.context?.ui.showToast(`Filtro aplicado: "${filterValue}"`, 'success');
          } catch (error) {
            logger.error('[PivotPlugin] Filter failed', error);
            this.context?.ui.showToast(`Erro ao filtrar: ${error}`, 'error');
          }
        }

        modal?.remove();
      });
    }

    /**
     * Clear all filters from the active table
     */
    private clearFilters(): void {
      if (!this.context || !this.tableManager) {
        this.context?.ui.showToast('TableManager não inicializado', 'error');
        return;
      }

      const sheet = this.context.kernel.workbookManager.getActiveSheet();
      if (!sheet) {
        this.context.ui.showToast('Nenhuma planilha ativa', 'error');
        return;
      }

      // Get active cell from grid
      const grid = this.context.kernel.getGrid();
      if (!grid) {
        this.context.ui.showToast('Grid não encontrado', 'error');
        return;
      }

      const activeRow = grid.activeRow;
      const activeCol = grid.activeCol;

      // Find table containing active cell
      const table = this.findTableAtCell(sheet, activeRow, activeCol);
      if (!table) {
        this.context.ui.showToast('Célula ativa não está em uma tabela', 'warning');
        return;
      }

      // Clear filters by calling filterTableByColumn with null
      try {
        // Clear filter for all columns
        table.columns.forEach((_col: any, index: number) => {
          this.tableManager!.filterTableByColumn(table, sheet, index, null);
        });

        grid.render();
        this.context.ui.showToast('Filtros removidos', 'success');
      } catch (error) {
        logger.error('[PivotPlugin] Clear filters failed', error);
        this.context.ui.showToast(`Erro ao limpar filtros: ${error}`, 'error');
      }
    }
  }

  // ============================================================================
  // BUILT-IN PLUGIN: FX-PACK (Financial Formulas)
  // ============================================================================

  export class FXPackPlugin implements Plugin {
    manifest: PluginManifest = {
      id: 'fx-pack',
      name: 'FX Pack',
      version: '1.0.0',
      author: 'DJ DataForge Team',
      description: 'Fórmulas financeiras e estatísticas avançadas',
      permissions: ['formula:register'],
      entryPoint: 'fx-pack.js',
    };

    async init(context: PluginContext): Promise<void> {
      const registry = context.kernel.calcEngine.getRegistry();
      
      // Financial functions
      registry.register('VPL', (taxa: number, ...valores: number[]) => {
        const flat = valores.flat();
        return flat.reduce((vpn, valor, i) => {
          return vpn + valor / Math.pow(1 + taxa, i + 1);
        }, 0);
      }, { description: 'Valor Presente Líquido' });
      
      registry.register('PGTO', (taxa: number, nper: number, vp: number, vf: number = 0, tipo: number = 0) => {
        if (taxa === 0) return -(vp + vf) / nper;
        
        const pvif = Math.pow(1 + taxa, nper);
        let pmt = taxa / (pvif - 1) * -(vp * pvif + vf);
        
        if (tipo === 1) {
          pmt /= (1 + taxa);
        }
        
        return pmt;
      }, { argCount: 5, description: 'Pagamento de empréstimo' });
      
      registry.register('TAXA', (nper: number, pgto: number, vp: number, vf: number = 0) => {
        // Simplified rate calculation (Newton's method would be more accurate)
        let rate = 0.1;
        for (let i = 0; i < 20; i++) {
          const f = vp * Math.pow(1 + rate, nper) + pgto * ((Math.pow(1 + rate, nper) - 1) / rate) + vf;
          const df = nper * vp * Math.pow(1 + rate, nper - 1) + 
                     pgto * ((nper * Math.pow(1 + rate, nper - 1) * rate - (Math.pow(1 + rate, nper) - 1)) / (rate * rate));
          rate = rate - f / df;
        }
        return rate;
      }, { argCount: 4, description: 'Taxa de juros' });
      
      // Statistical functions
      registry.register('DESVPAD', (...valores: number[]) => {
        const flat = valores.flat().filter(v => typeof v === 'number');
        if (flat.length < 2) return 0;
        
        const mean = flat.reduce((sum, v) => sum + v, 0) / flat.length;
        const variance = flat.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (flat.length - 1);
        return Math.sqrt(variance);
      }, { description: 'Desvio padrão' });
      
      registry.register('MEDIANA', (...valores: number[]) => {
        const flat = valores.flat().filter(v => typeof v === 'number').sort((a, b) => a - b);
        if (flat.length === 0) return 0;
        
        const mid = Math.floor(flat.length / 2);
        return flat.length % 2 === 0 ? (flat[mid - 1] + flat[mid]) / 2 : flat[mid];
      }, { description: 'Mediana' });
      
      context.ui.showToast('FX Pack carregado com sucesso!', 'success');

      logger.info('[FXPackPlugin] Initialized with financial and statistical functions');
    }
  }
  
