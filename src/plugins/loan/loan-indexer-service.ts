import { LoanCalculator } from './loan-calculator';
import type { LoanFXIntegration, FXRateResult } from './loan-fx-integration';
import type { LoanContract, InterestConfig, InterestLeg } from './loan-types';
import { logger } from '@core/storage-utils-consolidated';

/**
 * Serviço responsável por calcular o componente efetivo das pernas de juros
 * considerando o indexador configurado para cada perna.
 */
export class LoanIndexerService {
  private fxIntegration: LoanFXIntegration;

  constructor(fxIntegration: LoanFXIntegration) {
    this.fxIntegration = fxIntegration;
  }

  /**
   * Calcula a taxa efetiva (já aplicada ao período) de uma perna específica.
   */
  public async calculateLegEffectiveRate(
    contract: LoanContract,
    leg: InterestLeg,
    startDate: string,
    endDate: string,
    days: number,
    defaultDayCount: InterestConfig['dayCountBasis'],
    compounding: InterestConfig['compounding']
  ): Promise<number> {
    const dayCount = leg.dayCountBasis || defaultDayCount;
    const indexerFactor = (leg.indexerPercent ?? 100) / 100;

    let indexerEffective = 0;
    try {
      if (leg.indexer === 'PTAX') {
        indexerEffective = await this.computePTAXVariation(contract, leg, startDate, endDate);
      } else if (leg.indexer === 'FIXED') {
        // Para taxa FIXED, o spreadAnnual É a taxa fixa total
        // O indexerEffective fica 0 e o spread será calculado separadamente
        indexerEffective = 0;
      } else if (leg.indexer === 'MANUAL') {
        // Para MANUAL, usa baseRateAnnual se fornecido, senão usa spreadAnnual
        const baseAnnual = leg.baseRateAnnual ?? leg.spreadAnnual;
        if (baseAnnual > 0) {
          indexerEffective = LoanCalculator.calculatePeriodicRate(baseAnnual, compounding, dayCount, days);
        }
      } else {
        // Para CDI e outros indexadores, EXIGE baseRateAnnual
        const baseAnnual = leg.baseRateAnnual;
        if (baseAnnual == null || baseAnnual === 0) {
          logger.warn(`[LoanIndexerService] baseRateAnnual não fornecido para indexador ${leg.indexer}. Taxa será 0.`, { leg });
        } else {
          indexerEffective = LoanCalculator.calculatePeriodicRate(baseAnnual, compounding, dayCount, days);
        }
      }
    } catch (error) {
      logger.warn('[LoanIndexerService] Falha ao calcular indexador da perna', { leg, error });
      indexerEffective = 0;
    }

    const spreadEffective = LoanCalculator.calculatePeriodicRate(
      leg.spreadAnnual,
      compounding,
      dayCount,
      days
    );

    const scaledIndexer = indexerEffective * indexerFactor;
    return (1 + scaledIndexer) * (1 + spreadEffective) - 1;
  }

  private async computePTAXVariation(
    contract: LoanContract,
    leg: InterestLeg,
    startDate: string,
    endDate: string
  ): Promise<number> {
    const currency = leg.ptaxCurrency || contract.currency;
    const startRate = await this.resolveFxRate(currency, startDate, contract.contractFXRate);
    const endRate = await this.resolveFxRate(currency, endDate, contract.contractFXRate);

    if (startRate && endRate && startRate.rate > 0) {
      return endRate.rate / startRate.rate - 1;
    }

    return 0;
  }

  private async resolveFxRate(
    currency: string,
    date: string,
    contractFallback?: number
  ): Promise<FXRateResult | null> {
    const info = await this.fxIntegration.getConversionRate(date, currency, contractFallback);
    if (info) {
      return info;
    }

    const last = await this.fxIntegration.getLastAvailableRate(currency);
    if (last) {
      return last;
    }

    if (currency === 'BRL' && contractFallback) {
      return { rate: contractFallback, source: 'Contrato' };
    }

    return currency === 'BRL' ? { rate: 1, source: 'BRL' } : null;
  }
}
