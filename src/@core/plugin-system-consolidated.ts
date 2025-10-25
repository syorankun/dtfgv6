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
    private panelContainer?: HTMLElement; // Reference to panel container for updates

    manifest: PluginManifest = {
      id: 'dataforge-table-studio',
      name: '✨ DataForge Table Studio',
      version: '3.0.0',
      author: 'DJ DataForge Team',
      description: 'Motor inteligente de tabelas: análise, formatação e insights automatizados',
      permissions: ['read:workbook', 'write:workbook', 'ui:panel', 'ui:toolbar'],
      entryPoint: 'table-studio.js',
    };

    async init(context: PluginContext): Promise<void> {
      logger.info('[TableStudio] 🚀 Starting initialization...');
      this.context = context;

      try {
        // STEP 1: Import and get TableManager
        logger.info('[TableStudio] 📦 Step 1/6: Importing TableManager...');
        const { TableManager } = await import('./table-manager');
        this.tableManager = TableManager.getInstance();
        logger.info('[TableStudio] ✅ TableManager acquired');

        // STEP 2: Load persisted tables FIRST (before UI setup)
        logger.info('[TableStudio] 📂 Step 2/6: Loading persisted tables...');
        await this.loadTablesFromPersistence();
        logger.info('[TableStudio] ✅ Tables loaded from persistence');

        // STEP 3: Configure TableManager in grid
        logger.info('[TableStudio] ⚙️ Step 3/6: Configuring grid integration...');
        const grid = context.kernel.getGrid();
        if (grid && this.tableManager) {
          grid.setTableManager(this.tableManager);
          logger.info('[TableStudio] ✅ TableManager configured in grid');
        }

        // STEP 4: Add toolbar buttons
        logger.info('[TableStudio] 🎨 Step 4/6: Adding toolbar buttons...');

        context.ui.addToolbarButton({
          id: 'create-smart-table',
          label: '✨ Nova Tabela',
          icon: '✨',
          tooltip: 'Criar tabela inteligente com detecção automática de dados',
          onClick: () => this.showCreateTableDialog(),
        });

        context.ui.addToolbarButton({
          id: 'table-styles-gallery',
          label: '🎨 Estilos',
          icon: '🎨',
          tooltip: 'Galeria de estilos de tabela com preview',
          onClick: () => this.showStylesGallery(),
        });

        context.ui.addToolbarButton({
          id: 'table-convert-range',
          label: '📐 Converter',
          icon: '📐',
          tooltip: 'Converter tabela para range normal ou vice-versa',
          onClick: () => this.toggleTableConversion(),
        });

        context.ui.addToolbarButton({
          id: 'table-resize',
          label: '↔️ Redimensionar',
          icon: '↔️',
          tooltip: 'Redimensionar tabela dinamicamente',
          onClick: () => this.showResizeTableDialog(),
        });

        logger.info('[TableStudio] ✅ Toolbar buttons added');

        // STEP 5: Setup event listeners
        logger.info('[TableStudio] 📡 Step 5/6: Setting up event listeners...');
        this.setupEventListeners();
        logger.info('[TableStudio] ✅ Event listeners configured');

        // STEP 6: Add panel (will render with loaded tables)
        logger.info('[TableStudio] 🖼️ Step 6/6: Adding Table Studio panel...');
        context.ui.addPanel({
          id: 'table-studio-panel',
          title: '✨ Table Studio',
          render: (container: HTMLElement) => {
            this.panelContainer = container;
            logger.info('[TableStudio] Panel render callback triggered');
            this.renderTableStudioPanel(container);
          },
          position: 'right',
        });
        logger.info('[TableStudio] ✅ Panel added');

        // Force initial render after short delay to ensure UI is ready
        setTimeout(() => {
          logger.info('[TableStudio] 🔄 Forcing initial panel render after delay...');
          this.refreshTableStudioPanel();
        }, 300);

        context.ui.showToast('✨ DataForge Table Studio v3.0 ativado!', 'success');
        logger.info('[TableStudio] ✅ Initialization complete! Plugin ready.');
      } catch (error) {
        logger.error('[TableStudio] ❌ Initialization failed', error);
        context.ui.showToast('Erro ao carregar plugin de tabelas', 'error');
      }
    }

    /**
     * Setup all event listeners for auto-refresh
     */
    private setupEventListeners(): void {
      if (!this.context) return;

      // Listen for filter button clicks from grid
      this.context.events.on('table:header-filter-click', (data: any) => {
        logger.debug('[TableStudio] Filter button clicked from grid', data);
        this.handleGridFilterButtonClick(data);
      });

      // Listen for selection changes to update panel
      this.context.events.on('selection:changed', () => {
        logger.debug('[TableStudio] Selection changed - refreshing panel');
        this.refreshTableStudioPanel();
      });

      // Listen for workbook changes
      this.context.kernel.eventBus.on('workbook:loaded', () => {
        logger.info('[TableStudio] Workbook loaded - refreshing panel');
        this.refreshTableStudioPanel();
      });

      // Listen for sheet changes
      this.context.kernel.eventBus.on('sheet:changed', () => {
        logger.info('[TableStudio] Sheet changed - refreshing panel');
        this.refreshTableStudioPanel();
      });

      logger.debug('[TableStudio] Event listeners registered', {
        events: ['table:header-filter-click', 'selection:changed', 'workbook:loaded', 'sheet:changed']
      });
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
        logger.info('[TableStudio] 🔨 Creating table...', {
          sheetId: sheet.id,
          sheetName: sheet.name,
          options: { hasHeaders, analyzeTypes, styleName, tableName, showTotalRow }
        });

        const table = this.tableManager.createTable(sheet, {
          autoDetectRange: true,
          hasHeaders,
          analyzeDataTypes: analyzeTypes,
          styleName,
          tableName
        });

        logger.info('[TableStudio] ✅ Table created by TableManager', {
          tableId: table.id,
          tableName: table.name,
          sheetId: table.sheetId,
          range: table.range,
          columns: table.columns.length
        });

        // Verify table is in TableManager
        const allTables = this.tableManager.listTables();
        logger.info('[TableStudio] Tables in TableManager after creation', {
          count: allTables.length,
          tables: allTables.map((t: any) => ({ id: t.id, name: t.name }))
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
          // CORREÇÃO CRÍTICA: Usar applyTotalsWithCalculation para forçar cálculo automático
          await this.applyTotalsWithCalculation(table, sheet);
        }

        // Add header buttons (Google Sheets style)
        this.tableManager.addHeaderButtons(table, sheet);

        // Setup header click handler
        this.setupHeaderClickHandler(table, sheet);

        // Refresh grid and force update of active table info
        const grid = this.context.kernel.getGrid();
        if (grid) {
          logger.info('[TableStudio] Updating grid with new table...');

          // Force grid to update active table info
          if (typeof grid.updateActiveTableInfo === 'function') {
            (grid as any).updateActiveTableInfo();
            logger.info('[TableStudio] Grid active table info updated');
          }

          grid.render();
          logger.info('[TableStudio] Grid rendered with new table');
        }

        // CORREÇÃO CRÍTICA: Salvar tabela na persistência (IndexedDB)
        await this.saveTablesToPersistence();
        logger.info('[TableStudio] Table saved to persistence', { tableId: table.id });

        // Force refresh the Table Studio panel to recognize the new table
        logger.info('[TableStudio] Refreshing panel to recognize new table...');
        this.refreshTableStudioPanel();

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

    // Removed showTableStylesDialog - feature to be implemented later

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
              },
              () => {
                // Clear sort callback
                plugin.clearColumnSort(table, sheet, columnIndex);
              },
              () => {
                // Clear filter callback
                plugin.clearColumnFilter(table, sheet, columnIndex);
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

        // Update header state
        this.tableManager.updateHeaderButtonState(table, sheet, columnIndex, {
          sorted: ascending ? 'asc' : 'desc'
        });

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
     * Clear sort from a column
     */
    private clearColumnSort(table: any, sheet: any, columnIndex: number): void {
      if (!this.tableManager || !this.context) return;

      try {
        // Update state to clear sort
        this.tableManager.updateHeaderButtonState(table, sheet, columnIndex, {
          sorted: null
        });

        const grid = this.context.kernel.getGrid();
        if (grid) grid.render();

        const columnName = table.columns[columnIndex]?.name || `Coluna ${columnIndex + 1}`;
        this.context.ui.showToast(`Ordenação removida de "${columnName}"`, 'info');
      } catch (error) {
        logger.error('[PivotPlugin] Clear sort failed', error);
        this.context.ui.showToast(`Erro ao limpar ordenação: ${error}`, 'error');
      }
    }

    /**
     * Clear filter from a column
     */
    private clearColumnFilter(table: any, sheet: any, columnIndex: number): void {
      if (!this.tableManager || !this.context) return;

      try {
        // Clear the filter
        this.tableManager.filterTableByColumn(table, sheet, columnIndex, null);

        // Update state
        this.tableManager.updateHeaderButtonState(table, sheet, columnIndex, {
          filtered: false
        });

        const grid = this.context.kernel.getGrid();
        if (grid) grid.render();

        const columnName = table.columns[columnIndex]?.name || `Coluna ${columnIndex + 1}`;
        this.context.ui.showToast(`Filtro removido de "${columnName}"`, 'info');
      } catch (error) {
        logger.error('[PivotPlugin] Clear filter failed', error);
        this.context.ui.showToast(`Erro ao limpar filtro: ${error}`, 'error');
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
     * Show filter dialog with unique values
     */
    private showFilterDialog(table: any, sheet: any, columnIndex: number, columnName: string, uniqueValues: string[]): void {
      if (!this.context || !this.tableManager) return;

      const modalId = 'filter-dialog-modal';
      const existingModal = document.getElementById(modalId);
      if (existingModal) {
        existingModal.remove();
      }

      const checkboxesHTML = uniqueValues.map(value => `
        <label style="display: flex; align-items: center; padding: 8px; cursor: pointer; border-radius: 4px; transition: background 0.15s;">
          <input type="checkbox" value="${value}" checked style="margin-right: 8px; cursor: pointer;">
          <span>${value}</span>
        </label>
      `).join('');

      const modalHTML = `
        <div id="${modalId}" class="modal-overlay" style="background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 10000;">
          <div class="modal" style="background: var(--theme-bg-primary); border-radius: 8px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.3); max-width: 400px; width: 90%; max-height: 80vh; overflow: auto;">
            <div style="padding: 20px; border-bottom: 1px solid var(--theme-border-color); display: flex; justify-content: space-between; align-items: center;">
              <h3 style="margin: 0; font-size: 18px; color: var(--theme-text-primary);">🔍 Filtrar ${columnName}</h3>
              <button id="close-filter-modal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--theme-text-secondary);">&times;</button>
            </div>
            <div style="padding: 20px; max-height: 400px; overflow-y: auto;">
              <div id="filter-values-list" style="display: flex; flex-direction: column; gap: 4px;">
                ${checkboxesHTML}
              </div>
            </div>
            <div style="padding: 16px 20px; border-top: 1px solid var(--theme-border-color); display: flex; gap: 12px; justify-content: flex-end;">
              <button id="clear-all-filter" style="padding: 8px 16px; background: var(--theme-bg-secondary); color: var(--theme-text-primary); border: 1px solid var(--theme-border-color); border-radius: 4px; cursor: pointer; font-size: 14px;">Desmarcar Todos</button>
              <button id="select-all-filter" style="padding: 8px 16px; background: var(--theme-bg-secondary); color: var(--theme-text-primary); border: 1px solid var(--theme-border-color); border-radius: 4px; cursor: pointer; font-size: 14px;">Marcar Todos</button>
              <button id="apply-filter-btn" style="padding: 8px 16px; background: var(--theme-color-primary); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">Aplicar Filtro</button>
            </div>
          </div>
        </div>
      `;

      document.body.insertAdjacentHTML('beforeend', modalHTML);

      // Event listeners
      document.getElementById('close-filter-modal')?.addEventListener('click', () => {
        document.getElementById(modalId)?.remove();
      });

      document.getElementById('select-all-filter')?.addEventListener('click', () => {
        const checkboxes = document.querySelectorAll('#filter-values-list input[type="checkbox"]');
        checkboxes.forEach(cb => (cb as HTMLInputElement).checked = true);
      });

      document.getElementById('clear-all-filter')?.addEventListener('click', () => {
        const checkboxes = document.querySelectorAll('#filter-values-list input[type="checkbox"]');
        checkboxes.forEach(cb => (cb as HTMLInputElement).checked = false);
      });

      document.getElementById('apply-filter-btn')?.addEventListener('click', () => {
        const checkboxes = document.querySelectorAll('#filter-values-list input[type="checkbox"]');
        const selectedValues = new Set<string>();
        checkboxes.forEach(cb => {
          const input = cb as HTMLInputElement;
          if (input.checked) {
            selectedValues.add(input.value);
          }
        });

        // Apply filter
        this.applyColumnFilter(table, sheet, columnIndex, selectedValues);

        // Update button state
        this.tableManager?.updateHeaderButtonState(table, sheet, columnIndex, { filtered: selectedValues.size < uniqueValues.length });

        // Re-render grid
        this.context?.kernel.getGrid()?.render();

        document.getElementById(modalId)?.remove();
      });
    }

    /**
     * Apply filter to column based on selected values
     */
    private applyColumnFilter(table: any, sheet: any, columnIndex: number, selectedValues: Set<string>): void {
      if (!this.tableManager) return;

      const { range, hasHeaders } = table;
      const dataStartRow = hasHeaders ? range.startRow + 1 : range.startRow;
      const dataEndRow = table.showTotalRow ? range.endRow - 1 : range.endRow;
      const filterCol = range.startCol + columnIndex;

      // Store original visibility state if not exists
      if (!(table as any).hiddenRows) {
        (table as any).hiddenRows = new Set();
      }

      // Apply filter
      for (let row = dataStartRow; row <= dataEndRow; row++) {
        const cell = sheet.getCell(row, filterCol);
        const cellValue = cell?.value != null ? String(cell.value) : '';

        if (selectedValues.has(cellValue)) {
          (table as any).hiddenRows.delete(row);
        } else {
          (table as any).hiddenRows.add(row);
        }
      }

      logger.info('[PivotPlugin] Column filter applied', {
        tableId: table.id,
        columnIndex,
        selectedCount: selectedValues.size,
        hiddenRows: (table as any).hiddenRows.size
      });

      this.context?.ui.showToast('Filtro aplicado com sucesso!', 'success');
    }

    /**
     * ═══════════════════════════════════════════════════════════════════════
     * PARTE 1 - FEATURE 1: GALERIA DE ESTILOS COM PREVIEW
     * ═══════════════════════════════════════════════════════════════════════
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

      // Generate style cards with visual previews
      const stylesHTML = styles.map((style: any) => `
        <div class="style-card" data-style-id="${style.id}" style="
          padding: 16px;
          background: var(--theme-bg-secondary);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.3s ease;
          border: 3px solid ${currentStyle === style.id ? '#667eea' : 'transparent'};
          position: relative;
        ">
          ${currentStyle === style.id ? '<div style="position: absolute; top: 8px; right: 8px; background: #667eea; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700;">✓</div>' : ''}

          <!-- Preview da tabela em miniatura -->
          <div style="margin-bottom: 12px; border-radius: 4px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.15);">
            <!-- Header Preview -->
            <div style="background: ${style.headerBg}; color: ${style.headerText}; padding: 8px; font-weight: 700; font-size: 11px; text-align: center; border-bottom: 1px solid ${style.borderColor};">
              ${style.name}
            </div>
            <!-- Even Row Preview -->
            <div style="background: ${style.evenRowBg}; padding: 6px 8px; font-size: 10px; border-bottom: 1px solid ${style.borderColor}; color: var(--theme-text-primary);">Linha Par • Exemplo</div>
            <!-- Odd Row Preview -->
            <div style="background: ${style.oddRowBg}; padding: 6px 8px; font-size: 10px; border-bottom: 1px solid ${style.borderColor}; color: var(--theme-text-primary);">Linha Ímpar • Exemplo</div>
            <!-- Total Row Preview -->
            <div style="background: ${style.totalRowBg}; color: ${style.headerText}; padding: 6px 8px; font-size: 10px; font-weight: 700; text-align: right;">Total: 1.234</div>
          </div>

          <div style="font-weight: 600; font-size: 14px; color: var(--theme-text-primary); margin-bottom: 4px; text-align: center;">${style.name}</div>
          <div style="font-size: 11px; color: var(--theme-text-secondary); text-align: center;">
            ${currentStyle === style.id ? '✓ Estilo Atual' : 'Clique para aplicar'}
          </div>
        </div>
      `).join('');

      const modalHTML = `
        <div id="styles-gallery-modal" class="modal-overlay" style="background: rgba(0,0,0,0.75); backdrop-filter: blur(10px); display: flex; align-items: center; justify-content: center; position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 10000; animation: fadeIn 0.2s ease;">
          <div class="modal" style="background: var(--theme-bg-primary); border-radius: 16px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); max-width: 950px; width: 95%; max-height: 90vh; overflow: hidden; animation: slideUp 0.3s ease;">
            <!-- Header -->
            <div style="padding: 28px; border-bottom: 2px solid var(--theme-border-color); background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; position: sticky; top: 0; z-index: 1;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <h3 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">🎨 Galeria de Estilos</h3>
                  <p style="margin: 0; opacity: 0.95; font-size: 15px;">Escolha um estilo para "${activeTable.name}"</p>
                </div>
                <button id="close-styles-gallery" style="background: rgba(255,255,255,0.25); border: none; font-size: 32px; cursor: pointer; color: white; width: 44px; height: 44px; border-radius: 50%; transition: all 0.2s; display: flex; align-items: center; justify-content: center; line-height: 1;">&times;</button>
              </div>
            </div>

            <!-- Content -->
            <div style="padding: 28px; overflow-y: auto; max-height: calc(90vh - 180px);">
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 18px;">
                ${stylesHTML}
              </div>
            </div>

            <!-- Footer -->
            <div style="padding: 20px 28px; border-top: 2px solid var(--theme-border-color); background: var(--theme-bg-secondary); position: sticky; bottom: 0;">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <div style="font-size: 13px; color: var(--theme-text-secondary);">
                  💡 <strong>Dica:</strong> O estilo será aplicado imediatamente
                </div>
                <div style="font-size: 12px; color: var(--theme-text-secondary);">
                  ${styles.length} estilos disponíveis
                </div>
              </div>
            </div>
          </div>
        </div>

        <style>
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideUp {
            from { transform: translateY(30px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          #close-styles-gallery:hover {
            background: rgba(255,255,255,0.35) !important;
            transform: rotate(90deg);
          }
        </style>
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
            (card as HTMLElement).style.borderColor = '#667eea80';
            (card as HTMLElement).style.transform = 'translateY(-6px) scale(1.02)';
            (card as HTMLElement).style.boxShadow = '0 12px 28px rgba(102, 126, 234, 0.35)';
          }
        });
        card.addEventListener('mouseleave', () => {
          const styleId = card.getAttribute('data-style-id');
          if (styleId !== currentStyle) {
            (card as HTMLElement).style.borderColor = 'transparent';
            (card as HTMLElement).style.transform = 'translateY(0) scale(1)';
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
     * Apply selected style to table
     */
    private async applyStyleToTable(table: any, sheet: any, styleId: string): Promise<void> {
      if (!this.tableManager || !this.context) return;

      const styles = this.tableManager.getAvailableStyles();
      const newStyle = styles.find((s: any) => s.id === styleId);

      if (!newStyle) return;

      try {
        table.style = newStyle;
        this.tableManager.applyTableFormatting(table, sheet);

        const grid = this.context.kernel.getGrid();
        if (grid) grid.render();

        // CORREÇÃO CRÍTICA: Salvar alterações na persistência
        await this.saveTablesToPersistence();

        this.context.ui.showToast(`✨ Estilo "${newStyle.name}" aplicado com sucesso!`, 'success');
        this.refreshTableStudioPanel();

        logger.info('[TableStudio] Style applied', { tableId: table.id, style: newStyle.id });
      } catch (error) {
        logger.error('[TableStudio] Failed to apply style', error);
        this.context.ui.showToast(`Erro ao aplicar estilo: ${error}`, 'error');
      }
    }

    /**
     * ═══════════════════════════════════════════════════════════════════════
     * PARTE 1 - FEATURE 2: CONVERSÃO TABELA <-> RANGE
     * ═══════════════════════════════════════════════════════════════════════
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
        // Convert range to table (open create dialog)
        this.showCreateTableDialog();
      }
    }

    /**
     * Convert table to normal range
     */
    private async convertTableToRange(table: any, _sheet: any): Promise<void> {
      if (!this.context || !this.tableManager) return;

      const confirmMsg = `Converter tabela "${table.name}" para intervalo normal?\n\n` +
                        `⚠️ Isso removerá:\n` +
                        `• Formatação estruturada da tabela\n` +
                        `• Botões de filtro/ordenação\n` +
                        `• Linha de totais (se houver)\n\n` +
                        `✓ Será mantido:\n` +
                        `• Todos os dados das células\n` +
                        `• Formatação individual das células`;

      if (!window.confirm(confirmMsg)) return;

      try {
        // Remove table from manager
        this.tableManager.deleteTable(table.id);

        const grid = this.context.kernel.getGrid();
        if (grid) grid.render();

        // CORREÇÃO CRÍTICA: Salvar alterações na persistência
        await this.saveTablesToPersistence();

        this.context.ui.showToast(`✓ Tabela convertida para intervalo normal!`, 'success');
        this.refreshTableStudioPanel();

        logger.info('[TableStudio] Table converted to range', { tableId: table.id });
      } catch (error) {
        logger.error('[TableStudio] Failed to convert table to range', error);
        this.context.ui.showToast(`Erro ao converter: ${error}`, 'error');
      }
    }

    /**
     * ═══════════════════════════════════════════════════════════════════════
     * PARTE 1 - FEATURE 3: REDIMENSIONAMENTO DINÂMICO
     * ═══════════════════════════════════════════════════════════════════════
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
      const minRows = activeTable.hasHeaders ? 2 : 1;

      const modalHTML = `
        <div id="resize-table-modal" class="modal-overlay" style="background: rgba(0,0,0,0.75); backdrop-filter: blur(10px); display: flex; align-items: center; justify-content: center; position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 10000;">
          <div class="modal" style="background: var(--theme-bg-primary); border-radius: 16px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); max-width: 550px; width: 90%;">
            <!-- Header -->
            <div style="padding: 28px; border-bottom: 2px solid var(--theme-border-color); background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 16px 16px 0 0;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <h3 style="margin: 0 0 8px 0; font-size: 26px; font-weight: 700;">↔️ Redimensionar Tabela</h3>
                  <p style="margin: 0; opacity: 0.95; font-size: 14px;">${activeTable.name}</p>
                </div>
                <button id="close-resize-modal" style="background: rgba(255,255,255,0.25); border: none; font-size: 32px; cursor: pointer; color: white; width: 42px; height: 42px; border-radius: 50%; transition: all 0.2s;">&times;</button>
              </div>
            </div>

            <!-- Content -->
            <div style="padding: 28px;">
              <!-- Current Size Info -->
              <div style="margin-bottom: 24px; padding: 20px; background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%); border-radius: 12px; border: 2px solid rgba(102, 126, 234, 0.2);">
                <div style="font-weight: 700; margin-bottom: 14px; color: var(--theme-text-primary); font-size: 15px;">📐 Tamanho Atual</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                  <div style="text-align: center; padding: 16px; background: var(--theme-bg-primary); border-radius: 8px;">
                    <div style="color: var(--theme-text-secondary); margin-bottom: 6px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Linhas</div>
                    <div style="font-size: 32px; font-weight: 700; color: #667eea;">${currentRows}</div>
                  </div>
                  <div style="text-align: center; padding: 16px; background: var(--theme-bg-primary); border-radius: 8px;">
                    <div style="color: var(--theme-text-secondary); margin-bottom: 6px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Colunas</div>
                    <div style="font-size: 32px; font-weight: 700; color: #764ba2;">${currentCols}</div>
                  </div>
                </div>
              </div>

              <!-- New Size Inputs -->
              <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 10px; font-weight: 600; color: var(--theme-text-primary); font-size: 14px;">📏 Novo Número de Linhas</label>
                <input type="number" id="new-rows" min="${minRows}" value="${currentRows}" style="
                  width: 100%;
                  padding: 14px;
                  border: 2px solid var(--theme-border-color);
                  border-radius: 8px;
                  font-size: 18px;
                  font-weight: 600;
                  background: var(--theme-bg-secondary);
                  color: var(--theme-text-primary);
                  transition: all 0.2s;
                " onfocus="this.style.borderColor='#667eea'; this.style.boxShadow='0 0 0 3px rgba(102, 126, 234, 0.1)'" onblur="this.style.borderColor='var(--theme-border-color)'; this.style.boxShadow='none'">
                <div style="font-size: 12px; color: var(--theme-text-secondary); margin-top: 6px;">
                  ${activeTable.hasHeaders ? '⚠️ Mínimo 2 linhas (cabeçalho + dados)' : '⚠️ Mínimo 1 linha'}
                </div>
              </div>

              <div style="margin-bottom: 24px;">
                <label style="display: block; margin-bottom: 10px; font-weight: 600; color: var(--theme-text-primary); font-size: 14px;">📏 Novo Número de Colunas</label>
                <input type="number" id="new-cols" min="1" value="${currentCols}" style="
                  width: 100%;
                  padding: 14px;
                  border: 2px solid var(--theme-border-color);
                  border-radius: 8px;
                  font-size: 18px;
                  font-weight: 600;
                  background: var(--theme-bg-secondary);
                  color: var(--theme-text-primary);
                  transition: all 0.2s;
                " onfocus="this.style.borderColor='#667eea'; this.style.boxShadow='0 0 0 3px rgba(102, 126, 234, 0.1)'" onblur="this.style.borderColor='var(--theme-border-color)'; this.style.boxShadow='none'">
                <div style="font-size: 12px; color: var(--theme-text-secondary); margin-top: 6px;">⚠️ Mínimo 1 coluna</div>
              </div>

              <!-- Warning -->
              <div style="padding: 16px; background: rgba(239, 68, 68, 0.1); border-radius: 8px; border-left: 4px solid #ef4444;">
                <div style="font-size: 13px; color: var(--theme-text-primary); line-height: 1.6;">
                  <strong style="color: #ef4444;">⚠️ Atenção:</strong><br>
                  • Reduzir o tamanho pode resultar em <strong>perda de dados</strong><br>
                  • Expandir adicionará células vazias automaticamente
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div style="padding: 20px 28px; border-top: 2px solid var(--theme-border-color); background: var(--theme-bg-secondary); border-radius: 0 0 16px 16px; display: flex; gap: 12px; justify-content: flex-end;">
              <button id="cancel-resize-btn" style="padding: 12px 24px; background: var(--theme-bg-primary); color: var(--theme-text-primary); border: 2px solid var(--theme-border-color); border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px; transition: all 0.2s;">Cancelar</button>
              <button id="apply-resize-btn" style="padding: 12px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px; transition: all 0.2s; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);">↔️ Redimensionar</button>
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

        if (isNaN(newRows) || isNaN(newCols) || newRows < minRows || newCols < 1) {
          this.context?.ui.showToast('❌ Valores inválidos!', 'error');
          return;
        }

        this.resizeTable(activeTable, sheet, newRows, newCols);
        document.getElementById('resize-table-modal')?.remove();
      });
    }

    /**
     * Resize table to new dimensions
     */
    private async resizeTable(table: any, sheet: any, newRows: number, newCols: number): Promise<void> {
      if (!this.context || !this.tableManager) return;

      try {
        const { range, hasHeaders } = table;
        const minRows = hasHeaders ? 2 : 1;

        if (newRows < minRows) {
          this.context.ui.showToast(`❌ A tabela precisa de pelo menos ${minRows} linhas!`, 'error');
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
              id: `col_${Date.now()}_${i}`,
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
          // CORREÇÃO CRÍTICA: Usar applyTotalsWithCalculation
          await this.applyTotalsWithCalculation(table, sheet);
        }

        const grid = this.context.kernel.getGrid();
        if (grid) grid.render();

        // CORREÇÃO CRÍTICA: Salvar alterações na persistência
        await this.saveTablesToPersistence();

        this.context.ui.showToast(`✓ Tabela redimensionada para ${newRows} × ${newCols}!`, 'success');
        this.refreshTableStudioPanel();

        logger.info('[TableStudio] Table resized', { tableId: table.id, newRows, newCols });
      } catch (error) {
        logger.error('[TableStudio] Failed to resize table', error);
        this.context.ui.showToast(`❌ Erro ao redimensionar: ${error}`, 'error');
      }
    }
    /**
     * ═══════════════════════════════════════════════════════════════════════
     * CORREÇÃO CRÍTICA: MELHOR RECONHECIMENTO DE TABELAS
     * ═══════════════════════════════════════════════════════════════════════
     */
    private findTableAtCell(sheet: any, row: number, col: number): any {
      if (!this.tableManager) {
        logger.error('[TableStudio] ❌ TableManager not initialized!');
        return null;
      }

      const tables = this.tableManager.listTables();
      logger.info('[TableStudio] 🔍 Finding table at cell', {
        row,
        col,
        sheetId: sheet?.id,
        totalTables: tables.length,
        tablesInSystem: tables.map((t: any) => ({ id: t.id, name: t.name, sheetId: t.sheetId }))
      });

      if (tables.length === 0) {
        logger.warn('[TableStudio] ⚠️ No tables registered in TableManager! Tables array is empty.');
        return null;
      }

      // First, filter tables by sheet ID
      const tablesInSheet = tables.filter((t: any) => t.sheetId === sheet.id);
      logger.info('[TableStudio] Tables in current sheet', {
        count: tablesInSheet.length,
        tables: tablesInSheet.map((t: any) => ({
          id: t.id,
          name: t.name,
          range: t.range
        }))
      });

      if (tablesInSheet.length === 0) {
        logger.warn('[TableStudio] ⚠️ No tables found in current sheet', { currentSheetId: sheet.id });
        return null;
      }

      // Search for table containing the cell
      for (const table of tablesInSheet) {
        const { range } = table;
        const isInRange = row >= range.startRow && row <= range.endRow &&
                         col >= range.startCol && col <= range.endCol;

        logger.debug('[TableStudio] Checking table', {
          tableName: table.name,
          range: range,
          cellPosition: { row, col },
          isInRange
        });

        if (isInRange) {
          logger.info('[TableStudio] ✅ Table FOUND at cell!', {
            tableId: table.id,
            tableName: table.name,
            range: range,
            cellPosition: { row, col }
          });
          return table;
        }
      }

      logger.warn('[TableStudio] ⚠️ No table found at cell position', { row, col });
      return null;
    }

    /**
     * ═══════════════════════════════════════════════════════════════════════
     * CORREÇÃO CRÍTICA: PERSISTÊNCIA DE TABELAS NO INDEXEDDB
     * ═══════════════════════════════════════════════════════════════════════
     */
    private async saveTablesToPersistence(): Promise<void> {
      if (!this.tableManager || !this.context) {
        logger.error('[TableStudio] ❌ Cannot save tables - TableManager or context missing');
        return;
      }

      try {
        const tables = this.tableManager.listTables();

        logger.info('[TableStudio] 💾 Saving tables to persistence...', {
          count: tables.length,
          tableIds: tables.map((t: any) => t.id),
          tableNames: tables.map((t: any) => t.name)
        });

        const tablesData = tables.map((table: any) => ({
          id: table.id,
          name: table.name,
          sheetId: table.sheetId,
          range: table.range,
          hasHeaders: table.hasHeaders,
          columns: table.columns,
          style: table.style,
          showTotalRow: table.showTotalRow,
          showHeaderRow: table.showHeaderRow,
          showBandedRows: table.showBandedRows,
          showBandedColumns: table.showBandedColumns,
          showFilterButtons: table.showFilterButtons,
          created: table.created,
          modified: new Date()
        }));

        logger.info('[TableStudio] 📝 Tables data to save:', {
          count: tablesData.length,
          data: tablesData
        });

        // Save to plugin storage
        await this.context.storage.set('structured-tables', tablesData);

        logger.info('[TableStudio] ✅ Tables saved to persistence successfully!', {
          count: tablesData.length
        });

        // Verify it was saved by reading it back
        const verification = await this.context.storage.get('structured-tables');
        logger.info('[TableStudio] 🔍 Verification - Reading back from storage:', {
          hasData: !!verification,
          isArray: Array.isArray(verification),
          count: Array.isArray(verification) ? verification.length : 0,
          data: verification
        });
      } catch (error) {
        logger.error('[TableStudio] ❌ Failed to save tables', error);
      }
    }

    /**
     * Load tables from persistence
     */
    private async loadTablesFromPersistence(): Promise<void> {
      if (!this.tableManager || !this.context) {
        logger.error('[TableStudio] ❌ Cannot load tables - TableManager or context missing');
        return;
      }

      try {
        logger.info('[TableStudio] 📂 Attempting to load tables from IndexedDB...');

        const tablesData = await this.context.storage.get('structured-tables') as any[];

        logger.info('[TableStudio] 📦 Storage get result:', {
          hasData: !!tablesData,
          isArray: Array.isArray(tablesData),
          type: typeof tablesData,
          data: tablesData
        });

        if (!tablesData || !Array.isArray(tablesData)) {
          logger.info('[TableStudio] No tables found in persistence');
          return;
        }

        if (tablesData.length === 0) {
          logger.info('[TableStudio] Tables array is empty in persistence');
          return;
        }

        logger.info('[TableStudio] 🔄 Loading tables from persistence', {
          count: tablesData.length,
          tableNames: tablesData.map((t: any) => t.name)
        });

        // First, restore all tables to TableManager
        for (const tableData of tablesData) {
          // Restore table to manager
          const table = {
            ...tableData,
            created: new Date(tableData.created),
            modified: new Date(tableData.modified)
          };

          // Register table in manager's internal Map
          (this.tableManager as any).tables.set(table.id, table);

          logger.info('[TableStudio] ✅ Table restored to TableManager', {
            id: table.id,
            name: table.name,
            sheetId: table.sheetId,
            range: table.range
          });
        }

        // Verify tables are in TableManager
        const allTables = this.tableManager.listTables();
        logger.info('[TableStudio] 📊 Tables in TableManager after restoration', {
          count: allTables.length,
          tables: allTables.map((t: any) => ({ id: t.id, name: t.name, sheetId: t.sheetId }))
        });

        // Wait a bit for sheets to be ready
        await new Promise(resolve => setTimeout(resolve, 100));

        // Get ALL sheets and apply formatting to tables in each sheet
        const workbook = this.context.kernel.workbookManager.getActiveWorkbook();
        if (!workbook) {
          logger.warn('[TableStudio] ⚠️ No active workbook found');
          return;
        }

        logger.info('[TableStudio] 🎨 Applying formatting to restored tables...', {
          workbookId: workbook.id,
          sheetCount: workbook.sheets.length
        });

        for (const sheet of workbook.sheets) {
          for (const tableData of tablesData) {
            if (tableData.sheetId === sheet.id) {
              const table = (this.tableManager as any).tables.get(tableData.id);
              if (table) {
                logger.info('[TableStudio] Formatting table in sheet', {
                  tableId: table.id,
                  tableName: table.name,
                  sheetId: sheet.id,
                  sheetName: sheet.name
                });

                this.tableManager.applyTableFormatting(table, sheet);
                this.tableManager.addHeaderButtons(table, sheet);

                if (table.showTotalRow) {
                  await this.applyTotalsWithCalculation(table, sheet);
                }

                logger.info('[TableStudio] ✅ Table formatting applied', { tableId: table.id });
              }
            }
          }
        }

        const grid = this.context.kernel.getGrid();
        if (grid) {
          logger.info('[TableStudio] 🖼️ Rendering grid with restored tables');
          grid.render();
        }

        logger.info('[TableStudio] ✅ All tables loaded and formatted successfully!', {
          totalTablesLoaded: allTables.length
        });

        // CRITICAL: Force refresh of panel after tables are loaded
        setTimeout(() => {
          logger.info('[TableStudio] 🔄 Triggering post-load panel refresh...');
          this.refreshTableStudioPanel();
        }, 200);

      } catch (error) {
        logger.error('[TableStudio] ❌ Failed to load tables from persistence', error);
      }
    }

    /**
     * ═══════════════════════════════════════════════════════════════════════
     * CORREÇÃO CRÍTICA: TOTAIS COM CÁLCULO AUTOMÁTICO (NÃO TEXTO)
     * ═══════════════════════════════════════════════════════════════════════
     */
    private async applyTotalsWithCalculation(table: any, sheet: any): Promise<void> {
      if (!this.tableManager || !this.context) return;

      try {
        // Apply formulas using TableManager
        this.tableManager.applyTotals(table, sheet);

        // Force recalculation of all formulas in the total row
        const { range } = table;
        const totalRow = range.endRow;

        logger.info('[TableStudio] Applying totals with auto-calculation', {
          tableId: table.id,
          totalRow
        });

        // Wait a bit for cells to be set
        await new Promise(resolve => setTimeout(resolve, 50));

        // CORREÇÃO: Usar context.kernel.calcEngine.recalculate(sheet) em vez de context.kernel.recalculate(sheet.id)
        // O CalcEngine recebe o objeto Sheet, não o ID
        await this.context.kernel.calcEngine.recalculate(sheet);

        logger.info('[TableStudio] Total row formulas calculated successfully');
      } catch (error) {
        logger.error('[TableStudio] Failed to calculate totals', error);
        this.context?.ui.showToast('⚠️ Erro ao calcular totais', 'warning');
      }
    }



    /**
     * Handle filter button click from grid
     */
    private handleGridFilterButtonClick(data: { table: any, sheet: any, columnIndex: number, clientX: number, clientY: number }): void {
      if (!this.tableManager || !this.context) return;

      const { table, sheet, columnIndex, clientX, clientY } = data;

      this.tableManager.showHeaderMenu(
        table,
        sheet,
        columnIndex,
        clientX,
        clientY,
        (ascending: boolean) => {
          this.sortTableColumn(table, sheet, columnIndex, ascending);
        },
        () => {
          this.filterTableColumn(table, sheet, columnIndex);
        },
        () => {
          this.clearColumnSort(table, sheet, columnIndex);
        },
        () => {
          this.clearColumnFilter(table, sheet, columnIndex);
        }
      );
    }

    /**
     * Refresh the Table Studio panel
     */
    private refreshTableStudioPanel(): void {
      logger.debug('[TableStudio] Refresh panel requested');

      // Try to find panel by stored reference first
      if (this.panelContainer) {
        logger.debug('[TableStudio] Using stored panel container reference');
        this.renderTableStudioPanel(this.panelContainer);
        return;
      }

      // Fallback: try to find by ID
      const panel = document.getElementById('table-studio-content')?.parentElement;
      if (panel) {
        logger.debug('[TableStudio] Found panel by DOM ID');
        this.panelContainer = panel;
        this.renderTableStudioPanel(panel);
        return;
      }

      logger.warn('[TableStudio] ⚠️ Cannot refresh panel - container not found');
    }

    /**
     * Render comprehensive Table Studio panel with modern design
     */
    private renderTableStudioPanel(container: HTMLElement): void{
      logger.debug('[TableStudio] 🎨 Rendering panel...');

      if (!this.context || !this.tableManager) {
        logger.error('[TableStudio] ❌ Cannot render - context or TableManager missing');
        container.innerHTML = `
          <div style="padding: 16px; color: var(--theme-text-secondary);">
            <p>❌ TableManager não está inicializado.</p>
          </div>
        `;
        return;
      }

      const sheet = this.context.kernel.workbookManager.getActiveSheet();
      if (!sheet) {
        logger.warn('[TableStudio] ⚠️ No active sheet');
        container.innerHTML = `
          <div style="padding: 16px; color: var(--theme-text-secondary);">
            <p>⚠️ Selecione uma planilha para ver as ferramentas de tabela.</p>
          </div>
        `;
        return;
      }

      // Get all tables in the active sheet
      const allTables = this.tableManager.listTables();
      const tables = this.tableManager.getTablesBySheet(sheet.id);

      logger.info('[TableStudio] 📊 Rendering panel with current state', {
        sheetId: sheet.id,
        sheetName: sheet.name,
        tablesInCurrentSheet: tables.length,
        totalTablesInManager: allTables.length,
        allTablesDetails: allTables.map((t: any) => ({
          id: t.id,
          name: t.name,
          sheetId: t.sheetId
        }))
      });

      // Get table at active cell if any
      const grid = this.context.kernel.getGrid();
      let activeTable = null;
      if (grid) {
        logger.debug('[TableStudio] Checking for active table at grid position', {
          activeRow: grid.activeRow,
          activeCol: grid.activeCol
        });
        activeTable = this.findTableAtCell(sheet, grid.activeRow, grid.activeCol);

        if (activeTable) {
          logger.info('[TableStudio] ✅ Active table found for panel display', {
            tableId: activeTable.id,
            tableName: activeTable.name
          });
        } else {
          logger.debug('[TableStudio] No active table at current cell');
        }
      }

      const panelHTML = `
        <div id="table-studio-content" style="padding: 16px; color: var(--theme-text-primary); font-size: 13px;">
          <!-- Header -->
          <div style="margin-bottom: 24px; padding: 16px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; color: white;">
            <div style="font-size: 20px; font-weight: 700; margin-bottom: 4px;">✨ Table Studio</div>
            <div style="font-size: 11px; opacity: 0.9;">Motor inteligente de análise de tabelas</div>
          </div>

          <!-- Tables List -->
          <div style="margin-bottom: 20px;">
            <h4 style="margin: 0 0 12px 0; font-size: 14px; color: var(--theme-text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">
              📊 Tabelas na Planilha
            </h4>
            ${tables.length === 0 ? `
              <div style="padding: 12px; background: var(--theme-bg-secondary); border-radius: 6px; color: var(--theme-text-secondary); text-align: center;">
                Nenhuma tabela criada
              </div>
            ` : `
              <div style="display: flex; flex-direction: column; gap: 8px;">
                ${tables.map((table: any) => `
                  <div style="
                    padding: 12px;
                    background: ${activeTable?.id === table.id ? 'var(--theme-color-primary)' : 'var(--theme-bg-secondary)'};
                    color: ${activeTable?.id === table.id ? 'white' : 'var(--theme-text-primary)'};
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.2s;
                    border: 1px solid ${activeTable?.id === table.id ? 'var(--theme-color-primary)' : 'var(--theme-border-color)'};
                  " class="table-item" data-table-id="${table.id}">
                    <div style="font-weight: 600; margin-bottom: 4px;">${table.name}</div>
                    <div style="font-size: 11px; opacity: 0.8;">
                      ${table.columns.length} colunas • ${table.range.endRow - table.range.startRow + 1} linhas
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>

          <!-- Active Table Info -->
          ${activeTable ? `
            <div style="margin-bottom: 20px; padding: 16px; background: var(--theme-bg-secondary); border-radius: 8px; border-left: 4px solid var(--theme-color-primary);">
              <h4 style="margin: 0 0 12px 0; font-size: 14px; color: var(--theme-text-primary);">
                ✨ Tabela Selecionada
              </h4>
              <div style="margin-bottom: 12px;">
                <strong>${activeTable.name}</strong>
              </div>
              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; font-size: 12px; color: var(--theme-text-secondary);">
                <div>
                  <div style="font-weight: 600;">Colunas</div>
                  <div>${activeTable.columns.length}</div>
                </div>
                <div>
                  <div style="font-weight: 600;">Linhas</div>
                  <div>${activeTable.range.endRow - activeTable.range.startRow + 1}</div>
                </div>
                <div>
                  <div style="font-weight: 600;">Estilo</div>
                  <div>${activeTable.style.name}</div>
                </div>
                <div>
                  <div style="font-weight: 600;">Filtros</div>
                  <div>${activeTable.showFilterButtons ? '✓ Ativos' : '✗ Inativos'}</div>
                </div>
              </div>

              <!-- Column Details -->
              <div style="margin-top: 16px;">
                <div style="font-weight: 600; margin-bottom: 8px; font-size: 12px; color: var(--theme-text-secondary);">
                  Colunas:
                </div>
                <div style="max-height: 200px; overflow-y: auto;">
                  ${activeTable.columns.map((col: any) => {
                    const state = (activeTable as any).columnStates?.get(col.index) || { sorted: null, filtered: false };
                    return `
                      <div style="
                        padding: 8px;
                        margin-bottom: 4px;
                        background: var(--theme-bg-primary);
                        border-radius: 4px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        font-size: 11px;
                      ">
                        <div>
                          <div style="font-weight: 600;">${col.name}</div>
                          <div style="color: var(--theme-text-secondary); font-size: 10px;">${col.dataType}</div>
                        </div>
                        <div style="display: flex; gap: 4px; align-items: center;">
                          ${state.sorted ? `<span title="Ordenado ${state.sorted === 'asc' ? 'crescente' : 'decrescente'}">${state.sorted === 'asc' ? '🔼' : '🔽'}</span>` : ''}
                          ${state.filtered ? '<span title="Filtrado">🔍</span>' : ''}
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            </div>
          ` : ''}

          <!-- Quick Actions -->
          <div style="margin-bottom: 20px;">
            <h4 style="margin: 0 0 12px 0; font-size: 14px; color: var(--theme-text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">
              ⚡ Ações Rápidas
            </h4>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <button id="quick-create-table" style="
                padding: 10px 14px;
                background: var(--theme-color-primary);
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 600;
                display: flex;
                align-items: center;
                gap: 8px;
                transition: all 0.2s;
              ">
                <span>📊</span>
                <span>Criar Nova Tabela</span>
              </button>
              ${activeTable ? `
                <button id="quick-delete-table" style="
                  padding: 10px 14px;
                  background: #ef4444;
                  color: white;
                  border: none;
                  border-radius: 6px;
                  cursor: pointer;
                  font-weight: 600;
                  display: flex;
                  align-items: center;
                  gap: 8px;
                  transition: all 0.2s;
                ">
                  <span>🗑️</span>
                  <span>Excluir Tabela Atual</span>
                </button>
              ` : ''}
            </div>
          </div>

          <!-- Tips -->
          <div style="padding: 12px; background: var(--theme-bg-secondary); border-radius: 6px; font-size: 11px; color: var(--theme-text-secondary);">
            <div style="font-weight: 600; margin-bottom: 6px;">💡 Dica:</div>
            <div>Clique nos ícones ▼ nos cabeçalhos das tabelas para acessar opções de ordenação e filtro!</div>
          </div>
        </div>
      `;

      container.innerHTML = panelHTML;

      // Setup event listeners
      const createBtn = container.querySelector('#quick-create-table');
      if (createBtn) {
        createBtn.addEventListener('click', () => {
          this.showCreateTableDialog();
        });
      }

      const deleteBtn = container.querySelector('#quick-delete-table');
      if (deleteBtn && activeTable) {
        deleteBtn.addEventListener('click', async () => {
          if (confirm(`Tem certeza que deseja excluir a tabela "${activeTable.name}"?`)) {
            try {
              this.tableManager!.deleteTable(activeTable.id);

              // CORREÇÃO CRÍTICA: Salvar alterações na persistência
              await this.saveTablesToPersistence();

              this.context!.ui.showToast('Tabela excluída com sucesso', 'success');
              this.renderTableStudioPanel(container); // Refresh panel
              const grid = this.context!.kernel.getGrid();
              if (grid) grid.render();
            } catch (error) {
              logger.error('[PivotPlugin] Failed to delete table', error);
              this.context!.ui.showToast('Erro ao excluir tabela', 'error');
            }
          }
        });
      }

      // Add hover effects to table items
      const tableItems = container.querySelectorAll('.table-item');
      tableItems.forEach(item => {
        item.addEventListener('mouseenter', () => {
          if (!(item as HTMLElement).style.background.includes('var(--theme-color-primary)')) {
            (item as HTMLElement).style.background = 'var(--theme-bg-hover)';
          }
        });
        item.addEventListener('mouseleave', () => {
          const tableId = item.getAttribute('data-table-id');
          if (activeTable?.id !== tableId) {
            (item as HTMLElement).style.background = 'var(--theme-bg-secondary)';
          }
        });
      });
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
  
