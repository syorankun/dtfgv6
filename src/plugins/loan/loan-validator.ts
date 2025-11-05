/**
 * Loan Validation - Validações para contratos de empréstimo
 *
 * Fornece validações robustas para dados de entrada e estado dos contratos.
 */

import type { LoanContractInput, LoanContract, InterestLeg, PaymentFlowConfig } from './loan-types';

/**
 * Classe utilitária para validações de contratos de empréstimo.
 */
export class LoanValidator {

  /**
   * Valida dados de entrada para criação de contrato.
   */
  public static validateContractInput(data: LoanContractInput): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validações básicas
    if (!data.id && !data.id?.trim()) {
      errors.push('ID do contrato é obrigatório');
    }

    if (!data.counterparty?.trim()) {
      errors.push('Contraparte é obrigatória');
    }

    if (!['CAPTADO', 'CEDIDO'].includes(data.contractType)) {
      errors.push('Tipo de contrato deve ser CAPTADO ou CEDIDO');
    }

    if (!data.currency?.trim()) {
      errors.push('Moeda é obrigatória');
    }

    if (data.principalOrigin <= 0) {
      errors.push('Valor principal deve ser maior que zero');
    }

    // Validações de data
    const startDate = new Date(data.startDate);
    const maturityDate = new Date(data.maturityDate);

    if (isNaN(startDate.getTime())) {
      errors.push('Data de início inválida');
    }

    if (isNaN(maturityDate.getTime())) {
      errors.push('Data de vencimento inválida');
    }

    if (startDate >= maturityDate) {
      errors.push('Data de vencimento deve ser posterior à data de início');
    }

    // Validações de juros
    const interestErrors = this.validateInterestConfig(data.interestConfig);
    errors.push(...interestErrors);

    // Validações de fluxo de pagamento
    const paymentErrors = this.validatePaymentFlow(data.paymentFlow);
    errors.push(...paymentErrors);

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Valida configuração de juros.
   */
  private static validateInterestConfig(config: LoanContractInput['interestConfig']): string[] {
    const errors: string[] = [];

    if (!config.legs || config.legs.length === 0) {
      errors.push('Pelo menos uma perna de juros deve ser configurada');
      return errors;
    }

    // Valida cada perna
    config.legs.forEach((leg, index) => {
      const legErrors = this.validateInterestLeg(leg, index);
      errors.push(...legErrors);
    });

    // Verifica se há pelo menos uma perna RATE
    const hasRateLeg = config.legs.some(leg => leg.role === 'RATE');
    if (!hasRateLeg) {
      errors.push('Pelo menos uma perna deve ter role RATE');
    }

    return errors;
  }

  /**
   * Valida uma perna de juros individual.
   */
  private static validateInterestLeg(leg: InterestLeg, index: number): string[] {
    const errors: string[] = [];
    const prefix = `Perna ${index + 1}: `;

    if (!['FIXED', 'CDI', 'PTAX', 'MANUAL'].includes(leg.indexer)) {
      errors.push(`${prefix}Indexador inválido`);
    }

    if (leg.indexerPercent <= 0) {
      errors.push(`${prefix}Percentual do indexador deve ser maior que zero`);
    }

    if (leg.spreadAnnual < 0) {
      errors.push(`${prefix}Spread anual não pode ser negativo`);
    }

    if (leg.baseRateAnnual != null && leg.baseRateAnnual < 0) {
      errors.push(`${prefix}Taxa base anual do indexador não pode ser negativa`);
    }

    if (!['30/360', 'ACT/365', 'ACT/360', 'BUS/252'].includes(leg.dayCountBasis || '30/360')) {
      errors.push(`${prefix}Convenção de contagem de dias inválida`);
    }

    if (leg.indexer === 'PTAX' && !leg.ptaxCurrency) {
      errors.push(`${prefix}Moeda PTAX é obrigatória para indexador PTAX`);
    }

    if (!['RATE', 'ADJUSTMENT'].includes(leg.role || 'RATE')) {
      errors.push(`${prefix}Role deve ser RATE ou ADJUSTMENT`);
    }

    return errors;
  }

  /**
   * Valida configuração de fluxo de pagamentos.
   */
  private static validatePaymentFlow(flow: PaymentFlowConfig): string[] {
    const errors: string[] = [];

    if (!['SCHEDULED', 'FLEXIBLE', 'BULLET', 'ACCRUAL_ONLY'].includes(flow.type)) {
      errors.push('Tipo de fluxo de pagamento inválido');
    }

    if (flow.type === 'SCHEDULED') {
      if (!flow.scheduled) {
        errors.push('Configuração scheduled é obrigatória para tipo SCHEDULED');
        return errors;
      }

      const scheduled = flow.scheduled;

      if (!['PRICE', 'SAC'].includes(scheduled.system)) {
        errors.push('Sistema deve ser PRICE ou SAC');
      }

      if (scheduled.installments <= 0) {
        errors.push('Número de parcelas deve ser maior que zero');
      }

      if (!['MENSAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL'].includes(scheduled.periodicity)) {
        errors.push('Periodicidade inválida');
      }

      const firstPaymentDate = new Date(scheduled.firstPaymentDate);
      if (isNaN(firstPaymentDate.getTime())) {
        errors.push('Data da primeira parcela inválida');
      }

      if (scheduled.gracePeriods && scheduled.gracePeriods < 0) {
        errors.push('Períodos de carência não podem ser negativos');
      }

      if (scheduled.graceType && !['INTEREST_ONLY', 'FULL'].includes(scheduled.graceType)) {
        errors.push('Tipo de carência inválido');
      }
    }

    return errors;
  }

  /**
   * Valida se um contrato pode receber pagamentos.
   */
  public static validatePaymentEligibility(contract: LoanContract): { canPay: boolean; reason?: string } {
    if (contract.status === 'QUITADO') {
      return { canPay: false, reason: 'Contrato já quitado' };
    }

    if (contract.status === 'VENCIDO') {
      return { canPay: false, reason: 'Contrato vencido - renegociar primeiro' };
    }

    if (contract.currentBalance.balanceOrigin <= 0) {
      return { canPay: false, reason: 'Saldo já zerado' };
    }

    return { canPay: true };
  }

  /**
   * Valida dados de um pagamento.
   */
  public static validatePayment(
    contract: LoanContract,
    amount: number,
    paymentDate: string,
    currency?: string
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    const eligibility = this.validatePaymentEligibility(contract);
    if (!eligibility.canPay) {
      errors.push(eligibility.reason!);
    }

    if (amount <= 0) {
      errors.push('Valor do pagamento deve ser maior que zero');
    }

    const payDate = new Date(paymentDate);
    if (isNaN(payDate.getTime())) {
      errors.push('Data do pagamento inválida');
    }

    const startDate = new Date(contract.startDate);
    if (payDate < startDate) {
      errors.push('Data do pagamento não pode ser anterior à data de início do contrato');
    }

    // Valida moeda
    const paymentCurrency = currency || contract.currency;
    if (paymentCurrency !== contract.currency && paymentCurrency !== 'BRL') {
      errors.push('Moeda do pagamento deve ser a mesma do contrato ou BRL');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Valida se um contrato está em estado consistente.
   */
  public static validateContractState(contract: LoanContract): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Verifica se saldos são consistentes
    if (contract.currentBalance.balanceOrigin < 0) {
      errors.push('Saldo na moeda de origem não pode ser negativo');
    }

    if (contract.currentBalance.balanceBRL < 0) {
      errors.push('Saldo em BRL não pode ser negativo');
    }

    // Verifica se juros acumulados fazem sentido
    if (contract.currentBalance.accruedInterestOrigin < 0) {
      errors.push('Juros acumulados na moeda de origem não podem ser negativos');
    }

    if (contract.currentBalance.accruedInterestBRL < 0) {
      errors.push('Juros acumulados em BRL não podem ser negativos');
    }

    // Verifica datas
    const startDate = new Date(contract.startDate);
    const lastUpdate = new Date(contract.currentBalance.lastUpdateDate);

    if (lastUpdate < startDate) {
      errors.push('Última atualização não pode ser anterior à data de início');
    }

    if (lastUpdate > new Date()) {
      errors.push('Última atualização não pode ser no futuro');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}