/**
 * Loan Scheduler - Gera cronogramas ACCRUAL e Schedule
 *
 * Responsável por gerar cronogramas de:
 * - ACCRUAL: Acúmulo de juros período a período
 * - SCHEDULE: Cronograma de pagamentos (PRICE/SAC/BULLET)
 */

import type { LoanContract } from './loan-types';
import { LoanCalculator } from './loan-calculator';
import { LoanFXIntegration } from './loan-fx-integration';
import { LoanIndexerService } from './loan-indexer-service';
import { LoanPaymentManager } from './loan-payment-manager';
import { logger } from '@core/storage-utils-consolidated';

/**
 * Representa uma linha no cronograma de ACCRUAL.
 */
export interface AccrualRow {
  date: string;
  days: number;
  effRate: number;                    // Taxa efetiva do período
  openingBalanceOrigin: number;
  interestOrigin: number;
  closingBalanceOrigin: number;
  // Valores em BRL usando taxa do CONTRATO (fixada)
  openingBalanceBRLContract: number;
  interestBRLContract: number;
  closingBalanceBRLContract: number;
  fxRateContract: number;
  // Valores em BRL usando taxa PTAX do BCB (mark-to-market)
  openingBalanceBRLPTAX: number;
  interestBRLPTAX: number;
  closingBalanceBRLPTAX: number;
  fxRatePTAX: number;
  fxSourcePTAX?: string;
  // Variação cambial (diferença entre PTAX e Contrato)
  fxVariationBRL: number;              // Variação sobre saldo de abertura
  fxVariationPercent: number;          // Variação % (PTAX vs Contrato)
  // Juros acumulados (somatória acumulada de juros)
  accruedInterestOrigin: number;       // Juros acumulados na moeda de origem
  accruedInterestBRLContract: number;  // Juros acumulados em BRL (taxa contrato)
  accruedInterestBRLPTAX: number;      // Juros acumulados em BRL (PTAX)
  
  // DEPRECATED (mantidos por compatibilidade)
  openingBalanceBRL: number;
  interestBRL: number;
  closingBalanceBRL: number;
  fxRate: number;
  fxSource?: string;
  ptaxDelta?: number;
  fxTranslationBRL?: number;
}

/**
 * Representa uma linha no cronograma de pagamentos (schedule).
 */
export interface ScheduleRow {
  installmentNumber: number;
  paymentDate: string;
  openingBalance: number;
  paymentAmount: number;
  interestComponent: number;
  principalComponent: number;
  closingBalance: number;
  effRate: number;
}

/**
 * Gera cronogramas de ACCRUAL e de pagamentos (PRICE/SAC/BULLET).
 */
export class LoanScheduler {
  private fxIntegration: LoanFXIntegration;
  private indexerService: LoanIndexerService;
  private paymentManager: LoanPaymentManager;

  constructor(fxIntegration: LoanFXIntegration, indexerService: LoanIndexerService, paymentManager: LoanPaymentManager) {
    this.fxIntegration = fxIntegration;
    this.indexerService = indexerService;
    this.paymentManager = paymentManager;
  }

  /**
   * Gera um cronograma de acúmulo de juros (ACCRUAL) para um contrato em um período.
   * @param contract O contrato de empréstimo.
   * @param startDate Data de início do período.
   * @param endDate Data de fim do período.
   * @param frequency Frequência de atualização ('Diário', 'Mensal', 'Anual').
   * @param showPTAXVariation Se true, calcula variação PTAX (Contrato - BCB).
   * @returns Uma matriz de linhas de ACCRUAL.
   */
  public async buildAccrualRows(
    contract: LoanContract,
    startDate: string,
    endDate: string,
    frequency: 'Diário' | 'Mensal' | 'Anual' = 'Diário',
    _showPTAXVariation: boolean = false
  ): Promise<AccrualRow[]> {
    logger.info(`[LoanScheduler] Gerando ACCRUAL para ${contract.id} de ${startDate} a ${endDate} (${frequency})`);

    const accrualRows: AccrualRow[] = [];
    const { interestConfig, currency } = contract;

    let currentDate = new Date(startDate + 'T00:00:00');
    const finalDate = new Date(endDate + 'T00:00:00');

    // CORREÇÃO: Usa saldo na data de início do ACCRUAL, não o saldo atual
    // Isso permite gerar ACCRUAL retroativo após registrar pagamentos
    const balanceAtStart = this.paymentManager.getBalanceAtDate(contract, startDate);

    let openingBalanceOrigin: number;
    let openingBalanceBRL: number;

    if (balanceAtStart) {
      openingBalanceOrigin = balanceAtStart.balanceOrigin;
      openingBalanceBRL = balanceAtStart.balanceBRL;
      logger.info(`[LoanScheduler] Usando saldo reconstruído na data ${startDate}: Origin=${openingBalanceOrigin}, BRL=${openingBalanceBRL}`);
    } else {
      // Fallback: usa saldo atual
      openingBalanceOrigin = contract.currentBalance.balanceOrigin;
      openingBalanceBRL = contract.currentBalance.balanceBRL;
      logger.warn(`[LoanScheduler] Usando saldo atual como fallback para ${startDate}`);
    }

    // Variáveis para acumular juros ao longo do período
    let accruedInterestOrigin = 0;
    let accruedInterestBRLContract = 0;
    let accruedInterestBRLPTAX = 0;

    while (currentDate <= finalDate) {
      const dateStr = currentDate.toISOString().split('T')[0];

      // Calcula próxima data baseado na frequência
      const nextDate = this.getNextAccrualDate(currentDate, frequency);
      const nextDateStr = nextDate.toISOString().split('T')[0];

      // Calcula dias no período
      const days = LoanCalculator.getDaysBetween(dateStr, nextDateStr, interestConfig.dayCountBasis);

      // Calcula taxa efetiva do período
      const effRate = await this.calculateEffectiveRate(contract, dateStr, nextDateStr, days);

      // Calcula juros na moeda de origem
      const interestOrigin = LoanCalculator.round(openingBalanceOrigin * effRate, 4);
      const closingBalanceOrigin = openingBalanceOrigin + interestOrigin;

      // ========================================================================
      // DUPLA CONVERSÃO: Taxa do Contrato (fixa) vs Taxa PTAX do BCB (diária)
      // ========================================================================

      // 1. Taxa FIXADA no CONTRATO (usa sempre a mesma taxa)
      const fxRateContract = contract.contractFXRate || 1;
      const openingBalanceBRLContract = LoanCalculator.round(openingBalanceOrigin * fxRateContract, 2);
      const interestBRLContract = LoanCalculator.round(interestOrigin * fxRateContract, 2);
      const closingBalanceBRLContract = LoanCalculator.round(closingBalanceOrigin * fxRateContract, 2);

      // 2. Taxa PTAX do BCB (busca taxa do dia específico - mark-to-market)
      let fxRatePTAX: number;
      let fxSourcePTAX: string;
      let openingBalanceBRLPTAX: number;
      let interestBRLPTAX: number;
      let closingBalanceBRLPTAX: number;
      let fxVariationBRL: number;
      let fxVariationPercent: number;

      if (currency === 'BRL') {
        // Se moeda é BRL, não há variação cambial
        fxRatePTAX = 1;
        fxSourcePTAX = 'BRL';
        openingBalanceBRLPTAX = openingBalanceBRLContract;
        interestBRLPTAX = interestBRLContract;
        closingBalanceBRLPTAX = closingBalanceBRLContract;
        fxVariationBRL = 0;
        fxVariationPercent = 0;
      } else {
        // Obtém taxa PTAX do BCB para o dia específico
        const ptaxInfo = await this.fxIntegration.getConversionRate(
          nextDateStr,
          currency
          // NÃO passa contractFXRate como fallback aqui - queremos PTAX puro
        );

        if (ptaxInfo && ptaxInfo.source.includes('PTAX')) {
          // PTAX encontrada - usa taxa do BCB
          fxRatePTAX = ptaxInfo.rate;
          fxSourcePTAX = ptaxInfo.source;
        } else {
          // PTAX não encontrada - fallback para taxa do contrato
          fxRatePTAX = fxRateContract;
          fxSourcePTAX = 'Contrato (PTAX indisponível)';
        }

        // Calcula valores em BRL usando PTAX
        openingBalanceBRLPTAX = LoanCalculator.round(openingBalanceOrigin * fxRatePTAX, 2);
        interestBRLPTAX = LoanCalculator.round(interestOrigin * fxRatePTAX, 2);
        closingBalanceBRLPTAX = LoanCalculator.round(closingBalanceOrigin * fxRatePTAX, 2);

        // Calcula variação cambial (diferença entre PTAX e Contrato)
        fxVariationBRL = LoanCalculator.round(
          openingBalanceBRLPTAX - openingBalanceBRLContract,
          2
        );
        fxVariationPercent = fxRateContract > 0
          ? LoanCalculator.round(((fxRatePTAX - fxRateContract) / fxRateContract) * 100, 4)
          : 0;
      }

      // Acumula juros
      accruedInterestOrigin += interestOrigin;
      accruedInterestBRLContract += interestBRLContract;
      accruedInterestBRLPTAX += interestBRLPTAX;

      const newRow: AccrualRow = {
        date: nextDateStr,
        days,
        effRate,
        openingBalanceOrigin,
        interestOrigin,
        closingBalanceOrigin,
        // Valores em BRL usando taxa do CONTRATO
        openingBalanceBRLContract,
        interestBRLContract,
        closingBalanceBRLContract,
        fxRateContract,
        // Valores em BRL usando taxa PTAX do BCB
        openingBalanceBRLPTAX,
        interestBRLPTAX,
        closingBalanceBRLPTAX,
        fxRatePTAX,
        fxSourcePTAX,
        // Variação cambial
        fxVariationBRL,
        fxVariationPercent,
        // Juros acumulados (somatória acumulada)
        accruedInterestOrigin: LoanCalculator.round(accruedInterestOrigin, 4),
        accruedInterestBRLContract: LoanCalculator.round(accruedInterestBRLContract, 2),
        accruedInterestBRLPTAX: LoanCalculator.round(accruedInterestBRLPTAX, 2),
        // Compatibilidade (usa valores PTAX como padrão)
        openingBalanceBRL: openingBalanceBRLPTAX,
        interestBRL: interestBRLPTAX,
        closingBalanceBRL: closingBalanceBRLPTAX,
        fxRate: fxRatePTAX,
        fxSource: fxSourcePTAX,
        ptaxDelta: LoanCalculator.round(fxRateContract - fxRatePTAX, 4),
        fxTranslationBRL: fxVariationBRL
      };

      accrualRows.push(newRow);

      // Atualiza para próximo período (usa valores PTAX para continuidade)
      openingBalanceOrigin = closingBalanceOrigin;
      openingBalanceBRL = closingBalanceBRLPTAX;
      currentDate = nextDate;
    }

    logger.info(`[LoanScheduler] ACCRUAL gerado com ${accrualRows.length} períodos`);
    return accrualRows;
  }

  /**
   * Gera um cronograma de pagamentos para contratos do tipo SCHEDULED (PRICE ou SAC).
   * @param contract O contrato de empréstimo.
   * @returns Uma matriz de linhas de cronograma de pagamento.
   */
  public async buildScheduleRows(contract: LoanContract): Promise<ScheduleRow[]> {
    if (contract.paymentFlow.type !== 'SCHEDULED' || !contract.paymentFlow.scheduled) {
      throw new Error('Contrato não é do tipo SCHEDULED');
    }

    const scheduleConfig = contract.paymentFlow.scheduled;
    logger.info(`[LoanScheduler] Gerando cronograma ${scheduleConfig.system} para ${contract.id}`);

    const scheduleRows: ScheduleRow[] = [];
    const { principalOrigin, interestConfig } = contract;
    const { installments, system, periodicity, gracePeriods = 0, graceType } = scheduleConfig;

    const firstPaymentDate = scheduleConfig.firstPaymentDate || this.addPeriod(contract.startDate, 1, periodicity);
    const baseDays = Math.max(
      1,
      LoanCalculator.getDaysBetween(contract.startDate, firstPaymentDate, interestConfig.dayCountBasis)
    );
    const periodicRate = await this.calculateEffectiveRate(
      contract,
      contract.startDate,
      firstPaymentDate,
      baseDays
    );

    let balance = principalOrigin;
    let totalInstallments = installments;

    // Adiciona períodos de carência se houver
    if (gracePeriods > 0) {
      if (graceType === 'INTEREST_ONLY') {
        // Carência com pagamento de juros
        for (let i = 1; i <= gracePeriods; i++) {
          const interest = LoanCalculator.round(balance * periodicRate, 2);
          scheduleRows.push({
            installmentNumber: i,
            paymentDate: this.addPeriod(contract.startDate, i, periodicity),
            openingBalance: balance,
            paymentAmount: interest,
            interestComponent: interest,
            principalComponent: 0,
            closingBalance: balance,
            effRate: periodicRate
          });
        }
      } else { // FULL
        // Carência total (capitaliza juros)
        for (let i = 1; i <= gracePeriods; i++) {
          const interest = LoanCalculator.round(balance * periodicRate, 2);
          balance += interest;
          scheduleRows.push({
            installmentNumber: i,
            paymentDate: this.addPeriod(contract.startDate, i, periodicity),
            openingBalance: balance - interest,
            paymentAmount: 0,
            interestComponent: interest,
            principalComponent: 0,
            closingBalance: balance,
            effRate: periodicRate
          });
        }
      }
    }

    // Gera cronograma baseado no sistema
    if (system === 'PRICE') {
      balance = this.generatePRICE(scheduleRows, balance, periodicRate, totalInstallments, periodicity, contract.startDate, gracePeriods);
    } else if (system === 'SAC') {
      balance = this.generateSAC(scheduleRows, balance, periodicRate, totalInstallments, periodicity, contract.startDate, gracePeriods);
    }

    logger.info(`[LoanScheduler] Cronograma gerado com ${scheduleRows.length} parcelas`);
    return scheduleRows;
  }

  /**
   * Gera cronograma PRICE (parcela fixa).
   */
  private generatePRICE(
    scheduleRows: ScheduleRow[],
    balance: number,
    periodicRate: number,
    installments: number,
    periodicity: 'MENSAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL',
    startDate: string,
    graceOffset: number
  ): number {
    const pmt = LoanCalculator.calculatePMT(balance, periodicRate, installments);

    for (let i = 1; i <= installments; i++) {
      const interest = LoanCalculator.round(balance * periodicRate, 2);
      const principal = LoanCalculator.round(pmt - interest, 2);
      const closingBalance = LoanCalculator.round(balance - principal, 2);

      scheduleRows.push({
        installmentNumber: graceOffset + i,
        paymentDate: this.addPeriod(startDate, graceOffset + i, periodicity),
        openingBalance: balance,
        paymentAmount: pmt,
        interestComponent: interest,
        principalComponent: principal,
        closingBalance: Math.max(0, closingBalance), // Evita saldo negativo
        effRate: periodicRate
      });

      balance = closingBalance;
    }

    return balance;
  }

  /**
   * Gera cronograma SAC (amortização constante).
   */
  private generateSAC(
    scheduleRows: ScheduleRow[],
    balance: number,
    periodicRate: number,
    installments: number,
    periodicity: 'MENSAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL',
    startDate: string,
    graceOffset: number
  ): number {
    const principalInstallment = LoanCalculator.round(balance / installments, 2);

    for (let i = 1; i <= installments; i++) {
      const interest = LoanCalculator.round(balance * periodicRate, 2);
      const pmt = principalInstallment + interest;
      const closingBalance = LoanCalculator.round(balance - principalInstallment, 2);

      scheduleRows.push({
        installmentNumber: graceOffset + i,
        paymentDate: this.addPeriod(startDate, graceOffset + i, periodicity),
        openingBalance: balance,
        paymentAmount: pmt,
        interestComponent: interest,
        principalComponent: principalInstallment,
        closingBalance: Math.max(0, closingBalance),
        effRate: periodicRate
      });

      balance = closingBalance;
    }

    return balance;
  }

  /**
   * Calcula a taxa efetiva do período considerando todas as pernas de juros.
   */
  private async calculateEffectiveRate(
    contract: LoanContract,
    _startDate: string,
    _endDate: string,
    days: number
  ): Promise<number> {
    const { interestConfig } = contract;
    if (!interestConfig.legs.length) {
      return 0;
    }

    let accumulatedFactor = 1;
    for (const leg of interestConfig.legs) {
      const legEffective = await this.indexerService.calculateLegEffectiveRate(
        contract,
        leg,
        _startDate,
        _endDate,
        days,
        interestConfig.dayCountBasis,
        interestConfig.compounding
      );

      accumulatedFactor *= (1 + legEffective);
    }

    return accumulatedFactor - 1;
  }

  /**
   * Calcula próxima data de accrual baseado na frequência.
   */
  private getNextAccrualDate(currentDate: Date, frequency: 'Diário' | 'Mensal' | 'Anual'): Date {
    const nextDate = new Date(currentDate);

    switch (frequency) {
      case 'Diário':
        nextDate.setUTCDate(nextDate.getUTCDate() + 1);
        break;
      case 'Mensal':
        nextDate.setUTCMonth(nextDate.getUTCMonth() + 1);
        break;
      case 'Anual':
        nextDate.setUTCFullYear(nextDate.getUTCFullYear() + 1);
        break;
    }

    return nextDate;
  }

  /**
   * Adiciona um número de períodos a uma data.
   */
  private addPeriod(
    startDate: string,
    count: number,
    periodicity: 'MENSAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL'
  ): string {
    const date = new Date(startDate + 'T00:00:00');

    switch (periodicity) {
      case 'MENSAL':
        date.setUTCMonth(date.getUTCMonth() + count);
        break;
      case 'TRIMESTRAL':
        date.setUTCMonth(date.getUTCMonth() + count * 3);
        break;
      case 'SEMESTRAL':
        date.setUTCMonth(date.getUTCMonth() + count * 6);
        break;
      case 'ANUAL':
        date.setUTCFullYear(date.getUTCFullYear() + count);
        break;
    }

    return date.toISOString().split('T')[0];
  }

  /**
   * Calcula a data de um installment específico.
   */
  public calculateInstallmentDate(
    startDate: string,
    installmentNumber: number,
    periodicity: 'MENSAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL'
  ): string {
    return this.addPeriod(startDate, installmentNumber, periodicity);
  }
}
