/**
 * Loan Report Templates - Templates pré-definidos para relatórios
 *
 * Define templates de visualização para:
 * - Análise de Juros
 * - Análise de Principal
 * - Visão Consolidada
 * - Fluxo de Caixa
 * - Análise Multi-Contrato
 */

import type { AccrualSheetViewConfig } from './loan-accrual-view';

/**
 * Template: Análise de Juros
 * Foco em juros acumulados, taxas e variações cambiais
 */
export const INTEREST_ANALYSIS_TEMPLATE: AccrualSheetViewConfig = {
  id: 'interest-analysis',
  title: 'Análise de Juros',
  description: 'Foco em juros acumulados, taxas efetivas e impacto cambial',
  summaryLabel: 'Totais do Período',
  sections: [
    {
      id: 'period',
      title: 'Período',
      columns: [
        {
          id: 'date',
          pivotKey: 'date',
          field: 'date',
          label: 'Data',
          type: 'date',
          width: 120,
          summary: 'last',
          format: { alignment: 'center', bold: true }
        },
        {
          id: 'days',
          pivotKey: 'days',
          field: 'days',
          label: 'Dias',
          type: 'number',
          decimals: 0,
          width: 80,
          summary: 'sum',
          format: { alignment: 'center' }
        }
      ]
    },
    {
      id: 'interest-origin',
      title: 'Juros (Moeda Origem)',
      columns: [
        {
          id: 'interest_origin',
          pivotKey: 'interestOrigin',
          field: 'interestOrigin',
          label: 'Juros',
          type: 'number',
          decimals: 4,
          width: 140,
          summary: 'sum',
          format: { alignment: 'right', textColor: '#059669' },
          summaryFormat: { bold: true, bgColor: '#D1FAE5' }
        },
        {
          id: 'accrued_origin',
          pivotKey: 'accruedOrigin',
          field: 'accruedInterestOrigin',
          label: 'Juros Acumulados',
          type: 'number',
          decimals: 4,
          width: 160,
          summary: 'last',
          format: { alignment: 'right', textColor: '#059669' },
          summaryFormat: { bold: true, bgColor: '#D1FAE5' }
        },
        {
          id: 'eff_rate',
          pivotKey: 'effectiveRate',
          field: 'effRate',
          label: 'Taxa Efetiva',
          type: 'number',
          decimals: 8,
          width: 140,
          summary: 'avg',
          format: { alignment: 'right', textColor: '#7C3AED' }
        }
      ]
    },
    {
      id: 'interest-brl',
      title: 'Juros em BRL',
      columns: [
        {
          id: 'interest_contract',
          pivotKey: 'interestContractBRL',
          field: 'interestBRLContract',
          label: 'Juros (Taxa Contrato)',
          type: 'number',
          decimals: 2,
          width: 160,
          summary: 'sum',
          format: { alignment: 'right', textColor: '#059669' },
          summaryFormat: { bold: true, bgColor: '#D1FAE5' }
        },
        {
          id: 'accrued_contract',
          pivotKey: 'accruedContractBRL',
          field: 'accruedInterestBRLContract',
          label: 'Juros Acum. (Contrato)',
          type: 'number',
          decimals: 2,
          width: 180,
          summary: 'last',
          format: { alignment: 'right', textColor: '#059669' },
          summaryFormat: { bold: true, bgColor: '#D1FAE5' }
        },
        {
          id: 'interest_ptax',
          pivotKey: 'interestPTAXBRL',
          field: 'interestBRLPTAX',
          label: 'Juros (PTAX)',
          type: 'number',
          decimals: 2,
          width: 160,
          summary: 'sum',
          format: { alignment: 'right', textColor: '#059669' },
          summaryFormat: { bold: true, bgColor: '#D1FAE5' }
        },
        {
          id: 'accrued_ptax',
          pivotKey: 'accruedPTAXBRL',
          field: 'accruedInterestBRLPTAX',
          label: 'Juros Acum. (PTAX)',
          type: 'number',
          decimals: 2,
          width: 180,
          summary: 'last',
          format: { alignment: 'right', textColor: '#059669' },
          summaryFormat: { bold: true, bgColor: '#D1FAE5' }
        },
        {
          id: 'fx_variation',
          pivotKey: 'fxVariationBRL',
          field: 'fxVariationBRL',
          label: 'Variação Cambial',
          type: 'number',
          decimals: 2,
          width: 150,
          summary: 'sum',
          format: { alignment: 'right', textColor: '#DC2626' },
          summaryFormat: { bold: true, bgColor: '#FEE2E2' }
        }
      ]
    },
    {
      id: 'rates',
      title: 'Taxas de Câmbio',
      columns: [
        {
          id: 'fx_contract',
          pivotKey: 'fxContract',
          field: 'fxRateContract',
          label: 'FX Contrato',
          type: 'number',
          decimals: 6,
          width: 120,
          summary: 'last',
          format: { alignment: 'right' }
        },
        {
          id: 'fx_ptax',
          pivotKey: 'fxPTAX',
          field: 'fxRatePTAX',
          label: 'FX PTAX',
          type: 'number',
          decimals: 6,
          width: 120,
          summary: 'last',
          format: { alignment: 'right' }
        },
        {
          id: 'fx_delta_percent',
          pivotKey: 'fxVariationPercent',
          field: 'fxVariationPercent',
          label: 'Δ FX (%)',
          type: 'number',
          decimals: 4,
          width: 120,
          summary: 'last',
          format: { alignment: 'right', textColor: '#DC2626' }
        }
      ]
    }
  ]
};

/**
 * Template: Análise de Principal
 * Foco em saldos devedores e amortização
 */
export const PRINCIPAL_ANALYSIS_TEMPLATE: AccrualSheetViewConfig = {
  id: 'principal-analysis',
  title: 'Análise de Principal',
  description: 'Foco em saldos devedores, amortização e evolução do principal',
  summaryLabel: 'Posição Final',
  sections: [
    {
      id: 'period',
      title: 'Período',
      columns: [
        {
          id: 'date',
          pivotKey: 'date',
          field: 'date',
          label: 'Data',
          type: 'date',
          width: 120,
          summary: 'last',
          format: { alignment: 'center', bold: true }
        }
      ]
    },
    {
      id: 'balance-origin',
      title: 'Saldos (Moeda Origem)',
      columns: [
        {
          id: 'opening_origin',
          pivotKey: 'openingOrigin',
          field: 'openingBalanceOrigin',
          label: 'Saldo Inicial',
          type: 'number',
          decimals: 4,
          width: 150,
          summary: 'last',
          format: { alignment: 'right', bold: true }
        },
        {
          id: 'interest_origin',
          pivotKey: 'interestOrigin',
          field: 'interestOrigin',
          label: 'Juros',
          type: 'number',
          decimals: 4,
          width: 130,
          summary: 'sum',
          format: { alignment: 'right', textColor: '#059669' }
        },
        {
          id: 'closing_origin',
          pivotKey: 'closingOrigin',
          field: 'closingBalanceOrigin',
          label: 'Saldo Final',
          type: 'number',
          decimals: 4,
          width: 150,
          summary: 'last',
          format: { alignment: 'right', bold: true, bgColor: '#F3F4F6' }
        }
      ]
    },
    {
      id: 'balance-brl-contract',
      title: 'Saldos em BRL (Taxa Contrato)',
      columns: [
        {
          id: 'opening_contract',
          pivotKey: 'openingContractBRL',
          field: 'openingBalanceBRLContract',
          label: 'Saldo Inicial',
          type: 'number',
          decimals: 2,
          width: 150,
          summary: 'last',
          format: { alignment: 'right', bold: true }
        },
        {
          id: 'interest_contract',
          pivotKey: 'interestContractBRL',
          field: 'interestBRLContract',
          label: 'Juros',
          type: 'number',
          decimals: 2,
          width: 130,
          summary: 'sum',
          format: { alignment: 'right', textColor: '#059669' }
        },
        {
          id: 'closing_contract',
          pivotKey: 'closingContractBRL',
          field: 'closingBalanceBRLContract',
          label: 'Saldo Final',
          type: 'number',
          decimals: 2,
          width: 150,
          summary: 'last',
          format: { alignment: 'right', bold: true, bgColor: '#F3F4F6' }
        }
      ]
    },
    {
      id: 'balance-brl-ptax',
      title: 'Saldos em BRL (PTAX)',
      columns: [
        {
          id: 'opening_ptax',
          pivotKey: 'openingPTAXBRL',
          field: 'openingBalanceBRLPTAX',
          label: 'Saldo Inicial',
          type: 'number',
          decimals: 2,
          width: 150,
          summary: 'last',
          format: { alignment: 'right', bold: true }
        },
        {
          id: 'interest_ptax',
          pivotKey: 'interestPTAXBRL',
          field: 'interestBRLPTAX',
          label: 'Juros',
          type: 'number',
          decimals: 2,
          width: 130,
          summary: 'sum',
          format: { alignment: 'right', textColor: '#059669' }
        },
        {
          id: 'closing_ptax',
          pivotKey: 'closingPTAXBRL',
          field: 'closingBalanceBRLPTAX',
          label: 'Saldo Final',
          type: 'number',
          decimals: 2,
          width: 150,
          summary: 'last',
          format: { alignment: 'right', bold: true, bgColor: '#F3F4F6' }
        }
      ]
    }
  ]
};

/**
 * Template: Visão Consolidada
 * Todas as informações principais em um único relatório
 */
export const CONSOLIDATED_TEMPLATE: AccrualSheetViewConfig = {
  id: 'consolidated',
  title: 'Visão Consolidada',
  description: 'Relatório completo com todas as métricas principais',
  summaryLabel: 'Totais / Posição Final',
  sections: [
    {
      id: 'period',
      title: 'Período',
      columns: [
        {
          id: 'date',
          pivotKey: 'date',
          field: 'date',
          label: 'Data',
          type: 'date',
          width: 110,
          summary: 'last',
          format: { alignment: 'center', bold: true }
        },
        {
          id: 'days',
          pivotKey: 'days',
          field: 'days',
          label: 'Dias',
          type: 'number',
          decimals: 0,
          width: 70,
          summary: 'sum',
          format: { alignment: 'center' }
        }
      ]
    },
    {
      id: 'principal',
      title: 'Principal',
      columns: [
        {
          id: 'opening_brl',
          pivotKey: 'openingBRL',
          field: 'openingBalanceBRL',
          label: 'Saldo Inicial (BRL)',
          type: 'number',
          decimals: 2,
          width: 140,
          summary: 'last',
          format: { alignment: 'right', bold: true }
        },
        {
          id: 'closing_brl',
          pivotKey: 'closingBRL',
          field: 'closingBalanceBRL',
          label: 'Saldo Final (BRL)',
          type: 'number',
          decimals: 2,
          width: 140,
          summary: 'last',
          format: { alignment: 'right', bold: true, bgColor: '#F3F4F6' }
        }
      ]
    },
    {
      id: 'interest',
      title: 'Juros',
      columns: [
        {
          id: 'interest_brl',
          pivotKey: 'interestBRL',
          field: 'interestBRL',
          label: 'Juros (BRL)',
          type: 'number',
          decimals: 2,
          width: 120,
          summary: 'sum',
          format: { alignment: 'right', textColor: '#059669' },
          summaryFormat: { bold: true, bgColor: '#D1FAE5' }
        },
        {
          id: 'eff_rate',
          pivotKey: 'effectiveRate',
          field: 'effRate',
          label: 'Taxa Efetiva',
          type: 'number',
          decimals: 8,
          width: 120,
          summary: 'avg',
          format: { alignment: 'right', textColor: '#7C3AED' }
        }
      ]
    },
    {
      id: 'fx',
      title: 'Câmbio',
      columns: [
        {
          id: 'fx_rate',
          pivotKey: 'fxRate',
          field: 'fxRate',
          label: 'Taxa FX',
          type: 'number',
          decimals: 6,
          width: 110,
          summary: 'last',
          format: { alignment: 'right' }
        },
        {
          id: 'fx_variation',
          pivotKey: 'fxVariationBRL',
          field: 'fxVariationBRL',
          label: 'Var. Cambial (BRL)',
          type: 'number',
          decimals: 2,
          width: 140,
          summary: 'sum',
          format: { alignment: 'right', textColor: '#DC2626' },
          summaryFormat: { bold: true, bgColor: '#FEE2E2' }
        }
      ]
    }
  ]
};

/**
 * Template: Fluxo de Caixa
 * Análise de fluxo de caixa projetado vs realizado
 */
export const CASHFLOW_TEMPLATE: AccrualSheetViewConfig = {
  id: 'cashflow',
  title: 'Fluxo de Caixa',
  description: 'Análise de fluxo de caixa projetado e realizado',
  summaryLabel: 'Total do Fluxo',
  sections: [
    {
      id: 'period',
      title: 'Período',
      columns: [
        {
          id: 'date',
          pivotKey: 'date',
          field: 'date',
          label: 'Data',
          type: 'date',
          width: 120,
          summary: 'last',
          format: { alignment: 'center', bold: true }
        }
      ]
    },
    {
      id: 'accrual',
      title: 'Accrual (Competência)',
      columns: [
        {
          id: 'interest_accrued',
          pivotKey: 'interestAccrued',
          field: 'interestBRL',
          label: 'Juros Provisionados',
          type: 'number',
          decimals: 2,
          width: 160,
          summary: 'sum',
          format: { alignment: 'right', textColor: '#059669' },
          summaryFormat: { bold: true, bgColor: '#D1FAE5' }
        },
        {
          id: 'principal_change',
          pivotKey: 'principalChange',
          valueGetter: (row) => row.closingBalanceBRL - row.openingBalanceBRL,
          label: 'Variação Principal',
          type: 'number',
          decimals: 2,
          width: 150,
          summary: 'sum',
          format: { alignment: 'right', textColor: '#7C3AED' }
        }
      ]
    },
    {
      id: 'cashflow',
      title: 'Fluxo de Caixa',
      columns: [
        {
          id: 'total_impact',
          pivotKey: 'totalImpact',
          valueGetter: (row) => row.interestBRL + (row.closingBalanceBRL - row.openingBalanceBRL),
          label: 'Impacto Total',
          type: 'number',
          decimals: 2,
          width: 150,
          summary: 'sum',
          format: { alignment: 'right', bold: true },
          summaryFormat: { bold: true, bgColor: '#DBEAFE', textColor: '#1E40AF' }
        },
        {
          id: 'cumulative',
          pivotKey: 'cumulative',
          valueGetter: (row) => row.closingBalanceBRL,
          label: 'Acumulado',
          type: 'number',
          decimals: 2,
          width: 150,
          summary: 'last',
          format: { alignment: 'right', bold: true, bgColor: '#F3F4F6' }
        }
      ]
    }
  ]
};

/**
 * Template: Resumo Executivo
 * Visão simplificada para apresentações
 */
export const EXECUTIVE_SUMMARY_TEMPLATE: AccrualSheetViewConfig = {
  id: 'executive-summary',
  title: 'Resumo Executivo',
  description: 'Visão simplificada com principais métricas',
  summaryLabel: 'Totais',
  sections: [
    {
      id: 'period',
      title: 'Período',
      columns: [
        {
          id: 'date',
          pivotKey: 'date',
          field: 'date',
          label: 'Data',
          type: 'date',
          width: 120,
          summary: 'last',
          format: { alignment: 'center', bold: true }
        },
        {
          id: 'days',
          pivotKey: 'days',
          field: 'days',
          label: 'Dias',
          type: 'number',
          decimals: 0,
          width: 80,
          summary: 'sum',
          format: { alignment: 'center' }
        }
      ]
    },
    {
      id: 'metrics',
      title: 'Métricas Principais',
      columns: [
        {
          id: 'balance',
          pivotKey: 'balance',
          field: 'closingBalanceBRL',
          label: 'Saldo Devedor (BRL)',
          type: 'number',
          decimals: 2,
          width: 160,
          summary: 'last',
          format: { alignment: 'right', bold: true, bgColor: '#F3F4F6' }
        },
        {
          id: 'interest',
          pivotKey: 'interest',
          field: 'interestBRL',
          label: 'Juros (BRL)',
          type: 'number',
          decimals: 2,
          width: 130,
          summary: 'sum',
          format: { alignment: 'right', textColor: '#059669' },
          summaryFormat: { bold: true, bgColor: '#D1FAE5' }
        },
        {
          id: 'fx_impact',
          pivotKey: 'fxImpact',
          field: 'fxVariationBRL',
          label: 'Impacto FX (BRL)',
          type: 'number',
          decimals: 2,
          width: 140,
          summary: 'sum',
          format: { alignment: 'right', textColor: '#DC2626' },
          summaryFormat: { bold: true, bgColor: '#FEE2E2' }
        },
        {
          id: 'rate',
          pivotKey: 'rate',
          field: 'effRate',
          label: 'Taxa Média',
          type: 'number',
          decimals: 6,
          width: 120,
          summary: 'avg',
          format: { alignment: 'right', textColor: '#7C3AED' }
        }
      ]
    }
  ]
};

/**
 * Registro de todos os templates disponíveis
 */
export const REPORT_TEMPLATES = {
  'interest-analysis': INTEREST_ANALYSIS_TEMPLATE,
  'principal-analysis': PRINCIPAL_ANALYSIS_TEMPLATE,
  'consolidated': CONSOLIDATED_TEMPLATE,
  'cashflow': CASHFLOW_TEMPLATE,
  'executive-summary': EXECUTIVE_SUMMARY_TEMPLATE
};

/**
 * Metadados dos templates para exibição na UI
 */
export interface ReportTemplateMetadata {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  tags: string[];
  useCase: string;
  preview: string;
}

export const TEMPLATE_METADATA: ReportTemplateMetadata[] = [
  {
    id: 'interest-analysis',
    name: 'Análise de Juros',
    description: 'Detalhamento completo de juros acumulados e variações cambiais',
    category: 'Análise Detalhada',
    icon: '💰',
    tags: ['juros', 'taxa', 'fx', 'variação'],
    useCase: 'Ideal para análise de despesas financeiras e impacto cambial',
    preview: 'Data | Dias | Juros (Origem) | Juros (BRL) | Var. Cambial | FX'
  },
  {
    id: 'principal-analysis',
    name: 'Análise de Principal',
    description: 'Evolução do saldo devedor em todas as perspectivas',
    category: 'Análise Detalhada',
    icon: '📊',
    tags: ['principal', 'saldo', 'amortização'],
    useCase: 'Ideal para acompanhamento da evolução da dívida',
    preview: 'Data | Saldo Inicial | Juros | Saldo Final (Origem e BRL)'
  },
  {
    id: 'consolidated',
    name: 'Visão Consolidada',
    description: 'Todas as métricas principais em um único relatório',
    category: 'Visão Geral',
    icon: '📋',
    tags: ['completo', 'consolidado', 'geral'],
    useCase: 'Ideal para análise completa e relatórios mensais',
    preview: 'Data | Principal | Juros | Câmbio | Variações'
  },
  {
    id: 'cashflow',
    name: 'Fluxo de Caixa',
    description: 'Análise de competência e impacto no fluxo de caixa',
    category: 'Financeiro',
    icon: '💵',
    tags: ['fluxo', 'caixa', 'accrual', 'impacto'],
    useCase: 'Ideal para análise de impacto financeiro e provisões',
    preview: 'Data | Juros Provisionados | Variação Principal | Impacto Total'
  },
  {
    id: 'executive-summary',
    name: 'Resumo Executivo',
    description: 'Visão simplificada para apresentações e decisões',
    category: 'Gerencial',
    icon: '📈',
    tags: ['resumo', 'executivo', 'simples'],
    useCase: 'Ideal para apresentações executivas e decisões rápidas',
    preview: 'Data | Saldo | Juros | Impacto FX | Taxa Média'
  }
];
