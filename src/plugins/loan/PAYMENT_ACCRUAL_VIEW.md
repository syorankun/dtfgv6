# Visão de ACCRUAL com Pagamentos

## Descrição

A visão **ACCRUAL com Pagamentos** é uma funcionalidade do Loan Plugin que combina o cálculo de accrual (acumulação de juros) com o registro de pagamentos realizados, oferecendo uma visão completa e atualizada do status financeiro de cada contrato de empréstimo.

## O que é calculado

Esta visão mostra, período a período:

### 1. **Saldos e Montantes**
- **Saldo Inicial (BRL)**: Saldo devedor no início do período em BRL
- **Saldo Inicial (Moeda)**: Saldo devedor no início do período na moeda do contrato

### 2. **Juros do Período**
- **Juros BRL**: Juros acumulados no período em BRL
- **Juros Moeda**: Juros acumulados no período na moeda do contrato
- **Juros Acum. BRL**: Total de juros acumulados desde o início do contrato (BRL)
- **Juros Acum. Moeda**: Total de juros acumulados desde o início (moeda do contrato)

### 3. **Pagamentos Realizados** ⭐ NOVIDADE
- **Juros Pagos (BRL)**: Valor de juros efetivamente pago neste período
- **Juros Pagos (Moeda)**: Valor de juros pago na moeda do contrato
- **Principal Pago (BRL)**: Valor de amortização do principal em BRL
- **Principal Pago (Moeda)**: Valor de amortização na moeda do contrato

### 4. **Saldos Recalculados** ⭐ NOVIDADE
- **Juros Pendentes (BRL)**: Juros acumulados que ainda não foram pagos (= Juros Acum. - Juros Pagos)
- **Juros Pendentes (Moeda)**: Juros pendentes na moeda do contrato
- **Saldo Devedor (BRL)**: Saldo recalculado após pagamentos em BRL
- **Saldo Devedor (Moeda)**: Saldo recalculado na moeda do contrato

### 5. **Informações Cambiais**
- **PTAX (BCB)**: Taxa de câmbio do Banco Central para o período
- **FX Contrato**: Taxa de câmbio fixada no contrato

## Como Usar

### Via Interface Gráfica (Gerador de Relatórios)

1. Abra o **Loan Plugin**
2. Selecione um ou mais contratos
3. Clique em **"Gerar Relatório"**
4. No campo **Template**, selecione **"ACCRUAL com Pagamentos"** 💳
5. Configure:
   - Data de início
   - Data de fim
   - Frequência (Diário/Mensal/Anual)
6. Clique em **Gerar**

### Via API (Programático)

```typescript
import { LoanPlugin, PAYMENT_ACCRUAL_VIEW } from '@plugins/loan';

// 1. Gera relatório com template de pagamentos
const report = await loanPlugin.reportGenerator.generate({
  templateId: 'payment-accrual-view',
  contracts: [contract1, contract2],
  startDate: '2025-01-01',
  endDate: '2025-12-31',
  frequency: 'Mensal',
  outputMode: 'sheet',
  includeCharts: false
});

// 2. Ou usa o view diretamente
const accrualRows = await loanPlugin.scheduler.buildAccrualRows(
  contract,
  '2025-01-01',
  '2025-12-31',
  'Mensal'
);

const ledger = loanPlugin.paymentManager.getLedger(contract.id);
const enrichedRows = LoanAccrualPaymentEnricher.enrichWithPayments(
  accrualRows,
  ledger,
  contract.currency
);
```

## Lógica de Alocação de Pagamentos

Os pagamentos são alocados automaticamente seguindo a regra padrão de empréstimos:

1. **Primeiro**: Paga os **juros acumulados** do período
2. **Depois**: O restante vai para **amortização do principal**

### Exemplo:

**Cenário:**
- Juros do período: R$ 1.000,00
- Saldo devedor: R$ 50.000,00
- Pagamento realizado: R$ 3.000,00

**Alocação:**
- Juros Pagos: R$ 1.000,00 (cobriu totalmente)
- Principal Pago: R$ 2.000,00 (restante)
- Juros Pendentes: R$ 0,00 (1.000 - 1.000)
- Novo Saldo: R$ 48.000,00 (50.000 - 2.000)

## Benefícios

✅ **Visão Completa**: Veja juros acumulados E pagamentos no mesmo lugar  
✅ **Saldo Real**: Acompanhe o saldo devedor atualizado após cada pagamento  
✅ **Juros Pendentes**: Identifique rapidamente quanto de juros ainda precisa ser pago  
✅ **Bi-Moeda**: Todos os valores disponíveis em BRL e na moeda do contrato  
✅ **Auditável**: Rastreie exatamente quando e quanto foi pago  

## Casos de Uso

### 1. Análise Mensal de Despesas Financeiras
Use frequência **Mensal** para ver quanto de juros foi acumulado vs. pago a cada mês.

### 2. Planejamento de Fluxo de Caixa
Identifique períodos com alto acúmulo de juros pendentes.

### 3. Prestação de Contas
Demonstre para auditoria exatamente como os pagamentos foram alocados.

### 4. Acompanhamento de Quitação
Monitore a evolução do saldo devedor após cada pagamento.

## Integração com Outros Módulos

Esta visão funciona perfeitamente com:

- **Loan Payment Manager**: Os pagamentos registrados aparecem automaticamente
- **Loan FX Integration**: Conversões de moeda são aplicadas automaticamente
- **Dashboard**: Métricas são atualizadas em tempo real
- **Exportação**: Dados podem ser exportados para Excel/CSV

## Dicas

💡 **Dica 1**: Use frequência **Diária** para contratos de curto prazo com pagamentos frequentes

💡 **Dica 2**: A coluna "Juros Pendentes" é crucial para identificar passivos não realizados

💡 **Dica 3**: Compare "Saldo Devedor BRL" entre diferentes períodos para ver o impacto cambial

💡 **Dica 4**: Filtre por datas específicas de pagamentos para análise detalhada

## Exemplo de Saída

```
Data       | Juros Acum. | Juros Pagos | Juros Pend. | Princ. Pago | Saldo Devedor
-----------|-------------|-------------|-------------|-------------|---------------
2025-01-31 | R$ 1.234,56 | R$ 0,00     | R$ 1.234,56 | R$ 0,00     | R$ 100.000,00
2025-02-28 | R$ 2.489,12 | R$ 2.000,00 | R$ 489,12   | R$ 1.000,00 | R$ 99.000,00
2025-03-31 | R$ 3.701,45 | R$ 500,00   | R$ 3.201,45 | R$ 0,00     | R$ 99.000,00
```

## Suporte

Para dúvidas ou sugestões sobre esta funcionalidade, consulte:
- `loan-accrual-payment-view.ts` - Implementação do enricher
- `loan-accrual-view.ts` - Configuração da visão
- `loan-payment-manager.ts` - Gerenciamento de pagamentos

---

**Versão**: 1.0.0  
**Última atualização**: Novembro 2025  
**Plugin**: DJ DataForge Loan Plugin v6
