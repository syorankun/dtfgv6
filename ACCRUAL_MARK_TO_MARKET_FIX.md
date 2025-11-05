# ✅ Correção: ACCRUAL com Mark-to-Market Diário

**Data**: 2025-01-05  
**Versão**: DJ DataForge v6 - Loan Plugin 2.0.1  
**Status**: ✅ **IMPLEMENTADO E TESTADO**

---

## 📋 Problema Identificado

O cronograma ACCRUAL estava calculando apenas **uma linha de valores em BRL**, sem distinguir entre:

1. **Taxa fixa do contrato** (fixada no momento da criação)
2. **Taxa PTAX do BCB do dia** (mark-to-market diário)

Isso impedia a visualização da **variação cambial diária** que é essencial para contratos em moeda estrangeira.

---

## 🎯 Solução Implementada

### Dupla Conversão no ACCRUAL

Agora o cronograma ACCRUAL calcula **DUAS linhas de valores em BRL** para cada período:

```
┌─────────────────────────────────────────────────────────────┐
│                    VALORES EM MOEDA ORIGEM                  │
│  - Saldo Inicial Origem (ex: USD 100,000)                  │
│  - Juros Origem (ex: USD 500)                              │
│  - Saldo Final Origem (ex: USD 100,500)                    │
└─────────────────────────────────────────────────────────────┘
                          │
                          ├─────────────┬──────────────┐
                          │             │              │
                          ▼             ▼              ▼
┌──────────────────────┐  ┌───────────────────────┐  ┌──────────────────┐
│  Taxa CONTRATO       │  │  Taxa PTAX BCB        │  │  Variação        │
│  (Fixada em 5.4500)  │  │  (Diária: 5.4812)     │  │  Cambial         │
├──────────────────────┤  ├───────────────────────┤  ├──────────────────┤
│ Saldo BRL: 545,000   │  │ Saldo BRL: 548,120    │  │ Variação: +3,120 │
│ Juros BRL: 2,725     │  │ Juros BRL: 2,741      │  │ % Variação: +0.57│
│ Saldo Final: 547,725 │  │ Saldo Final: 550,861  │  │                  │
└──────────────────────┘  └───────────────────────┘  └──────────────────┘
```

---

## 🔧 Alterações Técnicas

### 1. Interface `AccrualRow` Expandida

**Arquivo**: `src/plugins/loan/loan-scheduler.ts`

```typescript
export interface AccrualRow {
  date: string;
  days: number;
  effRate: number;
  
  // Valores em moeda origem
  openingBalanceOrigin: number;
  interestOrigin: number;
  closingBalanceOrigin: number;
  
  // Valores em BRL usando taxa do CONTRATO (fixada)
  openingBalanceBRLContract: number;
  interestBRLContract: number;
  closingBalanceBRLContract: number;
  fxRateContract: number;
  
  // Valores em BRL usando taxa PTAX do BCB (mark-to-market)
  openingBalanceBRLPTAX: number;
  interestBRLPTAX: number;
  closingBalanceBRLPTAX: number;
  fxRatePTAX: number;
  fxSourcePTAX?: string;
  
  // Variação cambial (diferença entre PTAX e Contrato)
  fxVariationBRL: number;              // Variação em BRL
  fxVariationPercent: number;          // Variação %
  
  // Campos mantidos por compatibilidade
  openingBalanceBRL: number;
  interestBRL: number;
  closingBalanceBRL: number;
  fxRate: number;
  fxSource?: string;
}
```

### 2. Lógica de Cálculo Duplo

**Arquivo**: `src/plugins/loan/loan-scheduler.ts` (linhas 105-207)

```typescript
// 1. Taxa FIXADA no CONTRATO (sempre a mesma)
const fxRateContract = contract.contractFXRate || 1;
const openingBalanceBRLContract = openingBalanceOrigin * fxRateContract;
const interestBRLContract = interestOrigin * fxRateContract;
const closingBalanceBRLContract = closingBalanceOrigin * fxRateContract;

// 2. Taxa PTAX do BCB (busca taxa do dia específico)
const ptaxInfo = await this.fxIntegration.getConversionRate(
  nextDateStr,
  currency
  // NÃO passa contractFXRate como fallback - queremos PTAX puro
);

if (ptaxInfo && ptaxInfo.source.includes('PTAX')) {
  fxRatePTAX = ptaxInfo.rate;  // Taxa do BCB
  fxSourcePTAX = ptaxInfo.source;
} else {
  fxRatePTAX = fxRateContract;  // Fallback se PTAX indisponível
  fxSourcePTAX = 'Contrato (PTAX indisponível)';
}

// Calcula valores em BRL usando PTAX
openingBalanceBRLPTAX = openingBalanceOrigin * fxRatePTAX;
interestBRLPTAX = interestOrigin * fxRatePTAX;
closingBalanceBRLPTAX = closingBalanceOrigin * fxRatePTAX;

// Calcula variação cambial
fxVariationBRL = openingBalanceBRLPTAX - openingBalanceBRLContract;
fxVariationPercent = ((fxRatePTAX - fxRateContract) / fxRateContract) * 100;
```

### 3. Planilha ACCRUAL com Colunas Expandidas

**Arquivo**: `src/plugins/loan/loan-sheets.ts`

Colunas da planilha ACCRUAL:

| # | Coluna | Descrição |
|---|--------|-----------|
| A | Data | Data do período |
| B | Dias | Dias no período |
| C | Taxa Efetiva | Taxa de juros do período |
| **Moeda Origem** | | |
| D | Saldo Inicial Origem | Saldo em USD/EUR/etc |
| E | Juros Origem | Juros em USD/EUR/etc |
| F | Saldo Final Origem | Saldo final em USD/EUR/etc |
| **BRL (Taxa do Contrato)** | | |
| G | Saldo Inicial BRL (Contrato) | Saldo convertido com taxa fixa |
| H | Juros BRL (Contrato) | Juros convertidos com taxa fixa |
| I | Saldo Final BRL (Contrato) | Saldo final com taxa fixa |
| J | Taxa FX Contrato | Taxa fixa (ex: 5.4500) |
| **BRL (Taxa PTAX BCB)** | | |
| K | Saldo Inicial BRL (PTAX) | Saldo mark-to-market |
| L | Juros BRL (PTAX) | Juros mark-to-market |
| M | Saldo Final BRL (PTAX) | Saldo final mark-to-market |
| N | Taxa FX PTAX | Taxa PTAX do dia (ex: 5.4812) |
| O | Fonte PTAX | Fonte da taxa (PTAX/BCB) |
| **Variação Cambial** | | |
| P | Variação Cambial (BRL) | Diferença em BRL |
| Q | Variação Cambial (%) | Variação percentual |

---

## 📊 Exemplo Prático

### Contrato: USD 100,000 em 2025-01-15

**Taxa fixada no contrato**: 5.4500 (PTAX do dia da criação)

### ACCRUAL Diário (01/01/2025 a 03/01/2025)

| Data | Dias | Taxa Efetiva | Saldo USD | Juros USD | Saldo BRL (Contrato) | Saldo BRL (PTAX) | PTAX | Variação BRL | Variação % |
|------|------|--------------|-----------|-----------|---------------------|------------------|------|--------------|------------|
| 01/01 | 1 | 0.0001370 | 100,000.00 | 13.70 | 545,000.00 | 545,000.00 | 5.4500 | 0.00 | 0.00% |
| 02/01 | 1 | 0.0001370 | 100,013.70 | 13.70 | 545,074.67 | 548,194.52 | 5.4812 | +3,119.85 | +0.57% |
| 03/01 | 1 | 0.0001370 | 100,027.40 | 13.71 | 545,149.34 | 547,942.18 | 5.4756 | +2,792.84 | +0.47% |

**Interpretação**:
- No dia 02/01, a PTAX subiu de 5.4500 para 5.4812 (+0.57%)
- Isso gerou uma variação cambial de **+3,119.85 BRL** sobre o saldo
- No dia 03/01, a PTAX caiu levemente para 5.4756 (+0.47% vs contrato)
- Variação cambial acumulada: **+5,912.69 BRL**

---

## ✅ Casos de Uso

### 1. Contratos em BRL

Para contratos em BRL, ambas as colunas (Contrato e PTAX) terão os **mesmos valores**:
- Taxa FX Contrato: 1.0000
- Taxa FX PTAX: 1.0000
- Variação Cambial: 0.00 BRL (0.00%)

### 2. Contratos em USD/EUR/GBP

Para contratos em moeda estrangeira:
- **Taxa Contrato**: Fixada no momento da criação (ex: 5.4500)
- **Taxa PTAX**: Obtida do BCB para cada dia específico
- **Variação**: Mostra ganho/perda cambial diária

### 3. PTAX Indisponível

Se a taxa PTAX não estiver disponível para uma data:
- Sistema usa a taxa do contrato como fallback
- Fonte PTAX: "Contrato (PTAX indisponível)"
- Variação cambial: 0.00 BRL (0.00%)

---

## 🔄 Integração com FX Plugin

### Sincronização Automática

O Loan Plugin **sincroniza automaticamente** as taxas PTAX necessárias:

1. **No Init**: Sincroniza últimos 30 dias para moedas dos contratos
2. **Sob Demanda**: Se taxa não estiver no cache, tenta baixar do BCB
3. **Manual**: Usuário pode forçar sync via menu "Sincronizar PTAX"

### Priorização de Taxas

```
1. Taxa BRL → 1.0000 (sempre)
2. Taxa do Contrato (APENAS para coluna "Contrato")
3. Taxa PTAX do BCB (busca no cache do FX Plugin)
4. Fallback → Taxa do Contrato (se PTAX indisponível)
```

---

## 🎯 Benefícios

### Para Contratos em Moeda Estrangeira

1. ✅ **Visibilidade Total**: Vê exatamente quanto o câmbio impactou o saldo
2. ✅ **Análise de Risco**: Identifica exposição cambial diária
3. ✅ **Conformidade Contábil**: Atende requisitos de mark-to-market
4. ✅ **Transparência**: Separa juros de variação cambial

### Para Gestão de Portfolio

1. ✅ **Hedge Strategy**: Identifica necessidade de proteção cambial
2. ✅ **Projeções**: Permite simular cenários com taxas futuras
3. ✅ **Reporting**: Relatórios financeiros com decomposição de variação
4. ✅ **Auditoria**: Rastreabilidade de taxas usadas (fonte PTAX/BCB)

---

## 📚 Fórmulas Relacionadas

### LOAN.ACCRUAL

```typescript
=LOAN.ACCRUAL(contractId, startDate, endDate, [frequency], [rateMode], [fxMode], [variation])
```

**Parâmetros**:
- `contractId`: ID do contrato
- `startDate`: Data inicial (YYYY-MM-DD)
- `endDate`: Data final (YYYY-MM-DD)
- `frequency`: "Diário", "Mensal" ou "Anual" (opcional, padrão: Diário)
- `variation`: Se incluir "PTAX", mostra variação cambial (sempre mostrado agora)

**Exemplo**:
```
=LOAN.ACCRUAL("LOAN-001", "2025-01-01", "2025-01-31", "Diário")
```

**Resultado**: Cria planilha `_Loan_Accrual_LOAN-001_2025-01-01_2025-01-31` com 31 linhas (accrual diário)

### LOAN.BALANCE

```typescript
=LOAN.BALANCE(contractId, [date], [currency])
```

**Sempre retorna mark-to-market** (usa PTAX do dia):
```
=LOAN.BALANCE("LOAN-001", "2025-01-15", "BRL")
// Retorna saldo em BRL usando PTAX de 15/01/2025
```

---

## 🧪 Testes Realizados

### ✅ Teste 1: Contrato USD com PTAX Disponível
- ✅ Duas colunas BRL distintas
- ✅ Variação cambial calculada corretamente
- ✅ Fonte PTAX: "PTAX (BCB)"

### ✅ Teste 2: Contrato BRL
- ✅ Ambas as colunas BRL idênticas
- ✅ Variação cambial: 0.00 BRL (0.00%)

### ✅ Teste 3: PTAX Indisponível
- ✅ Fallback para taxa do contrato
- ✅ Fonte PTAX: "Contrato (PTAX indisponível)"
- ✅ Variação cambial: 0.00 BRL

### ✅ Teste 4: Compilação TypeScript
- ✅ Zero erros de tipo
- ✅ Build Vite concluído com sucesso

---

## 📦 Arquivos Modificados

1. **src/plugins/loan/loan-scheduler.ts**
   - Interface `AccrualRow` expandida
   - Lógica de cálculo duplo (Contrato vs PTAX)
   - Cálculo de variação cambial

2. **src/plugins/loan/loan-sheets.ts**
   - Headers da planilha ACCRUAL expandidos (17 colunas)
   - Renderização das colunas duplas de BRL
   - Formatação de variação cambial

---

## 🚀 Próximos Passos (Opcional)

### Melhorias Futuras

1. **Dashboard de Variação Cambial**
   - Gráfico de variação cambial acumulada
   - Alertas de exposição cambial acima de threshold

2. **Simulação de Cenários**
   - "E se" a PTAX variar X% nos próximos 30 dias?
   - Impacto no saldo total do portfolio

3. **Exportação para Excel**
   - Formatação condicional (variação positiva verde, negativa vermelha)
   - Gráficos integrados

4. **Hedge Recommendation**
   - Sugere instrumentos de hedge baseado na exposição
   - Calcula quanto hedgear para neutralizar risco

---

## ✅ Conclusão

A correção foi **implementada com sucesso** e está **100% funcional**:

- ✅ **Dupla conversão**: Taxa do Contrato vs Taxa PTAX do BCB
- ✅ **Variação cambial**: Calculada diariamente
- ✅ **Planilha expandida**: 17 colunas com todos os detalhes
- ✅ **Integração perfeita**: Com FX Plugin para obtenção de taxas
- ✅ **Zero erros**: Compilação TypeScript e build Vite OK

O cronograma ACCRUAL agora fornece **visibilidade total** sobre a evolução do contrato, separando claramente:
1. **Juros** (na moeda origem)
2. **Conversão com taxa fixa** (contrato)
3. **Conversão com taxa diária** (mark-to-market)
4. **Variação cambial** (diferença entre as duas)

---

**Versão**: 2.0.1  
**Data**: 2025-01-05  
**Status**: ✅ **PRODUÇÃO**
