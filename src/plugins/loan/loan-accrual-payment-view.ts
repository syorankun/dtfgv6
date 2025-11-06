/**
 * Loan Accrual Payment View - Enriquece dados de accrual com informações de pagamentos
 * 
 * Responsável por combinar os dados de accrual com pagamentos realizados,
 * calculando juros pendentes e saldo devedor recalculado.
 */

import type { AccrualRow } from './loan-scheduler';
import type { LoanLedgerEntry } from './loan-payment-manager';
import { LoanCalculator } from './loan-calculator';

export interface AccrualRowWithPayments extends AccrualRow {
  // Pagamentos do período
  interestPaidBRL: number;
  interestPaidOrigin: number;
  principalPaidBRL: number;
  principalPaidOrigin: number;
  totalPaymentBRL: number;
  totalPaymentOrigin: number;

  // Juros pendentes (acumulado - pago acumulado até a data)
  interestPendingBRL: number;
  interestPendingOrigin: number;

  // Saldo recalculado após pagamentos
  recalculatedBalanceBRL: number;
  recalculatedBalanceOrigin: number;

  // Indicadores adicionais
  interestDeltaBRL: number;
  interestDeltaOrigin: number;
  interestCoverageRatio: number | null;
  coverageStatus: 'noInterest' | 'covered' | 'partial' | 'missing';
  amortizationEffectBRL: number;
  amortizationEffectOrigin: number;
  cashVsAccrualBRL: number;
  cashVsAccrualOrigin: number;

  // Indicador de linha com pagamento
  hasPayment: boolean;
  paymentCount: number;
}

/**
 * Enriquece linhas de accrual com dados de pagamentos.
 */
export class LoanAccrualPaymentEnricher {
  /**
   * Enriquece dados de accrual com informações de pagamentos do ledger.
   * IMPORTANTE: Recalcula juros considerando amortização do principal.
   * 
   * @param accrualRows Linhas de accrual originais
   * @param ledgerEntries Entradas do ledger com pagamentos
   * @param contractCurrency Moeda do contrato
   * @returns Linhas enriquecidas com accrual recalculado
   */
  public static enrichWithPayments(
    accrualRows: AccrualRow[],
    ledgerEntries: LoanLedgerEntry[],
    _contractCurrency: string
  ): AccrualRowWithPayments[] {
    // Organiza pagamentos por data
    const paymentsByDate = this.groupPaymentsByDate(ledgerEntries);
    
    console.log('[LoanAccrualPaymentEnricher] Enriquecendo dados:', {
      totalRows: accrualRows.length,
      totalLedgerEntries: ledgerEntries.length,
      paymentDates: Array.from(paymentsByDate.keys()),
      sampleRow: accrualRows[0],
      sampleLedger: ledgerEntries[0]
    });

    // Acumuladores
    let cumulativeInterestPaidBRL = 0;
    let cumulativeInterestPaidOrigin = 0;
    let cumulativePrincipalPaidBRL = 0;
    let cumulativePrincipalPaidOrigin = 0;
    
    // Saldo corrente que vai sendo reduzido por pagamentos
    let currentBalanceBRL = accrualRows.length > 0 ? 
      (accrualRows[0].openingBalanceBRLPTAX || accrualRows[0].openingBalanceBRLContract || 0) : 0;
    let currentBalanceOrigin = accrualRows.length > 0 ? 
      (accrualRows[0].openingBalanceOrigin || 0) : 0;
    
    // Acumuladores de juros recalculados
    let recalculatedAccruedBRL = 0;
    let recalculatedAccruedOrigin = 0;

    return accrualRows.map((row) => {
      const dateKey = row.date;
      const payments = paymentsByDate.get(dateKey) || [];

      // Usa o saldo do período anterior (já ajustado por pagamentos anteriores)
      const openingBalanceBRL = currentBalanceBRL;
      const openingBalanceOrigin = currentBalanceOrigin;

      // Recalcula juros do período com base no saldo ATUAL (não no original)
      // A taxa efetiva é a mesma, mas aplicada sobre o saldo reduzido
      const effectiveRate = row.effRate || 0;
      const recalculatedInterestBRL = LoanCalculator.round(
        openingBalanceBRL * effectiveRate,
        2
      );
      const recalculatedInterestOrigin = LoanCalculator.round(
        openingBalanceOrigin * effectiveRate,
        4
      );

      // Acumula juros recalculados
      recalculatedAccruedBRL += recalculatedInterestBRL;
      recalculatedAccruedOrigin += recalculatedInterestOrigin;

      // Saldo após juros (antes de pagamentos)
      let balanceAfterInterestBRL = openingBalanceBRL + recalculatedInterestBRL;
      let balanceAfterInterestOrigin = openingBalanceOrigin + recalculatedInterestOrigin;

      // Processa pagamentos desta data usando juros recalculados como referência
      const periodPayments = this.calculatePeriodPaymentsWithRecalc(
        payments,
        recalculatedInterestBRL,
        recalculatedInterestOrigin
      );

      // Atualiza acumuladores de pagamentos
      cumulativeInterestPaidBRL += periodPayments.interestPaidBRL;
      cumulativeInterestPaidOrigin += periodPayments.interestPaidOrigin;
      cumulativePrincipalPaidBRL += periodPayments.principalPaidBRL;
      cumulativePrincipalPaidOrigin += periodPayments.principalPaidOrigin;

      // Abate pagamentos do saldo
      // Primeiro abate juros pagos do accrual de juros
      recalculatedAccruedBRL = Math.max(0, recalculatedAccruedBRL - periodPayments.interestPaidBRL);
      recalculatedAccruedOrigin = Math.max(0, recalculatedAccruedOrigin - periodPayments.interestPaidOrigin);
      
      // Depois abate o principal pago do saldo
      balanceAfterInterestBRL = Math.max(0, balanceAfterInterestBRL - periodPayments.totalPaymentBRL);
      balanceAfterInterestOrigin = Math.max(0, balanceAfterInterestOrigin - periodPayments.totalPaymentOrigin);

      // Atualiza saldo corrente para próxima iteração
      currentBalanceBRL = balanceAfterInterestBRL;
      currentBalanceOrigin = balanceAfterInterestOrigin;

      // Calcula juros pendentes (acumulado - pago acumulado)
      const interestPendingBRL = LoanCalculator.round(recalculatedAccruedBRL, 2);
      const interestPendingOrigin = LoanCalculator.round(recalculatedAccruedOrigin, 4);

      const interestDeltaBRL = LoanCalculator.round(
        recalculatedInterestBRL - periodPayments.interestPaidBRL,
        2
      );
      const interestDeltaOrigin = LoanCalculator.round(
        recalculatedInterestOrigin - periodPayments.interestPaidOrigin,
        4
      );

      const interestCoverageRatio = recalculatedInterestBRL === 0
        ? null
        : periodPayments.interestPaidBRL / recalculatedInterestBRL;

      const coverageStatus: AccrualRowWithPayments['coverageStatus'] =
        recalculatedInterestBRL === 0 && periodPayments.interestPaidBRL === 0
          ? 'noInterest'
          : interestDeltaBRL <= 0
            ? 'covered'
            : periodPayments.interestPaidBRL === 0
              ? 'missing'
              : 'partial';

      const amortizationEffectBRL = LoanCalculator.round(
        openingBalanceBRL - currentBalanceBRL,
        2
      );
      const amortizationEffectOrigin = LoanCalculator.round(
        openingBalanceOrigin - currentBalanceOrigin,
        4
      );

      const cashVsAccrualBRL = LoanCalculator.round(
        periodPayments.totalPaymentBRL - recalculatedInterestBRL,
        2
      );
      const cashVsAccrualOrigin = LoanCalculator.round(
        periodPayments.totalPaymentOrigin - recalculatedInterestOrigin,
        4
      );

      return {
        ...row,
        // Substitui valores originais pelos recalculados
        openingBalanceBRLPTAX: LoanCalculator.round(openingBalanceBRL, 2),
        openingBalanceOrigin: LoanCalculator.round(openingBalanceOrigin, 4),
        interestBRLPTAX: recalculatedInterestBRL,
        interestOrigin: recalculatedInterestOrigin,
        accruedInterestBRLPTAX: LoanCalculator.round(recalculatedAccruedBRL, 2),
        accruedInterestOrigin: LoanCalculator.round(recalculatedAccruedOrigin, 4),
        closingBalanceBRLPTAX: LoanCalculator.round(currentBalanceBRL, 2),
        closingBalanceOrigin: LoanCalculator.round(currentBalanceOrigin, 4),
        
        // Dados de pagamentos
        interestPaidBRL: periodPayments.interestPaidBRL,
        interestPaidOrigin: periodPayments.interestPaidOrigin,
        principalPaidBRL: periodPayments.principalPaidBRL,
        principalPaidOrigin: periodPayments.principalPaidOrigin,
        totalPaymentBRL: periodPayments.totalPaymentBRL,
        totalPaymentOrigin: periodPayments.totalPaymentOrigin,
        
        // Métricas calculadas
        interestPendingBRL,
        interestPendingOrigin,
        recalculatedBalanceBRL: currentBalanceBRL,
        recalculatedBalanceOrigin: currentBalanceOrigin,
        interestDeltaBRL,
        interestDeltaOrigin,
        interestCoverageRatio,
        coverageStatus,
        amortizationEffectBRL,
        amortizationEffectOrigin,
        cashVsAccrualBRL,
        cashVsAccrualOrigin,
        hasPayment: payments.length > 0,
        paymentCount: payments.length
      };
    });
  }

  /**
   * Agrupa entradas do ledger por data.
   */
  private static groupPaymentsByDate(
    ledgerEntries: LoanLedgerEntry[]
  ): Map<string, LoanLedgerEntry[]> {
    const grouped = new Map<string, LoanLedgerEntry[]>();

    ledgerEntries
      .filter((entry) => entry.type === 'PAGAMENTO')
      .forEach((entry) => {
        const dateKey = entry.entryDate;
        const existing = grouped.get(dateKey) || [];
        existing.push(entry);
        grouped.set(dateKey, existing);
      });

    return grouped;
  }

  /**
   * Calcula totais de pagamentos para um período, fazendo alocação inteligente.
   */

  /**
   * Versão que usa juros recalculados do período para alocação (mais precisa).
   */
  private static calculatePeriodPaymentsWithRecalc(
    payments: LoanLedgerEntry[],
    recalculatedInterestBRL: number,
    recalculatedInterestOrigin: number
  ): {
    interestPaidBRL: number;
    interestPaidOrigin: number;
    principalPaidBRL: number;
    principalPaidOrigin: number;
    totalPaymentBRL: number;
    totalPaymentOrigin: number;
  } {
    let interestPaidBRL = 0;
    let interestPaidOrigin = 0;
    let principalPaidBRL = 0;
    let principalPaidOrigin = 0;

    // Alocação por pagamento: cobre juros do período, sobra vai para principal
    payments.forEach((payment) => {
      const paymentBRL = Math.abs(payment.amountBRL);
      const paymentOrigin = Math.abs(payment.amountOrigin);

      const remainingInterestBRL = Math.max(0, recalculatedInterestBRL - interestPaidBRL);
      const remainingInterestOrigin = Math.max(0, recalculatedInterestOrigin - interestPaidOrigin);

      const allocatedToInterestBRL = Math.min(paymentBRL, remainingInterestBRL);
      const allocatedToInterestOrigin = Math.min(paymentOrigin, remainingInterestOrigin);

      interestPaidBRL += allocatedToInterestBRL;
      interestPaidOrigin += allocatedToInterestOrigin;

      principalPaidBRL += Math.max(0, paymentBRL - allocatedToInterestBRL);
      principalPaidOrigin += Math.max(0, paymentOrigin - allocatedToInterestOrigin);
    });

    return {
      interestPaidBRL: LoanCalculator.round(interestPaidBRL, 2),
      interestPaidOrigin: LoanCalculator.round(interestPaidOrigin, 4),
      principalPaidBRL: LoanCalculator.round(principalPaidBRL, 2),
      principalPaidOrigin: LoanCalculator.round(principalPaidOrigin, 4),
      totalPaymentBRL: LoanCalculator.round(interestPaidBRL + principalPaidBRL, 2),
      totalPaymentOrigin: LoanCalculator.round(interestPaidOrigin + principalPaidOrigin, 4)
    };
  }

  /**
   * Cria um resumo agregado dos pagamentos totais.
   */
  public static createPaymentSummary(enrichedRows: AccrualRowWithPayments[]): {
    totalInterestPaidBRL: number;
    totalInterestPaidOrigin: number;
    totalPrincipalPaidBRL: number;
    totalPrincipalPaidOrigin: number;
    totalPaymentBRL: number;
    totalPaymentOrigin: number;
    totalInterestDeltaBRL: number;
    totalInterestDeltaOrigin: number;
    cashVsAccrualBRL: number;
    cashVsAccrualOrigin: number;
    avgInterestCoverage: number | null;
    coverageStatus: {
      covered: number;
      partial: number;
      missing: number;
      noInterest: number;
    };
    finalInterestPendingBRL: number;
    finalInterestPendingOrigin: number;
    finalBalanceBRL: number;
    finalBalanceOrigin: number;
    paymentCount: number;
  } {
    type PaymentSummaryAccumulator = {
      totalInterestPaidBRL: number;
      totalInterestPaidOrigin: number;
      totalPrincipalPaidBRL: number;
      totalPrincipalPaidOrigin: number;
      totalPaymentBRL: number;
      totalPaymentOrigin: number;
      totalInterestDeltaBRL: number;
      totalInterestDeltaOrigin: number;
      cashVsAccrualBRL: number;
      cashVsAccrualOrigin: number;
      paymentCount: number;
      coverageSum: number;
      coverageCount: number;
      coverageBreakdown: {
        covered: number;
        partial: number;
        missing: number;
        noInterest: number;
      };
    };

    const summary = enrichedRows.reduce<PaymentSummaryAccumulator>(
      (acc, row) => {
        if (row.interestCoverageRatio !== null && !Number.isNaN(row.interestCoverageRatio)) {
          acc.coverageSum += row.interestCoverageRatio;
          acc.coverageCount += 1;
        }

        acc.coverageBreakdown[row.coverageStatus] += 1;

        acc.totalInterestPaidBRL += row.interestPaidBRL;
        acc.totalInterestPaidOrigin += row.interestPaidOrigin;
        acc.totalPrincipalPaidBRL += row.principalPaidBRL;
        acc.totalPrincipalPaidOrigin += row.principalPaidOrigin;
        acc.totalPaymentBRL += row.totalPaymentBRL;
        acc.totalPaymentOrigin += row.totalPaymentOrigin;
        acc.totalInterestDeltaBRL += row.interestDeltaBRL;
        acc.totalInterestDeltaOrigin += row.interestDeltaOrigin;
        acc.cashVsAccrualBRL += row.cashVsAccrualBRL;
        acc.cashVsAccrualOrigin += row.cashVsAccrualOrigin;
        acc.paymentCount += row.paymentCount;

        return acc;
      },
      {
        totalInterestPaidBRL: 0,
        totalInterestPaidOrigin: 0,
        totalPrincipalPaidBRL: 0,
        totalPrincipalPaidOrigin: 0,
        totalPaymentBRL: 0,
        totalPaymentOrigin: 0,
        totalInterestDeltaBRL: 0,
        totalInterestDeltaOrigin: 0,
        cashVsAccrualBRL: 0,
        cashVsAccrualOrigin: 0,
        paymentCount: 0,
        coverageSum: 0,
        coverageCount: 0,
        coverageBreakdown: {
          covered: 0,
          partial: 0,
          missing: 0,
          noInterest: 0
        }
      }
    );

    const lastRow = enrichedRows[enrichedRows.length - 1];
    const avgInterestCoverage = summary.coverageCount > 0
      ? summary.coverageSum / summary.coverageCount
      : null;

    return {
      totalInterestPaidBRL: LoanCalculator.round(summary.totalInterestPaidBRL, 2),
      totalInterestPaidOrigin: LoanCalculator.round(summary.totalInterestPaidOrigin, 4),
      totalPrincipalPaidBRL: LoanCalculator.round(summary.totalPrincipalPaidBRL, 2),
      totalPrincipalPaidOrigin: LoanCalculator.round(summary.totalPrincipalPaidOrigin, 4),
      totalPaymentBRL: LoanCalculator.round(summary.totalPaymentBRL, 2),
      totalPaymentOrigin: LoanCalculator.round(summary.totalPaymentOrigin, 4),
      totalInterestDeltaBRL: LoanCalculator.round(summary.totalInterestDeltaBRL, 2),
      totalInterestDeltaOrigin: LoanCalculator.round(summary.totalInterestDeltaOrigin, 4),
      cashVsAccrualBRL: LoanCalculator.round(summary.cashVsAccrualBRL, 2),
      cashVsAccrualOrigin: LoanCalculator.round(summary.cashVsAccrualOrigin, 4),
      avgInterestCoverage,
      coverageStatus: summary.coverageBreakdown,
      finalInterestPendingBRL: lastRow?.interestPendingBRL || 0,
      finalInterestPendingOrigin: lastRow?.interestPendingOrigin || 0,
      finalBalanceBRL: lastRow?.recalculatedBalanceBRL || 0,
      finalBalanceOrigin: lastRow?.recalculatedBalanceOrigin || 0,
      paymentCount: summary.paymentCount
    };
  }

  /**
   * Atualiza um AccrualRow com dados de pagamento para uso com PAYMENT_ACCRUAL_VIEW.
   */
  public static updateRowWithPaymentData(
    row: AccrualRow,
    enrichedData: AccrualRowWithPayments
  ): AccrualRow {
    // Cria uma cópia do row e adiciona propriedades calculadas
    return {
      ...row,
      // Adiciona campos calculados como propriedades do objeto
      ...(enrichedData as any)
    };
  }
}
