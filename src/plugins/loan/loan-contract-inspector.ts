import type { PluginContext } from '@core/types';
import { logger } from '@core/storage-utils-consolidated';
import type { LoanContract } from './loan-types';
import type { LoanPaymentManager, LoanPayment } from './loan-payment-manager';
import type { LoanAccrualHistory, AccrualHistoryEntry } from './loan-accrual-history';

interface ContractInspectorCallbacks {
  openPayment: (contractId: string) => void;
  generateAccrual: (contractId: string) => Promise<void>;
  generateSchedule: (contractId: string) => Promise<void>;
  openReports: (contractId: string) => void;
}

interface TimelineItem {
  id: string;
  type: 'ACCRUAL' | 'PAYMENT';
  date: string;
  amountBRL: number;
  title: string;
  subtitle: string;
  icon: string;
}

/**
 * LoanContractInspector - Modal de detalhes do contrato.
 */
export class LoanContractInspector {
  private context: PluginContext;
  private getContract: (id: string) => LoanContract | undefined;
  private paymentManager: LoanPaymentManager;
  private accrualHistory: LoanAccrualHistory;
  private callbacks: ContractInspectorCallbacks;
  private modalElement: HTMLElement | null = null;

  constructor(
    context: PluginContext,
    getContract: (id: string) => LoanContract | undefined,
    paymentManager: LoanPaymentManager,
    accrualHistory: LoanAccrualHistory,
    callbacks: ContractInspectorCallbacks
  ) {
    this.context = context;
    this.getContract = getContract;
    this.paymentManager = paymentManager;
    this.accrualHistory = accrualHistory;
    this.callbacks = callbacks;
  }

  public open(contractId: string): void {
    const contract = this.getContract(contractId);
    if (!contract) {
      this.context.ui.showToast(`Contrato ${contractId} não encontrado`, 'error');
      return;
    }

    this.dispose();

    const payments = this.paymentManager.getPaymentHistory(contractId);
    const paymentTotals = this.paymentManager.getTotalPayments(contractId);
    const lastPayment = payments.length > 0 ? payments[payments.length - 1] : null;

    const accruals = this.accrualHistory.getAccrualHistory(contractId);
    const lastAccrual = accruals.length > 0 ? accruals[accruals.length - 1] : null;
    const accrualStats = this.accrualHistory.getStatistics(contractId);

    const timeline = this.buildTimeline(payments, accruals, contract.currency).slice(0, 6);
    const scheduleEnabled = contract.paymentFlow.type === 'SCHEDULED' && !!contract.paymentFlow.scheduled;

    const modalHTML = `
      <div id="loan-contract-inspector" style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.55); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; z-index: 10400;">
        <div style="background: #ffffff; border-radius: 16px; width: 96%; max-width: 1100px; max-height: 92vh; overflow-y: auto; box-shadow: 0 24px 60px rgba(15, 23, 42, 0.35);">
          <div style="display: flex; justify-content: space-between; align-items: start; padding: 28px 32px; border-bottom: 1px solid #e5e7eb; background: linear-gradient(135deg, #4c51bf 0%, #6b46c1 100%); color: #fff;">
            <div>
              <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px; font-size: 14px; opacity: 0.9;">
                <span style="background: rgba(255, 255, 255, 0.2); padding: 4px 10px; border-radius: 999px; font-weight: 600;">${contract.contractType === 'CAPTADO' ? '📥 Captado' : '📤 Cedido'}</span>
                <span style="background: rgba(255, 255, 255, 0.2); padding: 4px 10px; border-radius: 999px; font-weight: 600;">${contract.currency}</span>
              </div>
              <h2 style="margin: 0; font-size: 2rem; font-weight: 700; letter-spacing: -0.02em;">Contrato ${contract.id}</h2>
              <p style="margin: 6px 0 0; font-size: 15px; opacity: 0.9;">${contract.counterparty}</p>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 13px; font-weight: 600; opacity: 0.8;">Status atual</div>
              <div style="margin-top: 6px; font-weight: 700; font-size: 14px; padding: 6px 14px; border-radius: 999px; display: inline-flex; align-items: center; gap: 6px; background: ${this.getStatusColor(contract.status).background}; color: ${this.getStatusColor(contract.status).color};">
                <span>${this.getStatusColor(contract.status).icon}</span>${contract.status}
              </div>
              <button id="contract-inspector-close" style="margin-top: 18px; background: rgba(255, 255, 255, 0.2); border: none; color: #fff; padding: 8px 14px; border-radius: 8px; cursor: pointer; font-weight: 600;">Fechar</button>
            </div>
          </div>

          <div style="padding: 28px 32px; display: flex; flex-direction: column; gap: 28px;">

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 18px;">
              ${this.renderMetricCard('💰 Saldo BRL', this.formatCurrency(contract.currentBalance.balanceBRL), `Atualizado em ${this.formatDate(contract.currentBalance.lastUpdateDate)}`)}
              ${this.renderMetricCard(`💱 Saldo ${contract.currency}`, this.formatCurrency(contract.currentBalance.balanceOrigin, contract.currency), 'Saldo na moeda do contrato')}
              ${this.renderMetricCard('📈 Juros Acumulados', this.formatCurrency(contract.currentBalance.accruedInterestBRL), this.formatCurrency(contract.currentBalance.accruedInterestOrigin, contract.currency))}
              ${this.renderMetricCard('🗓️ Próxima Parcela', contract.currentBalance.nextPaymentAmount ? this.formatCurrency(contract.currentBalance.nextPaymentAmount) : 'N/A', contract.currentBalance.nextPaymentDate ? this.formatDate(contract.currentBalance.nextPaymentDate) : 'Sem vencimentos')}
            </div>

            <section style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px 24px;">
              <h3 style="margin: 0 0 16px; font-size: 16px; font-weight: 700; color: #1f2937;">🧾 Informações Gerais</h3>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; font-size: 13px; color: #4b5563;">
                ${this.renderInfoRow('Contraparte', contract.counterparty)}
                ${this.renderInfoRow('Tipo', contract.contractType)}
                ${this.renderInfoRow('Moeda', contract.currency)}
                ${this.renderInfoRow('Início', this.formatDate(contract.startDate))}
                ${this.renderInfoRow('Vencimento', this.formatDate(contract.maturityDate))}
                ${this.renderInfoRow('Criado em', this.formatDate(contract.createdAt))}
              </div>
              <div style="margin-top: 18px;">
                <div style="font-weight: 600; font-size: 13px; color: #374151; margin-bottom: 8px;">Configuração de Juros</div>
                <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                  ${contract.interestConfig.legs.map(leg => `
                    <span style="background: #eef2ff; color: #4338ca; padding: 6px 10px; border-radius: 999px; font-size: 12px; font-weight: 600;">
                      ${leg.indexer}${leg.indexerPercent ? ` · ${leg.indexerPercent.toFixed(2)}%` : ''}${typeof leg.spreadAnnual === 'number' ? ` · +${leg.spreadAnnual.toFixed(2)}%` : ''}${leg.ptaxCurrency ? ` · ${leg.ptaxCurrency}` : ''}
                    </span>
                  `).join('')}
                </div>
              </div>
            </section>

            <section style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
              <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px;">
                <div style="font-weight: 700; color: #1f2937; margin-bottom: 14px; display: flex; align-items: center; gap: 8px;">💳 Pagamentos</div>
                <div style="display: flex; flex-direction: column; gap: 10px; font-size: 13px; color: #4b5563;">
                  <div><strong>Total registrado:</strong> ${this.formatCurrency(paymentTotals.totalBRL)} (${this.formatCurrency(paymentTotals.totalOrigin, contract.currency)})</div>
                  <div><strong>Quantidade:</strong> ${paymentTotals.count}</div>
                  <div><strong>Último pagamento:</strong> ${lastPayment ? `${this.formatDate(lastPayment.paymentDate)} · ${this.formatCurrency(lastPayment.amountBRL)} (${lastPayment.currency})` : 'Nenhum pagamento registrado'}</div>
                </div>
              </div>

              <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px;">
                <div style="font-weight: 700; color: #1f2937; margin-bottom: 14px; display: flex; align-items: center; gap: 8px;">📊 Accrual</div>
                <div style="display: flex; flex-direction: column; gap: 10px; font-size: 13px; color: #4b5563;">
                  <div><strong>Entradas registradas:</strong> ${accrualStats.totalAccrualEntries}</div>
                  <div><strong>Último período:</strong> ${lastAccrual ? `${this.formatDate(lastAccrual.periodStart)} → ${this.formatDate(lastAccrual.periodEnd)}` : 'Sem histórico'}</div>
                  <div><strong>Último saldo apurado:</strong> ${lastAccrual ? this.formatCurrency(lastAccrual.closingBalanceBRL) : 'N/A'}</div>
                </div>
              </div>
            </section>

            <section style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <div style="font-weight: 700; color: #1f2937; display: flex; align-items: center; gap: 8px;">🕒 Histórico Recente</div>
                <div style="font-size: 12px; color: #6b7280;">Mostrando até 6 eventos</div>
              </div>
              <div style="display: flex; flex-direction: column; gap: 12px;">
                ${timeline.length === 0 ? `<div style="padding: 16px; background: #f9fafb; border-radius: 8px; color: #6b7280; text-align: center;">Sem eventos registrados</div>` : timeline.map(item => `
                  <div style="padding: 14px 16px; border: 1px solid #e5e7eb; border-radius: 10px; display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                      <div style="font-weight: 600; color: #1f2937; display: flex; align-items: center; gap: 8px;">${item.icon} ${item.title}</div>
                      <div style="font-size: 12px; color: #6b7280;">${item.subtitle}</div>
                    </div>
                    <div style="text-align: right;">
                      <div style="font-weight: 700; color: ${item.type === 'PAYMENT' ? '#ef4444' : '#10b981'};">${this.formatCurrency(item.amountBRL)}</div>
                      <div style="font-size: 12px; color: #6b7280;">${this.formatDate(item.date)}</div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </section>

            <section style="display: flex; flex-wrap: wrap; gap: 12px; justify-content: flex-end;">
              <button id="contract-action-payment" style="padding: 12px 18px; border: none; border-radius: 10px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #fff; font-weight: 700; cursor: pointer; box-shadow: 0 8px 18px rgba(16, 185, 129, 0.25);">💸 Registrar pagamento</button>
              <button id="contract-action-accrual" style="padding: 12px 18px; border: none; border-radius: 10px; background: linear-gradient(135deg, #6366f1 0%, #7c3aed 100%); color: #fff; font-weight: 700; cursor: pointer; box-shadow: 0 8px 18px rgba(99, 102, 241, 0.25);">📈 Gerar ACCRUAL (30 dias)</button>
              <button id="contract-action-schedule" ${scheduleEnabled ? '' : 'disabled'} style="padding: 12px 18px; border: none; border-radius: 10px; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #fff; font-weight: 700; cursor: ${scheduleEnabled ? 'pointer' : 'not-allowed'}; opacity: ${scheduleEnabled ? '1' : '0.55'}; box-shadow: 0 8px 18px rgba(37, 99, 235, 0.25);">🗓️ Atualizar cronograma</button>
              <button id="contract-action-reports" style="padding: 12px 18px; border: none; border-radius: 10px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #fff; font-weight: 700; cursor: pointer; box-shadow: 0 8px 18px rgba(245, 158, 11, 0.25);">📊 Relatórios</button>
            </section>

          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.modalElement = document.getElementById('loan-contract-inspector');
    this.attachEventListeners(contract, scheduleEnabled);
  }

  public dispose(): void {
    this.modalElement?.remove();
    this.modalElement = null;
  }

  private attachEventListeners(contract: LoanContract, scheduleEnabled: boolean): void {
    document.getElementById('contract-inspector-close')?.addEventListener('click', () => this.dispose());

    this.modalElement?.addEventListener('click', (event) => {
      if (event.target === this.modalElement) {
        this.dispose();
      }
    });

    document.getElementById('contract-action-payment')?.addEventListener('click', () => {
      this.callbacks.openPayment(contract.id);
    });

    document.getElementById('contract-action-accrual')?.addEventListener('click', () => {
      this.handleAsyncAction('contract-action-accrual', () => this.callbacks.generateAccrual(contract.id));
    });

    if (scheduleEnabled) {
      document.getElementById('contract-action-schedule')?.addEventListener('click', () => {
        this.handleAsyncAction('contract-action-schedule', () => this.callbacks.generateSchedule(contract.id));
      });
    }

    document.getElementById('contract-action-reports')?.addEventListener('click', () => {
      this.callbacks.openReports(contract.id);
    });
  }

  private handleAsyncAction(buttonId: string, action: () => Promise<void>): void {
    const button = document.getElementById(buttonId) as HTMLButtonElement | null;
    if (!button || button.disabled) {
      void action();
      return;
    }

    const originalLabel = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '⏳ Processando...';

    action()
      .catch((error) => {
        logger.error('[LoanContractInspector] Erro ao executar ação', error);
        this.context.ui.showToast('❌ Erro ao executar ação', 'error');
      })
      .finally(() => {
        button.disabled = false;
        button.innerHTML = originalLabel;
      });
  }

  private renderMetricCard(title: string, value: string, subtitle: string): string {
    return `
      <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 18px 20px; display: flex; flex-direction: column; gap: 6px;">
        <div style="font-size: 12px; text-transform: uppercase; color: #6b7280; font-weight: 600; letter-spacing: 0.04em;">${title}</div>
        <div style="font-size: 22px; font-weight: 700; color: #111827;">${value}</div>
        <div style="font-size: 12px; color: #6b7280;">${subtitle}</div>
      </div>
    `;
  }

  private renderInfoRow(label: string, value: string): string {
    return `
      <div>
        <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: #9ca3af; letter-spacing: 0.04em;">${label}</div>
        <div style="margin-top: 4px; font-size: 14px; color: #1f2937; font-weight: 600;">${value}</div>
      </div>
    `;
  }

  private formatCurrency(value: number | undefined, currency = 'BRL'): string {
    if (value === undefined || Number.isNaN(value)) {
      return 'N/A';
    }
    const prefix = currency === 'BRL' ? 'R$' : currency;
    return `${prefix} ${this.formatNumber(value)}`;
  }

  private formatNumber(value: number): string {
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  private formatDate(value: string | undefined): string {
    if (!value) {
      return 'N/A';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleDateString('pt-BR');
  }

  private buildTimeline(
    payments: LoanPayment[],
    accruals: AccrualHistoryEntry[],
    currency: string
  ): TimelineItem[] {
    const paymentItems: TimelineItem[] = payments.map(payment => ({
      id: payment.id,
      type: 'PAYMENT',
      date: payment.paymentDate,
      amountBRL: payment.amountBRL,
      title: 'Pagamento registrado',
      subtitle: `${this.formatCurrency(payment.amountBRL)} · ${this.formatCurrency(payment.amountOrigin, currency)} (${payment.currency})`,
      icon: '💸'
    }));

    const accrualItems: TimelineItem[] = accruals.map(entry => ({
      id: entry.id,
      type: 'ACCRUAL',
      date: entry.periodEnd,
      amountBRL: entry.interestBRL,
      title: 'Accrual calculado',
      subtitle: `${entry.days} dias · Saldo final ${this.formatCurrency(entry.closingBalanceBRL)}`,
      icon: '📈'
    }));

    return [...paymentItems, ...accrualItems].sort((a, b) => b.date.localeCompare(a.date));
  }

  private getStatusColor(status: LoanContract['status']): { background: string; color: string; icon: string } {
    switch (status) {
      case 'ATIVO':
        return { background: 'rgba(16, 185, 129, 0.16)', color: '#047857', icon: '✅' };
      case 'QUITADO':
        return { background: 'rgba(107, 114, 128, 0.18)', color: '#374151', icon: '📁' };
      case 'VENCIDO':
        return { background: 'rgba(239, 68, 68, 0.16)', color: '#b91c1c', icon: '⚠️' };
      case 'RENEGOCIADO':
        return { background: 'rgba(59, 130, 246, 0.16)', color: '#1d4ed8', icon: '🔄' };
      default:
        return { background: 'rgba(107, 114, 128, 0.16)', color: '#374151', icon: 'ℹ️' };
    }
  }
}
