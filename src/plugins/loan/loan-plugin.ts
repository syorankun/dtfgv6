/**
 * Loan Plugin - Plugin Principal de Gestão de Empréstimos
 *
 * Orquestra todas as funcionalidades do plugin:
 * - Criação de contratos
 * - Registro de pagamentos
 * - Geração de cronogramas (ACCRUAL e Schedule)
 * - Integração com FX Plugin
 * - Fórmulas e UI
 */

import { nanoid } from 'nanoid';
import type { PluginManifest, PluginContext } from '@core/types';
import { Plugin } from '@core/plugin-system-consolidated';
import { logger } from '@core/storage-utils-consolidated';

import type { LoanContract, LoanContractInput } from './loan-types';
import { INTEREST_TEMPLATES } from './loan-templates';
import { LoanFXIntegration } from './loan-fx-integration';
import { LoanScheduler } from './loan-scheduler';
import { LoanCalculator } from './loan-calculator';
import { LoanValidator } from './loan-validator';
import { LoanPaymentManager, type LoanPayment, type LoanLedgerEntry } from './loan-payment-manager';
import { LoanSheets } from './loan-sheets';
import { LoanWizard } from './loan-wizard';
import { LoanDashboard } from './loan-dashboard';
import { LoanIndexerService } from './loan-indexer-service';
import { LoanAccrualHistory } from './loan-accrual-history';

/**
 * Plugin principal para Gestão de Empréstimos.
 */
export class LoanPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: 'dj.finance.loans',
    name: 'Gestão de Empréstimos',
    version: '2.0.0',
    author: 'DJ DataForge',
    description: 'Gestão completa de empréstimos com multi-moeda e ACCRUAL',
    permissions: [
      'read:workbook',
      'write:workbook',
      'read:storage',
      'write:storage',
      'ui:toolbar',
      'ui:menu',
      'formula:register',
      'network:fetch'
    ],
    entryPoint: 'loan-plugin.ts'
  };

  private context!: PluginContext;
  private fxIntegration!: LoanFXIntegration;
  private indexerService!: LoanIndexerService;
  private scheduler!: LoanScheduler;
  private paymentManager!: LoanPaymentManager;
  private accrualHistory!: LoanAccrualHistory;
  private sheets!: LoanSheets;
  private dashboard?: LoanDashboard;
  private activeWizard?: LoanWizard;
  private autosaveHandler = async (): Promise<void> => {
    await this.saveContracts();
    await this.savePayments();
    await this.saveAccrualHistory();
  };
  private contracts: Map<string, LoanContract> = new Map();

  /**
   * Inicialização do plugin.
   */
  public async init(context: PluginContext): Promise<void> {
    this.context = context;
    logger.info('[LoanPlugin] Iniciando...');

    try {
      this.fxIntegration = new LoanFXIntegration(context);
      this.indexerService = new LoanIndexerService(this.fxIntegration);
      await this.fxIntegration.connectFXPlugin();

      this.paymentManager = new LoanPaymentManager(this.fxIntegration);
      this.accrualHistory = new LoanAccrualHistory();
      this.scheduler = new LoanScheduler(this.fxIntegration, this.indexerService, this.paymentManager);
      this.sheets = new LoanSheets(context);
      this.dashboard = new LoanDashboard(context);

      logger.info(`[LoanPlugin] ${Object.keys(INTEREST_TEMPLATES).length} templates carregados`);

      await this.loadContracts();
      // Pré-carrega PTAX automaticamente para moedas de contratos existentes (últimos 30 dias)
      try {
        const nonBRLCurrencies = Array.from(new Set(Array.from(this.contracts.values()).filter(c => c.currency !== 'BRL').map(c => c.currency)));
        if (nonBRLCurrencies.length > 0) {
          const end = new Date();
          const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
          const fmt = (d: Date) => d.toISOString().split('T')[0];
          await this.fxIntegration.syncPTAX(fmt(start), fmt(end), nonBRLCurrencies);
        }
      } catch (e) {
        logger.warn('[LoanPlugin] Não foi possível pré-sincronizar PTAX', e);
      }
      await this.loadPayments();
      await this.loadAccrualHistory();

      this.refreshContractSheets();
      this.refreshAllLedgers();

      this.registerFormulas();
      this.registerMenus();
      this.registerCapability();
      this.setupEventListeners();

      this.context.ui.showToast('Loan Plugin carregado com sucesso!', 'success');
      logger.info('[LoanPlugin] Inicializado com sucesso');
    } catch (error) {
      logger.error('[LoanPlugin] Erro durante inicialização:', error);
      this.context.ui.showToast('Erro ao inicializar Loan Plugin', 'error');
      throw error;
    }
  }

  /**
   * Carrega contratos persistidos.
   */
  private async loadContracts(): Promise<void> {
    try {
      this.contracts.clear();
      const data = await this.context.storage.get('contracts');
      if (data && typeof data === 'object') {
        Object.entries(data as Record<string, LoanContract>).forEach(([id, contract]) => {
          this.contracts.set(id, contract as LoanContract);
        });
      }
      logger.info(`[LoanPlugin] ${this.contracts.size} contratos carregados`);
    } catch (error) {
      logger.error('[LoanPlugin] Erro ao carregar contratos:', error);
    }
  }

  /**
   * Carrega histórico de pagamentos persistidos.
   */
  private async loadPayments(): Promise<void> {
    try {
      const paymentsData = await this.context.storage.get('payments');
      if (paymentsData && typeof paymentsData === 'object') {
        this.paymentManager.loadPayments(paymentsData as Record<string, LoanPayment[]>);
      }

      const ledgerData = await this.context.storage.get('payment-ledger');
      if (ledgerData && typeof ledgerData === 'object') {
        this.paymentManager.loadLedger(ledgerData as Record<string, LoanLedgerEntry[]>);
      }
    } catch (error) {
      logger.error('[LoanPlugin] Erro ao carregar pagamentos:', error);
    }
  }

  /**
   * Registra fórmulas do plugin.
   */
  private registerFormulas(): void {
    const registry = (this.context.kernel as any).calcEngine?.getRegistry();
    if (!registry) {
      logger.warn('[LoanPlugin] Registry não disponível');
      return;
    }

    // LOAN.BALANCE(contractId, [date], [currency])
    registry.register(
      'LOAN.BALANCE',
      async (contractId: string, date?: string, currency?: string) => {
        return this.getBalance(contractId, date, currency);
      },
      {
        argCount: -1,
        description: 'Saldo devedor do contrato',
        async: true
      }
    );

    // LOAN.INTEREST(contractId, startDate, endDate)
    registry.register(
      'LOAN.INTEREST',
      async (contractId: string, startDate: string, endDate: string) => {
        return this.calculateInterest(contractId, startDate, endDate);
      },
      {
        argCount: 3,
        description: 'Juros acumulados no período',
        async: true
      }
    );

    // LOAN.STATUS(contractId)
    registry.register(
      'LOAN.STATUS',
      (contractId: string) => {
        const contract = this.contracts.get(contractId);
        return contract?.status || '#N/A';
      },
      {
        argCount: 1,
        description: 'Status do contrato'
      }
    );

    // LOAN.PMT - Fórmula financeira pura
    registry.register(
      'LOAN.PMT',
      (principal: number, ratePercent: number, nper: number) => {
        const rate = ratePercent / 100 / 12; // Simplificação: assume mensal
        return LoanCalculator.calculatePMT(principal, rate, nper);
      },
      {
        argCount: 3,
        description: 'Calcula valor da parcela'
      }
    );

    // LOAN.NEXT.PAYMENT(contractId)
    registry.register(
      'LOAN.NEXT.PAYMENT',
      (contractId: string) => {
        const contract = this.contracts.get(contractId);
        if (!contract) return '#N/A';

        if (contract.paymentFlow.type === 'SCHEDULED' && contract.paymentFlow.scheduled) {
          // Calcula próxima data baseada no cronograma
          const scheduled = contract.paymentFlow.scheduled;
          const paymentsInfo = this.paymentManager.getTotalPayments(contractId);
          const nextInstallment = paymentsInfo.count + 1;

          if (nextInstallment <= scheduled.installments) {
            return this.calculateNextPaymentDate(contract, nextInstallment);
          }
        }

        return 'N/A';
      },
      {
        argCount: 1,
        description: 'Data da próxima parcela'
      }
    );

    // LOAN.NEXT.AMOUNT(contractId)
    registry.register(
      'LOAN.NEXT.AMOUNT',
      async (contractId: string) => {
        const contract = this.contracts.get(contractId);
        if (!contract) return '#N/A';

        if (contract.paymentFlow.type === 'SCHEDULED' && contract.paymentFlow.scheduled) {
          const scheduled = contract.paymentFlow.scheduled;
          const paymentsInfo = this.paymentManager.getTotalPayments(contractId);
          const nextInstallment = paymentsInfo.count + 1;

          if (nextInstallment <= scheduled.installments) {
            return this.calculateNextPaymentAmount(contract, nextInstallment);
          }
        }

        return 'N/A';
      },
      {
        argCount: 1,
        description: 'Valor da próxima parcela',
        async: true
      }
    );

    // LOAN.ACCRUAL(contractId, startDate, endDate, [frequency], [rateMode], [fxMode], [variation])
    registry.register(
      'LOAN.ACCRUAL',
      async (
        contractId: string,
        startDate: string,
        endDate: string,
        frequency?: string,
        _rateMode?: string,
        _fxMode?: string,
        variationMode?: string
      ) => {
        try {
          const normalizedFrequency = this.normalizeFrequency(frequency);
          const showVariation = (variationMode || '').toUpperCase().includes('PTAX');
          const rows = await this.generateAccrualSheet(
            contractId,
            startDate,
            endDate,
            normalizedFrequency,
            showVariation
          );
          return rows;
        } catch (error) {
          logger.error('[LoanPlugin] Erro na fórmula LOAN.ACCRUAL:', error);
          return '#ERRO';
        }
      },
      {
        argCount: -1,
        description: 'Gera cronograma ACCRUAL e retorna o número de linhas',
        async: true
      }
    );

    // LOAN.SCHEDULE(contractId)
    registry.register(
      'LOAN.SCHEDULE',
      async (contractId: string) => {
        try {
          const rows = await this.generateScheduleSheet(contractId);
          return rows;
        } catch (error) {
          logger.error('[LoanPlugin] Erro na fórmula LOAN.SCHEDULE:', error);
          return '#ERRO';
        }
      },
      {
        argCount: 1,
        description: 'Gera cronograma de pagamentos e retorna o número de linhas',
        async: true
      }
    );

    // LOAN.PAY(contractId, paymentDate, amount, [currency], [description])
    registry.register(
      'LOAN.PAY',
      async (
        contractId: string,
        paymentDate: string,
        amount: number | string,
        currency?: string,
        description?: string
      ) => {
        try {
          const numericAmount = typeof amount === 'number' ? amount : parseFloat(String(amount));
          if (Number.isNaN(numericAmount) || numericAmount <= 0) {
            return '#ERRO';
          }
          await this.registerPayment(contractId, numericAmount, paymentDate, currency, description);
          return 1;
        } catch (error) {
          logger.error('[LoanPlugin] Erro na fórmula LOAN.PAY:', error);
          return '#ERRO';
        }
      },
      {
        argCount: -1,
        description: 'Registra um pagamento para o contrato informado',
        async: true
      }
    );

    logger.info('[LoanPlugin] Fórmulas registradas');
  }

  /**
   * Registra menus na UI.
   */
  private registerMenus(): void {
    // Menu principal
    this.context.ui.addMenuItem({
      id: 'loan-menu',
      label: 'Empréstimos',
      onClick: () => {} // Menu pai não precisa de ação
    });

    // Submenu: Dashboard de Contratos
    this.context.ui.addMenuItem({
      id: 'loan-dashboard',
      label: 'Dashboard de Contratos',
      parent: 'loan-menu',
      onClick: () => this.showDashboard()
    });

    // Submenu: Novo Contrato
    this.context.ui.addMenuItem({
      id: 'loan-new-contract',
      label: 'Novo Contrato',
      parent: 'loan-menu',
      onClick: () => this.showNewContractWizard()
    });

    // Submenu: Registrar Pagamento
    this.context.ui.addMenuItem({
      id: 'loan-register-payment',
      label: 'Registrar Pagamento',
      parent: 'loan-menu',
      onClick: () => this.showPaymentModal()
    });

    // Submenu: Gerar ACCRUAL
    this.context.ui.addMenuItem({
      id: 'loan-generate-accrual',
      label: 'Gerar ACCRUAL',
      parent: 'loan-menu',
      onClick: () => this.showAccrualWizard()
    });

    // Submenu: Sincronizar PTAX
    this.context.ui.addMenuItem({
      id: 'loan-sync-ptax',
      label: 'Sincronizar PTAX',
      parent: 'loan-menu',
      onClick: () => this.showSyncPTAXModal()
    });

    logger.info('[LoanPlugin] Menus registrados');
  }

  /**
   * Expõe API para outros plugins.
   */
  private registerCapability(): void {
    const api = {
      createContract: this.createContract.bind(this),
      registerPayment: this.registerPayment.bind(this),
      getBalance: this.getBalance.bind(this),
      generateAccrual: (contractId: string, startDate: string, endDate: string, frequency?: string, showVariation?: boolean) =>
        this.generateAccrualSheet(contractId, startDate, endDate, this.normalizeFrequency(frequency), !!showVariation),
      generateSchedule: (contractId: string) => this.generateScheduleSheet(contractId),
      listContracts: () => Array.from(this.contracts.values()),
      getContract: (id: string) => this.contracts.get(id)
    };

    (this.context.kernel as any).registerCapability?.('dj.finance.loans@1', api);
    logger.info('[LoanPlugin] Capability registrada');
  }

  /**
   * Configura listeners de eventos.
   */
  private setupEventListeners(): void {
    this.context.events.on('kernel:autosave-done', this.autosaveHandler);
  }

  /**
   * Salva contratos no storage.
   */
  private async saveContracts(): Promise<void> {
    try {
        logger.info('[LoanPlugin] ====== saveContracts: INÍCIO ======');
        logger.info('[LoanPlugin] Contratos em memória:', this.contracts.size);
        logger.info('[LoanPlugin] IDs:', Array.from(this.contracts.keys()).join(', '));
      
      const data: Record<string, LoanContract> = {};
      this.contracts.forEach((contract, id) => {
        data[id] = contract;
          logger.debug(`[LoanPlugin] Preparando para salvar contrato ${id}`);
      });
      
        logger.info(`[LoanPlugin] Objeto de dados preparado com ${Object.keys(data).length} contratos`);
        logger.info('[LoanPlugin] Chamando context.storage.set("contracts", data)...');
      
      await this.context.storage.set('contracts', data);
        logger.info('[LoanPlugin] ✓ context.storage.set() concluído com sucesso');
      
      // Verificar se salvou corretamente
        logger.info('[LoanPlugin] Verificando salvamento com context.storage.get("contracts")...');
      const saved = await this.context.storage.get('contracts');
        logger.info('[LoanPlugin] Dados retornados do storage:', saved ? Object.keys(saved as object).length + ' contratos' : 'null');
      
      if (!saved || Object.keys(saved as object).length !== this.contracts.size) {
          const errorMsg = `Falha ao verificar salvamento. Esperado: ${this.contracts.size}, Salvo: ${saved ? Object.keys(saved as object).length : 0}`;
          logger.error('[LoanPlugin]', errorMsg);
          throw new Error(errorMsg);
      }
      
        logger.info(`[LoanPlugin] ====== saveContracts: SUCESSO - ${this.contracts.size} contratos salvos ======`);
    } catch (error) {
        logger.error('[LoanPlugin] ====== saveContracts: ERRO ======', error);
        this.context.ui.showToast('⚠️ Erro ao salvar contratos no storage! Verifique o console.', 'error');
      throw error;
    }
  }

  /**
   * Salva pagamentos no storage.
   */
  private async savePayments(): Promise<void> {
    try {
      const paymentsData = this.paymentManager.savePayments();
      await this.context.storage.set('payments', paymentsData);

      const ledgerData = this.paymentManager.saveLedger();
      await this.context.storage.set('payment-ledger', ledgerData);
    } catch (error) {
      logger.error('[LoanPlugin] Erro ao salvar pagamentos:', error);
    }
  }

  /**
   * Carrega histórico de accrual persistido.
   */
  private async loadAccrualHistory(): Promise<void> {
    try {
      const historyData = await this.context.storage.get('accrual-history');
      if (historyData) {
        await this.accrualHistory.loadHistory(historyData as any);
        logger.info('[LoanPlugin] Histórico de accrual carregado');
      }
    } catch (error) {
      logger.error('[LoanPlugin] Erro ao carregar histórico de accrual:', error);
    }
  }

  /**
   * Salva histórico de accrual no storage.
   */
  private async saveAccrualHistory(): Promise<void> {
    try {
      const historyData = await this.accrualHistory.saveHistory();
      await this.context.storage.set('accrual-history', historyData);
    } catch (error) {
      logger.error('[LoanPlugin] Erro ao salvar histórico de accrual:', error);
    }
  }

  /**
   * Cria novo contrato.
   */
  public async createContract(data: LoanContractInput): Promise<LoanContract> {
    try {
        logger.info('[LoanPlugin] ====== INICIANDO CRIAÇÃO DE CONTRATO ======');
        logger.info('[LoanPlugin] Dados recebidos:', { 
          counterparty: data.counterparty, 
          principal: data.principalOrigin, 
          currency: data.currency,
          startDate: data.startDate,
          maturityDate: data.maturityDate
        });
      
      const id = data.id || `LOAN-${Date.now()}-${nanoid(6)}`;
      (data as LoanContract).id = id; // Adiciona o ID aos dados para validação

      // Valida dados de entrada
      const validation = LoanValidator.validateContractInput(data);
      if (!validation.isValid) {
        const errorMessage = `Erros de validação: ${validation.errors.join(', ')}`;
        logger.error('[LoanPlugin] ' + errorMessage);
        throw new Error(errorMessage);
      }
      
      logger.info('[LoanPlugin] ✓ Validação de entrada aprovada');

      logger.info('[LoanPlugin] ID do contrato gerado:', id);      // Obtém taxa FX
      logger.info(`[LoanPlugin] Obtendo taxa FX para ${data.currency} em ${data.startDate}`);
      const rateInfo = await this.fxIntegration.getConversionRate(
        data.startDate,
        data.currency,
        data.contractFXRate
      );

      if (!rateInfo) {
        throw new Error(`Taxa de câmbio não disponível para ${data.currency}`);
      }
      
      logger.info(`[LoanPlugin] ✓ Taxa FX obtida: ${rateInfo.rate} de ${rateInfo.source}`);

      const principalBRL = data.principalOrigin * rateInfo.rate;
        logger.info('[LoanPlugin] Principal em BRL:', principalBRL);

      const newContract: LoanContract = {
        ...data,
        id,
        principalBRL,
        status: 'ATIVO',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        currentBalance: {
          balanceBRL: principalBRL,
          balanceOrigin: data.principalOrigin,
          accruedInterestBRL: 0,
          accruedInterestOrigin: 0,
          lastUpdateDate: data.startDate
        }
      };
      
        logger.info('[LoanPlugin] ✓ Objeto do contrato criado');

      // Valida estado final do contrato
      const stateValidation = LoanValidator.validateContractState(newContract);
      if (!stateValidation.isValid) {
        const errorMessage = `Erros de estado: ${stateValidation.errors.join(', ')}`;
        logger.error('[LoanPlugin] ' + errorMessage);
        throw new Error(errorMessage);
      }
      
        logger.info('[LoanPlugin] ✓ Validação de estado aprovada');

        logger.info('[LoanPlugin] Registrando entrada inicial no ledger...');
      this.paymentManager.registerInitialEntry(newContract, rateInfo.rate, rateInfo.source);
        logger.info('[LoanPlugin] ✓ Entrada inicial registrada');
      
        logger.info('[LoanPlugin] Populando snapshot de próximo pagamento...');
      await this.populateNextPaymentSnapshot(newContract);
        logger.info('[LoanPlugin] ✓ Snapshot populado');

        logger.info('[LoanPlugin] Adicionando contrato ao Map em memória...');
      this.contracts.set(id, newContract);
        logger.info('[LoanPlugin] ✓ Contrato adicionado (total:', this.contracts.size, 'contratos)');
      
      // Forçar salvamento imediato com verificação
        logger.info(`[LoanPlugin] ====== INICIANDO SALVAMENTO NO STORAGE ======`);
      await this.saveContracts();
        logger.info(`[LoanPlugin] ✓ saveContracts() concluído`);
      
      await this.savePayments();
        logger.info(`[LoanPlugin] ✓ savePayments() concluído`);
      
      // Verificação adicional
        logger.info(`[LoanPlugin] Verificando se o contrato foi salvo no IndexedDB...`);
      const loadedContracts = await this.context.storage.get('contracts') as Record<string, LoanContract> | null;
      if (!loadedContracts || !loadedContracts[id]) {
          const errorMsg = `Contrato ${id} criado mas não foi salvo corretamente no IndexedDB. Contratos salvos: ${loadedContracts ? Object.keys(loadedContracts).join(', ') : 'nenhum'}`;
          logger.error('[LoanPlugin] ' + errorMsg);
          throw new Error(errorMsg);
      }
      logger.info(`[LoanPlugin] ✓ Contrato ${id} verificado no storage`);
      

        logger.info('[LoanPlugin] Atualizando sheets...');
      this.refreshContractSheets();
      this.refreshLedgerSheet(id);
        logger.info('[LoanPlugin] ✓ Sheets atualizados');

        logger.info('[LoanPlugin] Emitindo evento loan:contract-created...');
      this.context.events.emit('loan:contract-created', { contractId: id });
        logger.info('[LoanPlugin] ✓ Evento emitido');

        this.context.ui.showToast(`✓ Contrato ${id} criado e salvo com sucesso!`, 'success');
        logger.info(`[LoanPlugin] ====== CONTRATO ${id} CRIADO COM SUCESSO ======`);
      
      return newContract;
    } catch (error) {
        logger.error('[LoanPlugin] ====== ERRO AO CRIAR CONTRATO ======', error);
        this.context.ui.showToast('❌ Erro ao criar contrato: ' + (error instanceof Error ? error.message : 'Erro desconhecido'), 'error');
      throw error;
    }
  }  /**
   * Registra um pagamento em um contrato.
   */
  public async registerPayment(
    contractId: string,
    amount: number,
    paymentDate: string,
    currency?: string,
    description?: string
  ): Promise<LoanPayment> {
    try {
      const contract = this.contracts.get(contractId);
      if (!contract) {
        throw new Error(`Contrato ${contractId} não encontrado`);
      }

      // Valida o pagamento
      const validation = LoanValidator.validatePayment(contract, amount, paymentDate, currency);
      if (!validation.isValid) {
        const errorMessage = `Erros de validação: ${validation.errors.join(', ')}`;
        logger.error('[LoanPlugin] ' + errorMessage);
        throw new Error(errorMessage);
      }

      // Aplica o pagamento
      const { payment, newBalance, ledgerEntry } = await this.paymentManager.applyPayment(
        contract,
        amount,
        paymentDate,
        currency,
        description
      );

      // Record payment in history
      this.accrualHistory.recordPayment({
        id: payment.id,
        contractId: payment.contractId,
        paymentDate: payment.paymentDate,
        amountOrigin: payment.amountOrigin,
        amountBRL: payment.amountBRL,
        currency: payment.currency,
        fxRate: payment.fxRate,
        fxSource: payment.fxSource || 'N/A',
        interestPaidBRL: 0, // TODO: Calculate from accrual
        principalPaidBRL: payment.amountBRL,
        balanceAfterOrigin: newBalance.balanceOrigin,
        balanceAfterBRL: newBalance.balanceBRL,
        description: payment.description,
        createdAt: payment.createdAt
      });

      // Atualiza o contrato
      contract.currentBalance = newBalance;
      contract.updatedAt = new Date().toISOString();

      // Atualiza status se quitado
      if (newBalance.balanceBRL <= 0.01) {
        contract.status = 'QUITADO';
      }

      await this.populateNextPaymentSnapshot(contract);

      // Salva alterações
      this.contracts.set(contractId, contract);
      await this.saveContracts();
      await this.savePayments();

      this.refreshContractSheets();
      this.refreshLedgerSheet(contractId);

      this.context.ui.showToast(`Pagamento de ${payment.amountBRL} BRL registrado!`, 'success');
      this.context.events.emit('loan:payment-registered', { contractId, paymentId: payment.id, ledgerEntry });

      logger.info(`[LoanPlugin] Pagamento ${payment.id} registrado no contrato ${contractId}`);
      return payment;
    } catch (error) {
      logger.error('[LoanPlugin] Erro ao registrar pagamento:', error);
      this.context.ui.showToast('Erro ao registrar pagamento', 'error');
      throw error;
    }
  }

  /**
   * Obtém saldo do contrato.
   */
  private async getBalance(
    contractId: string,
    date?: string,
    currency?: string
  ): Promise<number | string> {
    const contract = this.contracts.get(contractId);
    if (!contract) return '#N/A';

    const targetDate = date || new Date().toISOString().split('T')[0];
    const targetCurrency = (currency || 'BRL').toUpperCase();

    // Reconstrói saldo na data
    const hist = this.paymentManager.getBalanceAtDate(contract, targetDate);
    const originBal = hist ? hist.balanceOrigin : contract.currentBalance.balanceOrigin;

    if (targetCurrency === contract.currency.toUpperCase()) {
      return originBal;
    }

    // Converte para BRL (mark-to-market) usando PTAX do dia
    const contractFx = await this.fxIntegration.getConversionRate(targetDate, contract.currency, contract.contractFXRate);
    const brlBal = contractFx ? originBal * contractFx.rate : contract.currentBalance.balanceBRL;

    if (targetCurrency === 'BRL') {
      return LoanCalculator.round(brlBal, 2);
    }

    // Outra moeda: triangulação via BRL
    const outFx = await this.fxIntegration.getConversionRate(targetDate, targetCurrency as any);
    if (!outFx || outFx.rate <= 0) return '#N/A';
    return LoanCalculator.round(brlBal / outFx.rate, 2);
  }

  /**
   * Calcula juros acumulados no período.
   */
  private async calculateInterest(
    contractId: string,
    startDate: string,
    endDate: string
  ): Promise<number | string> {
    const contract = this.contracts.get(contractId);
    if (!contract) return '#N/A';

    try {
      const accrualRows = await this.scheduler.buildAccrualRows(
        contract,
        startDate,
        endDate,
        'Diário',
        false
      );

      const totalInterest = accrualRows.reduce((sum, row) => sum + row.interestBRL, 0);
      return LoanCalculator.round(totalInterest, 2);
    } catch (error) {
      logger.error('[LoanPlugin] Erro ao calcular juros:', error);
      return '#ERRO';
    }
  }

  /**
   * Modal: Novo Contrato (Wizard).
   */
  private async showNewContractWizard(): Promise<void> {
    try {
        logger.info('[LoanPlugin] ====== ABRINDO WIZARD DE CRIAÇÃO ======');
      
      if (!this.activeWizard) {
        this.activeWizard = new LoanWizard(this.fxIntegration);
          logger.info('[LoanPlugin] Nova instância de LoanWizard criada');
      }

        logger.info('[LoanPlugin] Aguardando dados do wizard...');
      const contractData = await this.activeWizard.start();
      
      if (contractData) {
          logger.info('[LoanPlugin] Dados do contrato recebidos do wizard');
          logger.info('[LoanPlugin] Criando contrato...');
          const createdContract = await this.createContract(contractData);
          logger.info('[LoanPlugin] ✓ Contrato criado com sucesso:', createdContract.id);
        } else {
          logger.info('[LoanPlugin] Wizard cancelado pelo usuário');
      }
    } catch (error) {
        logger.error('[LoanPlugin] ====== ERRO NO WIZARD ======', error);
        this.context.ui.showToast('❌ Erro ao criar contrato: ' + (error instanceof Error ? error.message : 'Erro desconhecido'), 'error');
    } finally {
        logger.info('[LoanPlugin] Limpando instância do wizard');
      this.activeWizard = undefined;
    }
  }

  /**
   * Modal: Registrar Pagamento.
   */
  private showPaymentModal(): void {
    const activeContracts = Array.from(this.contracts.values()).filter(c => c.status === 'ATIVO');
    if (activeContracts.length === 0) {
      this.context.ui.showToast('Nenhum contrato ativo encontrado.', 'warning');
      return;
    }

    const modalId = 'loan-payment-modal';
    document.getElementById(modalId)?.remove();

    const defaultDate = new Date().toISOString().split('T')[0];
    const optionsHTML = activeContracts.map(contract => `
      <option value="${contract.id}">
        ${contract.id} · ${contract.counterparty} (${contract.currency})
      </option>
    `).join('');

    const modalHTML = `
      <div id="${modalId}" style="position: fixed; inset: 0; background: rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; z-index: 10060;">
        <div style="background: #fff; border-radius: 10px; padding: 24px; width: 95%; max-width: 520px; box-shadow: 0 18px 40px rgba(15,23,42,0.2); max-height: 90vh; overflow-y: auto;">
          <h2 style="margin: 0 0 16px; font-size: 1.4rem;">Registrar Pagamento</h2>

          <div style="display: flex; flex-direction: column; gap: 16px;">
            <label style="font-weight: 600; display: flex; flex-direction: column; gap: 6px;">
              Contrato
              <select id="loan-payment-contract" style="padding: 10px; border: 1px solid #d0d7de; border-radius: 6px;">
                <option value="">Selecione um contrato...</option>
                ${optionsHTML}
              </select>
            </label>

            <!-- Saldo Atual -->
            <div id="loan-payment-balance" style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 16px; display: none;">
              <h4 style="margin: 0 0 12px; font-size: 1rem; color: #495057;">ℹ️ Saldo Atual</h4>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 0.9rem;">
                <div><strong>Saldo Devedor:</strong><br><span id="balance-brl">-</span></div>
                <div><strong>Saldo Origem:</strong><br><span id="balance-origin">-</span></div>
                <div><strong>Juros Acum.:</strong><br><span id="accrued-interest">-</span></div>
                <div><strong>Próxima Parcela:</strong><br><span id="next-payment">-</span></div>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 12px;">
              <label style="font-weight: 600; display: flex; flex-direction: column; gap: 6px;">
                Data do Pagamento
                <input id="loan-payment-date" type="date" value="${defaultDate}" style="padding: 10px; border: 1px solid #d0d7de; border-radius: 6px;" />
              </label>
              <label style="font-weight: 600; display: flex; flex-direction: column; gap: 6px;">
                Moeda
                <select id="loan-payment-currency" style="padding: 10px; border: 1px solid #d0d7de; border-radius: 6px;">
                  <option value="">BRL</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="JPY">JPY</option>
                </select>
              </label>
            </div>

            <label style="font-weight: 600; display: flex; flex-direction: column; gap: 6px;">
              Valor do Pagamento
              <input id="loan-payment-amount" type="number" min="0" step="0.01" placeholder="10000.00" style="padding: 10px; border: 1px solid #d0d7de; border-radius: 6px;" />
            </label>

            <div style="background: #e7f3ff; border: 1px solid #b3d9ff; border-radius: 6px; padding: 12px; font-size: 0.9rem; color: #084c7d;">
              Se pagar em moeda diferente, o valor será convertido usando PTAX (BCB) do dia do pagamento
            </div>

            <label style="font-weight: 600; display: flex; flex-direction: column; gap: 8px;">
              Alocação do Pagamento
              <div style="display: flex; flex-direction: column; gap: 6px;">
                <label style="display: flex; align-items: center; gap: 8px;">
                  <input type="radio" name="allocation" value="AUTO" checked />
                  <span>Automática (primeiro juros, depois principal)</span>
                </label>
                <label style="display: flex; align-items: center; gap: 8px;">
                  <input type="radio" name="allocation" value="INTEREST_ONLY" />
                  <span>Apenas Juros</span>
                </label>
                <label style="display: flex; align-items: center; gap: 8px;">
                  <input type="radio" name="allocation" value="PRINCIPAL_ONLY" />
                  <span>Apenas Principal</span>
                </label>
              </div>
            </label>

            <!-- Simulação -->
            <div id="loan-payment-simulation" style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 16px; display: none;">
              <h4 style="margin: 0 0 12px; font-size: 1rem; color: #495057;">Simulação do Pagamento</h4>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 0.9rem;">
                <div><strong>Juros Pagos:</strong><br><span id="sim-interest">-</span></div>
                <div><strong>Amortização:</strong><br><span id="sim-amortization">-</span></div>
                <div><strong>Novo Saldo BRL:</strong><br><span id="sim-new-balance-brl">-</span></div>
                <div><strong>Novo Saldo Origem:</strong><br><span id="sim-new-balance-origin">-</span></div>
              </div>
              <div style="margin-top: 8px; font-size: 0.8rem; color: #6c757d;">
                <span id="sim-ptax-info"></span>
              </div>
            </div>

            <label style="font-weight: 600; display: flex; flex-direction: column; gap: 6px;">
              Descrição (opcional)
              <textarea id="loan-payment-description" rows="2" style="padding: 10px; border: 1px solid #d0d7de; border-radius: 6px;"></textarea>
            </label>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 22px;">
            <button id="loan-payment-cancel" style="padding: 10px 16px; border: 1px solid #d0d7de; border-radius: 6px; background: #f6f8fa; cursor: pointer;">Cancelar</button>
            <button id="loan-payment-confirm" style="padding: 10px 18px; border: none; border-radius: 6px; background: #0d6efd; color: #fff; font-weight: 600; cursor: pointer;">✅ Confirmar Pagamento</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const closeModal = () => document.getElementById(modalId)?.remove();
    document.getElementById('loan-payment-cancel')?.addEventListener('click', () => closeModal());

    // Se houver apenas um contrato ativo, selecionar e mostrar saldo automaticamente
    if (activeContracts.length === 1) {
      const contractSelect = document.getElementById('loan-payment-contract') as HTMLSelectElement;
      if (contractSelect) {
        contractSelect.value = activeContracts[0].id;
        this.updatePaymentModalBalance(activeContracts[0].id);
      }
    }

    // Event listener para mudança de contrato
    document.getElementById('loan-payment-contract')?.addEventListener('change', (e) => {
      const contractId = (e.target as HTMLSelectElement).value;
      this.updatePaymentModalBalance(contractId);
    });

    // Event listeners para atualização da simulação
    const updateSimulation = () => this.updatePaymentSimulation();
    document.getElementById('loan-payment-amount')?.addEventListener('input', updateSimulation);
    document.getElementById('loan-payment-date')?.addEventListener('input', updateSimulation);
    document.getElementById('loan-payment-currency')?.addEventListener('change', updateSimulation);
    document.querySelectorAll('input[name="allocation"]').forEach(el => {
      el.addEventListener('change', updateSimulation);
    });

    document.getElementById('loan-payment-confirm')?.addEventListener('click', async () => {
      const contractSelect = document.getElementById('loan-payment-contract') as HTMLSelectElement | null;
      const amountInput = document.getElementById('loan-payment-amount') as HTMLInputElement | null;
      const dateInput = document.getElementById('loan-payment-date') as HTMLInputElement | null;
      const currencyInput = document.getElementById('loan-payment-currency') as HTMLSelectElement | null;
      const descriptionInput = document.getElementById('loan-payment-description') as HTMLTextAreaElement | null;

      const contractId = contractSelect?.value;
      const amount = amountInput ? Number.parseFloat(amountInput.value) : NaN;
      const paymentDate = dateInput?.value;
      const currencyValue = currencyInput?.value.trim();
      const description = descriptionInput?.value.trim();

      if (!contractId || Number.isNaN(amount) || amount <= 0 || !paymentDate) {
        this.context.ui.showToast('Informe contrato, valor e data do pagamento.', 'warning');
        return;
      }

      const confirmBtn = document.getElementById('loan-payment-confirm') as HTMLButtonElement | null;
      if (confirmBtn) confirmBtn.disabled = true;

      try {
        await this.registerPayment(
          contractId,
          amount,
          paymentDate,
          currencyValue ? currencyValue.toUpperCase() : undefined,
          description || undefined
        );
        closeModal();
      } catch (error) {
        logger.error('[LoanPlugin] Erro ao registrar pagamento via modal:', error);
      } finally {
        if (confirmBtn) confirmBtn.disabled = false;
      }
    });
  }

  /**
   * Modal: Gerar ACCRUAL.
   */
  private showAccrualWizard(): void {
    if (this.contracts.size === 0) {
      this.context.ui.showToast('Nenhum contrato cadastrado.', 'warning');
      return;
    }

    const modalId = 'loan-accrual-modal';
    document.getElementById(modalId)?.remove();

    const sortedContracts = Array.from(this.contracts.values()).sort((a, b) => a.id.localeCompare(b.id));
    const optionsHTML = sortedContracts.map(contract => `
      <option value="${contract.id}">${contract.id} · ${contract.counterparty}</option>
    `).join('');

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    const formatDate = (date: Date) => date.toISOString().split('T')[0];

    const modalHTML = `
      <div id="${modalId}" style="position: fixed; inset: 0; background: rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; z-index: 10060;">
        <div style="background: #fff; border-radius: 10px; padding: 24px; width: 95%; max-width: 500px; box-shadow: 0 18px 40px rgba(15,23,42,0.2);">
          <h2 style="margin: 0 0 16px; font-size: 1.4rem;">Gerar ACCRUAL</h2>

          <div style="display: flex; flex-direction: column; gap: 14px;">
            <label style="font-weight: 600; display: flex; flex-direction: column; gap: 6px;">
              Contrato
              <select id="loan-accrual-contract" style="padding: 10px; border: 1px solid #d0d7de; border-radius: 6px;">
                ${optionsHTML}
              </select>
            </label>

            <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px;">
              <label style="font-weight: 600; display: flex; flex-direction: column; gap: 6px;">
                Início
                <input id="loan-accrual-start" type="date" value="${formatDate(startDate)}" style="padding: 10px; border: 1px solid #d0d7de; border-radius: 6px;" />
              </label>
              <label style="font-weight: 600; display: flex; flex-direction: column; gap: 6px;">
                Fim
                <input id="loan-accrual-end" type="date" value="${formatDate(endDate)}" style="padding: 10px; border: 1px solid #d0d7de; border-radius: 6px;" />
              </label>
            </div>

            <label style="font-weight: 600; display: flex; flex-direction: column; gap: 6px;">
              Frequência
              <select id="loan-accrual-frequency" style="padding: 10px; border: 1px solid #d0d7de; border-radius: 6px;">
                <option value="Diário">Diário</option>
                <option value="Mensal">Mensal</option>
                <option value="Anual">Anual</option>
              </select>
            </label>

            <label style="display: flex; align-items: center; gap: 8px; font-weight: 600;">
              <input id="loan-accrual-variation" type="checkbox" />
              Incluir variação PTAX (Contrato vs BCB)
            </label>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 22px;">
            <button id="loan-accrual-cancel" style="padding: 10px 16px; border: 1px solid #d0d7de; border-radius: 6px; background: #f6f8fa; cursor: pointer;">Cancelar</button>
            <button id="loan-accrual-confirm" style="padding: 10px 18px; border: none; border-radius: 6px; background: #0d6efd; color: #fff; font-weight: 600; cursor: pointer;">Gerar</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const closeModal = () => document.getElementById(modalId)?.remove();
    document.getElementById('loan-accrual-cancel')?.addEventListener('click', () => closeModal());

    document.getElementById('loan-accrual-confirm')?.addEventListener('click', async () => {
      const contractSelect = document.getElementById('loan-accrual-contract') as HTMLSelectElement | null;
      const startInput = document.getElementById('loan-accrual-start') as HTMLInputElement | null;
      const endInput = document.getElementById('loan-accrual-end') as HTMLInputElement | null;
      const freqSelect = document.getElementById('loan-accrual-frequency') as HTMLSelectElement | null;
      const variationCheckbox = document.getElementById('loan-accrual-variation') as HTMLInputElement | null;

      const contractId = contractSelect?.value;
      const startValue = startInput?.value;
      const endValue = endInput?.value;
      const frequency = freqSelect?.value || 'Diário';
      const showVariation = variationCheckbox?.checked ?? false;

      if (!contractId || !startValue || !endValue) {
        this.context.ui.showToast('Informe contrato e período.', 'warning');
        return;
      }

      const confirmBtn = document.getElementById('loan-accrual-confirm') as HTMLButtonElement | null;
      if (confirmBtn) confirmBtn.disabled = true;

      try {
        const rows = await this.generateAccrualSheet(
          contractId,
          startValue,
          endValue,
          this.normalizeFrequency(frequency),
          showVariation
        );
        this.context.ui.showToast(`ACCRUAL gerado com ${rows} períodos.`, 'success');
        closeModal();
      } catch (error) {
        logger.error('[LoanPlugin] Erro ao gerar ACCRUAL via modal:', error);
      } finally {
        if (confirmBtn) confirmBtn.disabled = false;
      }
    });
  }

  private showSyncPTAXModal(): void {
    const modalId = 'loan-sync-ptax-modal';
    document.getElementById(modalId)?.remove();

    const currencies = Array.from(
      new Set(
        Array.from(this.contracts.values())
          .filter(c => c.currency !== 'BRL')
          .map(c => c.currency)
      )
    );

    if (currencies.length === 0) {
      this.context.ui.showToast('Nenhum contrato em moeda estrangeira encontrado.', 'info');
      return;
    }

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    const formatDate = (date: Date) => date.toISOString().split('T')[0];

    const modalHTML = `
      <div id="${modalId}" style="position: fixed; inset: 0; background: rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; z-index: 10050;">
        <div style="background: #fff; border-radius: 8px; padding: 24px; width: 90%; max-width: 460px; box-shadow: 0 12px 32px rgba(0,0,0,0.24);">
          <h2 style="margin: 0 0 16px; font-size: 1.4rem;">Sincronizar PTAX</h2>

          <div style="margin-bottom: 12px;">
            <label style="display: block; margin-bottom: 4px; font-weight: 600;">Data inicial</label>
            <input id="loan-sync-start" type="date" value="${formatDate(startDate)}" style="width: 100%; padding: 8px 10px; border: 1px solid #d0d7de; border-radius: 4px;">
          </div>

          <div style="margin-bottom: 12px;">
            <label style="display: block; margin-bottom: 4px; font-weight: 600;">Data final</label>
            <input id="loan-sync-end" type="date" value="${formatDate(endDate)}" style="width: 100%; padding: 8px 10px; border: 1px solid #d0d7de; border-radius: 4px;">
          </div>

          <div style="margin-bottom: 12px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 600;">Moedas</label>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 8px;">
              ${currencies.map(curr => `
                <label style="display: flex; align-items: center; gap: 8px; font-size: 0.95rem;">
                  <input type="checkbox" value="${curr}" checked>
                  ${curr}
                </label>
              `).join('')}
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px;">
            <button id="loan-sync-cancel" style="padding: 8px 16px; border: 1px solid #d0d7de; border-radius: 4px; background: #f6f8fa; cursor: pointer;">Cancelar</button>
            <button id="loan-sync-confirm" style="padding: 8px 18px; border: none; border-radius: 4px; background: #0576ff; color: #fff; font-weight: 600; cursor: pointer;">Sincronizar</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const closeModal = () => document.getElementById(modalId)?.remove();

    document.getElementById('loan-sync-cancel')?.addEventListener('click', () => closeModal());

    document.getElementById('loan-sync-confirm')?.addEventListener('click', async () => {
      try {
        const startInput = document.getElementById('loan-sync-start') as HTMLInputElement | null;
        const endInput = document.getElementById('loan-sync-end') as HTMLInputElement | null;
        const selectedCurrencies = Array.from(
          document.querySelectorAll(`#${modalId} input[type="checkbox"]:checked`)
        ).map(el => (el as HTMLInputElement).value);

        if (!startInput?.value || !endInput?.value) {
          this.context.ui.showToast('Informe o período de sincronização.', 'warning');
          return;
        }

        if (selectedCurrencies.length === 0) {
          this.context.ui.showToast('Selecione pelo menos uma moeda.', 'warning');
          return;
        }

        closeModal();
        await this.fxIntegration.syncPTAX(startInput.value, endInput.value, selectedCurrencies);
        this.context.ui.showToast('Sincronização PTAX concluída.', 'success');
      } catch (error) {
        logger.error('[LoanPlugin] Erro ao sincronizar PTAX:', error);
        this.context.ui.showToast('Erro ao sincronizar PTAX.', 'error');
      }
    });
  }

  /**
   * Cleanup ao desativar plugin.
   */
  public async dispose(): Promise<void> {
    this.context.events.off?.('kernel:autosave-done', this.autosaveHandler);
    this.activeWizard?.dispose();
    this.activeWizard = undefined;
    this.dashboard?.dispose();
    this.dashboard = undefined;

    await this.saveContracts();
    await this.savePayments();
    logger.info('[LoanPlugin] Desativado');
  }

  /**
   * Abre a dashboard de gestão de contratos.
   */
  private showDashboard(): void {
    if (this.dashboard) {
      this.dashboard.open(this.contracts);
    } else {
      this.context.ui.showToast('Dashboard não disponível', 'warning');
    }
  }

  private async populateNextPaymentSnapshot(contract: LoanContract): Promise<void> {
    if (contract.paymentFlow.type === 'SCHEDULED' && contract.paymentFlow.scheduled) {
      const paymentsInfo = this.paymentManager.getTotalPayments(contract.id);
      const nextInstallment = paymentsInfo.count + 1;
      const nextDate = this.calculateNextPaymentDate(contract, nextInstallment);
      contract.currentBalance.nextPaymentDate = typeof nextDate === 'string' && nextDate !== 'N/A' ? nextDate : undefined;

      const nextAmount = await this.calculateNextPaymentAmount(contract, nextInstallment);
      contract.currentBalance.nextPaymentAmount = typeof nextAmount === 'number'
        ? LoanCalculator.round(nextAmount, 2)
        : undefined;
    } else {
      contract.currentBalance.nextPaymentDate = undefined;
      contract.currentBalance.nextPaymentAmount = undefined;
    }
  }

  private refreshContractSheets(): void {
    if (!this.sheets) return;
    const contracts = Array.from(this.contracts.values());
    if (contracts.length === 0) return;
    this.sheets.updateContractsSheet(contracts);
  }

  private refreshLedgerSheet(contractId: string): void {
    if (!this.sheets) return;
    const ledger = this.paymentManager.getLedger(contractId);
    if (ledger.length === 0) return;
    this.sheets.updateLedgerSheet(contractId, ledger);
  }

  private refreshAllLedgers(): void {
    if (!this.sheets) return;
    this.contracts.forEach((_contract, id) => {
      const ledger = this.paymentManager.getLedger(id);
      if (ledger.length > 0) {
        this.sheets.updateLedgerSheet(id, ledger);
      }
    });
  }

  private normalizeFrequency(value?: string): 'Diário' | 'Mensal' | 'Anual' {
    const normalized = (value || 'Diário').toString().toLowerCase();
    if (normalized.startsWith('m')) return 'Mensal';
    if (normalized.startsWith('a')) return 'Anual';
    return 'Diário';
  }

  private async generateAccrualSheet(
    contractId: string,
    startDate: string,
    endDate: string,
    frequency: 'Diário' | 'Mensal' | 'Anual',
    showVariation: boolean
  ): Promise<number> {
    const contract = this.contracts.get(contractId);
    if (!contract) {
      throw new Error(`Contrato ${contractId} não encontrado`);
    }

    const accrualRows = await this.scheduler.buildAccrualRows(
      contract,
      startDate,
      endDate,
      frequency,
      showVariation
    );

    // Record each accrual period in history
    const calculationDate = new Date().toISOString().split('T')[0];
    for (const row of accrualRows) {
      this.accrualHistory.recordAccrual({
        id: `${contractId}-${row.date}-${Date.now()}`,
        contractId,
        calculationDate,
        periodStart: startDate,
        periodEnd: row.date,
        openingBalanceOrigin: row.openingBalanceOrigin,
        openingBalanceBRL: row.openingBalanceBRL,
        interestOrigin: row.interestOrigin,
        interestBRL: row.interestBRL,
        closingBalanceOrigin: row.closingBalanceOrigin,
        closingBalanceBRL: row.closingBalanceBRL,
        fxRate: row.fxRate,
        fxSource: row.fxSource || 'N/A',
        effRate: row.effRate,
        days: row.days,
        createdAt: new Date().toISOString()
      });
    }

    const period = `${startDate}_${endDate}`;
    this.sheets.createAccrualSheet(contractId, period, accrualRows);
    return accrualRows.length;
  }

  private async generateScheduleSheet(contractId: string): Promise<number> {
    const contract = this.contracts.get(contractId);
    if (!contract) {
      throw new Error(`Contrato ${contractId} não encontrado`);
    }

    if (contract.paymentFlow.type !== 'SCHEDULED' || !contract.paymentFlow.scheduled) {
      return 0;
    }

    const scheduleRows = await this.scheduler.buildScheduleRows(contract);
    this.sheets.createScheduleSheet(contractId, scheduleRows);
    return scheduleRows.length;
  }

  /**
   * Calcula data da próxima parcela.
   */
  private calculateNextPaymentDate(contract: LoanContract, installmentNumber: number): string {
    if (contract.paymentFlow.type !== 'SCHEDULED' || !contract.paymentFlow.scheduled) {
      return 'N/A';
    }

    const scheduled = contract.paymentFlow.scheduled;
    const graceOffset = scheduled.gracePeriods || 0;

    // Calcula período do installment
    const periodNumber = installmentNumber - graceOffset;
    if (periodNumber <= 0) return 'N/A';

    // Usa o scheduler para calcular a data
    return this.scheduler.calculateInstallmentDate(
      contract.startDate,
      periodNumber,
      scheduled.periodicity
    );
  }

  /**
   * Calcula valor da próxima parcela.
   */
  private async calculateNextPaymentAmount(contract: LoanContract, installmentNumber: number): Promise<number | string> {
    if (contract.paymentFlow.type !== 'SCHEDULED' || !contract.paymentFlow.scheduled) {
      return 'N/A';
    }

    try {
      const scheduleRows = await this.scheduler.buildScheduleRows(contract);
      const installment = scheduleRows.find(row => row.installmentNumber === installmentNumber);

      return installment ? installment.paymentAmount : 'N/A';
    } catch (error) {
      logger.error('[LoanPlugin] Erro ao calcular valor da parcela:', error);
      return '#ERRO';
    }
  }

  /**
   * Atualiza informações do saldo no modal de pagamento.
   */
  private updatePaymentModalBalance(contractId: string): void {
    const contract = this.contracts.get(contractId);
    if (!contract) return;

    const balanceDiv = document.getElementById('loan-payment-balance');
    if (!balanceDiv) return;

    balanceDiv.style.display = 'block';

    // Saldo atual
    const balanceBRL = document.getElementById('balance-brl');
    const balanceOrigin = document.getElementById('balance-origin');
    const accruedInterest = document.getElementById('accrued-interest');
    const nextPayment = document.getElementById('next-payment');

    if (balanceBRL) balanceBRL.textContent = `R$ ${contract.currentBalance.balanceBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    if (balanceOrigin) balanceOrigin.textContent = `${contract.currency} ${contract.currentBalance.balanceOrigin.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    if (accruedInterest) accruedInterest.textContent = `R$ ${contract.currentBalance.accruedInterestBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

    // Próxima parcela
    if (nextPayment) {
      const nextAmount = contract.currentBalance.nextPaymentAmount;
      const nextDate = contract.currentBalance.nextPaymentDate;
      if (nextAmount && nextDate) {
        nextPayment.textContent = `R$ ${nextAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${nextDate})`;
      } else {
        nextPayment.textContent = 'N/A';
      }
    }
  }

  /**
   * Atualiza simulação do pagamento no modal.
   */
  private async updatePaymentSimulation(): Promise<void> {
    const contractSelect = document.getElementById('loan-payment-contract') as HTMLSelectElement | null;
    const amountInput = document.getElementById('loan-payment-amount') as HTMLInputElement | null;
    const dateInput = document.getElementById('loan-payment-date') as HTMLInputElement | null;
    const currencySelect = document.getElementById('loan-payment-currency') as HTMLSelectElement | null;
    const allocationInputs = document.querySelectorAll('input[name="allocation"]:checked') as NodeListOf<HTMLInputElement>;

    const contractId = contractSelect?.value;
    const amount = amountInput ? Number.parseFloat(amountInput.value) : 0;
    const paymentDate = dateInput?.value;
    const currency = currencySelect?.value || 'BRL';
    const allocation = allocationInputs[0]?.value || 'AUTO';

    if (!contractId || !amount || !paymentDate) {
      document.getElementById('loan-payment-simulation')!.style.display = 'none';
      return;
    }

    const contract = this.contracts.get(contractId);
    if (!contract) return;

    try {
      // Simular o pagamento
      const simulation = await this.simulatePayment(contract, amount, paymentDate, currency, allocation);

      // Atualizar UI
      const simDiv = document.getElementById('loan-payment-simulation');
      if (simDiv) simDiv.style.display = 'block';

      document.getElementById('sim-interest')!.textContent = `R$ ${simulation.interestPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
      document.getElementById('sim-amortization')!.textContent = `R$ ${simulation.amortization.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
      document.getElementById('sim-new-balance-brl')!.textContent = `R$ ${simulation.newBalanceBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
      document.getElementById('sim-new-balance-origin')!.textContent = `${contract.currency} ${simulation.newBalanceOrigin.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
      document.getElementById('sim-ptax-info')!.textContent = simulation.ptaxInfo;

    } catch (error) {
      logger.error('[LoanPlugin] Erro na simulação:', error);
      document.getElementById('loan-payment-simulation')!.style.display = 'none';
    }
  }

  /**
   * Simula um pagamento para mostrar na UI.
   */
  private async simulatePayment(
    contract: LoanContract,
    amount: number,
    paymentDate: string,
    currency: string,
    allocation: string
  ): Promise<{
    interestPaid: number;
    amortization: number;
    newBalanceBRL: number;
    newBalanceOrigin: number;
    ptaxInfo: string;
  }> {
    // Converter valor para BRL se necessário
    let amountBRL = amount;
    let ptaxInfo = '';

    if (currency !== 'BRL') {
      const rateInfo = await this.fxIntegration.getConversionRate(paymentDate, currency);
      if (rateInfo) {
        amountBRL = amount * rateInfo.rate;
        ptaxInfo = `(usando PTAX: ${rateInfo.rate.toFixed(4)} em ${paymentDate})`;
      }
    }

    // Calcular juros acumulados até a data do pagamento
    const accruedInterestResult = await this.calculateInterest(contract.id, contract.currentBalance.lastUpdateDate, paymentDate);
    const accruedInterest = typeof accruedInterestResult === 'number' ? accruedInterestResult : 0;

    // Aplicar alocação
    let interestPaid = 0;
    let amortization = 0;

    if (allocation === 'AUTO') {
      // Primeiro juros, depois principal
      interestPaid = Math.min(amountBRL, accruedInterest);
      amortization = amountBRL - interestPaid;
    } else if (allocation === 'INTEREST_ONLY') {
      interestPaid = amountBRL;
      amortization = 0;
    } else if (allocation === 'PRINCIPAL_ONLY') {
      interestPaid = 0;
      amortization = amountBRL;
    }

    // Calcular novos saldos
    const currentBalanceBRL = contract.currentBalance.balanceBRL;
    const newBalanceBRL = Math.max(0, currentBalanceBRL - amortization);

    // Converter novo saldo para moeda origem
    const rateInfo = await this.fxIntegration.getConversionRate(paymentDate, contract.currency);
    const newBalanceOrigin = rateInfo ? newBalanceBRL / rateInfo.rate : contract.currentBalance.balanceOrigin;

    return {
      interestPaid,
      amortization,
      newBalanceBRL,
      newBalanceOrigin,
      ptaxInfo
    };
  }
}
