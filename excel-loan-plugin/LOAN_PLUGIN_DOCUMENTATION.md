# Documentação do Loan Plugin - DJ DataForge v6

## Visão Geral

O **Loan Plugin** é um plugin completo de gestão de empréstimos para o DJ DataForge v6. Ele permite criar, gerenciar e analisar contratos de empréstimo com suporte a múltiplas moedas, diferentes estruturas de juros, cronogramas de pagamento e integração com taxas de câmbio (PTAX/BCB).

## Arquitetura

### Componentes Principais

```
┌──────────────────────────────────────────────────────────┐
│                    LoanPlugin (Orquestrador)             │
│  - Inicialização e coordenação de todos os componentes   │
│  - Registro de fórmulas e menus                          │
│  - Gerenciamento de eventos                              │
└──────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼──────┐   ┌───────▼──────┐   ┌───────▼──────────┐
│ LoanCalculator│   │ LoanScheduler│   │LoanPaymentManager│
│ - Cálculos    │   │ - ACCRUAL    │   │ - Pagamentos     │
│   financeiros │   │ - SCHEDULE   │   │ - Amortização    │
│ - Juros       │   │ - Cronogramas│   │ - Ledger         │
│ - PMT/SAC     │   │              │   │                  │
└───────────────┘   └───────────────┘   └──────────────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼────────┐  ┌──────▼────────┐  ┌───────▼──────────┐
│LoanFXIntegration│  │ LoanValidator │  │  LoanWizard      │
│ - Taxa de       │  │ - Validações  │  │  - UI Criação    │
│   câmbio PTAX   │  │ - Regras      │  │  - Wizard        │
│ - Conversão BRL │  │   de negócio  │  │                  │
└─────────────────┘  └───────────────┘  └──────────────────┘
        │
┌───────▼────────────┐
│  LoanIndexerService│
│  - CDI             │
│  - PTAX            │
│  - Indexadores     │
└────────────────────┘
```

### Módulos e Responsabilidades

#### 1. **loan-plugin.ts** (Orquestrador Principal)
- **Responsabilidade**: Coordena todos os componentes do plugin
- **Funcionalidades**:
  - Inicialização e configuração do plugin
  - Registro de fórmulas customizadas (LOAN.*)
  - Registro de menus na UI
  - Gerenciamento de eventos (autosave, criação, pagamentos)
  - Persistência em IndexedDB
  - Exposição de API para outros plugins

#### 2. **loan-types.ts** (Definições de Tipos)
- **Tipos Principais**:
  - `LoanContract`: Estrutura completa de um contrato
  - `InterestConfig`: Configuração de juros (pernas, indexadores)
  - `PaymentFlowConfig`: Fluxo de pagamentos (PRICE, SAC, BULLET)
  - `BalanceSnapshot`: Snapshot do saldo em um momento
  - `InterestLeg`: Perna de juros (CDI, PTAX, FIXED)

#### 3. **loan-calculator.ts** (Cálculos Financeiros)
- **Funções Puras** (sem estado):
  - `round(value, decimals)`: Arredondamento
  - `getDaysBetween(start, end, basis)`: Contagem de dias (30/360, ACT/365, ACT/360, BUS/252)
  - `calculatePeriodicRate(annual, compounding, basis, days)`: Taxa periódica
  - `calculatePMT(principal, rate, n)`: Valor da parcela (PRICE)
  - `calculateIPMT(principal, rate, period, n)`: Juros da parcela
  - `calculatePPMT(principal, rate, period, n)`: Amortização da parcela

#### 4. **loan-scheduler.ts** (Geração de Cronogramas)
- **Cronograma ACCRUAL** (`buildAccrualRows`):
  - Acúmulo de juros período a período
  - Suporte a frequências: Diário, Mensal, Anual
  - Dupla conversão: Taxa do Contrato vs. PTAX do BCB
  - Cálculo de variação cambial
  - Juros acumulados progressivos

- **Cronograma SCHEDULE** (`buildScheduleRows`):
  - Tabela PRICE (parcela fixa)
  - Tabela SAC (amortização constante)
  - Suporte a carência (juros ou total)
  - Periodicidades: Mensal, Trimestral, Semestral, Anual

#### 5. **loan-payment-manager.ts** (Gestão de Pagamentos)
- **Funcionalidades**:
  - Registro de pagamentos em múltiplas moedas
  - Cálculo automático de amortização
  - Atualização de saldos (BRL e moeda origem)
  - Ledger completo de transações
  - Reconstrução de saldo histórico (`getBalanceAtDate`)
  - Alocação de pagamento (juros primeiro, depois principal)

#### 6. **loan-fx-integration.ts** (Integração FX)
- **Funcionalidades**:
  - Conexão com FX Finance Plugin
  - Obtenção de taxas PTAX (BCB)
  - Fallback para taxas manuais
  - Sincronização de PTAX para períodos
  - Estratégia de conversão: Contrato → Manual → PTAX → AUTO

#### 7. **loan-indexer-service.ts** (Serviço de Indexadores)
- **Indexadores Suportados**:
  - **FIXED**: Taxa fixa
  - **CDI**: Taxa CDI
  - **PTAX**: Variação cambial
  - **MANUAL**: Taxa manual
- Cálculo de taxa efetiva por perna
- Composição de múltiplas pernas

#### 8. **loan-validator.ts** (Validação de Dados)
- **Validações**:
  - Validação de entrada de contrato
  - Validação de estado do contrato
  - Validação de pagamentos
  - Regras de negócio (datas, valores, moedas)

#### 9. **loan-wizard.ts** (Wizard de Criação)
- **Interface UI** para criar contratos:
  - Formulário multi-etapas
  - Seleção de templates de juros
  - Configuração de fluxo de pagamento
  - Preview de configurações

#### 10. **loan-templates.ts** (Templates de Juros)
- **Templates Pré-configurados**:
  - `CDI_PLUS`: CDI + Spread
  - `PTAX_PLUS`: PTAX + Spread
  - `FIXED`: Taxa Fixa
  - `CDI_PTAX`: CDI + PTAX (composto)
  - `CUSTOM`: Personalizado

#### 11. **loan-sheets.ts** (Gestão de Planilhas)
- Criação automática de planilhas:
  - Sheet de contratos (lista completa)
  - Sheet de ACCRUAL (cronograma de juros)
  - Sheet de SCHEDULE (cronograma de pagamentos)
  - Sheet de LEDGER (histórico de transações)

#### 12. **loan-dashboard.ts** (Dashboard Visual)
- Dashboard interativo com:
  - Lista de contratos
  - KPIs (saldo total, juros acumulados)
  - Ações rápidas (pagamento, ACCRUAL, relatórios)
  - Filtros e busca

#### 13. **loan-report-manager.ts** (Sistema de Relatórios)
- **Relatórios Avançados**:
  - Análise de Juros
  - Análise de Principal
  - Visão Consolidada
  - Relatórios Personalizados
- Templates customizáveis
- Exportação para sheets

## Estrutura de Dados

### LoanContract (Contrato Completo)

```typescript
interface LoanContract {
  // Identificação
  id: string;                                // "LOAN-20251104-001"
  contractType: 'CAPTADO' | 'CEDIDO';        // Perspectiva
  counterparty: string;                      // "Banco XYZ"
  status: 'ATIVO' | 'QUITADO' | 'VENCIDO';

  // Principal
  currency: CurrencyCode;                    // "USD", "EUR", "BRL"
  principalOrigin: number;                   // Valor na moeda origem
  principalBRL: number;                      // Valor em BRL
  contractFXRate?: number;                   // PTAX fixada no contrato
  contractFXDate?: string;                   // Data da PTAX

  // Datas
  startDate: string;                         // "2025-01-01"
  maturityDate: string;                      // "2026-01-01"

  // Configuração de Juros
  interestConfig: {
    template?: 'CDI_PLUS' | 'PTAX_PLUS' | 'FIXED' | 'CUSTOM';
    legs: InterestLeg[];                     // Array de pernas
    dayCountBasis: '30/360' | 'ACT/365' | 'ACT/360' | 'BUS/252';
    compounding: 'EXPONENCIAL' | 'LINEAR';
    rounding: 'HALF_UP' | 'HALF_EVEN';
  };

  // Fluxo de Pagamentos
  paymentFlow: {
    type: 'SCHEDULED' | 'FLEXIBLE' | 'BULLET' | 'ACCRUAL_ONLY';
    scheduled?: {
      system: 'PRICE' | 'SAC';
      periodicity: 'MENSAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL';
      installments: number;
      firstPaymentDate: string;
      gracePeriods?: number;
      graceType?: 'INTEREST_ONLY' | 'FULL';
    };
  };

  // Saldo Atual
  currentBalance: {
    balanceBRL: number;
    balanceOrigin: number;
    accruedInterestBRL: number;
    accruedInterestOrigin: number;
    lastUpdateDate: string;
    nextPaymentDate?: string;
    nextPaymentAmount?: number;
  };

  // Metadados
  createdAt: string;
  updatedAt: string;
  notes?: string;
}
```

### InterestLeg (Perna de Juros)

```typescript
interface InterestLeg {
  indexer: 'FIXED' | 'CDI' | 'PTAX' | 'MANUAL';
  indexerPercent: number;                    // 100 = 100%
  spreadAnnual: number;                      // 2.5 = 2.5% a.a.
  baseRateAnnual?: number;                   // Taxa do indexador
  dayCountBasis?: '30/360' | 'ACT/365' | 'ACT/360' | 'BUS/252';
  ptaxCurrency?: CurrencyCode;               // Para PTAX
  ptaxSource?: 'AUTO' | 'PTAX_BCB' | 'MANUAL';
  role?: 'RATE' | 'ADJUSTMENT';              // Papel da perna
}
```

## Fórmulas Customizadas

O plugin registra as seguintes fórmulas no CalcEngine:

### 1. **LOAN.BALANCE(contractId, [date], [currency])**
Retorna o saldo devedor do contrato.
```
=LOAN.BALANCE("LOAN-001")              → 100000 (BRL)
=LOAN.BALANCE("LOAN-001", "2025-01-15") → Saldo em 15/01/2025
=LOAN.BALANCE("LOAN-001", "2025-01-15", "USD") → Saldo em USD
```

### 2. **LOAN.INTEREST(contractId, startDate, endDate)**
Calcula juros acumulados no período.
```
=LOAN.INTEREST("LOAN-001", "2025-01-01", "2025-01-31")
→ 1250.50 (Juros de janeiro)
```

### 3. **LOAN.STATUS(contractId)**
Retorna o status do contrato.
```
=LOAN.STATUS("LOAN-001") → "ATIVO"
```

### 4. **LOAN.PMT(principal, ratePercent, nper)**
Calcula valor da parcela (Tabela PRICE).
```
=LOAN.PMT(100000, 1.5, 12) → 8770.12
```

### 5. **LOAN.NEXT.PAYMENT(contractId)**
Retorna a data da próxima parcela.
```
=LOAN.NEXT.PAYMENT("LOAN-001") → "2025-02-15"
```

### 6. **LOAN.NEXT.AMOUNT(contractId)**
Retorna o valor da próxima parcela.
```
=LOAN.NEXT.AMOUNT("LOAN-001") → 8770.12
```

### 7. **LOAN.ACCRUAL(contractId, startDate, endDate, [frequency], [rateMode], [fxMode], [variation])**
Gera cronograma ACCRUAL e retorna número de linhas.
```
=LOAN.ACCRUAL("LOAN-001", "2025-01-01", "2025-12-31", "Mensal")
→ 12 (Cria sheet com 12 linhas de ACCRUAL)
```

### 8. **LOAN.ACCRUAL.VIEW(viewId, [contractId])**
Define o layout do ACCRUAL (personalização).
```
=LOAN.ACCRUAL.VIEW("standard") → "standard"
=LOAN.ACCRUAL.VIEW("detailed", "LOAN-001") → "detailed"
```

### 9. **LOAN.ACCRUAL.VIEWS()**
Lista todos os layouts de ACCRUAL disponíveis.
```
=LOAN.ACCRUAL.VIEWS()
→ [["standard", "Padrão", "..."], ["detailed", "Detalhado", "..."]]
```

### 10. **LOAN.SCHEDULE(contractId)**
Gera cronograma de pagamentos e retorna número de linhas.
```
=LOAN.SCHEDULE("LOAN-001") → 12 (Cria sheet com 12 parcelas)
```

### 11. **LOAN.PAY(contractId, paymentDate, amount, [currency], [description])**
Registra um pagamento.
```
=LOAN.PAY("LOAN-001", "2025-01-15", 10000, "BRL", "Pagamento parcela 1")
→ 1 (Sucesso)
```

## Fluxo de Uso

### 1. Criar um Contrato

```javascript
// Via UI (Menu)
Empréstimos → Novo Contrato

// Via API
const contract = await loanPlugin.createContract({
  contractType: 'CAPTADO',
  counterparty: 'Banco ABC',
  currency: 'USD',
  principalOrigin: 100000,
  startDate: '2025-01-01',
  maturityDate: '2026-01-01',
  interestConfig: {
    template: 'CDI_PLUS',
    legs: [{ indexer: 'CDI', indexerPercent: 110, spreadAnnual: 2.5 }],
    dayCountBasis: 'BUS/252',
    compounding: 'EXPONENCIAL',
    rounding: 'HALF_UP'
  },
  paymentFlow: {
    type: 'SCHEDULED',
    scheduled: {
      system: 'PRICE',
      periodicity: 'MENSAL',
      installments: 12,
      firstPaymentDate: '2025-02-01'
    }
  }
});
```

### 2. Registrar Pagamento

```javascript
// Via UI (Menu)
Empréstimos → Registrar Pagamento

// Via API
await loanPlugin.registerPayment(
  'LOAN-001',
  10000,
  '2025-02-01',
  'BRL',
  'Pagamento da parcela 1'
);
```

### 3. Gerar ACCRUAL

```javascript
// Via UI (Menu)
Empréstimos → Gerar ACCRUAL

// Via Fórmula
=LOAN.ACCRUAL("LOAN-001", "2025-01-01", "2025-12-31", "Mensal")
```

### 4. Gerar Cronograma de Pagamentos

```javascript
// Via Fórmula
=LOAN.SCHEDULE("LOAN-001")
```

## Integração com FX Plugin

O Loan Plugin se integra com o **FX Finance Plugin** para obter taxas de câmbio:

1. **Conexão Automática**: Durante a inicialização, tenta conectar ao FX Plugin
2. **Sincronização PTAX**: Pré-carrega taxas PTAX dos últimos 30 dias para moedas dos contratos
3. **Fallback Inteligente**:
   - 1º: Taxa fixada no contrato
   - 2º: Taxa manual inserida no FX Plugin
   - 3º: PTAX do BCB
   - 4º: AUTO (fallback do FX Plugin)

## Persistência

Todos os dados são persistidos em **IndexedDB** através do `PluginContext.storage`:

- **contracts**: Mapa de contratos (chave: contractId)
- **payments**: Mapa de pagamentos por contrato
- **payment-ledger**: Ledger completo de transações
- **accrual-history**: Histórico de ACCRUALs gerados

## Eventos

O plugin emite os seguintes eventos:

- `loan:contract-created`: Novo contrato criado
- `loan:payment-registered`: Pagamento registrado
- `loan:accrual-generated`: ACCRUAL gerado
- `loan:schedule-generated`: Cronograma gerado

## Casos de Uso

### 1. Empréstimo em Dólar com CDI + Spread
```
Moeda: USD
Principal: USD 100,000
Taxa: 110% CDI + 2.5% a.a.
Prazo: 12 meses
Sistema: PRICE
Periodicidade: Mensal
```

### 2. Empréstimo em Real com Taxa Fixa
```
Moeda: BRL
Principal: R$ 500,000
Taxa: 8.5% a.a. (fixa)
Prazo: 24 meses
Sistema: SAC
Periodicidade: Mensal
Carência: 3 meses (juros)
```

### 3. Empréstimo Composto (CDI + PTAX)
```
Moeda: USD
Principal: USD 200,000
Taxa: 100% CDI + 1.5% a.a. + 100% PTAX USD + 1% a.a.
Prazo: 12 meses
Sistema: PRICE
```

## Limitações e Considerações

1. **Moedas**: Depende do FX Plugin para taxas de câmbio
2. **Indexadores**: CDI e PTAX requerem dados externos
3. **Calendário**: BUS/252 usa simplificação (não considera feriados)
4. **Amortização**: Sempre primeiro juros, depois principal
5. **Performance**: ACCRUAL diário para períodos longos pode ser lento

## Arquivos do Plugin

```
src/plugins/loan/
├── index.ts                      # Entry point
├── loan-plugin.ts                # Plugin principal
├── loan-types.ts                 # Definições de tipos
├── loan-calculator.ts            # Cálculos financeiros
├── loan-scheduler.ts             # Geração de cronogramas
├── loan-payment-manager.ts       # Gestão de pagamentos
├── loan-fx-integration.ts        # Integração FX
├── loan-indexer-service.ts       # Serviço de indexadores
├── loan-validator.ts             # Validações
├── loan-templates.ts             # Templates de juros
├── loan-wizard.ts                # Wizard de criação
├── loan-sheets.ts                # Gestão de planilhas
├── loan-dashboard.ts             # Dashboard visual
├── loan-report-manager.ts        # Sistema de relatórios
├── loan-report-builder.ts        # Construtor de relatórios
├── loan-report-selector.ts       # Seletor de relatórios
├── loan-report-templates.ts      # Templates de relatórios
├── loan-report-generator.ts      # Gerador de relatórios
├── loan-accrual-view.ts          # Visualização de ACCRUAL
├── loan-accrual-customizer.ts    # Customização de ACCRUAL
├── loan-accrual-history.ts       # Histórico de ACCRUAL
├── loan-contract-inspector.ts    # Inspetor de contratos
└── loan-payment.ts               # Tipos de pagamento
```

## Dependências

- **@core/types**: Tipos do kernel
- **@core/kernel**: Kernel do DataForge
- **@core/storage-utils-consolidated**: Logger, formatters
- **@core/plugin-system-consolidated**: Sistema de plugins
- **nanoid**: Geração de IDs únicos
- **FX Finance Plugin**: Taxas de câmbio (opcional, mas recomendado)

## Extensibilidade

O plugin pode ser estendido:

1. **Novos Indexadores**: Adicionar em `LoanIndexerService`
2. **Novos Templates**: Adicionar em `INTEREST_TEMPLATES`
3. **Novos Sistemas de Amortização**: Adicionar em `LoanScheduler`
4. **Novos Relatórios**: Adicionar templates em `LoanReportManager`
5. **Novas Validações**: Adicionar em `LoanValidator`

## Conclusão

O Loan Plugin é um sistema completo de gestão de empréstimos que oferece:

- ✅ Suporte a múltiplas moedas
- ✅ Estruturas flexíveis de juros (CDI, PTAX, Fixa, Composta)
- ✅ Cronogramas automáticos (PRICE, SAC)
- ✅ Gestão completa de pagamentos
- ✅ Integração com taxas de câmbio (PTAX/BCB)
- ✅ Relatórios avançados
- ✅ Dashboard interativo
- ✅ Fórmulas customizadas
- ✅ Persistência automática

É ideal para empresas que precisam gerenciar contratos de empréstimo com rigor financeiro e contábil.
