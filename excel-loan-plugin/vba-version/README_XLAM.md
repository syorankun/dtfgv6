# 💰 Loan Manager - Excel Add-in (.xlam)

**Versão VBA Standalone** - Importar diretamente no Excel, sem servidor HTTP!

---

## 📦 O que você recebeu

```
vba-version/
├── README_XLAM.md          ← Você está aqui
├── LoanCalculator.bas      ← Módulo de cálculos financeiros
├── LoanManager.bas         ← Módulo de gestão de contratos
└── INSTRUÇÕES.md           ← Instruções passo a passo
```

---

## ⚡ Instalação Rápida (5 minutos)

### Opção 1: Criar .xlam do Zero (Recomendado)

1. **Abra o Excel**
2. **Ative o Modo Desenvolvedor**:
   - Arquivo → Opções → Personalizar Faixa de Opções
   - Marque "Desenvolvedor"
3. **Abra o VBA Editor**: Pressione `Alt + F11`
4. **Importe os Módulos**:
   - VBAProject (sua pasta de trabalho) → Clique com botão direito
   - Inserir → Módulo
   - Repita 2 vezes (para 2 módulos)
5. **Cole o código**:
   - Abra `LoanCalculator.bas` em um editor de texto
   - Copie TODO o conteúdo
   - Cole no primeiro módulo do VBA
   - Renomeie o módulo para "LoanCalculator" (F4 → Properties)
   - Repita para `LoanManager.bas` no segundo módulo
6. **Salve como Add-in**:
   - Arquivo → Salvar Como
   - Tipo: **Suplemento do Excel (.xlam)**
   - Nome: `LoanManager.xlam`
   - Local: Pasta de suplementos do Excel (sugerida automaticamente)
7. **Ative o Add-in**:
   - Feche o VBA Editor
   - Excel: Arquivo → Opções → Suplementos
   - Gerenciar: Suplementos do Excel → Ir
   - Marque "LoanManager"
   - OK

✅ **Pronto!** O add-in está instalado e disponível em todas as pastas de trabalho.

### Opção 2: Usar Arquivo .xlam Pronto (Mais Rápido)

Se você recebeu o arquivo `LoanManager.xlam` pronto:

1. **Copie** `LoanManager.xlam` para a pasta de suplementos:
   - Windows: `C:\Users\[SeuUsuário]\AppData\Roaming\Microsoft\AddIns\`
   - Mac: `/Users/[SeuUsuário]/Library/Group Containers/UBF8T346G9.Office/User Content/Add-Ins/`

2. **Ative no Excel**:
   - Arquivo → Opções → Suplementos
   - Gerenciar: Suplementos do Excel → Ir
   - Procurar... → Selecione `LoanManager.xlam`
   - Marque a caixa
   - OK

✅ **Pronto!**

---

## 🚀 Como Usar

### 1. Criar Novo Contrato

**Método A: Via Código VBA**

Pressione `Alt + F11` para abrir VBA Editor, depois `Ctrl + G` para Janela Imediata, e execute:

```vba
Call LoanManager.CriarContrato("CAPTADO", "Banco ABC", "BRL", 100000, #1/1/2025#, #12/31/2025#, 12.5, "PRICE", "MENSAL", 12)
```

**Método B: Via Macro** (Mais fácil)

1. Pressione `Alt + F8`
2. Digite: `LoanManager.AbrirFormularioNovoContrato`
3. Executar

*(Nota: Esta macro abrirá um UserForm se você criou um, caso contrário use Método A)*

**Método C: Criar Manualmente na Planilha**

1. O add-in cria automaticamente a planilha "Contratos"
2. Preencha uma nova linha com os dados
3. Use as macros para gerar cronograma

### 2. Gerar Cronograma

**Opção 1: Automático**

1. Abra a planilha "Contratos"
2. Clique em qualquer célula da linha do contrato
3. Pressione `Alt + F8`
4. Execute: `LoanManager.GerarCronogramaRapido`

**Opção 2: Via Código**

```vba
Call LoanManager.GerarCronograma("LOAN-20250101120000-A1B2C3")
```

### 3. Registrar Pagamento

**Opção 1: Automático**

1. Abra a planilha "Contratos"
2. Clique em qualquer célula da linha do contrato
3. Pressione `Alt + F8`
4. Execute: `LoanManager.RegistrarPagamentoRapido`
5. Informe valor e data

**Opção 2: Via Código**

```vba
Call LoanManager.RegistrarPagamento("LOAN-20250101120000-A1B2C3", 10000, #2/1/2025#, "Primeira parcela")
```

---

## 📊 Estrutura Criada Automaticamente

O add-in cria automaticamente as seguintes planilhas:

### 1. **Contratos**
Lista completa de todos os contratos:
- ID, Tipo, Contraparte, Moeda, Principal
- Taxa de Juros, Datas, Sistema, Periodicidade
- Saldo Atual, Status

### 2. **Cronograma_[ID]**
Cronograma de pagamentos detalhado para cada contrato:
- Parcela, Data Vencimento
- Saldo Inicial, Valor Parcela
- Juros, Amortização, Saldo Final
- Totais calculados automaticamente

### 3. **Ledger_[ID]**
Histórico completo de transações:
- Data, Tipo de Operação
- Valor, Saldo Após Operação
- Descrição

---

## 🛠 Funções Disponíveis

### LoanCalculator (Cálculos)

```vba
' Arredondamento
valor = LoanCalculator.RoundDecimal(123.456, 2) ' 123.46

' Dias entre datas
dias = LoanCalculator.DiasEntreDatas(#1/1/2025#, #12/31/2025#, "ACT/365")

' Taxa periódica
taxaMensal = LoanCalculator.TaxaPeriodica(12.5, "EXPONENCIAL", "ACT/365", 30)

' PRICE - Valor da parcela
parcela = LoanCalculator.CalcularPMT(100000, 0.01, 12)

' PRICE - Juros de uma parcela
juros = LoanCalculator.CalcularJurosParcela(100000, 0.01, 5, 12)

' SAC - Valor da parcela
parcelaSAC = LoanCalculator.CalcularParcelaSAC(100000, 0.01, 5, 12)

' Adicionar período a data
proximaData = LoanCalculator.AdicionarPeriodo(#1/1/2025#, 1, "MENSAL")

' Gerar cronograma completo PRICE
Call LoanCalculator.GerarCronogramaPRICE(ActiveSheet, 100000, 12.5, 12, #1/1/2025#, "MENSAL", 1)

' Gerar cronograma completo SAC
Call LoanCalculator.GerarCronogramaSAC(ActiveSheet, 100000, 12.5, 12, #1/1/2025#, "MENSAL", 1)
```

### LoanManager (Gestão)

```vba
' Criar contrato
contratoID = LoanManager.CriarContrato("CAPTADO", "Banco XYZ", "BRL", _
                                       100000, #1/1/2025#, #12/31/2025#, _
                                       12.5, "PRICE", "MENSAL", 12)

' Gerar cronograma
Call LoanManager.GerarCronograma("LOAN-123456")

' Registrar pagamento
Call LoanManager.RegistrarPagamento("LOAN-123456", 10000, #2/1/2025#, "Pagamento parcela 1")

' Consultar saldo
saldo = LoanManager.ObterSaldoContrato("LOAN-123456")

' Consultar status
status = LoanManager.ObterStatusContrato("LOAN-123456")

' Ações rápidas (célula selecionada)
Call LoanManager.GerarCronogramaRapido()
Call LoanManager.RegistrarPagamentoRapido()
```

---

## 🎯 Exemplos Completos

### Exemplo 1: Empréstimo PRICE de R$ 100 mil

```vba
Sub ExemploPRICE()
    Dim contratoID As String

    ' Cria contrato
    contratoID = LoanManager.CriarContrato( _
        "CAPTADO", _           ' Tipo
        "Banco ABC", _         ' Contraparte
        "BRL", _               ' Moeda
        100000, _              ' Principal
        #1/1/2025#, _          ' Data Início
        #12/31/2025#, _        ' Data Vencimento
        12.5, _                ' Taxa Juros (% a.a.)
        "PRICE", _             ' Sistema
        "MENSAL", _            ' Periodicidade
        12 _                   ' Número de Parcelas
    )

    ' Gera cronograma
    Call LoanManager.GerarCronograma(contratoID)

    MsgBox "Contrato criado: " & contratoID
End Sub
```

### Exemplo 2: Empréstimo SAC de R$ 500 mil

```vba
Sub ExemploSAC()
    Dim contratoID As String

    contratoID = LoanManager.CriarContrato( _
        "CAPTADO", "Banco Internacional", "BRL", _
        500000, #1/1/2025#, #12/31/2026#, _
        10, "SAC", "MENSAL", 24 _
    )

    Call LoanManager.GerarCronograma(contratoID)

    ' Registra primeiro pagamento
    Call LoanManager.RegistrarPagamento(contratoID, 25000, #2/1/2025#, "Primeira parcela")
End Sub
```

### Exemplo 3: Cálculo Direto (Sem Salvar Contrato)

```vba
Sub CalculoDireto()
    ' Gera cronograma direto na planilha ativa
    Call LoanCalculator.GerarCronogramaPRICE( _
        ActiveSheet, _      ' Planilha destino
        100000, _           ' Principal
        12.5, _             ' Taxa anual (%)
        12, _               ' Parcelas
        #1/1/2025#, _       ' Data início
        "MENSAL", _         ' Periodicidade
        1 _                 ' Linha inicial
    )
End Sub
```

---

## ⚙️ Personalização

### Adicionar Botão na Ribbon

Para adicionar um botão personalizado na faixa de opções:

1. Arquivo → Opções → Personalizar Faixa de Opções
2. Novo Grupo (ex: "Empréstimos")
3. Adicionar → Macros
4. Selecione:
   - `LoanManager.AbrirFormularioNovoContrato`
   - `LoanManager.GerarCronogramaRapido`
   - `LoanManager.RegistrarPagamentoRapido`

### Criar Atalhos de Teclado

No VBA Editor, adicione um módulo:

```vba
Sub Auto_Open()
    Application.OnKey "^+N", "LoanManager.AbrirFormularioNovoContrato"  ' Ctrl+Shift+N
    Application.OnKey "^+C", "LoanManager.GerarCronogramaRapido"        ' Ctrl+Shift+C
    Application.OnKey "^+P", "LoanManager.RegistrarPagamentoRapido"     ' Ctrl+Shift+P
End Sub
```

---

## 🔧 Solução de Problemas

### ❌ "Macro não encontrada"

**Solução:**
1. Verifique se o add-in está ativado (Arquivo → Opções → Suplementos)
2. Feche e reabra o Excel
3. Verifique se os módulos foram importados corretamente (Alt + F11)

### ❌ "Erro de compilação"

**Solução:**
1. VBA Editor → Ferramentas → Referências
2. Desmarque referências COM MISSING
3. Marque "Microsoft Excel XX.0 Object Library"

### ❌ "Planilha não encontrada"

**Solução:**
- A planilha "Contratos" é criada automaticamente ao criar o primeiro contrato
- Execute `LoanManager.CriarContrato(...)` primeiro

### ❌ "Macros desabilitadas"

**Solução:**
1. Arquivo → Opções → Central de Confiabilidade → Configurações
2. Configurações de Macro → Habilitar todas as macros

---

## 📋 Checklist de Instalação

- [ ] Excel está instalado (2016 ou superior)
- [ ] Modo Desenvolvedor ativado
- [ ] Módulos VBA importados (LoanCalculator + LoanManager)
- [ ] Arquivo salvo como .xlam
- [ ] Add-in ativado em Opções → Suplementos
- [ ] Macros habilitadas
- [ ] Testado: Criar contrato de teste
- [ ] Testado: Gerar cronograma
- [ ] Testado: Registrar pagamento

---

## 💡 Dicas

1. **Backup**: Sempre mantenha backup dos seus arquivos Excel
2. **Testes**: Teste com contratos fictícios primeiro
3. **Documentação**: Mantenha nota dos IDs dos contratos
4. **Segurança**: Configure macros para "Desabilitar com notificação"

---

## 📞 Suporte

Dúvidas? Problemas?

1. Verifique a [Documentação Completa](../LOAN_PLUGIN_DOCUMENTATION.md)
2. Revise os exemplos acima
3. Consulte o código VBA (Alt + F11)

---

## 🎓 Recursos Adicionais

- **Convenções de Dias**: 30/360, ACT/365, ACT/360, BUS/252
- **Sistemas**: PRICE (parcela fixa) e SAC (amortização constante)
- **Moedas**: BRL, USD, EUR, GBP (fixas, sem conversão automática)
- **Periodicidades**: MENSAL, TRIMESTRAL, SEMESTRAL, ANUAL

---

## ✅ Pronto para Usar!

Após seguir os passos acima, você terá um **Excel Add-in completo** para gestão de empréstimos, disponível em **qualquer pasta de trabalho**, sem precisar de servidor HTTP ou configurações complexas.

**Tempo de instalação:** 5 minutos
**Dependências:** Zero (apenas Excel)
**Plataforma:** Windows, Mac

---

**Versão:** 1.0.0
**Última atualização:** Janeiro 2025
**Autor:** DJ DataForge
