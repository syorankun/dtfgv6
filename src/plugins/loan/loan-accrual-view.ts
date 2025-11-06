import type { CellFormat } from '@core/types';
import type { AccrualRow } from './loan-scheduler';

export type AccrualRowField = keyof AccrualRow;
export type AccrualSummaryMode = 'sum' | 'avg' | 'last';

export interface AccrualSheetColumnDescriptor {
  id?: string;
  pivotKey?: string;
  field?: AccrualRowField;
  label: string;
  type: 'number' | 'string' | 'date';
  decimals?: number;
  width?: number;
  summary?: AccrualSummaryMode;
  format?: CellFormat;
  summaryFormat?: CellFormat;
  valueGetter?: (row: AccrualRow) => number | string | null | undefined;
}

export interface AccrualSheetSection {
  id: string;
  title: string;
  columns: AccrualSheetColumnDescriptor[];
}

export interface AccrualSheetViewConfig {
  id: string;
  title?: string;
  sections: AccrualSheetSection[];
  summaryLabel?: string;
  description?: string;
}

export interface AccrualSheetMetadataEntry {
  label: string;
  value: string;
}

export interface AccrualSheetOptions {
  view?: AccrualSheetViewConfig;
  includeSummary?: boolean;
  metadata?: AccrualSheetMetadataEntry[];
}

export const DEFAULT_ACCRUAL_VIEW: AccrualSheetViewConfig = {
  id: 'default-v2',
  title: 'ACCRUAL Consolidado (BRL + FX)',
  description: 'Visão padrão com saldos em moeda origem, BRL (Contrato/ PTAX) e variação cambial',
  summaryLabel: 'Totais',
  sections: [
    {
      id: 'period',
      title: 'Período',
      columns: [
        {
          id: 'period_date',
          pivotKey: 'periodDate',
          field: 'date',
          label: 'Data',
          type: 'date',
          summary: 'last',
          width: 110,
          format: { alignment: 'center' }
        },
        {
          id: 'period_days',
          pivotKey: 'periodDays',
          field: 'days',
          label: 'Dias',
          type: 'number',
          decimals: 0,
          summary: 'sum',
          width: 80,
          format: { alignment: 'right' }
        },
        {
          id: 'period_eff_rate',
          pivotKey: 'periodEffectiveRate',
          field: 'effRate',
          label: 'Taxa Efetiva',
          type: 'number',
          decimals: 8,
          summary: 'last',
          width: 120,
          format: { alignment: 'right' }
        }
      ]
    },
    {
      id: 'origin',
      title: 'Moeda Origem',
      columns: [
        {
          id: 'origin_opening',
          pivotKey: 'originOpening',
          field: 'openingBalanceOrigin',
          label: 'Saldo Inicial',
          type: 'number',
          decimals: 4,
          summary: 'last',
          width: 140,
          format: { alignment: 'right' }
        },
        {
          id: 'origin_interest',
          pivotKey: 'originInterest',
          field: 'interestOrigin',
          label: 'Juros',
          type: 'number',
          decimals: 4,
          summary: 'sum',
          width: 120,
          format: { alignment: 'right' }
        },
        {
          id: 'origin_accrued',
          pivotKey: 'originAccrued',
          field: 'accruedInterestOrigin',
          label: 'Juros Acumulados',
          type: 'number',
          decimals: 4,
          summary: 'last',
          width: 150,
          format: { alignment: 'right' }
        },
        {
          id: 'origin_closing',
          pivotKey: 'originClosing',
          field: 'closingBalanceOrigin',
          label: 'Saldo Final',
          type: 'number',
          decimals: 4,
          summary: 'last',
          width: 140,
          format: { alignment: 'right' }
        }
      ]
    },
    {
      id: 'contract-brl',
      title: 'BRL (Contrato)',
      columns: [
        {
          id: 'contract_opening',
          pivotKey: 'contractOpeningBRL',
          field: 'openingBalanceBRLContract',
          label: 'Saldo Inicial',
          type: 'number',
          decimals: 2,
          summary: 'last',
          width: 140,
          format: { alignment: 'right' }
        },
        {
          id: 'contract_interest',
          pivotKey: 'contractInterestBRL',
          field: 'interestBRLContract',
          label: 'Juros',
          type: 'number',
          decimals: 2,
          summary: 'sum',
          width: 120,
          format: { alignment: 'right' }
        },
        {
          id: 'contract_accrued',
          pivotKey: 'contractAccruedBRL',
          field: 'accruedInterestBRLContract',
          label: 'Juros Acumulados',
          type: 'number',
          decimals: 2,
          summary: 'last',
          width: 150,
          format: { alignment: 'right' }
        },
        {
          id: 'contract_closing',
          pivotKey: 'contractClosingBRL',
          field: 'closingBalanceBRLContract',
          label: 'Saldo Final',
          type: 'number',
          decimals: 2,
          summary: 'last',
          width: 140,
          format: { alignment: 'right' }
        },
        {
          id: 'contract_fx',
          pivotKey: 'contractFxRate',
          field: 'fxRateContract',
          label: 'FX Contrato',
          type: 'number',
          decimals: 6,
          summary: 'last',
          width: 120,
          format: { alignment: 'right' }
        }
      ]
    },
    {
      id: 'ptax-brl',
      title: 'BRL (PTAX)',
      columns: [
        {
          id: 'ptax_opening',
          pivotKey: 'ptaxOpeningBRL',
          field: 'openingBalanceBRLPTAX',
          label: 'Saldo Inicial',
          type: 'number',
          decimals: 2,
          summary: 'last',
          width: 140,
          format: { alignment: 'right' }
        },
        {
          id: 'ptax_interest',
          pivotKey: 'ptaxInterestBRL',
          field: 'interestBRLPTAX',
          label: 'Juros',
          type: 'number',
          decimals: 2,
          summary: 'sum',
          width: 120,
          format: { alignment: 'right' }
        },
        {
          id: 'ptax_accrued',
          pivotKey: 'ptaxAccruedBRL',
          field: 'accruedInterestBRLPTAX',
          label: 'Juros Acumulados',
          type: 'number',
          decimals: 2,
          summary: 'last',
          width: 150,
          format: { alignment: 'right' }
        },
        {
          id: 'ptax_closing',
          pivotKey: 'ptaxClosingBRL',
          field: 'closingBalanceBRLPTAX',
          label: 'Saldo Final',
          type: 'number',
          decimals: 2,
          summary: 'last',
          width: 140,
          format: { alignment: 'right' }
        },
        {
          id: 'ptax_fx',
          pivotKey: 'ptaxFxRate',
          field: 'fxRatePTAX',
          label: 'FX PTAX',
          type: 'number',
          decimals: 6,
          summary: 'last',
          width: 120,
          format: { alignment: 'right' }
        },
        {
          id: 'ptax_source',
          pivotKey: 'ptaxFxSource',
          field: 'fxSourcePTAX',
          label: 'Fonte PTAX',
          type: 'string',
          summary: 'last',
          width: 160,
          format: { alignment: 'left' }
        }
      ]
    },
    {
      id: 'variation',
      title: 'Variação Cambial',
      columns: [
        {
          id: 'variation_opening',
          pivotKey: 'fxVariationOpeningBRL',
          field: 'fxVariationOpeningBRL',
          label: 'Δ Principal (BRL)',
          type: 'number',
          decimals: 2,
          summary: 'sum',
          width: 150,
          format: { alignment: 'right' }
        },
        {
          id: 'variation_interest',
          pivotKey: 'fxVariationInterestBRL',
          field: 'fxVariationInterestBRL',
          label: 'Δ Juros (BRL)',
          type: 'number',
          decimals: 2,
          summary: 'sum',
          width: 150,
          format: { alignment: 'right' }
        },
        {
          id: 'variation_closing',
          pivotKey: 'fxVariationBRL',
          field: 'fxVariationBRL',
          label: 'Δ Saldo (BRL)',
          type: 'number',
          decimals: 2,
          summary: 'sum',
          width: 150,
          format: { alignment: 'right', textColor: '#DC2626' }
        },
        {
          id: 'variation_percent',
          pivotKey: 'fxVariationPercent',
          field: 'fxVariationPercent',
          label: 'Variação (%)',
          type: 'number',
          decimals: 4,
          summary: 'last',
          width: 120,
          format: { alignment: 'right' }
        }
      ]
    }
  ]
};

export function resolveAccrualValue(
  row: AccrualRow,
  descriptor: AccrualSheetColumnDescriptor
): number | string | null | undefined {
  if (descriptor.valueGetter) {
    return descriptor.valueGetter(row);
  }
  if (descriptor.field) {
    const field = descriptor.field;
    return row[field];
  }
  return undefined;
}

export const FX_VARIATION_FOCUS_VIEW: AccrualSheetViewConfig = {
  id: 'fx-variation-focus',
  title: 'ACCRUAL - FX & Juros',
  description: 'Layout resumido enfatizando variação cambial e juros em BRL',
  summaryLabel: 'Total / Último',
  sections: [
    {
      id: 'tempo',
      title: 'Período',
      columns: [
        {
          id: 'fxv_date',
          field: 'date',
          pivotKey: 'date',
          label: 'Data',
          type: 'date',
          summary: 'last',
          width: 120,
          format: { alignment: 'center' }
        },
        {
          id: 'fxv_days',
          field: 'days',
          pivotKey: 'days',
          label: 'Dias',
          type: 'number',
          decimals: 0,
          summary: 'sum',
          width: 90,
          format: { alignment: 'center' }
        },
        {
          id: 'fxv_eff',
          field: 'effRate',
          pivotKey: 'effectiveRate',
          label: 'Tx Efetiva',
          type: 'number',
          decimals: 6,
          summary: 'last',
          width: 120,
          format: { alignment: 'right' }
        }
      ]
    },
    {
      id: 'juros',
      title: 'Juros & Saldos BRL',
      columns: [
        {
          id: 'fxv_interest_contract',
          field: 'interestBRLContract',
          pivotKey: 'interestContractBRL',
          label: 'Juros (Contrato)',
          type: 'number',
          decimals: 2,
          summary: 'sum',
          width: 150,
          format: { alignment: 'right' }
        },
        {
          id: 'fxv_accrued_contract',
          field: 'accruedInterestBRLContract',
          pivotKey: 'accruedContractBRL',
          label: 'Juros Acum. (Contrato)',
          type: 'number',
          decimals: 2,
          summary: 'last',
          width: 170,
          format: { alignment: 'right' }
        },
        {
          id: 'fxv_interest_ptax',
          field: 'interestBRLPTAX',
          pivotKey: 'interestPTAXBRL',
          label: 'Juros (PTAX)',
          type: 'number',
          decimals: 2,
          summary: 'sum',
          width: 150,
          format: { alignment: 'right' }
        },
        {
          id: 'fxv_accrued_ptax',
          field: 'accruedInterestBRLPTAX',
          pivotKey: 'accruedPTAXBRL',
          label: 'Juros Acum. (PTAX)',
          type: 'number',
          decimals: 2,
          summary: 'last',
          width: 170,
          format: { alignment: 'right' }
        },
        {
          id: 'fxv_closing_ptax',
          field: 'closingBalanceBRLPTAX',
          pivotKey: 'closingBRLPTAX',
          label: 'Saldo Final BRL (PTAX)',
          type: 'number',
          decimals: 2,
          summary: 'last',
          width: 170,
          format: { alignment: 'right' }
        }
      ]
    },
    {
      id: 'fx',
      title: 'FX & Variação',
      columns: [
        {
          id: 'fxv_fx_contract',
          field: 'fxRateContract',
          pivotKey: 'fxContract',
          label: 'FX Contrato',
          type: 'number',
          decimals: 6,
          summary: 'last',
          width: 130,
          format: { alignment: 'right' }
        },
        {
          id: 'fxv_fx_ptax',
          field: 'fxRatePTAX',
          pivotKey: 'fxPTAX',
          label: 'FX PTAX',
          type: 'number',
          decimals: 6,
          summary: 'last',
          width: 130,
          format: { alignment: 'right' }
        },
        {
          id: 'fxv_var_opening',
          field: 'fxVariationOpeningBRL',
          pivotKey: 'fxVarOpeningBRL',
          label: 'Δ Principal (BRL)',
          type: 'number',
          decimals: 2,
          summary: 'sum',
          width: 160,
          format: { alignment: 'right' }
        },
        {
          id: 'fxv_var_interest',
          field: 'fxVariationInterestBRL',
          pivotKey: 'fxVarInterestBRL',
          label: 'Δ Juros (BRL)',
          type: 'number',
          decimals: 2,
          summary: 'sum',
          width: 160,
          format: { alignment: 'right' }
        },
        {
          id: 'fxv_var_brl',
          field: 'fxVariationBRL',
          pivotKey: 'fxVarBRL',
          label: 'Δ Saldo (BRL)',
          type: 'number',
          decimals: 2,
          summary: 'sum',
          width: 150,
          format: { alignment: 'right' }
        },
        {
          id: 'fxv_var_pct',
          field: 'fxVariationPercent',
          pivotKey: 'fxVarPct',
          label: 'Δ Cambial (%)',
          type: 'number',
          decimals: 4,
          summary: 'last',
          width: 130,
          format: { alignment: 'right' }
        }
      ]
    }
  ]
};

export const IFRS_USD_BRL_ACCRUAL_VIEW: AccrualSheetViewConfig = {
  id: 'ifrs-usd-brl-accrual',
  title: 'IFRS USD → BRL (Accrual)',
  description: 'Demonstração IFRS/CPC 02 com juros em USD e reconciliação em BRL (Contrato vs PTAX)',
  summaryLabel: 'Totais IFRS',
  sections: [
    {
      id: 'ifr_period',
      title: 'Período (ACT/365)',
      columns: [
        {
          id: 'ifr_date',
          field: 'date',
          pivotKey: 'periodDate',
          label: 'Data',
          type: 'date',
          summary: 'last',
          width: 120,
          format: { alignment: 'center' }
        },
        {
          id: 'ifr_days',
          field: 'days',
          pivotKey: 'periodDays',
          label: 'Dias (ACT/365)',
          type: 'number',
          decimals: 0,
          summary: 'sum',
          width: 130,
          format: { alignment: 'center' }
        },
        {
          id: 'ifr_eff_rate',
          field: 'effRate',
          pivotKey: 'effectiveRate',
          label: 'Taxa Efetiva',
          type: 'number',
          decimals: 8,
          summary: 'avg',
          width: 140,
          format: { alignment: 'right' }
        }
      ]
    },
    {
      id: 'ifr_origin',
      title: 'USD (Moeda Contratada)',
      columns: [
        {
          id: 'ifr_opening_origin',
          field: 'openingBalanceOrigin',
          pivotKey: 'openingOrigin',
          label: 'Saldo Inicial (USD)',
          type: 'number',
          decimals: 4,
          summary: 'last',
          width: 160,
          format: { alignment: 'right' }
        },
        {
          id: 'ifr_interest_origin',
          field: 'interestOrigin',
          pivotKey: 'interestOrigin',
          label: 'Juros (USD)',
          type: 'number',
          decimals: 4,
          summary: 'sum',
          width: 150,
          format: { alignment: 'right' }
        },
        {
          id: 'ifr_accrued_origin',
          field: 'accruedInterestOrigin',
          pivotKey: 'accruedOrigin',
          label: 'Juros Acum. (USD)',
          type: 'number',
          decimals: 4,
          summary: 'last',
          width: 170,
          format: { alignment: 'right' }
        },
        {
          id: 'ifr_closing_origin',
          field: 'closingBalanceOrigin',
          pivotKey: 'closingOrigin',
          label: 'Saldo Final (USD)',
          type: 'number',
          decimals: 4,
          summary: 'last',
          width: 160,
          format: { alignment: 'right' }
        }
      ]
    },
    {
      id: 'ifr_contract_brl',
      title: 'Conversão BRL (Taxa do Contrato)',
      columns: [
        {
          id: 'ifr_opening_contract',
          field: 'openingBalanceBRLContract',
          pivotKey: 'openingContractBRL',
          label: 'Saldo Inicial (BRL Contrato)',
          type: 'number',
          decimals: 2,
          summary: 'last',
          width: 190,
          format: { alignment: 'right' }
        },
        {
          id: 'ifr_interest_contract',
          field: 'interestBRLContract',
          pivotKey: 'interestContractBRL',
          label: 'Juros (BRL Contrato)',
          type: 'number',
          decimals: 2,
          summary: 'sum',
          width: 170,
          format: { alignment: 'right' }
        },
        {
          id: 'ifr_accrued_contract',
          field: 'accruedInterestBRLContract',
          pivotKey: 'accruedContractBRL',
          label: 'Juros Acum. (BRL Contrato)',
          type: 'number',
          decimals: 2,
          summary: 'last',
          width: 200,
          format: { alignment: 'right' }
        },
        {
          id: 'ifr_closing_contract',
          field: 'closingBalanceBRLContract',
          pivotKey: 'closingContractBRL',
          label: 'Saldo Final (BRL Contrato)',
          type: 'number',
          decimals: 2,
          summary: 'last',
          width: 190,
          format: { alignment: 'right' }
        },
        {
          id: 'ifr_fx_contract',
          field: 'fxRateContract',
          pivotKey: 'fxContract',
          label: 'FX Contrato',
          type: 'number',
          decimals: 6,
          summary: 'last',
          width: 140,
          format: { alignment: 'right' }
        }
      ]
    },
    {
      id: 'ifr_ptax_brl',
      title: 'Conversão BRL (PTAX / Mark-to-Market)',
      columns: [
        {
          id: 'ifr_opening_ptax',
          field: 'openingBalanceBRLPTAX',
          pivotKey: 'openingPTAXBRL',
          label: 'Saldo Inicial (BRL PTAX)',
          type: 'number',
          decimals: 2,
          summary: 'last',
          width: 190,
          format: { alignment: 'right' }
        },
        {
          id: 'ifr_interest_ptax',
          field: 'interestBRLPTAX',
          pivotKey: 'interestPTAXBRL',
          label: 'Juros (BRL PTAX)',
          type: 'number',
          decimals: 2,
          summary: 'sum',
          width: 170,
          format: { alignment: 'right' }
        },
        {
          id: 'ifr_accrued_ptax',
          field: 'accruedInterestBRLPTAX',
          pivotKey: 'accruedPTAXBRL',
          label: 'Juros Acum. (BRL PTAX)',
          type: 'number',
          decimals: 2,
          summary: 'last',
          width: 200,
          format: { alignment: 'right' }
        },
        {
          id: 'ifr_closing_ptax',
          field: 'closingBalanceBRLPTAX',
          pivotKey: 'closingPTAXBRL',
          label: 'Saldo Final (BRL PTAX)',
          type: 'number',
          decimals: 2,
          summary: 'last',
          width: 190,
          format: { alignment: 'right' }
        },
        {
          id: 'ifr_fx_ptax',
          field: 'fxRatePTAX',
          pivotKey: 'fxPTAX',
          label: 'FX PTAX',
          type: 'number',
          decimals: 6,
          summary: 'last',
          width: 140,
          format: { alignment: 'right' }
        }
      ]
    },
    {
      id: 'ifr_variation',
      title: 'Reconciliação Cambial IFRS',
      columns: [
        {
          id: 'ifr_var_opening',
          field: 'fxVariationOpeningBRL',
          pivotKey: 'fxVarOpeningBRL',
          label: 'Δ Principal (BRL)',
          type: 'number',
          decimals: 2,
          summary: 'sum',
          width: 170,
          format: { alignment: 'right' }
        },
        {
          id: 'ifr_var_interest',
          field: 'fxVariationInterestBRL',
          pivotKey: 'fxVarInterestBRL',
          label: 'Δ Juros (BRL)',
          type: 'number',
          decimals: 2,
          summary: 'sum',
          width: 170,
          format: { alignment: 'right' }
        },
        {
          id: 'ifr_var_total',
          field: 'fxVariationBRL',
          pivotKey: 'fxVarBRL',
          label: 'Δ Saldo (BRL)',
          type: 'number',
          decimals: 2,
          summary: 'sum',
          width: 170,
          format: { alignment: 'right', textColor: '#DC2626' }
        },
        {
          id: 'ifr_var_percent',
          field: 'fxVariationPercent',
          pivotKey: 'fxVarPercent',
          label: 'Δ FX (%)',
          type: 'number',
          decimals: 4,
          summary: 'last',
          width: 140,
          format: { alignment: 'right' }
        }
      ]
    }
  ]
};

/**
 * Visão focada em pagamentos e recálculo de accrual
 * 
 * IMPORTANTE: Esta visão RECALCULA o accrual considerando pagamentos:
 * 
 * 1. Saldo Inicial: começa com o principal do contrato
 * 2. Juros do Período: calculados sobre o saldo ATUAL (já reduzido por pagamentos anteriores)
 * 3. Pagamentos: registrados quando ocorrem, alocando primeiro para juros, depois para principal
 * 4. Saldo Final: saldo após juros do período menos pagamentos realizados
 * 5. Juros Acumulados: soma dos juros menos juros já pagos
 * 6. Juros Pendentes: juros acumulados ainda não pagos
 * 
 * A cada pagamento que amortiza principal, os juros dos períodos seguintes
 * são automaticamente menores, pois incidem sobre um saldo menor.
 */
export const PAYMENT_ACCRUAL_VIEW: AccrualSheetViewConfig = {
  id: 'payment-accrual-view',
  title: 'ACCRUAL com Pagamentos',
  description: 'Visão detalhada de juros acumulados, pagamentos realizados e saldo devedor recalculado',
  summaryLabel: 'Totais',
  sections: [
    {
      id: 'periodo',
      title: 'Período',
      columns: [
        {
          id: 'pay_date',
          field: 'date',
          pivotKey: 'periodDate',
          label: 'Data',
          type: 'date',
          summary: 'last',
          width: 110,
          format: { alignment: 'center' }
        },
        {
          id: 'pay_days',
          field: 'days',
          pivotKey: 'periodDays',
          label: 'Dias',
          type: 'number',
          decimals: 0,
          summary: 'sum',
          width: 70,
          format: { alignment: 'center' }
        },
        {
          id: 'pay_rate',
          field: 'effRate',
          pivotKey: 'effectiveRate',
          label: 'Taxa Efetiva',
          type: 'number',
          decimals: 6,
          summary: 'last',
          width: 120,
          format: { alignment: 'right' }
        }
      ]
    },
    {
      id: 'saldos',
      title: 'Saldos e Montantes',
      columns: [
        {
          id: 'pay_opening_brl',
          field: 'openingBalanceBRLPTAX',
          pivotKey: 'openingBalanceBRL',
          label: 'Saldo Inicial (BRL)',
          type: 'number',
          decimals: 2,
          summary: 'last',
          width: 160,
          format: { alignment: 'right' }
        },
        {
          id: 'pay_opening_origin',
          field: 'openingBalanceOrigin',
          pivotKey: 'openingBalanceOrigin',
          label: 'Saldo Inicial (Moeda)',
          type: 'number',
          decimals: 4,
          summary: 'last',
          width: 170,
          format: { alignment: 'right' }
        }
      ]
    },
    {
      id: 'juros',
      title: 'Juros do Período',
      columns: [
        {
          id: 'pay_interest_brl',
          field: 'interestBRLPTAX',
          pivotKey: 'interestPeriodBRL',
          label: 'Juros BRL',
          type: 'number',
          decimals: 2,
          summary: 'sum',
          width: 140,
          format: { alignment: 'right' }
        },
        {
          id: 'pay_interest_origin',
          field: 'interestOrigin',
          pivotKey: 'interestPeriodOrigin',
          label: 'Juros Moeda',
          type: 'number',
          decimals: 4,
          summary: 'sum',
          width: 140,
          format: { alignment: 'right' }
        },
        {
          id: 'pay_accrued_brl',
          field: 'accruedInterestBRLPTAX',
          pivotKey: 'accruedTotalBRL',
          label: 'Juros Acum. BRL',
          type: 'number',
          decimals: 2,
          summary: 'last',
          width: 160,
          format: { alignment: 'right' }
        },
        {
          id: 'pay_accrued_origin',
          field: 'accruedInterestOrigin',
          pivotKey: 'accruedTotalOrigin',
          label: 'Juros Acum. Moeda',
          type: 'number',
          decimals: 4,
          summary: 'last',
          width: 170,
          format: { alignment: 'right' }
        }
      ]
    },
    {
      id: 'pagamentos',
      title: 'Pagamentos Realizados',
      columns: [
        {
          id: 'pay_interest_paid_brl',
          pivotKey: 'interestPaidBRL',
          label: 'Juros Pagos (BRL)',
          type: 'number',
          decimals: 2,
          summary: 'sum',
          width: 160,
          format: { alignment: 'right' },
          valueGetter: (row: any) => row.interestPaidBRL || 0
        },
        {
          id: 'pay_interest_paid_origin',
          pivotKey: 'interestPaidOrigin',
          label: 'Juros Pagos (Moeda)',
          type: 'number',
          decimals: 4,
          summary: 'sum',
          width: 170,
          format: { alignment: 'right' },
          valueGetter: (row: any) => row.interestPaidOrigin || 0
        },
        {
          id: 'pay_principal_paid_brl',
          pivotKey: 'principalPaidBRL',
          label: 'Principal Pago (BRL)',
          type: 'number',
          decimals: 2,
          summary: 'sum',
          width: 160,
          format: { alignment: 'right' },
          valueGetter: (row: any) => row.principalPaidBRL || 0
        },
        {
          id: 'pay_principal_paid_origin',
          pivotKey: 'principalPaidOrigin',
          label: 'Principal Pago (Moeda)',
          type: 'number',
          decimals: 4,
          summary: 'sum',
          width: 170,
          format: { alignment: 'right' },
          valueGetter: (row: any) => row.principalPaidOrigin || 0
        },
        {
          id: 'pay_total_payment_brl',
          pivotKey: 'totalPaymentBRL',
          label: 'Pagamento Total (BRL)',
          type: 'number',
          decimals: 2,
          summary: 'sum',
          width: 180,
          format: { alignment: 'right' },
          valueGetter: (row: any) => {
            const interestPaid = row.interestPaidBRL || 0;
            const principalPaid = row.principalPaidBRL || 0;
            return row.totalPaymentBRL ?? interestPaid + principalPaid;
          }
        },
        {
          id: 'pay_total_payment_origin',
          pivotKey: 'totalPaymentOrigin',
          label: 'Pagamento Total (Moeda)',
          type: 'number',
          decimals: 4,
          summary: 'sum',
          width: 200,
          format: { alignment: 'right' },
          valueGetter: (row: any) => {
            const interestPaid = row.interestPaidOrigin || 0;
            const principalPaid = row.principalPaidOrigin || 0;
            return row.totalPaymentOrigin ?? interestPaid + principalPaid;
          }
        }
      ]
    },
    {
      id: 'indicadores',
      title: 'Cobertura & Amortização',
      columns: [
        {
          id: 'pay_interest_delta_brl',
          pivotKey: 'interestDeltaBRL',
          label: 'Juros Descobertos (BRL)',
          type: 'number',
          decimals: 2,
          summary: 'sum',
          width: 190,
          format: { alignment: 'right' },
          valueGetter: (row: any) => row.interestDeltaBRL || 0
        },
        {
          id: 'pay_interest_delta_origin',
          pivotKey: 'interestDeltaOrigin',
          label: 'Juros Descobertos (Moeda)',
          type: 'number',
          decimals: 4,
          summary: 'sum',
          width: 210,
          format: { alignment: 'right' },
          valueGetter: (row: any) => row.interestDeltaOrigin || 0
        },
        {
          id: 'pay_interest_coverage_ratio',
          pivotKey: 'interestCoverageRatio',
          label: 'Cobertura Juros (%)',
          type: 'number',
          decimals: 2,
          summary: 'avg',
          width: 190,
          format: { alignment: 'right', textColor: '#2563EB' },
          valueGetter: (row: any) => {
            if (row.interestCoverageRatio === null || row.interestCoverageRatio === undefined) {
              return null;
            }
            return Math.round(row.interestCoverageRatio * 10000) / 100;
          }
        },
        {
          id: 'pay_amortization_effect_brl',
          pivotKey: 'amortizationEffectBRL',
          label: 'Amortização Líquida (BRL)',
          type: 'number',
          decimals: 2,
          summary: 'sum',
          width: 200,
          format: { alignment: 'right' },
          valueGetter: (row: any) => row.amortizationEffectBRL || 0
        },
        {
          id: 'pay_amortization_effect_origin',
          pivotKey: 'amortizationEffectOrigin',
          label: 'Amortização Líquida (Moeda)',
          type: 'number',
          decimals: 4,
          summary: 'sum',
          width: 220,
          format: { alignment: 'right' },
          valueGetter: (row: any) => row.amortizationEffectOrigin || 0
        },
        {
          id: 'pay_cash_vs_accrual_brl',
          pivotKey: 'cashVsAccrualBRL',
          label: 'Caixa x Accrual (BRL)',
          type: 'number',
          decimals: 2,
          summary: 'sum',
          width: 200,
          format: { alignment: 'right' },
          valueGetter: (row: any) => row.cashVsAccrualBRL || 0
        },
        {
          id: 'pay_cash_vs_accrual_origin',
          pivotKey: 'cashVsAccrualOrigin',
          label: 'Caixa x Accrual (Moeda)',
          type: 'number',
          decimals: 4,
          summary: 'sum',
          width: 220,
          format: { alignment: 'right' },
          valueGetter: (row: any) => row.cashVsAccrualOrigin || 0
        }
      ]
    },
    {
      id: 'saldos_finais',
      title: 'Saldos Recalculados',
      columns: [
        {
          id: 'pay_interest_pending_brl',
          pivotKey: 'interestPendingBRL',
          label: 'Juros Pendentes (BRL)',
          type: 'number',
          decimals: 2,
          summary: 'last',
          width: 180,
          format: { alignment: 'right' },
          valueGetter: (row: any) => row.interestPendingBRL || 0
        },
        {
          id: 'pay_interest_pending_origin',
          pivotKey: 'interestPendingOrigin',
          label: 'Juros Pendentes (Moeda)',
          type: 'number',
          decimals: 4,
          summary: 'last',
          width: 190,
          format: { alignment: 'right' },
          valueGetter: (row: any) => row.interestPendingOrigin || 0
        },
        {
          id: 'pay_closing_brl',
          field: 'closingBalanceBRLPTAX',
          pivotKey: 'closingBalanceBRL',
          label: 'Saldo Devedor (BRL)',
          type: 'number',
          decimals: 2,
          summary: 'last',
          width: 170,
          format: { alignment: 'right' },
          valueGetter: (row: any) => row.recalculatedBalanceBRL || row.closingBalanceBRLPTAX || 0
        },
        {
          id: 'pay_closing_origin',
          field: 'closingBalanceOrigin',
          pivotKey: 'closingBalanceOrigin',
          label: 'Saldo Devedor (Moeda)',
          type: 'number',
          decimals: 4,
          summary: 'last',
          width: 180,
          format: { alignment: 'right' },
          valueGetter: (row: any) => row.recalculatedBalanceOrigin || row.closingBalanceOrigin || 0
        }
      ]
    },
    {
      id: 'fx',
      title: 'Informações Cambiais',
      columns: [
        {
          id: 'pay_fx_ptax',
          field: 'fxRatePTAX',
          pivotKey: 'fxPTAX',
          label: 'PTAX (BCB)',
          type: 'number',
          decimals: 6,
          summary: 'last',
          width: 120,
          format: { alignment: 'right' }
        },
        {
          id: 'pay_fx_contract',
          field: 'fxRateContract',
          pivotKey: 'fxContract',
          label: 'FX Contrato',
          type: 'number',
          decimals: 6,
          summary: 'last',
          width: 120,
          format: { alignment: 'right' }
        }
      ]
    }
  ]
};

export function cloneAccrualViewConfig(view: AccrualSheetViewConfig): AccrualSheetViewConfig {
  return JSON.parse(JSON.stringify(view)) as AccrualSheetViewConfig;
}
