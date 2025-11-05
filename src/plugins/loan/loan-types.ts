
// Arquivo: src/plugins/loan/loan-types.ts

/**
 * Códigos de moeda suportados (ISO 4217).
 * Exemplo: 'BRL', 'USD', 'EUR'.
 */
export type CurrencyCode = 'BRL' | 'USD' | 'EUR' | 'GBP' | 'JPY' | string;

/**
 * Define a configuração de uma perna de juros.
 * Um contrato pode ter múltiplas pernas (ex: CDI + Variação Cambial).
 */
export interface InterestLeg {
  indexer: 'FIXED' | 'CDI' | 'PTAX' | 'MANUAL'; // Indexador base
  indexerPercent: number;                       // Percentual do indexador (ex: 110 para 110%)
  spreadAnnual: number;                         // Spread em % ao ano (ex: 3.5 para 3.5%)
  baseRateAnnual?: number;                      // Taxa anual do indexador (ex: CDI 13.65)
  dayCountBasis?: '30/360' | 'ACT/365' | 'ACT/360' | 'BUS/252'; // Convenção de contagem de dias
  ptaxCurrency?: CurrencyCode;                  // Moeda para PTAX
  ptaxSource?: 'AUTO' | 'PTAX_BCB' | 'MANUAL';  // Fonte da PTAX
  role?: 'RATE' | 'ADJUSTMENT';                 // Papel da perna (taxa principal ou ajuste)
}

/**
 * Configuração completa de juros para um contrato.
 */
export interface InterestConfig {
  template?: 'CDI_PLUS' | 'PTAX_PLUS' | 'FIXED' | 'CUSTOM' | 'CDI_PTAX'; // Template para simplificar
  legs: InterestLeg[];                          // Array de pernas de juros
  dayCountBasis: '30/360' | 'ACT/365' | 'ACT/360' | 'BUS/252'; // Convenção padrão
  compounding: 'EXPONENCIAL' | 'LINEAR';        // Capitalização
  rounding: 'HALF_UP' | 'HALF_EVEN';            // Arredondamento
}

/**
 * Configuração do fluxo de pagamentos.
 */
export interface PaymentFlowConfig {
  type: 'SCHEDULED' | 'FLEXIBLE' | 'BULLET' | 'ACCRUAL_ONLY'; // Tipo de fluxo

  // Para 'SCHEDULED'
  scheduled?: {
    system: 'PRICE' | 'SAC';                      // Tabela PRICE ou SAC
    periodicity: 'MENSAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL';
    installments: number;                         // Número de parcelas
    firstPaymentDate: string;                     // Data da 1ª parcela (YYYY-MM-DD)
    gracePeriods?: number;                        // Períodos de carência
    graceType?: 'INTEREST_ONLY' | 'FULL';         // Tipo de carência
  };

  // Para 'FLEXIBLE'
  flexible?: {
    allowEarlyPayment: boolean;                   // Permite antecipação
    penaltyRate?: number;                         // Multa por antecipação (%)
  };
}

/**
 * Snapshot do saldo do contrato em um determinado momento.
 */
export interface BalanceSnapshot {
  balanceBRL: number;                           // Saldo devedor em BRL
  balanceOrigin: number;                        // Saldo na moeda de origem
  accruedInterestBRL: number;                   // Juros acumulados em BRL
  accruedInterestOrigin: number;                // Juros acumulados na moeda de origem
  lastUpdateDate: string;                       // Data da última atualização (YYYY-MM-DD)
  nextPaymentDate?: string;                     // Próximo vencimento (YYYY-MM-DD)
  nextPaymentAmount?: number;                   // Valor da próxima parcela
}

/**
 * Interface principal que define um contrato de empréstimo.
 */
export interface LoanContract {
  // Identificação
  id: string;                                   // ID único (ex: "LOAN-20251104-001")
  contractType: 'CAPTADO' | 'CEDIDO';           // Perspectiva da empresa
  counterparty: string;                         // Contraparte (ex: "Banco XYZ")
  status: 'ATIVO' | 'QUITADO' | 'VENCIDO' | 'RENEGOCIADO';

  // Principal
  currency: CurrencyCode;                       // Moeda de origem do principal
  principalOrigin: number;                      // Valor na moeda de origem
  principalBRL: number;                         // Valor em BRL (convertido)
  contractFXRate?: number;                      // Taxa de câmbio PTAX fixada no contrato
  contractFXDate?: string;                      // Data da PTAX do contrato (YYYY-MM-DD)

  // Datas
  startDate: string;                            // Data de início (YYYY-MM-DD)
  maturityDate: string;                         // Data de vencimento (YYYY-MM-DD)

  // Configuração de Juros
  interestConfig: InterestConfig;

  // Fluxo de Pagamentos
  paymentFlow: PaymentFlowConfig;

  // Saldo Atual
  currentBalance: BalanceSnapshot;

  // Metadados
  createdAt: string;                            // Timestamp de criação
  updatedAt: string;                            // Timestamp da última atualização
  notes?: string;                               // Observações
}

/**
 * Interface para os templates de taxa de juros, facilitando a criação de contratos.
 */
export interface InterestTemplate {
  name: string;
  description: string;
  legs: Omit<InterestLeg, 'dayCountBasis'>[]; // `dayCountBasis` é definido no `InterestConfig`
}

/**
 * Dados de entrada para a criação de um novo contrato.
 * Usado pelo wizard e pela API programática.
 */
export type LoanContractInput = Omit<LoanContract, 'id' | 'principalBRL' | 'currentBalance' | 'createdAt' | 'updatedAt'> & {
  id?: string; // Opcional na criação
};
