# ⚡ Quickstart Guide - Loan Manager Excel Add-in

Guia rápido para começar a usar o Loan Manager em **5 minutos**.

---

## 1️⃣ Instalar Servidor Local

Escolha uma opção:

### Opção A: Node.js (Recomendado)

```bash
# Instale http-server
npm install -g http-server

# OU use o package.json
npm install
npm start
```

### Opção B: Python

```bash
# Python 3
python -m http.server 3000

# Python 2
python -m SimpleHTTPServer 3000
```

---

## 2️⃣ Carregar no Excel

### Excel para Windows

1. **Abra o Excel**
2. **Inserir** → **Meus Suplementos** → **Suplementos do Office**
3. **Adicionar Personalizado** → **Adicionar do Arquivo**
4. Selecione `manifest.xml`
5. **OK**

### Excel para Mac

1. **Abra o Excel**
2. **Inserir** → **Suplementos** → **Meus Suplementos**
3. **Adicionar do Arquivo**
4. Selecione `manifest.xml`
5. **Adicionar**

### Excel Online

1. Acesse [office.com](https://office.com)
2. Abra uma pasta de trabalho
3. **Inserir** → **Suplementos**
4. **Carregar Meu Suplemento**
5. Faça upload de `manifest.xml`

---

## 3️⃣ Usar o Add-in

1. **Página Inicial** → **Empréstimos** → **Abrir Painel**
2. Clique em **+ Novo Contrato**
3. Preencha os campos:
   - **Contraparte**: "Banco ABC"
   - **Moeda**: BRL
   - **Principal**: 100000
   - **Taxa**: 12.5
   - **Sistema**: PRICE
   - **Parcelas**: 12
4. **✓ Criar Contrato**
5. Clique no contrato criado
6. Escolha **📊 Gerar Cronograma**

✅ **Pronto!** Você criou seu primeiro contrato e gerou o cronograma.

---

## 📋 Exemplo Completo

### Criar Contrato de R$ 100 mil

```
Tipo: Captado
Contraparte: Banco XYZ
Moeda: BRL
Principal: 100000
Data Início: 2025-01-01
Data Vencimento: 2025-12-31
Taxa: 12.5% a.a.
Sistema: PRICE
Periodicidade: Mensal
Parcelas: 12
```

### Resultado Esperado

- **Contrato criado**: `LOAN-xxxxxxxxxx-xxxxxx`
- **Planilha "Contratos"**: Criada com 1 linha
- **Planilha "Ledger_[ID]"**: Criada com entrada inicial
- **Cronograma**: 12 parcelas de ~R$ 8.884,88

---

## 🆘 Problemas Comuns

### ❌ "Não consigo adicionar o manifest"

**Solução:**
1. Certifique-se que o servidor HTTP está rodando
2. Verifique que a URL no `manifest.xml` está correta:
   ```xml
   <SourceLocation DefaultValue="http://localhost:3000/taskpane.html"/>
   ```
3. Use `http://` (não `https://`) para testes locais

### ❌ "O painel não abre"

**Solução:**
1. Verifique o console do navegador (F12 no Task Pane)
2. Certifique-se que todos os arquivos estão na pasta correta
3. Recarregue o Excel

### ❌ "Erro CORS no Excel Online"

**Solução:**
1. Use Excel para Windows/Mac (Excel Online tem mais restrições)
2. Configure CORS no servidor:
   ```bash
   http-server -p 3000 --cors
   ```

---

## 🎯 Próximos Passos

1. **Registrar Pagamento**:
   - Clique no contrato
   - **💳 Registrar Pagamento**
   - Informe valor e data

2. **Ver Ledger**:
   - Vá na planilha `Ledger_[ID]`
   - Veja histórico completo de transações

3. **Analisar Cronograma**:
   - Vá na planilha `Cronograma_[ID]`
   - Veja detalhamento de cada parcela
   - Totais calculados automaticamente

4. **Criar Mais Contratos**:
   - Teste com diferentes moedas (USD, EUR)
   - Teste sistema SAC
   - Teste diferentes periodicidades

---

## 📖 Documentação Completa

Consulte [README.md](README.md) para documentação detalhada.

---

**Tempo estimado:** 5 minutos ⏱️

Divirta-se! 🎉
