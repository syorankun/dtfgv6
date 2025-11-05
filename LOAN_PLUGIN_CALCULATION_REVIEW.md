# Revisão e Guia: Cálculos do Loan Plugin (ênfase em contratos não-BRL)

Data: 2025-11-04

Resumo rápido
------------
Este documento resume uma análise técnica dos cálculos usados pelo `Loan Plugin` para: conversão de moeda (FX), geração de cronogramas (ACCRUAL / SCHEDULE), cálculo de juros e aplicação de pagamentos. O foco principal foi em contratos denominados em moedas distintas de BRL.

Principais achados
------------------
1. Cálculo do índice efetivo (bug crítico)
   - Onde: `src/plugins/loan/loan-scheduler.ts` -> `calculateEffectiveRate` e geração de periodicRate.
   - Problema: O código usa apenas `leg.spreadAnnual` como taxa-base ao calcular a taxa periódica. Ele ignora o indexador (`leg.indexer`) — ex.: CDI ou PTAX — que representa a parte de referência (índice) da taxa. Como resultado, contratos que deveriam aplicar 100% do CDI + spread acabam usando somente o spread (ex.: 2.5% a.a.), produzindo juros muito baixos ou incorretos.

2. Conversões FX e uso de taxas (inconsistências)
   - Onde: `src/plugins/loan/loan-payment-manager.ts` e `src/plugins/loan/loan-fx-integration.ts`.
   - Problema A (pagamentos em BRL contra contratos não-BRL): quando o pagamento é feito em BRL, o código atribui `amountBRL = amount` e `amountOrigin = amount / fxRateInfo.rate`. Para `paymentCurrency === 'BRL'`, `fxRateInfo.rate` retornado é `1`, resultando em `amountOrigin === amount`. Isso é incorreto para contratos denominados em USD/EUR, porque o montante origin deveria ser convertido pelo câmbio do contrato (ex.: USD/BRL) — e não pelo câmbio do pagamento (BRL/BRL).
   - Problema B (conversões cruzadas): o fluxo cross-conversion converte `payment -> BRL` com a taxa do pagamento e depois converte `BRL -> contract.currency` dividindo por `contractFXInfo.rate`. Isso funciona se as taxas forem sempre BRL-per-unidade (padrão aqui). Confirmar semântica do FX Plugin.
   - Problema C (uso de taxas para snapshots): `calculateAmortization` converte o novo saldo para moeda de origem usando `getLastAvailableRate(contract.currency)` — que usa a taxa "mais recente" em vez da taxa do dia do evento (ex.: paymentDate). Isso pode causar discrepância entre o ledger/registro histórico (que grava `payment.fxRate`) e o snapshot de saldo em origem.

3. Convenções de contagem de dias (day count)
   - Onde: `src/plugins/loan/loan-calculator.ts` -> `getDaysBetween` e `getYearlyDivisor`.
   - Observações:
     - `ACT/360` e `ACT/365` usam `Math.ceil(diffTime / day)`. O uso de `ceil` tende a contar um dia extra em períodos exatos; normalmente se usa `Math.round` ou `Math.floor` dependendo da convenção (ou simplesmente `diffDays = (end - start) / MS_PER_DAY` sem ceiling). Recomendo validar com o padrão de mercado desejado (INTERNACIONAL: ACT/365 pode ser exato; ACT/360 costuma ser dias exatos).
     - `30/360` implementado de forma simplificada sem suportar variações (30/360 US vs EUR vs ISDA). É necessário especificar qual variante adotar.
     - `BUS/252` é uma aproximação (conta dias úteis, mas não considera feriados por calendário). Isso pode estar OK para estimativas, mas para provisionamento contábil precisa de calendário de feriados corporativo/regulatório.

4. Arredondamentos e precisão
   - Onde: `LoanCalculator.round` e uso disperso de casas decimais (interestOrigin -> 4 casas, interestBRL -> 2 casas, saldos -> 2 casas).
   - Observações: Precisão de 2 casas para BRL é padrão comercial, mas cálculos intermediários em origem (USD/EUR) podem exigir maior precisão e regras de arredondamento (HALF_UP vs HALF_EVEN). Além disso, decisões sobre quando aplicar arredondamento (intermediário vs final) devem ser documentadas.

5. Combinação de pernas ADJUSTMENT
   - Onde: `calculateEffectiveRate` usa lógica:
     - para `RATE`: totalRate += adjustedRate
     - para `ADJUSTMENT`: totalRate *= (1 + adjustedRate); totalRate -= 1
   - Observação: A fórmula é estranha, principalmente porque `totalRate` inicia em 0. Isso produz resultados inesperados quando `ADJUSTMENT` aparece na primeira perna (o multiplicador em 0 produzirá -1 depois da subtração). A intenção matemática precisa ser clarificada (multiplicativa vs aditiva). Normalmente, perna `ADJUSTMENT` representa uma multiplicação sobre a taxa agregada ou um termo de ajuste aplicado sobre um indexador pré-calculado — precisa de definição clara.

Recomendações e plano de ação (detalhado)
-----------------------------------------
Abaixo estão recomendações concretas, ordenadas por criticidade e com trechos de código sugeridos.

1) Corrigir inclusão do indexador nas pernas (Alta prioridade)
   - Objetivo: quando `indexer` é `CDI`/`PTAX`/`MANUAL`, obter a taxa base do indexador para o período e combiná-la com o `spreadAnnual` e `indexerPercent`.
   - Implementação sugerida (pseudocódigo):
     - Adicionar um método no `LoanFXIntegration` (ou novo serviço) para obter taxas de indexadores (ex.: getIndexerRate(date, indexer, currency?)) — para PTAX use o FX Plugin, para CDI precisar de fonte (ou tabela histórica de CDI).
     - Em `calculateEffectiveRate`, para cada perna:
       - const baseAnnual = await getIndexerAnnualRate(leg, date)  // ex: CDI anual em %
       - const legAnnual = baseAnnual * (leg.indexerPercent / 100) + leg.spreadAnnual
       - const legPeriodic = LoanCalculator.calculatePeriodicRate(legAnnual, compounding, dayCountBasis, days)
       - if (leg.role === 'RATE') totalRate += legPeriodic
       - else if (leg.role === 'ADJUSTMENT') apply ajuste (ex.: multiplicativo sobre totalRate)

   - Nota: se `indexer === 'FIXED'`, `baseAnnual` é 0 e `spreadAnnual` contém a taxa fixa.

2) Corrigir conversão de pagamentos em BRL (Alta prioridade)
   - Problema atual: `paymentCurrency === 'BRL'` usa `fxRateInfo.rate` do BRL (==1) para calcular `amountOrigin`.
   - Correção sugerida no método `registerPayment` de `LoanPaymentManager`:
     - Se pagamento em BRL e contrato não é BRL, obter a taxa do contrato naquele `paymentDate` para converter BRL -> origin:
       ```ts
       if (paymentCurrency === 'BRL') {
         amountBRL = amount;
         if (contract.currency !== 'BRL') {
           const contractRate = await this.fxIntegration.getConversionRate(paymentDate, contract.currency);
           if (!contractRate) throw new Error(...);
           amountOrigin = amount / contractRate.rate; // BRL -> origin
         } else {
           amountOrigin = amount;
         }
       }
       ```
   - Isso garante coerência entre os montantes origin e BRL.

3) Usar taxas do dia apropriadas ao reconverter saldos (Média/Alta)
   - Em `calculateAmortization`, o balanço origin é convertido usando `getLastAvailableRate`. Recomendo usar a taxa do `currentDate` (ou a taxa mais apropriada apurada para a data do evento) para consistência histórica:
     - `const fxRateInfo = await this.fxIntegration.getConversionRate(currentDate, contract.currency, contract.contractFXRate)`
   - Caso a taxa para a data não exista, então fallback para `getLastAvailableRate` e registrar claramente no ledger que foi usado fallback.

4) Revisar day count e convenções (Média)
   - Padronizar o tratamento de ACT/360 e ACT/365 sem `Math.ceil` (usar `Math.round` ou truncar conforme regra desejada). Documentar a regra.
   - Implementar variantes de 30/360 (ex.: 30/360 US, 30E/360) se necessário.
   - Para `BUS/252`, adicionar integração com calendário de feriados (opcional) ou documentar que é uma aproximação baseada apenas em dias úteis.

5) Roteiro de arredondamento e precisão (Média)
   - Definir política de arredondamento por moeda e por etapa do cálculo:
     - Operações intermédiarias: usar 4-6 casas (ou double precision) e arredondar só no final para BRL (2 casas) e para origin (2 casas, se aplicável).
     - Suportar `interestConfig.rounding` (HALF_UP/HALF_EVEN) no `LoanCalculator.round`.

6) Clarificar e corrigir lógica de `ADJUSTMENT` (Média)
   - Revisar a definição matemática pretendida para perna `ADJUSTMENT`. Sugestão: se for um multiplicador, aplicar sobre soma dos `RATE` já calculados; se for um adicional multiplicativo de indexer, calcular adequadamente.

7) Testes e validação (Alta prioridade)
   - Criar testes unitários para cada fluxo:
     - Contratos BRL e não-BRL (USD) com pagamento na moeda do contrato.
     - Pagamentos em BRL sobre contrato USD (converter corretamente e verificar ledger e saldo origin).
     - Contratos com indexer PTAX/CDI e combinações (CDI+PTAX)
     - Comparar cronogramas PRICE e SAC vs calculadora de referência (Excel/Calc ou benchmark known-good)
   - Criar fixtures com taxas FX históricas conhecidas e CDI/indices (pode ser mockado via FX Plugin API de teste).

Trechos de código sugeridos (correções rápidas)
-----------------------------------------------
1) `LoanPaymentManager.registerPayment` — corrigir branch BRL:

```ts
if (paymentCurrency === 'BRL') {
  amountBRL = amount;
  if (contract.currency !== 'BRL') {
    const contractFXInfo = await this.fxIntegration.getConversionRate(paymentDate, contract.currency);
    if (!contractFXInfo) throw new Error(`Taxa de câmbio não disponível para ${contract.currency} em ${paymentDate}`);
    amountOrigin = amount / contractFXInfo.rate; // BRL -> origin
  } else {
    amountOrigin = amount;
  }
}
```

2) `LoanScheduler.calculateEffectiveRate` — exemplo de esqueleto para incluir indexadores:

```ts
private async calculateEffectiveRate(contract: LoanContract, startDate: string, endDate: string, days: number): Promise<number> {
  const { interestConfig } = contract;
  let totalRate = 0;

  for (const leg of interestConfig.legs) {
    let baseAnnual = 0; // em %

    switch (leg.indexer) {
      case 'FIXED':
        baseAnnual = 0; // fixed reflected in spreadAnnual
        break;
      case 'PTAX': {
        const fxInfo = await this.fxIntegration.getConversionRate(endDate, leg.ptaxCurrency || contract.currency);
        if (!fxInfo) throw new Error('PTAX não disponível para perna');
        // Transformar variação cambial em taxa anual esperada — depende do que leg.indexerPercent representa.
        // Se indexer for variação (% a.a.) a partir de series, precisamos da taxa anual equivalente.
        baseAnnual = /* obter a taxa anual do indexador (ex: variação histórica anualizada) */ 0;
        break;
      }
      case 'CDI': {
        baseAnnual = await this.getCDIAnnualRate(startDate, endDate); // implementar fonte
        break;
      }
      case 'MANUAL': {
        baseAnnual = leg.spreadAnnual; // se manual contiver o valor completo
        break;
      }
    }

    const legAnnual = baseAnnual * (leg.indexerPercent / 100) + leg.spreadAnnual;
    const legPeriodic = LoanCalculator.calculatePeriodicRate(legAnnual, interestConfig.compounding, leg.dayCountBasis || interestConfig.dayCountBasis, days);

    if (leg.role === 'RATE') totalRate += legPeriodic;
    else totalRate = (1 + totalRate) * (1 + legPeriodic) - 1; // exemplo multiplicativo
  }

  return totalRate;
}
```

Observações: para CDI/PTAX é necessário prover **fonte** (serviço) de taxas. O `LoanFXIntegration` cobre PTAX via FX Plugin mas *não* fornece CDI — será preciso integrar uma fonte de índices (ou permitir entrada manual/planilha de índices no plugin).

Plano de testes recomendado
--------------------------
1. Unit tests:
   - Testes para `LoanCalculator.calculatePeriodicRate` com ACT/360, ACT/365, 30/360 e BUS/252.
   - Testes para `calculatePMT`, `calculateIPMT`, `calculatePPMT` comparando com Excel / bibliotecas financeiras.
   - Testes para `LoanPaymentManager.registerPayment` com: (a) paymentCurrency == contract.currency, (b) paymentCurrency == BRL contra contrato USD, (c) cross-currency.

2. Integração:
   - Mockar `FX Plugin` com taxas históricas; criar contrato em USD com contractFXRate fixo e com PTAX; aplicar pagamentos e comparar ledger + snapshots.

Instruções de verificação manual (rápido)
----------------------------------------
1. Build da aplicação:

```bash
npm run build
# ou em dev
npm run dev
```

2. Cenário teste Rápido:
   - Criar contrato em USD: principalOrigin = 1000 USD, startDate = 2025-01-01, contractFXRate = 5.00 (PTAX fixa) -> principalBRL esperado: 5.000 BRL * 1000 = 5000 BRL.
   - Gerar accrual mensal de 1 mês com taxa FIXED 12% a.a. -> periodicRate ~ 1% (dependendo dayCount) -> interestOrigin ~ 10 USD; interestBRL ~ 50 BRL.
   - Registrar pagamento em BRL de 50 BRL: o `amountOrigin` deve ser 10 USD (50 / 5.0). Verificar ledger e snapshots.

Checklist final / entregáveis
-----------------------------
- [x] Análise de arquivos principais (FX, scheduler, calculator, payment manager)
- [x] Identificação de bugs críticos (indexer ignorado; conversão BRL inválida)
- [x] Recomendações e trechos de código para correção
- [x] Plano de testes e verificação manual

Próximos passos sugeridos (opções)
----------------------------------
A. Implementar correções críticas (pagamentos BRL e inclusão de indexer) e adicionar testes automatizados — eu posso aplicar essas correções e abrir um PR.
B. Adicionar suporte a índice CDI (fonte de dados) e calendário de feriados para BUS/252 (work item maior).

Se quiser, implemento as correções de prioridade alta agora (A). Caso queira seguir você mesmo, posso gerar patches prontos com diffs propostos.

---

Se quiser que eu gere um patch automático (PR) com as correções de alta prioridade (corrigir `registerPayment` e alterar `calculateEffectiveRate` para considerar indexer básico), responda com "Aplique correções críticas" e eu sigo implementando e rodando build/tests.
