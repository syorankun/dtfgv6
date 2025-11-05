/**
 * Loan Accrual Payment Recalculator
 *
 * Esta classe é responsável por uma lógica complexa e crucial: recalcular um cronograma
 * de accrual (competência) levando em consideração os pagamentos parciais ou totais
 * que foram realizados ao longo do tempo.
 *
 * A abordagem é a seguinte:
 * 1. Gera-se um cronograma de accrual "puro", como se não houvesse pagamentos.
 * 2. Os pagamentos registrados são mesclados a este cronograma.
 * 3. O cronograma é percorrido linha a linha, e a cada evento (pagamento ou fim de período),
 *    os saldos são recalculados de forma pro-rata.
 *
 * Principais Regras de Negócio Implementadas:
 * - Alocação de Pagamento: Todo pagamento cobre primeiro os juros pendentes. O restante amortiza o principal.
 * - Redução da Base de Cálculo: Uma vez que o principal é amortizado, a base para o cálculo de juros
 *   dos períodos seguintes é reduzida.
 * - Juros sobre Juros (Pendentes): Se um pagamento não cobre todos os juros do período, o juro remanescente
 *   (juro sobre juro) é capitalizado no saldo devedor, conforme regime de juros compostos.
 * - Transparência: O resultado final expõe colunas detalhadas como "Juros Pagos", "Principal Pago",
 *   "Juros Pendentes" e "Saldo Devedor Recalculado".
 */
import type { AccrualRow } from './loan-scheduler';
import type { LoanPayment } from './loan-payment-manager';
import { LoanCalculator } from './loan-calculator';

export interface RecalculatedAccrualRow extends AccrualRow {
  // Campos adicionados pelo recálculo
  paymentId?: string;
  isPayment: boolean;
  totalPaymentOrigin: number;
  totalPaymentBRL: number;
  interestPaidOrigin: number;
  interestPaidBRL: number;
  principalPaidOrigin: number;
  principalPaidBRL: number;
  interestPendingOrigin: number;
  interestPendingBRL: number;
  recalculatedBalanceOrigin: number;
  recalculatedBalanceBRL: number;
  interestDeltaOrigin: number; // Juros do período - Juros pagos
  interestDeltaBRL: number;
  interestCoverageRatio: number; // Juros pagos / Juros do período
  amortizationEffectOrigin: number; // Impacto líquido no principal
  amortizationEffectBRL: number;
  cashVsAccrualOrigin: number; // Pagamento total vs Juros do período
  cashVsAccrualBRL: number;
}

export class LoanAccrualPaymentRecalculator {
  /**
   * Mescla pagamentos com o cronograma de accrual e recalcula todos os saldos.
   * @param pureAccrualRows Cronograma de accrual sem considerar pagamentos.
   * @param payments Lista de pagamentos registrados para o contrato.
   * @returns Um cronograma de `RecalculatedAccrualRow` com todos os saldos ajustados.
   */
  public static recalculate(
    pureAccrualRows: AccrualRow[],
    payments: LoanPayment[],
    interestConfig: any,
    principalOrigin: number
  ): RecalculatedAccrualRow[] {
    if (payments.length === 0) {
      // Se não há pagamentos, apenas enriquecemos as linhas existentes com valores zerados.
      return pureAccrualRows.map(row => ({
        ...row,
        isPayment: false,
        totalPaymentOrigin: 0,
        totalPaymentBRL: 0,
        interestPaidOrigin: 0,
        interestPaidBRL: 0,
        principalPaidOrigin: 0,
        principalPaidBRL: 0,
        interestPendingOrigin: row.accruedInterestOrigin,
        interestPendingBRL: row.accruedInterestBRLPTAX,
        recalculatedBalanceOrigin: row.closingBalanceOrigin,
        recalculatedBalanceBRL: row.closingBalanceBRLPTAX,
        interestDeltaOrigin: -row.interestOrigin,
        interestDeltaBRL: -row.interestBRLPTAX,
        interestCoverageRatio: 0,
        amortizationEffectOrigin: 0,
        amortizationEffectBRL: 0,
        cashVsAccrualOrigin: -row.interestOrigin,
        cashVsAccrualBRL: -row.interestBRLPTAX
      }));
    }

    const events = this.getSortedEvents(pureAccrualRows, payments);
    const recalculatedRows: RecalculatedAccrualRow[] = [];

    // Inicializa os saldos com o valor de principal do contrato.
    let runningPrincipal = principalOrigin;
    let unpaidInterest = 0;
    let totalInterestAccrued = 0;
    let lastEventDate = pureAccrualRows[0]?.date
      ? this.getPreviousDay(pureAccrualRows[0].date)
      : new Date().toISOString().split('T')[0];

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const daysInPeriod = LoanCalculator.getDaysBetween(lastEventDate, event.date, interestConfig.dayCountBasis);

      // 1. Calcula juros pro-rata desde o último evento sobre o saldo devedor atual.
      const periodRate =
        interestConfig.legs && interestConfig.legs.length > 0
          ? LoanCalculator.calculatePeriodicRate(
              interestConfig.legs[0].baseRateAnnual || 0,
              interestConfig.compounding,
              interestConfig.dayCountBasis,
              daysInPeriod
            )
          : 0;
      const interestForPeriod = LoanCalculator.round(runningPrincipal * periodRate, 4);

      // Adiciona juros do período aos acumulados e pendentes.
      totalInterestAccrued += interestForPeriod;
      unpaidInterest += interestForPeriod;

      let interestPaid = 0;
      let principalPaid = 0;
      let isPaymentEvent = false;
      let paymentAmount = 0;

      // 2. Se o evento for um pagamento, processa a alocação.
      if (event.isPayment) {
        isPaymentEvent = true;
        paymentAmount = (event as any).amountOrigin;

        // Aloca para juros primeiro.
        interestPaid = Math.min(paymentAmount, unpaidInterest);
        // O restante amortiza o principal.
        principalPaid = paymentAmount - interestPaid;

        // Abate dos saldos.
        unpaidInterest -= interestPaid;
        runningPrincipal -= principalPaid;
      }

      // 3. Capitaliza juros pendentes no final de um período de accrual (se não for um pagamento).
      if (!isPaymentEvent && unpaidInterest > 0 && interestConfig.compounding === 'EXPONENCIAL') {
        runningPrincipal += unpaidInterest;
        // Zera juros pendentes após capitalização.
        unpaidInterest = 0;
      }

      const interestCoverageRatio = interestForPeriod > 0 ? LoanCalculator.round(interestPaid / interestForPeriod, 4) : 0;
      const openingBalance = i > 0 ? recalculatedRows[i - 1].recalculatedBalanceOrigin : principalOrigin;

      const newRow: RecalculatedAccrualRow = {
        ...(event as any),
        openingBalanceOrigin: openingBalance,
        interestOrigin: interestForPeriod,
        accruedInterestOrigin: totalInterestAccrued,
        closingBalanceOrigin: runningPrincipal + unpaidInterest, // Saldo de fechamento "puro"
        isPayment: isPaymentEvent,
        totalPaymentOrigin: paymentAmount,
        interestPaidOrigin: interestPaid,
        principalPaidOrigin: principalPaid,
        interestPendingOrigin: unpaidInterest,
        recalculatedBalanceOrigin: runningPrincipal,
        // Converte para BRL para exibição
        openingBalanceBRLPTAX: LoanCalculator.round(openingBalance * event.fxRatePTAX, 2),
        interestBRLPTAX: LoanCalculator.round(interestForPeriod * event.fxRatePTAX, 2),
        accruedInterestBRLPTAX: LoanCalculator.round(totalInterestAccrued * event.fxRatePTAX, 2),
        closingBalanceBRLPTAX: LoanCalculator.round((runningPrincipal + unpaidInterest) * event.fxRatePTAX, 2),
        totalPaymentBRL: LoanCalculator.round(paymentAmount * event.fxRatePTAX, 2),
        interestPaidBRL: LoanCalculator.round(interestPaid * event.fxRatePTAX, 2),
        principalPaidBRL: LoanCalculator.round(principalPaid * event.fxRatePTAX, 2),
        interestPendingBRL: LoanCalculator.round(unpaidInterest * event.fxRatePTAX, 2),
        recalculatedBalanceBRL: LoanCalculator.round(runningPrincipal * event.fxRatePTAX, 2),
        // Métricas
        interestDeltaOrigin: interestPaid - interestForPeriod,
        interestDeltaBRL:
          LoanCalculator.round(interestPaid * event.fxRatePTAX, 2) -
          LoanCalculator.round(interestForPeriod * event.fxRatePTAX, 2),
        interestCoverageRatio,
        amortizationEffectOrigin: principalPaid,
        amortizationEffectBRL: LoanCalculator.round(principalPaid * event.fxRatePTAX, 2),
        cashVsAccrualOrigin: paymentAmount - interestForPeriod,
        cashVsAccrualBRL:
          LoanCalculator.round(paymentAmount * event.fxRatePTAX, 2) -
          LoanCalculator.round(interestForPeriod * event.fxRatePTAX, 2)
      };

      recalculatedRows.push(newRow);
      lastEventDate = event.date;
    }

    return recalculatedRows;
  }

  /**
   * Combina as linhas de accrual e os pagamentos em uma única lista de eventos, ordenada por data.
   */
  private static getSortedEvents(
    accrualRows: AccrualRow[],
    payments: LoanPayment[]
  ): (AccrualRow & { isPayment: boolean })[] {
    const paymentEvents = payments.map(p => {
      const correspondingAccrual =
        accrualRows.find(r => r.date >= p.paymentDate) || accrualRows[accrualRows.length - 1];
      return {
        ...correspondingAccrual,
        ...p,
        date: p.paymentDate,
        isPayment: true
      };
    });

    const accrualEvents = accrualRows.map(r => ({ ...r, isPayment: false }));

    const allEvents = [...paymentEvents, ...accrualEvents];
    allEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Remove duplicatas de data, mantendo o pagamento se houver conflito
    return allEvents.filter((event, index, self) => {
      const firstIndex = self.findIndex(e => e.date === event.date);
      if (firstIndex !== index) {
        // Se já existe um evento nesta data
        if (self[firstIndex].isPayment) return false; // O primeiro era pagamento, descarta este
        if (event.isPayment) {
          // Este é um pagamento e o anterior não era, precisa remover o anterior
          self.splice(firstIndex, 1);
          return true; // Mantém este
        }
      }
      return true;
    });
  }
  private static getPreviousDay(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    date.setUTCDate(date.getUTCDate() - 1);
    return date.toISOString().split('T')[0];
  }
}
