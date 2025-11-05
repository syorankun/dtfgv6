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
          id: 'variation_brl',
          pivotKey: 'fxVariationBRL',
          field: 'fxVariationBRL',
          label: 'Variação (BRL)',
          type: 'number',
          decimals: 2,
          summary: 'sum',
          width: 140,
          format: { alignment: 'right' }
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
          id: 'fxv_var_brl',
          field: 'fxVariationBRL',
          pivotKey: 'fxVarBRL',
          label: 'Δ Cambial (BRL)',
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

export function cloneAccrualViewConfig(view: AccrualSheetViewConfig): AccrualSheetViewConfig {
  return JSON.parse(JSON.stringify(view)) as AccrualSheetViewConfig;
}
