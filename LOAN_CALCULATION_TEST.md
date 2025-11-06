# Teste Prático: Verificação de Cálculos do Loan Plugin

Este documento fornece um guia passo a passo para testar as correções de cálculo do loan plugin.

## Cenário 1: Empréstimo com Taxa FIXED

### Dados de Entrada
- **Principal**: USD 100,000.00
- **Taxa**: 10% ao ano (FIXED)
- **Período**: 30 dias
- **Convenção**: ACT/360
- **Capitalização**: EXPONENCIAL
- **Taxa FX (contrato)**: 5.50 BRL/USD

### Cálculo Esperado

**1. Conversão do Principal para BRL:**
```
Principal BRL = 100,000 × 5.50 = R$ 550,000.00
```

**2. Taxa Periódica (30 dias):**
```
Taxa anual = 10% = 0.10
Taxa periódica = (1 + 0.10)^(30/360) - 1
Taxa periódica = (1.10)^0.08333 - 1
Taxa periódica ≈ 0.007974 (0.7974%)
```

**3. Juros do Período:**
```
Juros (USD) = 100,000 × 0.007974 = USD 797.40
Juros (BRL) = 797.40 × 5.50 = R$ 4,385.70
```

**4. Saldo Final:**
```
Saldo Final (USD) = 100,000 + 797.40 = USD 100,797.40
Saldo Final (BRL) = 100,797.40 × 5.50 = R$ 554,385.70
```

### Como Verificar no Sistema

1. Abra o DJ DataForge v6
2. Vá em **Loan Plugin** → **Criar Contrato**
3. Preencha:
   - ID: LOAN-TEST-001
   - Tipo: CAPTADO
   - Contraparte: Banco Teste
   - Moeda: USD
   - Principal: 100000
   - Data Início: 2025-01-01
   - Data Vencimento: 2025-12-31
   - Template Juros: **Taxa Fixa**
   - Taxa Fixa (spreadAnnual): **10.0**
   - Taxa FX: 5.50
4. Clique em **Criar Contrato**
5. Gere o **Accrual Report** para período: 2025-01-01 a 2025-01-31
6. Verifique a primeira linha:
   - ✅ `interestOrigin` ≈ 797.40
   - ✅ `interestBRLContract` ≈ 4,385.70
   - ✅ `closingBalanceOrigin` ≈ 100,797.40
   - ✅ `closingBalanceBRLContract` ≈ 554,385.70

---

## Cenário 2: Empréstimo com CDI + Spread

### Dados de Entrada
- **Principal**: BRL 500,000.00
- **Indexador**: 110% do CDI
- **Taxa CDI**: 13.65% ao ano
- **Spread**: 2.5% ao ano
- **Período**: 21 dias úteis
- **Convenção**: BUS/252
- **Capitalização**: EXPONENCIAL

### Cálculo Esperado

**1. Taxa CDI Periódica (21 dias úteis):**
```
Taxa CDI anual = 13.65% = 0.1365
Taxa CDI periódica = (1 + 0.1365)^(21/252) - 1
Taxa CDI periódica ≈ 0.010568 (1.0568%)
```

**2. Taxa CDI Escalada (110%):**
```
Taxa escalada = 0.010568 × 1.10 = 0.011625 (1.1625%)
```

**3. Taxa Spread Periódica:**
```
Spread anual = 2.5% = 0.025
Taxa spread periódica = (1 + 0.025)^(21/252) - 1
Taxa spread periódica ≈ 0.002043 (0.2043%)
```

**4. Taxa Efetiva Composta:**
```
Taxa efetiva = (1 + 0.011625) × (1 + 0.002043) - 1
Taxa efetiva = 1.011625 × 1.002043 - 1
Taxa efetiva ≈ 0.013692 (1.3692%)
```

**5. Juros do Período:**
```
Juros = 500,000 × 0.013692 = R$ 6,846.00
```

**6. Saldo Final:**
```
Saldo Final = 500,000 + 6,846 = R$ 506,846.00
```

### Como Verificar no Sistema

1. Abra o DJ DataForge v6
2. Vá em **Loan Plugin** → **Criar Contrato**
3. Preencha:
   - ID: LOAN-TEST-002
   - Tipo: CAPTADO
   - Contraparte: Banco CDI
   - Moeda: BRL
   - Principal: 500000
   - Data Início: 2025-01-02 (quinta-feira)
   - Data Vencimento: 2025-12-31
   - Template Juros: **CDI + Spread**
   - Taxa CDI (baseRateAnnual): **13.65**
   - Percentual CDI: **110**
   - Spread: **2.5**
4. Clique em **Criar Contrato**
5. Gere o **Accrual Report** para período: 2025-01-02 a 2025-01-31
6. Verifique a primeira linha (21 dias úteis):
   - ✅ `effRate` ≈ 0.0137 (1.37%)
   - ✅ `interestBRLPTAX` ≈ 6,846.00
   - ✅ `closingBalanceBRLPTAX` ≈ 506,846.00

---

## Cenário 3: Empréstimo com PTAX + Spread

### Dados de Entrada
- **Principal**: USD 50,000.00
- **Indexador**: Variação PTAX
- **Spread**: 3.0% ao ano
- **Período**: 30 dias
- **Convenção**: ACT/365
- **Capitalização**: EXPONENCIAL
- **Taxa FX inicial**: 5.50 BRL/USD
- **Taxa FX final**: 5.65 BRL/USD

### Cálculo Esperado

**1. Variação PTAX:**
```
Variação = (5.65 / 5.50) - 1 = 0.027273 (2.7273%)
```

**2. Taxa Spread Periódica:**
```
Spread anual = 3.0% = 0.03
Taxa spread periódica = (1 + 0.03)^(30/365) - 1
Taxa spread periódica ≈ 0.002433 (0.2433%)
```

**3. Taxa Efetiva Composta:**
```
Taxa efetiva = (1 + 0.027273) × (1 + 0.002433) - 1
Taxa efetiva = 1.027273 × 1.002433 - 1
Taxa efetiva ≈ 0.029773 (2.9773%)
```

**4. Juros do Período (USD):**
```
Juros (USD) = 50,000 × 0.029773 = USD 1,488.65
```

**5. Conversão para BRL (taxa final):**
```
Juros (BRL) = 1,488.65 × 5.65 = R$ 8,410.87
```

**6. Saldo Final:**
```
Saldo Final (USD) = 50,000 + 1,488.65 = USD 51,488.65
Saldo Final (BRL, PTAX) = 51,488.65 × 5.65 = R$ 290,910.87
```

### Como Verificar no Sistema

1. Abra o DJ DataForge v6
2. Vá em **Loan Plugin** → **Criar Contrato**
3. Preencha:
   - ID: LOAN-TEST-003
   - Tipo: CAPTADO
   - Contraparte: Banco Internacional
   - Moeda: USD
   - Principal: 50000
   - Data Início: 2025-01-01
   - Data Vencimento: 2025-12-31
   - Template Juros: **Variação PTAX + Spread**
   - Moeda PTAX: USD
   - Spread: **3.0**
   - Taxa FX contrato: 5.50
4. Clique em **Criar Contrato**
5. **IMPORTANTE**: Certifique-se de que a taxa PTAX para USD em 31/01/2025 está cadastrada (ex: 5.65)
6. Gere o **Accrual Report** para período: 2025-01-01 a 2025-01-31
7. Verifique:
   - ✅ `fxRateContract` = 5.50
   - ✅ `fxRatePTAX` ≈ 5.65
   - ✅ `fxVariationPercent` ≈ 2.73%
   - ✅ `interestOrigin` ≈ 1,488.65
   - ✅ `interestBRLPTAX` ≈ 8,410.87
   - ✅ `closingBalanceBRLPTAX` ≈ 290,910.87

---

## Checklist de Validação

Use este checklist para garantir que as correções estão funcionando:

### ✅ Validações de Entrada

- [ ] Criar contrato FIXED **sem** `baseRateAnnual` → deve funcionar
- [ ] Criar contrato CDI **sem** `baseRateAnnual` → deve FALHAR na validação
- [ ] Criar contrato CDI **com** `baseRateAnnual = 0` → deve FALHAR na validação
- [ ] Criar contrato FIXED **com** `spreadAnnual = 0` → deve FALHAR na validação

### ✅ Cálculos de Accrual

- [ ] Accrual FIXED: coluna `interestOrigin` > 0
- [ ] Accrual FIXED: coluna `interestBRLContract` > 0
- [ ] Accrual CDI: coluna `effRate` > 0
- [ ] Accrual CDI: coluna `interestBRLPTAX` > 0
- [ ] Accrual PTAX: coluna `fxVariationBRL` != 0 (se houve variação)
- [ ] Accrual PTAX: coluna `fxVariationPercent` != 0 (se houve variação)

### ✅ Totalizadores (Summary Row)

- [ ] Soma de `interestOrigin` > 0
- [ ] Soma de `interestBRLContract` > 0
- [ ] Soma de `interestBRLPTAX` > 0
- [ ] Último valor de `closingBalanceOrigin` > `openingBalanceOrigin` (primeira linha)
- [ ] Último valor de `accruedInterestOrigin` = soma de todos os juros

### ✅ Conversões BRL

- [ ] `openingBalanceBRLContract` = `openingBalanceOrigin` × `fxRateContract`
- [ ] `openingBalanceBRLPTAX` = `openingBalanceOrigin` × `fxRatePTAX`
- [ ] `fxVariationBRL` = diferença entre PTAX e Contrato
- [ ] `fxVariationPercent` = `((fxRatePTAX - fxRateContract) / fxRateContract) × 100`

---

## Troubleshooting

### Problema: Ainda vejo valores 0 nas colunas

**Possíveis causas:**

1. **Contrato criado antes da correção**
   - Solução: Recriar o contrato ou editar manualmente para adicionar `baseRateAnnual`

2. **Taxa CDI não configurada**
   - Solução: No wizard, preencher o campo "Taxa Base Anual" com a taxa CDI atual (ex: 13.65)

3. **Cache do navegador**
   - Solução: Pressione Ctrl+Shift+R para hard refresh

4. **Plugin não foi recarregado**
   - Solução: Feche e reabra o DJ DataForge, ou pressione F5

### Problema: Validação rejeitando contratos válidos

**Possíveis causas:**

1. **Indexador CDI sem baseRateAnnual**
   - Solução: Preencher o campo "Taxa CDI Atual" no wizard

2. **Indexador FIXED com spreadAnnual = 0**
   - Solução: Preencher uma taxa maior que 0

### Problema: Cálculos divergentes dos esperados

**Possíveis causas:**

1. **Convenção de dias incorreta**
   - Verificar se está usando ACT/360, ACT/365 ou BUS/252 corretamente

2. **Capitalização incorreta**
   - Verificar se está usando EXPONENCIAL ou LINEAR

3. **Taxas FX não atualizadas**
   - Verificar se as taxas PTAX do BCB estão sincronizadas

---

## Console Debug

Para debug avançado, abra o Console do navegador (F12) e execute:

```javascript
// Ver configuração de um contrato
const contracts = await kernel.pluginHost.getPlugin('loan-plugin').getAllContracts();
console.log('Contratos:', contracts);

// Ver taxas FX disponíveis
const fxPlugin = kernel.pluginHost.getPlugin('fx-finance');
const rate = await fxPlugin.getRate('USD', '2025-01-31');
console.log('Taxa USD:', rate);

// Ver logs do LoanIndexerService
// (Logs aparecem automaticamente no console com prefix [LoanIndexerService])
```

---

## Conclusão

Após aplicar estas correções, todos os cálculos devem retornar valores consistentes e corretos. Se ainda encontrar problemas:

1. Verifique os logs do console (F12)
2. Confirme que os dados de entrada estão corretos
3. Teste com os cenários documentados acima
4. Consulte o documento `LOAN_CALCULATION_FIX.md` para detalhes técnicos

**Status das Correções**: ✅ Implementado  
**Última Atualização**: 2025-11-06  
**Versão**: v6.0.0
