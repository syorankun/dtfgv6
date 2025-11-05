/**
 * DJ DataForge - Loan Plugin v9.7.1 (HOTFIX: CURFX redeclare + export + PTAX VAR view)
 *
 * 🔧 Corrige erro de instalação: "Identifier 'CURFX' has already been declared"
 *    — havia uma dupla declaração de `const CURFX` no mesmo escopo da função
 *      `createAccrualSheet`. Agora usamos **uma única variável** e reaproveitamos.
 *
 * ✅ Exportação XLSX/CSV: normalização numérica (ponto/vírgula) para evitar
 *    números inflados.
 * ✅ Variação PTAX (visão): mostra **apenas** a escolhida pelo usuário:
 *      - PTAX_DAILY:  Δ = PTAX_CONTRATO − PTAX_BCB[dia]
 *      - PTAX_MONTHLY:Δ = PTAX_CONTRATO − PTAX_BCB[fechamento do mês]
 * ✅ Coluna "PTAX (BCB)" da agenda usa sempre BCB de acordo com o modo de conversão
 *    selecionado: DAILY / MONTHLY(EOM) / ANNUAL(EOY).
 * ✅ Duas pernas com bases independentes (30/360, ACT/365, ACT/360, BUS/252)
 *    combinadas multiplicativamente (efetivas do período).
 * ✅ Pagamentos multi‑moeda, juros/valores em FX e BRL, acumulados em ambos.
 */
(function(){
'use strict';

const PLUGIN_ID = 'dj.finance.loans.v9_7_1.accrual';
const CAP_ID = 'dj.finance.loans@1';
const VERSION = '9.10.2-unified';

// ---------- Utils (puros) ----------
const U = {
  num(v){ const n=parseFloat((v??'').toString().replace(/\s/g,'')); return isNaN(n)?0:n; },
  round(x,d=2,mode='HALF_UP'){
    const m=Math.pow(10,d);
    if (mode==='HALF_EVEN'){
      const n=x*m, f=Math.floor(n), r=n-f;
      if (r>0.5) return Math.ceil(n)/m; if (r<0.5) return Math.floor(n)/m;
      return ((f%2===0)?f:f+1)/m;
    }
    return Math.round(x*m)/m;
  },
  toD(d){ return new Date(String(d)+'T12:00:00Z'); },
  fmtD(d){ return new Date(d).toISOString().split('T')[0]; },
  diffDays(a,b){ return Math.floor((b-a)/(1000*60*60*24)); },
  addDays(d, n){ const x=new Date(d); x.setUTCDate(x.getUTCDate()+n); return x; },
  addMonth(d, n){ const x=new Date(d); x.setUTCMonth(x.getUTCMonth()+n); return x; },
  addYear(d, n){ const x=new Date(d); x.setUTCFullYear(x.getUTCFullYear()+n); return x; },
  addPeriods(dateStr, periods, periodicity){
    const d=U.toD(dateStr);
    return U.fmtD(periodicity==='Diário' ? U.addDays(d, periods)
      : (periodicity==='Anual' ? U.addYear(d,periods) : U.addMonth(d,periods)));
  },
  ym(d){ const x=U.toD(d); return `${x.getUTCFullYear()}-${x.getUTCMonth()+1}`; },
  safeDiv(a,b){ b=parseFloat(b); if (!b || !isFinite(b)) return 0; return a/b; },
  dcf(d0,d1,base){
    const s=U.toD(d0), e=U.toD(d1);
    switch(String(base).toUpperCase()){
      case 'ACT/365': return {days: U.diffDays(s,e), year:365};
      case 'ACT/360': return {days: U.diffDays(s,e), year:360};
      case 'BUS/252': return {days: U.diffDays(s,e), year:252};
      default: {
        const ds=new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), Math.min(30, s.getUTCDate())));
        const de=new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), Math.min(30, e.getUTCDate())));
        return {days: U.diffDays(ds,de), year:360};
      }
    }
  },
  annualToEff(d0,d1,annual,base,comp='EXP'){
    const {days,year}=U.dcf(d0,d1,base);
    if ((annual||0)===0 || days<=0) return 0;
    if (comp==='LIN') return (annual * (days/(year||360)));
    return Math.pow(1+(annual||0), (days/(year||360))) - 1; // EXP
  },
  parseLocaleNumber(s){
    if (typeof s==='number') return s;
    if (s==null) return '';
    s=String(s).trim(); if (!s) return '';
    // remove currency and spaces
    s=s.replace(/\s|R\$|USD|BRL|,?%/g,'');
    // heuristic: pt-BR decimal comma
    if (/^[-+]?\d{1,3}(\.\d{3})*,\d+$/.test(s) || (s.includes(',') && s.split(',').pop().length<=2)){
      s=s.replace(/\./g,'').replace(',', '.');
    } else if (/^[-+]?\d{1,3}(,\d{3})*\.\d+$/.test(s)){
      s=s.replace(/,/g,'');
    } else if (/^[-+]?\d+,\d+$/.test(s)){
      s=s.replace(',', '.');
    }
    const n=parseFloat(s); return isNaN(n)?s:n;
  }
};

class LoanPluginV971 {
  static ID = PLUGIN_ID;
  static VERSION = VERSION;

  static S = {
    CONTRACTS: '_Loan_Contracts',
    LEDGER: '_Loan_Ledger_',
    ACCRUAL: '_Loan_Accrual_',
    RATE_CURVES: '_Loan_RateCurves',
    RATE_DAILY_CAND: ['_Loan_RateDaily','Rates_Daily','BACEN_Daily']
  };

  static FMT = {
    HEADER:{ style:{ bold:true, backgroundColor:'#f0f0f0', textAlign:'center' } },
    HEAD2:{ style:{ bold:true, backgroundColor:'#e9ecef' } },
    CUR:{ format:{ type:'currency', currency:'BRL', decimals:2 } },
    CURFX:(ccy)=>({ format:{ type:'currency', currency:ccy||'USD', decimals:2 } }),
    PCT4:{ format:{ type:'percentage', decimals:4 } },
    DATE:{ format:{ type:'date' } }
  };

  constructor(ctx){
    this.kernel = ctx.kernel;
    this.ui = this.kernel.ui;
    this.fxAvailable = false;
    this.log = (...a)=>console.log('[Loan v9.7.1]', ...a);
    this.error = (...a)=>console.error('[Loan v9.7.1]', ...a);
  }

  

  _buildHeaderMap(sh){
    var map = {};
    var n = (sh && sh.columns ? sh.columns.length : 0);
    for (var i=0;i<n;i++){
      var k = String(sh.columns[i] && sh.columns[i].name ? sh.columns[i].name : '').trim().toLowerCase();
      if (k) map[k]=i;
    }
    return map;
  }
  _ensureHeader(sh, name){
    var idx = -1;
    if (typeof this._findHeader === 'function'){ idx = this._findHeader(sh, name); }
    if (idx>=0) return idx;
    var i = (sh && sh.columns ? sh.columns.length : 0);
    this._setCell(sh, 0, i, name, 'HEADER');
    return i;
  }
  _ISO(d){
    try{
      var s = String(d||''); if (s.length>10) s = s.slice(0,10);
      return (/^\d{4}-\d{2}-\d{2}$/).test(s) ? s : '';
    }catch(e){ return ''; }
  }
  _num(v){
    if (typeof v==='number' && isFinite(v)) return v;
    var s = String(v||'').replace(/\./g,'').replace(',','.');
    var n = parseFloat(s); return isNaN(n) ? 0 : n;
  }
  _colorRow(sh, row, color){
    try{
      var cols = (sh && sh.columns ? sh.columns.length : 0);
      for (var c=0;c<cols;c++){
        var cell = sh.getCell(row,c);
        if (!cell) continue;
        cell.style = cell.style || {};
        cell.style.backgroundColor = color;
      }
    }catch(e){}
  }

async init(){
    await this._detectFX();
    this.
  _registerMenus(){
    var self=this;
    function add(label, action){
      try {
        self.kernel.registry.registerMenuItem({ pluginId: PLUGIN_ID, label: label, action: action });
      } catch(e){ self.error('menu', e); }
    }
    add('💰 Registrar novo contrato', function(){ self.showNewLoanModal(); });
    add('📊 Gerar agenda de Accruals', function(){ self._wizardAccrualUnified(); });
    add('📤 Exportar planilha(s)', function(){ self._wizardExport(); });
  }

  async dispose(){ try{ this.kernel?.capabilityRegistry?.unregister(CAP_ID, PLUGIN_ID); }catch{} }

  async _detectFX(){
    try {
      this.fxAvailable = this.kernel?.hasCapability?.('dj.fx.rates@2') || this.kernel?.hasCapability?.('dj.fx.rates@1');
      if (!this.fxAvailable && this.kernel?.pluginDiscovery?.waitFor){
        await this.kernel.pluginDiscovery.waitFor('dj.fx.rates@1', 1000).then(()=> this.fxAvailable = true).catch(()=>{});
      }
    } catch { this.fxAvailable = false; }
  }

  // ---------- Menus ----------
  _registerMenus(){
    const add=(label,action)=>{ try{ this.kernel.registry.registerMenuItem({ pluginId: PLUGIN_ID, label, action }); }catch(e){ this.error('menu',e); } };
    add('💰 Novo Contrato (Avançado)', ()=> this.showNewLoanModal());
    add('💳 Registrar Pagamento', ()=> this.showPaymentModal());
    add('📈 Gerar Agenda de Acúmulo (ACCRUAL)', ()=> this._wizardAccrual());
    add('📤 Exportar XLSX (Planilha atual)', ()=> this.exportActiveSheetXLSX());
  }

  // ---------- Formulas ----------
  _registerFormulas(){
    const reg=(name,impl,syntax,description)=>{
      try{ if (!this.kernel.registry?.getFormula?.(name)){
        this.kernel.registry.registerFormula({ name, impl:(args)=>impl(...args), syntax, description, pluginId: PLUGIN_ID });
      } }catch(e){ this.error('formula', name, e); }
    };
    reg('LOAN.ACCRUAL@v1',
      (id, d0, d1, freq='Diário', rateMode='BASE', fxConv='DAILY', varMode='NONE')=>
        this.createAccrualSheet(String(id), String(d0), String(d1), String(freq), String(rateMode), String(fxConv), String(varMode)).then(ok=> ok?1:0),
      'LOAN.ACCRUAL@v1(contractId, início, fim, [freq="Diário"|"Mensal"|"Anual"], [rateMode="BASE"|"DAILY"], [fxConv="DAILY"|"MONTHLY"|"ANNUAL"], [varMode="NONE"|"PTAX_DAILY"|"PTAX_MONTHLY"])',
      'Gera agenda; PTAX(BCB) para conversão; coluna opcional de VARIAÇÃO = PTAX_CONTRATO − PTAX_BCB (dia/fechamento).'
    );
  }

  // ---------- Capability ----------
  _registerCapability(){
    if (!this.kernel?.registerCapability) return;
    this.kernel.registerCapability(CAP_ID, {
      pluginId: PLUGIN_ID,
      version: VERSION,
      description: 'Loans – accrual/interest schedule & payments',
      api: {
        accrual: (args)=> this.accrual(args),
        exportSheet: (name)=> this._exportSheetByName(name)
      }
    });
  }

  // ---------- Public API ----------
  async accrual({contractId, start, end, freq='Diário', rateMode='BASE', fxConv='DAILY', varMode='NONE'}){
    const c = this._getContract(contractId);
    if (!c) return { error:'Contrato não encontrado.' };
    return await this._buildAccrualRows(c, start, end, freq, rateMode, fxConv, varMode);
  }

  // ---------- UI: Novo Contrato ----------
  async showNewLoanModal(){
    const modal = this.ui.createModal('💰 Novo Contrato (Avançado)');
    const today = new Date().toISOString().split('T')[0];
    modal.body.innerHTML = `
      <style>
        .grid{display:grid;gap:12px}
        .row{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
        .grp{display:flex;flex-direction:column}
        .grp label{font-size:12px;font-weight:600;margin-bottom:4px}
      </style>
      <div class="grid">
        <div class="row">
          <div class="grp"><label>ID</label><input id="id" class="formula-input" value="LOAN-${Date.now()}"/></div>
          <div class="grp"><label>Moeda Origem</label><input id="ccy" class="formula-input" value="USD"/></div>
          <div class="grp"><label>Compounding (Contrato)</label>
            <select id="comp" class="formula-input"><option value="EXP">Exponencial</option><option value="LIN">Linear</option></select>
          </div>
        </div>
        <div class="row">
          <div class="grp"><label>Principal (Origem)</label><input id="pOrig" type="number" class="formula-input" placeholder="1587301.59"/></div>
          <div class="grp"><label>PTAX do Contrato (opcional)</label><input id="ptax" type="number" step="0.0001" class="formula-input" placeholder="6.1500"/></div>
          <div class="grp"><label>Principal BRL</label><input id="pBRL" type="number" class="formula-input" readonly/></div>
        </div>
        <div id="fxhint" style="display:none;background:var(--bg-secondary);border-left:3px solid var(--primary);padding:8px;border-radius:6px;font-size:12px"></div>
        <div class="row">
          <div class="grp"><label>Data Início</label><input id="d0" type="date" class="formula-input" value="${today}"/></div>
          <div class="grp"><label>Períodos (n)</label><input id="nper" type="number" class="formula-input" value="360"/></div>
          <div class="grp"><label>Periodicidade</label>
            <select id="per" class="formula-input"><option>Diário</option><option>Mensal</option><option>Anual</option></select>
          </div>
          <div class="grp"><label>Base (Contrato)</label>
            <select id="base" class="formula-input"><option>30/360</option><option>ACT/365</option><option>ACT/360</option><option>BUS/252</option></select>
          </div>
        </div>
        <div class="row">
          <div class="grp"><label>Leg 1 – Indexador</label>
            <select id="idx1" class="formula-input"><option>FIXED</option><option>CDI</option><option>MANUAL</option><option>PTAX</option></select>
          </div>
          <div class="grp"><label>Percent (%)</label><input id="pct1" type="number" class="formula-input" value="100"/></div>
          <div class="grp"><label>Rate / Spread % a.a.</label><input id="spr1" type="number" class="formula-input" value="7.86"/></div>
          <div class="grp"><label>Base da Leg 1</label>
            <select id="base1" class="formula-input"><option></option><option>30/360</option><option>ACT/365</option><option>ACT/360</option><option>BUS/252</option></select>
          </div>
        </div>
        <div class="row">
          <div class="grp"><label>Leg 2 – Indexador</label>
            <select id="idx2" class="formula-input"><option></option><option>CDI</option><option>MANUAL</option><option>PTAX</option></select>
          </div>
          <div class="grp"><label>Percent (%)</label><input id="pct2" type="number" class="formula-input" value="100"/></div>
          <div class="grp"><label>Rate / Spread % a.a.</label><input id="spr2" type="number" class="formula-input" value="0"/></div>
          <div class="grp"><label>Base da Leg 2</label>
            <select id="base2" class="formula-input"><option></option><option>30/360</option><option>ACT/365</option><option>ACT/360</option><option>BUS/252</option></select>
          </div>
        </div>
      </div>
    `;
    const footer = document.createElement('div');
    footer.style.cssText='display:flex;justify-content:flex-end;gap:12px;padding:16px;border-top:1px solid var(--border)';
    footer.innerHTML = `<button class="toolbar-btn btn-cancel">Cancelar</button><button class="toolbar-btn btn-ok" style="background:var(--primary);color:white">Criar</button>`;
    modal.container.appendChild(footer);
    document.body.appendChild(modal.overlay);

    const $=(q)=> modal.body.querySelector(q);

    const updateBRL = async()=>{
      const ccy = $('#ccy').value.trim().toUpperCase();
      const p = parseFloat($('#pOrig').value)||0;
      const d0 = $('#d0').value;
      const ptax = parseFloat($('#ptax').value);
      const hint = $('#fxhint');
      if (ccy==='BRL'){ $('#pBRL').value = p.toFixed(2); hint.style.display='none'; return; }
      if (!p || !d0){ hint.style.display='none'; return; }
      hint.style.display='block';
      if (!isNaN(ptax) && ptax>0){ $('#pBRL').value=(p*ptax).toFixed(2); hint.textContent=`Usando PTAX do Contrato = ${ptax.toFixed(4)}`; return; }
      if (this.fxAvailable){
        try{
          let rate = await this.kernel.requestCapability('dj.fx.rates@1','getRate',{date:d0,currency:ccy,source:'MANUAL'});
          if (typeof rate==='number' && rate>0){ $('#pBRL').value=(p*rate).toFixed(2); hint.textContent=`Taxa MANUAL ${ccy}→BRL: ${rate.toFixed(4)}`; return; }
          rate = await this.kernel.requestCapability('dj.fx.rates@1','getRate',{date:d0,currency:ccy,source:'PTAX'});
          if (typeof rate==='number' && rate>0){ $('#pBRL').value=(p*rate).toFixed(2); hint.textContent=`PTAX (BCB) ${ccy}→BRL: ${rate.toFixed(4)}`; return; }
          hint.textContent=`Sem taxa para ${ccy} em ${d0}. Informe PTAX do Contrato.`;
        }catch{ hint.textContent='FX não disponível.'; }
      } else hint.textContent='FX não disponível; informe PTAX do Contrato.';
    };
    ['blur','change'].forEach(ev=>{ ['#pOrig','#ptax','#ccy','#d0'].forEach(q=> $(q).addEventListener(ev, updateBRL)); });

    footer.querySelector('.btn-cancel').addEventListener('click', ()=> modal.overlay.remove());
    footer.querySelector('.btn-ok').addEventListener('click', async()=>{
      const data={
        id: $('#id').value.trim(),
        currency: $('#ccy').value.trim().toUpperCase(),
        compounding: $('#comp').value, // 'EXP' | 'LIN'
        principalOrigin: parseFloat($('#pOrig').value)||0,
        contractPTAX: parseFloat($('#ptax').value)||'',
        principalBRL: parseFloat($('#pBRL').value)||0,
        startDate: $('#d0').value,
        nper: parseInt($('#nper').value,10)||12,
        periodicity: $('#per').value,
        base: $('#base').value,
        rounding: 'HALF_UP',
        legs: [
          { indexer: $('#idx1').value, percent: parseFloat($('#pct1').value)||100, spreadAA: parseFloat($('#spr1').value)||0, base: $('#base1').value||'', role:'RATE' }
        ]
      };
      if ($('#idx2').value){ data.legs.push({ indexer: $('#idx2').value, percent: parseFloat($('#pct2').value)||100, spreadAA: parseFloat($('#spr2').value)||0, base: $('#base2').value||'', role:'RATE' }); }
      data.endDate = U.addPeriods(data.startDate, data.nper, data.periodicity);
      await this._createContract(data);
      modal.overlay.remove();
    });
  }

  // ---------- UI: Pagamento (multi‑moeda) ----------
  showPaymentModal(){
    const wb = this.kernel.workbookManager.getActiveWorkbook();
    const cs = wb?.sheets.find(s=> s.name===LoanPluginV971.S.CONTRACTS);
    if (!cs || cs.rows<=1) return this.ui.showToast('Nenhum contrato.', 'warning');
    const ids=[]; const sCol = this._findHeader(cs,'Status');
    for (let i=1;i<cs.rows;i++){ if ((cs.getCellValue(i,sCol)||'')!=='Quitado') ids.push(cs.getCellValue(i,0)); }

    const modal = this.ui.createModal('💳 Registrar Pagamento');
    modal.body.innerHTML = `
      <div style="display:grid;gap:12px">
        <div class="grp"><label>Contrato</label><select id="cid" class="formula-input">${ids.map(x=>`<option>${x}</option>`).join('')}</select></div>
        <div class="grp"><label>Data</label><input id="dt" type="date" class="formula-input" value="${new Date().toISOString().split('T')[0]}"/></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="grp"><label>Valor</label><input id="amt" type="number" class="formula-input" placeholder="1000.00"/></div>
          <div class="grp"><label>Moeda do Pagamento</label><input id="cur" class="formula-input" value="BRL"/></div>
        </div>
        <div class="grp"><label>Alocação</label><select id="alloc" class="formula-input"><option>AUTO</option><option>JUROS</option><option>PRINCIPAL</option><option>MISTO</option></select></div>
        <div id="mix" class="grp" style="display:none"><label>Juros dentro do pagamento (se MISTO, na mesma moeda do pagamento)</label><input id="amtInt" type="number" class="formula-input" placeholder="300.00"/></div>
      </div>`;
    const footer = document.createElement('div');
    footer.style.cssText='display:flex;justify-content:flex-end;gap:12px;padding:16px;border-top:1px solid var(--border)';
    footer.innerHTML = `<button class="toolbar-btn btn-cancel">Cancelar</button><button class="toolbar-btn btn-ok" style="background:var(--primary);color:white">Registrar</button>`;
    modal.container.appendChild(footer);
    document.body.appendChild(modal.overlay);
    const $=(q)=> modal.body.querySelector(q);

    $('#alloc').addEventListener('change', ()=> { $('#mix').style.display = ($('#alloc').value==='MISTO')?'block':'none'; });

    footer.querySelector('.btn-cancel').addEventListener('click', ()=> modal.overlay.remove());
    footer.querySelector('.btn-ok').addEventListener('click', async()=>{
      const id=$('#cid').value, date=$('#dt').value, amount=parseFloat($('#amt').value)||0, alloc=$('#alloc').value, amountInt=parseFloat($('#amtInt').value)||0, currency=($('#cur').value||'BRL').toUpperCase();
      if (!amount || amount<=0) { this.ui.showToast('Valor inválido.', 'error'); return; }
      await this._registerPayment({contractId:id, date, amount, alloc, amountInt, currency});
      modal.overlay.remove();
    });
  }

  // ---------- Wizard de ACCRUAL ----------
  _wizardAccrual(){
    const wb = this.kernel.workbookManager.getActiveWorkbook();
    const cs = wb?.sheets.find(s=> s.name===LoanPluginV971.S.CONTRACTS);
    if (!cs || cs.rows<=1) return this.ui.showToast('Nenhum contrato.', 'warning');
    const ids=[]; for (let i=1;i<cs.rows;i++) ids.push(cs.getCellValue(i,0));
    const modal = this.ui.createModal('📈 Agenda de Acúmulo (ACCRUAL)');
    modal.body.innerHTML = `
      <div style="display:grid;gap:12px">
        <div class="grp"><label>Contrato</label><select id="cid" class="formula-input">${ids.map(x=>`<option>${x}</option>`).join('')}</select></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="grp"><label>Início</label><input id="d0" type="date" class="formula-input" value="${new Date().toISOString().split('T')[0]}"/></div>
          <div class="grp"><label>Fim</label><input id="d1" type="date" class="formula-input" value="${new Date().toISOString().split('T')[0]}"/></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
          <div class="grp"><label>Frequência</label><select id="fq" class="formula-input"><option>Diário</option><option>Mensal</option><option>Anual</option></select></div>
          <div class="grp"><label>Fonte da Taxa</label><select id="rm" class="formula-input"><option value="BASE">Base do Contrato</option><option value="DAILY">Taxas diárias (BACEN/Importadas)</option></select></div>
          <div class="grp"><label>Conversão PTAX (BCB)</label><select id="fxc" class="formula-input"><option value="DAILY">Diária</option><option value="MONTHLY">Mensal (EOM)</option><option value="ANNUAL">Anual (EOY)</option></select></div>
        </div>
        <div class="grp"><label>Variação PTAX (mostrar coluna)</label>
          <select id="varm" class="formula-input">
            <option value="NONE">Nenhuma</option>
            <option value="PTAX_DAILY">Diária (PTAX_CONTRATO − PTAX_BCB[dia])</option>
            <option value="PTAX_MONTHLY">Mensal (PTAX_CONTRATO − PTAX_BCB[fechamento])</option>
          </select>
        </div>
      </div>`;
    const footer = document.createElement('div');
    footer.style.cssText='display:flex;justify-content:flex-end;gap:12px;padding:16px;border-top:1px solid var(--border)';
    footer.innerHTML = `<button class="toolbar-btn btn-cancel">Cancelar</button><button class="toolbar-btn btn-ok" style="background:var(--primary);color:white">Gerar</button>`;
    modal.container.appendChild(footer);
    document.body.appendChild(modal.overlay);
    const $=(q)=> modal.body.querySelector(q);
    footer.querySelector('.btn-cancel').addEventListener('click', ()=> modal.overlay.remove());
    footer.querySelector('.btn-ok').addEventListener('click', async()=>{
      await this.createAccrualSheet($('#cid').value, $('#d0').value, $('#d1').value, $('#fq').value, $('#rm').value, $('#fxc').value, $('#varm').value);
      modal.overlay.remove();
    });
  }

  // ---------- Core de ACCRUAL ----------
  async createAccrualSheet(contractId, start, end, freq='Diário', rateMode='BASE', fxConv='DAILY', varMode='NONE'){
    const c = this._getContract(contractId);
    if (!c) { this.ui.showToast('Contrato não encontrado.','error'); return false; }
    const res = await this._buildAccrualRows(c, start, end, freq, rateMode, fxConv, varMode);
    if (res?.error) { this.ui.showToast(res.error, 'error'); return false; }

    const wb = this.kernel.workbookManager.getActiveWorkbook();
    const name = `${LoanPluginV971.S.ACCRUAL}${contractId}_${start}_${end}_${freq}_${rateMode}_${fxConv}_${varMode}`;
    let sh = wb.sheets.find(s=> s.name===name) || wb.addSheet(name);
    sh.columns=[]; sh.rows=0;

    const isFX = String(c.moedaorigem||c.moeda||c.currency||'BRL').toUpperCase() !== 'BRL';

    const baseColsFX = ['DATE','INTEREST RATE','PTAX (BCB)','PRIOR BALANCE FX','PRIOR BALANCE BRL','INTEREST FX','INTEREST BRL','MONTANTE FX','MONTANTE BRL','JUROS ACUM. FX','JUROS ACUM. BRL'];
    const H = isFX ? baseColsFX.slice() : ['DATE','INTEREST RATE','PRIOR BALANCE','INTEREST','MONTANTE','JUROS ACUM.'];
    if (isFX && varMode==='PTAX_DAILY') H.splice(3,0,'PTAX Δ (Contrato − BCB Dia)');
    if (isFX && varMode==='PTAX_MONTHLY') H.splice(3,0,'PTAX Δ (Contrato − BCB Fechamento)');
    H.forEach((h,i)=> this._setCell(sh,0,i,h,'HEADER'));

    let r=1;
    const CURFX_TAG='CURFX:'+c.moeda;
    for (const row of res.rows){
      let cidx=0;
      this._setCell(sh,r,cidx++,row.date,'DATE');
      this._setCell(sh,r,cidx++,row.effRate,'PCT4');
      if (isFX){
        this._setCell(sh,r,cidx++,row.ptax||'', null);
        if (varMode==='PTAX_DAILY' || varMode==='PTAX_MONTHLY') this._setCell(sh,r,cidx++,row.ptaxDelta||'', null);
        this._setCell(sh,r,cidx++,row.openingFX, CURFX_TAG);
        this._setCell(sh,r,cidx++,row.openingBRL,'CUR');
        this._setCell(sh,r,cidx++,row.interestFX, CURFX_TAG);
        this._setCell(sh,r,cidx++,row.interestBRL,'CUR');
        this._setCell(sh,r,cidx++,row.amountFX,   CURFX_TAG);
        this._setCell(sh,r,cidx++,row.amountBRL, 'CUR');
        this._setCell(sh,r,cidx++,row.accruedFX,  CURFX_TAG);
        this._setCell(sh,r,cidx++,row.accruedBRL,'CUR');
      } else {
        this._setCell(sh,r,cidx++,row.openingBRL,'CUR');
        this._setCell(sh,r,cidx++,row.interestBRL,'CUR');
        this._setCell(sh,r,cidx++,row.amountBRL,'CUR');
        this._setCell(sh,r,cidx++,row.accruedBRL,'CUR');
      }
      r++;
    }
    sh.rows=r;

    // Cabeçalho-resumo (usa a MESMA tag CURFX_TAG; sem redeclarar)
    const top=[
      ['Agenda de Acúmulo (ACCRUAL)', c.id],
      ['Janela', `${start} → ${end} (${freq})`],
      ['Fonte de taxa', rateMode==='DAILY'?'Taxas diárias (BACEN/Importadas)':'Base do Contrato'],
      ['Conversão PTAX (BCB)', fxConv],
      ['Variação PTAX', varMode==='NONE'?'—':(varMode==='PTAX_DAILY'?'Contrato − BCB (Diária)':'Contrato − BCB (Fechamento)')],
      ['Moeda Origem / PTAX do Contrato', `${c.moeda||c.currency||'BRL'} / ${c.ptaxcontrato||'-'}`],
      ['Principal (Origem)', c.principalorigem||0],
      ['Principal (BRL)', c.principalbrl||0]
    ];
    let rr = r+1;
    top.forEach((pair,i)=>{
      this._setCell(sh, rr+i, 0, pair[0], 'HEAD2');
      if (i>=6 && isFX) this._setCell(sh, rr+i, 1, pair[1], CURFX_TAG);
      else if (i>=7 || (!isFX && i>=6)) this._setCell(sh, rr+i, 1, pair[1], 'CUR');
      else this._setCell(sh, rr+i, 1, String(pair[1]));
    });

    this.ui.showToast('Agenda de acúmulo criada.', 'success');
    return true;
  }

  async _buildAccrualRows(c, start, end, freq, rateMode, fxConv, varMode){
    const isFX = String(c.moeda||c.currency||c.moedaorigem||'BRL').toUpperCase() !== 'BRL';

    // Saldo inicial em FX
    let balFX = c.principalorigem || c.principalOrigin || 0;
    const ledger = this._getLedger(c.id);
    const prior = ledger.filter(e=> U.toD(e.date) < U.toD(start)).sort((a,b)=> U.toD(a.date)-U.toD(b.date));
    for (const e of prior){ if (isFX) balFX = U.round(balFX - (e.amortFX||0), 8, 'HALF_UP'); }

    // checkpoints
    const periodEnds=[]; const startD=U.toD(start), endD=U.toD(end);
    if (freq==='Diário'){ for (let d=U.addDays(startD,1); d<=endD; d=U.addDays(d,1)) periodEnds.push(U.fmtD(d)); }
    else if (freq==='Anual'){ for (let d=U.addYear(startD,1); d<=endD; d=U.addYear(d,1)) periodEnds.push(U.fmtD(d)); }
    else { for (let d=U.addMonth(startD,1); d<=endD; d=U.addMonth(d,1)) periodEnds.push(U.fmtD(d)); }

    const rows=[]; let accBRL=0, accFX=0; let prev = start;

    // PTAX contrato (fixa): se não informada → tenta MANUAL na data de início → senão BCB do início
    const ptaxCtr = await this._getContractPTAXFixed(c, start);

    for (const d1 of periodEnds){
      const rEffTotal = await this._legsEffTotal(c, prev, d1, rateMode);
      const ptaxBCB = await this._ptaxBCBByMode(d1, c.moeda||c.currency, fxConv); // coluna PTAX

      // Interest / Amount
      const openingBRL = isFX ? U.round(balFX * ptaxBCB, 2, c.rounding||'HALF_UP') : (balFX||0);
      const interestFX  = isFX ? U.round(balFX * rEffTotal, 8, 'HALF_UP') : 0;
      const interestBRL = isFX ? U.round(interestFX * ptaxBCB, 2, c.rounding||'HALF_UP') : U.round(openingBRL * rEffTotal, 2, c.rounding||'HALF_UP');
      const amountFX    = isFX ? U.round(balFX + interestFX, 8, 'HALF_UP') : 0;
      const amountBRL   = isFX ? U.round(amountFX * ptaxBCB, 2, c.rounding||'HALF_UP') : U.round(openingBRL + interestBRL, 2, c.rounding||'HALF_UP');

      if (isFX){ accFX = U.round(accFX + interestFX, 8, 'HALF_UP'); accBRL = U.round(accBRL + interestBRL, 2, c.rounding||'HALF_UP'); }
      else { accBRL = U.round(accBRL + interestBRL, 2, c.rounding||'HALF_UP'); }

      // Variação PTAX (visão): Contrato − BCB(dia/EOM)
      let ptaxDelta = '';
      if (isFX && varMode==='PTAX_DAILY'){
        const bcbDay = await this._ptaxBCBByMode(d1, c.moeda||c.currency, 'DAILY');
        ptaxDelta = U.round(ptaxCtr - bcbDay, 6, 'HALF_UP');
      } else if (isFX && varMode==='PTAX_MONTHLY'){
        const bcbEOM = await this._ptaxBCBByMode(d1, c.moeda||c.currency, 'MONTHLY');
        ptaxDelta = U.round(ptaxCtr - bcbEOM, 6, 'HALF_UP');
      }

      const out = isFX ?
        { date:d1, effRate:rEffTotal, ptax: ptaxBCB, ptaxDelta, openingFX: balFX, openingBRL, interestFX, interestBRL, amountFX, amountBRL, accruedFX: accFX, accruedBRL: accBRL }
        : { date:d1, effRate:rEffTotal, openingBRL, interestBRL, amountBRL, accruedBRL: accBRL };

      rows.push(out);
      balFX = isFX ? amountFX : amountBRL; prev = d1;
    }
    return { rows };
  }

  // ---------- Taxa efetiva do período (duas pernas) ----------
  async _legsEffTotal(c, d0, d1, rateMode='BASE'){
    const legs = (c.legs||[]).map(l=> this._normalizeLeg(l)).filter(l=> !!l.indexer);
    if (!legs.length) return 0;
    const effPerLeg=[];
    for (const leg of legs){
      const idx = String(leg.indexer).toUpperCase();
      const percent = (U.num(leg.percent)||100)/100; // 120 → 1.2
      const spreadAA = (U.num(leg.spreadAA)||0)/100; // % a.a.
      const baseLeg = leg.base || c.base || '30/360';
      const compLeg = leg.compounding || c.compounding || 'EXP';

      // Indexador
      let rEffIndex = 0;
      if (rateMode==='DAILY'){
        rEffIndex = await this._dailyIndexerEff(d0, d1, idx, percent); // integra diário
        if (rEffIndex==null){ rEffIndex = await this._baseIndexerEff(d0, d1, idx, percent, baseLeg, compLeg); }
      } else {
        rEffIndex = await this._baseIndexerEff(d0, d1, idx, percent, baseLeg, compLeg);
      }
      // Spread anual → efetivo
      const rEffSpread = U.annualToEff(d0, d1, spreadAA, baseLeg, compLeg);
      effPerLeg.push( (1+rEffIndex)*(1+rEffSpread) - 1 );
    }
    return effPerLeg.reduce((acc,ri)=> (acc*(1+ri)), 1) - 1;
  }

  async _baseIndexerEff(d0,d1,idx,percent,base,comp){
    if (idx==='FIXED' || idx==='MANUAL'){
      return 0; // spread carrega a taxa
    } else if (idx==='CDI'){
      const cdiAA = this._lookupCurveAA('CDI');
      const ann = (cdiAA!=null) ? (cdiAA*percent) : 0;
      return U.annualToEff(d0,d1,ann,base,comp);
    } else if (idx==='PTAX'){
      return 0; // PTAX como índice de juros só se explicitamente marcado em versões antigas
    }
    return 0;
  }

  async _dailyIndexerEff(d0,d1,idx,percent){
    const wb = this.kernel.workbookManager.getActiveWorkbook();
    const sheets = LoanPluginV971.S.RATE_DAILY_CAND.map(n=> wb?.sheets.find(s=> s.name===n)).filter(Boolean);
    if (!sheets.length) return null;
    const key = (idx==='CDI') ? ['cdi_daily','cdi'] : [idx.toLowerCase()];

    const start = U.toD(d0), end = U.toD(d1);
    for (let s of sheets){
      const map = new Map(); const h = {};
      for (let c=0;c<s.columns.length;c++){ h[(s.getCellValue(0,c)||'').toString().replace(/\s+/g,'').toLowerCase()] = c; }
      const cDate = h['date'] ?? h['data'];
      const cRate = key.map(k=> h[k]).find(v=> v!=null);
      if (cDate==null || cRate==null) continue;
      for (let r=1;r<s.rows;r++){
        const dt = new Date(String(s.getCellValue(r,cDate))).toISOString().split('T')[0];
        const v  = parseFloat(s.getCellValue(r,cRate)); if (isNaN(v)) continue; map.set(dt, v/100); // % a.d.
      }
      let acc = 1; let any=false;
      for (let d = new Date(start); d<=end; d.setUTCDate(d.getUTCDate()+1)){
        const k = d.toISOString().split('T')[0];
        if (map.has(k)) { acc *= (1 + percent*map.get(k)); any=true; }
      }
      if (any) return acc-1;
    }
    return null;
  }

  // ---------- Exportação XLSX (corrige vírgula/ponto) ----------
  exportActiveSheetXLSX(){
    const wb = this.kernel.workbookManager.getActiveWorkbook();
    const sh = wb?.getActiveSheet ? wb.getActiveSheet() : wb?.sheets?.[0];
    if (!sh) return this.ui.showToast('Nenhuma planilha ativa.','warning');
    const name = sh.name || 'Sheet';
    const aoa=[];
    for (let r=0; r<sh.rows; r++){
      const row=[]; for (let c=0; c<sh.columns.length; c++){
        const v = sh.getCellValue(r,c);
        const parsed = U.parseLocaleNumber(v);
        row.push(parsed);
      }
      aoa.push(row);
    }
    this._downloadXLSX(name, aoa);
  }
  async _exportSheetByName(name){
    const wb = this.kernel.workbookManager.getActiveWorkbook();
    const sh = wb?.sheets.find(s=> s.name===name);
    if (!sh) return false;
    const aoa=[]; for (let r=0; r<sh.rows; r++){ const row=[]; for (let c=0; c<sh.columns.length; c++){ row.push(U.parseLocaleNumber(sh.getCellValue(r,c))); } aoa.push(row); }
    this._downloadXLSX(name, aoa); return true;
  }
  _downloadXLSX(name, aoa){
    try{
      if (window.XLSX){
        const wb = window.XLSX.utils.book_new();
        const ws = window.XLSX.utils.aoa_to_sheet(aoa);
        window.XLSX.utils.book_append_sheet(wb, ws, (name||'Sheet').slice(0,31));
        window.XLSX.writeFile(wb, `${name}.xlsx`);
        this.ui.showToast('XLSX exportado.','success');
        return;
      }
    }catch(e){ this.error('xlsx',e); }
    // Fallback CSV (usa ; como separador, mantém ponto decimal)
    const csv = aoa.map(row=> row.map(v=>{
      if (typeof v==='number' && isFinite(v)) return String(v);
      const s = (v==null?'' : String(v));
      if (/[";\n]/.test(s)) return '"'+s.replace(/"/g,'""')+'"';
      return s;
    }).join(';')).join('\n');
    const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
    const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`${name}.csv`; a.click();
    setTimeout(()=> URL.revokeObjectURL(a.href), 1000);
    this.ui.showToast('CSV exportado (XLSX não disponível).','warning');
  }

  // ---------- Data e Contratos ----------
  async _createContract(data){
    const wb = this.kernel.workbookManager.getActiveWorkbook() || this.kernel.workbookManager.createWorkbook('Empréstimos');
    let sh = wb.sheets.find(s=> s.name===LoanPluginV971.S.CONTRACTS);
    if (!sh){
      sh = wb.addSheet(LoanPluginV971.S.CONTRACTS);
      ['ID','Tipo','Principal BRL','Principal Origem','Moeda Origem','Taxa Conversão','PTAX Contrato',
       'Periodicidade','Base','Compounding','Rounding',
       'Leg1 Indexer','Leg1 Percent','Leg1 SpreadAA','Leg1 Base','Leg1 Role',
       'Leg2 Indexer','Leg2 Percent','Leg2 SpreadAA','Leg2 Base','Leg2 Role',
       'Data Início','Nper','Data Venc','Saldo Devedor','Status']
        .forEach((h,i)=> this._setCell(sh,0,i,h,'HEADER'));
      sh.rows=1;
    }
    const conv = data.currency==='BRL'?1: (data.principalBRL && data.principalOrigin ? data.principalBRL/data.principalOrigin : '');
    const r = sh.rows;
    const leg1 = data.legs[0]||{}; const leg2 = data.legs[1]||{};
    [
      data.id, 'Pagador', data.principalBRL, data.principalOrigin, data.currency, conv, (data.contractPTAX||''),
      data.periodicity, data.base, data.compounding||'EXP', data.rounding||'HALF_UP',
      leg1.indexer||'', leg1.percent||'', leg1.spreadAA||'', leg1.base||'', (leg1.role||'RATE'),
      leg2.indexer||'', leg2.percent||'', leg2.spreadAA||'', leg2.base||'', (leg2.role||'RATE'),
      data.startDate, data.nper, data.endDate, data.principalBRL, 'Ativo'
    ].forEach((v,i)=> this._setCell(sh,r,i,v));
    sh.rows++;
    this.ui.showToast(`Contrato ${data.id} criado.`, 'success');
  }

  _getContract(id){
    const wb = this.kernel.workbookManager.getActiveWorkbook();
    const sh = wb?.sheets.find(s=> s.name===LoanPluginV971.S.CONTRACTS);
    if (!sh) return null;
    const headers=[];
    for (let i=0;i<sh.columns.length;i++) headers.push((sh.getCellValue(0,i)||'').toString().replace(/\s+/g,'').replace(/\./g,'').toLowerCase());
    for (let r=1;r<sh.rows;r++){
      if (sh.getCellValue(r,0)===id){
        const data={ rowIndex:r, legs:[] };
        headers.forEach((k,c)=>{
          const raw=sh.getCellValue(r,c);
          const isNum=['principalbrl','principalorigem','taxaconversão','ptaxcontrato','nper','saldodevedor','percent','spreadaa','leg1percent','leg2percent','leg1spreadaa','leg2spreadaa'].includes(k);
          const val=isNum?parseFloat(raw)||0:raw;
          if (k.startsWith('leg1')||k.startsWith('leg2')){
            const idx = k.startsWith('leg1')?0:1; let prop=k.replace(/^leg[12]/,'');
            if (prop==='spreadaa') prop='spreadAA'; if (prop==='percent') prop='percent'; if (prop==='base') prop='base'; if (prop==='indexer'||prop==='indexador') prop='indexer'; if (prop==='role') prop='role';
            if(!data.legs[idx]) data.legs[idx]={}; data.legs[idx][prop]=val;
          } else data[k]=val;
        });
        data.currency = data.moedaorigem || data.moeda || data.currency || 'BRL';
        data.moeda = data.currency; // alias para formatos
        data.rounding = data.rounding || 'HALF_UP';
        data.compounding = data.compounding || 'EXP';
        return data;
      }
    }
    return null;
  }

  _normalizeLeg(leg){
    const o={...leg};
    if (o.spreadaa!=null && o.spreadAA==null) o.spreadAA=o.spreadaa;
    if (o.indexador && !o.indexer) o.indexer=o.indexador;
    if (o.Percent!=null && o.percent==null) o.percent=o.Percent;
    return o;
  }

  _getLedger(id){
    const wb = this.kernel.workbookManager.getActiveWorkbook();
    const name = `${LoanPluginV971.S.LEDGER}${id}`;
    const sh = wb?.sheets.find(s=> s.name===name);
    if (!sh || sh.rows<=1) return [];
    const H = {};
    for (let c=0;c<sh.columns.length;c++){ H[(sh.getCellValue(0,c)||'').toString().toLowerCase()] = c; }
    const L=[];
    for (let i=1;i<sh.rows;i++){
      const date = sh.getCellValue(i, H['data'] ?? 0);
      const amtBRL = U.num(sh.getCellValue(i, H['valor brl'] ?? 5));
      const amortBRL = U.num(sh.getCellValue(i, H['amortização brl'] ?? 12));
      const amortFX  = U.num(sh.getCellValue(i, H['amortização '+(H['valor usd']?'usd':'fx')] ?? 13));
      L.push({ date, amountBRL: amtBRL, amortBRL, amortFX });
    }
    return L;
  }

  // ---------- PTAX / FX ----------
  async _getContractPTAXFixed(c, startDate){
    const ccy = String(c.moeda||c.currency||'USD').toUpperCase();
    const fixed = parseFloat(c.ptaxcontrato||0);
    if (fixed>0) return fixed;
    // tenta MANUAL na data de início; se não, BCB do início
    try{
      if (this.fxAvailable){
        let rate = await this.kernel.requestCapability('dj.fx.rates@1','getRate',{date:startDate,currency: ccy, source:'MANUAL'});
        if (typeof rate==='number' && rate>0) return rate;
        rate = await this.kernel.requestCapability('dj.fx.rates@1','getRate',{date:startDate,currency: ccy, source:'PTAX'});
        if (typeof rate==='number' && rate>0) return rate;
      }
    }catch{}
    return 1;
  }
  async _ptaxBCB(date, currency='USD'){
    try{
      const r2 = this.kernel?.hasCapability?.('dj.fx.rates@2');
      if (r2){ const rate2 = await this.kernel.requestCapability('dj.fx.rates@2','getRate',{date, currency, source:'PTAX'}); if (typeof rate2==='number' && rate2>0) return rate2; }
      const rate = await this.kernel.requestCapability('dj.fx.rates@1','getRate',{date, currency, source:'PTAX'});
      return (typeof rate==='number' && rate>0) ? rate : 1;
    }catch{ return 1; }
  }
  async _ptaxBCBByMode(date, currency, mode){
    const d = U.toD(date);
    if (mode==='ANNUAL'){ const y = new Date(Date.UTC(d.getUTCFullYear(),11,31)); return await this._ptaxBCB(U.fmtD(y), currency); }
    if (mode==='MONTHLY'){ const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth()+1, 0)); return await this._ptaxBCB(U.fmtD(m), currency); }
    return await this._ptaxBCB(U.fmtD(d), currency); // DAILY
  }
  _lookupCurveAA(indexer){
    const wb = this.kernel.workbookManager.getActiveWorkbook(); const sh = wb?.sheets.find(s=> s.name===LoanPluginV971.S.RATE_CURVES);
    if (!sh) return null; let last=null; for (let i=1;i<sh.rows;i++){ const idx=(sh.getCellValue(i,0)||'').toString().toUpperCase(); const val=parseFloat(sh.getCellValue(i,2)); if (idx===String(indexer).toUpperCase() && !isNaN(val)) last=val; } return last;
  }

  // ---------- Pagamentos ----------
  async _registerPayment({contractId, date, amount, alloc='AUTO', amountInt=0, currency='BRL'}){
    const c = this._getContract(contractId);
    if (!c) return this.ui.showToast('Contrato não encontrado.','error');
    if (!date) return this.ui.showToast('Data inválida.','error');

    // Conversões
    const ratePayToBRL = await this._fxGeneric(date, currency); // moeda do pagamento → BRL
    const rateCtrToBRL = await this._ptaxBCB(date, c.moeda||c.currency); // **BCB**

    const amountBRL = U.round(amount * (ratePayToBRL||1), 2, c.rounding||'HALF_UP');
    const amountFX  = U.safeDiv(amountBRL, (rateCtrToBRL||1));

    const wb = this.kernel.workbookManager.getActiveWorkbook();
    const name = `${LoanPluginV971.S.LEDGER}${contractId}`;
    let sh = wb.sheets.find(s=> s.name===name) || wb.addSheet(name);
    const isFX = String(c.moeda||c.currency||'BRL').toUpperCase() !== 'BRL';
    if (sh.rows===0){
      const H = isFX ?
        ['Data','Evento','Moeda Pgto','Valor (Input)','FX Pgto→BRL','Valor BRL','Valor '+(c.moeda||c.currency),'Alocação','Juros no Período BRL','Juros no Período '+(c.moeda||c.currency),'Juros pagos BRL','Juros pagos '+(c.moeda||c.currency),'Amortização BRL','Amortização '+(c.moeda||c.currency),'Saldo Devedor BRL','Saldo Devedor '+(c.moeda||c.currency)]
        : ['Data','Evento','Moeda Pgto','Valor (Input)','FX Pgto→BRL','Valor BRL','Alocação','Juros no Período','Juros pagos','Amortização','Saldo Devedor'];
      H.forEach((h,i)=> this._setCell(sh,0,i,h,'HEADER'));
      sh.rows=1;
    }

    // estado anterior (saldo BRL aprox.)
    let lastDate=c.datainício||c.startDate, lastBalBRL=c.principalbrl;
    if (sh.rows>1){
      const r=sh.rows-1; lastDate = sh.getCellValue(r,0) || lastDate;
      const balCol = this._findHeader(sh, isFX?('Saldo Devedor BRL'):'Saldo Devedor');
      const lastBalVal = U.num(sh.getCellValue(r, balCol)); if (lastBalVal>0) lastBalBRL = lastBalVal;
    }
    const rEff = U.annualToEff(lastDate, date, await this._legsAnnualApprox(c, lastDate, date), c.base, c.compounding||'EXP');
    const Ibrl = U.round(lastBalBRL*rEff, 2, c.rounding||'HALF_UP');
    const Ifx  = U.safeDiv(Ibrl, (rateCtrToBRL||1));

    // Alocação
    const amountIntBRL = U.round((amountInt||0) * (ratePayToBRL||1), 2, c.rounding||'HALF_UP');
    let payI_BRL=0, payP_BRL=0;
    if (alloc==='JUROS'){ payI_BRL = Math.min(Ibrl, amountBRL); payP_BRL = Math.max(0, amountBRL - payI_BRL); }
    else if (alloc==='PRINCIPAL'){ payP_BRL = amountBRL; }
    else if (alloc==='MISTO'){ payI_BRL = Math.min(Ibrl, amountIntBRL||0); payP_BRL = Math.max(0, amountBRL - payI_BRL); }
    else { payI_BRL = Math.min(Ibrl, amountBRL); payP_BRL = Math.max(0, amountBRL - payI_BRL); }

    const payI_FX = U.safeDiv(payI_BRL, (rateCtrToBRL||1));
    const payP_FX = U.safeDiv(payP_BRL, (rateCtrToBRL||1));

    const newBalBRL = U.round(lastBalBRL + Ibrl - (payI_BRL + payP_BRL), 2, c.rounding||'HALF_UP');
    const newBalFX  = U.safeDiv(newBalBRL, (rateCtrToBRL||1));

    const row = sh.rows; const CURFX_FMT='CURFX:'+(c.moeda||c.currency||'USD');
    this._setCell(sh,row,0,date,'DATE'); this._setCell(sh,row,1,'Pagamento');
    this._setCell(sh,row,2,currency); this._setCell(sh,row,3,amount,'CUR');
    this._setCell(sh,row,4,ratePayToBRL||1); this._setCell(sh,row,5,amountBRL,'CUR');
    if (isFX){ this._setCell(sh,row,6,amountFX,CURFX_FMT); this._setCell(sh,row,7,alloc); this._setCell(sh,row,8,Ibrl,'CUR'); this._setCell(sh,row,9,Ifx,CURFX_FMT); this._setCell(sh,row,10,payI_BRL,'CUR'); this._setCell(sh,row,11,payI_FX,CURFX_FMT); this._setCell(sh,row,12,payP_BRL,'CUR'); this._setCell(sh,row,13,payP_FX,CURFX_FMT); this._setCell(sh,row,14,newBalBRL,'CUR'); this._setCell(sh,row,15,newBalFX,CURFX_FMT); }
    else { this._setCell(sh,row,6,alloc); this._setCell(sh,row,7,Ibrl,'CUR'); this._setCell(sh,row,8,payI_BRL,'CUR'); this._setCell(sh,row,9,payP_BRL,'CUR'); this._setCell(sh,row,10,newBalBRL,'CUR'); }
    sh.rows++;

    // atualizar cadastro (saldo BRL)
    const cs = wb.sheets.find(s=> s.name===LoanPluginV971.S.CONTRACTS);
    const balCol = this._findHeader(cs,'Saldo Devedor'), statusCol = this._findHeader(cs,'Status');
    if (balCol>-1) this._setCell(cs,c.rowIndex,balCol,newBalBRL,'CUR');
    if (statusCol>-1) cs.setCell(c.rowIndex,statusCol, newBalBRL<=0.01?'Quitado':'Ativo');
    this.ui.showToast('Pagamento registrado.', 'success');
  }

  // ---------- helpers ----------
  async _legsAnnualApprox(c, d0, d1){
    const eff = await this._legsEffTotal(c, d0, d1, 'BASE');
    const {days,year}=U.dcf(d0,d1,c.base||'30/360'); if (days<=0) return 0;
    return Math.pow(1+eff, (year||360)/days) - 1;
  }
  async _fxGeneric(date, currency){
    const ccy = String(currency||'BRL').toUpperCase(); if (ccy==='BRL') return 1;
    if (!this.fxAvailable){ return 1; }
    let rate = await this.kernel.requestCapability('dj.fx.rates@1','getRate',{date, currency: ccy, source:'MANUAL'});
    if (typeof rate === 'number' && rate>0) return rate;
    rate = await this.kernel.requestCapability('dj.fx.rates@1','getRate',{date, currency: ccy, source:'PTAX'});
    if (typeof rate === 'number' && rate>0) return rate; return 1;
  }

  // ---------- Sheet helpers ----------
  _findHeader(sh,name){ for (let i=0;i<sh.columns.length;i++){ if ((sh.getCellValue(0,i)||'').toString().toLowerCase()===name.toLowerCase()) return i; } return -1; }
  _setCell(sh,row,col,val,fmt){ sh.setCell(row,col,val); if (!fmt) return; if (fmt.startsWith('CURFX:')){ const ccy = fmt.split(':')[1] || 'USD'; const cell = sh.getCell(row,col); cell.format = { type:'currency', currency: ccy, decimals: 2 }; return; } const F = LoanPluginV971.FMT; if (F[fmt]){ const cell = sh.getCell(row,col); if (F[fmt].format) cell.format = {...F[fmt].format}; if (F[fmt].style)  cell.style  = {...cell.style, ...F[fmt].style}; } }


  // ========== Wizard único de Accruals ==========
  _wizardAccrualUnified(){
    var wb = this.kernel.workbookManager.getActiveWorkbook();
    var cs = null;
    for (var i=0;i<wb.sheets.length;i++){ if (wb.sheets[i].name===LoanPluginV971.S.CONTRACTS){ cs=wb.sheets[i]; break; } }
    if (!cs || cs.rows<=1){ this.ui.showToast('Nenhum contrato.','warning'); return; }
    var ids=[]; for (var r=1;r<cs.rows;r++){ ids.push(String(cs.getCellValue(r,0)||'')); }

    var m = this.ui.createModal('📊 Gerar agenda de Accruals');
    m.body.innerHTML =
      '<div style="display:grid;gap:12px">'
      + '<div class="grp"><label>Contrato</label><select id="cid" class="formula-input">'
      + ids.map(function(x){return '<option>'+x+'</option>';}).join('')
      + '</select></div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'
      + '  <div class="grp"><label>Início</label><input id="d0" type="date" class="formula-input" value="'+(new Date().toISOString().slice(0,10))+'"/></div>'
      + '  <div class="grp"><label>Fim</label><input id="d1" type="date" class="formula-input" value="'+(new Date().toISOString().slice(0,10))+'"/></div>'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">'
      + '  <div class="grp"><label>Frequência</label><select id="fq" class="formula-input"><option>Diário</option><option>Mensal</option><option>Anual</option></select></div>'
      + '  <div class="grp"><label>Fonte da Taxa</label><select id="rm" class="formula-input"><option value="BASE">Taxa BASE (periodic)</option><option value="DAILY">Taxa Diária</option></select></div>'
      + '  <div class="grp"><label>Conversão PTAX</label><select id="fxc" class="formula-input"><option value="DAILY">Diária</option><option value="MONTHLY">Mensal (EOM)</option><option value="ANNUAL">Anual (EOY)</option></select></div>'
      + '</div>'
      + '<fieldset style="border:1px solid var(--border);padding:10px;border-radius:6px">'
      + '  <legend>Relatórios a gerar</legend>'
      + '  <label style="display:flex;gap:8px;align-items:center"><input id="out_base" type="checkbox" checked/> <span>Agenda de Acúmulo (padrão)</span></label>'
      + '  <label style="display:flex;gap:8px;align-items:center"><input id="out_recalc" type="checkbox"/> <span>Agenda Recalculada + Pagamentos</span></label>'
      + '  <label style="display:flex;gap:8px;align-items:center"><input id="out_hist" type="checkbox" checked/> <span>Histórico Completo</span></label>'
      + '  <label style="display:flex;gap:8px;align-items:center;margin-top:6px"><input id="auto_annot" type="checkbox" checked/> <span>Destacar pagamentos automaticamente</span></label>'
      + '</fieldset>'
      + '</div>';

    var f=document.createElement('div');
    f.style.cssText='display:flex;justify-content:flex-end;gap:12px;padding:16px;border-top:1px solid var(--border)';
    f.innerHTML = '<button class="toolbar-btn btn-cancel">Cancelar</button><button class="toolbar-btn btn-ok" style="background:var(--primary);color:white">Gerar</button>';
    m.container.appendChild(f); document.body.appendChild(m.overlay);

    var self=this;
    f.querySelector('.btn-cancel').addEventListener('click', function(){ m.overlay.remove(); });
    f.querySelector('.btn-ok').addEventListener('click', function(){
      var id = String(m.body.querySelector('#cid').value);
      var d0 = String(m.body.querySelector('#d0').value);
      var d1 = String(m.body.querySelector('#d1').value);
      var fq = String(m.body.querySelector('#fq').value);
      var rm = String(m.body.querySelector('#rm').value);
      var fx = String(m.body.querySelector('#fxc').value);
      var out = {
        base:  !!m.body.querySelector('#out_base').checked,
        recalc:!!m.body.querySelector('#out_recalc').checked,
        hist:  !!m.body.querySelector('#out_hist').checked,
        autoAnnot: !!m.body.querySelector('#auto_annot').checked
      };
      self._generateAccrualsUnified(id, d0, d1, fq, rm, fx, out).then(function(){ m.overlay.remove(); });
    });
  }

  async _generateAccrualsUnified(contractId, start, end, freq, rateMode, fxConv, out){
    try{
      if (out.base){
        if (typeof this.createAccrualSheet === 'function'){
          await this.createAccrualSheet(contractId, start, end, freq, rateMode, fxConv);
        } else if (typeof this.createAccrual === 'function'){
          await this.createAccrual(contractId, start, end, freq, rateMode, fxConv);
        } else {
          await this._createAccrualBaseFallback(contractId, start, end, freq, rateMode, fxConv);
        }
      }
      if (out.recalc){
        if (typeof this.createAccrualSheetRecalc === 'function'){
          await this.createAccrualSheetRecalc(contractId, start, end, freq, rateMode, fxConv);
        } else {
          await this._createAccrualSheetRecalc_impl_fallback(contractId, start, end, freq, rateMode, fxConv);
        }
      }
      if (out.hist){
        await this._createAccrualHistoricoCompleto_fallback(contractId, start, end, freq, rateMode, fxConv, 'MONTHLY');
      }
      if (out.autoAnnot){ await this._annotateAllForContract(contractId); }
      this.ui.showToast('Relatórios gerados.', 'success');
    }catch(e){ this.error('unified', e); this.ui.showToast('Erro ao gerar relatórios', 'error'); }
  }

  // ========== Exportação ==========
  _wizardExport(){
    var wb = this.kernel.workbookManager.getActiveWorkbook();
    var cs=null; for (var i=0;i<wb.sheets.length;i++){ if (wb.sheets[i].name===LoanPluginV971.S.CONTRACTS){ cs=wb.sheets[i]; break; } }
    if (!cs || cs.rows<=1){ this.ui.showToast('Nenhum contrato.','warning'); return; }
    var ids=[]; for (var r=1;r<cs.rows;r++){ ids.push(String(cs.getCellValue(r,0)||'')); }
    var m = this.ui.createModal('📤 Exportar planilha(s)');
    m.body.innerHTML =
      '<div style="display:grid;gap:12px">'
      + '<div class="grp"><label>Contrato</label><select id="cid" class="formula-input">'
      + ids.map(function(x){return '<option>'+x+'</option>';}).join('')
      + '</select></div>'
      + '<label style="display:flex;gap:8px;align-items:center"><input id="scope_active" name="scope" type="radio" checked/> <span>Planilha ativa (XLSX)</span></label>'
      + '<label style="display:flex;gap:8px;align-items:center"><input id="scope_all" name="scope" type="radio"/> <span>Todas do contrato (CSV por planilha)</span></label>'
      + '</div>';
    var f=document.createElement('div');
    f.style.cssText='display:flex;justify-content:flex-end;gap:12px;padding:16px;border-top:1px solid var(--border)';
    f.innerHTML = '<button class="toolbar-btn btn-cancel">Cancelar</button><button class="toolbar-btn btn-ok" style="background:var(--primary);color:white">Exportar</button>';
    m.container.appendChild(f); document.body.appendChild(m.overlay);
    var self=this;
    f.querySelector('.btn-cancel').addEventListener('click', function(){ m.overlay.remove(); });
    f.querySelector('.btn-ok').addEventListener('click', function(){
      var id = String(m.body.querySelector('#cid').value);
      var scopeAll = !!m.body.querySelector('#scope_all').checked;
      if (!scopeAll){ if (typeof self.exportActiveSheetXLSX === 'function') self.exportActiveSheetXLSX(); }
      else { self._exportAllSheetsCSVForContract(id); }
      m.overlay.remove();
    });
  }

  _exportAllSheetsCSVForContract(contractId){
    var wb = this.kernel.workbookManager.getActiveWorkbook();
    var sheets = wb.sheets.filter(function(s){
      var n = String(s.name||'');
      return n.indexOf('_'+contractId+'_')>=0 || n.lastIndexOf(contractId)===n.length-contractId.length || n.indexOf('_'+contractId)>=0;
    });
    for (var i=0;i<sheets.length;i++){
      var sh = sheets[i];
      var csv = this._toCSV(sh);
      var blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = (sh.name+'.csv'); a.click();
      (function(url){ setTimeout(function(){ URL.revokeObjectURL(url); }, 1000); })(a.href);
    }
  }

  _toCSV(sh){
    var rows = sh.rows||0; var cols = (sh.columns?sh.columns.length:0);
    function esc(v){
      if (v==null) return '';
      var s = String(v).replace(/\r?\n/g, ' ');
      return /[;" ,]/.test(s) ? ('"'+s.replace(/"/g,'""')+'"') : s;
    }
    var out=[], r, c;
    var head=[]; for (c=0;c<cols;c++){ head.push( esc(sh.columns[c] && sh.columns[c].name ? sh.columns[c].name : '') ); }
    out.push(head.join(';'));
    for (r=1;r<rows;r++){
      var row=[]; for (c=0;c<cols;c++){ row.push( esc(sh.getCellValue(r,c)) ); }
      out.push(row.join(';'));
    }
    return out.join('\n');
  }

  // ========== Watcher: pagamentos dinâmicos + sync de juros no Ledger ==========
  _autoAnnotateInit(){
    if (this.__annotInterval) return;
    var self=this;
    var wb = this.kernel.workbookManager.getActiveWorkbook();
    function hash(){
      var out=[], cs=null;
      for (var i=0;i<wb.sheets.length;i++){ if (wb.sheets[i].name===LoanPluginV971.S.CONTRACTS){ cs=wb.sheets[i]; break; } }
      if (!cs || cs.rows<=1) return '';
      for (var r=1;r<cs.rows;r++){
        var id = String(cs.getCellValue(r,0)||''); if (!id) continue;
        var lsh=null;
        for (var j=0;j<wb.sheets.length;j++){ if (wb.sheets[j].name===LoanPluginV971.S.LEDGER+id){ lsh=wb.sheets[j]; break; } }
        if (!lsh) continue;
        out.push(id, lsh.rows, (lsh.columns?lsh.columns.length:0));
        if (lsh.rows>1){ out.push(String(lsh.getCellValue(lsh.rows-1,0)||'')); }
      }
      return out.join('|');
    }
    var last = hash();
    this.__annotInterval = setInterval(function(){
      var cur = hash();
      if (cur!==last){ last = cur;
        try{
          var cs=null;
          for (var i=0;i<wb.sheets.length;i++){ if (wb.sheets[i].name===LoanPluginV971.S.CONTRACTS){ cs=wb.sheets[i]; break; } }
          if (!cs || cs.rows<=1) return;
          for (var r=1;r<cs.rows;r++){
            var id = String(cs.getCellValue(r,0)||''); if (!id) continue;
            self._annotateAllForContract(id);
            self._syncLedgerInterestsForContract(id);
          }
        }catch(e){ self.warn('autoAnnot', e); }
      }
    }, 1500);
  }

  async _annotateAllForContract(contractId){
    var wb = this.kernel.workbookManager.getActiveWorkbook();
    var cs=null; for (var i=0;i<wb.sheets.length;i++){ if (wb.sheets[i].name===LoanPluginV971.S.CONTRACTS){ cs=wb.sheets[i]; break; } }
    if (!cs || cs.rows<=1) return;
    var ccy='USD';
    for (var r=1;r<cs.rows;r++){ if (String(cs.getCellValue(r,0)||'')===contractId){ ccy=String(cs.getCellValue(r,4)||'USD'); break; } }
    var isFX = String(ccy||'BRL').toUpperCase()!=='BRL';
    var lsh=null; for (var j=0;j<wb.sheets.length;j++){ if (wb.sheets[j].name===LoanPluginV971.S.LEDGER+contractId){ lsh=wb.sheets[j]; break; } }
    if (!lsh) return;
    var LH = this._buildHeaderMap(lsh);
    for (var i=1;i<lsh.rows;i++){
      var d = this._ISO(lsh.getCellValue(i, LH['data'] || 0)); if (!d) continue;
      var payI_BRL = this._num(lsh.getCellValue(i, LH['juros pagos brl'] || -1));
      var payP_BRL = this._num(lsh.getCellValue(i, LH['amortização brl'] || -1));
      var payI_FX  = isFX ? this._num(lsh.getCellValue(i, LH['juros pagos '+(ccy||'usd').toLowerCase()] || -1)) : 0;
      var payP_FX  = isFX ? this._num(lsh.getCellValue(i, LH['amortização '+(ccy||'usd').toLowerCase()] || -1)) : 0;
      this._annotateAccruals(contractId, d, { isFX:isFX, ccy:ccy, payI_BRL:payI_BRL, payP_BRL:payP_BRL, payI_FX:payI_FX, payP_FX:payP_FX });
    }
    if (this.kernel.ui && this.kernel.ui.recalculateAll) this.kernel.ui.recalculateAll(true);
    if (this.kernel.ui && this.kernel.ui.renderGrid) this.kernel.ui.renderGrid();
  }

  _annotateAccruals(contractId, payDateISO, cfg){
    try{
      var isFX = !!cfg.isFX, ccy = cfg.ccy||'USD';
      var payI_BRL = this._num(cfg.payI_BRL), payP_BRL = this._num(cfg.payP_BRL);
      var payI_FX  = this._num(cfg.payI_FX||0), payP_FX = this._num(cfg.payP_FX||0);
      var wb = this.kernel.workbookManager.getActiveWorkbook();
      var sheets = wb.sheets.filter(function(s){
        var n = String(s.name||'');
        return n.indexOf('_Loan_Accrual_')>=0 || n.indexOf('_Loan_Accrual_Report_')>=0;
      });
      for (var i=0;i<sheets.length;i++){
        var sh = sheets[i];
        var idxDate = -1;
        if (typeof this._findHeader === 'function') idxDate = this._findHeader(sh,'DATE');
        if (idxDate<0) continue;
        var colPaidI_BRL = this._ensureHeader(sh, isFX ? 'PAGO – Juros BRL' : 'PAGO – Juros');
        var colPaidP_BRL = this._ensureHeader(sh, isFX ? 'PAGO – Principal BRL' : 'PAGO – Principal');
        var colPaidI_FX=-1, colPaidP_FX=-1;
        if (isFX){
          colPaidI_FX = this._ensureHeader(sh, 'PAGO – Juros '+ccy);
          colPaidP_FX = this._ensureHeader(sh, 'PAGO – Principal '+ccy);
        }
        for (var r=1;r<sh.rows;r++){
          var d = this._ISO(sh.getCellValue(r, idxDate));
          if (d===payDateISO){
            this._colorRow(sh, r, '#fff7cc');
            this._setCell(sh,r,colPaidI_BRL, payI_BRL, 'CUR');
            this._setCell(sh,r,colPaidP_BRL, payP_BRL, 'CUR');
            if (isFX){
              this._setCell(sh,r,colPaidI_FX, payI_FX, 'CURFX:'+ccy);
              this._setCell(sh,r,colPaidP_FX, payP_FX, 'CURFX:'+ccy);
            }
          }
        }
      }
    }catch(e){ this.warn('annotate', e); }
  }

  async _syncLedgerInterestsForContract(contractId){
    try{
      var wb = this.kernel.workbookManager.getActiveWorkbook();
      var cs=null; for (var i=0;i<wb.sheets.length;i++){ if (wb.sheets[i].name===LoanPluginV971.S.CONTRACTS){ cs=wb.sheets[i]; break; } }
      if (!cs || cs.rows<=1) return;
      var c = this._getContract(contractId); if (!c) return;

      var ccy = c.moeda||c.currency||'USD';
      var isFX = String(ccy||'BRL').toUpperCase()!=='BRL';
      var lsh=null; for (var j=0;j<wb.sheets.length;j++){ if (wb.sheets[j].name===LoanPluginV971.S.LEDGER+contractId){ lsh=wb.sheets[j]; break; } }
      if (!lsh) return;

      var LH = this._buildHeaderMap(lsh);
      var colI_BRL = this._ensureHeader(lsh, 'juros período brl');
      var colI_FX  = isFX ? this._ensureHeader(lsh, 'juros período '+ccy) : -1;

      var rows=[]; // ordenado por data
      for (var r=1;r<lsh.rows;r++){ var d = this._ISO(lsh.getCellValue(r, LH['data'] || 0)); if (d) rows.push({r:r,d:d}); }
      rows.sort(function(a,b){ return a.d<b.d?-1:a.d>b.d?1:0; });

      var start = String(c.startDate||c.inicio||c['Data Início']||(rows[0]?rows[0].d:(new Date().toISOString().slice(0,10))));
      var prev = start;
      var balFX = isFX ? (c.principalorigem || c.principalOrigin || 0) : (c.principalbrl||0);

      for (var k=0;k<rows.length;k++){
        var it = rows[k];
        for (var day = U.addDays(U.toD(prev), 1); day <= U.toD(it.d); day = U.addDays(day, 1)){
          var day0 = U.fmtD(U.addDays(day, -1)), day1 = U.fmtD(day);
          var rEff = 0;
          if (typeof this._legsEffTotalSync === 'function') rEff = this._legsEffTotalSync(c, day0, day1, 'BASE');
          else if (typeof this._legsEffTotal === 'function') rEff = await this._legsEffTotal(c, day0, day1, 'BASE');

          var I_FX  = isFX ? U.round(balFX * rEff, 8, 'HALF_UP') : 0;
          var ptax  = await this._ptaxBCBByMode(day1, ccy, 'DAILY');
          var I_BRL = isFX ? U.round(I_FX * ptax, 2, c.rounding||'HALF_UP') : U.round(balFX * rEff, 2, c.rounding||'HALF_UP');

          if (day1 === it.d){
            this._setCell(lsh, it.r, colI_BRL, I_BRL, 'CUR');
            if (isFX && colI_FX>=0) this._setCell(lsh, it.r, colI_FX, I_FX, 'CURFX:'+ccy);
          }

          // capitaliza
          if (isFX) balFX = U.round(balFX + I_FX, 8, 'HALF_UP');
          else      balFX = U.round(balFX + I_BRL, 2, c.rounding||'HALF_UP');

          // amortiza no próprio dia (depois dos juros do dia)
          if (day1 === it.d){
            var pfx  = isFX ? (this._num(lsh.getCellValue(it.r, LH['amortização '+(ccy||'usd').toLowerCase()] || -1)) || 0) : 0;
            var pbrl = this._num(lsh.getCellValue(it.r, LH['amortização brl'] || -1)) || 0;
            if (isFX && pfx) balFX = U.round(Math.max(0, balFX - pfx), 8, 'HALF_UP');
            if (!isFX && pbrl) balFX = U.round(Math.max(0, balFX - pbrl), 2, c.rounding||'HALF_UP');
          }
        }
        prev = it.d;
      }
    }catch(e){ this.warn('sync-ledger-interest', e); }
  }

  // ========== Fallbacks robustos ==========
  async _createAccrualBaseFallback(contractId, start, end, freq, rateMode, fxConv){
    var c = this._getContract(contractId);
    var wb = this.kernel.workbookManager.getActiveWorkbook();
    var isFX = String(c.moeda||c.currency||c.moedaorigem||'BRL').toUpperCase()!=='BRL';
    var ccy = c.moeda||c.currency||'USD';
    var name = '_Loan_Accrual_'+contractId+'_'+start+'_'+end+'_'+freq;
    var sh = wb.sheets.find(function(s){return s.name===name;}) || wb.addSheet(name);
    sh.columns=[]; sh.rows=0;
    var H = isFX
      ? ['DATE','INTEREST RATE','PTAX (BCB)','OPENING '+ccy,'INTEREST '+ccy,'MONTANTE '+ccy,'INTEREST BRL','MONTANTE BRL','ACCRUED BRL','EVENT']
      : ['DATE','INTEREST RATE','OPENING BRL','INTEREST BRL','MONTANTE BRL','ACCRUED BRL','EVENT'];
    for (var i=0;i<H.length;i++) this._setCell(sh,0,i,H[i],'HEADER');

    var startD = U.toD(start), endD = U.toD(end);
    var pts=[];
    if (freq==='Diário'){ for(var d=U.addDays(startD,1); d<=endD; d=U.addDays(d,1)) pts.push(U.fmtD(d)); }
    else if (freq==='Anual'){ for (var dA=U.addYear(startD,1); dA<=endD; dA=U.addYear(dA,1)) pts.push(U.fmtD(dA)); }
    else { for (var dM=U.addMonth(startD,1); dM<=endD; dM=U.addMonth(dM,1)) pts.push(U.fmtD(dM)); }

    var balFX = isFX ? (c.principalorigem || c.principalOrigin || 0) : (c.principalbrl||0);
    var r=1, accBRL=0, prev=start;
    for (var idx=0; idx<pts.length; idx++){
      var dt = pts[idx];
      var rEff = await this._legsEffTotal(c, prev, dt, rateMode||'BASE');
      var ptax = await this._ptaxBCBByMode(dt, ccy, fxConv||'DAILY');
      var openingBRL = isFX ? U.round(balFX*ptax, 2, c.rounding||'HALF_UP') : balFX;
      var I_FX  = isFX ? U.round(balFX*rEff, 8, 'HALF_UP') : 0;
      var I_BRL = isFX ? U.round(I_FX*ptax, 2, c.rounding||'HALF_UP') : U.round(openingBRL*rEff, 2, c.rounding||'HALF_UP');
      var amtFX = isFX ? U.round(balFX + I_FX, 8, 'HALF_UP') : 0;
      var amtBRL= isFX ? U.round(amtFX * ptax, 2, c.rounding||'HALF_UP') : U.round(openingBRL + I_BRL, 2, c.rounding||'HALF_UP');
      accBRL = U.round(accBRL + I_BRL, 2, c.rounding||'HALF_UP');

      var cidx=0;
      this._setCell(sh, r, cidx++, dt, 'DATE');
      this._setCell(sh, r, cidx++, rEff, 'PCT4');
      if (isFX){
        this._setCell(sh, r, cidx++, ptax, 'FX');
        this._setCell(sh, r, cidx++, balFX, 'CURFX:'+ccy);
        this._setCell(sh, r, cidx++, I_FX, 'CURFX:'+ccy);
        this._setCell(sh, r, cidx++, amtFX, 'CURFX:'+ccy);
        this._setCell(sh, r, cidx++, I_BRL, 'CUR');
        this._setCell(sh, r, cidx++, amtBRL, 'CUR');
        this._setCell(sh, r, cidx++, accBRL, 'CUR');
      } else {
        this._setCell(sh, r, cidx++, openingBRL, 'CUR');
        this._setCell(sh, r, cidx++, I_BRL, 'CUR');
        this._setCell(sh, r, cidx++, amtBRL, 'CUR');
        this._setCell(sh, r, cidx++, accBRL, 'CUR');
      }
      this._setCell(sh, r, cidx++, '', '');
      balFX = isFX ? amtFX : amtBRL; prev = dt; r++;
    }
    sh.rows = r;
  }

  async _createAccrualSheetRecalc_impl_fallback(contractId, start, end, freq, rateMode, fxConv){
    var c = this._getContract(contractId);
    if (!c){ this.ui.showToast('Contrato não encontrado.','error'); return false; }
    var wb = this.kernel.workbookManager.getActiveWorkbook();
    var isFX = String(c.moeda||c.currency||c.moedaorigem||'BRL').toUpperCase()!=='BRL';
    var ccy = c.moeda||c.currency||'USD';
    var name = '_Loan_Accrual_Recalc_'+contractId+'_'+start+'_'+end+'_'+freq+'_'+rateMode+'_'+fxConv;
    var sh = wb.sheets.find(function(s){return s.name===name;}) || wb.addSheet(name);
    sh.columns=[]; sh.rows=0;
    var H = isFX
      ? ['DATE','INTEREST RATE','PTAX (BCB)','PRIOR BALANCE FX','INTEREST FX','PAGO – Juros BRL','PAGO – Principal BRL','PAGO – Juros '+ccy,'PAGO – Principal '+ccy,'MONTANTE FX','MONTANTE BRL','JUROS ACUM. FX','JUROS ACUM. BRL','EVENT']
      : ['DATE','INTEREST RATE','PRIOR BALANCE','INTEREST','PAGO – Juros','PAGO – Principal','MONTANTE','JUROS ACUM.','EVENT'];
    for (var i=0;i<H.length;i++) this._setCell(sh,0,i,H[i],'HEADER');

    var ledgerName = LoanPluginV971.S.LEDGER+contractId;
    var lsh = wb.sheets.find(function(s){return s.name===ledgerName;});
    var paysByDate = {};
    var startD = U.toD(start), endD = U.toD(end);
    if (lsh && lsh.rows>1){
      var LH = this._buildHeaderMap(lsh);
      for (var r=1;r<lsh.rows;r++){
        var d = this._ISO(lsh.getCellValue(r, LH['data'] || 0)); if (!d) continue;
        if (U.toD(d)<startD || U.toD(d)>endD) continue;
        paysByDate[d] = {
          pI_brl: this._num(lsh.getCellValue(r, LH['juros pagos brl'] || -1)),
          pP_brl: this._num(lsh.getCellValue(r, LH['amortização brl'] || -1)),
          pI_fx : this._num(lsh.getCellValue(r, LH['juros pagos '+(c.currency||'usd').toLowerCase()] || -1)),
          pP_fx : this._num(lsh.getCellValue(r, LH['amortização '+(c.currency||'usd').toLowerCase()] || -1))
        };
      }
    }

    var periodEnds=[];
    if (freq==='Diário'){ for (var d=U.addDays(startD,1); d<=endD; d=U.addDays(d,1)) periodEnds.push(U.fmtD(d)); }
    else if (freq==='Anual'){ for (var dA=U.addYear(startD,1); dA<=endD; dA=U.addYear(dA,1)) periodEnds.push(U.fmtD(dA)); }
    else { for (var dM=U.addMonth(startD,1); dM<=endD; dM=U.addMonth(dM,1)) periodEnds.push(U.fmtD(dM)); }

    var balFX = isFX ? (c.principalorigem || c.principalOrigin || 0) : (c.principalbrl||0);
    if (isFX && lsh && lsh.rows>1){
      var LH2 = this._buildHeaderMap(lsh);
      for (var r2=1;r2<lsh.rows;r2++){
        var d2 = this._ISO(lsh.getCellValue(r2, LH2['data'] || 0));
        if (!d2 || U.toD(d2) < startD) {
          var pfx = this._num(lsh.getCellValue(r2, LH2['amortização '+(ccy||'USD').toLowerCase()] || -1));
          if (pfx) balFX = U.round(balFX - pfx, 8, 'HALF_UP');
        }
      }
    }

    var r=1, accFX=0, accBRL=0, prev=start;
    for (var idx2=0; idx2<periodEnds.length; idx2++){
      var dt = periodEnds[idx2];
      var rEff = await this._legsEffTotal(c, prev, dt, rateMode||'BASE');
      var ptax = await this._ptaxBCBByMode(dt, ccy, fxConv||'DAILY');
      var openingBRL = isFX ? U.round(balFX * ptax, 2, c.rounding||'HALF_UP') : balFX;
      var I_FX  = isFX ? U.round(balFX * rEff, 8, 'HALF_UP') : 0;
      var I_BRL = isFX ? U.round(I_FX * ptax, 2, c.rounding||'HALF_UP') : U.round(openingBRL * rEff, 2, c.rounding||'HALF_UP');
      var amtFX   = isFX ? U.round(balFX + I_FX, 8, 'HALF_UP') : 0;
      var amtBRL  = isFX ? U.round(amtFX * ptax, 2, c.rounding||'HALF_UP') : U.round(openingBRL + I_BRL, 2, c.rounding||'HALF_UP');

      accFX  = isFX ? U.round(accFX + I_FX, 8, 'HALF_UP') : accFX;
      accBRL = U.round(accBRL + I_BRL, 2, c.rounding||'HALF_UP');

      var pI_brl=0, pP_brl=0, pI_fx=0, pP_fx=0, event='';
      var pay = paysByDate[dt];
      if (pay){
        pI_brl = this._num(pay.pI_brl); pP_brl=this._num(pay.pP_brl);
        pI_fx  = isFX ? this._num(pay.pI_fx) : 0;
        pP_fx  = isFX ? this._num(pay.pP_fx) : 0;
        if (isFX && pI_fx===0 && pI_brl) pI_fx = U.safeDiv(pI_brl, (ptax||1));
        if (isFX && pP_fx===0 && pP_brl) pP_fx = U.safeDiv(pP_brl, (ptax||1));
        amtBRL = U.round(Math.max(0, amtBRL - (pI_brl + pP_brl)), 2, c.rounding||'HALF_UP');
        amtFX  = isFX ? U.round(Math.max(0, U.safeDiv(amtBRL, (ptax||1))), 8, 'HALF_UP') : amtBRL;
        event='PAGTO';
      }
      var cidx=0;
      this._setCell(sh, r, cidx++, dt, 'DATE');
      this._setCell(sh, r, cidx++, rEff, 'PCT4');
      if (isFX){
        this._setCell(sh, r, cidx++, ptax, 'FX');
        this._setCell(sh, r, cidx++, balFX, 'CURFX:'+ccy);
        this._setCell(sh, r, cidx++, I_FX, 'CURFX:'+ccy);
        this._setCell(sh, r, cidx++, pI_brl, 'CUR');
        this._setCell(sh, r, cidx++, pP_brl, 'CUR');
        this._setCell(sh, r, cidx++, pI_fx, 'CURFX:'+ccy);
        this._setCell(sh, r, cidx++, pP_fx, 'CURFX:'+ccy);
        this._setCell(sh, r, cidx++, amtFX, 'CURFX:'+ccy);
        this._setCell(sh, r, cidx++, amtBRL, 'CUR');
        this._setCell(sh, r, cidx++, accFX, 'CURFX:'+ccy);
        this._setCell(sh, r, cidx++, accBRL, 'CUR');
        this._setCell(sh, r, cidx++, event, '');
      } else {
        this._setCell(sh, r, cidx++, openingBRL, 'CUR');
        this._setCell(sh, r, cidx++, I_BRL, 'CUR');
        this._setCell(sh, r, cidx++, pI_brl, 'CUR');
        this._setCell(sh, r, cidx++, pP_brl, 'CUR');
        this._setCell(sh, r, cidx++, amtBRL, 'CUR');
        this._setCell(sh, r, cidx++, accBRL, 'CUR');
        this._setCell(sh, r, cidx++, event, '');
      }
      r++; prev=dt; balFX = isFX ? amtFX : amtBRL;
    }
    sh.rows = r; return true;
  }

  async _createAccrualHistoricoCompleto_fallback(contractId, start, end, freq, rateMode, fxConv, groupMode){
    var c = this._getContract(contractId);
    if (!c){ this.ui.showToast('Contrato não encontrado.','error'); return false; }
    var wb = this.kernel.workbookManager.getActiveWorkbook();
    var isFX = String(c.moeda||c.currency||c.moedaorigem||'BRL').toUpperCase()!=='BRL';
    var ccy = c.moeda||c.currency||'USD';
    var name = '_Loan_Accrual_Report_'+contractId+'_'+start+'_'+end;
    var sh = wb.sheets.find(function(s){return s.name===name;}) || wb.addSheet(name);
    sh.columns=[]; sh.rows=0;

    var H = [
      'DATE','INTEREST RATE','BACEN TAX','PRIOR BALANCE',
      'INTEREST USD DAY','INTEREST USD','INTEREST USD acum',
      'INTEREST BRL (BACEN)','INTEREST BRL (BACEN) acum','INTEREST BRL (group) acum',
      'VC','IOF','IR',
      'PAYMENT OF INTERESTS USD','PAYMENT OF PRINCIPAL USD',
      'PAYMENT OF INTERESTS BRL','PAYMENT OF PRINCIPAL BRL','DAYS'
    ];
    for (var i=0;i<H.length;i++) this._setCell(sh,0,i,H[i],'HEADER');

    var iofPct = parseFloat(c['IOF %'] || c['iof %'] || 0) || 0;
    var irPct  = parseFloat(c['IR %']  || c['ir %']  || 0) || 0;
    var irMode = String(c['IR Mode']  || c['ir mode'] || 'NONE').toUpperCase();
    var group  = String(c['Group Mode']|| c['group mode'] || groupMode || 'MONTHLY').toUpperCase();

    var ledgerName = LoanPluginV971.S.LEDGER+contractId;
    var lsh = wb.sheets.find(function(s){return s.name===ledgerName;});
    var paysByDate = {};
    var startD = U.toD(start), endD = U.toD(end);
    if (lsh && lsh.rows>1){
      var LH = this._buildHeaderMap(lsh);
      for (var r=1;r<lsh.rows;r++){
        var d = this._ISO(lsh.getCellValue(r, LH['data'] || 0)); if (!d) continue;
        if (U.toD(d)<startD || U.toD(d)>endD) continue;
        paysByDate[d] = {
          I_brl: this._num(lsh.getCellValue(r, LH['juros pagos brl'] || -1)),
          P_brl: this._num(lsh.getCellValue(r, LH['amortização brl'] || -1)),
          I_fx : this._num(lsh.getCellValue(r, LH['juros pagos '+(ccy||'USD').toLowerCase()] || -1)),
          P_fx : this._num(lsh.getCellValue(r, LH['amortização '+(ccy||'USD').toLowerCase()] || -1))
        };
      }
    }

    var ptaxCtr = 0;
    if (typeof this._getContractPTAXFixed === 'function') ptaxCtr = await this._getContractPTAXFixed(c, start);
    var periodEnds=[];
    if (freq==='Diário'){ for (var d=U.addDays(startD,1); d<=endD; d=U.addDays(d,1)) periodEnds.push(U.fmtD(d)); }
    else if (freq==='Anual'){ for (var dA=U.addYear(startD,1); dA<=endD; dA=U.addYear(dA,1)) periodEnds.push(U.fmtD(dA)); }
    else { for (var dM=U.addMonth(startD,1); dM<=endD; dM=U.addMonth(dM,1)) periodEnds.push(U.fmtD(dM)); }

    var balFX = isFX ? (c.principalorigem || c.principalOrigin || 0) : (c.principalbrl||0);
    if (isFX && lsh && lsh.rows>1){
      var LH2 = this._buildHeaderMap(lsh);
      for (var r2=1;r2<lsh.rows;r2++){
        var d2 = this._ISO(lsh.getCellValue(r2, LH2['data'] || 0)); if (!d2 || U.toD(d2) >= startD) continue;
        var pfx = this._num(lsh.getCellValue(r2, LH2['amortização '+(ccy||'USD').toLowerCase()] || -1));
        if (pfx) balFX = U.round(balFX - pfx, 8, 'HALF_UP');
      }
    }

    var r=1, accFX=0, accBRL=0, groupAcc=0, prev=start, runUSD=0;
    var lastMonth = (new Date(start)).getMonth();
    for (var idx=0; idx<periodEnds.length; idx++){
      var dt = periodEnds[idx];
      var dtDate = new Date(dt); var month = dtDate.getMonth();
      if (group==='MONTHLY' && month!=lastMonth){ groupAcc = 0; lastMonth = month; }

      var rEff = await this._legsEffTotal(c, prev, dt, rateMode||'BASE');
      var ptax  = await this._ptaxBCBByMode(dt, ccy, fxConv||'DAILY');
      var openingBRL = isFX ? U.round(balFX * ptax, 2, c.rounding||'HALF_UP') : balFX;
      var I_FX  = isFX ? U.round(balFX * rEff, 8, 'HALF_UP') : 0;
      var I_BRL = isFX ? U.round(I_FX * ptax, 2, c.rounding||'HALF_UP') : U.round(openingBRL * rEff, 2, c.rounding||'HALF_UP');
      var amtFX   = isFX ? U.round(balFX + I_FX, 8, 'HALF_UP') : 0;
      var amtBRL  = isFX ? U.round(amtFX * ptax, 2, c.rounding||'HALF_UP') : U.round(openingBRL + I_BRL, 2, c.rounding||'HALF_UP');

      runUSD = isFX ? U.round(runUSD + I_FX, 8, 'HALF_UP') : 0;
      var usdAcum = isFX ? amtFX : 0;

      accFX  = isFX ? U.round(accFX + I_FX, 8, 'HALF_UP') : accFX;
      accBRL = U.round(accBRL + I_BRL, 2, c.rounding||'HALF_UP');
      groupAcc = U.round(groupAcc + I_BRL, 2, c.rounding||'HALF_UP');

      var VC = isFX ? U.round(balFX * (ptax - (ptaxCtr||ptax)), 2, c.rounding||'HALF_UP') : 0;
      var IOF = U.round(I_BRL * (iofPct||0), 2, c.rounding||'HALF_UP');
      var IR  = (irMode==='DAILY') ? U.round(I_BRL * (irPct||0), 2, c.rounding||'HALF_UP')
               : (irMode==='MONTHLY' ? 0 : 0);

      var pI_brl=0, pP_brl=0, pI_fx=0, pP_fx=0;
      var pay = paysByDate[dt];
      if (pay){
        pI_brl = this._num(pay.I_brl); pP_brl=this._num(pay.P_brl);
        pI_fx  = isFX ? this._num(pay.I_fx) : 0;
        pP_fx  = isFX ? this._num(pay.P_fx) : 0;
        if (isFX && pI_fx===0 && pI_brl) pI_fx = U.safeDiv(pI_brl, (ptax||1));
        if (isFX && pP_fx===0 && pP_brl) pP_fx = U.safeDiv(pP_brl, (ptax||1));
      }

      var days = U.diffDays(prev, dt);
      var cidx=0;
      this._setCell(sh, r, cidx++, dt, 'DATE');
      this._setCell(sh, r, cidx++, rEff, 'PCT4');
      this._setCell(sh, r, cidx++, ptax, 'FX');
      this._setCell(sh, r, cidx++, isFX?balFX:openingBRL, isFX?('CURFX:'+ccy):'CUR');
      this._setCell(sh, r, cidx++, isFX?I_FX:0, isFX?('CURFX:'+ccy):'CUR');
      this._setCell(sh, r, cidx++, isFX?runUSD:0, isFX?('CURFX:'+ccy):'CUR');
      this._setCell(sh, r, cidx++, isFX?usdAcum:0, isFX?('CURFX:'+ccy):'CUR');
      this._setCell(sh, r, cidx++, I_BRL, 'CUR');
      this._setCell(sh, r, cidx++, accBRL, 'CUR');
      this._setCell(sh, r, cidx++, groupAcc, 'CUR');
      this._setCell(sh, r, cidx++, VC, 'CUR');
      this._setCell(sh, r, cidx++, IOF, 'CUR');
      this._setCell(sh, r, cidx++, IR, 'CUR');
      this._setCell(sh, r, cidx++, isFX?pI_fx:0, isFX?('CURFX:'+ccy):'CUR');
      this._setCell(sh, r, cidx++, isFX?pP_fx:0, isFX?('CURFX:'+ccy):'CUR');
      this._setCell(sh, r, cidx++, pI_brl, 'CUR');
      this._setCell(sh, r, cidx++, pP_brl, 'CUR');
      this._setCell(sh, r, cidx++, days, '');

      balFX = isFX ? amtFX : amtBRL;
      prev = dt; r++;
    }
    sh.rows=r; return true;
  }

}

// ---------- Register Plugin ----------
window.DJDataForge.registerPlugin({
  id: PLUGIN_ID,
  name: `Gestão de Empréstimos (v${VERSION} – Accrual FX+Leg2+PTAX VAR)`,
  version: VERSION,
  description: 'Agenda com PTAX(BCB) para conversão, coluna de variação PTAX (Contrato−BCB Dia/EOM), duas pernas independentes, pagamentos multi‑moeda e export XLSX corrigido.',
  author: 'DJCalc',
  engineSemver: '>=5.0.0',
  async init(context){ const p=new LoanPluginV971(context); await p.init(); this.instance=p; },
  async dispose(){ try{ await this.instance?.dispose(); }catch{} }
});
})();