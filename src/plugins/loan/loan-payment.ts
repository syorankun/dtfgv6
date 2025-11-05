
// Arquivo: src/plugins/loan/loan-payment.ts

import { LoanContract, CurrencyCode } from './loan-types';
import { LoanFXIntegration } from './loan-fx-integration';

// Mock de dependências
const fxIntegration = new LoanFXIntegration();
const ui = {
  showToast: (message: string, status: 'success' | 'error') => console.log(`Toast: ${message} (${status})`),
};

/**
 * Representa uma transação no ledger do contrato.
 */
export interface LedgerEntry {
  date: string;
  type: 'CRIAÇÃO' | 'PAGAMENTO' | 'JUROS' | 'AMORTIZAÇÃO';
  amountOrigin: number;
  amountBRL: number;
  fxRate: number;
  notes?: string;
}

/**
 * Gerencia o registro de pagamentos e a atualização dos saldos do contrato.
 */
export class LoanPayment {
  private contract: LoanContract;
  private ledger: LedgerEntry[] = [];

  constructor(contract: LoanContract) {
    this.contract = contract;
    // Inicializa o ledger com a criação do contrato
    this.ledger.push({
      date: contract.startDate,
      type: 'CRIAÇÃO',
      amountOrigin: contract.principalOrigin,
      amountBRL: contract.principalBRL,
      fxRate: contract.contractFXRate || (contract.principalBRL / contract.principalOrigin),
      notes: 'Criação do Contrato'
    });
  }

  /**
   * Registra um novo pagamento para o contrato.
   * @param paymentDate Data do pagamento ('YYYY-MM-DD').
   * @param amount O valor pago.
   * @param currency A moeda do pagamento.
   * @param allocation A forma de alocação do pagamento (juros/principal).
   */
  public async registerPayment(
    paymentDate: string,
    amount: number,
    currency: CurrencyCode,
    allocation: 'AUTO' | 'INTEREST_ONLY' | 'PRINCIPAL_ONLY' = 'AUTO'
  ): Promise<void> {
    console.log(`[LoanPayment] Registrando pagamento de ${amount} ${currency} em ${paymentDate}`);

    // 1. Converter o valor do pagamento para a moeda do contrato e para BRL
    let paymentAmountBRL = amount;
    if (currency !== 'BRL') {
      const rateInfo = await fxIntegration.getConversionRate(paymentDate, currency);
      if (!rateInfo) throw new Error(`Taxa de câmbio para ${currency} não encontrada.`);
      paymentAmountBRL = amount * rateInfo.rate;
    }

    // 2. Calcular juros acumulados desde a última atualização até a data do pagamento
    // (Esta parte requer o motor de cálculo de juros)
    const accruedInterestBRL = this.calculateAccruedInterest(paymentDate);

    // 3. Alocar o pagamento
    let interestPaidBRL = 0;
    let principalPaidBRL = 0;

    if (allocation === 'AUTO') {
      interestPaidBRL = Math.min(paymentAmountBRL, accruedInterestBRL);
      principalPaidBRL = paymentAmountBRL - interestPaidBRL;
    } else if (allocation === 'INTEREST_ONLY') {
      interestPaidBRL = Math.min(paymentAmountBRL, accruedInterestBRL);
    } else { // PRINCIPAL_ONLY
      principalPaidBRL = paymentAmountBRL;
    }

    // 4. Atualizar o saldo do contrato
    this.contract.currentBalance.accruedInterestBRL -= interestPaidBRL;
    this.contract.currentBalance.balanceBRL -= principalPaidBRL;

    // Atualizar saldo na moeda de origem (requer taxa de câmbio do dia)
    const contractCurrencyRate = await fxIntegration.getConversionRate(paymentDate, this.contract.currency);
    if (contractCurrencyRate) {
        this.contract.currentBalance.balanceOrigin = this.contract.currentBalance.balanceBRL / contractCurrencyRate.rate;
    }
    
    this.contract.currentBalance.lastUpdateDate = paymentDate;
    this.contract.updatedAt = new Date().toISOString();

    // 5. Adicionar entradas ao ledger
    this.ledger.push({
      date: paymentDate,
      type: 'PAGAMENTO',
      amountBRL: -paymentAmountBRL,
      amountOrigin: -paymentAmountBRL / (contractCurrencyRate?.rate || 1),
      fxRate: contractCurrencyRate?.rate || 1,
      notes: `Pagamento em ${currency}`
    });

    ui.showToast('Pagamento registrado com sucesso!', 'success');
    console.log('[LoanPayment] Saldo atualizado:', this.contract.currentBalance);
  }

  /**
   * Simula o cálculo de juros acumulados.
   * Em uma implementação real, usaria o LoanCalculator e as taxas do contrato.
   * @param paymentDate A data do pagamento.
   * @returns O valor dos juros acumulados em BRL.
   */
  private calculateAccruedInterest(_paymentDate: string): number {
    // Lógica de cálculo de juros...
    // Por exemplo, usando LoanCalculator.getDaysBetween() e as taxas do contrato.
    return 5000.00; // Valor simulado
  }

  /**
   * Retorna o histórico de transações do contrato.
   */
  public getLedger(): LedgerEntry[] {
    return this.ledger;
  }
}
