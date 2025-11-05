/**
 * Loan Accrual History - Gerenciamento de histórico de accrual
 *
 * Mantém histórico de cálculos de accrual e permite recálculo
 */

import { LoanCalculator } from './loan-calculator';
import { logger } from '@core/storage-utils-consolidated';

/**
 * Entrada de accrual calculada
 */
export interface AccrualHistoryEntry {
  id: string;
  contractId: string;
  calculationDate: string;     // Data em que o accrual foi calculado
  periodStart: string;          // Início do período de accrual
  periodEnd: string;            // Fim do período de accrual
  openingBalanceOrigin: number;
  openingBalanceBRL: number;
  interestOrigin: number;
  interestBRL: number;
  closingBalanceOrigin: number;
  closingBalanceBRL: number;
  fxRate: number;
  fxSource: string;
  effRate: number;              // Taxa efetiva aplicada
  days: number;                 // Dias do período
  createdAt: string;
}

/**
 * Snapshot de pagamento para histórico
 */
export interface PaymentHistoryEntry {
  id: string;
  contractId: string;
  paymentDate: string;
  amountOrigin: number;
  amountBRL: number;
  currency: string;
  fxRate: number;
  fxSource: string;
  interestPaidBRL: number;
  principalPaidBRL: number;
  balanceAfterOrigin: number;
  balanceAfterBRL: number;
  description?: string;
  createdAt: string;
}

/**
 * Gerencia histórico de accruals e permite recálculo
 */
export class LoanAccrualHistory {
  private accrualHistory: Map<string, AccrualHistoryEntry[]> = new Map();
  private paymentHistory: Map<string, PaymentHistoryEntry[]> = new Map();

  /**
   * Registra uma entrada de accrual no histórico
   */
  public recordAccrual(entry: AccrualHistoryEntry): void {
    const entries = this.accrualHistory.get(entry.contractId) || [];
    entries.push(entry);
    this.accrualHistory.set(entry.contractId, entries);
    logger.debug(`[AccrualHistory] Accrual registrado: ${entry.contractId} ${entry.periodEnd}`);
  }

  /**
   * Registra um pagamento no histórico
   */
  public recordPayment(entry: PaymentHistoryEntry): void {
    const entries = this.paymentHistory.get(entry.contractId) || [];
    entries.push(entry);
    this.paymentHistory.set(entry.contractId, entries);
    logger.debug(`[AccrualHistory] Pagamento registrado: ${entry.contractId} ${entry.paymentDate}`);
  }

  /**
   * Obtém histórico completo de accrual de um contrato
   */
  public getAccrualHistory(contractId: string): AccrualHistoryEntry[] {
    return this.accrualHistory.get(contractId) || [];
  }

  /**
   * Obtém histórico completo de pagamentos de um contrato
   */
  public getPaymentHistory(contractId: string): PaymentHistoryEntry[] {
    return this.paymentHistory.get(contractId) || [];
  }

  /**
   * Obtém histórico combinado (accrual + pagamentos) ordenado por data
   */
  public getCombinedHistory(contractId: string): Array<AccrualHistoryEntry | PaymentHistoryEntry> {
    const accruals = this.getAccrualHistory(contractId);
    const payments = this.getPaymentHistory(contractId);
    
    const combined: Array<AccrualHistoryEntry | PaymentHistoryEntry> = [
      ...accruals.map(a => ({ ...a, _type: 'ACCRUAL' as const })),
      ...payments.map(p => ({ ...p, _type: 'PAYMENT' as const }))
    ];

    // Ordena por data do evento
    combined.sort((a, b) => {
      const dateA = '_type' in a && a._type === 'ACCRUAL' 
        ? (a as AccrualHistoryEntry).periodEnd 
        : (a as PaymentHistoryEntry).paymentDate;
      const dateB = '_type' in b && b._type === 'ACCRUAL' 
        ? (b as AccrualHistoryEntry).periodEnd 
        : (b as PaymentHistoryEntry).paymentDate;
      return dateA.localeCompare(dateB);
    });

    return combined;
  }

  /**
   * Limpa histórico de um contrato (útil para recálculo completo)
   */
  public clearHistory(contractId: string): void {
    this.accrualHistory.delete(contractId);
    logger.info(`[AccrualHistory] Histórico de accrual limpo: ${contractId}`);
  }

  /**
   * Limpa histórico de pagamentos de um contrato
   */
  public clearPaymentHistory(contractId: string): void {
    this.paymentHistory.delete(contractId);
    logger.info(`[AccrualHistory] Histórico de pagamentos limpo: ${contractId}`);
  }

  /**
   * Calcula saldo atual baseado no histórico
   */
  public calculateCurrentBalance(contractId: string): {
    balanceOrigin: number;
    balanceBRL: number;
    accruedInterestBRL: number;
    lastUpdateDate: string;
  } | null {
    const history = this.getCombinedHistory(contractId);
    if (history.length === 0) {
      return null;
    }

    let balanceOrigin = 0;
    let balanceBRL = 0;
    let accruedInterestBRL = 0;
    let lastDate = '';

    for (const entry of history) {
      if ('_type' in entry && entry._type === 'ACCRUAL') {
        const accrual = entry as AccrualHistoryEntry;
        balanceOrigin = accrual.closingBalanceOrigin;
        balanceBRL = accrual.closingBalanceBRL;
        accruedInterestBRL += accrual.interestBRL;
        lastDate = accrual.periodEnd;
      } else if ('_type' in entry && entry._type === 'PAYMENT') {
        const payment = entry as PaymentHistoryEntry;
        balanceOrigin = payment.balanceAfterOrigin;
        balanceBRL = payment.balanceAfterBRL;
        accruedInterestBRL = Math.max(0, accruedInterestBRL - payment.interestPaidBRL);
        lastDate = payment.paymentDate;
      }
    }

    return {
      balanceOrigin: LoanCalculator.round(balanceOrigin, 2),
      balanceBRL: LoanCalculator.round(balanceBRL, 2),
      accruedInterestBRL: LoanCalculator.round(accruedInterestBRL, 2),
      lastUpdateDate: lastDate
    };
  }

  /**
   * Persiste histórico
   */
  public saveHistory(): {
    accruals: Record<string, AccrualHistoryEntry[]>;
    payments: Record<string, PaymentHistoryEntry[]>;
  } {
    const accruals: Record<string, AccrualHistoryEntry[]> = {};
    const payments: Record<string, PaymentHistoryEntry[]> = {};

    this.accrualHistory.forEach((entries, contractId) => {
      accruals[contractId] = entries;
    });

    this.paymentHistory.forEach((entries, contractId) => {
      payments[contractId] = entries;
    });

    return { accruals, payments };
  }

  /**
   * Carrega histórico persistido
   */
  public loadHistory(data: {
    accruals?: Record<string, AccrualHistoryEntry[]>;
    payments?: Record<string, PaymentHistoryEntry[]>;
  }): void {
    this.accrualHistory.clear();
    this.paymentHistory.clear();

    if (data.accruals) {
      Object.entries(data.accruals).forEach(([contractId, entries]) => {
        this.accrualHistory.set(contractId, entries);
      });
      logger.info(`[AccrualHistory] ${this.accrualHistory.size} contratos com histórico de accrual carregados`);
    }

    if (data.payments) {
      Object.entries(data.payments).forEach(([contractId, entries]) => {
        this.paymentHistory.set(contractId, entries);
      });
      logger.info(`[AccrualHistory] ${this.paymentHistory.size} contratos com histórico de pagamentos carregados`);
    }
  }

  /**
   * Obtém estatísticas do histórico
   */
  public getStatistics(contractId: string): {
    totalAccrualEntries: number;
    totalPayments: number;
    totalInterestAccrued: number;
    totalPrincipalPaid: number;
    totalInterestPaid: number;
    firstEntryDate: string | null;
    lastEntryDate: string | null;
  } {
    const accruals = this.getAccrualHistory(contractId);
    const payments = this.getPaymentHistory(contractId);

    const totalInterestAccrued = accruals.reduce((sum, a) => sum + a.interestBRL, 0);
    const totalPrincipalPaid = payments.reduce((sum, p) => sum + p.principalPaidBRL, 0);
    const totalInterestPaid = payments.reduce((sum, p) => sum + p.interestPaidBRL, 0);

    const allDates = [
      ...accruals.map(a => a.periodEnd),
      ...payments.map(p => p.paymentDate)
    ].sort();

    return {
      totalAccrualEntries: accruals.length,
      totalPayments: payments.length,
      totalInterestAccrued: LoanCalculator.round(totalInterestAccrued, 2),
      totalPrincipalPaid: LoanCalculator.round(totalPrincipalPaid, 2),
      totalInterestPaid: LoanCalculator.round(totalInterestPaid, 2),
      firstEntryDate: allDates[0] || null,
      lastEntryDate: allDates[allDates.length - 1] || null
    };
  }
}
