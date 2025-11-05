/**
 * Loan Wizard - Wizard de criação de contratos com 6 steps
 *
 * Guia o usuário através de um processo intuitivo para criar contratos de empréstimo.
 */

import type { LoanContractInput, InterestLeg } from './loan-types';
import { LoanFXIntegration } from './loan-fx-integration';
import { INTEREST_TEMPLATES } from './loan-templates';
import { logger } from '@core/storage-utils-consolidated';

/**
 * Gerencia o wizard (assistente) de criação de contrato com UI completa.
 */
export class LoanWizard {
  private modalElement: HTMLElement | null = null;
  private currentStep: number = 1;
  private readonly totalSteps: number = 6;
  private resolveCallback: ((data: LoanContractInput | null) => void) | null = null;

  // Dados do formulário
  private formData: Partial<LoanContractInput> = {
    contractType: 'CAPTADO',
    currency: 'BRL',
    interestConfig: {
      template: 'CDI_PLUS',
      legs: [],
      dayCountBasis: 'BUS/252',
      compounding: 'EXPONENCIAL',
      rounding: 'HALF_UP'
    },
    paymentFlow: {
      type: 'SCHEDULED'
    }
  };

  constructor(_fxIntegration: LoanFXIntegration) {
    // fxIntegration reserved for future use
  }

  /**
   * Inicia o wizard e retorna os dados do contrato quando concluído.
   */
  public async start(): Promise<LoanContractInput | null> {
    this.currentStep = 1;
    this.formData = {
      contractType: 'CAPTADO',
      currency: 'BRL',
      interestConfig: {
        template: 'CDI_PLUS',
        legs: [],
        dayCountBasis: 'BUS/252',
        compounding: 'EXPONENCIAL',
        rounding: 'HALF_UP'
      },
      paymentFlow: {
        type: 'SCHEDULED'
      }
    };

    return new Promise((resolve) => {
      this.resolveCallback = resolve;
      this.renderWizard();
    });
  }

  /**
   * Renderiza o wizard modal.
   */
  private renderWizard(): void {
    // Remove modal anterior se existir (apenas DOM; mantém callback para não quebrar a Promise)
    this.modalElement?.remove();
    this.modalElement = null;

    const modalId = 'loan-wizard-modal';
    const modalHTML = `
      <div id="${modalId}" style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 10100; animation: fadeIn 0.2s;">
        <div style="background: #fff; border-radius: 12px; padding: 0; width: 95%; max-width: 750px; box-shadow: 0 24px 48px rgba(0,0,0,0.3); overflow: hidden; max-height: 90vh; display: flex; flex-direction: column;">

          <!-- Header -->
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 24px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h2 style="margin: 0; font-size: 1.5rem; font-weight: 700;">Novo Contrato de Empréstimo</h2>
              <p style="margin: 6px 0 0; opacity: 0.95; font-size: 0.9rem;">Step ${this.currentStep} de ${this.totalSteps}</p>
            </div>
            <button id="wizard-close-btn" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 1.2rem; font-weight: 700; transition: background 0.2s;">×</button>
          </div>

          <!-- Progress Bar -->
          <div style="background: #f0f0f0; height: 6px;">
            <div style="background: linear-gradient(90deg, #667eea 0%, #764ba2 100%); height: 100%; width: ${(this.currentStep / this.totalSteps) * 100}%; transition: width 0.3s;"></div>
          </div>

          <!-- Content -->
          <div id="wizard-content" style="padding: 32px; overflow-y: auto; flex: 1;">
            ${this.renderCurrentStep()}
          </div>

          <!-- Footer -->
          <div style="border-top: 1px solid #e5e7eb; padding: 20px 32px; display: flex; justify-content: space-between; background: #fafafa;">
            <button id="wizard-prev-btn" style="padding: 12px 24px; border: 1px solid #d0d7de; border-radius: 8px; background: white; cursor: pointer; font-weight: 600; color: #333; ${this.currentStep === 1 ? 'opacity: 0.5; cursor: not-allowed;' : ''}" ${this.currentStep === 1 ? 'disabled' : ''}>← Voltar</button>
            <button id="wizard-next-btn" style="padding: 12px 28px; border: none; border-radius: 8px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; font-weight: 700; cursor: pointer; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);">${this.currentStep === this.totalSteps ? '✓ Criar Contrato' : 'Próximo →'}</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.modalElement = document.getElementById(modalId);

    this.attachEventListeners();
  }

  /**
   * Renderiza o conteúdo do step atual.
   */
  private renderCurrentStep(): string {
    switch (this.currentStep) {
      case 1:
        return this.renderStep1();
      case 2:
        return this.renderStep2();
      case 3:
        return this.renderStep3();
      case 4:
        return this.renderStep4();
      case 5:
        return this.renderStep5();
      case 6:
        return this.renderStep6();
      default:
        return '<p>Step inválido</p>';
    }
  }

  /**
   * Step 1: Tipo e Contraparte
   */
  private renderStep1(): string {
    return `
      <div style="display: flex; flex-direction: column; gap: 24px;">
        <h3 style="margin: 0; font-size: 1.3rem; color: #1f2937;">Informações Básicas</h3>

        <div>
          <label style="font-weight: 600; display: block; margin-bottom: 8px; color: #374151;">Qual é o tipo de contrato?</label>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
            <label style="border: 2px solid ${this.formData.contractType === 'CAPTADO' ? '#667eea' : '#e5e7eb'}; border-radius: 10px; padding: 20px; cursor: pointer; transition: all 0.2s; background: ${this.formData.contractType === 'CAPTADO' ? '#f0f4ff' : 'white'};">
              <input type="radio" name="contract-type" value="CAPTADO" ${this.formData.contractType === 'CAPTADO' ? 'checked' : ''} style="margin-right: 10px;">
              <span style="font-size: 1.5rem;">📥</span>
              <strong style="display: block; margin-top: 8px;">CAPTADO</strong>
              <small style="color: #6b7280;">Empresa recebe dinheiro e deve pagar</small>
            </label>
            <label style="border: 2px solid ${this.formData.contractType === 'CEDIDO' ? '#667eea' : '#e5e7eb'}; border-radius: 10px; padding: 20px; cursor: pointer; transition: all 0.2s; background: ${this.formData.contractType === 'CEDIDO' ? '#f0f4ff' : 'white'};">
              <input type="radio" name="contract-type" value="CEDIDO" ${this.formData.contractType === 'CEDIDO' ? 'checked' : ''} style="margin-right: 10px;">
              <span style="font-size: 1.5rem;">📤</span>
              <strong style="display: block; margin-top: 8px;">CEDIDO</strong>
              <small style="color: #6b7280;">Empresa empresta e vai receber</small>
            </label>
          </div>
        </div>

        <div>
          <label style="font-weight: 600; display: block; margin-bottom: 8px; color: #374151;">Contraparte *</label>
          <input id="wizard-counterparty" type="text" value="${this.formData.counterparty || ''}" placeholder="Ex: Banco XYZ, Cliente ABC" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 1rem;">
          <small style="color: #6b7280; display: block; margin-top: 4px;">Nome da instituição ou pessoa com quem o contrato é firmado</small>
        </div>

        <div>
          <label style="font-weight: 600; display: block; margin-bottom: 8px; color: #374151;">Referência/Código Externo (opcional)</label>
          <input id="wizard-reference" type="text" value="${this.formData.notes || ''}" placeholder="Ex: CCB-2025-001, Contrato #12345" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 1rem;">
        </div>
      </div>
    `;
  }

  /**
   * Step 2: Principal e Moeda
   */
  private renderStep2(): string {
    return `
      <div style="display: flex; flex-direction: column; gap: 24px;">
        <h3 style="margin: 0; font-size: 1.3rem; color: #1f2937;">Principal e Moeda</h3>

        <div>
          <label style="font-weight: 600; display: block; margin-bottom: 8px; color: #374151;">Moeda de Origem *</label>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 12px;">
            ${['BRL', 'USD', 'EUR', 'GBP', 'JPY'].map(curr => `
              <label style="border: 2px solid ${this.formData.currency === curr ? '#667eea' : '#e5e7eb'}; border-radius: 8px; padding: 14px; text-align: center; cursor: pointer; transition: all 0.2s; background: ${this.formData.currency === curr ? '#f0f4ff' : 'white'};">
                <input type="radio" name="currency" value="${curr}" ${this.formData.currency === curr ? 'checked' : ''} style="display: none;">
                <div style="font-size: 1.4rem;">💵</div>
                <strong>${curr}</strong>
              </label>
            `).join('')}
          </div>
        </div>

        <div>
          <label style="font-weight: 600; display: block; margin-bottom: 8px; color: #374151;">Principal (Moeda Origem) *</label>
          <input id="wizard-principal" type="number" min="0" step="0.01" value="${this.formData.principalOrigin || ''}" placeholder="1000000.00" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 1rem;">
        </div>

        ${this.formData.currency !== 'BRL' ? `
        <div style="background: #f9fafb; border: 2px solid #e5e7eb; border-radius: 10px; padding: 20px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
            <span style="font-size: 1.3rem;">ℹ️</span>
            <strong style="color: #374151;">Conversão Automática (FX Plugin)</strong>
          </div>
          <div>
            <label style="font-weight: 600; display: block; margin-bottom: 8px; color: #374151;">PTAX do Contrato (opcional)</label>
            <input id="wizard-fx-rate" type="number" min="0" step="0.0001" value="${this.formData.contractFXRate || ''}" placeholder="5.1372" style="width: 100%; padding: 10px; border: 2px solid #e5e7eb; border-radius: 8px;">
            <small style="color: #6b7280; display: block; margin-top: 6px;">Se vazio, usaremos a PTAX (BCB) da data de início</small>
          </div>
          <div id="wizard-conversion-hint" style="margin-top: 12px; padding: 12px; background: white; border-radius: 6px; border-left: 4px solid #667eea;">
            <small style="color: #6b7280;">Digite o principal e a taxa para ver a conversão em BRL</small>
          </div>
        </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Step 3: Datas
   */
  private renderStep3(): string {
    const today = new Date();
    const defaultStart = today.toISOString().split('T')[0];
    const oneYearLater = new Date(today);
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
    const defaultMaturity = oneYearLater.toISOString().split('T')[0];

    return `
      <div style="display: flex; flex-direction: column; gap: 24px;">
        <h3 style="margin: 0; font-size: 1.3rem; color: #1f2937;">Datas do Contrato</h3>

        <div>
          <label style="font-weight: 600; display: block; margin-bottom: 8px; color: #374151;">Data de Início *</label>
          <input id="wizard-start-date" type="date" value="${this.formData.startDate || defaultStart}" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 1rem;">
        </div>

        <div style="background: #f9fafb; border: 2px solid #e5e7eb; border-radius: 10px; padding: 20px;">
          <label style="font-weight: 600; display: block; margin-bottom: 12px; color: #374151;">Definir vencimento por:</label>
          <div style="display: flex; gap: 12px; margin-bottom: 16px;">
            <label style="flex: 1; border: 2px solid #667eea; border-radius: 8px; padding: 12px; text-align: center; cursor: pointer; background: #f0f4ff;">
              <input type="radio" name="maturity-mode" value="days" checked style="display: none;">
              <strong>Prazo (dias)</strong>
            </label>
            <label style="flex: 1; border: 2px solid #e5e7eb; border-radius: 8px; padding: 12px; text-align: center; cursor: pointer;">
              <input type="radio" name="maturity-mode" value="date" style="display: none;">
              <strong>Data Específica</strong>
            </label>
          </div>

          <div id="maturity-days-input">
            <label style="font-weight: 600; display: block; margin-bottom: 8px; color: #374151;">Prazo</label>
            <div style="display: flex; gap: 12px; align-items: center;">
              <input id="wizard-term-value" type="number" min="1" value="360" style="flex: 1; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
              <select id="wizard-term-unit" style="flex: 1; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                <option value="days">Dias</option>
                <option value="months">Meses</option>
                <option value="years">Anos</option>
              </select>
            </div>
          </div>

          <div id="maturity-date-input" style="display: none;">
            <label style="font-weight: 600; display: block; margin-bottom: 8px; color: #374151;">Data de Vencimento *</label>
            <input id="wizard-maturity-date" type="date" value="${this.formData.maturityDate || defaultMaturity}" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
          </div>
        </div>

        <div id="calculated-maturity" style="padding: 16px; background: #f0f4ff; border-radius: 8px; border-left: 4px solid #667eea;">
          <strong style="color: #374151;">Data de Vencimento Calculada:</strong>
          <span id="maturity-display" style="color: #667eea; font-weight: 700; margin-left: 8px;">${defaultMaturity}</span>
        </div>
      </div>
    `;
  }

  /**
   * Step 4: Taxa de Juros
   */
  private renderStep4(): string {
    const templates = Object.entries(INTEREST_TEMPLATES);
    const selectedTemplate = this.formData.interestConfig?.template || 'CDI_PLUS';

    return `
      <div style="display: flex; flex-direction: column; gap: 24px;">
        <h3 style="margin: 0; font-size: 1.3rem; color: #1f2937;">Configuração de Juros</h3>

        <div>
          <label style="font-weight: 600; display: block; margin-bottom: 12px; color: #374151;">Escolha um template:</label>
          <div style="display: flex; flex-direction: column; gap: 12px;">
            ${templates.map(([key, template]) => `
              <label style="border: 2px solid ${selectedTemplate === key ? '#667eea' : '#e5e7eb'}; border-radius: 10px; padding: 16px; cursor: pointer; transition: all 0.2s; background: ${selectedTemplate === key ? '#f0f4ff' : 'white'};">
                <input type="radio" name="interest-template" value="${key}" ${selectedTemplate === key ? 'checked' : ''} style="margin-right: 10px;">
                <strong style="color: #374151;">${template.name}</strong>
                <small style="display: block; color: #6b7280; margin-top: 4px;">${template.description}</small>
              </label>
            `).join('')}
          </div>
        </div>

        <div id="template-config" style="background: #f9fafb; border: 2px solid #e5e7eb; border-radius: 10px; padding: 20px;">
          ${this.renderTemplateConfig(selectedTemplate)}
        </div>

        <div>
          <label style="font-weight: 600; display: block; margin-bottom: 8px; color: #374151;">Base de Contagem de Dias</label>
          <select id="wizard-day-count" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
            <option value="BUS/252" selected>BUS/252 (Dias úteis - Brasil)</option>
            <option value="30/360">30/360 (Convenção americana)</option>
            <option value="ACT/360">ACT/360 (Dias corridos / 360)</option>
            <option value="ACT/365">ACT/365 (Dias corridos / 365)</option>
          </select>
        </div>

        <div style="display: flex; gap: 16px;">
          <label style="flex: 1;">
            <span style="font-weight: 600; display: block; margin-bottom: 8px; color: #374151;">Capitalização</span>
            <select id="wizard-compounding" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
              <option value="EXPONENCIAL" selected>Exponencial</option>
              <option value="LINEAR">Linear</option>
            </select>
          </label>
          <label style="flex: 1;">
            <span style="font-weight: 600; display: block; margin-bottom: 8px; color: #374151;">Arredondamento</span>
            <select id="wizard-rounding" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
              <option value="HALF_UP" selected>Meio para cima</option>
              <option value="HALF_EVEN">Meio para par</option>
            </select>
          </label>
        </div>
      </div>
    `;
  }

  /**
   * Renderiza configuração específica do template selecionado.
   */
  private renderTemplateConfig(templateKey: string): string {
    const template = INTEREST_TEMPLATES[templateKey];

    if (templateKey === 'CUSTOM' || !template || template.legs.length === 0) {
      return `<p style="color: #6b7280; text-align: center; padding: 20px;">Configure manualmente as pernas de taxa após criar o contrato.</p>`;
    }

    return `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        ${template.legs.map((leg, index) => {
          const legName = leg.indexer === 'CDI' ? 'CDI' : leg.indexer === 'PTAX' ? 'PTAX' : 'Fixa';
          return `
            <div>
              <strong style="display: block; margin-bottom: 8px; color: #374151;">Perna ${index + 1}: ${legName}</strong>
              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
                ${leg.indexer !== 'FIXED' ? `
                <div>
                  <label style="font-size: 0.9rem; color: #6b7280; display: block; margin-bottom: 4px;">% do ${legName}</label>
                  <input type="number" id="wizard-leg-${index}-percent" min="0" step="1" value="${leg.indexerPercent}" style="width: 100%; padding: 10px; border: 2px solid #e5e7eb; border-radius: 6px;">
                </div>
                ` : ''}
                <div>
                  <label style="font-size: 0.9rem; color: #6b7280; display: block; margin-bottom: 4px;">Spread (% a.a.)</label>
                  <input type="number" id="wizard-leg-${index}-spread" min="0" step="0.1" value="${leg.spreadAnnual}" style="width: 100%; padding: 10px; border: 2px solid #e5e7eb; border-radius: 6px;">
                </div>
                ${leg.indexer !== 'FIXED' ? `
                <div>
                  <label style="font-size: 0.9rem; color: #6b7280; display: block; margin-bottom: 4px;">Taxa base (% a.a.)</label>
                  <input type="number" id="wizard-leg-${index}-base" min="0" step="0.01" value="${leg.baseRateAnnual ?? ''}" placeholder="Ex: 13.65" style="width: 100%; padding: 10px; border: 2px solid #e5e7eb; border-radius: 6px;">
                </div>
                ` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  /**
   * Step 5: Fluxo de Pagamento
   */
  private renderStep5(): string {
    const flowType = this.formData.paymentFlow?.type || 'SCHEDULED';

    return `
      <div style="display: flex; flex-direction: column; gap: 24px;">
        <h3 style="margin: 0; font-size: 1.3rem; color: #1f2937;">Fluxo de Pagamento</h3>

        <div>
          <label style="font-weight: 600; display: block; margin-bottom: 12px; color: #374151;">Como serão os pagamentos?</label>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
            ${[
              { value: 'SCHEDULED', icon: '📅', label: 'PROGRAMADO', desc: 'Parcelas fixas (PRICE, SAC)' },
              { value: 'FLEXIBLE', icon: '🔄', label: 'FLEXÍVEL', desc: 'Registra quando ocorrer' },
              { value: 'BULLET', icon: '💰', label: 'BULLET', desc: 'Tudo no vencimento' },
              { value: 'ACCRUAL_ONLY', icon: '📊', label: 'SÓ ACCRUAL', desc: 'Apenas acumula juros' }
            ].map(type => `
              <label style="border: 2px solid ${flowType === type.value ? '#667eea' : '#e5e7eb'}; border-radius: 10px; padding: 16px; cursor: pointer; transition: all 0.2s; background: ${flowType === type.value ? '#f0f4ff' : 'white'};">
                <input type="radio" name="payment-flow" value="${type.value}" ${flowType === type.value ? 'checked' : ''} style="display: none;">
                <div style="font-size: 1.5rem; text-align: center; margin-bottom: 8px;">${type.icon}</div>
                <strong style="display: block; text-align: center; color: #374151;">${type.label}</strong>
                <small style="display: block; text-align: center; color: #6b7280; margin-top: 4px;">${type.desc}</small>
              </label>
            `).join('')}
          </div>
        </div>

        <div id="scheduled-config" style="background: #f9fafb; border: 2px solid #e5e7eb; border-radius: 10px; padding: 20px; ${flowType !== 'SCHEDULED' ? 'display: none;' : ''}">
          <strong style="display: block; margin-bottom: 16px; color: #374151; font-size: 1.1rem;">Configuração PROGRAMADO</strong>

          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
            <div>
              <label style="font-weight: 600; display: block; margin-bottom: 8px; color: #374151;">Sistema</label>
              <div style="display: flex; gap: 12px;">
                <label style="flex: 1; border: 2px solid #667eea; border-radius: 8px; padding: 12px; text-align: center; cursor: pointer; background: #f0f4ff;">
                  <input type="radio" name="schedule-system" value="PRICE" checked style="display: none;">
                  <strong style="font-size: 0.9rem;">PRICE</strong>
                  <small style="display: block; color: #6b7280; margin-top: 2px;">Parcela fixa</small>
                </label>
                <label style="flex: 1; border: 2px solid #e5e7eb; border-radius: 8px; padding: 12px; text-align: center; cursor: pointer;">
                  <input type="radio" name="schedule-system" value="SAC" style="display: none;">
                  <strong style="font-size: 0.9rem;">SAC</strong>
                  <small style="display: block; color: #6b7280; margin-top: 2px;">Amortização constante</small>
                </label>
              </div>
            </div>

            <div>
              <label style="font-weight: 600; display: block; margin-bottom: 8px; color: #374151;">Periodicidade</label>
              <select id="wizard-periodicity" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                <option value="MENSAL" selected>Mensal</option>
                <option value="TRIMESTRAL">Trimestral</option>
                <option value="SEMESTRAL">Semestral</option>
                <option value="ANUAL">Anual</option>
              </select>
            </div>

            <div>
              <label style="font-weight: 600; display: block; margin-bottom: 8px; color: #374151;">Número de Parcelas</label>
              <input id="wizard-installments" type="number" min="1" step="1" value="12" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
            </div>

            <div>
              <label style="font-weight: 600; display: block; margin-bottom: 8px; color: #374151;">Data 1ª Parcela</label>
              <input id="wizard-first-payment" type="date" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
            </div>

            <div>
              <label style="font-weight: 600; display: block; margin-bottom: 8px; color: #374151;">Carência (parcelas)</label>
              <input id="wizard-grace-periods" type="number" min="0" step="1" value="0" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
            </div>

            <div>
              <label style="font-weight: 600; display: block; margin-bottom: 8px; color: #374151;">Tipo Carência</label>
              <select id="wizard-grace-type" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                <option value="INTEREST_ONLY">Paga juros</option>
                <option value="FULL">Total</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Step 6: Revisão e Confirmação
   */
  private renderStep6(): string {
    const template = INTEREST_TEMPLATES[this.formData.interestConfig?.template || 'CDI_PLUS'];

    return `
      <div style="display: flex; flex-direction: column; gap: 24px;">
        <h3 style="margin: 0; font-size: 1.3rem; color: #1f2937;">Revisão do Contrato</h3>

        <div style="background: linear-gradient(135deg, #f0f4ff 0%, #fef3c7 100%); border: 2px solid #667eea; border-radius: 12px; padding: 24px;">
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">

            <div>
              <small style="color: #6b7280; font-weight: 600; text-transform: uppercase; font-size: 0.75rem;">Tipo</small>
              <p style="margin: 4px 0 0; font-size: 1.1rem; font-weight: 700; color: #374151;">${this.formData.contractType === 'CAPTADO' ? '📥 CAPTADO' : '📤 CEDIDO'}</p>
            </div>

            <div>
              <small style="color: #6b7280; font-weight: 600; text-transform: uppercase; font-size: 0.75rem;">Contraparte</small>
              <p style="margin: 4px 0 0; font-size: 1.1rem; font-weight: 700; color: #374151;">${this.formData.counterparty}</p>
            </div>

            <div>
              <small style="color: #6b7280; font-weight: 600; text-transform: uppercase; font-size: 0.75rem;">Principal</small>
              <p style="margin: 4px 0 0; font-size: 1.1rem; font-weight: 700; color: #374151;">${this.formData.currency} ${this.formatNumber(this.formData.principalOrigin || 0)}</p>
              ${this.formData.currency !== 'BRL' && this.formData.contractFXRate ?
                `<small style="color: #667eea;">PTAX: ${this.formData.contractFXRate?.toFixed(4)}</small>` : ''}
            </div>

            <div>
              <small style="color: #6b7280; font-weight: 600; text-transform: uppercase; font-size: 0.75rem;">Prazo</small>
              <p style="margin: 4px 0 0; font-size: 1.1rem; font-weight: 700; color: #374151;">${this.formData.startDate} até ${this.formData.maturityDate}</p>
            </div>

            <div style="grid-column: 1 / -1;">
              <small style="color: #6b7280; font-weight: 600; text-transform: uppercase; font-size: 0.75rem;">Taxa</small>
              <p style="margin: 4px 0 0; font-size: 1.1rem; font-weight: 700; color: #374151;">${template?.name || 'Custom'}</p>
              <small style="color: #6b7280;">${this.formData.interestConfig?.dayCountBasis} · ${this.formData.interestConfig?.compounding}</small>
            </div>

            <div style="grid-column: 1 / -1;">
              <small style="color: #6b7280; font-weight: 600; text-transform: uppercase; font-size: 0.75rem;">Pagamentos</small>
              <p style="margin: 4px 0 0; font-size: 1.1rem; font-weight: 700; color: #374151;">${this.getPaymentFlowLabel()}</p>
            </div>
          </div>
        </div>

        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 8px;">
          <strong style="color: #92400e;">⚠️ Atenção</strong>
          <p style="margin: 8px 0 0; color: #78350f; font-size: 0.95rem;">Verifique todas as informações antes de criar o contrato. Alguns campos não podem ser alterados posteriormente.</p>
        </div>

        <div>
          <label style="font-weight: 600; display: block; margin-bottom: 8px; color: #374151;">Observações (opcional)</label>
          <textarea id="wizard-final-notes" rows="3" placeholder="Adicione notas ou comentários sobre este contrato..." style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 1rem;">${this.formData.notes || ''}</textarea>
        </div>
      </div>
    `;
  }

  /**
   * Anexa event listeners aos botões do wizard.
   */
  private attachEventListeners(): void {
    const closeBtn = document.getElementById('wizard-close-btn');
    const prevBtn = document.getElementById('wizard-prev-btn');
    const nextBtn = document.getElementById('wizard-next-btn');

    closeBtn?.addEventListener('click', () => this.cancel());
    prevBtn?.addEventListener('click', () => this.prevStep());
    nextBtn?.addEventListener('click', async () => {
      // Desabilitar botão durante processamento
      if (nextBtn) {
        nextBtn.setAttribute('disabled', 'true');
        nextBtn.style.opacity = '0.5';
        nextBtn.style.cursor = 'not-allowed';
      }
      
      try {
        await this.nextStep();
      } finally {
        // Re-habilitar botão
        if (nextBtn) {
          nextBtn.removeAttribute('disabled');
          nextBtn.style.opacity = '1';
          nextBtn.style.cursor = 'pointer';
        }
      }
    });

    // Event listeners específicos por step
    this.attachStepSpecificListeners();
  }

  /**
   * Anexa listeners específicos do step atual.
   */
  private attachStepSpecificListeners(): void {
    if (this.currentStep === 1) {
      document.querySelectorAll('input[name="contract-type"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
          this.formData.contractType = (e.target as HTMLInputElement).value as 'CAPTADO' | 'CEDIDO';
          this.updateUI();
        });
      });
    }

    if (this.currentStep === 2) {
      document.querySelectorAll('input[name="currency"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
          this.formData.currency = (e.target as HTMLInputElement).value;
          this.updateUI();
        });
      });

      // Auto-calcular conversão
      const principalInput = document.getElementById('wizard-principal') as HTMLInputElement;
      const fxRateInput = document.getElementById('wizard-fx-rate') as HTMLInputElement;

      const updateConversion = () => {
        const principal = parseFloat(principalInput?.value || '0');
        const fxRate = parseFloat(fxRateInput?.value || '0');
        const hint = document.getElementById('wizard-conversion-hint');

        if (hint && principal > 0) {
          if (fxRate > 0) {
            const brlAmount = principal * fxRate;
            hint.innerHTML = `<strong style="color: #667eea;">R$ ${this.formatNumber(brlAmount)}</strong> <small style="color: #6b7280;">(${this.formData.currency} ${this.formatNumber(principal)} × PTAX ${fxRate.toFixed(4)})</small>`;
          } else {
            hint.innerHTML = `<small style="color: #6b7280;">Informe a PTAX para calcular o valor em BRL</small>`;
          }
        }
      };

      principalInput?.addEventListener('input', updateConversion);
      fxRateInput?.addEventListener('input', updateConversion);
    }

    if (this.currentStep === 3) {
      // Alternar entre modo dias e data específica
      document.querySelectorAll('input[name="maturity-mode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
          const mode = (e.target as HTMLInputElement).value;
          const daysInput = document.getElementById('maturity-days-input');
          const dateInput = document.getElementById('maturity-date-input');

          if (mode === 'days') {
            if (daysInput) daysInput.style.display = 'block';
            if (dateInput) dateInput.style.display = 'none';
          } else {
            if (daysInput) daysInput.style.display = 'none';
            if (dateInput) dateInput.style.display = 'block';
          }
        });
      });

      // Calcular data de vencimento automaticamente
      const calcMaturity = () => {
        const startInput = document.getElementById('wizard-start-date') as HTMLInputElement;
        const termValueInput = document.getElementById('wizard-term-value') as HTMLInputElement;
        const termUnitSelect = document.getElementById('wizard-term-unit') as HTMLSelectElement;
        const display = document.getElementById('maturity-display');

        if (!startInput || !termValueInput || !termUnitSelect || !display) return;

        const startDate = new Date(startInput.value);
        const termValue = parseInt(termValueInput.value || '0');
        const termUnit = termUnitSelect.value;

        if (!isNaN(startDate.getTime()) && termValue > 0) {
          const maturityDate = new Date(startDate);

          if (termUnit === 'days') {
            maturityDate.setDate(maturityDate.getDate() + termValue);
          } else if (termUnit === 'months') {
            maturityDate.setMonth(maturityDate.getMonth() + termValue);
          } else if (termUnit === 'years') {
            maturityDate.setFullYear(maturityDate.getFullYear() + termValue);
          }

          display.textContent = maturityDate.toISOString().split('T')[0];
        }
      };

      document.getElementById('wizard-start-date')?.addEventListener('change', calcMaturity);
      document.getElementById('wizard-term-value')?.addEventListener('input', calcMaturity);
      document.getElementById('wizard-term-unit')?.addEventListener('change', calcMaturity);

      calcMaturity(); // Calcular inicial
    }

    if (this.currentStep === 4) {
      document.querySelectorAll('input[name="interest-template"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
          const template = (e.target as HTMLInputElement).value;
          if (this.formData.interestConfig) {
            this.formData.interestConfig.template = template as any;
          }
          this.updateUI();
        });
      });
    }

    if (this.currentStep === 5) {
      document.querySelectorAll('input[name="payment-flow"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
          const flowType = (e.target as HTMLInputElement).value;
          if (this.formData.paymentFlow) {
            this.formData.paymentFlow.type = flowType as any;
          }

          // Atualizar visual de todos os labels de payment-flow
          document.querySelectorAll('input[name="payment-flow"]').forEach(r => {
            const parent = r.parentElement;
            if (parent) {
              if ((r as HTMLInputElement).checked) {
                parent.style.borderColor = '#667eea';
                parent.style.background = '#f0f4ff';
              } else {
                parent.style.borderColor = '#e5e7eb';
                parent.style.background = 'white';
              }
            }
          });

          const scheduledConfig = document.getElementById('scheduled-config');
          if (scheduledConfig) {
            scheduledConfig.style.display = flowType === 'SCHEDULED' ? 'block' : 'none';
          }
        });
      });

      // Inicializar visual correto no carregamento do step
      document.querySelectorAll('input[name="payment-flow"]').forEach(r => {
        const parent = r.parentElement;
        if (parent && (r as HTMLInputElement).checked) {
          parent.style.borderColor = '#667eea';
          parent.style.background = '#f0f4ff';
        }
      });

      document.querySelectorAll('input[name="schedule-system"]').forEach(radio => {
        radio.addEventListener('change', () => {
          // Visual feedback
          document.querySelectorAll('input[name="schedule-system"]').forEach(r => {
            const parent = r.parentElement;
            if (parent) {
              if ((r as HTMLInputElement).checked) {
                parent.style.borderColor = '#667eea';
                parent.style.background = '#f0f4ff';
              } else {
                parent.style.borderColor = '#e5e7eb';
                parent.style.background = 'white';
              }
            }
          });
        });
      });

      // Inicializar visual correto para schedule-system também
      document.querySelectorAll('input[name="schedule-system"]').forEach(r => {
        const parent = r.parentElement;
        if (parent && (r as HTMLInputElement).checked) {
          parent.style.borderColor = '#667eea';
          parent.style.background = '#f0f4ff';
        }
      });
    }
  }

  /**
   * Atualiza a UI (re-renderiza o step atual).
   */
  private updateUI(): void {
    const content = document.getElementById('wizard-content');
    if (content) {
      content.innerHTML = this.renderCurrentStep();
      this.attachStepSpecificListeners();
    }
  }

  /**
   * Avança para o próximo step.
   */
  private async nextStep(): Promise<void> {
    // Captura dados do step atual
    if (!this.captureCurrentStepData()) {
      return; // Validação falhou
    }

    if (this.currentStep === this.totalSteps) {
      // Último step - criar contrato
      await this.finish();
    } else {
      // Avançar para próximo step
      this.currentStep++;
      this.renderWizard();
    }
  }

  /**
   * Volta para o step anterior.
   */
  private prevStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.renderWizard();
    }
  }

  /**
   * Captura dados do step atual.
   */
  private captureCurrentStepData(): boolean {
    try {
      switch (this.currentStep) {
        case 1: {
          const counterparty = (document.getElementById('wizard-counterparty') as HTMLInputElement)?.value.trim();
          const reference = (document.getElementById('wizard-reference') as HTMLInputElement)?.value.trim();

          if (!counterparty) {
            alert('Por favor, informe a contraparte.');
            return false;
          }

          this.formData.counterparty = counterparty;
          this.formData.notes = reference || undefined;
          break;
        }

        case 2: {
          const principal = parseFloat((document.getElementById('wizard-principal') as HTMLInputElement)?.value || '0');
          const fxRate = parseFloat((document.getElementById('wizard-fx-rate') as HTMLInputElement)?.value || '0');

          if (principal <= 0) {
            alert('Por favor, informe o valor principal.');
            return false;
          }

          this.formData.principalOrigin = principal;
          this.formData.contractFXRate = fxRate > 0 ? fxRate : undefined;
          break;
        }

        case 3: {
          const startDate = (document.getElementById('wizard-start-date') as HTMLInputElement)?.value;
          const maturityMode = (document.querySelector('input[name="maturity-mode"]:checked') as HTMLInputElement)?.value;

          let maturityDate: string;

          if (maturityMode === 'date') {
            maturityDate = (document.getElementById('wizard-maturity-date') as HTMLInputElement)?.value;
          } else {
            // Calcular da data de vencimento baseado no prazo
            const display = document.getElementById('maturity-display');
            maturityDate = display?.textContent || '';
          }

          if (!startDate || !maturityDate) {
            alert('Por favor, informe as datas.');
            return false;
          }

          if (new Date(startDate) >= new Date(maturityDate)) {
            alert('A data de vencimento deve ser posterior à data de início.');
            return false;
          }

          this.formData.startDate = startDate;
          this.formData.maturityDate = maturityDate;
          break;
        }

        case 4: {
          const selectedTemplate = (document.querySelector('input[name="interest-template"]:checked') as HTMLInputElement)?.value;
          const dayCount = (document.getElementById('wizard-day-count') as HTMLSelectElement)?.value;
          const compounding = (document.getElementById('wizard-compounding') as HTMLSelectElement)?.value;
          const rounding = (document.getElementById('wizard-rounding') as HTMLSelectElement)?.value;

          if (this.formData.interestConfig) {
            this.formData.interestConfig.template = selectedTemplate as any;
            this.formData.interestConfig.dayCountBasis = dayCount as any;
            this.formData.interestConfig.compounding = compounding as any;
            this.formData.interestConfig.rounding = rounding as any;

            // Capturar valores das pernas editadas
            const template = INTEREST_TEMPLATES[selectedTemplate];
            if (template && template.legs.length > 0) {
              this.formData.interestConfig.legs = template.legs.map((leg, index) => {
                const percentInput = document.getElementById(`wizard-leg-${index}-percent`) as HTMLInputElement | null;
                const spreadInput = document.getElementById(`wizard-leg-${index}-spread`) as HTMLInputElement | null;
                const baseInput = document.getElementById(`wizard-leg-${index}-base`) as HTMLInputElement | null;
                const baseRaw = baseInput?.value ?? '';
                const baseValue = baseRaw.trim() === '' ? undefined : Number.parseFloat(baseRaw);

                return {
                  indexer: leg.indexer,
                  indexerPercent: percentInput ? Number.parseFloat(percentInput.value) : leg.indexerPercent,
                  baseRateAnnual: baseValue != null && !Number.isNaN(baseValue) ? baseValue : leg.baseRateAnnual,
                  spreadAnnual: spreadInput ? Number.parseFloat(spreadInput.value) : leg.spreadAnnual,
                  dayCountBasis: dayCount as any,
                  ptaxCurrency: leg.ptaxCurrency || (this.formData.currency !== 'BRL' ? this.formData.currency : undefined),
                  ptaxSource: leg.ptaxSource,
                  role: leg.role || 'RATE'
                } as InterestLeg;
              });
            } else {
              // Template CUSTOM
              this.formData.interestConfig.legs = [{
                indexer: 'FIXED',
                indexerPercent: 100,
                baseRateAnnual: undefined,
                spreadAnnual: 8.5,
                role: 'RATE'
              }];
            }
          }
          break;
        }

        case 5: {
          const flowType = (document.querySelector('input[name="payment-flow"]:checked') as HTMLInputElement)?.value;

          if (this.formData.paymentFlow) {
            this.formData.paymentFlow.type = flowType as any;

            if (flowType === 'SCHEDULED') {
              const system = (document.querySelector('input[name="schedule-system"]:checked') as HTMLInputElement)?.value;
              const periodicity = (document.getElementById('wizard-periodicity') as HTMLSelectElement)?.value;
              const installments = parseInt((document.getElementById('wizard-installments') as HTMLInputElement)?.value || '0');
              const firstPayment = (document.getElementById('wizard-first-payment') as HTMLInputElement)?.value;
              const gracePeriods = parseInt((document.getElementById('wizard-grace-periods') as HTMLInputElement)?.value || '0');
              const graceType = (document.getElementById('wizard-grace-type') as HTMLSelectElement)?.value;

              if (installments <= 0) {
                alert('Por favor, informe o número de parcelas.');
                return false;
              }

              if (!firstPayment) {
                alert('Por favor, informe a data da primeira parcela.');
                return false;
              }

              this.formData.paymentFlow.scheduled = {
                system: system as 'PRICE' | 'SAC',
                periodicity: periodicity as any,
                installments,
                firstPaymentDate: firstPayment,
                gracePeriods: gracePeriods > 0 ? gracePeriods : undefined,
                graceType: gracePeriods > 0 ? (graceType as any) : undefined
              };
            }
          }
          break;
        }

        case 6: {
          const finalNotes = (document.getElementById('wizard-final-notes') as HTMLTextAreaElement)?.value.trim();
          if (finalNotes) {
            this.formData.notes = finalNotes;
          }
          break;
        }
      }

      return true;
    } catch (error) {
      logger.error('[LoanWizard] Erro ao capturar dados do step:', error);
      alert('Erro ao processar os dados. Verifique os campos.');
      return false;
    }
  }

  /**
   * Finaliza o wizard e retorna os dados.
   */
  private async finish(): Promise<void> {
    try {
      // Validação final
      if (!this.formData.counterparty || !this.formData.principalOrigin || !this.formData.startDate || !this.formData.maturityDate) {
        alert('Dados incompletos. Por favor, revise todos os steps.');
        return;
      }

        logger.info('[LoanWizard] Finalizando wizard e retornando dados do contrato...');
      
      // Resolve com os dados
      if (this.resolveCallback) {
        this.resolveCallback(this.formData as LoanContractInput);
          logger.info('[LoanWizard] Dados retornados via callback para o plugin');
      }

      this.dispose();
    } catch (error) {
      logger.error('[LoanWizard] Erro ao finalizar wizard:', error);
      alert('Erro ao criar contrato. Veja o console para detalhes.');
    }
  }

  /**
   * Cancela o wizard.
   */
  private cancel(): void {
    if (confirm('Deseja realmente cancelar? Os dados serão perdidos.')) {
      if (this.resolveCallback) {
        this.resolveCallback(null);
      }
      this.dispose();
    }
  }

  /**
   * Libera recursos.
   */
  public dispose(): void {
    this.modalElement?.remove();
    this.modalElement = null;
    this.resolveCallback = null;
  }

  /**
   * Formata número com separadores de milhar.
   */
  private formatNumber(value: number): string {
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /**
   * Retorna label descritivo do fluxo de pagamento.
   */
  private getPaymentFlowLabel(): string {
    const flow = this.formData.paymentFlow;
    if (!flow) return 'N/A';

    if (flow.type === 'SCHEDULED' && flow.scheduled) {
      return `${flow.scheduled.system} · ${flow.scheduled.installments} parcelas ${flow.scheduled.periodicity.toLowerCase()}s`;
    }

    const labels: Record<string, string> = {
      FLEXIBLE: 'Pagamentos flexíveis (quando ocorrer)',
      BULLET: 'BULLET (tudo no vencimento)',
      ACCRUAL_ONLY: 'Apenas acúmulo de juros'
    };

    return labels[flow.type] || flow.type;
  }
}
