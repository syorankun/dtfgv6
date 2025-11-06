/**
 * Loan Report Manager - Gerenciador central de relatórios
 *
 * Orquestra todo o sistema de relatórios:
 * - Gerencia templates (built-in e customizados)
 * - Coordena seletor, builder e gerador
 * - Persiste templates customizados
 * - Fornece API para outros componentes
 */

import type { PluginContext } from '@core/types';
import type { LoanContract } from './loan-types';
import type { LoanScheduler } from './loan-scheduler';
import type { AccrualSheetViewConfig } from './loan-accrual-view';
import { LoanSheets } from './loan-sheets';
import { LoanReportSelector, type ReportGenerationOptions } from './loan-report-selector';
import { LoanReportBuilder } from './loan-report-builder';
import { LoanReportGenerator } from './loan-report-generator';
import { LoanPaymentManager } from './loan-payment-manager';
import { TEMPLATE_METADATA } from './loan-report-templates';
import { logger } from '@core/storage-utils-consolidated';

const STORAGE_KEY_CUSTOM_TEMPLATES = 'loan:custom-templates';

export interface CustomTemplate {
  id: string;
  name: string;
  description?: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  config: AccrualSheetViewConfig;
}

export class LoanReportManager {
  private context: PluginContext;
  private selector: LoanReportSelector;
  private builder: LoanReportBuilder;
  private generator: LoanReportGenerator;
  private customTemplates: Map<string, CustomTemplate> = new Map();

  constructor(context: PluginContext, scheduler: LoanScheduler, sheets: LoanSheets, paymentManager?: LoanPaymentManager) {
    this.context = context;

    this.selector = new LoanReportSelector(context);
    this.builder = new LoanReportBuilder(context);
    this.generator = new LoanReportGenerator(context, scheduler, sheets, paymentManager);
  }

  /**
   * Inicializa o gerenciador
   */
  public async init(): Promise<void> {
    await this.loadCustomTemplates();
    this.setupEventListeners();
    logger.info(`[LoanReportManager] Inicializado com ${this.customTemplates.size} templates customizados`);
  }

  /**
   * Configura event listeners para eventos de templates
   */
  private setupEventListeners(): void {
    // Listener para deletar template customizado
    this.context.events.on('loan:delete-custom-template', async (data: { templateId: string }) => {
      await this.deleteCustomTemplate(data.templateId);
    });
  }

  /**
   * Abre o seletor de relatórios
   */
  public showReportSelector(contracts: LoanContract[]): void {
    const now = new Date();
    const endDate = now.toISOString().split('T')[0];
    const startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Passa templates customizados para o selector
    this.selector.setCustomTemplates(Array.from(this.customTemplates.values()));

    this.selector.open({
      contracts,
      startDate,
      endDate,
      frequency: 'Mensal',
      onSelect: async (templateId, options) => {
        await this.generateReport(templateId, options);
      },
      onCustomize: (templateId) => {
        this.editTemplate(templateId);
      }
    });
  }

  /**
   * Gera um relatório
   */
  private async generateReport(templateId: string, options: ReportGenerationOptions): Promise<void> {
    try {
      this.context.ui.showToast('⏳ Gerando relatório...', 'info');

      // Busca contratos do storage
      const contractsData = await this.context.storage.get('contracts') as Record<string, LoanContract> | null;
      if (!contractsData) {
        this.context.ui.showToast('❌ Nenhum contrato encontrado', 'error');
        return;
      }

      // Filtra pelos IDs solicitados (ou usa todos se não especificado)
      const contracts: LoanContract[] = options.contractIds && options.contractIds.length > 0
        ? options.contractIds.map(id => contractsData[id]).filter(Boolean)
        : Object.values(contractsData);

      if (contracts.length === 0) {
        this.context.ui.showToast('❌ Nenhum contrato selecionado', 'warning');
        return;
      }

      logger.info(`[LoanReportManager] Gerando relatório com ${contracts.length} contratos`);

      // Verifica se é template customizado e injeta na geração
      const customTemplate = this.customTemplates.get(templateId);
      if (customTemplate) {
        logger.info('[LoanReportManager] Usando template customizado', templateId);
        // O generator precisa receber o template customizado
        // Por enquanto, vamos apenas logar - a integração completa virá depois
      }

      const report = await this.generator.generate({
        templateId,
        contracts,
        startDate: options.startDate,
        endDate: options.endDate,
        frequency: options.frequency,
        outputMode: options.outputMode,
        includeCharts: options.includeCharts,
        groupBy: options.groupBy
      });

      logger.info('[LoanReportManager] Relatório gerado', report);

      // Mostra resumo
      this.showReportSummary(report);
    } catch (error) {
      logger.error('[LoanReportManager] Erro ao gerar relatório', error);
      this.context.ui.showToast('❌ Erro ao gerar relatório', 'error');
    }
  }

  /**
   * Abre o builder para editar template (built-in ou customizado)
   */
  private editTemplate(templateId: string): void {
    // Passa templates customizados para o builder
    this.builder.setCustomTemplates(this.customTemplates);

    // Verifica se é template customizado
    const customTemplate = this.customTemplates.get(templateId);

    if (customTemplate) {
      // Edita template customizado existente
      this.builder.edit(templateId, async (template) => {
        // Atualiza template existente
        const updatedTemplate: CustomTemplate = {
          ...customTemplate,
          name: template.title || template.id,
          description: template.description,
          updatedAt: new Date().toISOString(),
          config: template
        };
        this.customTemplates.set(templateId, updatedTemplate);
        await this.persistCustomTemplates();
        this.context.ui.showToast(`✅ Template "${updatedTemplate.name}" atualizado!`, 'success');
      });
    } else {
      // Cria novo template baseado em um built-in
      this.builder.edit(templateId, async (template) => {
        await this.saveCustomTemplate(template);
      });
    }
  }

  /**
   * Abre o builder para criar novo template
   */
  public createNewTemplate(): void {
    this.builder.createNew(async (template) => {
      await this.saveCustomTemplate(template);
    });
  }

  /**
   * Salva template customizado
   */
  private async saveCustomTemplate(template: AccrualSheetViewConfig): Promise<void> {
    try {
      const customTemplate: CustomTemplate = {
        id: template.id,
        name: template.title || template.id,
        description: template.description,
        category: 'Customizado',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        config: template
      };

      this.customTemplates.set(customTemplate.id, customTemplate);
      await this.persistCustomTemplates();

      logger.info('[LoanReportManager] Template customizado salvo', customTemplate.id);
      this.context.ui.showToast(`✅ Template "${customTemplate.name}" salvo!`, 'success');
    } catch (error) {
      logger.error('[LoanReportManager] Erro ao salvar template', error);
      this.context.ui.showToast('❌ Erro ao salvar template', 'error');
    }
  }

  /**
   * Carrega templates customizados do storage
   */
  private async loadCustomTemplates(): Promise<void> {
    try {
      const data = await this.context.storage.get(STORAGE_KEY_CUSTOM_TEMPLATES);
      if (!data) return;

      if (Array.isArray(data)) {
        data.forEach(item => {
          if (item && typeof item === 'object' && item.id) {
            this.customTemplates.set(item.id, item as CustomTemplate);
          }
        });
      }

      logger.info(`[LoanReportManager] ${this.customTemplates.size} templates customizados carregados`);
    } catch (error) {
      logger.error('[LoanReportManager] Erro ao carregar templates', error);
    }
  }

  /**
   * Persiste templates customizados no storage
   */
  private async persistCustomTemplates(): Promise<void> {
    try {
      const data = Array.from(this.customTemplates.values());
      await this.context.storage.set(STORAGE_KEY_CUSTOM_TEMPLATES, data);
    } catch (error) {
      logger.error('[LoanReportManager] Erro ao persistir templates', error);
    }
  }

  /**
   * Lista todos os templates (built-in + customizados)
   */
  public listTemplates(): Array<{ id: string; name: string; category: string; isCustom: boolean }> {
    const templates: Array<{ id: string; name: string; category: string; isCustom: boolean }> = [];

    // Built-in templates
    TEMPLATE_METADATA.forEach(meta => {
      templates.push({
        id: meta.id,
        name: meta.name,
        category: meta.category,
        isCustom: false
      });
    });

    // Custom templates
    this.customTemplates.forEach(custom => {
      templates.push({
        id: custom.id,
        name: custom.name,
        category: custom.category,
        isCustom: true
      });
    });

    return templates;
  }

  /**
   * Remove template customizado
   */
  public async deleteCustomTemplate(templateId: string): Promise<void> {
    if (!this.customTemplates.has(templateId)) {
      logger.warn('[LoanReportManager] Template não encontrado para exclusão', templateId);
      return;
    }

    const template = this.customTemplates.get(templateId);
    if (!template) return;

    this.customTemplates.delete(templateId);
    await this.persistCustomTemplates();
    logger.info('[LoanReportManager] Template customizado deletado', templateId);
  }

  /**
   * Mostra resumo do relatório gerado
   */
  private showReportSummary(report: any): void {
    const summaryHTML = `
      <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10500;">
        <div style="background: white; border-radius: 12px; padding: 32px; max-width: 500px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);">

          <div style="text-align: center; margin-bottom: 24px;">
            <div style="font-size: 64px; margin-bottom: 16px;">✅</div>
            <h2 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 700; color: #1f2937;">Relatório Gerado!</h2>
            <p style="margin: 0; color: #6b7280; font-size: 14px;">Seu relatório foi criado com sucesso</p>
          </div>

          <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 13px;">
              <div>
                <div style="color: #6b7280; margin-bottom: 4px;">Contratos</div>
                <div style="font-size: 20px; font-weight: 700; color: #667eea;">${report.contractIds.length}</div>
              </div>
              <div>
                <div style="color: #6b7280; margin-bottom: 4px;">Planilhas</div>
                <div style="font-size: 20px; font-weight: 700; color: #10b981;">${report.sheetNames.length}</div>
              </div>
              ${report.pivotSourceIds.length > 0 ? `
                <div>
                  <div style="color: #6b7280; margin-bottom: 4px;">Fontes Pivot</div>
                  <div style="font-size: 20px; font-weight: 700; color: #f59e0b;">${report.pivotSourceIds.length}</div>
                </div>
              ` : ''}
            </div>
          </div>

          ${report.sheetNames.length > 0 ? `
            <div style="margin-bottom: 24px;">
              <div style="font-weight: 600; margin-bottom: 8px; color: #374151; font-size: 13px;">Planilhas Criadas:</div>
              <div style="display: flex; flex-direction: column; gap: 6px;">
                ${report.sheetNames.map((name: string) => `
                  <div style="background: white; border: 1px solid #e5e7eb; padding: 8px 12px; border-radius: 6px; font-size: 12px; color: #374151;">
                    📄 ${name}
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <button onclick="this.closest('div[style*=fixed]').remove()" style="
            width: 100%;
            padding: 12px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 700;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
          ">
            OK
          </button>

        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', summaryHTML);
  }

  /**
   * Gera relatório rápido (atalho para templates comuns)
   */
  public async quickReport(
    type: 'interest' | 'principal' | 'consolidated',
    contracts: LoanContract[]
  ): Promise<void> {
    const templateMap = {
      'interest': 'interest-analysis',
      'principal': 'principal-analysis',
      'consolidated': 'consolidated'
    };

    const templateId = templateMap[type];
    const now = new Date();
    const endDate = now.toISOString().split('T')[0];
    const startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const options: ReportGenerationOptions = {
      templateId,
      contractIds: contracts.map(c => c.id),
      startDate,
      endDate,
      frequency: 'Mensal',
      outputMode: 'both',
      includeCharts: true,
      groupBy: 'none'
    };

    await this.generateReport(templateId, options);
  }

  /**
   * Cleanup
   */
  public dispose(): void {
    this.selector.dispose();
    this.builder.dispose();
  }
}
