
// Arquivo: src/plugins/loan/loan-sheets.ts

import type { CellFormat, PluginContext } from '@core/types';
import type { Workbook, Sheet } from '@core/workbook-consolidated';
import { LoanCalculator } from './loan-calculator';
import type { LoanContract } from './loan-types';
import type { LoanLedgerEntry } from './loan-payment-manager';
import type { AccrualRow, ScheduleRow } from './loan-scheduler';
import {
  DEFAULT_ACCRUAL_VIEW,
  type AccrualSheetOptions,
  type AccrualSheetColumnDescriptor,
  resolveAccrualValue
} from './loan-accrual-view';

const SECTION_HEADER_FORMAT: CellFormat = {
  bold: true,
  bgColor: '#0F172A',
  textColor: '#F8FAFC',
  alignment: 'center'
};

const COLUMN_HEADER_FORMAT: CellFormat = {
  bold: true,
  bgColor: '#1E293B',
  textColor: '#F8FAFC',
  alignment: 'center'
};

const METADATA_FORMAT: CellFormat = {
  bgColor: '#E2E8F0',
  textColor: '#0F172A',
  alignment: 'left'
};

const SUMMARY_LABEL_FORMAT: CellFormat = {
  bold: true,
  bgColor: '#E2E8F0',
  textColor: '#0F172A',
  alignment: 'left'
};

const SUMMARY_VALUE_BASE_FORMAT: CellFormat = {
  bold: true,
  bgColor: '#F1F5F9',
  textColor: '#0F172A'
};

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
  public createAccrualSheet(
    contractId: string,
    period: string,
    rows: AccrualRow[],
    options?: AccrualSheetOptions
  ): void {
    if (!this.context?.kernel?.workbookManager) return;

    const workbook = this.ensureWorkbook();
    const safePeriod = period.replace(/[^0-9A-Za-z_]/g, '_');
    const sheetName = `_Loan_Accrual_${contractId}_${safePeriod}`;
    const sheet = this.findOrCreateSheet(workbook, sheetName, true);

    this.clearSheet(sheet);

    const view = options?.view ?? DEFAULT_ACCRUAL_VIEW;
    const includeSummary = options?.includeSummary ?? true;

    const metadataMap = new Map<string, string>();
    metadataMap.set('Contrato', contractId);
    metadataMap.set('Período', period.replace('_', ' → '));
    (options?.metadata || []).forEach(entry => {
      if (entry.value) {
        metadataMap.set(entry.label, entry.value);
      }
    });

    const columns = view.sections.flatMap(section =>
      section.columns.map((descriptor, index) => ({
        sectionTitle: section.title,
        descriptor,
        sectionColumnIndex: index
      }))
    );

    const getDefaultAlignment = (descriptor: AccrualSheetColumnDescriptor): CellFormat['alignment'] => {
      if (descriptor.format?.alignment) {
        return descriptor.format.alignment;
      }
      switch (descriptor.type) {
        case 'number':
          return 'right';
        case 'date':
          return 'center';
        default:
          return 'left';
      }
    };

    const buildDataFormat = (descriptor: AccrualSheetColumnDescriptor): CellFormat => ({
      alignment: getDefaultAlignment(descriptor),
      ...(descriptor.format || {})
    });

    const buildSummaryFormat = (descriptor: AccrualSheetColumnDescriptor): CellFormat => ({
      alignment: descriptor.summaryFormat?.alignment || getDefaultAlignment(descriptor),
      ...(descriptor.summaryFormat || descriptor.format || {})
    });

    const formatCellValue = (
      rawValue: any,
      descriptor: AccrualSheetColumnDescriptor
    ): { value: any; type: 'number' | 'string' | 'date' } => {
      if (descriptor.type === 'number') {
        if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
          const decimals = descriptor.decimals ?? 2;
          return {
            value: LoanCalculator.round(rawValue, decimals),
            type: 'number'
          };
        }
        return { value: '', type: 'number' };
      }

      if (descriptor.type === 'date') {
        if (typeof rawValue === 'string') {
          return { value: rawValue, type: 'date' };
        }
        if (rawValue instanceof Date) {
          return { value: rawValue.toISOString().split('T')[0], type: 'date' };
        }
        return { value: '', type: 'date' };
      }

      return { value: rawValue ?? '', type: 'string' };
    };

    let rowIndex = 0;

    const title = view.title || 'Accrual';
    sheet.setCell(rowIndex, 0, title, { type: 'string', format: { bold: true } });
    rowIndex += 1;

    const metadataEntries = Array.from(metadataMap.entries());
    if (metadataEntries.length) {
      metadataEntries.forEach(([label, value], colIndex) => {
        sheet.setCell(rowIndex, colIndex, `${label}: ${value}`, {
          type: 'string',
          format: METADATA_FORMAT
        });
      });
      rowIndex += 1;
    }

    const sectionRow = rowIndex;
    const headerRow = sectionRow + 1;
    const dataStartRow = sectionRow + 2;

    columns.forEach(({ sectionTitle, descriptor, sectionColumnIndex }, colIndex) => {
      const sectionLabel = sectionColumnIndex === 0 ? sectionTitle : '';
      sheet.setCell(sectionRow, colIndex, sectionLabel, {
        type: 'string',
        format: SECTION_HEADER_FORMAT
      });

      sheet.setCell(headerRow, colIndex, descriptor.label, {
        type: 'string',
        format: COLUMN_HEADER_FORMAT
      });

      if (descriptor.width) {
        const column = sheet.getColumn(colIndex);
        if (column) {
          column.width = descriptor.width;
        }
      }
    });

    rows.forEach((row, rowOffset) => {
      const targetRow = dataStartRow + rowOffset;
      columns.forEach(({ descriptor }, colIndex) => {
        const rawValue = resolveAccrualValue(row, descriptor);
        const { value, type } = formatCellValue(rawValue, descriptor);
        sheet.setCell(targetRow, colIndex, value, {
          type,
          format: buildDataFormat(descriptor)
        });
      });
    });

    if (includeSummary && rows.length) {
      const summaryRowIndex = dataStartRow + rows.length;

      columns.forEach(({ descriptor }, colIndex) => {
        if (colIndex === 0) {
          sheet.setCell(summaryRowIndex, colIndex, view.summaryLabel || 'Totais', {
            type: 'string',
            format: SUMMARY_LABEL_FORMAT
          });
          return;
        }

        let summaryRaw: number | string | null | undefined;

        switch (descriptor.summary) {
          case 'sum': {
            let sum = 0;
            let count = 0;
            rows.forEach(row => {
              const raw = resolveAccrualValue(row, descriptor);
              if (typeof raw === 'number' && Number.isFinite(raw)) {
                sum += raw;
                count += 1;
              }
            });
            summaryRaw = count > 0 ? sum : undefined;
            break;
          }
          case 'avg': {
            const values: number[] = [];
            rows.forEach(row => {
              const raw = resolveAccrualValue(row, descriptor);
              if (typeof raw === 'number' && Number.isFinite(raw)) {
                values.push(raw);
              }
            });
            if (values.length) {
              summaryRaw = values.reduce((acc, value) => acc + value, 0) / values.length;
            }
            break;
          }
          case 'last': {
            summaryRaw = resolveAccrualValue(rows[rows.length - 1], descriptor);
            break;
          }
          default:
            summaryRaw = undefined;
        }

        const { value, type } = formatCellValue(summaryRaw, descriptor);
        const summaryFormat = {
          ...SUMMARY_VALUE_BASE_FORMAT,
          ...buildSummaryFormat(descriptor)
        };

        sheet.setCell(summaryRowIndex, colIndex, value, {
          type,
          format: summaryFormat
        });
      });
    }
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
