# Escopo de Conversão: Loan Plugin → DataForge v6 Native (REFINADO)

**Data:** 2025-11-04 (Revisão UX-First)
**Objetivo:** Plugin TypeScript nativo com UX intuitiva para gestão de empréstimos multi-moeda
**Target:** `src/plugins/loan-plugin.ts`

---

## 🎯 Visão Geral

Este plugin permite gestão completa de empréstimos (captados/cedidos) com:
- ✅ Múltiplas moedas com conversão automática (integração FX Plugin)
- ✅ Pagamentos flexíveis ou programados
- ✅ Acúmulo de juros (ACCRUAL) com PTAX (BCB)
- ✅ Templates prontos (simplifica configuração)
- ✅ Dashboards e relatórios automáticos

---

## 1. Tipos de Contrato (Perspectiva do Usuário)

### 1.1 Captado (Empresa PEGA emprestado)
```
Empresa → Recebe dinheiro → Deve pagar principal + juros
Exemplos:
  - Empréstimo bancário
  - Debênture emitida
  - Nota promissória emitida
```

### 1.2 Cedido (Empresa EMPRESTA dinheiro)
```
Empresa → Empresta dinheiro → Vai receber principal + juros
Exemplos:
  - Empréstimo para terceiros
  - Debênture adquirida
  - Nota promissória adquirida
```

### 1.3 Fluxos de Pagamento

| Tipo | Descrição | Quando Usar |
|------|-----------|-------------|
| **SCHEDULED** | Pagamentos fixos (PRICE, SAC) | Financiamentos tradicionais |
| **FLEXIBLE** | Pagamentos quando ocorrer | Contratos com antecipação, renegociação |
| **BULLET** | Tudo no vencimento | Debêntures, NPs de curto prazo |
| **ACCRUAL_ONLY** | Apenas acumula juros | Contratos subordinados, sem fluxo de caixa |

---

## 2. Modelo de Dados Refinado

### 2.1 Interface Simplificada

```typescript
interface LoanContract {
  // ========== IDENTIFICAÇÃO ==========
  id: string                              // Auto: "LOAN-20251104-001"
  contractType: 'CAPTADO' | 'CEDIDO'      // Perspectiva da empresa
  counterparty: string                    // "Banco XYZ", "Cliente ABC"
  status: 'ATIVO' | 'QUITADO' | 'VENCIDO' | 'RENEGOCIADO'

  // ========== PRINCIPAL ==========
  currency: CurrencyCode                  // "USD", "EUR", "BRL", etc
  principalOrigin: number                 // Valor na moeda de origem
  principalBRL: number                    // Valor em BRL (conversão)

  // PTAX de referência (fixo no contrato)
  contractFXRate?: number                 // PTAX do contrato (se informado)
  contractFXDate?: string                 // Data da PTAX do contrato

  // ========== DATAS ==========
  startDate: string                       // YYYY-MM-DD
  maturityDate: string                    // Data de vencimento

  // ========== CONFIGURAÇÃO DE JUROS ==========
  interestConfig: InterestConfig

  // ========== PAGAMENTOS ==========
  paymentFlow: PaymentFlowConfig

  // ========== SALDO ATUAL ==========
  currentBalance: BalanceSnapshot

  // ========== METADATA ==========
  createdAt: string
  updatedAt: string
  notes?: string
}

interface InterestConfig {
  // Taxa base (template simplifica isso)
  template?: 'CDI_PLUS' | 'PTAX_PLUS' | 'FIXED' | 'CUSTOM'

  // Se CUSTOM, permite 1-2 pernas
  legs: InterestLeg[]

  // Convenções
  dayCountBasis: '30/360' | 'ACT/365' | 'ACT/360' | 'BUS/252'
  compounding: 'EXPONENCIAL' | 'LINEAR'
  rounding: 'HALF_UP' | 'HALF_EVEN'
}

interface InterestLeg {
  // Indexador
  indexer: 'FIXED' | 'CDI' | 'PTAX' | 'MANUAL'
  indexerPercent: number                  // 100 = 100% do CDI, 110 = 110% do CDI

  // Spread
  spreadAnnual: number                    // % ao ano (ex: 3.5 = 3.5% a.a.)

  // Base (opcional, herda se vazio)
  dayCountBasis?: string

  // Se PTAX, precisa configurar
  ptaxCurrency?: CurrencyCode             // "USD", "EUR"
  ptaxSource?: 'AUTO' | 'PTAX_BCB' | 'MANUAL'

  // Role (default: RATE)
  role?: 'RATE' | 'ADJUSTMENT'
}

interface PaymentFlowConfig {
  type: 'SCHEDULED' | 'FLEXIBLE' | 'BULLET' | 'ACCRUAL_ONLY'

  // Se SCHEDULED
  scheduled?: {
    system: 'PRICE' | 'SAC'               // Tabela PRICE ou SAC
    periodicity: 'MENSAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL'
    installments: number                  // Número de parcelas
    firstPaymentDate: string              // Data da 1ª parcela
    gracePeriods?: number                 // Períodos de carência
    graceType?: 'INTEREST_ONLY' | 'FULL' // Paga só juros ou nada
  }

  // Se FLEXIBLE ou outros
  flexible?: {
    allowEarlyPayment: boolean            // Permite antecipação
    penaltyRate?: number                  // Taxa de penalidade (%)
  }
}

interface BalanceSnapshot {
  balanceBRL: number                      // Saldo devedor em BRL
  balanceOrigin: number                   // Saldo na moeda origem
  accruedInterestBRL: number              // Juros acumulados (BRL)
  accruedInterestOrigin: number           // Juros acumulados (origem)
  lastUpdateDate: string                  // Última atualização
  nextPaymentDate?: string                // Próximo vencimento
  nextPaymentAmount?: number              // Valor da próxima parcela
}
```

### 2.2 Templates de Taxa (Simplifica UX)

```typescript
const INTEREST_TEMPLATES = {
  CDI_PLUS: {
    name: 'CDI + Spread',
    description: 'Taxa do CDI + spread fixo (ex: 110% CDI + 2.5% a.a.)',
    legs: [
      { indexer: 'CDI', indexerPercent: 100, spreadAnnual: 2.5 }
    ]
  },

  PTAX_PLUS: {
    name: 'Variação PTAX + Spread',
    description: 'Variação cambial + spread (ex: PTAX USD + 3% a.a.)',
    legs: [
      { indexer: 'PTAX', indexerPercent: 100, spreadAnnual: 3.0, ptaxCurrency: 'USD' }
    ]
  },

  FIXED: {
    name: 'Taxa Fixa',
    description: 'Taxa fixa pré-determinada (ex: 8.5% a.a.)',
    legs: [
      { indexer: 'FIXED', indexerPercent: 100, spreadAnnual: 8.5 }
    ]
  },

  CDI_PTAX: {
    name: 'CDI + PTAX (Duas Pernas)',
    description: 'Composto: CDI + Variação PTAX + spreads',
    legs: [
      { indexer: 'CDI', indexerPercent: 100, spreadAnnual: 1.5 },
      { indexer: 'PTAX', indexerPercent: 100, spreadAnnual: 1.0, ptaxCurrency: 'USD' }
    ]
  },

  CUSTOM: {
    name: 'Personalizado',
    description: 'Configure manualmente as pernas de taxa',
    legs: []
  }
};
```

---

## 3. Wizard de Criação de Contrato (UX Intuitiva)

### 3.1 Step 1: Tipo e Contraparte

```
┌─────────────────────────────────────────────────────┐
│  Novo Contrato de Empréstimo                        │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Qual é o tipo de contrato?                         │
│                                                      │
│  ┌────────────────────┐  ┌────────────────────┐    │
│  │  📥 CAPTADO        │  │  📤 CEDIDO         │    │
│  │                    │  │                    │    │
│  │  Empresa recebe    │  │  Empresa empresta  │    │
│  │  dinheiro e deve   │  │  e vai receber     │    │
│  │  pagar             │  │                    │    │
│  └────────────────────┘  └────────────────────┘    │
│                                                      │
│  Contraparte:                                       │
│  ┌──────────────────────────────────────────────┐  │
│  │ Ex: Banco XYZ, Cliente ABC                   │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  Referência/Código Externo (opcional):              │
│  ┌──────────────────────────────────────────────┐  │
│  │ Ex: CCB-2025-001, Contrato #12345            │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│                         [ Próximo → ]               │
└─────────────────────────────────────────────────────┘
```

### 3.2 Step 2: Principal e Moeda

```
┌─────────────────────────────────────────────────────┐
│  Novo Contrato → Principal e Moeda                  │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Moeda de Origem:                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ 💵 USD   │  │ 💶 EUR   │  │ 💷 GBP   │  [+]     │
│  └──────────┘  └──────────┘  └──────────┘          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ 💴 JPY   │  │ 💰 BRL   │  │ Outras.. │          │
│  └──────────┘  └──────────┘  └──────────┘          │
│                                                      │
│  Principal (Moeda Origem):                          │
│  ┌──────────────────────────────────────────────┐  │
│  │ 1,000,000.00                        USD      │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  ┌────────────────────────────────────────────────┐│
│  │ ℹ️ Conversão Automática (FX Plugin)            ││
│  │                                                 ││
│  │ PTAX do Contrato (opcional):                   ││
│  │ ┌──────────────┐  📅 Data: 2025-01-15         ││
│  │ │ 5.1372       │  Fonte: MANUAL                ││
│  │ └──────────────┘                                ││
│  │                                                 ││
│  │ Se vazio, usa PTAX (BCB) da data de início    ││
│  │                                                 ││
│  │ Principal em BRL (calculado):                  ││
│  │ ┌──────────────────────────────────────────┐  ││
│  │ │ R$ 5,137,200.00                          │  ││
│  │ └──────────────────────────────────────────┘  ││
│  └────────────────────────────────────────────────┘│
│                                                      │
│         [ ← Voltar ]          [ Próximo → ]         │
└─────────────────────────────────────────────────────┘
```

### 3.3 Step 3: Datas

```
┌─────────────────────────────────────────────────────┐
│  Novo Contrato → Datas                              │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Data de Início:                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │ 📅 2025-01-15                                │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  Prazo:                                             │
│  ┌───────────┐  ┌──────────────────────────────┐  │
│  │ 360       │  │ ☑️ Dias  ⚪ Meses  ⚪ Anos   │  │
│  └───────────┘  └──────────────────────────────┘  │
│                                                      │
│  Data de Vencimento (calculado):                   │
│  ┌──────────────────────────────────────────────┐  │
│  │ 📅 2026-01-10                                │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│         [ ← Voltar ]          [ Próximo → ]         │
└─────────────────────────────────────────────────────┘
```

### 3.4 Step 4: Taxa de Juros (Template)

```
┌─────────────────────────────────────────────────────┐
│  Novo Contrato → Taxa de Juros                      │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Escolha um template:                               │
│                                                      │
│  ┌────────────────────────────────────────────────┐│
│  │ ☑️ CDI + Spread                                ││
│  │   Taxa do CDI + spread fixo                    ││
│  │   Ex: 100% CDI + 2.5% a.a.                     ││
│  └────────────────────────────────────────────────┘│
│                                                      │
│  ⚪ PTAX + Spread                                   │
│     Variação cambial + spread                       │
│                                                      │
│  ⚪ Taxa Fixa                                        │
│     Taxa pré-determinada                            │
│                                                      │
│  ⚪ CDI + PTAX (Duas Pernas)                         │
│     Composto: CDI + Câmbio                          │
│                                                      │
│  ⚪ Personalizado                                    │
│     Configure manualmente                           │
│                                                      │
│  ┌────────────────────────────────────────────────┐│
│  │ Configuração (CDI + Spread):                   ││
│  │                                                 ││
│  │ % do CDI:  ┌─────┐                             ││
│  │            │ 100 │ %  (100% = CDI integral)    ││
│  │            └─────┘                              ││
│  │                                                 ││
│  │ Spread:    ┌─────┐                             ││
│  │            │ 2.5 │ % ao ano                    ││
│  │            └─────┘                              ││
│  │                                                 ││
│  │ Base:      ┌───────────┐                       ││
│  │            │ 30/360    │ ▼                     ││
│  │            └───────────┘                       ││
│  │                                                 ││
│  │ Capitalização: ☑️ Exponencial  ⚪ Linear       ││
│  └────────────────────────────────────────────────┘│
│                                                      │
│         [ ← Voltar ]          [ Próximo → ]         │
└─────────────────────────────────────────────────────┘
```

### 3.5 Step 5: Fluxo de Pagamento

```
┌─────────────────────────────────────────────────────┐
│  Novo Contrato → Fluxo de Pagamento                 │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Como serão os pagamentos?                          │
│                                                      │
│  ┌────────────────────┐  ┌────────────────────┐    │
│  │ 📅 PROGRAMADO      │  │ 🔄 FLEXÍVEL        │    │
│  │                    │  │                    │    │
│  │ Parcelas fixas     │  │ Registra quando    │    │
│  │ (PRICE, SAC)       │  │ ocorrer            │    │
│  └────────────────────┘  └────────────────────┘    │
│                                                      │
│  ┌────────────────────┐  ┌────────────────────┐    │
│  │ 💰 BULLET          │  │ 📊 SÓ ACCRUAL      │    │
│  │                    │  │                    │    │
│  │ Tudo no            │  │ Apenas acumula     │    │
│  │ vencimento         │  │ juros (sem pgto)   │    │
│  └────────────────────┘  └────────────────────┘    │
│                                                      │
│  ─── Se PROGRAMADO ────────────────────────────────│
│  Sistema:   ☑️ PRICE (parcela fixa)                 │
│             ⚪ SAC (amortização constante)           │
│                                                      │
│  Periodicidade: ┌───────────┐                       │
│                 │ Mensal    │ ▼                     │
│                 └───────────┘                       │
│                                                      │
│  Número de Parcelas:  ┌─────┐                       │
│                       │ 36  │                       │
│                       └─────┘                       │
│                                                      │
│  Data 1ª Parcela: ┌───────────┐                     │
│                   │ 2025-02-15│                     │
│                   └───────────┘                     │
│                                                      │
│  Carência:  ┌─────┐  ⚪ Sem  ☑️ Juros  ⚪ Total    │
│             │ 0   │  períodos                       │
│             └─────┘                                  │
│  ───────────────────────────────────────────────────│
│                                                      │
│         [ ← Voltar ]          [ Próximo → ]         │
└─────────────────────────────────────────────────────┘
```

### 3.6 Step 6: Revisão e Confirmação

```
┌─────────────────────────────────────────────────────┐
│  Novo Contrato → Revisão                            │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Resumo do Contrato:                                │
│                                                      │
│  ┌────────────────────────────────────────────────┐│
│  │ Tipo:         📥 CAPTADO                       ││
│  │ Contraparte:  Banco XYZ                        ││
│  │                                                 ││
│  │ Principal:    USD 1,000,000.00                 ││
│  │               R$ 5,137,200.00 (PTAX: 5.1372)   ││
│  │                                                 ││
│  │ Início:       2025-01-15                       ││
│  │ Vencimento:   2026-01-15 (360 dias)            ││
│  │                                                 ││
│  │ Taxa:         CDI 100% + 2.5% a.a.             ││
│  │               Base: 30/360, Exp                ││
│  │                                                 ││
│  │ Pagamentos:   PROGRAMADO (PRICE)               ││
│  │               36 parcelas mensais              ││
│  │               1ª parcela: 2025-02-15           ││
│  │               Sem carência                     ││
│  │                                                 ││
│  │ Estimativa da Parcela (aprox):                 ││
│  │ R$ 155,342.78 / mês                            ││
│  │ (baseado em CDI atual: 10.75% a.a.)            ││
│  └────────────────────────────────────────────────┘│
│                                                      │
│  Observações (opcional):                            │
│  ┌──────────────────────────────────────────────┐  │
│  │                                               │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│         [ ← Voltar ]        [ ✅ Criar Contrato ]   │
└─────────────────────────────────────────────────────┘
```

---

## 4. Integração com FX-Finance Plugin

### 4.1 Fluxo de Conversão Automática

```typescript
// No Step 2 do wizard (Principal e Moeda)
async updateBRLConversion() {
  const currency = this.selectedCurrency;
  const principalOrigin = this.principalInput.value;
  const contractPTAX = this.contractPTAXInput.value;
  const startDate = this.startDateInput.value;

  // Se BRL, não precisa converter
  if (currency === 'BRL') {
    this.principalBRL = principalOrigin;
    return;
  }

  // 1️⃣ Prioridade: PTAX do Contrato (se informado pelo usuário)
  if (contractPTAX && contractPTAX > 0) {
    this.principalBRL = principalOrigin * contractPTAX;
    this.showHint(`Usando PTAX do Contrato: ${contractPTAX.toFixed(4)}`);
    return;
  }

  // 2️⃣ Busca MANUAL no FX Plugin (para essa data)
  try {
    const fxPlugin = await kernel.getCapability('dj.fx.rates@3');

    const manualRate = await fxPlugin.getRate(startDate, currency, 'MANUAL');
    if (manualRate) {
      this.principalBRL = principalOrigin * manualRate;
      this.showHint(`Taxa MANUAL ${currency}→BRL: ${manualRate.toFixed(4)}`);
      this.suggestContractPTAX(manualRate);  // Sugere usar como PTAX do contrato
      return;
    }

    // 3️⃣ Busca PTAX (BCB) no FX Plugin
    const ptaxRate = await fxPlugin.getRate(startDate, currency, 'PTAX');
    if (ptaxRate) {
      this.principalBRL = principalOrigin * ptaxRate;
      this.showHint(`PTAX (BCB) ${currency}→BRL: ${ptaxRate.toFixed(4)}`);
      this.suggestContractPTAX(ptaxRate);
      return;
    }

    // 4️⃣ Se não achou, pede ao usuário
    this.showWarning(`Nenhuma taxa encontrada para ${currency} em ${startDate}. Informe a PTAX do Contrato.`);

  } catch (error) {
    this.showWarning('FX Plugin indisponível. Informe a PTAX do Contrato manualmente.');
  }
}
```

### 4.2 Sincronização de Dados FX

```typescript
// Botão "Sincronizar PTAX" no menu do Loan Plugin
async syncPTAXFromFXPlugin() {
  try {
    const fxPlugin = await kernel.getCapability('dj.fx.rates@3');

    // Detecta moedas usadas nos contratos
    const usedCurrencies = this.getUsedCurrencies();

    // Pede ao usuário período
    const { startDate, endDate } = await this.askPTAXPeriod();

    // Delega sincronização para o FX Plugin
    await fxPlugin.syncPTAX(startDate, endDate, usedCurrencies);

    this.showToast('Taxas PTAX sincronizadas com sucesso!', 'success');

  } catch (error) {
    this.showToast('Erro ao sincronizar PTAX.', 'error');
  }
}
```

### 4.3 Fórmulas com Integração FX

```typescript
// Fórmula: LOAN.BALANCE(contractId, [date], [currency])
// Retorna saldo devedor na moeda especificada

registry.register('LOAN.BALANCE', async (contractId, date?, currency?) => {
  const contract = this.getContract(contractId);
  if (!contract) return '#N/A';

  const targetDate = date || new Date().toISOString().split('T')[0];
  const targetCurrency = currency || contract.currency;

  // Calcula saldo em BRL
  const balanceBRL = await this.calculateBalance(contract, targetDate);

  // Se pede em BRL, retorna direto
  if (targetCurrency === 'BRL') {
    return balanceBRL;
  }

  // Converte para moeda de origem
  const fxPlugin = await kernel.getCapability('dj.fx.rates@3');
  const rate = await fxPlugin.getRate(targetDate, targetCurrency, 'AUTO');

  if (!rate) return '#N/A';

  return balanceBRL / rate;
}, {
  argCount: [1, 3],
  description: 'Saldo devedor do contrato (em moeda especificada)',
  async: true
});
```

---

## 5. Sheets e Persistência

### 5.1 Sheets Criadas Automaticamente

```
Sheet Name                              | Visibilidade | Propósito
───────────────────────────────────────────────────────────────────
Contratos                               | Visível      | Lista de todos os contratos
Contratos_Detalhes                      | Visível      | Detalhes expandidos
_Loan_Ledger_{contractId}               | Oculta       | Histórico de transações
_Loan_Schedule_{contractId}             | Oculta       | Cronograma de pagamentos (se SCHEDULED)
_Loan_Accrual_{contractId}_{período}    | Oculta       | Cronograma de acúmulo de juros
_Loan_RateCurves                        | Oculta       | Curvas de taxa (CDI, IPCA, etc)
Dashboard_Empréstimos                   | Visível      | Dashboard resumo
```

### 5.2 Sheet "Contratos" (Principal)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ID          │ Tipo    │ Contraparte │ Moeda │ Principal    │ Saldo Devedor │
├─────────────────────────────────────────────────────────────────────────────┤
│ LOAN-001    │ CAPTADO │ Banco XYZ   │ USD   │ 1,000,000.00 │ 856,342.18    │
│ LOAN-002    │ CEDIDO  │ Cliente ABC │ EUR   │ 500,000.00   │ 500,000.00    │
│ LOAN-003    │ CAPTADO │ Fundo DEF   │ BRL   │ 2,500,000.00 │ 1,847,293.45  │
└─────────────────────────────────────────────────────────────────────────────┘

│ Principal BRL│ Taxa            │ Início    │ Vencimento│ Status  │ Ações       │
├─────────────────────────────────────────────────────────────────────────────┤
│ 5,137,200.00 │ CDI+2.5%        │ 2025-01-15│ 2026-01-15│ ✅ ATIVO│ [Ver][Pagar]│
│ 2,935,000.00 │ PTAX EUR+1.5%   │ 2024-06-01│ 2027-06-01│ ✅ ATIVO│ [Ver][Pagar]│
│ 2,500,000.00 │ Fixa 8.5%       │ 2024-11-10│ 2025-11-10│ ✅ ATIVO│ [Ver][Pagar]│
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Sheet "_Loan_Ledger_{contractId}" (Transações)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Data       │ Tipo       │ Valor (Orig) │ Valor BRL   │ FX      │
├──────────────────────────────────────────────────────────────────────┤
│ 2025-01-15 │ CRIAÇÃO    │ 1,000,000.00 │ 5,137,200.00│ 5.1372  │
│ 2025-02-15 │ PAGAMENTO  │ 30,000.00    │ 153,540.00  │ 5.1180  │
│ 2025-03-15 │ PAGAMENTO  │ 30,500.00    │ 156,342.50  │ 5.1260  │
│ 2025-04-15 │ PAGAMENTO  │ 31,000.00    │ 159,580.00  │ 5.1480  │
└──────────────────────────────────────────────────────────────────────┘

│ Juros BRL  │ Amort. BRL │ Saldo BRL    │ Saldo Orig   │ Obs        │
├──────────────────────────────────────────────────────────────────────┤
│ -          │ -          │ 5,137,200.00 │ 1,000,000.00 │ Inicial    │
│ 43,240.00  │ 110,300.00 │ 5,026,900.00 │ 981,764.32   │ Parcela 1  │
│ 42,135.50  │ 114,207.00 │ 4,912,693.00 │ 958,128.67   │ Parcela 2  │
│ 41,204.80  │ 118,375.20 │ 4,794,317.80 │ 931,153.99   │ Parcela 3  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 6. Operações Principais

### 6.1 Registrar Pagamento (Modal Intuitivo)

```
┌─────────────────────────────────────────────────────┐
│  💳 Registrar Pagamento                             │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Contrato:                                          │
│  ┌──────────────────────────────────────────────┐  │
│  │ LOAN-001 | Banco XYZ | USD 1M (📥 CAPTADO) │ ▼│  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  ┌────────────────────────────────────────────────┐│
│  │ ℹ️ Saldo Atual                                 ││
│  │                                                 ││
│  │ Saldo Devedor:      R$ 5,026,900.00           ││
│  │                     USD 981,764.32             ││
│  │                                                 ││
│  │ Juros Acumulados:   R$ 42,135.50 (desde 15/02)││
│  │                                                 ││
│  │ Próxima Parcela:    R$ 156,342.50 (15/03/2025)││
│  └────────────────────────────────────────────────┘│
│                                                      │
│  Data do Pagamento:                                 │
│  ┌──────────────────────────────────────────────┐  │
│  │ 📅 2025-03-15                                │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  Valor do Pagamento:                                │
│  ┌──────────────┐  ┌──────────────────────────┐    │
│  │ 156,342.50   │  │ Moeda: BRL              │ ▼│  │
│  └──────────────┘  └──────────────────────────┘    │
│                                                      │
│  ℹ️ Se pagar em moeda diferente, será convertido   │
│     usando PTAX (BCB) do dia do pagamento           │
│                                                      │
│  Alocação:                                          │
│  ☑️ Automática (primeiro juros, depois principal)   │
│  ⚪ Apenas Juros                                     │
│  ⚪ Apenas Principal                                 │
│  ⚪ Personalizada (informar valores)                 │
│                                                      │
│  ┌────────────────────────────────────────────────┐│
│  │ 🧮 Simulação do Pagamento                      ││
│  │                                                 ││
│  │ Juros Pagos:       R$ 42,135.50                ││
│  │ Amortização:       R$ 114,207.00               ││
│  │                                                 ││
│  │ Novo Saldo BRL:    R$ 4,912,693.00             ││
│  │ Novo Saldo USD:    USD 958,128.67              ││
│  │ (usando PTAX: 5.1260 em 15/03/2025)            ││
│  └────────────────────────────────────────────────┘│
│                                                      │
│         [ Cancelar ]        [ ✅ Confirmar Pagamento]│
└─────────────────────────────────────────────────────┘
```

### 6.2 Gerar Cronograma ACCRUAL (Modal)

```
┌─────────────────────────────────────────────────────┐
│  📈 Gerar Cronograma de Acúmulo (ACCRUAL)           │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Contrato:                                          │
│  ┌──────────────────────────────────────────────┐  │
│  │ LOAN-001 | Banco XYZ | USD 1M              │ ▼│  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  Período:                                           │
│  ┌──────────────┐  até  ┌──────────────┐          │
│  │ 2025-01-01   │       │ 2025-12-31   │          │
│  └──────────────┘       └──────────────┘          │
│                                                      │
│  Frequência de Atualização:                         │
│  ☑️ Diário       ⚪ Mensal      ⚪ Anual             │
│                                                      │
│  Fonte de Taxa:                                     │
│  ☑️ Taxa do Contrato (CDI + Spread)                 │
│  ⚪ Taxas Diárias (se disponível em _Loan_RateDaily)│
│                                                      │
│  Conversão PTAX (para BRL):                         │
│  ☑️ Diária (PTAX de cada dia)                       │
│  ⚪ Mensal (PTAX do fechamento do mês)              │
│  ⚪ Anual (PTAX do fim do ano)                      │
│                                                      │
│  Mostrar Variação PTAX?                             │
│  ⚪ Não mostrar                                      │
│  ☑️ Contrato − PTAX(BCB) Diária                     │
│  ⚪ Contrato − PTAX(BCB) Fechamento do Mês          │
│                                                      │
│  ┌────────────────────────────────────────────────┐│
│  │ ℹ️ Preview                                      ││
│  │                                                 ││
│  │ Será criada uma planilha com:                  ││
│  │ - 365 linhas (um dia por linha)                ││
│  │ - Saldo inicial, juros, saldo final            ││
│  │ - Valores em USD e BRL                         ││
│  │ - Coluna de variação PTAX                      ││
│  │                                                 ││
│  │ Nome da planilha:                              ││
│  │ _Loan_Accrual_LOAN-001_2025-01_2025-12_DAILY  ││
│  └────────────────────────────────────────────────┘│
│                                                      │
│         [ Cancelar ]              [ ✅ Gerar ]       │
└─────────────────────────────────────────────────────┘
```

---

## 7. Fórmulas Disponíveis

### 7.1 Fórmulas de Consulta

```typescript
// Saldo devedor
=LOAN.BALANCE("LOAN-001")                    // Saldo em BRL (hoje)
=LOAN.BALANCE("LOAN-001", "2025-06-15")      // Saldo em BRL na data
=LOAN.BALANCE("LOAN-001", "2025-06-15", "USD") // Saldo em USD

// Juros acumulados
=LOAN.INTEREST("LOAN-001", "2025-01-01", "2025-12-31") // Juros do período (BRL)

// Próximo vencimento
=LOAN.NEXT.PAYMENT("LOAN-001")               // Data da próxima parcela
=LOAN.NEXT.AMOUNT("LOAN-001")                // Valor da próxima parcela

// Status
=LOAN.STATUS("LOAN-001")                     // "ATIVO", "QUITADO", etc
```

### 7.2 Fórmulas de Ação

```typescript
// Gerar cronograma ACCRUAL
=LOAN.ACCRUAL("LOAN-001", "2025-01-01", "2025-12-31", "Diário", "BASE", "DAILY", "PTAX_DAILY")
// Retorna: 1 (sucesso) ou 0 (erro)

// Gerar cronograma de pagamentos (SCHEDULED)
=LOAN.SCHEDULE("LOAN-001")
// Retorna: 1 (sucesso) ou 0 (erro)

// Registrar pagamento (via fórmula)
=LOAN.PAY("LOAN-001", "2025-03-15", 156342.50, "BRL", "AUTO")
// Retorna: 1 (sucesso) ou 0 (erro)
```

### 7.3 Fórmulas Financeiras (herdadas de v8.1)

```typescript
// Calcular parcela (PRICE)
=LOAN.PMT(1000000, 10.5, 36, "PRICE", "Mensal", "30/360")
// Retorna: valor da parcela

// Componente de juros da parcela
=LOAN.IPMT(1000000, 10.5, 12, 36, "Mensal", "30/360")
// Retorna: juros da parcela 12

// Componente de amortização da parcela
=LOAN.PPMT(1000000, 10.5, 12, 36, "Mensal", "30/360")
// Retorna: amortização da parcela 12
```

---

## 8. Arquitetura Técnica

### 8.1 Estrutura de Arquivos

```
src/plugins/
├── loan/
│   ├── loan-plugin.ts                 # Plugin principal (lifecycle)
│   ├── loan-types.ts                  # Interfaces TypeScript
│   ├── loan-wizard.ts                 # Wizard de criação de contrato
│   ├── loan-calculator.ts             # Motor de cálculos puros
│   ├── loan-scheduler.ts              # ACCRUAL e Schedule builders
│   ├── loan-payment.ts                # Registrar pagamentos
│   ├── loan-sheets.ts                 # Gerenciar sheets
│   ├── loan-fx-integration.ts         # Integração com FX Plugin
│   ├── loan-templates.ts              # Templates de taxa
│   └── loan-dashboard.ts              # Dashboard e relatórios
```

### 8.2 Integração com Kernel

```typescript
class LoanPlugin implements Plugin {
  manifest: PluginManifest = {
    id: 'dj.finance.loans',
    name: 'Gestão de Empréstimos',
    version: '2.0.0',
    author: 'DJ DataForge',
    description: 'Gestão completa de empréstimos com multi-moeda e ACCRUAL',
    permissions: [
      'read:workbook',
      'write:workbook',
      'ui:toolbar',
      'ui:menu',
      'formula:register',
      'network:fetch'  // Para sincronizar CDI, se necessário
    ],
    entryPoint: 'loan-plugin.ts'
  };

  private context!: PluginContext;
  private fxPlugin: any;  // Capability do FX Plugin
  private templates: Map<string, InterestTemplate> = new Map();

  async init(context: PluginContext): Promise<void> {
    this.context = context;

    // 1. Detectar e conectar com FX Plugin
    await this.connectFXPlugin();

    // 2. Carregar templates de taxa
    this.loadInterestTemplates();

    // 3. Registrar fórmulas
    this.registerFormulas();

    // 4. Registrar menus
    this.registerMenus();

    // 5. Registrar capability (para outros plugins)
    this.registerCapability();

    // 6. Setup event listeners
    this.setupEventListeners();

    context.ui.showToast('Loan Plugin carregado com sucesso!', 'success');
  }

  private async connectFXPlugin(): Promise<void> {
    try {
      // Tenta versão @3 primeiro (mais nova)
      this.fxPlugin = await this.context.kernel.getCapability('dj.fx.rates@3');
      logger.info('[LoanPlugin] Conectado ao FX Plugin v3');
    } catch {
      try {
        // Fallback para @1
        this.fxPlugin = await this.context.kernel.getCapability('dj.fx.rates@1');
        logger.info('[LoanPlugin] Conectado ao FX Plugin v1');
      } catch {
        logger.warn('[LoanPlugin] FX Plugin não disponível');
        this.fxPlugin = null;
      }
    }
  }

  async dispose(): Promise<void> {
    // Cleanup
  }
}
```

### 8.3 Capability Exposta (para outros plugins)

```typescript
private registerCapability(): void {
  const api = {
    // Criar contrato programaticamente
    createContract: async (data: LoanContractInput) => {
      return await this.createContract(data);
    },

    // Obter saldo
    getBalance: async (contractId: string, date?: string, currency?: string) => {
      return await this.calculateBalance(contractId, date, currency);
    },

    // Registrar pagamento
    registerPayment: async (contractId: string, date: string, amount: number, currency?: string) => {
      return await this.registerPayment(contractId, date, amount, currency);
    },

    // Gerar ACCRUAL
    generateAccrual: async (contractId: string, startDate: string, endDate: string, options?: any) => {
      return await this.generateAccrual(contractId, startDate, endDate, options);
    },

    // Listar contratos
    listContracts: (filters?: any) => {
      return this.listContracts(filters);
    }
  };

  this.context.kernel.registerCapability('dj.finance.loans@1', api);
}
```

---

## 9. Roteiro de Implementação (Revisado)

### **Fase 1: Estrutura Base** (3-5 dias)
- [ ] `loan-types.ts` - Interfaces TypeScript
- [ ] `loan-calculator.ts` - Funções puras (dcf, round, etc)
- [ ] `loan-templates.ts` - Templates de taxa (CDI_PLUS, PTAX_PLUS, etc)
- [ ] Testes unitários da calculadora

### **Fase 2: Integração FX** (2-3 dias)
- [ ] `loan-fx-integration.ts` - Conectar com FX Plugin
- [ ] Lógica de conversão automática BRL
- [ ] Fallback para PTAX manual
- [ ] Testes de integração FX

### **Fase 3: Wizard de Criação** (5-7 dias)
- [ ] `loan-wizard.ts` - Wizard em 6 steps
- [ ] Step 1: Tipo e Contraparte
- [ ] Step 2: Principal e Moeda (com conversão FX)
- [ ] Step 3: Datas
- [ ] Step 4: Taxa (templates)
- [ ] Step 5: Fluxo de Pagamento
- [ ] Step 6: Revisão e Confirmação
- [ ] Testes E2E do wizard

### **Fase 4: Motor ACCRUAL** (5-7 dias)
- [ ] `loan-scheduler.ts` - buildAccrualRows
- [ ] Suporte PTAX variação (DAILY/MONTHLY)
- [ ] Múltiplas moedas
- [ ] Geração de sheet _Loan_Accrual
- [ ] Testes ACCRUAL (BRL e FX)

### **Fase 5: Pagamentos** (4-5 dias)
- [ ] `loan-payment.ts` - Registrar pagamentos
- [ ] Modal de pagamento intuitivo
- [ ] Alocação (AUTO/JUROS/PRINCIPAL/MISTO)
- [ ] Atualização de saldo
- [ ] Ledger (_Loan_Ledger)
- [ ] Testes múltiplos pagamentos

### **Fase 6: Schedule (PRICE/SAC)** (4-5 dias)
- [ ] `loan-scheduler.ts` - buildScheduleRows
- [ ] Sistema PRICE
- [ ] Sistema SAC
- [ ] Sistema BULLET
- [ ] Carência (FULL/INTEREST_ONLY)
- [ ] Testes cada sistema

### **Fase 7: Sheets e Dashboard** (3-4 dias)
- [ ] `loan-sheets.ts` - Gerenciar sheets
- [ ] Sheet "Contratos" (principal)
- [ ] Sheet "Contratos_Detalhes"
- [ ] Dashboard resumo
- [ ] Formatação e UX

### **Fase 8: Fórmulas** (3-4 dias)
- [ ] Registrar todas as fórmulas
- [ ] LOAN.BALANCE, LOAN.INTEREST, etc
- [ ] LOAN.ACCRUAL, LOAN.SCHEDULE, LOAN.PAY
- [ ] LOAN.PMT, LOAN.IPMT, LOAN.PPMT (herdadas)
- [ ] Testes de fórmulas

### **Fase 9: Testes e QA** (5-7 dias)
- [ ] Cobertura unitária 80%+
- [ ] E2E: workflow completo
- [ ] Testes de stress (100+ contratos)
- [ ] Performance (ACCRUAL 1000+ períodos)
- [ ] Compatibilidade dados v9.7.1

### **Fase 10: Documentação** (2-3 dias)
- [ ] README com exemplos
- [ ] JSDOC completo
- [ ] Guia de migração v9.7.1 → v2.0.0
- [ ] Vídeo tutorial (opcional)

**Total Estimado:** 36-50 dias úteis (~7-10 semanas)

---

## 10. Diferenciais desta Versão

### ✅ UX Intuitiva
- Wizard em 6 steps com preview
- Templates de taxa prontos (CDI_PLUS, PTAX_PLUS, etc)
- Conversão automática FX com hints visuais
- Modais com simulação de pagamento

### ✅ Integração FX Perfeita
- Auto-detecção de moeda
- Fallback PTAX manual → PTAX BCB → erro claro
- Sincronização de dados FX compartilhada
- Suporte a 8+ moedas principais

### ✅ Flexibilidade de Pagamento
- SCHEDULED (PRICE, SAC)
- FLEXIBLE (registro quando ocorre)
- BULLET (tudo no final)
- ACCRUAL_ONLY (sem pagamento)

### ✅ Multi-moeda Nativo
- Saldo em moeda origem + BRL
- Conversão em cada transação
- Variação PTAX rastreada
- Export em qualquer moeda

### ✅ TypeScript Strict
- Type safety completo
- Autocomplete IDE
- Refatoração segura
- Menor chance de bugs

### ✅ Testável
- Funções puras (fácil testar)
- Mocks de FX Plugin
- E2E com Playwright
- Cobertura 80%+

---

## 11. Critérios de Sucesso (Revisados)

### Funcional
- [ ] Wizard cria contratos em <30 segundos
- [ ] Conversão FX automática em 100% dos casos (com fallback)
- [ ] Pagamentos registram e atualizam saldo corretamente
- [ ] ACCRUAL gera sheet com dados idênticos a v9.7.1
- [ ] Suporte a 4 tipos de fluxo de pagamento

### Técnico
- [ ] TypeScript strict mode, zero `any` desnecessários
- [ ] Integração FX Plugin funciona com v1 e v3
- [ ] Testes cobrem 80%+ das linhas
- [ ] Performance: ACCRUAL 360 períodos em <200ms
- [ ] Zero console.error em happy path

### UX
- [ ] Templates reduzem configuração de taxa em 70%
- [ ] Hints de FX aparecem em <500ms
- [ ] Modais seguem design system DataForge v6
- [ ] Validação clara em todos os inputs
- [ ] Toasts informativos em todas as ações

### Documentação
- [ ] README com 5+ exemplos práticos
- [ ] JSDOC em 100% das funções públicas
- [ ] Migration guide com script de importação
- [ ] FAQ com 10+ perguntas comuns

---

## 12. Notas Finais

**Este escopo foi refinado com foco em:**
1. **UX-First:** Usuário cria contrato em 6 passos claros
2. **Integração FX Perfeita:** Conversão automática, fallbacks, sync compartilhado
3. **Flexibilidade:** 4 tipos de pagamento, templates de taxa, multi-moeda nativo
4. **Qualidade:** TypeScript strict, testes 80%+, documentação completa

**Próximos Passos:**
1. Validar este escopo refinado com a equipe
2. Iniciar Fase 1 (tipos + calculator)
3. Setup CI/CD para testes automáticos
4. Code review semanal para manter qualidade
