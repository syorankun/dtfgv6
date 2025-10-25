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
  // BUILT-IN PLUGIN: PIVOT TABLE
  // ============================================================================
  
  export class PivotPlugin implements Plugin {
    manifest: PluginManifest = {
      id: 'pivot',
      name: 'Pivot Table',
      version: '1.0.0',
      author: 'DJ DataForge Team',
      description: 'Tabelas dinâmicas para análise de dados',
      permissions: ['read:workbook', 'write:workbook', 'ui:panel'],
      entryPoint: 'pivot.js',
    };
    
    async init(context: PluginContext): Promise<void> {
      context.ui.addToolbarButton({
        id: 'create-pivot',
        label: 'Tabela Dinâmica',
        icon: '🔄',
        tooltip: 'Criar tabela dinâmica',
        onClick: () => {
          context.ui.showToast('Tabela dinâmica: selecione dados e configure agrupamentos', 'info');
        },
      });
      
      context.ui.showToast('Pivot Table plugin carregado!', 'success');
      logger.info('[PivotPlugin] Initialized');
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
  
