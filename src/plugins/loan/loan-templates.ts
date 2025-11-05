
// Arquivo: src/plugins/loan/loan-templates.ts

import { InterestTemplate } from './loan-types';

/**
 * Coleção de templates de taxa de juros para simplificar a criação de contratos.
 * Cada template pré-configura as "pernas" de juros para cenários comuns de mercado.
 */
export const INTEREST_TEMPLATES: Record<string, InterestTemplate> = {
  /**
   * Template para taxas pós-fixadas baseadas no CDI mais um spread.
   * Exemplo: 110% do CDI + 2.5% ao ano.
   */
  CDI_PLUS: {
    name: 'CDI + Spread',
    description: 'Taxa do CDI + spread fixo (ex: 110% CDI + 2.5% a.a.)',
    legs: [
      { indexer: 'CDI', indexerPercent: 100, spreadAnnual: 2.5, role: 'RATE' }
    ]
  },

  /**
   * Template para contratos atrelados à variação cambial (PTAX) mais um spread.
   * Comum em empréstimos de moeda estrangeira.
   * Exemplo: Variação PTAX do Dólar + 3.0% ao ano.
   */
  PTAX_PLUS: {
    name: 'Variação PTAX + Spread',
    description: 'Variação cambial + spread (ex: PTAX USD + 3% a.a.)',
    legs: [
      { indexer: 'PTAX', indexerPercent: 100, spreadAnnual: 3.0, ptaxCurrency: 'USD', role: 'RATE' }
    ]
  },

  /**
   * Template para taxas de juros fixas (pré-determinadas).
   * Exemplo: 8.5% ao ano.
   */
  FIXED: {
    name: 'Taxa Fixa',
    description: 'Taxa fixa pré-determinada (ex: 8.5% a.a.)',
    legs: [
      { indexer: 'FIXED', indexerPercent: 100, spreadAnnual: 8.5, role: 'RATE' }
    ]
  },

  /**
   * Template composto que combina CDI e variação cambial (PTAX).
   * Usado em operações estruturadas.
   * Exemplo: 100% do CDI + 1.5% a.a. E 100% da PTAX do Dólar + 1.0% a.a.
   */
  CDI_PTAX: {
    name: 'CDI + PTAX (Duas Pernas)',
    description: 'Composto: CDI + Variação PTAX + spreads',
    legs: [
      { indexer: 'CDI', indexerPercent: 100, spreadAnnual: 1.5, role: 'RATE' },
      { indexer: 'PTAX', indexerPercent: 100, spreadAnnual: 1.0, ptaxCurrency: 'USD', role: 'ADJUSTMENT' }
    ]
  },

  /**
   * Template vazio para configuração manual completa das pernas de juros.
   * Oferece máxima flexibilidade.
   */
  CUSTOM: {
    name: 'Personalizado',
    description: 'Configure manualmente as pernas de taxa',
    legs: []
  }
};
