
// Arquivo: src/plugins/loan/loan-sheets.ts

import type { PluginContext } from '@core/types';
import type { Workbook, Sheet } from '@core/workbook-consolidated';
import { LoanCalculator } from './loan-calculator';
import type { LoanContract } from './loan-types';
import type { LoanLedgerEntry } from './loan-payment-manager';
import type { AccrualRow, ScheduleRow } from './loan-scheduler';

/**
 * Gerencia a criação e atualização das planilhas utilizadas pelo Loan Plugin.
 */
export class LoanSheets {
  private context: PluginContext;

  constructor(context: PluginContext) {
    this.context = context;
  }

  /**
   * Atualiza (ou cria) a planilha principal de contratos.
   */
  public updateContractsSheet(contracts: LoanContract[]): void {
    if (!this.context?.kernel?.workbookManager) return;

    const workbook = this.ensureWorkbook();
    const sheet = this.findOrCreateSheet(workbook, 'Contratos');

    this.clearSheet(sheet);

    const headers = [
      'ID',
      'Tipo',
      'Contraparte',
      'Moeda',
      'Principal (Origem)',
      'Principal (BRL)',
      'Saldo Atual (BRL)',
      'Status',
      'Template Juros',
      'Início',
      'Vencimento',
      'Próximo Pagamento',
      'Valor Próximo Pagamento'
    ];

    headers.forEach((header, col) => {
      sheet.setCell(0, col, header, { type: 'string', format: { bold: true } });
    });

    contracts.forEach((contract, index) => {
      const row = index + 1;
      sheet.setCell(row, 0, contract.id, { type: 'string' });
      sheet.setCell(row, 1, contract.contractType, { type: 'string' });
      sheet.setCell(row, 2, contract.counterparty, { type: 'string' });
      sheet.setCell(row, 3, contract.currency, { type: 'string' });
      sheet.setCell(row, 4, LoanCalculator.round(contract.principalOrigin, 2), { type: 'number' });
      sheet.setCell(row, 5, LoanCalculator.round(contract.principalBRL, 2), { type: 'number' });
      sheet.setCell(row, 6, LoanCalculator.round(contract.currentBalance.balanceBRL, 2), { type: 'number' });
      sheet.setCell(row, 7, contract.status, { type: 'string' });
      sheet.setCell(row, 8, contract.interestConfig.template || 'CUSTOM', { type: 'string' });
      sheet.setCell(row, 9, contract.startDate, { type: 'date' });
      sheet.setCell(row, 10, contract.maturityDate, { type: 'date' });
      sheet.setCell(row, 11, contract.currentBalance.nextPaymentDate || '', { type: 'string' });
      sheet.setCell(row, 12, contract.currentBalance.nextPaymentAmount ?? '', { type: 'number' });
    });
  }

  /**
   * Atualiza o ledger (histórico) de um contrato.
   */
  public updateLedgerSheet(contractId: string, entries: LoanLedgerEntry[]): void {
    if (!this.context?.kernel?.workbookManager) return;

    const workbook = this.ensureWorkbook();
    const sheetName = `_Loan_Ledger_${contractId}`;
    const sheet = this.findOrCreateSheet(workbook, sheetName);

    this.clearSheet(sheet);

    const headers = [
      'Data',
      'Tipo',
      'Descrição',
      'Valor Origem',
      'Valor BRL',
      'Taxa FX',
      'Fonte FX',
      'Saldo Origem Pós',
      'Saldo BRL Pós'
    ];

    headers.forEach((header, col) => {
      sheet.setCell(0, col, header, { type: 'string', format: { bold: true } });
    });

    entries.forEach((entry, index) => {
      const row = index + 1;
      sheet.setCell(row, 0, entry.entryDate, { type: 'date' });
      sheet.setCell(row, 1, entry.type, { type: 'string' });
      sheet.setCell(row, 2, entry.description || '', { type: 'string' });
      sheet.setCell(row, 3, LoanCalculator.round(entry.amountOrigin, 2), { type: 'number' });
      sheet.setCell(row, 4, LoanCalculator.round(entry.amountBRL, 2), { type: 'number' });
      sheet.setCell(row, 5, LoanCalculator.round(entry.fxRate, 6), { type: 'number' });
      sheet.setCell(row, 6, entry.fxSource, { type: 'string' });
      sheet.setCell(row, 7, LoanCalculator.round(entry.balanceAfterOrigin, 2), { type: 'number' });
      sheet.setCell(row, 8, LoanCalculator.round(entry.balanceAfterBRL, 2), { type: 'number' });
    });
  }

  /**
   * Cria uma planilha dedicada para um cronograma de ACCRUAL.
   */
  public createAccrualSheet(contractId: string, period: string, rows: AccrualRow[]): void {
    if (!this.context?.kernel?.workbookManager) return;

    const workbook = this.ensureWorkbook();
    const safePeriod = period.replace(/[^0-9A-Za-z_]/g, '_');
    const sheetName = `_Loan_Accrual_${contractId}_${safePeriod}`;
    const sheet = this.findOrCreateSheet(workbook, sheetName, true);

    this.clearSheet(sheet);

    const headers = [
      'Data',
      'Dias',
      'Taxa Efetiva',
      // Moeda Origem
      'Saldo Inicial Origem',
      'Juros Origem',
      'Saldo Final Origem',
      // BRL usando Taxa do CONTRATO (fixada)
      'Saldo Inicial BRL (Contrato)',
      'Juros BRL (Contrato)',
      'Saldo Final BRL (Contrato)',
      'Taxa FX Contrato',
      // BRL usando Taxa PTAX BCB (mark-to-market)
      'Saldo Inicial BRL (PTAX)',
      'Juros BRL (PTAX)',
      'Saldo Final BRL (PTAX)',
      'Taxa FX PTAX',
      'Fonte PTAX',
      // Variação Cambial
      'Variação Cambial (BRL)',
      'Variação Cambial (%)'
    ];

    headers.forEach((header, col) => {
      sheet.setCell(0, col, header, { type: 'string', format: { bold: true } });
    });

    rows.forEach((row, index) => {
      const targetRow = index + 1;
      let col = 0;
      
      // Data, Dias, Taxa Efetiva
      sheet.setCell(targetRow, col++, row.date, { type: 'date' });
      sheet.setCell(targetRow, col++, row.days, { type: 'number' });
      sheet.setCell(targetRow, col++, LoanCalculator.round(row.effRate, 8), { type: 'number' });
      
      // Valores em Moeda Origem
      sheet.setCell(targetRow, col++, LoanCalculator.round(row.openingBalanceOrigin, 4), { type: 'number' });
      sheet.setCell(targetRow, col++, LoanCalculator.round(row.interestOrigin, 4), { type: 'number' });
      sheet.setCell(targetRow, col++, LoanCalculator.round(row.closingBalanceOrigin, 4), { type: 'number' });
      
      // Valores em BRL usando Taxa do CONTRATO (fixada)
      sheet.setCell(targetRow, col++, LoanCalculator.round(row.openingBalanceBRLContract, 2), { type: 'number' });
      sheet.setCell(targetRow, col++, LoanCalculator.round(row.interestBRLContract, 2), { type: 'number' });
      sheet.setCell(targetRow, col++, LoanCalculator.round(row.closingBalanceBRLContract, 2), { type: 'number' });
      sheet.setCell(targetRow, col++, LoanCalculator.round(row.fxRateContract, 6), { type: 'number' });
      
      // Valores em BRL usando Taxa PTAX do BCB (mark-to-market)
      sheet.setCell(targetRow, col++, LoanCalculator.round(row.openingBalanceBRLPTAX, 2), { type: 'number' });
      sheet.setCell(targetRow, col++, LoanCalculator.round(row.interestBRLPTAX, 2), { type: 'number' });
      sheet.setCell(targetRow, col++, LoanCalculator.round(row.closingBalanceBRLPTAX, 2), { type: 'number' });
      sheet.setCell(targetRow, col++, LoanCalculator.round(row.fxRatePTAX, 6), { type: 'number' });
      sheet.setCell(targetRow, col++, row.fxSourcePTAX || '', { type: 'string' });
      
      // Variação Cambial
      sheet.setCell(targetRow, col++, LoanCalculator.round(row.fxVariationBRL, 2), { type: 'number' });
      sheet.setCell(targetRow, col++, LoanCalculator.round(row.fxVariationPercent, 4), { type: 'number' });
    });
  }

  /**
   * Cria uma planilha dedicada para o cronograma de pagamentos.
   */
  public createScheduleSheet(contractId: string, rows: ScheduleRow[]): void {
    if (!this.context?.kernel?.workbookManager) return;

    const workbook = this.ensureWorkbook();
    const sheetName = `_Loan_Schedule_${contractId}`;
    const sheet = this.findOrCreateSheet(workbook, sheetName, true);

    this.clearSheet(sheet);

    const headers = [
      '# Parcela',
      'Data Pagamento',
      'Saldo Inicial',
      'Valor Parcela',
      'Juros',
      'Amortização',
      'Saldo Final',
      'Taxa Efetiva'
    ];

    headers.forEach((header, col) => {
      sheet.setCell(0, col, header, { type: 'string', format: { bold: true } });
    });

    rows.forEach((row, index) => {
      const targetRow = index + 1;
      sheet.setCell(targetRow, 0, row.installmentNumber, { type: 'number' });
      sheet.setCell(targetRow, 1, row.paymentDate, { type: 'date' });
      sheet.setCell(targetRow, 2, LoanCalculator.round(row.openingBalance, 2), { type: 'number' });
      sheet.setCell(targetRow, 3, LoanCalculator.round(row.paymentAmount, 2), { type: 'number' });
      sheet.setCell(targetRow, 4, LoanCalculator.round(row.interestComponent, 2), { type: 'number' });
      sheet.setCell(targetRow, 5, LoanCalculator.round(row.principalComponent, 2), { type: 'number' });
      sheet.setCell(targetRow, 6, LoanCalculator.round(row.closingBalance, 2), { type: 'number' });
      sheet.setCell(targetRow, 7, LoanCalculator.round(row.effRate, 8), { type: 'number' });
    });
  }

  private ensureWorkbook(): Workbook {
    const manager = this.context.kernel.workbookManager;
    let workbook = manager.getActiveWorkbook();
    if (!workbook) {
      workbook = manager.createWorkbook('Loan Portfolio');
      manager.setActiveWorkbook(workbook.id);
    }
    return workbook;
  }

  private findOrCreateSheet(workbook: Workbook, sheetName: string, resetId: boolean = false): Sheet {
    const existing = workbook.listSheets().find(sheet => sheet.name === sheetName);
    if (existing) {
      return existing;
    }
    const sheet = workbook.addSheet(sheetName);
    if (resetId) {
      // Ensure sheet name is correct even if platform auto-renamed
      sheet.name = sheetName;
    }
    return sheet;
  }

  private clearSheet(sheet: Sheet): void {
    const rows = sheet.rowCount || 0;
    const cols = sheet.colCount || 0;
    sheet.clearRange(0, 0, rows + 100, cols + 50);
  }
}
