# ⚡ Quickstart - Loan Manager (.xlam)

## 🚀 Instalação em 3 Passos

### 1️⃣ Abra o Excel e Ative o VBA

1. Abra o **Excel**
2. Pressione **Alt + F11** (abre VBA Editor)
3. Mantenha aberto

### 2️⃣ Importe os Módulos

1. No VBA Editor:
   - **VBAProject** (lado esquerdo) → Botão direito
   - **Inserir** → **Módulo**
   - Repita (crie 2 módulos)

2. **Primeiro módulo** (LoanCalculator):
   - Abra `LoanCalculator.bas` em um editor de texto
   - **Copie todo o conteúdo**
   - **Cole** no primeiro módulo
   - Pressione **F4** → Renomeie para "LoanCalculator"

3. **Segundo módulo** (LoanManager):
   - Abra `LoanManager.bas` em um editor de texto
   - **Copie todo o conteúdo**
   - **Cole** no segundo módulo
   - Pressione **F4** → Renomeie para "LoanManager"

### 3️⃣ Salve como .xlam

1. **Arquivo** → **Salvar Como**
2. **Tipo**: **Suplemento do Excel (.xlam)**
3. **Nome**: `LoanManager.xlam`
4. **Local**: Deixe a pasta sugerida (pasta de suplementos)
5. **Salvar**
6. Feche o VBA Editor

### ✅ Ative o Suplemento

1. No Excel: **Arquivo** → **Opções** → **Suplementos**
2. **Gerenciar**: **Suplementos do Excel** → **Ir**
3. **Marque** `LoanManager`
4. **OK**

---

## 🎯 Primeiro Uso

### Criar Contrato de Teste

1. Pressione **Alt + F8** (Macros)
2. Digite: `CriarContratoTeste`
3. Cole este código no VBA:

```vba
Sub CriarContratoTeste()
    Dim id As String
    id = LoanManager.CriarContrato("CAPTADO", "Banco Teste", "BRL", _
                                   100000, #1/1/2025#, #12/31/2025#, _
                                   12.5, "PRICE", "MENSAL", 12)
    MsgBox "Contrato criado: " & id
End Sub
```

4. **Executar**

### Gerar Cronograma

1. Abra a planilha **"Contratos"** (criada automaticamente)
2. Clique em uma célula da linha do contrato
3. **Alt + F8** → Execute: `LoanManager.GerarCronogramaRapido`

---

## 📊 O que foi criado?

- ✅ Planilha **"Contratos"** com lista de empréstimos
- ✅ Planilha **"Cronograma_[ID]"** com parcelas detalhadas
- ✅ Planilha **"Ledger_[ID]"** com histórico

---

## ❓ Precisa de Ajuda?

Consulte [README_XLAM.md](README_XLAM.md) para documentação completa.

---

**Tempo total:** 5 minutos ⏱️
**Pronto para usar!** 🎉
