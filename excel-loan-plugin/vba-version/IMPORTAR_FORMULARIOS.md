# 📥 Como Importar os UserForms (.frm)

Os arquivos `.frm` já estão prontos e completos. Você pode importá-los diretamente no VBA Editor sem precisar criar os controles manualmente!

---

## ⚡ Método 1: Importação Direta (RECOMENDADO)

### Passo 1: Prepare os arquivos

Certifique-se de que você tem os 3 arquivos `.frm`:
- `frmNovoContrato.frm`
- `frmDashboard.frm`
- `frmPagamento.frm`

### Passo 2: Abra o VBA Editor

1. Abra o Excel
2. Pressione **Alt + F11**

### Passo 3: Importe cada formulário

Para cada um dos 3 arquivos `.frm`:

1. No VBA Editor, clique com botão direito no **VBAProject** (lado esquerdo)
2. Selecione **Arquivo → Importar Arquivo** (ou **File → Import File**)
3. Navegue até a pasta `vba-version`
4. Selecione o arquivo `.frm` desejado
5. Clique em **Abrir**

Repita para os 3 formulários.

### Passo 4: Verifique

No VBAProject você deve ver:

```
VBAProject (sua_pasta_de_trabalho)
├── Microsoft Excel Objects
│   └── ThisWorkbook
└── Forms
    ├── frmNovoContrato
    ├── frmDashboard
    └── frmPagamento
```

---

## ⚠️ Observação Importante sobre .frx

Os arquivos `.frm` fazem referência a arquivos `.frx` (recursos binários) na linha:
```
OleObjectBlob   =   "frmNomeDoForm.frx":0000
```

**Esses arquivos .frx NÃO são necessários** porque:
- Os controles estão definidos no próprio .frm
- O VBA recriará os recursos automaticamente

Se ao importar aparecer um aviso sobre `.frx` ausente, **ignore** - o formulário funcionará normalmente.

---

## 🔧 Método 2: Criação Manual (se a importação falhar)

Se por algum motivo a importação direta não funcionar, você pode criar manualmente seguindo:

1. Consulte [GUIA_COMPLETO_INSTALACAO.md](GUIA_COMPLETO_INSTALACAO.md)
2. Siga as instruções na seção "Criação dos UserForms"
3. Use os arquivos `.txt` como referência do código

---

## ✅ Próximos Passos

Depois de importar os formulários:

1. Importe os 3 módulos VBA:
   - `LoanCalculator.bas`
   - `LoanManager.bas`
   - `RibbonCallbacks.bas`

2. Salve como `.xlam`:
   - **Arquivo → Salvar Como**
   - **Tipo:** Suplemento do Excel (.xlam)

3. (Opcional) Adicione Ribbon customizada:
   - Use o Custom UI Editor
   - Importe `CustomUI.xml`

4. Ative o add-in:
   - **Arquivo → Opções → Suplementos**
   - Marque `LoanManager`

---

## 🎉 Pronto!

Seus formulários estão prontos para usar!

**Testar:**
- Abra o VBA Editor (Alt + F11)
- Pressione **F5** em qualquer formulário para testá-lo
- Ou execute via macro: `frmNovoContrato.Show`

---

# Como Importar os Formulários para o seu Projeto VBA

Para garantir que os formulários (`.frm`) sejam importados corretamente como **UserForms** e não como módulos, siga estes passos:

1.  **Não use "Arquivo > Importar Arquivo..."**. Este método pode fazer com que o VBA interprete os arquivos `.frm` como módulos de texto simples, ignorando o design do formulário.

2.  **O método correto é arrastar e soltar (Drag and Drop)**:
    *   Abra o **Editor do VBA** (`Alt+F11`) no seu arquivo Excel.
    *   Localize a pasta `excel-loan-plugin/vba-version/` no seu explorador de arquivos.
    *   Selecione os arquivos `frmDashboard.frm`, `frmNovoContrato.frm` e `frmPagamento.frm`.
    *   **Arraste** os arquivos selecionados e **solte-os** diretamente sobre o nome do seu projeto na janela do **Project Explorer** no VBA.

    Isso fará com que o VBA processe os arquivos corretamente e os adicione à pasta `Forms` do seu projeto.

3.  **Verificação**:
    *   Após a importação, os formulários devem aparecer na pasta "Forms".
    *   Dê um duplo clique em cada um para confirmar que o design visual e o código foram carregados.

## Alternativa: Recriar Manualmente

Se o método de arrastar e soltar não funcionar, você pode recriar cada formulário:

1.  **Crie um novo UserForm** (`Inserir > UserForm`) e renomeie-o (ex: `frmDashboard`).
2.  Abra o arquivo `.frm` correspondente (ex: `frmDashboard.frm`) em um editor de texto.
3.  Copie todo o bloco de código que começa com `Attribute VB_Name` até o final do arquivo.
4.  Cole este código na janela de código do UserForm que você acabou de criar no VBA.
5.  **Importante**: A definição visual dos controles (o bloco `Begin...End` no início do arquivo `.frm`) não será copiada. Você precisará adicionar os controles manualmente e nomeá-los exatamente como no arquivo `.frm` para que o código funcione.

---

**Dúvidas?** Consulte [GUIA_COMPLETO_INSTALACAO.md](GUIA_COMPLETO_INSTALACAO.md)
