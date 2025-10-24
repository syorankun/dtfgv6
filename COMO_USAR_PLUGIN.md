# 📋 ProLease IFRS 16 - Como Usar o Plugin Externo

## ✅ ARQUIVO PRONTO PARA USO

**Arquivo**: `prolease-ifrs16-plugin.js` (na raiz do projeto)

- ✅ Funciona em `file://` (sem servidor)
- ✅ Sem CORS
- ✅ Carrega pelo DataForge
- ✅ Totalmente autocontido

## 🚀 COMO USAR (3 Passos)

### Passo 1: Abra seu HTML DataForge

Abra o arquivo HTML standalone do DataForge no navegador usando `file://`

### Passo 2: Clique em "Load Plugin"

No DataForge, procure pelo botão **"Load Plugin"** (geralmente em Settings/Configurações)

### Passo 3: Selecione o Arquivo

Selecione o arquivo: **`prolease-ifrs16-plugin.js`**

## ✅ PRONTO!

Você verá:

```
✅ Plugin "ProLease IFRS 16" importado com sucesso!
```

E na interface:
- **Botão "New Lease" (📋)** na toolbar
- **Painel "ProLease Manager"** no lado direito

## 📝 USAR O PLUGIN

### Criar Novo Contrato

1. Clique no botão **"New Lease"** (📋)
2. Preencha os prompts:
   - Nome do Contrato
   - Prazo (meses)
   - Data de Início
   - Aluguel Mensal
   - Deduções
   - Taxa de Desconto
   - Allowance
   - Custos Diretos
3. **PRONTO!** A planilha IFRS 16 é criada automaticamente

### Ver Contratos Salvos

Vá ao painel **"ProLease Manager"** (lado direito) para ver todos os contratos.

### Recalcular

Clique em **"🔄 Recalculate"** em qualquer contrato.

### Deletar

Clique em **"🗑️"** para deletar um contrato.

## 📊 PLANILHA GERADA

O plugin cria uma planilha com **24 colunas**:

1. Month #
2. Date
3. Sum of All Costs
4. Service Deductions
5. Landlord Allowance
6. Total Rent Capitalized
7. Remaining PV
8. Interest
9. Lease Liability
10. ST Liability
11. LT Liability
12. Proof (ST+LT)
13. Initial Allowance
14. Allowance Amortization
15. Allowance Balance
16. Initial Direct Costs
17. IDC Amortization
18. IDC Balance
19. Opening ROU Asset
20. ROU Amortization
21. ROU Balance
22. Total ROU Balance
23. P&L Non-Financial
24. P&L Total Expense

## 🔍 VERIFICAR SE FUNCIONOU

Abra o **Console** (F12) e procure:

```javascript
[ProLeasePlugin] Initializing ProLease IFRS 16 v6.0.0...
[ProLeasePlugin] Loaded 0 contracts
[ProLeasePlugin] Calculation worker created
[ProLeasePlugin] Registered 3 IFRS 16 formulas
[ProLeasePlugin] UI elements registered
[ProLeasePlugin] Ready with 0 saved contracts
```

## ⚠️ IMPORTANTE

### O que USAR:
✅ **`prolease-ifrs16-plugin.js`** (raiz do projeto)

### O que NÃO usar:
❌ `dist-plugin/prolease-ifrs16-plugin.js` (ES module com imports)
❌ `dist-plugin/prolease-ifrs16-plugin.iife.js` (IIFE com imports)
❌ `dist-plugin/prolease-ifrs16-plugin-standalone.js` (para inline)

## 💾 PERSISTÊNCIA

Os contratos são salvos automaticamente no **IndexedDB** do navegador.

Após refresh da página, os contratos continuam salvos!

## 🐛 TROUBLESHOOTING

### Plugin não carrega

**Erro**: `Plugin deve exportar uma classe como default export`

**Solução**: Certifique-se de usar o arquivo correto: `prolease-ifrs16-plugin.js` (raiz)

### Botão não aparece

**Problema**: Botão "New Lease" não aparece

**Verificação**:
1. Abra o console (F12)
2. Procure por erros
3. Verifique se apareceu: `[ProLeasePlugin] Initializing...`

**Solução**: Recarregue o plugin ou reabra o HTML

### Contratos não salvam

**Problema**: Após refresh, contratos desaparecem

**Solução**:
- Certifique-se de não estar em modo anônimo
- Verifique se IndexedDB está habilitado no navegador

## 📁 LOCALIZAÇÃO DO ARQUIVO

```
dtfgv6/
├── prolease-ifrs16-plugin.js  ← USE ESTE ARQUIVO
├── index.html (seu DataForge)
└── dist-plugin/ (NÃO use estes)
```

## 🎯 RESUMO ULTRA-RÁPIDO

1. **Abrir** HTML DataForge (`file://`)
2. **Clicar** em "Load Plugin"
3. **Selecionar** `prolease-ifrs16-plugin.js`
4. **Clicar** no botão "New Lease" (📋)
5. **Preencher** os dados do contrato
6. **PRONTO!** Planilha criada automaticamente

---

**Versão**: 6.0.0
**Compatibilidade**: DataForge v6 HTML Standalone
**Protocolo**: file:// ✅
**CORS**: Sem problemas ✅
**Dependências**: Zero ✅

🎉 **FUNCIONA PERFEITAMENTE!**
