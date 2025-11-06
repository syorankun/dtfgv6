/**
 * LoanManager - Gerenciador de Contratos de Empréstimo para Excel
 *
 * Versão adaptada do LoanPlugin do DJ DataForge v6
 * Gerencia contratos, pagamentos e geração de cronogramas no Excel.
 */

class LoanManager {
  constructor() {
    this.contracts = new Map();
    this.payments = new Map();
    this.CONTRACTS_SHEET = 'Contratos';
    this.LEDGER_PREFIX = 'Ledger_';
    this.SCHEDULE_PREFIX = 'Cronograma_';
    this.ACCRUAL_PREFIX = 'Accrual_';
  }

  /**
   * Gera um ID único para contrato
   */
  generateContractId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `LOAN-${timestamp}-${random}`;
  }

  /**
   * Cria um novo contrato de empréstimo
   */
  async createContract(contractData) {
    return Excel.run(async (context) => {
      try {
        const contract = {
          id: this.generateContractId(),
          contractType: contractData.contractType || 'CAPTADO',
          counterparty: contractData.counterparty,
          currency: contractData.currency || 'BRL',
          principalOrigin: contractData.principalOrigin,
          principalBRL: contractData.principalBRL || contractData.principalOrigin,
          contractFXRate: contractData.contractFXRate || 1,
          startDate: contractData.startDate,
          maturityDate: contractData.maturityDate,
          interestRate: contractData.interestRate, // Taxa anual (%)
          dayCountBasis: contractData.dayCountBasis || 'ACT/365',
          compounding: contractData.compounding || 'EXPONENCIAL',
          paymentSystem: contractData.paymentSystem || 'PRICE', // PRICE ou SAC
          periodicity: contractData.periodicity || 'MENSAL',
          installments: contractData.installments,
          status: 'ATIVO',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          currentBalance: {
            balanceBRL: contractData.principalBRL || contractData.principalOrigin,
            balanceOrigin: contractData.principalOrigin,
            lastUpdateDate: contractData.startDate
          }
        };

        // Armazena contrato
        this.contracts.set(contract.id, contract);

        // Cria/Atualiza sheet de contratos
        await this.updateContractsSheet(context);

        // Cria ledger inicial
        await this.createLedgerEntry(context, contract, {
          type: 'CONTRATO',
          date: contract.startDate,
          amountBRL: contract.principalBRL,
          amountOrigin: contract.principalOrigin,
          description: 'Criação do contrato'
        });

        await context.sync();
        return contract;
      } catch (error) {
        console.error('[LoanManager] Erro ao criar contrato:', error);
        throw error;
      }
    });
  }

  /**
   * Atualiza a sheet de contratos com todos os contratos
   */
  async updateContractsSheet(context) {
    const sheets = context.workbook.worksheets;
    let contractsSheet = sheets.getItemOrNullObject(this.CONTRACTS_SHEET);

    await context.sync();

    if (contractsSheet.isNullObject) {
      contractsSheet = sheets.add(this.CONTRACTS_SHEET);
    }

    contractsSheet.activate();

    // Cabeçalho
    const headers = [
      'ID', 'Tipo', 'Contraparte', 'Moeda', 'Principal Origem',
      'Principal BRL', 'Taxa FX', 'Taxa Juros (%)', 'Data Início',
      'Data Vencimento', 'Sistema', 'Periodicidade', 'Parcelas',
      'Saldo BRL', 'Saldo Origem', 'Status', 'Criado Em'
    ];

    contractsSheet.getRange('A1:Q1').values = [headers];
    contractsSheet.getRange('A1:Q1').format.font.bold = true;
    contractsSheet.getRange('A1:Q1').format.fill.color = '#4472C4';
    contractsSheet.getRange('A1:Q1').format.font.color = '#FFFFFF';

    // Dados dos contratos
    const contractsData = Array.from(this.contracts.values()).map(c => [
      c.id,
      c.contractType,
      c.counterparty,
      c.currency,
      c.principalOrigin,
      c.principalBRL,
      c.contractFXRate,
      c.interestRate,
      c.startDate,
      c.maturityDate,
      c.paymentSystem,
      c.periodicity,
      c.installments,
      c.currentBalance.balanceBRL,
      c.currentBalance.balanceOrigin,
      c.status,
      c.createdAt
    ]);

    if (contractsData.length > 0) {
      const dataRange = contractsSheet.getRange(`A2:Q${contractsData.length + 1}`);
      dataRange.values = contractsData;

      // Formatação de números
      contractsSheet.getRange(`E2:G${contractsData.length + 1}`).numberFormat = [['#,##0.00']];
      contractsSheet.getRange(`H2:H${contractsData.length + 1}`).numberFormat = [['0.00']];
      contractsSheet.getRange(`N2:O${contractsData.length + 1}`).numberFormat = [['#,##0.00']];
    }

    // Auto-ajustar colunas
    contractsSheet.getUsedRange().format.autofitColumns();
  }

  /**
   * Cria entrada no ledger de um contrato
   */
  async createLedgerEntry(context, contract, entry) {
    const ledgerSheetName = `${this.LEDGER_PREFIX}${contract.id}`;
    const sheets = context.workbook.worksheets;
    let ledgerSheet = sheets.getItemOrNullObject(ledgerSheetName);

    await context.sync();

    if (ledgerSheet.isNullObject) {
      ledgerSheet = sheets.add(ledgerSheetName);

      // Cabeçalho
      const headers = [
        'Data', 'Tipo', 'Valor Origem', 'Valor BRL', 'Taxa FX',
        'Saldo Origem', 'Saldo BRL', 'Descrição'
      ];
      ledgerSheet.getRange('A1:H1').values = [headers];
      ledgerSheet.getRange('A1:H1').format.font.bold = true;
      ledgerSheet.getRange('A1:H1').format.fill.color = '#70AD47';
      ledgerSheet.getRange('A1:H1').format.font.color = '#FFFFFF';
    }

    // Adiciona entrada
    const lastRow = ledgerSheet.getUsedRange();
    await context.sync();

    const nextRow = lastRow.rowCount + 1;
    const newRow = [
      entry.date,
      entry.type,
      entry.amountOrigin || 0,
      entry.amountBRL || 0,
      contract.contractFXRate,
      contract.currentBalance.balanceOrigin,
      contract.currentBalance.balanceBRL,
      entry.description || ''
    ];

    ledgerSheet.getRange(`A${nextRow}:H${nextRow}`).values = [newRow];
    ledgerSheet.getRange(`C${nextRow}:G${nextRow}`).numberFormat = [['#,##0.00']];
    ledgerSheet.getUsedRange().format.autofitColumns();
  }

  /**
   * Registra um pagamento
   */
  async registerPayment(contractId, paymentData) {
    return Excel.run(async (context) => {
      try {
        const contract = this.contracts.get(contractId);
        if (!contract) {
          throw new Error(`Contrato ${contractId} não encontrado`);
        }

        const payment = {
          id: `PAY-${Date.now()}`,
          contractId,
          paymentDate: paymentData.paymentDate,
          amountBRL: paymentData.amountBRL,
          amountOrigin: paymentData.amountOrigin || paymentData.amountBRL / contract.contractFXRate,
          currency: paymentData.currency || 'BRL',
          description: paymentData.description || 'Pagamento'
        };

        // Atualiza saldo
        contract.currentBalance.balanceBRL -= payment.amountBRL;
        contract.currentBalance.balanceOrigin -= payment.amountOrigin;
        contract.currentBalance.lastUpdateDate = payment.paymentDate;

        if (contract.currentBalance.balanceBRL <= 0.01) {
          contract.status = 'QUITADO';
        }

        contract.updatedAt = new Date().toISOString();

        // Armazena pagamento
        if (!this.payments.has(contractId)) {
          this.payments.set(contractId, []);
        }
        this.payments.get(contractId).push(payment);

        // Atualiza sheets
        await this.updateContractsSheet(context);
        await this.createLedgerEntry(context, contract, {
          type: 'PAGAMENTO',
          date: payment.paymentDate,
          amountBRL: -payment.amountBRL,
          amountOrigin: -payment.amountOrigin,
          description: payment.description
        });

        await context.sync();
        return payment;
      } catch (error) {
        console.error('[LoanManager] Erro ao registrar pagamento:', error);
        throw error;
      }
    });
  }

  /**
   * Gera cronograma de pagamentos
   */
  async generateSchedule(contractId) {
    return Excel.run(async (context) => {
      try {
        const contract = this.contracts.get(contractId);
        if (!contract) {
          throw new Error(`Contrato ${contractId} não encontrado`);
        }

        // Calcula taxa periódica
        const firstPaymentDate = LoanCalculator.addPeriod(
          contract.startDate,
          1,
          contract.periodicity
        );
        const days = LoanCalculator.getDaysBetween(
          contract.startDate,
          firstPaymentDate,
          contract.dayCountBasis
        );
        const periodicRate = LoanCalculator.calculatePeriodicRate(
          contract.interestRate,
          contract.compounding,
          contract.dayCountBasis,
          days
        );

        // Gera cronograma baseado no sistema
        let schedule;
        if (contract.paymentSystem === 'PRICE') {
          schedule = LoanCalculator.generatePRICESchedule(
            contract.principalOrigin,
            periodicRate,
            contract.installments,
            contract.startDate,
            contract.periodicity
          );
        } else if (contract.paymentSystem === 'SAC') {
          schedule = LoanCalculator.generateSACSchedule(
            contract.principalOrigin,
            periodicRate,
            contract.installments,
            contract.startDate,
            contract.periodicity
          );
        } else {
          throw new Error(`Sistema de pagamento ${contract.paymentSystem} não suportado`);
        }

        // Cria sheet de cronograma
        await this.createScheduleSheet(context, contract, schedule);

        await context.sync();
        return schedule;
      } catch (error) {
        console.error('[LoanManager] Erro ao gerar cronograma:', error);
        throw error;
      }
    });
  }

  /**
   * Cria sheet de cronograma
   */
  async createScheduleSheet(context, contract, schedule) {
    const sheetName = `${this.SCHEDULE_PREFIX}${contract.id}`;
    const sheets = context.workbook.worksheets;

    // Remove sheet existente se houver
    let scheduleSheet = sheets.getItemOrNullObject(sheetName);
    await context.sync();
    if (!scheduleSheet.isNullObject) {
      scheduleSheet.delete();
    }

    // Cria nova sheet
    scheduleSheet = sheets.add(sheetName);
    scheduleSheet.activate();

    // Informações do contrato
    scheduleSheet.getRange('A1:B1').merge();
    scheduleSheet.getRange('A1').values = [[`Cronograma de Pagamentos - ${contract.id}`]];
    scheduleSheet.getRange('A1').format.font.bold = true;
    scheduleSheet.getRange('A1').format.font.size = 14;

    scheduleSheet.getRange('A2').values = [['Contraparte:']];
    scheduleSheet.getRange('B2').values = [[contract.counterparty]];
    scheduleSheet.getRange('A3').values = [['Sistema:']];
    scheduleSheet.getRange('B3').values = [[contract.paymentSystem]];
    scheduleSheet.getRange('A4').values = [['Taxa:']];
    scheduleSheet.getRange('B4').values = [[`${contract.interestRate}% a.a.`]];

    // Cabeçalho do cronograma
    const headers = [
      'Parcela', 'Data Vencimento', 'Saldo Inicial', 'Valor Parcela',
      'Juros', 'Amortização', 'Saldo Final'
    ];
    scheduleSheet.getRange('A6:G6').values = [headers];
    scheduleSheet.getRange('A6:G6').format.font.bold = true;
    scheduleSheet.getRange('A6:G6').format.fill.color = '#4472C4';
    scheduleSheet.getRange('A6:G6').format.font.color = '#FFFFFF';

    // Dados do cronograma
    const scheduleData = schedule.map(row => [
      row.installmentNumber,
      row.paymentDate,
      row.openingBalance,
      row.paymentAmount,
      row.interestComponent,
      row.principalComponent,
      row.closingBalance
    ]);

    const dataRange = scheduleSheet.getRange(`A7:G${6 + scheduleData.length}`);
    dataRange.values = scheduleData;

    // Formatação de números
    scheduleSheet.getRange(`C7:G${6 + scheduleData.length}`).numberFormat = [['#,##0.00']];

    // Totais
    const totalRow = 6 + scheduleData.length + 1;
    scheduleSheet.getRange(`A${totalRow}`).values = [['TOTAL']];
    scheduleSheet.getRange(`A${totalRow}`).format.font.bold = true;
    scheduleSheet.getRange(`D${totalRow}`).formulas = [[`=SUM(D7:D${6 + scheduleData.length})`]];
    scheduleSheet.getRange(`E${totalRow}`).formulas = [[`=SUM(E7:E${6 + scheduleData.length})`]];
    scheduleSheet.getRange(`F${totalRow}`).formulas = [[`=SUM(F7:F${6 + scheduleData.length})`]];
    scheduleSheet.getRange(`D${totalRow}:F${totalRow}`).format.font.bold = true;
    scheduleSheet.getRange(`D${totalRow}:F${totalRow}`).numberFormat = [['#,##0.00']];

    // Auto-ajustar colunas
    scheduleSheet.getUsedRange().format.autofitColumns();
  }

  /**
   * Lista todos os contratos
   */
  listContracts() {
    return Array.from(this.contracts.values());
  }

  /**
   * Obtém contrato por ID
   */
  getContract(contractId) {
    return this.contracts.get(contractId);
  }

  /**
   * Carrega contratos da planilha
   */
  async loadContractsFromSheet() {
    return Excel.run(async (context) => {
      try {
        const sheets = context.workbook.worksheets;
        let contractsSheet = sheets.getItemOrNullObject(this.CONTRACTS_SHEET);

        await context.sync();

        if (contractsSheet.isNullObject) {
          console.log('[LoanManager] Nenhuma planilha de contratos encontrada');
          return;
        }

        const dataRange = contractsSheet.getUsedRange();
        dataRange.load('values');

        await context.sync();

        const values = dataRange.values;

        // Pula cabeçalho
        for (let i = 1; i < values.length; i++) {
          const row = values[i];
          const contract = {
            id: row[0],
            contractType: row[1],
            counterparty: row[2],
            currency: row[3],
            principalOrigin: row[4],
            principalBRL: row[5],
            contractFXRate: row[6],
            interestRate: row[7],
            startDate: row[8],
            maturityDate: row[9],
            paymentSystem: row[10],
            periodicity: row[11],
            installments: row[12],
            status: row[15],
            createdAt: row[16],
            updatedAt: new Date().toISOString(),
            dayCountBasis: 'ACT/365',
            compounding: 'EXPONENCIAL',
            currentBalance: {
              balanceBRL: row[13],
              balanceOrigin: row[14],
              lastUpdateDate: row[8]
            }
          };

          this.contracts.set(contract.id, contract);
        }

        console.log(`[LoanManager] ${this.contracts.size} contratos carregados`);
      } catch (error) {
        console.error('[LoanManager] Erro ao carregar contratos:', error);
      }
    });
  }
}

// Instância global
const loanManager = new LoanManager();
