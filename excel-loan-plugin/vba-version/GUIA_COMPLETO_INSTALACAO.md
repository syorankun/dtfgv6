# 📘 Guia Completo de Instalação - Loan Manager (.xlam)

**Versão com UserForms e Ribbon Customizada**

---

## 📋 Índice

1. [Pré-requisitos](#-pré-requisitos)
2. [Instalação Básica (sem Ribbon)](#-instalação-básica-sem-ribbon)
3. [Instalação Completa (com Ribbon)](#-instalação-completa-com-ribbon)
4. [Criação dos UserForms](#-criação-dos-userforms)
5. [Ativação do Add-in](#-ativação-do-add-in)
6. [Verificação](#-verificação)
7. [Solução de Problemas](#-solução-de-problemas)

---

## 🔧 Pré-requisitos

### Software Necessário

- ✅ **Microsoft Excel** 2016 ou superior (Windows ou Mac)
- ✅ **Custom UI Editor** (apenas para Ribbon) - [Download aqui](https://github.com/fernandreu/office-custom-ui-editor/releases)
- ✅ Editor de texto (Notepad++, VS Code, ou Bloco de Notas)

### Arquivos Necessários

```
vba-version/
├── LoanCalculator.bas          ← Módulo de cálculos
├── LoanManager.bas             ← Módulo de gestão
├── RibbonCallbacks.bas         ← Módulo de callbacks (Ribbon)
├── frmNovoContrato.txt         ← Código do UserForm
├── frmDashboard.txt            ← Código do UserForm
├── frmPagamento.txt            ← Código do UserForm
└── CustomUI.xml                ← XML da Ribbon
```

---

## 🚀 Instalação Básica (sem Ribbon)

Esta versão funciona **sem a aba customizada "Empréstimos"**, mas todas as funcionalidades estarão disponíveis via macros.

### Passo 1: Criar Pasta de Trabalho

1. Abra o **Excel**
2. Crie uma **nova pasta de trabalho vazia**
3. Salve como: **Arquivo → Salvar Como**
   - Tipo: **Suplemento do Excel (.xlam)**
   - Nome: `LoanManager.xlam`
   - Local: Sua pasta de suplementos (sugerida automaticamente)

### Passo 2: Ativar Modo Desenvolvedor

1. **Arquivo → Opções**
2. **Personalizar Faixa de Opções**
3. Marque **"Desenvolvedor"** no lado direito
4. **OK**

### Passo 3: Importar Módulos VBA

1. Pressione **Alt + F11** (abre VBA Editor)
2. No **VBAProject** (lado esquerdo):
   - Clique com botão direito
   - **Inserir → Módulo**
   - Repita **3 vezes** (para 3 módulos)

3. **Primeiro módulo** (LoanCalculator):
   - Abra `LoanCalculator.bas` em editor de texto
   - **Copie TODO o conteúdo**
   - **Cole** no primeiro módulo
   - Pressione **F4** → Em "Name" digite: `LoanCalculator`

4. **Segundo módulo** (LoanManager):
   - Abra `LoanManager.bas` em editor de texto
   - **Copie TODO o conteúdo**
   - **Cole** no segundo módulo
   - Pressione **F4** → Em "Name" digite: `LoanManager`

5. **Terceiro módulo** (RibbonCallbacks):
   - Abra `RibbonCallbacks.bas` em editor de texto
   - **Copie TODO o conteúdo**
   - **Cole** no terceiro módulo
   - Pressione **F4** → Em "Name" digite: `RibbonCallbacks`

### Passo 4: Criar UserForms

#### 4.1 UserForm: frmNovoContrato

1. No VBA Editor: **Inserir → UserForm**
2. Pressione **F4** (Properties)
3. Altere **Name** para: `frmNovoContrato`
4. Altere **Caption** para: `Novo Contrato de Empréstimo`
5. Altere **Width** para: `400`
6. Altere **Height** para: `480`

**Adicione os controles** (use Toolbox - View → Toolbox):

```
Label1     → Caption: "Tipo de Contrato:"
cboTipo    → ComboBox (Name: cboTipo)

Label2     → Caption: "Contraparte:"
txtContraparte → TextBox (Name: txtContraparte)

Label3     → Caption: "Moeda:"
cboMoeda   → ComboBox (Name: cboMoeda)

Label4     → Caption: "Principal:"
txtPrincipal → TextBox (Name: txtPrincipal)

Label5     → Caption: "Data Início:"
txtDataInicio → TextBox (Name: txtDataInicio)

Label6     → Caption: "Data Vencimento:"
txtDataVencimento → TextBox (Name: txtDataVencimento)

Label7     → Caption: "Taxa de Juros (% a.a.):"
txtTaxaJuros → TextBox (Name: txtTaxaJuros)

Label8     → Caption: "Sistema de Amortização:"
cboSistema → ComboBox (Name: cboSistema)

Label9     → Caption: "Periodicidade:"
cboPeriodicidade → ComboBox (Name: cboPeriodicidade)

Label10    → Caption: "Número de Parcelas:"
txtParcelas → TextBox (Name: txtParcelas)

cmdCriar   → CommandButton (Name: cmdCriar, Caption: "Criar Contrato")
cmdCancelar → CommandButton (Name: cmdCancelar, Caption: "Cancelar")
```

**Cole o código**:
- Duplo-clique no UserForm (abre editor de código)
- Abra `frmNovoContrato.txt`
- **Copie TODO o código** (exceto os comentários de layout)
- **Cole** no editor

#### 4.2 UserForm: frmDashboard

1. **Inserir → UserForm**
2. **F4** → Name: `frmDashboard`
3. Caption: `Dashboard de Contratos`
4. Width: `600`, Height: `450`

**Controles:**
```
Label1         → Caption: "Contratos de Empréstimo" (Font.Size: 14, Font.Bold: True)
lstContratos   → ListBox (Name: lstContratos, Width: 560, Height: 300)

cmdNovoContrato        → CommandButton ("Novo Contrato")
cmdGerarCronograma     → CommandButton ("Gerar Cronograma")
cmdRegistrarPagamento  → CommandButton ("Registrar Pagamento")
cmdAtualizar           → CommandButton ("Atualizar")
cmdFechar              → CommandButton ("Fechar")
```

**Cole o código** de `frmDashboard.txt`

#### 4.3 UserForm: frmPagamento

1. **Inserir → UserForm**
2. **F4** → Name: `frmPagamento`
3. Caption: `Registrar Pagamento`
4. Width: `400`, Height: `300`

**Controles:**
```
lblContratoID  → Label ("ID do Contrato:")
txtContratoID  → TextBox (Locked: True)

lblSaldoAtual  → Label ("Saldo Atual:")
txtSaldoAtual  → TextBox (Locked: True)

Label1         → Label ("Valor do Pagamento:")
txtValor       → TextBox

Label2         → Label ("Data do Pagamento:")
txtData        → TextBox

Label3         → Label ("Descrição (opcional):")
txtDescricao   → TextBox (MultiLine: True, Height: 60)

cmdConfirmar   → CommandButton ("Confirmar Pagamento")
cmdCancelar    → CommandButton ("Cancelar")
```

**Cole o código** de `frmPagamento.txt`

### Passo 5: Salvar

1. **Arquivo → Salvar** (no VBA Editor)
2. Feche o VBA Editor
3. Feche o Excel

### Passo 6: Ativar Add-in

1. Abra o Excel novamente
2. **Arquivo → Opções → Suplementos**
3. Em "Gerenciar": **Suplementos do Excel** → **Ir**
4. **Marque** `LoanManager`
5. **OK**

✅ **Instalação Básica Completa!**

**Como usar sem Ribbon:**
- Pressione **Alt + F8** (Macros)
- Execute: `LoanManager.AbrirFormularioNovoContrato`
- Ou: `LoanManager.AbrirDashboard`

---

## 🎨 Instalação Completa (com Ribbon)

A Ribbon customizada adiciona uma **aba "Empréstimos"** com todos os botões.

### Pré-requisito: Custom UI Editor

1. Baixe o **Custom UI Editor**: https://github.com/fernandreu/office-custom-ui-editor/releases
2. Instale a ferramenta
3. Feche o Excel

### Passo 1: Abrir .xlam no Editor

1. Abra o **Custom UI Editor**
2. **File → Open**
3. Selecione seu `LoanManager.xlam`

### Passo 2: Adicionar XML da Ribbon

1. No menu: **Insert → Office 2010+ Custom UI Part**
2. Cole o conteúdo de `CustomUI.xml` (TODO o conteúdo)
3. **File → Save**
4. Feche o Custom UI Editor

### Passo 3: Validar Ribbon

1. Reabra o .xlam no Custom UI Editor
2. Verifique se o XML está presente
3. **Validate → Validate Custom UI Part**
4. Se houver erros, corrija
5. **Save**

### Passo 4: Ativar no Excel

1. Abra o Excel
2. **Arquivo → Opções → Suplementos**
3. **Gerenciar: Suplementos do Excel → Ir**
4. Marque `LoanManager`
5. **OK**

### Passo 5: Verificar Ribbon

1. Olhe na **faixa de opções** (Ribbon)
2. Deve aparecer uma nova aba: **"Empréstimos"**
3. Clique nela
4. Você verá os grupos:
   - **Contratos** (Novo Contrato, Dashboard)
   - **Cronogramas** (Gerar Cronograma)
   - **Pagamentos** (Registrar Pagamento)
   - **Ferramentas** (Abrir Contratos, Atualizar)
   - **Ajuda** (Sobre, Ajuda)

✅ **Instalação Completa com Ribbon!**

---

## ✅ Verificação

### Teste 1: Criar Contrato

1. Clique na aba **"Empréstimos"**
2. Clique em **"Novo Contrato"**
3. Formulário deve abrir
4. Preencha:
   - Tipo: CAPTADO
   - Contraparte: Banco Teste
   - Moeda: BRL
   - Principal: 100000
   - Taxa: 12.5
   - Sistema: PRICE
   - Parcelas: 12
5. Clique **"Criar Contrato"**
6. Deve aparecer mensagem de sucesso
7. Planilha "Contratos" deve ser criada

### Teste 2: Gerar Cronograma

1. Na planilha "Contratos", clique em qualquer célula da linha do contrato
2. Clique na aba **"Empréstimos"** → **"Gerar Cronograma"**
3. Deve criar planilha "Cronograma_LOAN-..."
4. Verifique se tem 12 parcelas

### Teste 3: Dashboard

1. Clique em **"Empréstimos"** → **"Dashboard"**
2. Deve listar o contrato criado
3. Dê duplo-clique no contrato
4. Deve mostrar detalhes

---

## 🔧 Solução de Problemas

### ❌ "Aba Empréstimos não aparece"

**Possíveis causas:**
1. CustomUI.xml não foi adicionado corretamente
2. Ribbon não foi validada
3. Add-in não está ativado

**Soluções:**
1. Reabra .xlam no Custom UI Editor
2. Valide o XML
3. Salve novamente
4. Reative o add-in

### ❌ "Formulário não abre"

**Causa:** UserForm não foi criado ou código não foi colado

**Solução:**
1. Alt + F11
2. Verifique se `frmNovoContrato` existe
3. Verifique se tem código no UserForm

### ❌ "Macro não encontrada"

**Causa:** Módulos VBA não foram importados

**Solução:**
1. Alt + F11
2. Verifique se existem 3 módulos:
   - LoanCalculator
   - LoanManager
   - RibbonCallbacks
3. Reimporte se necessário

### ❌ "Erro de compilação"

**Causa:** Referências COM faltando

**Solução:**
1. Alt + F11
2. **Ferramentas → Referências**
3. Desmarque referências COM "MISSING"
4. Marque: "Microsoft Excel XX.0 Object Library"
5. OK

### ❌ "Botões da Ribbon não funcionam"

**Causa:** RibbonCallbacks não está presente ou nomes estão errados

**Solução:**
1. Verifique se módulo `RibbonCallbacks` existe
2. Verifique se funções têm exatamente os nomes do XML:
   - `OnNovoContratoClick`
   - `OnDashboardClick`
   - etc.

---

## 📊 Estrutura Final do VBAProject

```
VBAProject (LoanManager.xlam)
├── Microsoft Excel Objects
│   └── ThisWorkbook
├── Forms
│   ├── frmNovoContrato
│   ├── frmDashboard
│   └── frmPagamento
└── Modules
    ├── LoanCalculator
    ├── LoanManager
    └── RibbonCallbacks
```

---

## 🎯 Próximos Passos

1. ✅ Teste todos os formulários
2. ✅ Crie contratos de teste
3. ✅ Gere cronogramas
4. ✅ Registre pagamentos
5. ✅ Explore o Dashboard
6. 📖 Consulte [README_XLAM.md](README_XLAM.md) para documentação completa

---

## 💡 Dicas

- **Backup**: Sempre faça backup do .xlam antes de modificar
- **Versões**: Salve versões incrementais (v1.0, v1.1, etc.)
- **Testes**: Teste em arquivo separado antes de usar em produção
- **Debugging**: Use `Debug.Print` e Janela Imediata (Ctrl+G) para debug

---

## 📞 Suporte

**Dúvidas?**
1. Consulte [README_XLAM.md](README_XLAM.md)
2. Revise este guia
3. Verifique o código VBA (Alt + F11)

---

**Tempo estimado de instalação:**
- Básica (sem Ribbon): 15-20 minutos
- Completa (com Ribbon): 25-30 minutos

**Sucesso!** 🎉
