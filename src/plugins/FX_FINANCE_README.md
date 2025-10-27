# FX & Finance Plugin

Plugin para captura de taxas de câmbio e índices econômicos com fórmulas financeiras avançadas.

**Versão:** 1.0.0 (Fase 1)
**Autor:** DJ DataForge
**Status:** ✅ Código criado - Aguardando validação

---

## 📋 Visão Geral

O plugin **FX & Finance** transforma o DJ DataForge em uma ferramenta completa para análise cambial e cálculos financeiros, oferecendo:

- **Sincronização automática** de cotações PTAX do Banco Central do Brasil (BCB)
- **Gestão de taxas manuais** para dados customizados ou complementares
- **16 fórmulas especializadas** (8 FX + 6 FIN + equivalência de taxas)
- **Dashboard estático** com análises de 30 dias
- **API de capability** para integração com outros plugins
- **Persistência em sessão** para carregamento automático

---

## 🚀 Instalação

### 1. Registrar o Plugin no App

Edite o arquivo `src/app.ts` e adicione o import do plugin:

```typescript
import { FXFinancePlugin } from './plugins/fx-finance-plugin';
```

Dentro do método `loadBuiltInPlugins()`, adicione o carregamento:

```typescript
await kernel['pluginHost'].loadPlugin(
  { default: FXFinancePlugin },
  new FXFinancePlugin().manifest
);
```

**Exemplo completo:**

```typescript
private async loadBuiltInPlugins(): Promise<void> {
  try {
    // ... outros plugins ...

    await kernel['pluginHost'].loadPlugin(
      { default: FXFinancePlugin },
      new FXFinancePlugin().manifest
    );

    logger.info('Built-in plugins loaded successfully');
  } catch (error) {
    logger.error('Failed to load built-in plugins', error);
  }
}
```

### 2. Compilar e Executar

```bash
npm run type-check    # Verificar tipos TypeScript
npm run dev           # Iniciar servidor de desenvolvimento
```

Acesse `http://localhost:5173` e o plugin estará disponível nos menus.

---

## 📖 Funcionalidades (Fase 1)

### 🔄 Sincronização PTAX (API BCB)

**Menu:** `Sincronizar Cotações PTAX`

- **Fonte:** API OData do Banco Central do Brasil
- **Endpoint:** `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata`
- **Moedas suportadas:** USD, EUR, GBP, JPY, CHF, CAD, AUD, CNY

**Lógica crítica de fechamento:**
- O BCB emite múltiplos boletins por dia (abertura, intermediários, fechamento)
- O plugin **filtra automaticamente** para capturar apenas a cotação de **fechamento** (timestamp mais tardio do dia)
- **Validação anti-fraude:** ignora registros com taxas inválidas (≤ 0) para prevenir "taxas fantasmas"
- **Deduplicação:** evita inserir dados já existentes na planilha

**Planilha criada:** `_FX_PTAX_Rates`
**Colunas:** Data | Moeda | Taxa Compra (BRL) | Taxa Venda (BRL) | Timestamp

**Como usar:**
1. Clique em `Sincronizar Cotações PTAX`
2. Selecione o intervalo de datas (início/fim)
3. Marque as moedas desejadas (múltipla seleção)
4. Clique em `Sincronizar`

---

### ✏️ Taxas Manuais

**Menu:** `Adicionar Taxa Manual`

Permite inserir taxas personalizadas quando:
- A API do BCB está indisponível
- Você possui taxas de contratos específicos
- Deseja sobrescrever uma cotação oficial

**Planilha criada:** `_FX_Manual_Rates`
**Colunas:** Data | Moeda | Taxa Compra (BRL) | Taxa Venda (BRL) | Observações

**Prioridade:** Taxas manuais têm **prioridade sobre PTAX** quando ambas existem para a mesma data/moeda.

**Como usar:**
1. Clique em `Adicionar Taxa Manual`
2. Selecione data, moeda e taxa de venda
3. Opcionalmente, informe a taxa de compra (se vazia, usa a taxa de venda)
4. Clique em `Adicionar`

---

### 🧮 Fórmulas FX (Câmbio)

#### `FX.RATE(data, moeda, [fonte])`

Busca a taxa de câmbio da moeda contra BRL na data especificada.

**Parâmetros:**
- `data` (string): Data no formato "YYYY-MM-DD"
- `moeda` (string): Código da moeda (USD, EUR, etc.)
- `fonte` (opcional): "PTAX", "MANUAL" ou "AUTO" (padrão: AUTO)

**Fonte AUTO:**
- Busca primeiro em `_FX_Manual_Rates`
- Se não encontrar, busca em `_FX_PTAX_Rates`

**Fallback de dias não úteis:**
- Se nenhuma taxa for encontrada para a data exata (ex: fim de semana), a função busca automaticamente a cotação do **último dia útil anterior** (até 7 dias atrás)

**Exemplos:**
```
=FX.RATE("2025-10-27", "USD")           → 5.6234 (busca automática)
=FX.RATE("2025-10-27", "EUR", "PTAX")   → 6.1045 (força PTAX)
=FX.RATE("2025-10-28", "USD")           → 5.6234 (domingo → fallback sexta)
```

**Retorno:** Número (taxa) ou `#N/A` se não encontrado

---

#### `FX.TODAY(moeda)`

Atalho para `FX.RATE` usando a data de hoje.

**Exemplos:**
```
=FX.TODAY("USD")    → 5.6234
=FX.TODAY("EUR")    → 6.1045
```

---

#### `FX.CONVERT(valor, de_moeda, para_moeda, [data])`

Converte um valor de uma moeda para outra.

**Parâmetros:**
- `valor` (número): Quantia a converter
- `de_moeda` (string): Moeda origem
- `para_moeda` (string): Moeda destino
- `data` (opcional): Data da conversão (padrão: hoje)

**Lógica de conversão:**
- BRL → Moeda: `valor / taxa`
- Moeda → BRL: `valor * taxa`
- Moeda1 → Moeda2: **triangulação via BRL** = `(valor * taxa1) / taxa2`

**Exemplos:**
```
=FX.CONVERT(1000, "USD", "BRL")                 → 5623.40
=FX.CONVERT(5000, "BRL", "EUR")                 → 819.02
=FX.CONVERT(100, "USD", "EUR", "2025-10-15")    → 92.15 (triangulado)
```

---

#### `FX.VARIATION(moeda, data_inicial, data_final, [fonte])`

Calcula a variação percentual da taxa entre duas datas.

**Fórmula:** `((taxa_final - taxa_inicial) / taxa_inicial) * 100`

**Exemplos:**
```
=FX.VARIATION("USD", "2025-09-27", "2025-10-27")    → 3.45% (valorização do USD)
=FX.VARIATION("EUR", "2025-10-01", "2025-10-27")    → -1.23% (desvalorização do EUR)
```

---

#### `FX.AVG(moeda, data_inicial, data_final, [fonte])`

Calcula a **média aritmética** das taxas no intervalo de datas.

**Exemplos:**
```
=FX.AVG("USD", "2025-10-01", "2025-10-27")    → 5.5890 (média mensal)
```

---

#### `FX.MAX(moeda, data_inicial, data_final, [fonte])`

Retorna a **taxa máxima** (pico) no período.

**Exemplos:**
```
=FX.MAX("USD", "2025-10-01", "2025-10-27")    → 5.7234 (máxima do mês)
```

---

#### `FX.MIN(moeda, data_inicial, data_final, [fonte])`

Retorna a **taxa mínima** (vale) no período.

**Exemplos:**
```
=FX.MIN("USD", "2025-10-01", "2025-10-27")    → 5.4521 (mínima do mês)
```

---

#### `FX.FORWARD(data_spot, data_futura, moeda, taxa_domestica, taxa_estrangeira)`

Calcula a **taxa de câmbio futuro teórica** usando o modelo de paridade de juros.

**Fórmula:** `F = S × (1 + rd × t) / (1 + rf × t)`

Onde:
- `S` = Taxa spot (da `data_spot`)
- `rd` = Taxa de juros doméstica (Brasil)
- `rf` = Taxa de juros estrangeira
- `t` = Prazo em anos (convenção 360 dias)

**Parâmetros:**
- `data_spot` (string): Data da taxa spot
- `data_futura` (string): Data do vencimento futuro
- `moeda` (string): Moeda
- `taxa_domestica` (número): Taxa de juros BRL (decimal, ex: 0.1375 para 13.75% a.a.)
- `taxa_estrangeira` (número): Taxa de juros da moeda (decimal)

**Exemplos:**
```
=FX.FORWARD("2025-10-27", "2026-10-27", "USD", 0.1375, 0.055)    → 5.8567
```

---

### 💰 Fórmulas FIN (Financeiras)

#### `FIN.PV(taxa, nper, pmt, [fv], [tipo])`

Calcula o **Valor Presente** (Present Value) de um investimento.

**Parâmetros:**
- `taxa` (número): Taxa de juros por período (decimal, ex: 0.01 para 1%)
- `nper` (número): Número de períodos
- `pmt` (número): Pagamento por período
- `fv` (opcional): Valor futuro (padrão: 0)
- `tipo` (opcional): 0 = fim do período, 1 = início (padrão: 0)

**Exemplos:**
```
=FIN.PV(0.01, 12, -1000)           → 11255.08 (VP de 12 parcelas de 1000)
=FIN.PV(0.005, 60, -850, 5000, 0)  → 44376.23
```

---

#### `FIN.FV(taxa, nper, pmt, [pv], [tipo])`

Calcula o **Valor Futuro** (Future Value) de um investimento.

**Exemplos:**
```
=FIN.FV(0.01, 12, -1000)           → -12682.50 (VF de 12 depósitos de 1000)
=FIN.FV(0.005, 60, 0, -10000, 0)   → 13488.50 (montante de 10k após 60 períodos)
```

---

#### `FIN.PMT(taxa, nper, pv, [fv], [tipo])`

Calcula o **Pagamento** (Payment) periódico de um empréstimo/financiamento.

**Exemplos:**
```
=FIN.PMT(0.01, 12, 10000)          → -888.49 (parcela de empréstimo de 10k)
=FIN.PMT(0.0075, 360, 300000)      → -2506.83 (financiamento imobiliário 30 anos)
```

---

#### `FIN.NPER(taxa, pmt, pv, [fv], [tipo])`

Calcula o **Número de Períodos** necessários.

**Exemplos:**
```
=FIN.NPER(0.01, -1000, 10000)      → 10.58 (precisa ~11 parcelas de 1000)
```

---

#### `FIN.RATE(nper, pmt, pv, [fv], [tipo], [estimativa])`

Calcula a **Taxa de Juros** por período usando o método de Newton-Raphson.

**Parâmetros:**
- `estimativa` (opcional): Chute inicial (padrão: 0.1 = 10%)

**Exemplos:**
```
=FIN.RATE(12, -1000, 10000)        → 0.0293 (2.93% ao período)
```

**Nota:** Se não convergir (máx. 100 iterações), retorna `#N/A`

---

#### `FIN.RATE.EQUIVALENT(taxa, de_periodos, para_periodos)`

Converte uma taxa de juros entre diferentes periodicidades.

**Fórmula:** `taxa_equivalente = (1 + taxa)^(para/de) - 1`

**Exemplos:**
```
=FIN.RATE.EQUIVALENT(0.01, 1, 12)     → 0.1268 (mensal → anual: 12.68% a.a.)
=FIN.RATE.EQUIVALENT(0.12, 12, 1)     → 0.0095 (anual → mensal: 0.95% a.m.)
=FIN.RATE.EQUIVALENT(0.10, 1, 4)      → 0.4641 (anual → quadrimestral)
```

---

### 📊 Dashboard Estático

**Menu:** `Dashboard Câmbio (Estático)`

Cria uma planilha `_FX_Dashboard` com análises automáticas para **todas as moedas carregadas**.

**Colunas geradas:**
1. **Moeda** - Código da moeda
2. **Taxa Hoje** - `=FX.TODAY(moeda)`
3. **Variação 30d (%)** - `=FX.VARIATION(moeda, hoje-30, hoje)`
4. **Média 30d** - `=FX.AVG(moeda, hoje-30, hoje)`
5. **Máxima 30d** - `=FX.MAX(moeda, hoje-30, hoje)`
6. **Mínima 30d** - `=FX.MIN(moeda, hoje-30, hoje)`

**Recursos:**
- ✅ Lista **apenas moedas com dados já carregados** (não mostra moedas sem cotações)
- ✅ Usa **fórmulas dinâmicas** (recalcula automaticamente quando dados mudam)
- ✅ Recalculação automática ao abrir a planilha

**Pré-requisito:** Execute `Sincronizar Cotações PTAX` ou adicione taxas manuais antes de criar o dashboard.

---

### 🔌 Capability Provider (`dj.fx.rates@3`)

O plugin se registra como um **provedor de capability** para que outros plugins possam consultá-lo programaticamente.

**API exposta:**

```typescript
interface FXRatesAPI {
  getRate(date: string, currency: CurrencyCode, source?: RateSource): Promise<number | null>;
  convert(value: number, fromCurrency: CurrencyCode, toCurrency: CurrencyCode, date?: string): Promise<number>;
  getAvailableCurrencies(): CurrencyCode[];
}
```

**Exemplo de uso (de outro plugin):**

```typescript
// Obter API do plugin FX
const fxAPI = kernel.getCapability('dj.fx.rates@3') as FXRatesAPI;

// Buscar taxa
const usdRate = await fxAPI.getRate('2025-10-27', 'USD');

// Converter valores
const brlValue = await fxAPI.convert(1000, 'USD', 'BRL', '2025-10-27');

// Listar moedas disponíveis
const currencies = fxAPI.getAvailableCurrencies();
```

**Integração com outros plugins:**
- Plugin de **Empréstimos** pode usar para converter parcelas em moeda estrangeira
- Plugin de **Valuation** pode usar para ajustar fluxos de caixa multi-moeda
- Plugin de **Consolidação** pode usar para eliminar intercompany em moedas diferentes

---

### 💾 Persistência em Sessão

**Menu:** `Salvar Plugin na Sessão`

Salva o código-fonte do plugin no **armazenamento local** (IndexedDB) para carregamento automático em futuras sessões.

**Funcionamento:**
1. Clique em `Salvar Plugin na Sessão`
2. O código é salvo em `plugin_settings` com chave `plugin-source`
3. Em futuras sessões, o kernel detecta e carrega o plugin automaticamente

**Nota:** Esta funcionalidade está preparada no código, mas depende da implementação de file system access ou bundling do código fonte.

---

## 🎯 Casos de Uso

### 1. Conversão de Demonstrações Financeiras

**Cenário:** Você tem uma subsidiária nos EUA e precisa converter suas demonstrações para BRL (Consolidação).

**Solução:**
1. Sincronize as cotações PTAX do período fiscal
2. Use `=FX.CONVERT(A2, "USD", "BRL", "2025-12-31")` para converter cada conta
3. Crie um dashboard para acompanhar a variação cambial no período

---

### 2. Hedge de Empréstimo em Moeda Estrangeira

**Cenário:** Empresa tomou empréstimo de USD 10 milhões e quer calcular o custo em BRL + analisar risco cambial.

**Solução:**
1. Use `=FX.CONVERT(10000000, "USD", "BRL")` para obter exposição em BRL
2. Use `=FX.VARIATION("USD", data_contrato, HOJE())` para medir risco cambial acumulado
3. Use `=FX.FORWARD(hoje, vencimento, "USD", selic, sofr)` para precificar hedge futuro
4. Crie cenários de stress test com `FX.MAX` e `FX.MIN` históricos

---

### 3. Análise de Importação/Exportação

**Cenário:** Importadora precisa projetar custo de insumos importados.

**Solução:**
1. Use `=FX.AVG("USD", data_inicial, data_final)` para calcular taxa média de compra
2. Use `=FX.MAX` e `=FX.MIN` para definir bandas de risco (cenário pessimista/otimista)
3. Crie dashboard com variação mensal para negociar prazos com fornecedor

---

### 4. Cálculo de Financiamento com Hedge

**Cenário:** Financiamento em USD com hedge via swap.

**Solução:**
1. Use `=FIN.PMT(taxa_usd, prazo, principal)` para parcela em USD
2. Use `=FX.FORWARD(hoje, vencimento, "USD", cdi, libor)` para taxa futura
3. Use `=FIN.PMT(taxa_brl, prazo, =FX.CONVERT(principal, "USD", "BRL"))` para equivalente em BRL
4. Compare cenários com/sem hedge

---

## 🔧 Arquitetura Técnica

### Estrutura de Dados

**Cache em Memória:**
- Todas as taxas são carregadas em um `Map<string, ExchangeRate>` na inicialização
- Chave do cache: `"${data}|${moeda}|${fonte}"` (ex: `"2025-10-27|USD|PTAX"`)
- **Performance:** Acesso O(1) para avaliação de fórmulas

**Planilhas de Persistência:**
- `_FX_PTAX_Rates`: Dados sincronizados da API BCB (somente leitura pelo usuário)
- `_FX_Manual_Rates`: Dados inseridos manualmente (editável)
- `_FX_Dashboard`: Dashboard gerado (recalculável)

**Estrutura de tipos:**
```typescript
interface ExchangeRate {
  date: string;        // YYYY-MM-DD
  currency: CurrencyCode;
  buyRate: number;     // Taxa de compra (BRL)
  sellRate: number;    // Taxa de venda (BRL)
  source: RateSource;  // PTAX | MANUAL
  timestamp?: string;  // ISO 8601 (apenas PTAX)
}
```

---

### Fluxo de Sincronização PTAX

```
[Usuário] → Seleciona moedas/datas → [Plugin]
                                        ↓
                              Constrói URL da API BCB
                                        ↓
                          Faz fetch → Recebe JSON com múltiplos boletins
                                        ↓
                            Agrupa por data (groupPTAXByDate)
                                        ↓
                          Para cada data: seleciona boletim com timestamp mais tardio
                                        ↓
                              Valida dados (ignora taxas ≤ 0)
                                        ↓
                            Verifica duplicatas na planilha
                                        ↓
                            Salva em _FX_PTAX_Rates
                                        ↓
                              Recarrega cache (loadRatesCache)
                                        ↓
                              [Usuário] ← "Sincronização concluída!"
```

---

### Fluxo de Avaliação de Fórmulas

```
[Célula] =FX.RATE("2025-10-27", "USD")
            ↓
      CalcEngine chama função registrada
            ↓
      getRateFromCache(date, currency, 'AUTO')
            ↓
      1. Tenta MANUAL: Map.get("2025-10-27|USD|MANUAL")
            ↓ (não encontrou)
      2. Tenta PTAX: Map.get("2025-10-27|USD|PTAX")
            ↓ (não encontrou - domingo)
      3. Fallback: Itera data-1 até -7 dias
            ↓ (encontrou 2025-10-26 sexta)
      4. Retorna sellRate = 5.6234
            ↓
      [Célula] ← 5.6234
```

---

## 📚 Referências de API

### API do BCB (PTAX)

**Documentação:** https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/aplicacao#!/recursos/CotacaoMoedaPeriodo

**Exemplo de URL:**
```
https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoMoedaPeriodo(moeda=@moeda,dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)?@moeda='USD'&@dataInicial='10-01-2025'&@dataFinalCotacao='10-27-2025'&$format=json
```

**Formato de resposta:**
```json
{
  "value": [
    {
      "cotacaoCompra": 5.6123,
      "cotacaoVenda": 5.6234,
      "dataHoraCotacao": "2025-10-27 13:11:33.123",
      "tipoBoletim": "Fechamento"
    }
  ]
}
```

**Moedas disponíveis:** USD, EUR, GBP, JPY, CHF, CAD, AUD, CNY, entre outras.

---

## 🚧 Próximos Passos (Fase 2)

A **Fase 2** do plugin (em desenvolvimento futuro) incluirá:

### 1. Múltiplos Provedores e Taxas Cruzadas Reais
- Conectores para ECB (Banco Central Europeu) - pares /EUR
- Conectores para FED (Federal Reserve) - dados de juros EUA
- Gestor de prioridade de fontes (UI de configuração)
- Fórmula `FX.RATE(data, base, alvo)` com suporte a pares diretos (sem triangulação)

### 2. Sincronização de Curvas Futuras
- Curvas de Cupom Cambial (DDI) do BCB
- Taxas de juros internacionais (SOFR, Euribor)
- Nova fórmula `FX.RATE.FORWARD(spot, future, currency)` usando curvas reais

### 3. Hub de Dados de Mercado
- **Inflação:** IPCA, IGP-M, INCC (BCB/IBGE)
- **Juros Locais:** CDI, Selic (BCB)
- **Commodities:** Petróleo (Brent, WTI), Ouro (APIs externas)
- **Índices de Ações:** IBOVESPA, S&P 500
- Fórmula mestra `MD.RATE(data, ticker)` (Market Data)
- Fórmula `MD.VNA(valor, data_base, data_alvo, indice)` (Valor Nominal Atualizado)

### 4. Auditoria e Qualidade de Dados
- Menu "Auditar Dados de Câmbio"
- Detecção de:
  - **Gaps** (lacunas em dias úteis)
  - **Spikes** (variações anormais > 10%)
  - **Duplicatas**
- Geração de relatório `_FX_Audit_Report`

### 5. Dashboard Live (Interativo)
- Painel flutuante com ApexCharts
- Busca direta da API BCB (bypass das planilhas)
- Cálculo de cross-rates em tempo real (USD/EUR sem triangulação)
- Seleção dinâmica de moedas e períodos

---

## 🐛 Troubleshooting

### Problema: "Nenhuma moeda carregada"

**Causa:** Dashboard foi criado antes de sincronizar dados.
**Solução:** Execute `Sincronizar Cotações PTAX` primeiro, depois crie o dashboard.

---

### Problema: Fórmula retorna `#N/A`

**Causa:** Taxa não encontrada para a data/moeda especificada.
**Solução:**
1. Verifique se a moeda está na planilha `_FX_PTAX_Rates` ou `_FX_Manual_Rates`
2. Verifique se a data está no formato correto: "YYYY-MM-DD"
3. Se for fim de semana, a fórmula tenta buscar até 7 dias anteriores automaticamente
4. Adicione a taxa manualmente via `Adicionar Taxa Manual`

---

### Problema: Erro ao sincronizar PTAX

**Causa:** API do BCB pode estar temporariamente indisponível ou há problema de rede.
**Solução:**
1. Verifique sua conexão com internet
2. Tente novamente após alguns minutos
3. Verifique no console do navegador (F12) se há mensagens de erro
4. Se persistir, use taxas manuais como alternativa

---

### Problema: Dashboard não recalcula

**Causa:** O kernel pode não estar recalculando automaticamente.
**Solução:**
1. Abra a planilha `_FX_Dashboard`
2. Use o comando de recálculo manual (se disponível)
3. Ou delete a planilha e recrie o dashboard

---

## 📄 Licença

Este plugin faz parte do projeto DJ DataForge v6 e segue a mesma licença do projeto principal.

---

## 👨‍💻 Suporte e Contribuições

Para reportar bugs, sugerir melhorias ou contribuir com código:

1. **Issues:** Abra uma issue no repositório do projeto
2. **Pull Requests:** Contribuições são bem-vindas! Siga as convenções de código do projeto
3. **Documentação:** Consulte os arquivos SPEC-* na raiz do projeto para detalhes arquiteturais

---

## 🎉 Agradecimentos

- **Banco Central do Brasil (BCB)** pela API PTAX aberta e bem documentada
- Comunidade DJ DataForge pelos feedbacks e sugestões

---

**Status da Fase 1:** ✅ Código completo - Aguardando validação do usuário

**Próximo passo:** Você deve validar o código, executar testes e reportar quaisquer ajustes necessários antes de prosseguirmos para a Fase 2.
