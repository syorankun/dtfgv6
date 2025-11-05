/**
 * Loan Payment Manager - Gerenciamento de pagamentos e amortização
 *
 * Responsável por registrar pagamentos, calcular amortização e atualizar saldos.
 */

import type { LoanContract, BalanceSnapshot } from './loan-types';
import { LoanCalculator } from './loan-calculator';
import { LoanFXIntegration, type FXRateResult } from './loan-fx-integration';
import { logger } from '@core/storage-utils-consolidated';

/**
 * Representa um pagamento registrado em um contrato.
 */
export interface LoanPayment {
  id: string;
  contractId: string;
  paymentDate: string;
  amountOrigin: number;
  amountBRL: number;
  currency: string;
  fxRate: number;
  fxSource: string;
  description?: string;
  createdAt: string;
}

export type LoanLedgerEntryType = 'CONTRATO' | 'PAGAMENTO' | 'AJUSTE' | 'ACCRUAL';

export interface LoanLedgerEntry {
  id: string;
  contractId: string;
  entryDate: string;
  type: LoanLedgerEntryType;
  amountOrigin: number;
  amountBRL: number;
  fxRate: number;
  fxSource: string;
  balanceAfterOrigin: number;
  balanceAfterBRL: number;
  description?: string;
  createdAt: string;
}

/**
 * Gerencia pagamentos e amortização de contratos de empréstimo.
 */
export class LoanPaymentManager {
  private fxIntegration: LoanFXIntegration;
  private payments: Map<string, LoanPayment[]> = new Map();
  private ledgers: Map<string, LoanLedgerEntry[]> = new Map();

  constructor(fxIntegration: LoanFXIntegration) {
    this.fxIntegration = fxIntegration;
  }

  /**
   * Registra um novo pagamento em um contrato.
   */
  public async registerPayment(
    contract: LoanContract,
    amount: number,
    paymentDate: string,
    currency?: string,
    description?: string
  ): Promise<LoanPayment> {
    const paymentCurrency = (currency || 'BRL').toUpperCase();
    const paymentId = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    let amountOrigin = 0;
    let amountBRL = 0;
    let effectiveRate = 1;
    let fxSource = 'N/A';

    if (paymentCurrency === contract.currency) {
      const rateInfo = await this.requireRate(paymentDate, paymentCurrency, contract.contractFXRate);
      amountOrigin = amount;
      amountBRL = amount * rateInfo.rate;
      effectiveRate = rateInfo.rate;
      fxSource = rateInfo.source;
    } else if (paymentCurrency === 'BRL') {
      amountBRL = amount;
      if (contract.currency === 'BRL') {
        amountOrigin = amount;
        effectiveRate = 1;
        fxSource = 'BRL';
      } else {
        const rateInfo = await this.requireRate(paymentDate, contract.currency, contract.contractFXRate);
        amountOrigin = amount / rateInfo.rate; // BRL -> origem
        effectiveRate = rateInfo.rate;
        fxSource = rateInfo.source;
      }
    } else {
      const paymentRate = await this.requireRate(paymentDate, paymentCurrency);
      const contractRate = await this.requireRate(paymentDate, contract.currency, contract.contractFXRate);
      amountBRL = amount * paymentRate.rate;
      amountOrigin = amountBRL / contractRate.rate;
      effectiveRate = contractRate.rate;
      fxSource = `${contractRate.source} · via ${paymentCurrency}`;
    }

    const payment: LoanPayment = {
      id: paymentId,
      contractId: contract.id,
      paymentDate,
      amountOrigin: LoanCalculator.round(amountOrigin, 2),
      amountBRL: LoanCalculator.round(amountBRL, 2),
      currency: paymentCurrency,
      fxRate: LoanCalculator.round(effectiveRate, 6),
      fxSource,
      description,
      createdAt: new Date().toISOString()
    };

    // Armazena o pagamento
    const contractPayments = this.payments.get(contract.id) || [];
    contractPayments.push(payment);
    this.payments.set(contract.id, contractPayments);

    logger.info(`[LoanPaymentManager] Pagamento ${paymentId} registrado: ${amountBRL} BRL`);

    return payment;
  }

  /**
   * Registra entrada inicial do contrato no ledger.
   */
  public registerInitialEntry(
    contract: LoanContract,
    fxRate: number,
    fxSource: string
  ): LoanLedgerEntry {
    const entry: LoanLedgerEntry = {
      id: `LED-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      contractId: contract.id,
      entryDate: contract.startDate,
      type: 'CONTRATO',
      amountOrigin: contract.principalOrigin,
      amountBRL: contract.principalBRL,
      fxRate,
      fxSource,
      balanceAfterOrigin: contract.principalOrigin,
      balanceAfterBRL: contract.principalBRL,
      description: 'Criação do contrato',
      createdAt: new Date().toISOString()
    };

    this.addLedgerEntry(contract.id, entry);
    return entry;
  }

  /**
   * Calcula amortização do saldo após um pagamento.
   * Retorna novo snapshot do saldo.
   */
  public async calculateAmortization(
    contract: LoanContract,
    payment: LoanPayment,
    currentDate: string
  ): Promise<BalanceSnapshot> {
    const currentBalance = contract.currentBalance;

    // Amortização é sempre aplicada primeiro aos juros, depois ao principal
    let remainingPayment = payment.amountBRL;
    let newAccruedInterestBRL = currentBalance.accruedInterestBRL;
    let newBalanceBRL = currentBalance.balanceBRL;

    // 1. Abate juros acumulados primeiro
    if (remainingPayment >= newAccruedInterestBRL) {
      remainingPayment -= newAccruedInterestBRL;
      newAccruedInterestBRL = 0;
    } else {
      newAccruedInterestBRL -= remainingPayment;
      remainingPayment = 0;
    }

    // 2. Abate saldo principal com o restante
    if (remainingPayment > 0) {
      newBalanceBRL = Math.max(0, newBalanceBRL - remainingPayment);
    }

    // Calcula valores na moeda de origem
    const fxRateInfo = await this.resolveFxRate(contract, currentDate);

    let newBalanceOrigin: number;
    let newAccruedInterestOrigin: number;

    if (fxRateInfo && fxRateInfo.rate > 0) {
      newBalanceOrigin = newBalanceBRL / fxRateInfo.rate;
      newAccruedInterestOrigin = newAccruedInterestBRL / fxRateInfo.rate;
    } else {
      logger.warn('[LoanPaymentManager] Convertendo saldo com fallback proporcional', { contractId: contract.id, date: currentDate });
      // Fallback: usa proporção do saldo original
      const proportion = contract.principalBRL > 0 ? newBalanceBRL / contract.principalBRL : 0;
      newBalanceOrigin = LoanCalculator.round(contract.principalOrigin * proportion, 2);
      const accruedBase = currentBalance.accruedInterestBRL;
      const interestProportion = accruedBase && accruedBase !== 0 ? newAccruedInterestBRL / accruedBase : 0;
      newAccruedInterestOrigin = LoanCalculator.round(
        accruedBase && accruedBase !== 0 ? currentBalance.accruedInterestOrigin * interestProportion : 0,
        2
      );
    }

    return {
      balanceBRL: LoanCalculator.round(newBalanceBRL, 2),
      balanceOrigin: LoanCalculator.round(newBalanceOrigin, 2),
      accruedInterestBRL: LoanCalculator.round(newAccruedInterestBRL, 2),
      accruedInterestOrigin: LoanCalculator.round(newAccruedInterestOrigin, 2),
      lastUpdateDate: currentDate
    };
  }

  /**
   * Aplica um pagamento ao contrato, atualizando o saldo.
   */
  public async applyPayment(
    contract: LoanContract,
    amount: number,
    paymentDate: string,
    currency?: string,
    description?: string
  ): Promise<{ payment: LoanPayment; newBalance: BalanceSnapshot; ledgerEntry: LoanLedgerEntry }> {
    // Registra o pagamento
    const payment = await this.registerPayment(contract, amount, paymentDate, currency, description);

    // Calcula nova amortização
    const newBalance = await this.calculateAmortization(contract, payment, paymentDate);

    const ledgerEntry = this.recordPaymentLedger(contract, payment, newBalance);

    return { payment, newBalance, ledgerEntry };
  }

  /**
   * Obtém histórico de pagamentos de um contrato.
   */
  public getPaymentHistory(contractId: string): LoanPayment[] {
    return this.payments.get(contractId) || [];
  }

  /**
   * Calcula total de pagamentos realizados em um contrato.
   */
  public getTotalPayments(contractId: string): { totalBRL: number; totalOrigin: number; count: number } {
    const payments = this.getPaymentHistory(contractId);

    const totalBRL = payments.reduce((sum, p) => sum + p.amountBRL, 0);
    const totalOrigin = payments.reduce((sum, p) => sum + p.amountOrigin, 0);

    return {
      totalBRL: LoanCalculator.round(totalBRL, 2),
      totalOrigin: LoanCalculator.round(totalOrigin, 2),
      count: payments.length
    };
  }

  /**
   * Carrega pagamentos persistidos.
   */
  public loadPayments(data: Record<string, LoanPayment[]>): void {
    this.payments.clear();
    Object.entries(data).forEach(([contractId, payments]) => {
      this.payments.set(contractId, payments);
    });
    logger.info(`[LoanPaymentManager] ${this.payments.size} contratos com histórico carregados`);
  }

  /**
   * Salva pagamentos para persistência.
   */
  public savePayments(): Record<string, LoanPayment[]> {
    const data: Record<string, LoanPayment[]> = {};
    this.payments.forEach((payments, contractId) => {
      data[contractId] = payments;
    });
    return data;
  }

  public getLedger(contractId: string): LoanLedgerEntry[] {
    return this.ledgers.get(contractId) || [];
  }

  public loadLedger(data: Record<string, LoanLedgerEntry[]>): void {
    this.ledgers.clear();
    Object.entries(data).forEach(([contractId, entries]) => {
      this.ledgers.set(contractId, entries);
    });
    logger.info(`[LoanPaymentManager] Ledger carregado para ${this.ledgers.size} contratos`);
  }

  public saveLedger(): Record<string, LoanLedgerEntry[]> {
    const data: Record<string, LoanLedgerEntry[]> = {};
    this.ledgers.forEach((entries, contractId) => {
      data[contractId] = entries;
    });
    return data;
  }

  private async requireRate(date: string, currency: string, contractFallback?: number): Promise<FXRateResult> {
    const direct = await this.fxIntegration.getConversionRate(date, currency, contractFallback);
    if (direct) {
      return direct;
    }

    const last = await this.fxIntegration.getLastAvailableRate(currency);
    if (last) {
      logger.warn('[LoanPaymentManager] Usando taxa FX mais recente disponível como fallback', { currency, date });
      return {
        rate: last.rate,
        source: `${last.source} (última disponível)`
      };
    }

    if (currency === 'BRL') {
      return { rate: 1, source: 'BRL' };
    }

    if (contractFallback) {
      logger.warn('[LoanPaymentManager] Usando taxa de contrato como fallback para FX', { currency, date });
      return { rate: contractFallback, source: 'Contrato' };
    }

    throw new Error(`Taxa de câmbio não disponível para ${currency} em ${date}`);
  }

  private async resolveFxRate(contract: LoanContract, date: string): Promise<FXRateResult | null> {
    try {
      return await this.requireRate(date, contract.currency, contract.contractFXRate);
    } catch (error) {
      logger.warn('[LoanPaymentManager] Não foi possível obter taxa FX para saldo', { contractId: contract.id, date, error });
      return null;
    }
  }

  private recordPaymentLedger(
    contract: LoanContract,
    payment: LoanPayment,
    balance: BalanceSnapshot
  ): LoanLedgerEntry {
    const entry: LoanLedgerEntry = {
      id: `LED-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      contractId: contract.id,
      entryDate: payment.paymentDate,
      type: 'PAGAMENTO',
      amountOrigin: LoanCalculator.round(-payment.amountOrigin, 2),
      amountBRL: LoanCalculator.round(-payment.amountBRL, 2),
      fxRate: payment.fxRate,
      fxSource: payment.fxSource,
      balanceAfterOrigin: balance.balanceOrigin,
      balanceAfterBRL: balance.balanceBRL,
      description: payment.description || 'Pagamento registrado',
      createdAt: new Date().toISOString()
    };

    this.addLedgerEntry(contract.id, entry);
    return entry;
  }

  private addLedgerEntry(contractId: string, entry: LoanLedgerEntry): void {
    const entries = this.ledgers.get(contractId) || [];
    entries.push(entry);
    this.ledgers.set(contractId, entries);
  }

  /**
   * Calcula o saldo do contrato em uma data específica baseado no histórico do ledger.
   * Útil para gerar ACCRUAL retroativo após registrar pagamentos.
   *
   * @param contract O contrato
   * @param targetDate Data alvo (YYYY-MM-DD)
   * @returns Saldo na moeda de origem e em BRL, ou null se não houver ledger suficiente
   */
  public getBalanceAtDate(
    contract: LoanContract,
    targetDate: string
  ): { balanceOrigin: number; balanceBRL: number } | null {
    const ledger = this.getLedger(contract.id);

    if (ledger.length === 0) {
      // Sem ledger, retorna o saldo atual
      logger.debug('[LoanPaymentManager] Sem ledger, usando saldo atual', { contractId: contract.id });
      return {
        balanceOrigin: contract.currentBalance.balanceOrigin,
        balanceBRL: contract.currentBalance.balanceBRL
      };
    }

    // Ordena ledger por data
    const sortedLedger = [...ledger].sort((a, b) =>
      a.entryDate.localeCompare(b.entryDate)
    );

    // Encontra a última entrada ANTES ou NA data alvo
    let lastEntryBeforeDate: LoanLedgerEntry | null = null;

    for (const entry of sortedLedger) {
      if (entry.entryDate <= targetDate) {
        lastEntryBeforeDate = entry;
      } else {
        break; // Passou da data alvo
      }
    }

    if (!lastEntryBeforeDate) {
      // Nenhuma entrada antes da data alvo, use o principal inicial
      logger.debug('[LoanPaymentManager] Nenhuma entrada antes da data, usando principal inicial', {
        contractId: contract.id,
        targetDate
      });
      return {
        balanceOrigin: contract.principalOrigin,
        balanceBRL: contract.principalBRL
      };
    }

    logger.debug('[LoanPaymentManager] Saldo reconstruído na data', {
      contractId: contract.id,
      targetDate,
      balanceOrigin: lastEntryBeforeDate.balanceAfterOrigin,
      balanceBRL: lastEntryBeforeDate.balanceAfterBRL,
      lastEntry: lastEntryBeforeDate.entryDate
    });

    return {
      balanceOrigin: lastEntryBeforeDate.balanceAfterOrigin,
      balanceBRL: lastEntryBeforeDate.balanceAfterBRL
    };
  }
}