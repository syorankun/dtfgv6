# Loan Plugin – Accrual Recalculado com Pagamentos (BRL + FX)

Este relatório documenta em profundidade o funcionamento do Loan Plugin (DataForge v6) com foco em:

- Política de cálculo de juros (origem e BRL)
- Conversão cambial (Contrato vs PTAX – mark-to-market)
- Integração com pagamentos (ledger) e recálculo do accrual
- UI/visões geradas e colunas
- Casuística contábil de competência (mensal)
- Casos de borda, validações e testes


## 1) Conceitos e Objetivos

- Moeda de origem (Origin): moeda do contrato (ex.: USD)
- Moeda funcional (BRL): provisionamento e reporting contábil
- Accrual de Juros: cálculo de juros período a período (diário/mensal/anual)
- Mark-to-market (PTAX): tradução do saldo/juros para BRL pela PTAX da data do ponto
- Ledger de Pagamentos: histórico de pagamentos com valores em origem e BRL

Objetivo principal: obter, para cada competência, os juros efetivamente provisionáveis em BRL, considerando que pagamentos que amortizam o principal reduzem os juros dos períodos subsequentes.


## 2) Política de Cálculo

### 2.1 Day Count e Compounding
- Day count basis: 30/360, ACT/365, ACT/360, BUS/252
- Compounding: Exponencial (default) ou Linear (configurável por contrato/leg)
- Taxa efetiva por período: resultado da composição das pernas (legs) de juros

### 2.2 Taxas e FX
- Taxa Contrato (fxRateContract): taxa fixa do contrato (se existir)
- PTAX (fxRatePTAX): obtida do plugin FX v3 por data (Daily/EOM)
- Política BRL: para mark-to-market, usar PTAX da data do ponto; para projeções à taxa do contrato, usar fxRateContract

### 2.3 Ordem de Alocação de Pagamentos
1) Juros do período (BRL e origem)
2) Principal (reduz saldo devedor para períodos seguintes)


## 3) Algoritmo de Accrual Recalculado

### 3.1 Scheduler (base)
Arquivo: `src/plugins/loan/loan-scheduler.ts`

- Gera linhas por período com:
  - Saldo inicial, juros, saldo final (moeda origem)
  - Conversão para BRL em duas visões: Contrato (fixa) e PTAX (mark-to-market)
  - Juros acumulados (origin, BRL-Contrato, BRL-PTAX)
- Observação: o scheduler base não abate pagamentos dentro do período; ele usa o saldo reconstruído apenas na data inicial.

### 3.2 Enriquecimento com Pagamentos (Recalc)
Arquivo: `src/plugins/loan/loan-accrual-payment-view.ts`

- Para cada período:
  1. Usa o saldo corrente (carregado da linha anterior já ajustada)
  2. Calcula juros do período sobre o saldo corrente:
     - `interestOrigin = openingOrigin * effRate`
     - `interestBRL = openingBRL * effRate` (consistente com PTAX do ponto)
  3. Acumula juros recalculados
  4. Aloca pagamentos do dia: primeiro para juros do período (até zerar), depois para principal
  5. Atualiza saldo final: `saldo + juros − pagamentosTotais`
- Resultados sobrescrevem os campos padrão da linha (ex.: `openingBalanceBRLPTAX`, `interestBRLPTAX`, `closingBalanceBRLPTAX`, e equivalentes em origem) garantindo que as visões exibam os números recalculados.

### 3.3 Competência (Mensal)
- Se a frequência for "Mensal", cada linha representa o último dia do mês de competência
- Os pagamentos ocorridos dentro do mês são alocados na linha desse mês (há suporte a múltiplos pagamentos por dia)


## 4) Conversão Cambial – Regras

- Origem → BRL para mark-to-market: PTAX da data do ponto (Daily); opcionalmente, EOM
- Não há dupla conversão: juros são calculados em origem e convertidos por PTAX do ponto, ou calculados diretamente em BRL como `openingBRL * effRate` (equivalente sob PTAX do ponto)
- Variação cambial apresentada como diferença entre Contrato e PTAX sobre saldos de abertura (coluna opcional)


## 5) Visões de Planilha (UI)

### 5.1 Payment Accrual View
Arquivo: `src/plugins/loan/loan-accrual-view.ts` (const `PAYMENT_ACCRUAL_VIEW`)

Seções principais:
- Período: Data, Dias, Taxa Efetiva
- Saldos: Saldo Inicial (BRL e Origem)
- Juros: Juros do período (BRL e Origem), Juros Acumulados (BRL e Origem)
- Pagamentos: Juros Pagos (BRL e Origem), Principal Pago (BRL e Origem)
- Saldos Recalculados: Juros Pendentes (BRL e Origem), Saldo Devedor (BRL e Origem)
- FX: PTAX (BCB), FX Contrato (para referência)

Metadados na planilha:
- Modo de Cálculo: Accrual Recalculado com Pagamentos
- FX BRL: PTAX (mark-to-market)
- Alocação Pagamentos: Juros primeiro, depois principal

### 5.2 Outras Visões
- Padrão consolidada (contrato e PTAX)
- Foco em variação cambial


## 6) Casos de Borda e Precisão

- Múltiplos pagamentos no mesmo dia: somados; alocação respeita ordem juros→principal
- Juros fixos vs variáveis (legs): taxa efetiva por período é a composição de todas as pernas
- Faltas de PTAX: fallback para taxa do contrato (metadado indica)
- Arredondamentos: 2 casas BRL, 4 casas em origem; HALF_UP (configurável)
- Pagamentos em moeda diferente de BRL e da origem: convertidos via plugin FX para BRL e para origem
- Evita saldos negativos após pagamentos (clamp para zero)


## 7) Validação e Testes

Testes recomendados (unit/integration):

1) Sem pagamentos: accrual recalc == accrual base
2) Pagamento no meio do mês: juros do mês seguinte menor do que sem pagamento
3) Múltiplos pagamentos no mês: alocação correta e saldo consistente
4) FX EOM vs Daily: verificar total BRL com PTAX EOM e Daily (diferença esperada)
5) Troca de basis e compounding: ACT/365 vs 30/360; EXP vs LIN

Métricas a verificar:
- Soma dos juros pagos + juros pendentes == juros acumulados recalculados
- Saldo final == saldo inicial + juros recalculados − pagamentos totais


## 8) Como Usar

### Via UI
- Plugins → Relatórios → Template: "ACCRUAL com Pagamentos"
- Selecione contratos, período e frequência (Mensal recomendado para competência)
- Gera planilha com metadados e visões configuradas

### Via API (TypeScript)
```ts
await reportGenerator.generate({
  templateId: 'payment-accrual-view',
  contracts: [contract],
  startDate: '2025-01-01',
  endDate: '2025-12-31',
  frequency: 'Mensal',
  outputMode: 'sheet',
  includeCharts: false
});
```


## 9) Melhorias Futuras
- Suporte a modo de FX "EOM" parametrizável por relatório
- Colunas de reconciliação: accrual base vs recalculado (delta por período)
- Indicadores contábeis: provisão, reversão, competência cruzada
- Testes automatizados com cenários multi-moeda e curvas variáveis

---

Para dúvidas ou ajustes de política contábil (ex.: competência com rateio intramês), podemos parametrizar a alocação e a data de reconhecimento conforme o seu processo.
