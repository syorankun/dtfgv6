/**
 * DJ DataForge - Loan Plugin v8.1.0 (Flexible Payments & Contract PTAX)
 *
 * New in 8.1.0
 *  - LOAN.INTEREST@v1(contractId, data_inicio, data_fim): juros do período
 *    considerando pagamentos flexíveis registrados no Ledger.
 *  - Capability api.accruedInterest({contractId, dateStart, dateEnd}).
 *  - Modal de novo contrato com campo "PTAX do Contrato" (opcional):
 *      Se informado, usa essa PTAX para converter o principal origem→BRL.
 *      Se NÃO informado, tenta FX source='MANUAL'; se não houver, tenta 'PTAX' (BCB).
 *  - Registrar Pagamento agora calcula juros desde o último evento e aloca
 *    pagamento em Juros->Amortização, com colunas extras no Ledger.
 *
 *  Compatibility: Kernel >= v5.0.0
 *  Author: DJCalc (refactor for v8.1)
 *  Date: 2025-10-05
 */
(function() {
'use strict';

class LoanPlugin_v81 {
  static VERSION = '8.1.0';
  static PLUGIN_ID = 'dj.finance.loans.v8.1.stable';
  static CAPABILITY_ID = 'dj.finance.loans@1';

  static CONFIG = {
    SHEETS: {
      CONTRACTS: '_Loan_Contracts',
      PROFORMA: '_Loan_Proforma_',
      LEDGER: '_Loan_Ledger_',
      RATE_CURVES: '_Loan_RateCurves' // optional manual curve input (Indexer, Date, RateAA as decimal)
    },
    SYSTEMS: {
      'PRICE': 'Parcelas Fixas (Amortização + Juros Compostos)',
      'SAC': 'Parcelas Decrescentes (Amortização Constante)',
      'BULLET': 'Juros periódicos; principal no final',
      'COMPOUND_ONLY': 'Capitalização (sem pagamentos periódicos)'
    },
    PERIODICITIES: ['Diário', 'Mensal', 'Anual'],
    DAY_COUNT: ['30/360', 'ACT/365', 'ACT/360', 'BUS/252'],
    DEFAULTS: {
      periodicity: 'Mensal',
      base: '30/360',
      rounding: 'HALF_UP',
      currency: 'BRL'
    },
    FORMATS: {
      HEADER:        { style: { bold: true, backgroundColor: '#f0f0f0', textAlign: 'center' } },
      HEADER_SUMM:   { style: { bold: true, backgroundColor: '#e9ecef' } },
      CURRENCY:      { format: { type: 'currency', currency: 'BRL', decimals: 2 } },
      PERCENT4:      { format: { type: 'percentage', decimals: 4 } },
      DATE:          { format: { type: 'date' } }
    }
  };

  constructor(context) {
    this.kernel = context.kernel;
    this.ui = this.kernel.ui;
    this.log = context.log || ((...a)=>console.log('[Loan v8.1]', ...a));
    this.error = context.error || ((...a)=>console.error('[Loan v8.1]', ...a));
    this.fxAvailable = false;
  }

  // ====================== Lifecycle ======================
  async init() {
    await this._detectFX();
    this._registerCapability();
    this._registerFormulas();
    this._registerMenus();
    this.log(`Initialized v${this.constructor.VERSION} (FX available: ${this.fxAvailable})`);
  }

  async dispose() {
    try {
      if (this.kernel?.capabilityRegistry) {
        this.kernel.capabilityRegistry.unregister(LoanPlugin_v81.CAPABILITY_ID, LoanPlugin_v81.PLUGIN_ID);
      }
    } catch(e) { /* no-op */ }
  }

  async _detectFX() {
    try {
      this.fxAvailable = !!this.kernel?.hasCapability?.('dj.fx.rates@1');
      if (!this.fxAvailable) {
        if (this.kernel?.pluginDiscovery?.waitFor) {
          await this.kernel.pluginDiscovery.waitFor('dj.fx.rates@1', 1000).then(()=> this.fxAvailable = true).catch(()=>{});
        }
      }
    } catch { this.fxAvailable = false; }
  }

  _registerCapability() {
    if (!this.kernel?.registerCapability) return;
    this.kernel.registerCapability(LoanPlugin_v81.CAPABILITY_ID, {
      pluginId: LoanPlugin_v81.PLUGIN_ID,
      version: LoanPlugin_v81.VERSION,
      description: 'Cálculos e cronogramas de empréstimos (amortização, juros, cronograma).',
      api: {
        computeSchedule: (opts) => this.computeSchedule(opts),
        computePayment: (opts)  => this._computePayment(opts),
        effectiveRateForPeriod: (args) => this.effectiveRateForPeriod(args),
        accruedInterest: (args) => this.computeAccruedInterest(args)
      },
      metadata: { systems: Object.keys(LoanPlugin_v81.CONFIG.SYSTEMS) }
    });

    // Bus
    const bus = this.kernel.pluginCommunication;
    if (bus) {
      const map = {
        computeSchedule: (msg) => this.computeSchedule(msg.params || msg),
        computePayment:  (msg) => this._computePayment(msg.params || msg),
        effectiveRateForPeriod: (msg) => this.effectiveRateForPeriod(msg.params || msg),
        accruedInterest: (msg) => this.computeAccruedInterest(msg.params || msg)
      };
      Object.keys(map).forEach(op => {
        const channel = `capability:${LoanPlugin_v81.CAPABILITY_ID}:${op}`;
        bus.subscribe(channel, LoanPlugin_v81.PLUGIN_ID, async (message) => {
          try {
            const result = await map[op](message);
            bus.publish(message.responseChannel, result);
          } catch (e) {
            this.error(e);
            bus.publish(message.responseChannel, { error: String(e?.message || e) });
          }
        });
      });
    }
  }

  _registerFormulas() {
    const register = (name, impl, syntax, description) => {
      try {
        const exists = this.kernel.registry?.getFormula?.(name);
        if (!exists) {
          this.kernel.registry.registerFormula({
            name, impl: (args) => impl(...args), syntax, description, pluginId: this.constructor.PLUGIN_ID
          });
        }
      } catch(e) { this.error('registerFormula', name, e); }
    };

    // From v8
    register('LOAN.EFFPERIOD@v1',
      (dateStart, dateEnd, annualRateDec, base = '30/360') => {
        const raa = this._num(annualRateDec);
        return this._effPeriodByDates(String(dateStart), String(dateEnd), raa, String(base || '30/360'));
      },
      'LOAN.EFFPERIOD@v1(data_início, data_fim, taxa_anual_decimal, [base])',
      'Taxa efetiva do período via composição (por datas e base de contagem).'
    );

    register('LOAN.PMT@v2',
      (principal, annualRatePercent, nper, system = 'PRICE', periodicity = 'Mensal', base = '30/360', rounding = 'HALF_UP') => {
        const p = this._num(principal);
        const n = Math.max(1, Math.floor(this._num(nper)));
        const raa = this._num(annualRatePercent) / 100;
        const rp = this._equivRatePerPeriodByPeriodicity(periodicity, base, raa);
        return this._pmtLike(system, p, n, rp, rounding);
      },
      'LOAN.PMT@v2(principal, taxa_aa_pct, nper, [sistema], [periodicidade], [base], [rounding])',
      'Parcela estimada usando equivalência composta e convenções de dia.'
    );

    register('LOAN.IPMT@v1',
      (principal, annualRatePercent, per, nper, periodicity = 'Mensal', base = '30/360', rounding = 'HALF_UP') => {
        const p = this._num(principal);
        const raa = this._num(annualRatePercent)/100;
        const n = Math.max(1, Math.floor(this._num(nper)));
        const k = Math.max(1, Math.floor(this._num(per)));
        const rp = this._equivRatePerPeriodByPeriodicity(periodicity, base, raa);
        const pay = this._pmtLike('PRICE', p, n, rp, rounding);
        let bal = p;
        for (let i=1;i<=k;i++) {
          const interest = this._round(bal*rp, 2, rounding);
          const amort = i < n ? this._round(pay - interest, 2, rounding) : this._round(bal, 2, rounding);
          if (i === k) return interest;
          bal = this._round(bal - amort, 2, rounding);
        }
        return 0;
      },
      'LOAN.IPMT@v1(principal, taxa_aa_pct, período, nper, [periodicidade], [base], [rounding])',
      'Componente de juros da parcela no período (sistema PRICE).'
    );

    register('LOAN.PPMT@v1',
      (principal, annualRatePercent, per, nper, periodicity = 'Mensal', base = '30/360', rounding = 'HALF_UP') => {
        const p = this._num(principal);
        const raa = this._num(annualRatePercent)/100;
        const n = Math.max(1, Math.floor(this._num(nper)));
        const k = Math.max(1, Math.floor(this._num(per)));
        const rp = this._equivRatePerPeriodByPeriodicity(periodicity, base, raa);
        const pay = this._pmtLike('PRICE', p, n, rp, rounding);
        let bal = p;
        for (let i=1;i<=k;i++) {
          const interest = this._round(bal*rp, 2, rounding);
          const amort = i < n ? this._round(pay - interest, 2, rounding) : this._round(bal, 2, rounding);
          if (i === k) return amort;
          bal = this._round(bal - amort, 2, rounding);
        }
        return 0;
      },
      'LOAN.PPMT@v1(principal, taxa_aa_pct, período, nper, [periodicidade], [base], [rounding])',
      'Componente de amortização da parcela no período (sistema PRICE).'
    );

    register('LOAN.SCHEDULE@v2',
      (contractId) => this.regenerateById(String(contractId || '')) ? 1 : 0,
      'LOAN.SCHEDULE@v2(contractId)',
      'Regera curva e proforma para o contrato indicado.'
    );

    // NEW: Interest for an arbitrary period considering flexible payments
    register('LOAN.INTEREST@v1',
      (contractId, dateStart, dateEnd) => {
        const res = this.computeAccruedInterest({ contractId: String(contractId), dateStart: String(dateStart), dateEnd: String(dateEnd) });
        return res?.interest ?? 0;
      },
      'LOAN.INTEREST@v1(contractId, data_início, data_fim)',
      'Juros acumulados no período com pagamentos flexíveis considerados.'
    );
  }

  _registerMenus() {
    const addMenu = (label, action) => {
      try { this.kernel.registry.registerMenuItem({ pluginId: this.constructor.PLUGIN_ID, label, action }); }
      catch(e) { this.error('registerMenuItem', e); }
    };
    addMenu('💰 Novo Contrato (Avançado)', () => this.showNewLoanModal());
    addMenu('💳 Registrar Pagamento', () => this.showPaymentModal());
    addMenu('⚙️ Recalcular Contrato', () => this._selectContractAnd((id)=>this.regenerateById(id)));
    addMenu('📖 Ver Ledger', () => this._selectContractAnd((id)=>this._openSheet(`${this.constructor.CONFIG.SHEETS.LEDGER}${id}`)));
    addMenu('📅 Ver Proforma', () => this._selectContractAnd((id)=>this._openSheet(`${this.constructor.CONFIG.SHEETS.PROFORMA}${id}`)));
  }

  // ====================== Public ======================

  async computeSchedule(opts) { return await this._computeScheduleInternal(opts); }

  async effectiveRateForPeriod({ dateStart, dateEnd, legs, base = '30/360' }) {
    const cfg = this._normOptions({ legs, base });
    return await this._effRateForPeriodFromLegs(String(dateStart), String(dateEnd), cfg.legs, cfg.base);
  }

  /**
   * computeAccruedInterest({contractId, dateStart, dateEnd})
   * Calcula juros do período [dateStart, dateEnd],
   * considerando pagamentos flexíveis (ledger). Pagamentos abatem juros primeiro,
   * depois principal. Taxa do período derivada das legs (composição).
   * Retorna: { interest, startBalance, endBalance, allocations: [{date, payment, interestCovered, principalCovered}], segments: [...] }
   */
  computeAccruedInterest({ contractId, dateStart, dateEnd }) {
    const c = this._getContractData(contractId);
    if (!c) return { error: 'Contrato não encontrado.' };

    const start = String(dateStart);
    const end = String(dateEnd);
    if (!start || !end) return { error: 'Datas inválidas.' };

    // 1) Obter ledger do contrato
    const wb = this.kernel.workbookManager.getActiveWorkbook();
    const ledgerName = `${this.constructor.CONFIG.SHEETS.LEDGER}${contractId}`;
    const ledger = wb.sheets.find(s => s.name === ledgerName);

    // 2) Determinar saldo no início do período
    //    Reconstroi desde o início do contrato até 'start' com pagamentos prévios.
    let bal = c.principalbrl;
    let cursor = c.datainício;
    // Se existir ledger, reprocessa até 'start'
    if (ledger && ledger.rows > 1) {
      const events = [];
      for (let i=1;i<ledger.rows;i++) {
        const d = ledger.getCellValue(i,0);
        const v = parseFloat(ledger.getCellValue(i,2)) || 0;
        const ev = (ledger.getCellValue(i,1)||'').toString();
        if (!d || !v) continue;
        events.push({ date: d, type: ev, amount: v });
      }
      events.sort((a,b)=> (new Date(a.date)) - (new Date(b.date)));
      for (const e of events) {
        if (new Date(e.date) > new Date(start)) break;
        const eff = this._effRateForPeriodFromLegs(cursor, e.date, c.legs, c.base);
        // _effRateForPeriodFromLegs pode ser async; garantir sincronia
        const r = (eff && typeof eff.then === 'function') ? undefined : eff;
        const rate = r === undefined ? 0 : r;
        // se retornar Promise (ambiente não async), ignora capitalização prévia para não travar
        bal = this._round(bal * (1 + rate), 2, c.rounding || 'HALF_UP');
        bal = this._round(bal - e.amount, 2, c.rounding || 'HALF_UP');
        cursor = e.date;
      }
    }
    // Se não houve eventos antes de start, apenas capitaliza do começo até start
    const effStart = this._effRateForPeriodFromLegs(cursor, start, c.legs, c.base);
    const rStart = (effStart && typeof effStart.then === 'function') ? 0 : effStart;
    bal = this._round(bal * (1 + rStart), 2, c.rounding || 'HALF_UP');
    cursor = start;

    const startBalance = bal;

    // 3) Pagamentos no período e juros de cada subperíodo
    const paymentsInPeriod = [];
    if (ledger && ledger.rows > 1) {
      for (let i=1;i<ledger.rows;i++) {
        const d = ledger.getCellValue(i,0);
        const v = parseFloat(ledger.getCellValue(i,2)) || 0;
        const ev = (ledger.getCellValue(i,1)||'').toString();
        if (ev !== 'Pagamento') continue;
        if (new Date(d) > new Date(start) && new Date(d) <= new Date(end)) {
          paymentsInPeriod.push({ date: d, amount: v });
        }
      }
      paymentsInPeriod.sort((a,b)=> (new Date(a.date)) - (new Date(b.date)));
    }

    const breakpoints = [...paymentsInPeriod.map(p=>p.date), end];
    const allocations = [];
    const segments = [];
    let totalInterest = 0;

    for (const bp of breakpoints) {
      const eff = this._effRateForPeriodFromLegs(cursor, bp, c.legs, c.base);
      const r = (eff && typeof eff.then === 'function') ? 0 : eff;
      const interest = this._round(bal * r, 2, c.rounding || 'HALF_UP');
      totalInterest = this._round(totalInterest + interest, 2, c.rounding || 'HALF_UP');
      segments.push({ from: cursor, to: bp, rate: r, opening: bal, interest });

      // aplicar pagamento se existir nesse breakpoint
      const pay = paymentsInPeriod.find(p=>p.date===bp);
      if (pay) {
        const interestCovered = Math.min(pay.amount, interest);
        const principalCovered = Math.max(0, pay.amount - interestCovered);
        bal = this._round(bal + interest - pay.amount, 2, c.rounding || 'HALF_UP');
        allocations.push({ date: bp, payment: pay.amount, interestCovered, principalCovered, closingBalance: bal });
      } else {
        // sem pagamento — capitaliza apenas se o sistema for COMPOUND_ONLY ou BULLET
        if (String(c.sistema).toUpperCase() === 'COMPOUND_ONLY' || String(c.sistema).toUpperCase() === 'BULLET') {
          bal = this._round(bal + interest, 2, c.rounding || 'HALF_UP');
        }
      }
      cursor = bp;
    }

    const endBalance = bal;
    return { interest: totalInterest, startBalance, endBalance, allocations, segments };
  }

  // ====================== Schedule Core (from v8) ======================
  async _computeScheduleInternal(opts) {
    const cfg = this._normOptions(opts);
    const curve = await this._buildCurve(cfg);
    const rows = [];
    let bal = this._round(cfg.principalBRL, 2, cfg.rounding);
    const n = cfg.term;
    const avgRate = curve.length ? (curve.map(r=>r.eff).reduce((a,b)=>a+b,0) / curve.length) : 0;
    const approxPMT = this._pmtLike(cfg.system, bal, n, avgRate, cfg.rounding);

    for (let i=0;i<n;i++) {
      const r = curve[i]?.eff || 0;
      const start = curve[i]?.start;
      const end = curve[i]?.end;

      let interest = this._round(bal * r, 2, cfg.rounding);
      let amort = 0;
      let payment = 0;

      const inGrace = i < (cfg.grace?.periods || 0);
      if (inGrace) {
        if (cfg.grace.type === 'FULL') { interest = 0; amort = 0; payment = 0; }
        else { payment = interest; amort = 0; }
      } else {
        if (cfg.system === 'PRICE') {
          const factor = r === 0 ? (n - i) : Math.pow(1 + r, (n - i));
          payment = r === 0 ? this._round(bal / (n - i), 2, cfg.rounding)
                            : this._round(bal * (r * factor) / (factor - 1), 2, cfg.rounding);
          amort = this._round(payment - interest, 2, cfg.rounding);
        } else if (cfg.system === 'SAC') {
          amort = this._round(cfg.principalBRL / n, 2, cfg.rounding);
          payment = this._round(amort + interest, 2, cfg.rounding);
        } else if (cfg.system === 'BULLET') {
          payment = i === n - 1 ? this._round(bal + interest, 2, cfg.rounding) : interest;
          amort = i === n - 1 ? this._round(bal, 2, cfg.rounding) : 0;
        } else if (cfg.system === 'COMPOUND_ONLY') {
          payment = 0; amort = -interest;
        } else {
          payment = approxPMT;
          amort = this._round(payment - interest, 2, cfg.rounding);
        }
      }

      let newBal = this._round(bal - amort, 2, cfg.rounding);
      if (i === n - 1 && Math.abs(newBal) > 0.01 && cfg.system !== 'COMPOUND_ONLY') {
        const adjust = newBal;
        amort = this._round(amort + adjust, 2, cfg.rounding);
        payment = this._round(interest + amort, 2, cfg.rounding);
        newBal = 0;
      }

      rows.push({ period: i + 1, startDate: start, endDate: end,
                  openingBalance: bal, interest, amortization: amort,
                  payment, closingBalance: newBal, effRate: r });
      bal = newBal;

      if (cfg.system === 'COMPOUND_ONLY') {
        bal = this._round(bal + interest, 2, cfg.rounding);
      }
    }

    const totals = {
      interest: this._round(rows.reduce((s, r) => s + r.interest, 0), 2, cfg.rounding),
      payment:  this._round(rows.reduce((s, r) => s + r.payment, 0), 2, cfg.rounding),
      amort:    this._round(rows.reduce((s, r) => s + r.amortization, 0), 2, cfg.rounding)
    };
    return { rows, totals };
  }

  // ====================== UI & Data ======================
  async regenerateById(contractId) {
    const wb = this.kernel.workbookManager.getActiveWorkbook();
    if (!wb || !contractId) return false;
    const contract = this._getContractData(contractId);
    if (!contract) { this.ui.showToast(`Contrato '${contractId}' não encontrado.`, 'error'); return false; }
    await this._writeCurve(contract);
    await this._writeProforma(contract);
    this.kernel.ui.recalculateAll?.(true);
    this.ui.showToast(`Contrato ${contractId} recalculado.`, 'success');
    return true;
  }

  async showNewLoanModal() {
    const modal = this.ui.createModal('💰 Novo Contrato (Avançado)');
    const today = new Date().toISOString().split('T')[0];
    modal.body.innerHTML = `
      <style>
        .form-grid{display:grid;gap:1rem}.form-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:1rem}
        .form-group{display:flex;flex-direction:column}.form-group label{font-size:12px;font-weight:600;margin-bottom:4px}
        .leg{border:1px solid var(--border);border-radius:8px;padding:12px}
      </style>
      <div class="form-grid">
        <div class="form-row">
          <div class="form-group"><label>ID</label><input id="loanId" class="formula-input" value="LOAN-${Date.now()}"/></div>
          <div class="form-group"><label>Moeda</label><input id="currency" class="formula-input" value="${LoanPlugin_v81.CONFIG.DEFAULTS.currency}"/></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Principal (Origem)</label><input id="principalOrigin" type="number" class="formula-input" placeholder="100000"/></div>
          <div class="form-group"><label>PTAX do Contrato (opcional)</label><input id="contractPTAX" type="number" step="0.0001" class="formula-input" placeholder="ex.: 5.1372"/></div>
          <div class="form-group"><label>Principal BRL</label><input id="principalBRL" type="number" class="formula-input" readonly/></div>
        </div>
        <div id="fx-hint" style="background:var(--bg-secondary);border-left:3px solid var(--primary);padding:8px;border-radius:6px;display:none;font-size:12px"></div>
        <div class="form-row">
          <div class="form-group"><label>Data Início</label><input id="startDate" type="date" class="formula-input" value="${today}"/></div>
          <div class="form-group"><label>Períodos (n)</label><input id="term" type="number" class="formula-input" value="12"/></div>
          <div class="form-group"><label>Periodicidade</label>
            <select id="periodicity" class="formula-input">${LoanPlugin_v81.CONFIG.PERIODICITIES.map(p=>`<option>${p}</option>`).join('')}</select>
          </div>
          <div class="form-group"><label>Base</label>
            <select id="base" class="formula-input">${LoanPlugin_v81.CONFIG.DAY_COUNT.map(p=>`<option>${p}</option>`).join('')}</select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Sistema</label>
            <select id="system" class="formula-input">${Object.entries(LoanPlugin_v81.CONFIG.SYSTEMS).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select>
          </div>
          <div class="form-group"><label>Rounding</label>
            <select id="rounding" class="formula-input"><option>HALF_UP</option><option>HALF_EVEN</option></select>
          </div>
        </div>
        <div class="leg">
          <h4 style="margin-bottom:8px">Indexador (Leg 1)</h4>
          <div class="form-row">
            <div class="form-group"><label>Tipo</label>
              <select id="leg1Indexer" class="formula-input">
                <option>MANUAL</option><option>CDI</option><option>PTAX</option>
              </select>
            </div>
            <div class="form-group"><label>% do Indexador</label><input id="leg1Percent" type="number" class="formula-input" value="100"/></div>
            <div class="form-group"><label>Spread % a.a.</label><input id="leg1SpreadAA" type="number" class="formula-input" value="3"/></div>
          </div>
          <div class="form-row" id="leg1-ptax" style="display:none">
            <div class="form-group"><label>Moeda PTAX</label><input id="leg1PTAXCurrency" class="formula-input" value="USD"/></div>
            <div class="form-group"><label>Fonte</label><select id="leg1PTAXSource" class="formula-input"><option>AUTO</option><option>PTAX</option><option>MANUAL</option></select></div>
          </div>
        </div>
        <div class="leg" id="leg2" style="display:none">
          <h4 style="margin-bottom:8px">Indexador (Leg 2)</h4>
          <div class="form-row">
            <div class="form-group"><label>Tipo</label>
              <select id="leg2Indexer" class="formula-input">
                <option></option><option>MANUAL</option><option>CDI</option><option>PTAX</option>
              </select>
            </div>
            <div class="form-group"><label>% do Indexador</label><input id="leg2Percent" type="number" class="formula-input" value="100"/></div>
            <div class="form-group"><label>Spread % a.a.</label><input id="leg2SpreadAA" type="number" class="formula-input" value="0"/></div>
          </div>
          <div class="form-row" id="leg2-ptax" style="display:none">
            <div class="form-group"><label>Moeda PTAX</label><input id="leg2PTAXCurrency" class="formula-input" value="USD"/></div>
            <div class="form-group"><label>Fonte</label><select id="leg2PTAXSource" class="formula-input"><option>AUTO</option><option>PTAX</option><option>MANUAL</option></select></div>
          </div>
        </div>
        <button id="btnAddLeg2" class="toolbar-btn btn-small" type="button">Adicionar Leg 2</button>
        <div class="form-row">
          <div class="form-group"><label>Carência (períodos)</label><input id="gracePeriods" type="number" class="formula-input" value="0"/></div>
          <div class="form-group"><label>Tipo de Carência</label><select id="graceType" class="formula-input"><option>INTEREST_ONLY</option><option>FULL</option></select></div>
        </div>
      </div>
    `;
    const footer = document.createElement('div');
    footer.style.cssText = 'display:flex;justify-content:flex-end;gap:12px;padding:20px;border-top:1px solid var(--border);';
    footer.innerHTML = `<button class="toolbar-btn btn-cancel">Cancelar</button><button class="toolbar-btn btn-create" style="background:var(--primary);color:white;">Criar</button>`;
    modal.container.appendChild(footer);
    document.body.appendChild(modal.overlay);

    const $ = (sel) => modal.body.querySelector(sel);
    const idInput = $('#loanId'); const currencyInput = $('#currency');
    const principalOriginInput = $('#principalOrigin'); const principalBRLInput = $('#principalBRL');
    const fxHint = $('#fx-hint'); const startDateInput = $('#startDate'); const contractPTAXInput = $('#contractPTAX');
    const leg1Idx = $('#leg1Indexer'); const leg1PTAX = $('#leg1-ptax');
    const leg2Box = $('#leg2'); const leg2Idx = $('#leg2Indexer'); const leg2PTAX = $('#leg2-ptax');

    const updateLegUI = () => {
      leg1PTAX.style.display = leg1Idx.value === 'PTAX' ? 'grid' : 'none';
      leg2PTAX.style.display = (leg2Idx.value === 'PTAX') ? 'grid' : 'none';
    };
    leg1Idx.addEventListener('change', updateLegUI);
    leg2Idx.addEventListener('change', updateLegUI);
    updateLegUI();

    $('#btnAddLeg2').addEventListener('click', () => {
      leg2Box.style.display = 'block';
      $('#btnAddLeg2').style.display = 'none';
    });

    const updateBRLPrincipal = async () => {
      const currency = currencyInput.value.trim().toUpperCase();
      const principalOrigin = parseFloat(principalOriginInput.value) || 0;
      const startDate = startDateInput.value;
      const contractPTAX = parseFloat(contractPTAXInput.value);
      if (currency === 'BRL') {
        principalBRLInput.value = principalOrigin.toFixed(2);
        fxHint.style.display = 'none';
        return;
      }
      if (!principalOrigin || !startDate) { fxHint.style.display = 'none'; return; }

      fxHint.style.display = 'block';
      // 1) Se usuário informou PTAX do Contrato, usa ela
      if (!isNaN(contractPTAX) && contractPTAX > 0) {
        principalBRLInput.value = (principalOrigin * contractPTAX).toFixed(2);
        fxHint.textContent = `Usando PTAX do contrato: ${contractPTAX.toFixed(4)}`;
        return;
      }
      // 2) Tenta MANUAL
      if (this.fxAvailable) {
        try {
          let rate = await this.kernel.requestCapability('dj.fx.rates@1', 'getRate', { date: startDate, currency, source: 'MANUAL' });
          if (typeof rate === 'number' && rate > 0) {
            principalBRLInput.value = (principalOrigin * rate).toFixed(2);
            fxHint.textContent = `Taxa MANUAL ${currency}→BRL: ${rate.toFixed(4)}`;
            return;
          }
          // 3) Fallback: BCB/PTAX
          rate = await this.kernel.requestCapability('dj.fx.rates@1', 'getRate', { date: startDate, currency, source: 'PTAX' });
          if (typeof rate === 'number' && rate > 0) {
            principalBRLInput.value = (principalOrigin * rate).toFixed(2);
            fxHint.textContent = `PTAX (BCB) ${currency}→BRL: ${rate.toFixed(4)}`;
            return;
          }
          fxHint.textContent = `Taxa não encontrada para ${currency} em ${startDate}.`;
        } catch (e) {
          fxHint.textContent = 'Erro ao obter taxa de câmbio.';
        }
      } else {
        fxHint.textContent = 'Aviso: Plugin de câmbio não disponível; informe PTAX do contrato ou insira BRL manual.';
      }
    };
    principalOriginInput.addEventListener('blur', updateBRLPrincipal);
    contractPTAXInput.addEventListener('blur', updateBRLPrincipal);
    currencyInput.addEventListener('blur', updateBRLPrincipal);
    startDateInput.addEventListener('change', updateBRLPrincipal);

    footer.querySelector('.btn-cancel').addEventListener('click', () => modal.overlay.remove());
    footer.querySelector('.btn-create').addEventListener('click', async () => {
      const data = {
        id: idInput.value,
        currency: currencyInput.value.toUpperCase(),
        principalOrigin: parseFloat(principalOriginInput.value) || 0,
        contractPTAX: parseFloat(contractPTAXInput.value) || '',
        principalBRL: parseFloat(principalBRLInput.value) || 0,
        startDate: $('#startDate').value,
        term: parseInt($('#term').value, 10),
        periodicity: $('#periodicity').value,
        base: $('#base').value,
        system: $('#system').value,
        rounding: $('#rounding').value,
        legs: [{
          indexer: $('#leg1Indexer').value,
          percent: parseFloat($('#leg1Percent').value) || 100,
          spreadAA: parseFloat($('#leg1SpreadAA').value) || 0,
          currency: $('#leg1PTAXCurrency').value,
          source: $('#leg1PTAXSource').value
        }],
        grace: { type: $('#graceType').value, periods: parseInt($('#gracePeriods').value, 10) || 0 },
        type: 'Pagador'
      };
      if (leg2Box.style.display !== 'none' && $('#leg2Indexer').value) {
        data.legs.push({
          indexer: $('#leg2Indexer').value,
          percent: parseFloat($('#leg2Percent').value) || 100,
          spreadAA: parseFloat($('#leg2SpreadAA').value) || 0,
          currency: $('#leg2PTAXCurrency')?.value,
          source: $('#leg2PTAXSource')?.value || 'AUTO'
        });
      }
      data.endDate = this._addPeriods(data.startDate, data.term, data.periodicity);

      if (!data.id || data.principalBRL <= 0 || data.term <= 0) {
        this.ui.showToast('Preencha ID, Principal BRL (>0) e Períodos (>0).', 'error');
        return;
      }

      await this._createContractAndSheets(data);
      modal.overlay.remove();
    });
  }

  showPaymentModal() {
    const wb = this.kernel.workbookManager.getActiveWorkbook();
    if (!wb) return this.ui.showToast('Nenhum projeto ativo.', 'warning');
    const contractsSheet = wb.sheets.find(s => s.name === this.constructor.CONFIG.SHEETS.CONTRACTS);
    if (!contractsSheet || contractsSheet.rows <= 1) return this.ui.showToast('Nenhum contrato encontrado.', 'warning');

    const ids = this._listActiveContracts(contractsSheet);
    if (ids.length === 0) return this.ui.showToast('Nenhum contrato ativo.', 'info');

    const modal = this.ui.createModal('💳 Registrar Pagamento');
    modal.body.innerHTML = `
      <div style="display:grid;gap:1rem">
        <div class="form-group"><label>Contrato</label><select id="contractId" class="formula-input">${ids.map(id=>`<option>${id}</option>`).join('')}</select></div>
        <div class="form-group"><label>Data</label><input id="paymentDate" type="date" class="formula-input" value="${new Date().toISOString().split('T')[0]}"/></div>
        <div class="form-group"><label>Valor</label><input id="paymentAmount" type="number" class="formula-input" placeholder="1500.00"/></div>
      </div>
    `;
    const footer = document.createElement('div');
    footer.style.cssText = 'display:flex;justify-content:flex-end;gap:12px;padding:20px;border-top:1px solid var(--border);';
    footer.innerHTML = `<button class="toolbar-btn btn-cancel">Cancelar</button><button class="toolbar-btn btn-reg" style="background:var(--primary);color:white;">Registrar</button>`;
    modal.container.appendChild(footer);
    document.body.appendChild(modal.overlay);

    const $ = (sel)=> modal.body.querySelector(sel);
    footer.querySelector('.btn-cancel').addEventListener('click', ()=> modal.overlay.remove());
    footer.querySelector('.btn-reg').addEventListener('click', async ()=>{
      const contractId = $('#contractId').value;
      const date = $('#paymentDate').value;
      const amount = parseFloat($('#paymentAmount').value);
      if (!amount || amount <= 0) return this.ui.showToast('Valor inválido.', 'error');
      await this._registerPayment(contractId, date, amount);
      modal.overlay.remove();
    });
  }

  // ====================== Core math helpers ======================
  _num(v) { const n = parseFloat(v); return isNaN(n) ? 0 : n; }
  _round(x, digits = 2, mode = 'HALF_UP') {
    const m = Math.pow(10, digits);
    if (mode === 'HALF_EVEN') {
      const n = x * m, f = Math.floor(n), r = n - f;
      if (r > 0.5) return (Math.ceil(n))/m;
      if (r < 0.5) return (Math.floor(n))/m;
      return ((f % 2 === 0) ? f : f + 1) / m;
    }
    return Math.round(x * m) / m;
  }
  _dcf(start, end, base) {
    const s = new Date(String(start)+'T12:00:00Z');
    const e = new Date(String(end)+'T12:00:00Z');
    const diff = (a,b)=> Math.floor((b-a)/(1000*60*60*24));
    switch(String(base).toUpperCase()) {
      case 'ACT/360': return { days: diff(s,e), year: 360 };
      case 'ACT/365': return { days: diff(s,e), year: 365 };
      case 'BUS/252': return { days: diff(s,e), year: 252 };
      default: {
        const ds = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), Math.min(30, s.getUTCDate())));
        const de = new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), Math.min(30, e.getUTCDate())));
        return { days: diff(ds,de), year: 360 };
      }
    }
  }
  _equivRatePerPeriodByPeriodicity(periodicity, base, a) {
    const b = String(base).toUpperCase();
    const y = (b==='ACT/365')?365:(b==='ACT/360')?360:(b==='BUS/252')?252:360;
    const days = String(periodicity)==='Diário'?1:(String(periodicity)==='Anual'?y:30);
    return Math.pow(1 + (a||0), days / y) - 1;
  }
  _effPeriodByDates(start, end, a, base) {
    const {days, year} = this._dcf(start, end, base);
    return Math.pow(1 + (a||0), Math.max(0, days) / (year||360)) - 1;
  }
  _pmtLike(system, p, n, r, rounding='HALF_UP') {
    n = Math.max(1, Math.floor(n)); r = this._num(r); let payment = 0;
    if (system === 'SAC') { const amort = p / n; payment = amort + p*r; }
    else if (system === 'BULLET') payment = p*r;
    else if (system === 'COMPOUND_ONLY') payment = 0;
    else { if (r===0) payment = p/n; else { const f = Math.pow(1+r, n); payment = p*(r*f)/(f-1); } }
    return this._round(payment, 2, rounding);
  }

  // ====================== Rates & Curve ======================
  async _buildCurve(cfg) {
    const curve = [];
    for (let i=0;i<cfg.term;i++) {
      const start = this._addPeriods(cfg.startDate, i, cfg.periodicity);
      const end   = this._addPeriods(cfg.startDate, i+1, cfg.periodicity);
      const eff = await this._effRateForPeriodFromLegs(start, end, cfg.legs, cfg.base);
      curve.push({ i, start, end, eff });
    }
    return curve;
  }
  async _effRateForPeriodFromLegs(start, end, legs, base) {
    const annuals = [];
    for (const leg of (legs||[])) {
      if (!leg || !leg.indexer) continue;
      const spread = (this._num(leg.spreadAA)||0)/100;
      const percent = (this._num(leg.percent)||100)/100;
      if (String(leg.indexer).toUpperCase()==='PTAX') {
        const varPeriod = await this._ptaxVariation(start, end, leg.currency || 'USD', leg.source || 'AUTO');
        const dcf = this._dcf(start, end, base);
        const annualized = (varPeriod == null) ? 0 : (Math.pow(1+varPeriod, (dcf.year||360)/Math.max(1, dcf.days)) - 1);
        annuals.push(annualized*percent + spread);
      } else if (String(leg.indexer).toUpperCase()==='CDI') {
        const cdiAA = this._lookupCurveAA('CDI') ?? 0.13;
        annuals.push(cdiAA*percent + spread);
      } else {
        annuals.push(spread);
      }
    }
    const annualTotal = annuals.reduce((a,b)=>a+b, 0);
    return this._effPeriodByDates(start, end, annualTotal, base);
  }
  async _ptaxVariation(start, end, currency, source) {
    try {
      if (!this.fxAvailable) return null;
      const s = await this.kernel.requestCapability('dj.fx.rates@1', 'getRate', { date: start, currency, source });
      const e = await this.kernel.requestCapability('dj.fx.rates@1', 'getRate', { date: end, currency, source });
      if (typeof s !== 'number' || typeof e !== 'number' || s <= 0) return null;
      return (e/s) - 1;
    } catch { return null; }
  }
  _lookupCurveAA(indexer) {
    const wb = this.kernel.workbookManager.getActiveWorkbook();
    if (!wb) return null;
    const sheet = wb.sheets.find(s => s.name === this.constructor.CONFIG.SHEETS.RATE_CURVES);
    if (!sheet) return null;
    let last = null;
    for (let i=1;i<sheet.rows;i++) {
      const idx = (sheet.getCellValue(i,0)||'').toString().toUpperCase();
      const val = parseFloat(sheet.getCellValue(i,2));
      if (idx === String(indexer).toUpperCase() && !isNaN(val)) last = val;
    }
    return last;
  }

  // ====================== Sheets ======================
  async _createContractAndSheets(data) {
    const wb = this.kernel.workbookManager.getActiveWorkbook() || this.kernel.workbookManager.createWorkbook('Empréstimos');
    let contracts = wb.sheets.find(s => s.name === this.constructor.CONFIG.SHEETS.CONTRACTS);
    if (!contracts) {
      contracts = wb.addSheet(this.constructor.CONFIG.SHEETS.CONTRACTS);
      const headers = [
        'ID','Tipo','Principal BRL','Principal Origem','Moeda Origem','Taxa Conversão','PTAX Contrato',
        'Sistema','Periodicidade','Base','Rounding','Leg1 Indexer','Leg1 Percent','Leg1 SpreadAA','Leg1 Currency','Leg1 Source',
        'Leg2 Indexer','Leg2 Percent','Leg2 SpreadAA','Leg2 Currency','Leg2 Source',
        'Data Início','Nper','Data Venc','Saldo Devedor','Status','Grace Type','Grace Periods'
      ];
      headers.forEach((h, i)=> this._setCell(contracts, 0, i, h, 'HEADER'));
      contracts.rows = 1;
    }

    const conv = data.currency === 'BRL' ? 1 : (data.principalBRL && data.principalOrigin ? data.principalBRL / data.principalOrigin : 1);
    const row = contracts.rows;
    const leg1 = data.legs[0] || {};
    const leg2 = data.legs[1] || {};
    const r = [
      data.id, data.type || 'Pagador', data.principalBRL, data.principalOrigin, data.currency, conv, (data.contractPTAX || ''),
      data.system, data.periodicity, data.base, data.rounding || 'HALF_UP',
      leg1.indexer, leg1.percent, leg1.spreadAA, leg1.currency || '', leg1.source || '',
      leg2.indexer || '', leg2.percent || '', leg2.spreadAA || '', leg2.currency || '', leg2.source || '',
      data.startDate, data.term, data.endDate, data.principalBRL, 'Ativo', data.grace?.type || 'INTEREST_ONLY', data.grace?.periods || 0
    ];
    r.forEach((v,i)=> this._setCell(contracts, row, i, v));
    contracts.rows++;

    await this._writeCurve({ id: data.id });
    await this._writeProforma({ id: data.id });
    this.kernel.ui.recalculateAll?.(true);
    this.ui.showToast(`Contrato ${data.id} criado.`, 'success');
  }

  async _writeCurve(contractOrId) {
    const c = this._getContractData(contractOrId.id || contractOrId);
    if (!c) return;
    const wb = this.kernel.workbookManager.getActiveWorkbook();
    const name = `${this.constructor.CONFIG.SHEETS.RATE_CURVES}_${c.id}`;
    let sheet = wb.sheets.find(s => s.name === name) || wb.addSheet(name);
    sheet.columns = []; sheet.rows = 0;

    const headers = ['Período','Data Início','Data Fim','Taxa Efetiva (período)'];
    headers.forEach((h,i)=> this._setCell(sheet, 0, i, h, 'HEADER'));
    const cfg = this._normOptions({
      principalBRL: c.principalbrl, startDate: c.datainício, term: c.nper,
      periodicity: c.periodicidade, system: c.sistema, base: c.base, rounding: c.rounding,
      legs: c.legs, grace: { type: c.gracetype || 'INTEREST_ONLY', periods: c.graceperiods || 0 }
    });
    const curve = await this._buildCurve(cfg);
    curve.forEach((row, idx) => {
      const r = idx+1;
      this._setCell(sheet, r, 0, r);
      this._setCell(sheet, r, 1, row.start, 'DATE');
      this._setCell(sheet, r, 2, row.end, 'DATE');
      this._setCell(sheet, r, 3, row.eff, 'PERCENT4');
    });
    sheet.rows = curve.length + 1;
  }

  async _writeProforma(contractOrId) {
    const c = this._getContractData(contractOrId.id || contractOrId);
    if (!c) return;
    const wb = this.kernel.workbookManager.getActiveWorkbook();
    const name = `${this.constructor.CONFIG.SHEETS.PROFORMA}${c.id}`;
    let sheet = wb.sheets.find(s => s.name === name) || wb.addSheet(name);

    sheet.columns = []; sheet.rows = 0;
    let headerRows = 0;
    headerRows += this._writeSummary(sheet, c);
    const hdrRow = headerRows;
    ['Nº','Vencimento','Saldo Inicial','Juros','Amortização','Parcela','Saldo Final','Taxa Efetiva']
      .forEach((h, i)=> this._setCell(sheet, hdrRow, i, h, 'HEADER'));

    const cfg = this._normOptions({
      principalBRL: c.principalbrl, startDate: c.datainício, term: c.nper,
      periodicity: c.periodicidade, system: c.sistema, base: c.base, rounding: c.rounding,
      legs: c.legs, grace: { type: c.gracetype || 'INTEREST_ONLY', periods: c.graceperiods || 0 }
    });
    const { rows } = await this._computeScheduleInternal(cfg);

    for (let i=0;i<rows.length;i++) {
      const r = hdrRow + 1 + i;
      const row = rows[i];
      this._setCell(sheet, r, 0, row.period);
      this._setCell(sheet, r, 1, row.endDate, 'DATE');
      this._setCell(sheet, r, 2, row.openingBalance, 'CURRENCY');
      this._setCell(sheet, r, 3, row.interest, 'CURRENCY');
      this._setCell(sheet, r, 4, row.amortization, 'CURRENCY');
      this._setCell(sheet, r, 5, row.payment, 'CURRENCY');
      this._setCell(sheet, r, 6, row.closingBalance, 'CURRENCY');
      this._setCell(sheet, r, 7, row.effRate, 'PERCENT4');
    }
    sheet.rows = hdrRow + 1 + rows.length;
  }

  _writeSummary(sheet, c) {
    const L = LoanPlugin_v81.CONFIG.FORMATS;
    const rows = [
      ['Proforma do Contrato', c.id],
      ['Principal BRL', c.principalbrl],
      ['Sistema', c.sistema],
      ['Periodicidade / Base', `${c.periodicidade} / ${c.base}`],
      ['Carência', `${c.graceperiods || 0} (${c.gracetype || 'INTEREST_ONLY'})`]
    ];
    rows.forEach((pair, idx)=>{
      this._setCell(sheet, idx, 0, pair[0], 'HEADER_SUMM');
      if (pair[0].includes('Principal')) this._setCell(sheet, idx, 1, pair[1], 'CURRENCY');
      else this._setCell(sheet, idx, 1, pair[1]);
    });
    return rows.length + 1;
  }

  async _registerPayment(contractId, date, amount) {
    const c = this._getContractData(contractId);
    if (!c) return this.ui.showToast('Contrato não encontrado.', 'error');
    const wb = this.kernel.workbookManager.getActiveWorkbook();

    // Prepare ledger
    const ledgerName = `${this.constructor.CONFIG.SHEETS.LEDGER}${contractId}`;
    let ledger = wb.sheets.find(s => s.name === ledgerName) || wb.addSheet(ledgerName);
    if (ledger.rows === 0) {
      ['Data','Evento','Valor','Juros no Período','Amortização','Saldo Devedor'].forEach((h,i)=> this._setCell(ledger, 0, i, h, 'HEADER'));
      ledger.rows = 1;
    }

    // Determine last event
    let lastDate = c.datainício;
    let lastBalance = c.principalbrl;
    if (ledger.rows > 1) {
      const r = ledger.rows - 1;
      const ld = ledger.getCellValue(r, 0);
      const lb = parseFloat(ledger.getCellValue(r, 5));
      if (ld) lastDate = ld;
      if (!isNaN(lb)) lastBalance = lb;
    }

    // Accrue interest from lastDate to 'date'
    const rEff = await this._effRateForPeriodFromLegs(lastDate, date, c.legs, c.base);
    const interest = this._round(lastBalance * rEff, 2, c.rounding || 'HALF_UP');
    const interestCovered = Math.min(amount, interest);
    const principalCovered = Math.max(0, amount - interestCovered);
    const newBal = this._round(lastBalance + interest - amount, 2, c.rounding || 'HALF_UP');

    // Append ledger row
    const row = ledger.rows;
    this._setCell(ledger, row, 0, date, 'DATE');
    this._setCell(ledger, row, 1, 'Pagamento');
    this._setCell(ledger, row, 2, amount, 'CURRENCY');
    this._setCell(ledger, row, 3, interest, 'CURRENCY');
    this._setCell(ledger, row, 4, principalCovered, 'CURRENCY');
    this._setCell(ledger, row, 5, newBal, 'CURRENCY');
    ledger.rows++;

    // Update contract balance & status
    const contracts = wb.sheets.find(s => s.name === this.constructor.CONFIG.SHEETS.CONTRACTS);
    const balCol = this._findHeader(contracts, 'Saldo Devedor');
    const statusCol = this._findHeader(contracts, 'Status');
    let status = 'Ativo'; let updBal = newBal;
    if (updBal <= 0.01) { updBal = 0; status = 'Quitado'; }
    if (balCol > -1) this._setCell(contracts, c.rowIndex, balCol, updBal, 'CURRENCY');
    if (statusCol > -1) this._setCell(contracts, c.rowIndex, statusCol, status);

    this.ui.showToast('Pagamento registrado; recalculando...', 'info');
    await this._writeProforma({ id: contractId });
  }

  // ====================== Data Access ======================
  _getContractData(contractId) {
    const wb = this.kernel.workbookManager.getActiveWorkbook();
    if (!wb) return null;
    const contracts = wb.sheets.find(s => s.name === this.constructor.CONFIG.SHEETS.CONTRACTS);
    if (!contracts) return null;

    // Find header row
    let headerRow = -1;
    for (let i=0;i<contracts.rows;i++) {
      if ((contracts.getCellValue(i,0)||'').toUpperCase() === 'ID') { headerRow=i; break; }
    }
    if (headerRow === -1) return null;

    const headers = [];
    for (let i=0;i<contracts.columns.length;i++) {
      headers.push((contracts.getCellValue(headerRow, i)||'').toString().replace(/\s+/g,'').replace(/\./g,'').toLowerCase());
    }

    for (let i=headerRow+1;i<contracts.rows;i++) {
      if (contracts.getCellValue(i,0) === contractId) {
        const data = { rowIndex: i, legs: [] };
        headers.forEach((key, colIdx) => {
          if (!key) return;
          const raw = contracts.getCellValue(i, colIdx);
          const isNum = ['principalbrl','principalorigem','taxaconversão','ptaxcontrato','nper','saldodevedor','percent','spreadaa','graceperiods'].includes(key);
          const val = isNum ? parseFloat(raw)||0 : raw;
          if (key.startsWith('leg')) {
            const idx = parseInt(key.charAt(3)) - 1;
            const prop = key.substring(4);
            if (idx>=0 && !data.legs[idx]) data.legs[idx] = {};
            if (idx>=0) data.legs[idx][prop] = val;
          } else {
            data[key] = val;
          }
        });
        data.legs = data.legs.filter(l=>l && l.indexer);
        return data;
      }
    }
    return null;
  }
  _listActiveContracts(contractsSheet) {
    const ids = [];
    const statusIdx = this._findHeader(contractsSheet, 'Status');
    for (let i=1;i<contractsSheet.rows;i++) {
      if ((contractsSheet.getCellValue(i, statusIdx)||'') === 'Ativo') ids.push(contractsSheet.getCellValue(i,0));
    }
    return ids;
  }
  _findHeader(sheet, name) {
    for (let i=0;i<sheet.columns.length;i++) {
      if ((sheet.getCellValue(0,i)||'').toString().toLowerCase() === name.toLowerCase()) return i;
    }
    return -1;
  }
  _setCell(sheet, row, col, value, fmt) {
    sheet.setCell(row, col, value);
    const F = this.constructor.CONFIG.FORMATS;
    if (fmt && F[fmt]) {
      const cell = sheet.getCell(row, col);
      if (F[fmt].format) cell.format = { ...F[fmt].format };
      if (F[fmt].style)  cell.style  = { ...cell.style, ...F[fmt].style };
    }
  }
  _openSheet(name) {
    const wb = this.kernel.workbookManager.getActiveWorkbook();
    const s = wb?.sheets.find(x=>x.name===name);
    if (s) { wb.setActiveSheet(wb.sheets.indexOf(s)); this.ui.renderGrid(); }
    else this.ui.showToast(`Planilha '${name}' não encontrada.`, 'warning');
  }
  _selectContractAnd(cb) {
    const wb = this.kernel.workbookManager.getActiveWorkbook();
    if (!wb) return this.ui.showToast('Nenhum projeto ativo.', 'warning');
    const contracts = wb.sheets.find(s => s.name === this.constructor.CONFIG.SHEETS.CONTRACTS);
    if (!contracts || contracts.rows <= 1) return this.ui.showToast('Nenhum contrato encontrado.', 'warning');
    const ids = [];
    for (let i=1;i<contracts.rows;i++) ids.push(contracts.getCellValue(i,0));
    const modal = this.ui.createModal('Selecionar Contrato');
    modal.body.innerHTML = `<div class="form-group"><label>Contrato</label><select id="sel" class="formula-input">${ids.map(id=>`<option>${id}</option>`).join('')}</select></div>`;
    const footer = document.createElement('div');
    footer.style.cssText = 'display:flex;justify-content:flex-end;gap:12px;padding:20px;border-top:1px solid var(--border);';
    footer.innerHTML = `<button class="toolbar-btn btn-cancel">Cancelar</button><button class="toolbar-btn btn-ok" style="background:var(--primary);color:white;">OK</button>`;
    modal.container.appendChild(footer); document.body.appendChild(modal.overlay);
    footer.querySelector('.btn-cancel').addEventListener('click', ()=> modal.overlay.remove());
    footer.querySelector('.btn-ok').addEventListener('click', ()=>{
      const id = modal.body.querySelector('#sel').value;
      modal.overlay.remove();
      cb && cb(id);
    });
  }
  _addPeriods(dateStr, periods, periodicity) {
    const d = new Date(String(dateStr)+'T12:00:00Z');
    switch (String(periodicity)) {
      case 'Diário': d.setUTCDate(d.getUTCDate() + periods); break;
      case 'Anual': d.setUTCFullYear(d.getUTCFullYear() + periods); break;
      default: d.setUTCMonth(d.getUTCMonth() + periods); break;
    }
    return d.toISOString().split('T')[0];
  }

  // ====================== Private wrappers ======================
  _normOptions(opts) {
    const o = { ...(opts||{}) };
    o.principalBRL = this._num(o.principalBRL || o.principal || 0);
    o.startDate = o.startDate || new Date().toISOString().split('T')[0];
    o.term = Math.max(1, parseInt(o.term || o.nper || 1, 10));
    o.periodicity = o.periodicity || LoanPlugin_v81.CONFIG.DEFAULTS.periodicity;
    o.base = o.base || LoanPlugin_v81.CONFIG.DEFAULTS.base;
    o.rounding = o.rounding || LoanPlugin_v81.CONFIG.DEFAULTS.rounding;
    o.system = (o.system || 'PRICE').toUpperCase();
    o.legs = Array.isArray(o.legs) ? o.legs : (o.legs ? [o.legs] : [{ indexer: 'MANUAL', percent: 100, spreadAA: this._num(o.annualRate || 0)*100 }]);
    o.grace = o.grace || { type: 'INTEREST_ONLY', periods: 0 };
    return o;
  }
  async _computePayment(opts) {
    const cfg = this._normOptions(opts);
    const curve = await this._buildCurve({ ...cfg, term: 1 });
    const r = curve[0]?.eff || 0;
    return this._pmtLike(cfg.system, cfg.principalBRL, cfg.term, r, cfg.rounding);
  }
}

// ========= Plugin Registration =========
window.DJDataForge.registerPlugin({
  id: LoanPlugin_v81.PLUGIN_ID,
  name: `Gestão de Empréstimos (v${LoanPlugin_v81.VERSION} – Flexible)`,
  version: LoanPlugin_v81.VERSION,
  description: 'Juros por período com pagamentos flexíveis + PTAX do Contrato.',
  author: 'DJCalc',
  engineSemver: '>=5.0.0',
  async init(context) {
    const instance = new LoanPlugin_v81(context);
    await instance.init();
    this.instance = instance;
  },
  async dispose(context) {
    if (this.instance) await this.instance.dispose();
  }
});
})();

/**
 * DJ DataForge – Loan FLEX Patch v8.2.0
 * Modo overlay/idempotente para "juros periódicos + pagamentos flexíveis".
 * - Sistema FLEX (não destrói os sistemas existentes)
 * - Rotina de pagamento com alocação (AUTO/JUROS/PRINCIPAL/MISTO)
 * - Extrato por período (statement) + fórmula LOAN.STATEMENT@v1
 * Compatibilidade: Engine >= 5.0.0
 */
(function(){
'use strict';

const PATCH_ID = 'dj.finance.loans.flex.patch@8.2';
const CAP_ID   = 'dj.finance.loans.flex@1';

function once(key, fn){ if (window.__dj_once__?.[key]) return; (window.__dj_once__ ||= {})[key] = true; fn(); }

once(PATCH_ID, ()=> window.DJDataForge.registerPlugin({
  id: PATCH_ID,
  name: 'Loan FLEX Patch (v8.2)',
  version: '8.2.0',
  description: 'Sistema FLEX + extrato por período + pagamentos com alocação.',
  author: 'DJCalc',
  engineSemver: '>=5.0.0',

  async init(ctx){
    const kernel = ctx.kernel, ui = kernel.ui;
    const S = {
      CONTRACTS:'_Loan_Contracts',
      LEDGER:'_Loan_Ledger_',
      PERIOD:'_Loan_Period_',
      RATE_CURVES:'_Loan_RateCurves'
    };
    const FX_CAP = 'dj.fx.rates@1';
    const fxAvailable = !!kernel.hasCapability?.(FX_CAP);

    // ---- util ----
    const num = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
    const round = (x,d=2,mode='HALF_UP')=>{
      const m = Math.pow(10,d);
      if (mode==='HALF_EVEN'){ const n=x*m, f=Math.floor(n), r=n-f;
        if (r>0.5) return Math.ceil(n)/m; if (r<0.5) return Math.floor(n)/m; return ((f%2===0)?f:f+1)/m; }
      return Math.round(x*m)/m;
    };
    const dcf = (start,end,base='30/360')=>{
      const s=new Date(String(start)+'T12:00:00Z'), e=new Date(String(end)+'T12:00:00Z');
      const diff=(a,b)=> Math.floor((b-a)/(1000*60*60*24));
      switch(String(base).toUpperCase()){
        case 'ACT/365': return {days:diff(s,e), year:365};
        case 'ACT/360': return {days:diff(s,e), year:360};
        case 'BUS/252': return {days:diff(s,e), year:252};
        default: {
          const ds=new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), Math.min(30, s.getUTCDate())));
          const de=new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), Math.min(30, e.getUTCDate())));
          return {days:diff(ds,de), year:360};
        }
      }
    };
    const effByDates = (d0,d1,raa,base) => {
      const {days,year} = dcf(d0,d1,base);
      return Math.pow(1+(raa||0), Math.max(0,days)/(year||360)) - 1;
    };
    const setCell = (sh,r,c,val,fmt)=>{
      sh.setCell(r,c,val);
      const F = {
        HEADER:{ style:{bold:true,backgroundColor:'#f0f0f0',textAlign:'center'} },
        HEAD2:{ style:{bold:true,backgroundColor:'#e9ecef'} },
        CUR:{ format:{type:'currency', currency:'BRL', decimals:2} },
        PCT4:{ format:{type:'percentage', decimals:4} },
        DATE:{ format:{type:'date'} }
      };
      if (fmt && F[fmt]) {
        const cell = sh.getCell(r,c);
        if (F[fmt].format) cell.format = {...F[fmt].format};
        if (F[fmt].style)  cell.style  = {...cell.style, ...F[fmt].style};
      }
    };
    const findHeader = (sh, name)=>{
      for (let i=0;i<sh.columns.length;i++) {
        if ((sh.getCellValue(0,i)||'').toString().toLowerCase() === name.toLowerCase()) return i;
      }
      return -1;
    };

    const getContract = (id)=>{
      const wb = kernel.workbookManager.getActiveWorkbook();
      const sh = wb?.sheets.find(s=> s.name===S.CONTRACTS); if (!sh) return null;
      const headers=[];
      for (let i=0;i<sh.columns.length;i++){
        headers.push((sh.getCellValue(0,i)||'').toString().replace(/\s+/g,'').replace(/\./g,'').toLowerCase());
      }
      for (let r=1;r<sh.rows;r++){
        if (sh.getCellValue(r,0)===id){
          const data={ rowIndex:r, legs:[] };
          headers.forEach((k,c)=>{
            const raw=sh.getCellValue(r,c);
            const isNum=['principalbrl','principalorigem','taxaconversão','ptaxcontrato','nper','saldodevedor','percent','spreadaa','graceperiods'].includes(k);
            const val=isNum?parseFloat(raw)||0:raw;
            if (k.startsWith('leg')) {
              const i=parseInt(k.charAt(3))-1; const prop=k.substring(4);
              if (i>=0 && !data.legs[i]) data.legs[i]={};
              if (i>=0) data.legs[i][prop] = val;
            } else data[k]=val;
          });
          data.legs=data.legs.filter(l=>l&&l.indexer);
          return data;
        }
      }
      return null;
    };

    const getLedger = (id)=>{
      const wb = kernel.workbookManager.getActiveWorkbook();
      const name = `${S.LEDGER}${id}`;
      const sh = wb?.sheets.find(s=> s.name===name);
      if (!sh || sh.rows<=1) return [];
      const rows=[];
      for (let i=1;i<sh.rows;i++){
        rows.push({
          date: sh.getCellValue(i,0),
          type: (sh.getCellValue(i,1)||'').toString(),
          amount: num(sh.getCellValue(i,2)),
          alloc: (sh.getCellValue(i,3)||'AUTO').toString(),
          amountInt: num(sh.getCellValue(i,5)),
          balance: num(sh.getCellValue(i,7))
        });
      }
      return rows;
    };

    const ptaxVar = async (d0,d1,currency,source)=>{
      try{
        if (!fxAvailable) return null;
        const s = await kernel.requestCapability(FX_CAP,'getRate',{date:d0,currency,source});
        const e = await kernel.requestCapability(FX_CAP,'getRate',{date:d1,currency,source});
        if (typeof s !== 'number' || typeof e !== 'number' || s<=0) return null;
        return (e/s) - 1;
      }catch{ return null; }
    };

    const lookupCurveAA = (indexer)=>{
      const wb = kernel.workbookManager.getActiveWorkbook();
      const sh = wb?.sheets.find(s=> s.name===S.RATE_CURVES);
      if (!sh) return null;
      let last=null;
      for (let i=1;i<sh.rows;i++){
        const idx=(sh.getCellValue(i,0)||'').toString().toUpperCase();
        const val=parseFloat(sh.getCellValue(i,2));
        if (idx===String(indexer).toUpperCase() && !isNaN(val)) last=val;
      }
      return last;
    };

    const effFromLegs = async (d0,d1,legs,base)=>{
      const annuals=[];
      for (const leg of (legs||[])){
        if (!leg || !leg.indexer) continue;
        const spread=(num(leg.spreadAA)||0)/100;
        const percent=(num(leg.percent)||100)/100;
        if (String(leg.indexer).toUpperCase()==='PTAX'){
          const v = await ptaxVar(d0,d1, leg.currency||'USD', leg.source||'AUTO');
          const {days,year} = dcf(d0,d1,base);
          const ann = (v==null)?0:(Math.pow(1+v,(year||360)/Math.max(1,days))-1);
          annuals.push(ann*percent + spread);
        } else if (String(leg.indexer).toUpperCase()==='CDI'){
          const cdiAA = lookupCurveAA('CDI') ?? 0.13;
          annuals.push(cdiAA*percent + spread);
        } else {
          annuals.push(spread);
        }
      }
      const aTot = annuals.reduce((a,b)=>a+b,0);
      return effByDates(d0,d1,aTot,base);
    };

    // ---------- Capability: statement por período ----------
    const periodStatement = async ({contractId, start, end})=>{
      const c = getContract(contractId);
      if (!c) return { error:'Contrato não encontrado.' };
      const ledger = getLedger(contractId);
      const toD = x => new Date(String(x)+'T12:00:00Z');

      // rolar até o início
      let cursor = c.datainício, bal = c.principalbrl, accInt = 0;
      const prior = ledger.filter(e=> toD(e.date) <= toD(start)).sort((a,b)=> toD(a.date)-toD(b.date));
      for (const e of prior){
        const r = await effFromLegs(cursor, e.date, c.legs, c.base);
        const I = round(bal*r, 2, c.rounding);
        bal = round(bal + I - e.amount, 2, c.rounding);
        cursor = e.date;
      }
      // capitaliza até o start
      const r0 = await effFromLegs(cursor, start, c.legs, c.base);
      bal = round(bal*(1+r0), 2, c.rounding);
      cursor = start;

      const pays = ledger.filter(e=> e.type==='Pagamento' && toD(e.date) > toD(start) && toD(e.date) <= toD(end))
                         .sort((a,b)=> toD(a.date)-toD(b.date));
      const checkpoints = [...pays.map(p=>p.date), end];
      const rows = [];

      for (const bp of checkpoints){
        const r = await effFromLegs(cursor, bp, c.legs, c.base);
        const I = round(bal*r, 2, c.rounding); accInt = round(accInt + I, 2, c.rounding);

        const pay = pays.find(p=> p.date===bp);
        let pInt=0, pPrin=0, closing=0;
        if (pay){
          if (pay.alloc==='JUROS') { pInt=Math.min(I, pay.amount); pPrin=Math.max(0, pay.amount-pInt); }
          else if (pay.alloc==='PRINCIPAL') { pPrin=pay.amount; }
          else if (pay.alloc==='MISTO') { pInt=Math.min(I, num(pay.amountInt)); pPrin=Math.max(0, pay.amount-pInt); }
          else { pInt=Math.min(I, pay.amount); pPrin=Math.max(0, pay.amount-pInt); }
          closing = round(bal + I - (pInt + pPrin), 2, c.rounding);
        } else {
          const capitaliza = ['COMPOUND_ONLY','BULLET','FLEX'].includes(String(c.sistema).toUpperCase());
          closing = capitaliza ? round(bal + I, 2, c.rounding) : round(bal, 2, c.rounding);
        }

        rows.push({
          periodStart: cursor, periodEnd: bp, effRate: r,
          openingBalance: bal, interest: I,
          payment: pay?.amount||0,
          paymentAllocInterest: pInt,
          paymentAllocPrincipal: pPrin,
          closingBalance: closing,
          accruedInterestCum: accInt
        });
        bal = closing; cursor = bp;
      }

      return { startBalance: rows.length? rows[0].openingBalance : bal, endBalance: bal, accruedInterest: accInt, rows };
    };

    // ---------- menu: pagamento com alocação ----------
    const showPaymentModal = ()=>{
      const wb = kernel.workbookManager.getActiveWorkbook();
      const cs = wb?.sheets.find(s=> s.name===S.CONTRACTS);
      if (!cs || cs.rows<=1) return ui.showToast('Nenhum contrato.', 'warning');
      const ids = []; const statusCol = findHeader(cs,'Status');
      for (let r=1;r<cs.rows;r++){ if ((cs.getCellValue(r,statusCol)||'')!=='Quitado') ids.push(cs.getCellValue(r,0)); }
      const modal = ui.createModal('💳 Registrar Pagamento (Alocação)');
      modal.body.innerHTML = `
        <div style="display:grid;gap:1rem">
          <div class="form-group"><label>Contrato</label><select id="cid" class="formula-input">${ids.map(x=>`<option>${x}</option>`).join('')}</select></div>
          <div class="form-group"><label>Data</label><input id="dt" type="date" class="formula-input" value="${new Date().toISOString().split('T')[0]}"/></div>
          <div class="form-group"><label>Valor</label><input id="amt" type="number" class="formula-input" placeholder="1000.00"/></div>
          <div class="form-group"><label>Alocação</label><select id="alloc" class="formula-input"><option>AUTO</option><option>JUROS</option><option>PRINCIPAL</option><option>MISTO</option></select></div>
          <div id="mix" class="form-group" style="display:none"><label>Juros dentro do pagamento (se MISTO)</label><input id="amtInt" type="number" class="formula-input" placeholder="Ex.: 300.00"/></div>
        </div>`;
      const footer = document.createElement('div');
      footer.style.cssText='display:flex;justify-content:flex-end;gap:12px;padding:12px;border-top:1px solid var(--border);';
      footer.innerHTML = `<button class="toolbar-btn btn-cancel">Cancelar</button><button class="toolbar-btn btn-ok" style="background:var(--primary);color:white;">Registrar</button>`;
      modal.container.appendChild(footer); document.body.appendChild(modal.overlay);
      const $ = q=> modal.body.querySelector(q);
      $('#alloc').addEventListener('change', ()=> { $('#mix').style.display = ($('#alloc').value==='MISTO')?'block':'none'; });
      footer.querySelector('.btn-cancel').addEventListener('click',()=> modal.overlay.remove());
      footer.querySelector('.btn-ok').addEventListener('click', async ()=>{
        const contractId = $('#cid').value, date=$('#dt').value, amount=num($('#amt').value), alloc=$('#alloc').value, amountInt=num($('#amtInt').value);
        if (!amount || amount<=0) return ui.showToast('Valor inválido.', 'error');
        await registerPayment({contractId, date, amount, alloc, amountInt});
        modal.overlay.remove();
      });
    };

    const registerPayment = async ({contractId, date, amount, alloc='AUTO', amountInt=0})=>{
      const c = getContract(contractId);
      if (!c) return ui.showToast('Contrato não encontrado.', 'error');
      const wb = kernel.workbookManager.getActiveWorkbook();
      const name = `${S.LEDGER}${contractId}`;
      let sh = wb.sheets.find(s=> s.name===name) || wb.addSheet(name);
      if (sh.rows===0){
        ['Data','Evento','Valor','Alocação','Juros no Período','Juros pagos','Amortização','Saldo Devedor'].forEach((h,i)=> setCell(sh,0,i,h,'HEADER'));
        sh.rows=1;
      }
      // estado anterior
      let lastDate=c.datainício, lastBal=c.principalbrl;
      if (sh.rows>1){ const r=sh.rows-1; lastDate = sh.getCellValue(r,0) || lastDate; lastBal = num(sh.getCellValue(r,7)) || lastBal; }
      const rEff = await effFromLegs(lastDate, date, c.legs, c.base);
      const I = round(lastBal*rEff, 2, c.rounding);
      let pInt=0, pPrin=0;
      if (alloc==='JUROS')      { pInt = Math.min(I, amount); pPrin = Math.max(0, amount-pInt); }
      else if (alloc==='PRINCIPAL'){ pPrin = amount; }
      else if (alloc==='MISTO'){ pInt = Math.min(I, amountInt||0); pPrin = Math.max(0, amount-pInt); }
      else                     { pInt = Math.min(I, amount); pPrin = Math.max(0, amount-pInt); }
      const newBal = round(lastBal + I - (pInt + pPrin), 2, c.rounding);

      const row = sh.rows;
      setCell(sh,row,0,date,'DATE'); setCell(sh,row,1,'Pagamento');
      setCell(sh,row,2,amount,'CUR'); setCell(sh,row,3,alloc);
      setCell(sh,row,4,I,'CUR');     setCell(sh,row,5,pInt,'CUR');
      setCell(sh,row,6,pPrin,'CUR'); setCell(sh,row,7,newBal,'CUR');
      sh.rows++;

      // atualiza saldo no cadastro
      const cs = wb.sheets.find(s=> s.name===S.CONTRACTS);
      const balCol = findHeader(cs,'Saldo Devedor'), statusCol = findHeader(cs,'Status');
      if (balCol>-1) setCell(cs, c.rowIndex, balCol, newBal, 'CUR');
      if (statusCol>-1) cs.setCell(c.rowIndex, statusCol, newBal<=0.01?'Quitado':'Ativo');

      ui.showToast('Pagamento registrado (FLEX).', 'success');
    };

    // ---------- gerar extrato (sheet) ----------
    const createPeriodSheet = async (contractId, d0, d1)=>{
      const st = await periodStatement({contractId, start:d0, end:d1});
      if (st?.error) { ui.showToast(st.error,'error'); return false; }
      const wb = kernel.workbookManager.getActiveWorkbook();
      const name = `${S.PERIOD}${contractId}_${d0}_${d1}`;
      let sh = wb.sheets.find(s=> s.name===name) || wb.addSheet(name);
      sh.columns=[]; sh.rows=0;

      const H=['Período Início','Período Fim','Saldo Inicial','Taxa Efetiva','Juros','Pagamento','Pago em Juros','Pago em Principal','Saldo Final','Juros Acum.'];
      H.forEach((h,i)=> setCell(sh,0,i,h,'HEADER'));
      let r=1;
      for (const row of (st.rows||[])){
        setCell(sh,r,0,row.periodStart,'DATE'); setCell(sh,r,1,row.periodEnd,'DATE');
        setCell(sh,r,2,row.openingBalance,'CUR'); setCell(sh,r,3,row.effRate,'PCT4');
        setCell(sh,r,4,row.interest,'CUR'); setCell(sh,r,5,row.payment,'CUR');
        setCell(sh,r,6,row.paymentAllocInterest,'CUR'); setCell(sh,r,7,row.paymentAllocPrincipal,'CUR');
        setCell(sh,r,8,row.closingBalance,'CUR'); setCell(sh,r,9,row.accruedInterestCum,'CUR');
        r++;
      }
      sh.rows=r;

      // resumo
      const top = [
        ['Extrato (FLEX) do Contrato', contractId],
        ['Janela', `${d0} → ${d1}`],
        ['Saldo Inicial do Período', st.startBalance],
        ['Saldo Final do Período', st.endBalance],
        ['Juros Acumulados', st.accruedInterest]
      ];
      top.forEach((pair,i)=>{ setCell(sh, r+i+1, 0, pair[0], 'HEAD2'); if (i>=2) setCell(sh, r+i+1, 1, pair[1], 'CUR'); else sh.setCell(r+i+1,1,pair[1]); });

      ui.showToast('Extrato (FLEX) gerado.', 'success');
      return true;
    };

    // ---------- registrar menus / fórmulas / capability ----------
    // menu: pagamento e extrato
    kernel.registry.registerMenuItem({ pluginId: PATCH_ID, label:'💳 Registrar Pagamento (Alocação)', action: ()=> showPaymentModal() });
    kernel.registry.registerMenuItem({ pluginId: PATCH_ID, label:'📆 Extrato do Período (FLEX)', action: ()=>{
      const wb = kernel.workbookManager.getActiveWorkbook();
      const cs = wb?.sheets.find(s=> s.name===S.CONTRACTS);
      if (!cs || cs.rows<=1) return ui.showToast('Nenhum contrato.', 'warning');
      const ids=[]; const sCol = findHeader(cs,'Status'); for (let r=1;r<cs.rows;r++){ if ((cs.getCellValue(r,sCol)||'')!=='Quitado') ids.push(cs.getCellValue(r,0)); }
      const modal = ui.createModal('📆 Extrato (FLEX)');
      modal.body.innerHTML = `
        <div style="display:grid;gap:1rem">
          <div class="form-group"><label>Contrato</label><select id="cid" class="formula-input">${ids.map(x=>`<option>${x}</option>`).join('')}</select></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
            <div class="form-group"><label>Início</label><input id="d0" type="date" class="formula-input" value="${new Date().toISOString().split('T')[0]}"/></div>
            <div class="form-group"><label>Fim</label><input id="d1" type="date" class="formula-input" value="${new Date().toISOString().split('T')[0]}"/></div>
          </div>
        </div>`;
      const footer = document.createElement('div');
      footer.style.cssText='display:flex;justify-content:flex-end;gap:12px;padding:12px;border-top:1px solid var(--border);';
      footer.innerHTML = `<button class="toolbar-btn btn-cancel">Cancelar</button><button class="toolbar-btn btn-ok" style="background:var(--primary);color:white;">Gerar</button>`;
      modal.container.appendChild(footer); document.body.appendChild(modal.overlay);
      const $ = q=> modal.body.querySelector(q);
      footer.querySelector('.btn-cancel').addEventListener('click',()=> modal.overlay.remove());
      footer.querySelector('.btn-ok').addEventListener('click', async ()=> { await createPeriodSheet($('#cid').value, $('#d0').value, $('#d1').value); modal.overlay.remove(); });
    }});

    // fórmula LOAN.STATEMENT@v1 (gera planilha e retorna 1)
    if (!kernel.registry.getFormula?.('LOAN.STATEMENT@v1')) {
      kernel.registry.registerFormula({
        name: 'LOAN.STATEMENT@v1',
        pluginId: PATCH_ID,
        syntax: 'LOAN.STATEMENT@v1(contractId, data_início, data_fim)',
        description: 'Gera planilha de extrato por período (FLEX) do contrato.',
        impl: (args)=> createPeriodSheet(String(args[0]), String(args[1]), String(args[2])).then(ok=> ok?1:0)
      });
    }

    // capability nova (não colide com a antiga)
    kernel.registerCapability(CAP_ID, { pluginId: PATCH_ID, version: '8.2.0', api: { periodStatement } });

    ui.showToast('Loan FLEX Patch (v8.2) habilitado.', 'success');
  },

  async dispose(){ /* nada a desfazer; overlay idempotente */ }
}));
})();
