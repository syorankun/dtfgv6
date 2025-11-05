# 📊 Exemplo Visual: ACCRUAL com Mark-to-Market

## Cenário: Contrato USD 100,000 em 2025-01-15

### Dados do Contrato
- **Moeda**: USD
- **Principal**: USD 100,000
- **Taxa de Juros**: 5% a.a. (CDI)
- **Taxa FX Fixada no Contrato**: 5.4500 (PTAX de 15/01/2025)
- **Data Início**: 2025-01-01
- **Data Vencimento**: 2025-12-31

---

## 📅 Cronograma ACCRUAL Diário (3 primeiros dias)

### Dia 1: 2025-01-01

| Categoria | Moeda Origem | BRL (Taxa Contrato) | BRL (Taxa PTAX BCB) | Variação |
|-----------|--------------|---------------------|---------------------|----------|
| **Saldo Inicial** | USD 100,000.00 | R$ 545,000.00 | R$ 545,000.00 | R$ 0.00 |
| **Taxa FX** | - | 5.4500 | 5.4500 | - |
| **Fonte** | - | Contrato | PTAX (BCB) | - |
| **Juros (1 dia)** | USD 13.70 | R$ 74.67 | R$ 74.67 | R$ 0.00 |
| **Saldo Final** | USD 100,013.70 | R$ 545,074.67 | R$ 545,074.67 | R$ 0.00 (0.00%) |

> ℹ️ No primeiro dia, ambas as taxas são iguais (dia da criação do contrato)

---

### Dia 2: 2025-01-02 �� PTAX SUBIU

| Categoria | Moeda Origem | BRL (Taxa Contrato) | BRL (Taxa PTAX BCB) | Variação |
|-----------|--------------|---------------------|---------------------|----------|
| **Saldo Inicial** | USD 100,013.70 | R$ 545,074.67 | **R$ 548,194.52** | **+R$ 3,119.85** |
| **Taxa FX** | - | 5.4500 (fixo) | **5.4812** (diária) | +0.57% |
| **Fonte** | - | Contrato | PTAX (BCB) | - |
| **Juros (1 dia)** | USD 13.70 | R$ 74.67 | **R$ 75.09** | +R$ 0.42 |
| **Saldo Final** | USD 100,027.40 | R$ 545,149.34 | **R$ 548,269.61** | **+R$ 3,120.27** (0.57%) |

> 📊 **Análise**: PTAX subiu de 5.4500 para 5.4812 (+0.57%)
> - **Impacto**: Ganho cambial de R$ 3,119.85 no saldo de abertura
> - **Total**: Saldo em BRL (mark-to-market) R$ 3,120.27 maior que taxa fixa

---

### Dia 3: 2025-01-03 📉 PTAX CAIU LEVEMENTE

| Categoria | Moeda Origem | BRL (Taxa Contrato) | BRL (Taxa PTAX BCB) | Variação |
|-----------|--------------|---------------------|---------------------|----------|
| **Saldo Inicial** | USD 100,027.40 | R$ 545,149.34 | **R$ 547,942.18** | **+R$ 2,792.84** |
| **Taxa FX** | - | 5.4500 (fixo) | **5.4756** (diária) | +0.47% |
| **Fonte** | - | Contrato | PTAX (BCB) | - |
| **Juros (1 dia)** | USD 13.71 | R$ 74.67 | **R$ 75.07** | +R$ 0.40 |
| **Saldo Final** | USD 100,041.11 | R$ 545,224.01 | **R$ 548,017.25** | **+R$ 2,793.24** (0.47%) |

> 📊 **Análise**: PTAX caiu de 5.4812 para 5.4756 (-0.10% no dia, mas +0.47% vs contrato)
> - **Impacto**: Ainda há ganho cambial, mas menor que no dia anterior
> - **Total**: Saldo em BRL (mark-to-market) R$ 2,793.24 maior que taxa fixa

---

## 📈 Gráfico de Evolução (3 dias)

```
Saldo em BRL
│
550k ┤                             ╭── PTAX (Mark-to-Market)
     │                          ╭──╯  R$ 548,017.25
     │                       ╭──╯
548k ┤                    ╭──╯
     │                 ╭──╯
     │              ╭──╯
546k ┤           ╭──╯
     │        ╭──╯
     │     ╭──╯                  ╭── Taxa Contrato (Fixo)
544k ┤──╭──╯                  ╭──╯  R$ 545,224.01
     │  │                  ╭──╯
     │  │               ╭──╯
542k ┤  │            ╭──╯
     │  │         ╭──╯
     │  │      ╭──╯
540k ┤  │   ╭──╯
     │  │╭──╯
     │  ╰─────────────────── Variação Cambial: +R$ 2,793.24
     └────┬────┬────┬────┬──
        D1   D2   D3   D4  Dias
```

---

## 💰 Decomposição de Ganhos/Perdas

### Resumo Acumulado (3 dias)

| Componente | Valor USD | Valor BRL (Contrato) | Valor BRL (PTAX) | Diferença |
|------------|-----------|----------------------|------------------|-----------|
| **Principal Inicial** | 100,000.00 | 545,000.00 | 545,000.00 | 0.00 |
| **Juros Acumulados** | 41.11 | 224.01 | 225.58 | +1.57 |
| **Variação Cambial** | - | - | +2,793.24 | **+2,793.24** |
| **Saldo Total** | 100,041.11 | 545,224.01 | **548,017.25** | **+2,793.24** |

**Interpretação**:
- ✅ **Juros**: USD 41.11 acumulados em 3 dias
- ✅ **Variação Cambial Positiva**: +R$ 2,793.24 (ganho de 0.51%)
- ✅ **Total em BRL (mark-to-market)**: R$ 548,017.25
- ✅ **Se usasse taxa fixa**: R$ 545,224.01 (R$ 2,793.24 a menos)

---

## 🎯 Casos de Uso Práticos

### 1. Análise de Exposição Cambial

**Pergunta**: "Quanto estou exposto ao risco cambial?"

**Resposta**:
```
Saldo USD: 100,041.11
Variação cambial em 3 dias: +R$ 2,793.24 (+0.51%)

Se PTAX variar +1% → Impacto: +R$ 5,450 (aproximado)
Se PTAX variar -1% → Impacto: -R$ 5,450 (aproximado)
```

### 2. Decisão de Hedge

**Pergunta**: "Devo fazer hedge cambial?"

**Análise**:
- Exposição atual: USD 100,041.11
- Volatilidade 30d: 2.5% (exemplo)
- VAR 95%: R$ 13,625 (perda máxima em 30 dias)
- **Recomendação**: Considerar hedge de 50% da exposição

### 3. Projeção de Fluxo de Caixa

**Pergunta**: "Quanto vou precisar em BRL para quitar o contrato?"

**Resposta**:
```
Cenário 1 (Taxa Contrato): R$ 545,224.01
Cenário 2 (PTAX Atual): R$ 548,017.25
Cenário 3 (PTAX +5%): R$ 572,486.26
Cenário 4 (PTAX -5%): R$ 525,462.81

Range: R$ 47,023.45 (8.7% de variação)
```

### 4. Contabilidade (Mark-to-Market)

**Lançamento Contábil** (baseado em PTAX):

```
Dia 1:
D - Empréstimo a Receber (USD) ........ R$ 545,000.00
C - Caixa ................................ R$ 545,000.00

Dia 2:
D - Empréstimo a Receber (USD) ........ R$ 3,119.85
C - Ganho Cambial ........................ R$ 3,119.85
(Ajuste mark-to-market com PTAX do dia)

D - Empréstimo a Receber (USD) ........ R$ 74.67
C - Receita de Juros ..................... R$ 74.67
```

---

## 📊 Planilha ACCRUAL Completa (Excel)

### Layout da Planilha

| A | B | C | D | E | F | G | H | I | J | K | L | M | N | O | P | Q |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Data | Dias | Taxa Efetiva | Saldo USD | Juros USD | Saldo Final USD | **Saldo BRL (Contrato)** | **Juros BRL (Contrato)** | **Saldo Final BRL (Contrato)** | **Taxa Contrato** | **Saldo BRL (PTAX)** | **Juros BRL (PTAX)** | **Saldo Final BRL (PTAX)** | **Taxa PTAX** | **Fonte** | **Var. BRL** | **Var. %** |

### Exemplo de Dados

```
A         B  C          D            E        F            G            H        I            J       K            L        M            N       O           P          Q
01/01/25  1  0.0001370  100,000.00   13.70   100,013.70   545,000.00   74.67   545,074.67   5.4500  545,000.00   74.67   545,074.67   5.4500  PTAX/BCB    0.00      0.00%
02/01/25  1  0.0001370  100,013.70   13.70   100,027.40   545,074.67   74.67   545,149.34   5.4500  548,194.52   75.09   548,269.61   5.4812  PTAX/BCB    +3,119.85 +0.57%
03/01/25  1  0.0001370  100,027.40   13.71   100,041.11   545,149.34   74.67   545,224.01   5.4500  547,942.18   75.07   548,017.25   5.4756  PTAX/BCB    +2,792.84 +0.47%
```

---

## 🔍 Comparação: Antes vs Depois

### ❌ ANTES (Versão Antiga)

**Problema**: Apenas uma coluna BRL (não distinguia taxa fixa vs mark-to-market)

| Data | Saldo USD | Juros USD | Saldo BRL | Juros BRL | Taxa FX |
|------|-----------|-----------|-----------|-----------|---------|
| 01/01 | 100,000.00 | 13.70 | 548,194.52 | 75.09 | 5.4812 |
| 02/01 | 100,013.70 | 13.70 | 547,942.18 | 75.07 | 5.4756 |

**Problema**: 
- ❌ Não mostra quanto da variação é juros vs câmbio
- ❌ Não mostra taxa original do contrato
- ❌ Impossível calcular ganho/perda cambial

---

### ✅ DEPOIS (Versão Corrigida)

**Solução**: Duas colunas BRL (taxa fixa do contrato vs PTAX diária)

| Data | Saldo USD | Juros USD | Saldo BRL (Contrato) | Saldo BRL (PTAX) | Taxa Contrato | Taxa PTAX | Var. BRL | Var. % |
|------|-----------|-----------|----------------------|------------------|---------------|-----------|----------|--------|
| 01/01 | 100,000.00 | 13.70 | 545,000.00 | 545,000.00 | 5.4500 | 5.4500 | 0.00 | 0.00% |
| 02/01 | 100,013.70 | 13.70 | 545,074.67 | 548,194.52 | 5.4500 | 5.4812 | +3,119.85 | +0.57% |
| 03/01 | 100,027.40 | 13.71 | 545,149.34 | 547,942.18 | 5.4500 | 5.4756 | +2,792.84 | +0.47% |

**Benefícios**:
- ✅ Separa juros de variação cambial
- ✅ Mostra taxa original do contrato (baseline)
- ✅ Mostra taxa PTAX diária (mark-to-market)
- ✅ Calcula ganho/perda cambial diária
- ✅ Permite análise de risco cambial
- ✅ Atende requisitos contábeis (IAS 21, CPC 02)

---

## �� Conceitos Financeiros

### Mark-to-Market (MTM)

**Definição**: Valorização de um ativo/passivo usando o **preço de mercado atual** (não o preço histórico).

**Exemplo**:
- Contrato de USD 100,000 criado em 01/01 com PTAX 5.4500
- **Valor Contábil Histórico**: R$ 545,000 (taxa fixa)
- **Valor Mark-to-Market em 02/01**: R$ 548,195 (PTAX do dia 5.4812)
- **Ganho não realizado**: R$ 3,195

### Variação Cambial (FX Variation)

**Definição**: Mudança no valor de um ativo/passivo em moeda estrangeira devido a alterações na taxa de câmbio.

**Cálculo**:
```
Variação Cambial = Saldo em Moeda Origem × (PTAX Hoje - Taxa Contrato)

Exemplo:
= USD 100,000 × (5.4812 - 5.4500)
= USD 100,000 × 0.0312
= R$ 3,120
```

### Hedge Cambial

**Definição**: Proteção contra risco de variação cambial usando instrumentos financeiros derivativos.

**Exemplo**:
```
Exposição: USD 100,000 (R$ 548,195 em PTAX atual)
Hedge: Venda de USD 100,000 no mercado futuro a 5.48 para 30 dias
Resultado: Travou a taxa em 5.48, eliminando risco de variação
```

---

## ✅ Conclusão

A correção implementada permite:

1. ✅ **Visibilidade Total**: Vê exatamente quanto cada componente contribui
2. ✅ **Gestão de Risco**: Identifica exposição cambial em tempo real
3. ✅ **Conformidade**: Atende normas contábeis (IAS 21, CPC 02)
4. ✅ **Análise**: Separa juros de ganho/perda cambial
5. ✅ **Decisões**: Baseia decisões de hedge em dados concretos

O ACCRUAL agora é uma **ferramenta completa** para gestão de contratos multi-moeda! 🎉

---

**Versão**: 2.0.1  
**Data**: 2025-01-05  
**Status**: ✅ **PRODUÇÃO**
