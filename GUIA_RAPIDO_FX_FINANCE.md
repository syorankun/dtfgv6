# 🚀 Guia Rápido - Plugin FX & Finance

## 📋 O que foi feito

✅ Plugin criado em: `/workspaces/dtfgv6/src/plugins/fx-finance-plugin.ts`
✅ Plugin registrado em: `/workspaces/dtfgv6/src/app.ts`
✅ Documentação criada em: `/workspaces/dtfgv6/src/plugins/FX_FINANCE_README.md`

---

## 🔧 Como Compilar e Usar

### Passo 1: Verificar Erros de TypeScript

```bash
npm run type-check
```

**Resultado esperado:** Deve compilar sem erros ✅

### Passo 2: Iniciar o Servidor de Desenvolvimento

```bash
npm run dev
```

**Resultado esperado:**
```
VITE v5.x.x  ready in XXX ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

### Passo 3: Abrir no Navegador

Acesse: **http://localhost:5173**

---

## 🎯 Como Usar o Plugin

### 1️⃣ Sincronizar Cotações PTAX do Banco Central

1. Na interface, procure o menu **"Sincronizar Cotações PTAX"**
2. Selecione as datas (início e fim)
3. Marque as moedas desejadas (USD, EUR, GBP, etc.)
4. Clique em **"Sincronizar"**
5. Aguarde a mensagem de sucesso
6. Abra a planilha **`_FX_PTAX_Rates`** para ver os dados

**Resultado:**
```
Data       | Moeda | Taxa Compra | Taxa Venda | Timestamp
2025-10-27 | USD   | 5.6123      | 5.6234     | 2025-10-27 13:11:33
2025-10-27 | EUR   | 6.1034      | 6.1045     | 2025-10-27 13:11:33
```

---

### 2️⃣ Adicionar Taxa Manual

1. Clique em **"Adicionar Taxa Manual"**
2. Selecione a data
3. Escolha a moeda
4. Digite a taxa de venda (BRL)
5. Opcionalmente, digite a taxa de compra
6. Clique em **"Adicionar"**
7. Abra a planilha **`_FX_Manual_Rates`** para confirmar

**Quando usar:**
- API do BCB está fora do ar
- Você tem taxas de contratos específicos
- Quer sobrescrever uma cotação oficial

---

### 3️⃣ Usar Fórmulas nas Células

Após sincronizar dados, você pode usar as fórmulas em qualquer célula:

#### Fórmulas FX (Câmbio)

```excel
=FX.RATE("2025-10-27", "USD")              → 5.6234
=FX.TODAY("USD")                           → Taxa de hoje
=FX.CONVERT(1000, "USD", "BRL")           → 5623.40
=FX.VARIATION("USD", "2025-10-01", "2025-10-27")  → 3.45%
=FX.AVG("USD", "2025-10-01", "2025-10-27") → 5.5890
=FX.MAX("USD", "2025-10-01", "2025-10-27") → 5.7234
=FX.MIN("USD", "2025-10-01", "2025-10-27") → 5.4521
```

#### Fórmulas FIN (Financeiras)

```excel
=FIN.PV(0.01, 12, -1000)                   → 11255.08 (Valor Presente)
=FIN.FV(0.01, 12, -1000)                   → -12682.50 (Valor Futuro)
=FIN.PMT(0.01, 12, 10000)                  → -888.49 (Parcela)
=FIN.NPER(0.01, -1000, 10000)              → 10.58 (Nº Períodos)
=FIN.RATE(12, -1000, 10000)                → 0.0293 (Taxa)
=FIN.RATE.EQUIVALENT(0.01, 1, 12)          → 0.1268 (Taxa Equivalente)
```

---

### 4️⃣ Criar Dashboard Estático

1. Primeiro, sincronize dados (passo 1)
2. Clique em **"Dashboard Câmbio (Estático)"**
3. Abra a planilha **`_FX_Dashboard`** gerada automaticamente

**O que o Dashboard mostra:**
- Taxa de hoje para cada moeda
- Variação % dos últimos 30 dias
- Média, máxima e mínima dos últimos 30 dias

**Exemplo:**
```
Moeda | Taxa Hoje | Variação 30d (%) | Média 30d | Máxima 30d | Mínima 30d
USD   | 5.6234    | 3.45%            | 5.5890    | 5.7234     | 5.4521
EUR   | 6.1045    | -1.23%           | 6.1234    | 6.2345     | 6.0123
```

---

## 🧪 Teste Rápido (5 minutos)

Execute estes comandos em sequência para testar tudo:

```bash
# 1. Verificar compilação
npm run type-check

# 2. Iniciar servidor
npm run dev
```

Depois, no navegador:

1. Abra http://localhost:5173
2. Sincronize USD para os últimos 7 dias
3. Crie uma célula com: `=FX.TODAY("USD")`
4. Veja o resultado aparecer
5. Crie o dashboard e veja a análise automática

**Se tudo funcionar, você está pronto! ✅**

---

## 🐛 Solução de Problemas

### Erro: "Module not found"

**Causa:** Dependências não instaladas

**Solução:**
```bash
npm install
```

---

### Erro: "Cannot read property 'showToast'"

**Causa:** UI não inicializou corretamente

**Solução:**
1. Recarregue a página (F5)
2. Abra o console (F12) e veja os erros
3. Verifique se o kernel inicializou: procure por `[App] Application ready`

---

### Erro: Fórmula retorna "#N/A"

**Causa:** Taxa não encontrada para a data/moeda

**Solução:**
1. Verifique se você sincronizou a moeda
2. Abra `_FX_PTAX_Rates` e confirme que os dados existem
3. Se for fim de semana, a fórmula busca automaticamente a sexta-feira anterior
4. Se não houver dados, adicione uma taxa manual

---

### Plugin não aparece nos menus

**Causa:** Plugin não carregou

**Solução:**
1. Abra o console (F12)
2. Procure por erros de carregamento
3. Verifique se aparece: `FX & Finance Plugin loaded!`
4. Se não aparecer, verifique se o plugin foi registrado corretamente em `src/app.ts`

---

## 📚 Documentação Completa

Para detalhes técnicos, arquitetura e exemplos avançados, consulte:

**`/workspaces/dtfgv6/src/plugins/FX_FINANCE_README.md`**

---

## 🎉 Casos de Uso Reais

### Exemplo 1: Consolidação de Subsidiária Estrangeira

```excel
// Converter Receita de USD para BRL
=FX.CONVERT(A2, "USD", "BRL", "2025-12-31")

// Analisar risco cambial do período
=FX.VARIATION("USD", "2025-01-01", "2025-12-31")
```

### Exemplo 2: Cálculo de Empréstimo em Moeda Estrangeira

```excel
// Parcela em USD
=FIN.PMT(0.055/12, 36, 100000)

// Converter para BRL
=FX.CONVERT(A1, "USD", "BRL")

// Taxa futura para hedge
=FX.FORWARD("2025-10-27", "2026-10-27", "USD", 0.1375, 0.055)
```

### Exemplo 3: Análise de Importação

```excel
// Custo médio dos últimos 30 dias
=FX.AVG("USD", HOJE()-30, HOJE()) * 1000000

// Cenário pessimista (máxima)
=FX.MAX("USD", HOJE()-30, HOJE()) * 1000000

// Cenário otimista (mínima)
=FX.MIN("USD", HOJE()-30, HOJE()) * 1000000
```

---

## ⚡ Comandos Rápidos de Referência

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Inicia servidor de desenvolvimento |
| `npm run build` | Compila para produção |
| `npm run preview` | Visualiza build de produção |
| `npm run type-check` | Verifica erros TypeScript |
| `npm run lint` | Verifica código com ESLint |
| `npm run format` | Formata código com Prettier |

---

## 🚧 Próxima Fase (Fase 2)

Depois que você validar a Fase 1, vamos implementar:

- ✨ Múltiplos provedores (ECB, FED)
- ✨ Curvas de juros futuras (Cupom Cambial, SOFR)
- ✨ Hub de dados de mercado (IPCA, CDI, Selic, Commodities)
- ✨ Auditoria e qualidade de dados
- ✨ Dashboard Live interativo com gráficos

**Aguardando sua validação para prosseguir! 🎯**

---

**Status:** ✅ Fase 1 concluída - Aguardando validação do usuário
