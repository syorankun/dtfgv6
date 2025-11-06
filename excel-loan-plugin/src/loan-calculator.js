/**
 * LoanCalculator - Calculadora Financeira para Empréstimos
 *
 * Versão adaptada para Excel do LoanCalculator do DJ DataForge v6
 * Fornece funções puras para cálculos financeiros.
 */

class LoanCalculator {
  /**
   * Arredonda um número para um número especificado de casas decimais.
   * @param {number} value - O número a ser arredondado
   * @param {number} decimals - O número de casas decimais
   * @returns {number} O número arredondado
   */
  static round(value, decimals) {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }

  /**
   * Calcula o número de dias entre duas datas com base em uma convenção.
   * @param {string} startDate - Data inicial no formato 'YYYY-MM-DD'
   * @param {string} endDate - Data final no formato 'YYYY-MM-DD'
   * @param {string} dayCountBasis - A convenção de contagem de dias ('30/360', 'ACT/365', 'ACT/360', 'BUS/252')
   * @returns {number} O número de dias
   */
  static getDaysBetween(startDate, endDate, dayCountBasis) {
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
      case 'ACT/360':
      case 'ACT/365': {
        const diffTime = Math.abs(end.getTime() - start.getTime());
        return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
      }
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
   * Retorna o divisor anual com base na convenção de contagem de dias.
   * @param {string} dayCountBasis - A convenção
   * @returns {number} O número de dias no ano para a convenção
   */
  static getYearlyDivisor(dayCountBasis) {
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
   * Converte uma taxa de juros anual para uma taxa periódica, considerando a capitalização.
   * @param {number} annualRate - A taxa de juros anual (ex: 10.5 para 10.5%)
   * @param {string} compounding - O tipo de capitalização ('EXPONENCIAL' ou 'LINEAR')
   * @param {string} dayCountBasis - A convenção de contagem de dias
   * @param {number} daysInPeriod - O número de dias no período
   * @returns {number} A taxa de juros periódica como um decimal (ex: 0.01 para 1%)
   */
  static calculatePeriodicRate(annualRate, compounding, dayCountBasis, daysInPeriod) {
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
   * Calcula o valor da parcela para um financiamento (Tabela PRICE).
   * @param {number} principal - O valor principal do empréstimo
   * @param {number} periodicRate - A taxa de juros periódica (ex: 0.01 para 1%)
   * @param {number} installments - O número de parcelas
   * @returns {number} O valor da parcela
   */
  static calculatePMT(principal, periodicRate, installments) {
    if (periodicRate === 0) {
      return principal / installments;
    }
    const factor = Math.pow(1 + periodicRate, installments);
    return principal * (periodicRate * factor) / (factor - 1);
  }

  /**
   * Calcula o componente de juros de uma parcela específica (Tabela PRICE).
   * @param {number} principal - O valor principal
   * @param {number} periodicRate - A taxa de juros periódica
   * @param {number} periodNumber - O número da parcela (1-indexed)
   * @param {number} installments - O número total de parcelas
   * @returns {number} O valor dos juros na parcela
   */
  static calculateIPMT(principal, periodicRate, periodNumber, installments) {
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
   * @param {number} principal - O valor principal
   * @param {number} periodicRate - A taxa de juros periódica
   * @param {number} periodNumber - O número da parcela (1-indexed)
   * @param {number} installments - O número total de parcelas
   * @returns {number} O valor da amortização na parcela
   */
  static calculatePPMT(principal, periodicRate, periodNumber, installments) {
    const pmt = this.calculatePMT(principal, periodicRate, installments);
    const ipmt = this.calculateIPMT(principal, periodicRate, periodNumber, installments);
    return pmt - ipmt;
  }

  /**
   * Gera cronograma de pagamentos PRICE (parcela fixa).
   * @param {number} principal - Valor principal
   * @param {number} periodicRate - Taxa periódica
   * @param {number} installments - Número de parcelas
   * @param {string} startDate - Data inicial (YYYY-MM-DD)
   * @param {string} periodicity - Periodicidade ('MENSAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL')
   * @returns {Array} Array de objetos com cronograma
   */
  static generatePRICESchedule(principal, periodicRate, installments, startDate, periodicity = 'MENSAL') {
    const schedule = [];
    const pmt = this.calculatePMT(principal, periodicRate, installments);
    let balance = principal;

    for (let i = 1; i <= installments; i++) {
      const interest = this.round(balance * periodicRate, 2);
      const principalAmount = this.round(pmt - interest, 2);
      const closingBalance = this.round(balance - principalAmount, 2);
      const paymentDate = this.addPeriod(startDate, i, periodicity);

      schedule.push({
        installmentNumber: i,
        paymentDate,
        openingBalance: balance,
        paymentAmount: pmt,
        interestComponent: interest,
        principalComponent: principalAmount,
        closingBalance: Math.max(0, closingBalance)
      });

      balance = closingBalance;
    }

    return schedule;
  }

  /**
   * Gera cronograma de pagamentos SAC (amortização constante).
   * @param {number} principal - Valor principal
   * @param {number} periodicRate - Taxa periódica
   * @param {number} installments - Número de parcelas
   * @param {string} startDate - Data inicial (YYYY-MM-DD)
   * @param {string} periodicity - Periodicidade ('MENSAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL')
   * @returns {Array} Array de objetos com cronograma
   */
  static generateSACSchedule(principal, periodicRate, installments, startDate, periodicity = 'MENSAL') {
    const schedule = [];
    const principalInstallment = this.round(principal / installments, 2);
    let balance = principal;

    for (let i = 1; i <= installments; i++) {
      const interest = this.round(balance * periodicRate, 2);
      const pmt = principalInstallment + interest;
      const closingBalance = this.round(balance - principalInstallment, 2);
      const paymentDate = this.addPeriod(startDate, i, periodicity);

      schedule.push({
        installmentNumber: i,
        paymentDate,
        openingBalance: balance,
        paymentAmount: pmt,
        interestComponent: interest,
        principalComponent: principalInstallment,
        closingBalance: Math.max(0, closingBalance)
      });

      balance = closingBalance;
    }

    return schedule;
  }

  /**
   * Adiciona um número de períodos a uma data.
   * @param {string} startDate - Data inicial (YYYY-MM-DD)
   * @param {number} count - Número de períodos
   * @param {string} periodicity - Periodicidade
   * @returns {string} Data resultante (YYYY-MM-DD)
   */
  static addPeriod(startDate, count, periodicity) {
    const date = new Date(startDate + 'T00:00:00');

    switch (periodicity) {
      case 'MENSAL':
        date.setUTCMonth(date.getUTCMonth() + count);
        break;
      case 'TRIMESTRAL':
        date.setUTCMonth(date.getUTCMonth() + count * 3);
        break;
      case 'SEMESTRAL':
        date.setUTCMonth(date.getUTCMonth() + count * 6);
        break;
      case 'ANUAL':
        date.setUTCFullYear(date.getUTCFullYear() + count);
        break;
    }

    return date.toISOString().split('T')[0];
  }

  /**
   * Calcula juros acumulados simples.
   * @param {number} principal - Valor principal
   * @param {number} annualRate - Taxa anual (%)
   * @param {number} days - Número de dias
   * @param {string} dayCountBasis - Convenção de dias
   * @returns {number} Juros acumulados
   */
  static calculateSimpleInterest(principal, annualRate, days, dayCountBasis = 'ACT/365') {
    const yearlyDivisor = this.getYearlyDivisor(dayCountBasis);
    const rateDecimal = annualRate / 100;
    return principal * rateDecimal * (days / yearlyDivisor);
  }

  /**
   * Calcula juros compostos.
   * @param {number} principal - Valor principal
   * @param {number} annualRate - Taxa anual (%)
   * @param {number} days - Número de dias
   * @param {string} dayCountBasis - Convenção de dias
   * @returns {number} Juros acumulados
   */
  static calculateCompoundInterest(principal, annualRate, days, dayCountBasis = 'ACT/365') {
    const yearlyDivisor = this.getYearlyDivisor(dayCountBasis);
    const rateDecimal = annualRate / 100;
    return principal * (Math.pow(1 + rateDecimal, days / yearlyDivisor) - 1);
  }
}

// Exporta para uso em outros módulos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LoanCalculator;
}
