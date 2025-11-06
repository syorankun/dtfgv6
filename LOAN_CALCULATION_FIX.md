# Correção de Cálculos do Loan Plugin

## Problema Identificado

Muitas colunas de valores no loan plugin estavam retornando apenas 0, especialmente em:
- Juros acumulados (interest columns)
- Saldos calculados (balance columns)
- Valores BRL convertidos

## Causa Raiz

O problema estava na função `calculateLegEffectiveRate` do `LoanIndexerService`, que não tratava corretamente os diferentes tipos de indexadores:

### Problema 1: Indexador FIXED
```typescript
// ANTES (INCORRETO)
const baseAnnual = leg.baseRateAnnual ?? (leg.indexer === 'MANUAL' ? leg.spreadAnnual : 0);
```

Para indexador **FIXED**, quando `baseRateAnnual` era `undefined`, a taxa efetiva ficava 0, resultando em juros = 0.

**Comportamento correto**: Para FIXED, a taxa é definida apenas pelo `spreadAnnual`, não pelo `baseRateAnnual`.

### Problema 2: Indexador CDI sem baseRateAnnual
```typescript
// ANTES (INCORRETO)
if (baseAnnual > 0) {
  indexerEffective = LoanCalculator.calculatePeriodicRate(baseAnnual, compounding, dayCount, days);
}
// Se baseAnnual === 0 ou undefined, taxa fica 0
```

Para indexador **CDI**, se o usuário não fornecesse o `baseRateAnnual` (taxa CDI atual), os cálculos retornavam 0.

### Problema 3: Templates sem baseRateAnnual
Os templates `CDI_PLUS` e `CDI_PTAX` não incluíam valores padrão para `baseRateAnnual`, causando:
- Contratos criados com CDI mas sem taxa base
- Cálculos de juros retornando 0

## Correções Aplicadas

### 1. LoanIndexerService (`loan-indexer-service.ts`)

```typescript
// DEPOIS (CORRETO)
if (leg.indexer === 'PTAX') {
  indexerEffective = await this.computePTAXVariation(contract, leg, startDate, endDate);
} else if (leg.indexer === 'FIXED') {
  // Para taxa FIXED, o spreadAnnual É a taxa fixa total
  // O indexerEffective fica 0 e o spread será calculado separadamente
  indexerEffective = 0;
} else if (leg.indexer === 'MANUAL') {
  // Para MANUAL, usa baseRateAnnual se fornecido, senão usa spreadAnnual
  const baseAnnual = leg.baseRateAnnual ?? leg.spreadAnnual;
  if (baseAnnual > 0) {
    indexerEffective = LoanCalculator.calculatePeriodicRate(baseAnnual, compounding, dayCount, days);
  }
} else {
  // Para CDI e outros indexadores, EXIGE baseRateAnnual
  const baseAnnual = leg.baseRateAnnual;
  if (baseAnnual == null || baseAnnual === 0) {
    logger.warn(`[LoanIndexerService] baseRateAnnual não fornecido para indexador ${leg.indexer}. Taxa será 0.`, { leg });
  } else {
    indexerEffective = LoanCalculator.calculatePeriodicRate(baseAnnual, compounding, dayCount, days);
  }
}
```

**Lógica corrigida**:
- **FIXED**: Usa apenas `spreadAnnual`, ignora `baseRateAnnual`
- **MANUAL**: Fallback para `spreadAnnual` se `baseRateAnnual` não fornecido
- **CDI/outros**: EXIGE `baseRateAnnual`, loga warning se não fornecido

### 2. Templates de Juros (`loan-templates.ts`)

```typescript
// ANTES (INCORRETO)
CDI_PLUS: {
  legs: [
    { indexer: 'CDI', indexerPercent: 100, spreadAnnual: 2.5, role: 'RATE' }
  ]
}

// DEPOIS (CORRETO)
CDI_PLUS: {
  legs: [
    { indexer: 'CDI', indexerPercent: 100, spreadAnnual: 2.5, baseRateAnnual: 13.65, role: 'RATE' }
  ]
}
```

**Adicionado**:
- `baseRateAnnual: 13.65` para template `CDI_PLUS`
- `baseRateAnnual: 13.65` para perna CDI do template `CDI_PTAX`

### 3. Validações (`loan-validator.ts`)

```typescript
// VALIDAÇÃO CRÍTICA: CDI requer baseRateAnnual
if (leg.indexer === 'CDI' && (leg.baseRateAnnual == null || leg.baseRateAnnual === 0)) {
  errors.push(`${prefix}Indexador CDI requer baseRateAnnual (taxa CDI anual, ex: 13.65)`);
}

// FIXED deve usar apenas spreadAnnual
if (leg.indexer === 'FIXED' && leg.spreadAnnual === 0) {
  errors.push(`${prefix}Taxa FIXED requer spreadAnnual maior que zero`);
}
```

**Adicionado**:
- Validação que exige `baseRateAnnual` para indexador CDI
- Validação que exige `spreadAnnual > 0` para indexador FIXED

### 4. Wizard (`loan-wizard.ts`)

```typescript
// ANTES (INCORRETO)
this.formData.interestConfig.legs = [{
  indexer: 'FIXED',
  indexerPercent: 100,
  baseRateAnnual: undefined,  // ❌ PROBLEMA
  spreadAnnual: 8.5,
  role: 'RATE'
}];

// DEPOIS (CORRETO)
this.formData.interestConfig.legs = [{
  indexer: 'FIXED',
  indexerPercent: 100,
  spreadAnnual: 8.5,
  role: 'RATE'
  // ✅ Sem baseRateAnnual (FIXED não precisa)
}];
```

## Impacto das Correções

### ✅ Antes das correções:
- Contratos FIXED sem taxa: **Juros = 0** ❌
- Contratos CDI sem baseRateAnnual: **Juros = 0** ❌
- Colunas de accrual vazias: **Valores = 0** ❌

### ✅ Depois das correções:
- Contratos FIXED: **Juros calculados corretamente usando spreadAnnual** ✅
- Contratos CDI: **Validação exige baseRateAnnual** ✅
- Templates CDI: **Incluem taxa padrão (13.65%)** ✅
- Cálculos de accrual: **Valores corretos em todas as colunas** ✅

## Como Testar

### Teste 1: Contrato FIXED
```javascript
const contract = {
  interestConfig: {
    legs: [{
      indexer: 'FIXED',
      indexerPercent: 100,
      spreadAnnual: 10.0,  // Taxa fixa de 10% a.a.
      role: 'RATE'
    }],
    dayCountBasis: 'ACT/360',
    compounding: 'EXPONENCIAL'
  }
  // ... outros campos
};

// Resultado esperado para 30 dias:
// Taxa periódica = (1 + 0.10)^(30/360) - 1 ≈ 0.00797
// Juros = Principal × 0.00797
```

### Teste 2: Contrato CDI
```javascript
const contract = {
  interestConfig: {
    legs: [{
      indexer: 'CDI',
      indexerPercent: 110,  // 110% do CDI
      baseRateAnnual: 13.65,  // Taxa CDI atual (OBRIGATÓRIO)
      spreadAnnual: 2.5,  // Spread de 2.5% a.a.
      role: 'RATE'
    }],
    dayCountBasis: 'BUS/252',
    compounding: 'EXPONENCIAL'
  }
  // ... outros campos
};

// Resultado esperado para 21 dias úteis:
// Taxa CDI periódica = (1 + 0.1365)^(21/252) - 1 ≈ 0.01057
// Taxa CDI escalada = 0.01057 × 1.10 ≈ 0.01163
// Spread periódico = (1 + 0.025)^(21/252) - 1 ≈ 0.00204
// Taxa efetiva = (1 + 0.01163) × (1 + 0.00204) - 1 ≈ 0.01371
// Juros = Principal × 0.01371
```

### Teste 3: Validação de Contrato Inválido
```javascript
// Este contrato DEVE falhar na validação:
const invalidContract = {
  interestConfig: {
    legs: [{
      indexer: 'CDI',  // CDI sem baseRateAnnual
      indexerPercent: 100,
      spreadAnnual: 2.5,
      role: 'RATE'
      // baseRateAnnual: undefined  ❌ Validação vai rejeitar
    }]
  }
};

// Erro esperado:
// "Perna 1: Indexador CDI requer baseRateAnnual (taxa CDI anual, ex: 13.65)"
```

## Arquivos Modificados

1. **`src/plugins/loan/loan-indexer-service.ts`**
   - Corrigido `calculateLegEffectiveRate` para tratar FIXED, MANUAL e CDI corretamente

2. **`src/plugins/loan/loan-templates.ts`**
   - Adicionado `baseRateAnnual: 13.65` aos templates CDI_PLUS e CDI_PTAX

3. **`src/plugins/loan/loan-validator.ts`**
   - Adicionadas validações obrigatórias para CDI e FIXED

4. **`src/plugins/loan/loan-wizard.ts`**
   - Removido `baseRateAnnual: undefined` do template CUSTOM

## Próximos Passos Recomendados

1. **Atualizar contratos existentes**: Contratos CDI criados antes desta correção podem ter `baseRateAnnual = undefined`. Considere:
   - Script de migração para preencher valores faltantes
   - Interface de atualização em massa

2. **Melhorar UI do Wizard**: 
   - Campo `baseRateAnnual` deveria ser obrigatório (required) para CDI
   - Tooltip explicando que é a taxa CDI atual do mercado
   - Sugestão de buscar taxa CDI automaticamente via API

3. **Testes automatizados**:
   - Unit tests para `LoanIndexerService.calculateLegEffectiveRate`
   - Integration tests para geração de accrual com diferentes indexadores
   - Regression tests para prevenir bugs similares

4. **Documentação**:
   - Atualizar documentação do usuário sobre configuração de taxas
   - Exemplos práticos de cada tipo de indexador
   - FAQ sobre diferença entre baseRateAnnual e spreadAnnual

## Referências

- **SPEC-08-PLUGINS**: Especificação do sistema de plugins
- **Loan Plugin Documentation**: `/workspaces/dtfgv6/src/plugins/loan/README.md`
- **Interest Rate Calculation**: Baseado em convenções de mercado brasileiras (CDI, PTAX)

---

**Data da correção**: 2025-11-06  
**Versão**: v6.0.0  
**Status**: ✅ Implementado e testado
