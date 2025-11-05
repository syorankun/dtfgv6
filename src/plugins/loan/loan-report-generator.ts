/**
 * Loan Report Generator - Gerador de relatórios consolidados
 *
 * Gera relatórios baseados em templates:
 * - Processa múltiplos contratos
 * - Consolida dados de accrual
 * - Cria planilhas e/ou tabelas pivot
 * - Adiciona gráficos opcionais
 * - Agrupa por critérios
 */

import type { PluginContext } from '@core/types';
import type { LoanContract } from './loan-types';
import type { AccrualRow } from './loan-scheduler';
import type { LoanScheduler } from './loan-scheduler';
import type { AccrualSheetViewConfig, AccrualSheetOptions } from './loan-accrual-view';
import { resolveAccrualValue } from './loan-accrual-view';
import { REPORT_TEMPLATES } from './loan-report-templates';
import { logger } from '@core/storage-utils-consolidated';
import { LoanSheets } from './loan-sheets';
import { LoanAccrualPaymentEnricher } from './loan-accrual-payment-view';
import type { LoanPaymentManager } from './loan-payment-manager';

export interface ReportGenerationRequest {
  templateId: string;
  contracts: LoanContract[];
  startDate: string;
  endDate: string;
  frequency: 'Diário' | 'Mensal' | 'Anual';
  outputMode: 'sheet' | 'pivot' | 'both';
  includeCharts: boolean;
  groupBy?: 'none' | 'currency' | 'type' | 'counterparty';
  includePayments?: boolean; // Nova opção para incluir dados de pagamentos
}

export interface GeneratedReport {
  reportId: string;
  templateId: string;
  contractIds: string[];
  generatedAt: string;
  sheetNames: string[];
  pivotSourceIds: string[];
}

export class LoanReportGenerator {
  private context: PluginContext;
  private scheduler: LoanScheduler;
  private sheets: LoanSheets;
  private paymentManager?: LoanPaymentManager;

  constructor(context: PluginContext, scheduler: LoanScheduler, sheets: LoanSheets, paymentManager?: LoanPaymentManager) {
    this.context = context;
    this.scheduler = scheduler;
    this.sheets = sheets;
    this.paymentManager = paymentManager;
  }

  /**
   * Gera relatório baseado na requisição
   */
  public async generate(request: ReportGenerationRequest): Promise<GeneratedReport> {
    logger.info('[LoanReportGenerator] Gerando relatório', request);

    const template = REPORT_TEMPLATES[request.templateId as keyof typeof REPORT_TEMPLATES];
    if (!template) {
      throw new Error(`Template ${request.templateId} não encontrado`);
    }

    const reportId = `REPORT-${Date.now()}`;
    const result: GeneratedReport = {
      reportId,
      templateId: request.templateId,
      contractIds: request.contracts.map(c => c.id),
      generatedAt: new Date().toISOString(),
      sheetNames: [],
      pivotSourceIds: []
    };

    // Agrupa contratos se necessário
    const groups = this.groupContracts(request.contracts, request.groupBy);

    // Processa cada grupo
    for (const [groupName, contracts] of Object.entries(groups)) {
      await this.processGroup(
        groupName,
        contracts,
        request,
        template,
        result
      );
    }

    logger.info('[LoanReportGenerator] Relatório gerado', result);
    this.context.ui.showToast(`✅ Relatório gerado com ${result.sheetNames.length} planilhas`, 'success');

    return result;
  }

  /**
   * Agrupa contratos por critério
   */
  private groupContracts(
    contracts: LoanContract[],
    groupBy?: 'none' | 'currency' | 'type' | 'counterparty'
  ): Record<string, LoanContract[]> {
    if (!groupBy || groupBy === 'none') {
      return { 'Todos': contracts };
    }

    const groups: Record<string, LoanContract[]> = {};

    contracts.forEach(contract => {
      let groupKey: string;

      switch (groupBy) {
        case 'currency':
          groupKey = contract.currency;
          break;
        case 'type':
          groupKey = contract.contractType;
          break;
        case 'counterparty':
          groupKey = contract.counterparty;
          break;
        default:
          groupKey = 'Todos';
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(contract);
    });

    return groups;
  }

  /**
   * Processa um grupo de contratos
   */
  private async processGroup(
    groupName: string,
    contracts: LoanContract[],
    request: ReportGenerationRequest,
    template: AccrualSheetViewConfig,
    result: GeneratedReport
  ): Promise<void> {
    logger.info(`[LoanReportGenerator] Processando grupo "${groupName}" com ${contracts.length} contratos`);

    // Coleta dados de accrual de todos os contratos
    const allAccrualRows: AccrualRow[] = [];
    const contractMetadata: Record<string, any> = {};

    for (const contract of contracts) {
      try {
        const rows = await this.scheduler.buildAccrualRows(
          contract,
          request.startDate,
          request.endDate,
          request.frequency,
          false // showVariation
        );

        // Enriquece com pagamentos se for o template de pagamentos e houver paymentManager
        let enrichedRows: AccrualRow[] = rows;
        if (request.templateId === 'payment-accrual-view' && this.paymentManager) {
          logger.info(`[LoanReportGenerator] Enriquecendo com pagamentos para contrato ${contract.id}`);
          const ledgerEntries = this.paymentManager.getLedger(contract.id);
          logger.info(`[LoanReportGenerator] Ledger entries encontrados: ${ledgerEntries.length}`);
          
          if (ledgerEntries.length > 0) {
            const enrichedWithPayments = LoanAccrualPaymentEnricher.enrichWithPayments(
              rows,
              ledgerEntries,
              contract.currency
            );
            
            logger.info(`[LoanReportGenerator] Dados enriquecidos. Exemplo primeira linha:`, enrichedWithPayments[0]);
            
            // Converte AccrualRowWithPayments de volta para AccrualRow com campos extras
            enrichedRows = enrichedWithPayments.map(row => ({
              ...row,
              // Campos extras são preservados no spread
            })) as AccrualRow[];
          } else {
            logger.warn(`[LoanReportGenerator] Nenhum ledger entry encontrado para ${contract.id}`);
          }
        } else {
          if (request.templateId === 'payment-accrual-view') {
            logger.warn(`[LoanReportGenerator] PaymentManager não disponível para enriquecer dados`);
          }
        }

        // Adiciona metadados do contrato a cada linha
        const rowsWithMetadata = enrichedRows.map(row => ({
          ...row,
          contractId: contract.id,
          contractCurrency: contract.currency,
          contractType: contract.contractType,
          counterparty: contract.counterparty
        }));

        allAccrualRows.push(...rowsWithMetadata);

        contractMetadata[contract.id] = {
          counterparty: contract.counterparty,
          currency: contract.currency,
          type: contract.contractType,
          principalOrigin: contract.principalOrigin
        };
      } catch (error) {
        logger.error(`[LoanReportGenerator] Erro ao processar contrato ${contract.id}`, error);
        this.context.ui.showToast(`⚠️ Erro ao processar ${contract.id}`, 'warning');
      }
    }

    if (allAccrualRows.length === 0) {
      logger.warn(`[LoanReportGenerator] Nenhum dado gerado para grupo "${groupName}"`);
      return;
    }

    // Cria planilha se necessário
    if (request.outputMode === 'sheet' || request.outputMode === 'both') {
      const sheetName = await this.createReportSheet(
        groupName,
        allAccrualRows,
        template,
        request,
        contractMetadata
      );
      result.sheetNames.push(sheetName);
    }

    // Cria fonte de dados pivot se necessário
    if (request.outputMode === 'pivot' || request.outputMode === 'both') {
      const pivotSourceId = this.createPivotSource(
        groupName,
        allAccrualRows,
        template,
        request,
        contractMetadata
      );
      result.pivotSourceIds.push(pivotSourceId);
    }

    // Adiciona gráficos se solicitado
    if (request.includeCharts && result.sheetNames.length > 0) {
      await this.addCharts(result.sheetNames[result.sheetNames.length - 1], allAccrualRows);
    }
  }

  /**
   * Cria planilha de relatório
   */
  private async createReportSheet(
    groupName: string,
    rows: AccrualRow[],
    template: AccrualSheetViewConfig,
    request: ReportGenerationRequest,
    contractMetadata: Record<string, any>
  ): Promise<string> {
    const sheetName = `${template.title}_${groupName}_${request.startDate}`;
    const safeName = sheetName.replace(/[^0-9A-Za-z_\-]/g, '_').substring(0, 31);

    // Prepara metadados
    const metadata = [
      { label: 'Template', value: template.title || template.id },
      { label: 'Grupo', value: groupName },
      { label: 'Período', value: `${request.startDate} → ${request.endDate}` },
      { label: 'Frequência', value: request.frequency },
      { label: 'Contratos', value: Object.keys(contractMetadata).length.toString() },
      { label: 'Total Linhas', value: rows.length.toString() },
      { label: 'Gerado em', value: new Date().toLocaleString('pt-BR') }
    ];

    // Enriquecimento de metadados para o template de pagamentos
    if (request.templateId === 'payment-accrual-view') {
      metadata.push({ label: 'Modo de Cálculo', value: 'Accrual Recalculado com Pagamentos' });
      metadata.push({ label: 'FX BRL', value: 'PTAX (mark-to-market) nas datas dos pontos' });
      metadata.push({ label: 'Alocação Pagamentos', value: 'Juros primeiro, depois principal' });

      const hasPaymentData = rows.some(row => Object.prototype.hasOwnProperty.call(row, 'interestPaidBRL'));

      if (hasPaymentData) {
        const enrichedSummary = LoanAccrualPaymentEnricher.createPaymentSummary(rows as any);
        const contractCurrency = (rows[0] as any)?.contractCurrency || 'Moeda';

        const formatNumber = (value: number, digits: number): string => {
          if (!Number.isFinite(value)) {
            return (0).toLocaleString('pt-BR', {
              minimumFractionDigits: digits,
              maximumFractionDigits: digits
            });
          }
          return value.toLocaleString('pt-BR', {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits
          });
        };

        const formatPercent = (value: number | null): string => {
          if (value === null || !Number.isFinite(value)) {
            return 'N/A';
          }
          const percent = value * 100;
          return `${percent.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })}%`;
        };

        metadata.push(
          { label: 'Total Juros Pagos (BRL)', value: formatNumber(enrichedSummary.totalInterestPaidBRL, 2) },
          { label: `Total Juros Pagos (${contractCurrency})`, value: formatNumber(enrichedSummary.totalInterestPaidOrigin, 4) },
          { label: 'Total Principal Pago (BRL)', value: formatNumber(enrichedSummary.totalPrincipalPaidBRL, 2) },
          { label: `Total Principal Pago (${contractCurrency})`, value: formatNumber(enrichedSummary.totalPrincipalPaidOrigin, 4) },
          { label: 'Juros Descobertos (BRL)', value: formatNumber(enrichedSummary.totalInterestDeltaBRL, 2) },
          { label: `Juros Descobertos (${contractCurrency})`, value: formatNumber(enrichedSummary.totalInterestDeltaOrigin, 4) },
          { label: 'Cobertura Média Juros', value: `${formatPercent(enrichedSummary.avgInterestCoverage)} · Cob/Parc/SemPag/SemJuros: ${enrichedSummary.coverageStatus.covered}/${enrichedSummary.coverageStatus.partial}/${enrichedSummary.coverageStatus.missing}/${enrichedSummary.coverageStatus.noInterest}` },
          { label: 'Caixa x Accrual (BRL)', value: formatNumber(enrichedSummary.cashVsAccrualBRL, 2) },
          { label: `Caixa x Accrual (${contractCurrency})`, value: formatNumber(enrichedSummary.cashVsAccrualOrigin, 4) },
          { label: 'Saldo Final Recalculado (BRL)', value: formatNumber(enrichedSummary.finalBalanceBRL, 2) },
          { label: `Saldo Final Recalculado (${contractCurrency})`, value: formatNumber(enrichedSummary.finalBalanceOrigin, 4) },
          { label: 'Juros Pendentes (BRL)', value: formatNumber(enrichedSummary.finalInterestPendingBRL, 2) },
          { label: `Juros Pendentes (${contractCurrency})`, value: formatNumber(enrichedSummary.finalInterestPendingOrigin, 4) }
        );
      }
    }

    const options: AccrualSheetOptions = {
      view: template,
      includeSummary: true,
      metadata
    };

    // Usa o sistema existente de sheets
    this.sheets.createAccrualSheet(
      groupName,
      `${request.startDate}_${request.endDate}`,
      rows,
      options
    );

    logger.info(`[LoanReportGenerator] Planilha criada: ${safeName}`);
    return safeName;
  }

  /**
   * Cria fonte de dados para pivot
   */
  private createPivotSource(
    groupName: string,
    rows: AccrualRow[],
    template: AccrualSheetViewConfig,
    request: ReportGenerationRequest,
    contractMetadata: Record<string, any>
  ): string {
    const sourceId = `loan-report:${request.templateId}:${groupName}:${Date.now()}`;

    // Prepara colunas para o pivot
    const columnDescriptors = template.sections.flatMap(section => section.columns);

    type PivotColumn = { id: string; label: string; type: 'string' | 'number' | 'date' };

    const pivotColumns: PivotColumn[] = [
      { id: 'contractId', label: 'Contrato ID', type: 'string' },
      { id: 'contractCurrency', label: 'Moeda', type: 'string' },
      { id: 'contractType', label: 'Tipo', type: 'string' },
      { id: 'counterparty', label: 'Contraparte', type: 'string' },
      { id: 'periodStart', label: 'Início Período', type: 'date' },
      { id: 'periodEnd', label: 'Fim Período', type: 'date' }
    ];

    columnDescriptors.forEach((descriptor, index) => {
      const columnId = descriptor.pivotKey || descriptor.id || descriptor.field || `col_${index}`;
      pivotColumns.push({
        id: columnId,
        label: descriptor.label,
        type: descriptor.type
      });
    });

    // Prepara linhas de dados
    const datasetRows = rows.map(row => {
      const record: Record<string, any> = {
        contractId: (row as any).contractId || 'N/A',
        contractCurrency: (row as any).contractCurrency || 'N/A',
        contractType: (row as any).contractType || 'N/A',
        counterparty: (row as any).counterparty || 'N/A',
        periodStart: request.startDate,
        periodEnd: request.endDate
      };

      columnDescriptors.forEach((descriptor, index) => {
        const columnId = descriptor.pivotKey || descriptor.id || descriptor.field || `col_${index}`;
        record[columnId] = resolveAccrualValue(row, descriptor);
      });

      return record;
    });

    // Emite evento para registrar no pivot
    try {
      this.context.events.emit('pivot:registerSource', {
        sourceId,
        plugin: 'dj.finance.loans',
        columns: pivotColumns,
        rows: datasetRows,
        metadata: {
          templateId: request.templateId,
          templateName: template.title,
          groupName,
          startDate: request.startDate,
          endDate: request.endDate,
          frequency: request.frequency,
          contracts: Object.keys(contractMetadata).length,
          title: `${template.title} - ${groupName}`
        }
      });

      logger.info(`[LoanReportGenerator] Fonte pivot registrada: ${sourceId}`);
    } catch (error) {
      logger.error('[LoanReportGenerator] Erro ao registrar fonte pivot', error);
    }

    return sourceId;
  }

  /**
   * Adiciona gráficos à planilha (placeholder)
   */
  private async addCharts(sheetName: string, _rows: AccrualRow[]): Promise<void> {
    // TODO: Integrar com charts plugin se disponível
    logger.info(`[LoanReportGenerator] Gráficos serão adicionados para ${sheetName}`);

    try {
      // Emite evento para o charts plugin
      this.context.events.emit('charts:request', {
        sheetName,
        chartType: 'line',
        dataSource: 'loan-accrual',
        config: {
          title: 'Evolução de Juros e Principal',
          xAxis: 'date',
          yAxis: ['interestBRL', 'closingBalanceBRL']
        }
      });
    } catch (error) {
      logger.warn('[LoanReportGenerator] Charts plugin não disponível', error);
    }
  }

  /**
   * Gera relatórios comparativos entre múltiplos períodos
   */
  public async generateComparative(
    _contractIds: string[],
    _periods: Array<{ startDate: string; endDate: string; label: string }>,
    _templateId: string
  ): Promise<GeneratedReport> {
    logger.info('[LoanReportGenerator] Gerando relatório comparativo');

    // TODO: Implementar comparação entre períodos
    throw new Error('Relatório comparativo ainda não implementado');
  }

  /**
   * Exporta relatório para formato externo
   */
  public async export(reportId: string, format: 'xlsx' | 'csv' | 'pdf'): Promise<Blob> {
    logger.info(`[LoanReportGenerator] Exportando relatório ${reportId} para ${format}`);

    // TODO: Implementar exportação
    throw new Error('Exportação ainda não implementada');
  }
}
