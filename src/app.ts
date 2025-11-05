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
import { FXPackPlugin, PivotPlugin } from './@core/plugin-system-consolidated';
import { ChartsPlugin } from './plugins/charts-plugin';
import { ProLeasePlugin } from './plugins/prolease-ifrs16-plugin';
import { FXFinancePlugin } from './plugins/fx-finance-plugin';
import { LoanPlugin } from './plugins/loan';
import { UIManager } from './ui-manager';
import './style.css';

class DJDataForgeApp {
  private uiManager: UIManager;

  constructor() {
    const appElement = document.getElementById('app');
    if (!appElement) throw new Error('App container not found');
    this.uiManager = new UIManager(appElement);
  }
  
  async init(): Promise<void> {
    try {
      logger.info('[App] Starting DJ DataForge v6 FULL...');
      this.uiManager.showLoading();

      // Initialize kernel
      await kernel.init();

      // Setup UI
      this.uiManager.initUI();

      // Load plugins
      await this.loadBuiltInPlugins();

      // Load saved custom plugins
      await this.uiManager.loadSavedPlugins();

      // Refresh plugin count in UI
      this.uiManager.refreshPluginCount();

      this.uiManager.hideLoading();
      this.setupErrorHandler();
      logger.info('[App] Application ready - ALL PHASES COMPLETE!');
    } catch (error) {
      logger.error('[App] Initialization failed', error);
      this.uiManager.showError('Falha ao inicializar aplicação. Veja o console para detalhes.');
    }
  }
  
  private async loadBuiltInPlugins(): Promise<void> {
    try {
      await kernel['pluginHost'].loadPlugin(
        { default: FXPackPlugin },
        new FXPackPlugin().manifest
      );
      await kernel['pluginHost'].loadPlugin(
        { default: ChartsPlugin },
        new ChartsPlugin().manifest
      );
      await kernel['pluginHost'].loadPlugin(
        { default: PivotPlugin },
        new PivotPlugin().manifest
      );
      await kernel['pluginHost'].loadPlugin(
        { default: ProLeasePlugin },
        new ProLeasePlugin().manifest
      );
      await kernel['pluginHost'].loadPlugin(
        { default: FXFinancePlugin },
        new FXFinancePlugin().manifest
      );
      await kernel['pluginHost'].loadPlugin(
        { default: LoanPlugin },
        new LoanPlugin().manifest
      );
      logger.info('[App] Built-in plugins loaded');
    } catch (error) {
      logger.error('[App] Failed to load plugins', error);
    }
  }
  
  private setupErrorHandler(): void {
    window.addEventListener('error', (event) => {
      logger.error('[App] Uncaught error', event.error);
    });
    
    window.addEventListener('unhandledrejection', (event) => {
      logger.error('[App] Unhandled promise rejection', event.reason);
    });
  }
}

const app = new DJDataForgeApp();
app.init();

if (typeof window !== 'undefined') {
  (window as any).DJApp = app;
}
