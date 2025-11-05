/**
 * Loan Report Selector - Seletor visual de templates com preview
 *
 * Fornece interface para:
 * - Visualizar templates disponíveis
 * - Preview de estrutura
 * - Seleção e aplicação
 * - Customização rápida
 */

import type { PluginContext } from '@core/types';
import type { LoanContract } from './loan-types';
import { TEMPLATE_METADATA, REPORT_TEMPLATES } from './loan-report-templates';
import { logger } from '@core/storage-utils-consolidated';

export interface ReportSelectionOptions {
  contracts: LoanContract[];
  startDate: string;
  endDate: string;
  frequency?: 'Diário' | 'Mensal' | 'Anual';
  onSelect: (templateId: string, options: ReportGenerationOptions) => void;
  onCustomize?: (templateId: string) => void;
}

export interface ReportGenerationOptions {
  templateId: string;
  contractIds: string[];
  startDate: string;
  endDate: string;
  frequency: 'Diário' | 'Mensal' | 'Anual';
  outputMode: 'sheet' | 'pivot' | 'both';
  includeCharts: boolean;
  groupBy?: 'none' | 'currency' | 'type' | 'counterparty';
}

export class LoanReportSelector {
  private context: PluginContext;
  private modalElement: HTMLElement | null = null;
  private options: ReportSelectionOptions | null = null;

  constructor(context: PluginContext) {
    this.context = context;
  }

  /**
   * Abre o seletor de templates
   */
  public open(options: ReportSelectionOptions): void {
    this.options = options;
    this.render();
  }

  /**
   * Renderiza o modal
   */
  private render(): void {
    if (!this.options) return;

    // Salva cópia local antes de dispose() limpar this.options
    const options = this.options;

    this.dispose();

    const { contracts } = options;

    const modalHTML = `
      <div id="loan-report-selector-modal" style="position: fixed; inset: 0; background: rgba(0,0,0,0.75); backdrop-filter: blur(10px); display: flex; align-items: center; justify-content: center; z-index: 10300; animation: fadeIn 0.2s;">
        <div style="background: #ffffff; border-radius: 16px; width: 95%; max-width: 1400px; max-height: 92vh; display: flex; flex-direction: column; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); overflow: hidden;">

          <!-- Header -->
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 28px 32px; display: flex; justify-content: space-between; align-items: center; border-bottom: 4px solid rgba(255,255,255,0.2);">
            <div>
              <h2 style="margin: 0 0 8px 0; font-size: 2rem; font-weight: 700; display: flex; align-items: center; gap: 12px;">
                📊 Seletor de Relatórios
              </h2>
              <p style="margin: 0; opacity: 0.95; font-size: 15px;">Escolha um template para gerar seu relatório de empréstimos</p>
            </div>
            <button id="close-selector" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 10px; border-radius: 50%; cursor: pointer; font-size: 24px; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; font-weight: bold;"
              onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">×</button>
          </div>

          <!-- Content -->
          <div style="display: flex; flex: 1; overflow: hidden;">

            <!-- Sidebar: Templates List -->
            <div style="width: 420px; background: #f8f9fa; border-right: 1px solid #e5e7eb; overflow-y: auto; padding: 24px;">
              <div style="margin-bottom: 20px;">
                <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 700; text-transform: uppercase; color: #6b7280; letter-spacing: 0.5px;">Templates Disponíveis</h3>
                <input type="text" id="template-search" placeholder="🔍 Buscar templates..." style="width: 100%; padding: 10px 14px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px; transition: all 0.2s;"
                  onfocus="this.style.borderColor='#667eea'" onblur="this.style.borderColor='#e5e7eb'">
              </div>

              <div id="templates-list" style="display: flex; flex-direction: column; gap: 12px;">
                ${this.renderTemplateCards()}
              </div>
            </div>

            <!-- Main Area: Template Preview & Options -->
            <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">

              <!-- Preview Area -->
              <div id="template-preview" style="flex: 1; overflow-y: auto; padding: 32px; background: #ffffff;">
                ${this.renderEmptyState()}
              </div>

              <!-- Options Panel -->
              <div style="background: #f8f9fa; border-top: 2px solid #e5e7eb; padding: 24px;">
                <div style="max-width: 900px; margin: 0 auto;">

                  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 20px;">

                    <!-- Contratos -->
                    <div>
                      <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151; font-size: 13px;">Contratos</label>
                      <select id="contract-selection" multiple size="3" style="width: 100%; padding: 8px; border: 2px solid #e5e7eb; border-radius: 6px; font-size: 13px;">
                        <option value="all" selected>📋 Todos os contratos (${contracts.length})</option>
                        ${contracts.map(c => `<option value="${c.id}">${c.id} · ${c.counterparty}</option>`).join('')}
                      </select>
                    </div>

                    <!-- Período -->
                    <div>
                      <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151; font-size: 13px;">Período</label>
                      <div style="display: flex; flex-direction: column; gap: 6px;">
                        <input type="date" id="start-date" value="${options.startDate}" style="padding: 8px; border: 2px solid #e5e7eb; border-radius: 6px; font-size: 13px;">
                        <input type="date" id="end-date" value="${options.endDate}" style="padding: 8px; border: 2px solid #e5e7eb; border-radius: 6px; font-size: 13px;">
                      </div>
                    </div>

                    <!-- Frequência -->
                    <div>
                      <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151; font-size: 13px;">Frequência</label>
                      <select id="frequency" style="width: 100%; padding: 8px; border: 2px solid #e5e7eb; border-radius: 6px; font-size: 13px;">
                        <option value="Diário" ${options.frequency === 'Diário' ? 'selected' : ''}>📅 Diário</option>
                        <option value="Mensal" ${options.frequency === 'Mensal' ? 'selected' : ''}>📆 Mensal</option>
                        <option value="Anual" ${options.frequency === 'Anual' ? 'selected' : ''}>🗓️ Anual</option>
                      </select>

                      <label style="display: flex; align-items: center; gap: 8px; margin-top: 8px; cursor: pointer; font-size: 13px;">
                        <input type="checkbox" id="include-charts" checked style="width: 16px; height: 16px; cursor: pointer;">
                        <span style="color: #6b7280;">Incluir gráficos</span>
                      </label>
                    </div>

                    <!-- Modo de Saída -->
                    <div>
                      <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151; font-size: 13px;">Modo de Saída</label>
                      <select id="output-mode" style="width: 100%; padding: 8px; border: 2px solid #e5e7eb; border-radius: 6px; font-size: 13px;">
                        <option value="sheet">📄 Planilha Estática</option>
                        <option value="pivot">🔄 Tabela Dinâmica (Pivot)</option>
                        <option value="both">📊 Ambos</option>
                      </select>

                      <select id="group-by" style="width: 100%; padding: 8px; border: 2px solid #e5e7eb; border-radius: 6px; font-size: 13px; margin-top: 8px;">
                        <option value="none">Sem agrupamento</option>
                        <option value="currency">Agrupar por moeda</option>
                        <option value="type">Agrupar por tipo</option>
                        <option value="counterparty">Agrupar por contraparte</option>
                      </select>
                    </div>

                  </div>

                  <!-- Action Buttons -->
                  <div style="display: flex; gap: 12px; justify-content: flex-end; padding-top: 16px; border-top: 1px solid #e5e7eb;">
                    <button id="customize-btn" disabled style="padding: 12px 24px; background: transparent; color: #667eea; border: 2px solid #667eea; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px; transition: all 0.2s; opacity: 0.5;"
                      onmouseover="if(!this.disabled) { this.style.background='#f0f4ff'; }" onmouseout="this.style.background='transparent'">
                      🎨 Personalizar Template
                    </button>
                    <button id="generate-btn" disabled style="padding: 12px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 14px; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3); transition: all 0.2s; opacity: 0.5;"
                      onmouseover="if(!this.disabled) { this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(102, 126, 234, 0.4)'; }" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(102, 126, 234, 0.3)'">
                      ✨ Gerar Relatório
                    </button>
                  </div>

                </div>
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
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      </style>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.modalElement = document.getElementById('loan-report-selector-modal');

    // Reassocia options após dispose() para event listeners
    this.options = options;

    this.attachEventListeners();
  }

  /**
   * Renderiza cards dos templates
   */
  private renderTemplateCards(): string {
    return TEMPLATE_METADATA.map(template => `
      <div class="template-card" data-template-id="${template.id}" style="
        background: white;
        border: 2px solid #e5e7eb;
        border-radius: 10px;
        padding: 16px;
        cursor: pointer;
        transition: all 0.2s;
        position: relative;
      "
      onmouseover="this.style.borderColor='#667eea'; this.style.transform='translateX(4px)'; this.style.boxShadow='0 4px 12px rgba(102, 126, 234, 0.15)';"
      onmouseout="this.style.borderColor='#e5e7eb'; this.style.transform='translateX(0)'; this.style.boxShadow='none';">

        <div style="display: flex; align-items: start; gap: 12px; margin-bottom: 10px;">
          <div style="font-size: 28px; line-height: 1;">${template.icon}</div>
          <div style="flex: 1;">
            <div style="font-weight: 700; font-size: 15px; color: #1f2937; margin-bottom: 4px;">${template.name}</div>
            <div style="font-size: 11px; color: #667eea; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">${template.category}</div>
          </div>
        </div>

        <p style="font-size: 13px; color: #6b7280; margin: 0 0 12px 0; line-height: 1.4;">
          ${template.description}
        </p>

        <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px;">
          ${template.tags.map(tag => `
            <span style="background: #f3f4f6; color: #6b7280; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">
              ${tag}
            </span>
          `).join('')}
        </div>

        <div style="padding: 10px; background: #f9fafb; border-radius: 6px; border-left: 3px solid #667eea; margin-top: 10px;">
          <div style="font-size: 11px; color: #374151; line-height: 1.4;">
            <strong>💡 Caso de uso:</strong><br>
            ${template.useCase}
          </div>
        </div>

      </div>
    `).join('');
  }

  /**
   * Renderiza estado vazio (nenhum template selecionado)
   */
  private renderEmptyState(): string {
    return `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; padding: 40px;">
        <div style="font-size: 80px; margin-bottom: 20px; opacity: 0.3;">📊</div>
        <h3 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 700; color: #374151;">Selecione um Template</h3>
        <p style="margin: 0; font-size: 15px; color: #6b7280; max-width: 400px;">
          Escolha um template na lista ao lado para visualizar sua estrutura e gerar seu relatório
        </p>
      </div>
    `;
  }

  /**
   * Renderiza preview do template selecionado
   */
  private renderTemplatePreview(templateId: string): string {
    const metadata = TEMPLATE_METADATA.find(t => t.id === templateId);
    const template = REPORT_TEMPLATES[templateId as keyof typeof REPORT_TEMPLATES];

    if (!metadata || !template) return this.renderEmptyState();

    return `
      <div style="animation: slideUp 0.3s;">

        <!-- Header -->
        <div style="margin-bottom: 28px;">
          <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 12px;">
            <div style="font-size: 48px;">${metadata.icon}</div>
            <div>
              <h3 style="margin: 0 0 6px 0; font-size: 26px; font-weight: 700; color: #1f2937;">${metadata.name}</h3>
              <p style="margin: 0; font-size: 15px; color: #6b7280;">${metadata.description}</p>
            </div>
          </div>

          <div style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 8px 16px; border-radius: 20px; font-size: 13px; font-weight: 600;">
            ${metadata.category}
          </div>
        </div>

        <!-- Template Structure -->
        <div style="background: #f9fafb; border-radius: 12px; padding: 24px; margin-bottom: 24px; border: 2px solid #e5e7eb;">
          <h4 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 700; color: #374151; display: flex; align-items: center; gap: 8px;">
            <span>📋</span> Estrutura do Relatório
          </h4>

          <div style="display: flex; flex-direction: column; gap: 16px;">
            ${template.sections.map((section: any) => `
              <div style="background: white; border-radius: 8px; padding: 16px; border: 1px solid #e5e7eb;">
                <div style="font-weight: 700; font-size: 14px; color: #667eea; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                  <span style="width: 4px; height: 16px; background: #667eea; border-radius: 2px;"></span>
                  ${section.title}
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                  ${section.columns.map((col: any) => `
                    <div style="background: #f3f4f6; padding: 6px 12px; border-radius: 6px; font-size: 12px; color: #374151; border: 1px solid #e5e7eb; white-space: nowrap;">
                      ${col.label}
                      ${col.summary ? `<span style="color: #667eea; font-weight: 600; margin-left: 4px;">(∑)</span>` : ''}
                    </div>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Sample Preview -->
        <div style="background: white; border-radius: 12px; padding: 24px; border: 2px solid #e5e7eb;">
          <h4 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 700; color: #374151; display: flex; align-items: center; gap: 8px;">
            <span>👁️</span> Preview de Dados
          </h4>

          <div style="overflow-x: auto;">
            <div style="font-family: 'Courier New', monospace; font-size: 11px; background: #1f2937; color: #f9fafb; padding: 16px; border-radius: 8px; white-space: pre; line-height: 1.8;">
${metadata.preview}
─────────────────────────────────────────────────
2025-01-01 | 30 | 1,234.56 | 5,678.90 | 123.45 | 5.5000
2025-02-01 | 31 | 1,456.78 | 6,234.56 | 234.56 | 5.6500
2025-03-01 | 30 | 1,567.89 | 6,789.01 | 345.67 | 5.8000
─────────────────────────────────────────────────
<span style="color: #10b981; font-weight: bold;">TOTAIS     | 91 | 4,259.23 | 18,702.47 | 703.68 | 5.6500</span>
            </div>
          </div>
        </div>

      </div>
    `;
  }

  /**
   * Anexa event listeners
   */
  private attachEventListeners(): void {
    // Close button
    document.getElementById('close-selector')?.addEventListener('click', () => this.dispose());

    // Template cards
    document.querySelectorAll('.template-card').forEach(card => {
      card.addEventListener('click', () => {
        const templateId = card.getAttribute('data-template-id');
        if (templateId) {
          this.selectTemplate(templateId);
        }
      });
    });

    // Search
    const searchInput = document.getElementById('template-search') as HTMLInputElement;
    searchInput?.addEventListener('input', (e) => {
      const query = (e.target as HTMLInputElement).value.toLowerCase();
      document.querySelectorAll('.template-card').forEach(card => {
        const templateId = card.getAttribute('data-template-id');
        const metadata = TEMPLATE_METADATA.find(t => t.id === templateId);
        if (metadata) {
          const matches =
            metadata.name.toLowerCase().includes(query) ||
            metadata.description.toLowerCase().includes(query) ||
            metadata.tags.some(tag => tag.toLowerCase().includes(query));
          (card as HTMLElement).style.display = matches ? 'block' : 'none';
        }
      });
    });

    // Generate button
    document.getElementById('generate-btn')?.addEventListener('click', () => this.generateReport());

    // Customize button
    document.getElementById('customize-btn')?.addEventListener('click', () => this.customizeTemplate());
  }

  /**
   * Seleciona um template
   */
  private selectTemplate(templateId: string): void {
    // Atualiza visual dos cards
    document.querySelectorAll('.template-card').forEach(card => {
      if (card.getAttribute('data-template-id') === templateId) {
        (card as HTMLElement).style.borderColor = '#667eea';
        (card as HTMLElement).style.background = '#f0f4ff';
      } else {
        (card as HTMLElement).style.borderColor = '#e5e7eb';
        (card as HTMLElement).style.background = 'white';
      }
    });

    // Atualiza preview
    const previewArea = document.getElementById('template-preview');
    if (previewArea) {
      previewArea.innerHTML = this.renderTemplatePreview(templateId);
    }

    // Habilita botões
    const generateBtn = document.getElementById('generate-btn') as HTMLButtonElement;
    const customizeBtn = document.getElementById('customize-btn') as HTMLButtonElement;
    if (generateBtn) {
      generateBtn.disabled = false;
      generateBtn.style.opacity = '1';
      generateBtn.style.cursor = 'pointer';
    }
    if (customizeBtn) {
      customizeBtn.disabled = false;
      customizeBtn.style.opacity = '1';
      customizeBtn.style.cursor = 'pointer';
    }

    // Armazena seleção
    this.modalElement?.setAttribute('data-selected-template', templateId);
  }

  /**
   * Gera relatório com o template selecionado
   */
  private generateReport(): void {
    if (!this.options || !this.modalElement) return;

    const templateId = this.modalElement.getAttribute('data-selected-template');
    if (!templateId) {
      this.context.ui.showToast('Selecione um template primeiro', 'warning');
      return;
    }

    // Coleta opções
    const contractSelection = document.getElementById('contract-selection') as HTMLSelectElement;
    const selectedOptions = Array.from(contractSelection.selectedOptions).map(opt => opt.value);
    const contractIds = selectedOptions.includes('all')
      ? this.options.contracts.map(c => c.id)
      : selectedOptions;

    if (contractIds.length === 0) {
      this.context.ui.showToast('Selecione pelo menos um contrato', 'warning');
      return;
    }

    const generationOptions: ReportGenerationOptions = {
      templateId,
      contractIds,
      startDate: (document.getElementById('start-date') as HTMLInputElement).value,
      endDate: (document.getElementById('end-date') as HTMLInputElement).value,
      frequency: (document.getElementById('frequency') as HTMLSelectElement).value as any,
      outputMode: (document.getElementById('output-mode') as HTMLSelectElement).value as any,
      includeCharts: (document.getElementById('include-charts') as HTMLInputElement).checked,
      groupBy: (document.getElementById('group-by') as HTMLSelectElement).value as any
    };

    logger.info('[LoanReportSelector] Gerando relatório', generationOptions);

    // Callback
    this.options.onSelect(templateId, generationOptions);

    // Fecha modal
    this.dispose();
  }

  /**
   * Abre customizador de template
   */
  private customizeTemplate(): void {
    if (!this.options || !this.modalElement) return;

    const templateId = this.modalElement.getAttribute('data-selected-template');
    if (!templateId) {
      this.context.ui.showToast('Selecione um template primeiro', 'warning');
      return;
    }

    if (this.options.onCustomize) {
      this.options.onCustomize(templateId);
    }

    this.dispose();
  }

  /**
   * Fecha e limpa o modal
   */
  public dispose(): void {
    this.modalElement?.remove();
    this.modalElement = null;
    this.options = null;
  }
}
