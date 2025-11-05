
// Arquivo: src/plugins/loan/loan-calculator.ts

import type { InterestConfig } from './loan-types';

/**
 * Funções puras para cálculos financeiros relacionados a empréstimos.
 * Esta classe não possui estado e serve como uma biblioteca de utilitários.
 */
export class LoanCalculator {

  /**
   * Arredonda um número para um número especificado de casas decimais.
   * @param value O número a ser arredondado.
   * @param decimals O número de casas decimais.
   * @returns O número arredondado.
   */
  public static round(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }

  /**
   * Calcula o número de dias entre duas datas com base em uma convenção.
   * @param startDate Data inicial no formato 'YYYY-MM-DD'.
   * @param endDate Data final no formato 'YYYY-MM-DD'.
   * @param dayCountBasis A convenção de contagem de dias.
   * @returns O número de dias.
   */
  public static getDaysBetween(startDate: string, endDate: string, dayCountBasis: InterestConfig['dayCountBasis']): number {
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Data inválida fornecida.');
    }

    switch (dayCountBasis) {
      case '30/360': {
        const d1 = start.getUTCDate();
        const m1 = start.getUTCMonth() + 1;
        const y1 = start.getUTCFullYear();
        const d2 = end.getUTCDate();
        const m2 = end.getUTCMonth() + 1;
        const y2 = end.getUTCFullYear();
        return (y2 - y1) * 360 + (m2 - m1) * 30 + (d2 - d1);
      }
      case 'ACT/360': {
        const diffTime = Math.abs(end.getTime() - start.getTime());
        return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
      }
      case 'ACT/365': {
        const diffTime = Math.abs(end.getTime() - start.getTime());
        return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
      }
      // 'BUS/252' é mais complexo e pode exigir um calendário de feriados.
      // Esta é uma simplificação.
      case 'BUS/252': {
         let count = 0;
         const curDate = new Date(start.getTime());
         while (curDate <= end) {
             const dayOfWeek = curDate.getUTCDay();
             if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                 count++;
             }
             curDate.setUTCDate(curDate.getUTCDate() + 1);
         }
         return count;
      }
      default:
        throw new Error(`Convenção de contagem de dias desconhecida: ${dayCountBasis}`);
    }
  }

  /**
   * Converte uma taxa de juros anual para uma taxa periódica, considerando a capitalização.
   * @param annualRate A taxa de juros anual (ex: 10.5 para 10.5%).
   * @param compounding O tipo de capitalização ('EXPONENCIAL' ou 'LINEAR').
   * @param dayCountBasis A convenção de contagem de dias.
   * @param daysInPeriod O número de dias no período.
   * @returns A taxa de juros periódica como um decimal (ex: 0.01 para 1%).
   */
  public static calculatePeriodicRate(annualRate: number, compounding: 'EXPONENCIAL' | 'LINEAR', dayCountBasis: InterestConfig['dayCountBasis'], daysInPeriod: number): number {
    const yearlyDivisor = this.getYearlyDivisor(dayCountBasis);
    const annualRateDecimal = annualRate / 100;

    if (compounding === 'EXPONENCIAL') {
      // (1 + i_anual)^(dias_periodo / dias_ano) - 1
      return Math.pow(1 + annualRateDecimal, daysInPeriod / yearlyDivisor) - 1;
    } else { // LINEAR
      // i_anual * (dias_periodo / dias_ano)
      return annualRateDecimal * (daysInPeriod / yearlyDivisor);
    }
  }

  /**
   * Retorna o divisor anual com base na convenção de contagem de dias.
   * @param dayCountBasis A convenção.
   * @returns O número de dias no ano para a convenção.
   */
  private static getYearlyDivisor(dayCountBasis: InterestConfig['dayCountBasis']): number {
    switch (dayCountBasis) {
      case '30/360':
      case 'ACT/360':
        return 360;
      case 'ACT/365':
        return 365;
      case 'BUS/252':
        return 252;
      default:
        return 360;
    }
  }

  /**
   * Calcula o valor da parcela para um financiamento (Tabela PRICE).
   * @param principal O valor principal do empréstimo.
   * @param periodicRate A taxa de juros periódica (ex: 0.01 para 1%).
   * @param installments O número de parcelas.
   * @returns O valor da parcela.
   */
  public static calculatePMT(principal: number, periodicRate: number, installments: number): number {
    if (periodicRate === 0) {
      return principal / installments;
    }
    const factor = Math.pow(1 + periodicRate, installments);
    return principal * (periodicRate * factor) / (factor - 1);
  }

  /**
   * Calcula o componente de juros de uma parcela específica (Tabela PRICE).
   * @param principal O valor principal.
   * @param periodicRate A taxa de juros periódica.
   * @param periodNumber O número da parcela (1-indexed).
   * @param installments O número total de parcelas.
   * @returns O valor dos juros na parcela.
   */
  public static calculateIPMT(principal: number, periodicRate: number, periodNumber: number, installments: number): number {
      const pmt = this.calculatePMT(principal, periodicRate, installments);
      let balance = principal;
      for (let i = 1; i < periodNumber; i++) {
          const interest = balance * periodicRate;
          const amortization = pmt - interest;
          balance -= amortization;
      }
      return balance * periodicRate;
  }

  /**
   * Calcula o componente de amortização de uma parcela específica (Tabela PRICE).
   * @param principal O valor principal.
   * @param periodicRate A taxa de juros periódica.
   * @param periodNumber O número da parcela (1-indexed).
   * @param installments O número total de parcelas.
   * @returns O valor da amortização na parcela.
   */
  public static calculatePPMT(principal: number, periodicRate: number, periodNumber: number, installments: number): number {
      const pmt = this.calculatePMT(principal, periodicRate, installments);
      const ipmt = this.calculateIPMT(principal, periodicRate, periodNumber, installments);
      return pmt - ipmt;
  }
}
