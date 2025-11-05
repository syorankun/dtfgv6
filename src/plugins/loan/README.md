# Loan Plugin - Gestão de Empréstimos

Plugin completo para gestão de contratos de empréstimo com suporte a multi-moeda, cálculos de ACCRUAL e cronogramas de pagamento.

## Funcionalidades

### ✅ Implementadas
- **Criação de Contratos**: Validação completa e criação de contratos com múltiplas pernas de juros
- **Sistema de Amortização**: Registro e aplicação de pagamentos com cálculo automático de amortização
- **Cálculos Financeiros**: PMT, juros acumulados, saldos atualizados
- **Integração FX**: Conversão automática de moedas via FX Plugin
- **Fórmulas Excel**: LOAN.BALANCE, LOAN.INTEREST, LOAN.STATUS, LOAN.PMT, LOAN.NEXT.PAYMENT, LOAN.NEXT.AMOUNT
- **Persistência**: Salvamento automático de contratos e histórico de pagamentos
- **Validação**: Validações robustas de dados e estado dos contratos
- **Templates**: Templates pré-configurados para cenários comuns (CDI+, PTAX+, Fixed)

### 🚧 Em Desenvolvimento
- **UI do Wizard**: Interface completa para criação de contratos (6 steps)
- **Modal de Pagamentos**: Interface para registro de pagamentos
- **Wizard ACCRUAL**: Interface para geração de relatórios de acúmulo
- **Testes Unitários**: Cobertura completa de testes

## Estrutura do Plugin

```
src/plugins/loan/
├── loan-plugin.ts          # Plugin principal e orquestração
├── loan-types.ts           # Definições de tipos e interfaces
├── loan-calculator.ts      # Funções puras de cálculo financeiro
├── loan-scheduler.ts       # Geração de cronogramas ACCRUAL/Schedule
├── loan-fx-integration.ts  # Integração com FX Plugin
├── loan-payment-manager.ts # Gerenciamento de pagamentos e amortização
├── loan-validator.ts       # Validações de dados e estado
├── loan-templates.ts       # Templates de configuração de juros
├── loan-wizard.ts          # Estrutura base do wizard (TODO)
└── index.ts               # Exports do plugin
```

## Como Usar

### Criando um Contrato

```typescript
import { LoanPlugin } from '@plugins/loan';

// Via API programática
const contract = await loanPlugin.createContract({
  contractType: 'CAPTADO',
  counterparty: 'Banco XYZ',
  currency: 'USD',
  principalOrigin: 100000,
  startDate: '2025-01-01',
  maturityDate: '2025-12-31',
  interestConfig: {
    template: 'CDI_PLUS',
    legs: [{
      indexer: 'CDI',
      indexerPercent: 110,
      spreadAnnual: 2.5,
      role: 'RATE'
    }],
    dayCountBasis: 'ACT/360',
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

### Registrando Pagamentos

```typescript
// Registrar pagamento
const payment = await loanPlugin.registerPayment(
  'LOAN-20250101-ABC123',
  8500.00,
  '2025-02-01',
  'BRL',
  'Pagamento da primeira parcela'
);
```

### Usando Fórmulas

```excel
=LOAN.BALANCE("LOAN-20250101-ABC123")                    // Saldo atual em BRL
=LOAN.BALANCE("LOAN-20250101-ABC123", "2025-06-15")      // Saldo em data específica
=LOAN.BALANCE("LOAN-20250101-ABC123", "2025-06-15", "USD") // Saldo em USD

=LOAN.INTEREST("LOAN-20250101-ABC123", "2025-01-01", "2025-12-31") // Juros acumulados

=LOAN.STATUS("LOAN-20250101-ABC123")                     // Status do contrato

=LOAN.NEXT.PAYMENT("LOAN-20250101-ABC123")               // Data da próxima parcela
=LOAN.NEXT.AMOUNT("LOAN-20250101-ABC123")                // Valor da próxima parcela

=LOAN.PMT(100000, 12, 12)                               // Cálculo de parcela (PMT)
```

## Configuração de Juros

### Templates Disponíveis

- **CDI_PLUS**: CDI + spread fixo
- **PTAX_PLUS**: Variação PTAX + spread
- **FIXED**: Taxa fixa pré-determinada
- **CDI_PTAX**: Composição CDI + PTAX
- **CUSTOM**: Configuração manual

### Pernas de Juros (Interest Legs)

Cada contrato pode ter múltiplas pernas de juros:

```typescript
{
  indexer: 'CDI',           // CDI, PTAX, FIXED, MANUAL
  indexerPercent: 110,      // Percentual do indexador (110 = 110%)
  spreadAnnual: 2.5,        // Spread em % ao ano
  dayCountBasis: 'ACT/360', // Convenção de contagem de dias
  ptaxCurrency: 'USD',      // Moeda para PTAX (opcional)
  role: 'RATE'              // RATE ou ADJUSTMENT
}
```

## Fluxos de Pagamento

### SCHEDULED (Cronograma Fixo)
- **PRICE**: Parcela fixa, amortização crescente
- **SAC**: Amortização constante, parcela decrescente
- Periodicidades: MENSAL, TRIMESTRAL, SEMESTRAL, ANUAL
- Suporte a períodos de carência

### FLEXIBLE (Pagamentos Flexíveis)
- Pagamentos sob demanda
- Possibilidade de antecipação

## Validações Implementadas

- **Dados de Entrada**: Contratos, pagamentos, configurações
- **Estado do Contrato**: Saldos, datas, consistência
- **Regras de Negócio**: Elegibilidade para pagamentos, limites
- **Integridade**: Prevenção de estados inválidos

## Persistência

- **Contratos**: Salvos automaticamente no storage
- **Pagamentos**: Histórico completo mantido
- **Backup**: Dados salvos em `kernel:autosave-done`

## Tratamento de Erros

- **Try-catch**: Em operações críticas
- **Logs Detalhados**: Informações de debug completas
- **Mensagens de Usuário**: Feedback claro via toast
- **Validação Preventiva**: Erros capturados antes da execução

## Próximos Passos

1. **UI Completa**: Implementar wizards e modais
2. **Testes**: Cobertura unitária completa
3. **Performance**: Otimização para grandes volumes
4. **Relatórios**: Geração de ACCRUAL e schedules em Excel
5. **API REST**: Exposição de endpoints para integração

## Dependências

- **FX Plugin**: Para conversões de moeda (opcional)
- **Core Types**: Interfaces do sistema
- **Storage Utils**: Persistência de dados

## Suporte a Moedas

- **BRL**: Real brasileiro (moeda base)
- **USD**: Dólar americano
- **EUR**: Euro
- **GBP**: Libra esterlina
- **JPY**: Iene japonês
- **Outras**: Qualquer código ISO 4217

## Convenções de Contagem de Dias

- **30/360**: 30 dias por mês, 360 dias por ano
- **ACT/360**: Dias reais / 360
- **ACT/365**: Dias reais / 365
- **BUS/252**: Dias úteis (252 por ano)</content>
<parameter name="filePath">/workspaces/dtfgv6/src/plugins/loan/README.md