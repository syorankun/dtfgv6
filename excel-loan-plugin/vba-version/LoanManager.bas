Attribute VB_Name = "LoanManager"
' ============================================================================
' Módulo: LoanManager
' Descrição: Gerenciador de contratos de empréstimo
' Autor: DJ DataForge
' Versão: 1.0.0
' ============================================================================

Option Explicit

' Constantes
Private Const SHEET_CONTRATOS As String = "Contratos"
Private Const SHEET_PREFIX_CRONOGRAMA As String = "Cronograma_"
Private Const SHEET_PREFIX_LEDGER As String = "Ledger_"

' ============================================================================
' FUNÇÕES AUXILIARES
' ============================================================================

Private Function PlanilhaExiste(ByVal nomeSheet As String) As Boolean
    ' Verifica se uma planilha existe
    Dim ws As Worksheet
    On Error Resume Next
    Set ws = ThisWorkbook.Worksheets(nomeSheet)
    PlanilhaExiste = Not (ws Is Nothing)
    On Error GoTo 0
End Function

Private Function CriarOuLimparPlanilha(ByVal nomeSheet As String) As Worksheet
    ' Cria ou limpa uma planilha
    Dim ws As Worksheet

    If PlanilhaExiste(nomeSheet) Then
        Set ws = ThisWorkbook.Worksheets(nomeSheet)
        ws.Cells.Clear
    Else
        Set ws = ThisWorkbook.Worksheets.Add(After:=ThisWorkbook.Worksheets(ThisWorkbook.Worksheets.Count))
        ws.Name = nomeSheet
    End If

    Set CriarOuLimparPlanilha = ws
End Function

Private Function GerarIDContrato() As String
    ' Gera ID único para contrato
    Dim timestamp As String
    Dim random As String

    timestamp = Format(Now, "yyyymmddhhnnss")
    random = Mid(WorksheetFunction.Dec2Hex(Int(Rnd() * 1000000)), 1, 6)

    GerarIDContrato = "LOAN-" & timestamp & "-" & random
End Function

' ============================================================================
' GERENCIAMENTO DE CONTRATOS
' ============================================================================

Public Function CriarContrato(ByVal tipo As String, _
                             ByVal contraparte As String, _
                             ByVal moeda As String, _
                             ByVal principal As Double, _
                             ByVal dataInicio As Date, _
                             ByVal dataVencimento As Date, _
                             ByVal taxaJuros As Double, _
                             ByVal sistema As String, _
                             ByVal periodicidade As String, _
                             ByVal numeroParcelas As Long) As String
    ' Cria um novo contrato de empréstimo
    ' Retorna o ID do contrato criado

    Dim ws As Worksheet
    Dim ultimaLinha As Long
    Dim contratoID As String
    Dim taxaFX As Double

    ' Gera ID do contrato
    contratoID = GerarIDContrato()

    ' Taxa FX padrão (simplificado)
    taxaFX = 1 ' Para BRL, ou solicitar input

    ' Cria ou obtém planilha de contratos
    If Not PlanilhaExiste(SHEET_CONTRATOS) Then
        Set ws = CriarOuLimparPlanilha(SHEET_CONTRATOS)
        ' Cria cabeçalho
        With ws
            .Cells(1, 1).Value = "ID"
            .Cells(1, 2).Value = "Tipo"
            .Cells(1, 3).Value = "Contraparte"
            .Cells(1, 4).Value = "Moeda"
            .Cells(1, 5).Value = "Principal"
            .Cells(1, 6).Value = "Taxa Juros (%)"
            .Cells(1, 7).Value = "Data Início"
            .Cells(1, 8).Value = "Data Vencimento"
            .Cells(1, 9).Value = "Sistema"
            .Cells(1, 10).Value = "Periodicidade"
            .Cells(1, 11).Value = "Parcelas"
            .Cells(1, 12).Value = "Saldo Atual"
            .Cells(1, 13).Value = "Status"
            .Cells(1, 14).Value = "Criado Em"

            ' Formata cabeçalho
            .Range("A1:N1").Font.Bold = True
            .Range("A1:N1").Interior.Color = RGB(68, 114, 196)
            .Range("A1:N1").Font.Color = RGB(255, 255, 255)
        End With
    Else
        Set ws = ThisWorkbook.Worksheets(SHEET_CONTRATOS)
    End If

    ' Adiciona contrato
    ultimaLinha = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row + 1

    With ws
        .Cells(ultimaLinha, 1).Value = contratoID
        .Cells(ultimaLinha, 2).Value = tipo
        .Cells(ultimaLinha, 3).Value = contraparte
        .Cells(ultimaLinha, 4).Value = moeda
        .Cells(ultimaLinha, 5).Value = principal
        .Cells(ultimaLinha, 5).NumberFormat = "#,##0.00"
        .Cells(ultimaLinha, 6).Value = taxaJuros
        .Cells(ultimaLinha, 6).NumberFormat = "0.00"
        .Cells(ultimaLinha, 7).Value = dataInicio
        .Cells(ultimaLinha, 7).NumberFormat = "dd/mm/yyyy"
        .Cells(ultimaLinha, 8).Value = dataVencimento
        .Cells(ultimaLinha, 8).NumberFormat = "dd/mm/yyyy"
        .Cells(ultimaLinha, 9).Value = sistema
        .Cells(ultimaLinha, 10).Value = periodicidade
        .Cells(ultimaLinha, 11).Value = numeroParcelas
        .Cells(ultimaLinha, 12).Value = principal
        .Cells(ultimaLinha, 12).NumberFormat = "#,##0.00"
        .Cells(ultimaLinha, 13).Value = "ATIVO"
        .Cells(ultimaLinha, 14).Value = Now
        .Cells(ultimaLinha, 14).NumberFormat = "dd/mm/yyyy hh:mm"
    End With

    ' Auto-ajusta colunas
    ws.Columns("A:N").AutoFit

    ' Cria ledger inicial
    Call CriarEntradaLedger(contratoID, dataInicio, "CONTRATO", principal, principal, "Criação do contrato")

    CriarContrato = contratoID

    MsgBox "Contrato " & contratoID & " criado com sucesso!", vbInformation, "Sucesso"
End Function

' ============================================================================
' GERAÇÃO DE CRONOGRAMAS
' ============================================================================

Public Sub GerarCronograma(ByVal contratoID As String)
    ' Gera cronograma de pagamentos para um contrato

    Dim wsContratos As Worksheet
    Dim wsCronograma As Worksheet
    Dim linha As Long
    Dim encontrado As Boolean
    Dim principal As Double
    Dim taxaJuros As Double
    Dim dataInicio As Date
    Dim sistema As String
    Dim periodicidade As String
    Dim numeroParcelas As Long
    Dim contraparte As String
    Dim moeda As String

    ' Busca contrato
    Set wsContratos = ThisWorkbook.Worksheets(SHEET_CONTRATOS)
    encontrado = False

    For linha = 2 To wsContratos.Cells(wsContratos.Rows.Count, 1).End(xlUp).Row
        If wsContratos.Cells(linha, 1).Value = contratoID Then
            encontrado = True
            contraparte = wsContratos.Cells(linha, 3).Value
            moeda = wsContratos.Cells(linha, 4).Value
            principal = wsContratos.Cells(linha, 5).Value
            taxaJuros = wsContratos.Cells(linha, 6).Value
            dataInicio = wsContratos.Cells(linha, 7).Value
            sistema = wsContratos.Cells(linha, 9).Value
            periodicidade = wsContratos.Cells(linha, 10).Value
            numeroParcelas = wsContratos.Cells(linha, 11).Value
            Exit For
        End If
    Next linha

    If Not encontrado Then
        MsgBox "Contrato " & contratoID & " não encontrado!", vbExclamation, "Erro"
        Exit Sub
    End If

    ' Cria planilha de cronograma
    Set wsCronograma = CriarOuLimparPlanilha(SHEET_PREFIX_CRONOGRAMA & contratoID)

    ' Informações do contrato
    With wsCronograma
        .Cells(1, 1).Value = "CRONOGRAMA DE PAGAMENTOS - " & contratoID
        .Cells(1, 1).Font.Bold = True
        .Cells(1, 1).Font.Size = 14
        .Range("A1:G1").Merge

        .Cells(2, 1).Value = "Contraparte:"
        .Cells(2, 2).Value = contraparte
        .Cells(3, 1).Value = "Sistema:"
        .Cells(3, 2).Value = sistema
        .Cells(4, 1).Value = "Taxa:"
        .Cells(4, 2).Value = taxaJuros & "% a.a."
        .Cells(5, 1).Value = "Moeda:"
        .Cells(5, 2).Value = moeda
    End With

    ' Gera cronograma baseado no sistema
    If UCase(sistema) = "PRICE" Then
        Call LoanCalculator.GerarCronogramaPRICE(wsCronograma, principal, taxaJuros, _
                                                 numeroParcelas, dataInicio, periodicidade, 7)
    ElseIf UCase(sistema) = "SAC" Then
        Call LoanCalculator.GerarCronogramaSAC(wsCronograma, principal, taxaJuros, _
                                              numeroParcelas, dataInicio, periodicidade, 7)
    Else
        MsgBox "Sistema " & sistema & " não suportado!", vbExclamation, "Erro"
        Exit Sub
    End If

    ' Ativa planilha
    wsCronograma.Activate

    MsgBox "Cronograma gerado com sucesso na planilha: " & wsCronograma.Name, vbInformation, "Sucesso"
End Sub

' ============================================================================
' GERENCIAMENTO DE PAGAMENTOS
' ============================================================================

Public Sub RegistrarPagamento(ByVal contratoID As String, _
                             ByVal valor As Double, _
                             ByVal dataPagamento As Date, _
                             Optional ByVal descricao As String = "Pagamento")
    ' Registra um pagamento em um contrato

    Dim wsContratos As Worksheet
    Dim linha As Long
    Dim encontrado As Boolean
    Dim saldoAtual As Double
    Dim novoSaldo As Double

    ' Busca contrato
    Set wsContratos = ThisWorkbook.Worksheets(SHEET_CONTRATOS)
    encontrado = False

    For linha = 2 To wsContratos.Cells(wsContratos.Rows.Count, 1).End(xlUp).Row
        If wsContratos.Cells(linha, 1).Value = contratoID Then
            encontrado = True
            saldoAtual = wsContratos.Cells(linha, 12).Value
            novoSaldo = saldoAtual - valor

            ' Atualiza saldo
            wsContratos.Cells(linha, 12).Value = novoSaldo

            ' Atualiza status se quitado
            If novoSaldo <= 0.01 Then
                wsContratos.Cells(linha, 13).Value = "QUITADO"
                wsContratos.Cells(linha, 13).Interior.Color = RGB(146, 208, 80)
            End If

            Exit For
        End If
    Next linha

    If Not encontrado Then
        MsgBox "Contrato " & contratoID & " não encontrado!", vbExclamation, "Erro"
        Exit Sub
    End If

    ' Registra no ledger
    Call CriarEntradaLedger(contratoID, dataPagamento, "PAGAMENTO", -valor, novoSaldo, descricao)

    MsgBox "Pagamento de " & Format(valor, "#,##0.00") & " registrado com sucesso!" & vbCrLf & _
           "Novo saldo: " & Format(novoSaldo, "#,##0.00"), vbInformation, "Sucesso"
End Sub

' ============================================================================
' GERENCIAMENTO DE LEDGER
' ============================================================================

Private Sub CriarEntradaLedger(ByVal contratoID As String, _
                               ByVal dataOperacao As Date, _
                               ByVal tipoOperacao As String, _
                               ByVal valor As Double, _
                               ByVal saldoApos As Double, _
                               ByVal descricao As String)
    ' Cria entrada no ledger de um contrato

    Dim ws As Worksheet
    Dim nomeSheet As String
    Dim ultimaLinha As Long

    nomeSheet = SHEET_PREFIX_LEDGER & contratoID

    ' Cria ou obtém planilha de ledger
    If Not PlanilhaExiste(nomeSheet) Then
        Set ws = CriarOuLimparPlanilha(nomeSheet)
        ' Cria cabeçalho
        With ws
            .Cells(1, 1).Value = "Data"
            .Cells(1, 2).Value = "Tipo"
            .Cells(1, 3).Value = "Valor"
            .Cells(1, 4).Value = "Saldo Após"
            .Cells(1, 5).Value = "Descrição"

            ' Formata cabeçalho
            .Range("A1:E1").Font.Bold = True
            .Range("A1:E1").Interior.Color = RGB(112, 173, 71)
            .Range("A1:E1").Font.Color = RGB(255, 255, 255)
        End With
    Else
        Set ws = ThisWorkbook.Worksheets(nomeSheet)
    End If

    ' Adiciona entrada
    ultimaLinha = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row + 1

    With ws
        .Cells(ultimaLinha, 1).Value = dataOperacao
        .Cells(ultimaLinha, 1).NumberFormat = "dd/mm/yyyy"
        .Cells(ultimaLinha, 2).Value = tipoOperacao
        .Cells(ultimaLinha, 3).Value = valor
        .Cells(ultimaLinha, 3).NumberFormat = "#,##0.00"
        .Cells(ultimaLinha, 4).Value = saldoApos
        .Cells(ultimaLinha, 4).NumberFormat = "#,##0.00"
        .Cells(ultimaLinha, 5).Value = descricao
    End With

    ' Auto-ajusta colunas
    ws.Columns("A:E").AutoFit
End Sub

' ============================================================================
' FUNÇÕES DE CONSULTA
' ============================================================================

Public Function ObterSaldoContrato(ByVal contratoID As String) As Double
    ' Retorna o saldo atual de um contrato

    Dim wsContratos As Worksheet
    Dim linha As Long

    Set wsContratos = ThisWorkbook.Worksheets(SHEET_CONTRATOS)

    For linha = 2 To wsContratos.Cells(wsContratos.Rows.Count, 1).End(xlUp).Row
        If wsContratos.Cells(linha, 1).Value = contratoID Then
            ObterSaldoContrato = wsContratos.Cells(linha, 12).Value
            Exit Function
        End If
    Next linha

    ObterSaldoContrato = 0
End Function

Public Function ObterStatusContrato(ByVal contratoID As String) As String
    ' Retorna o status de um contrato

    Dim wsContratos As Worksheet
    Dim linha As Long

    Set wsContratos = ThisWorkbook.Worksheets(SHEET_CONTRATOS)

    For linha = 2 To wsContratos.Cells(wsContratos.Rows.Count, 1).End(xlUp).Row
        If wsContratos.Cells(linha, 1).Value = contratoID Then
            ObterStatusContrato = wsContratos.Cells(linha, 13).Value
            Exit Function
        End If
    Next linha

    ObterStatusContrato = "NÃO ENCONTRADO"
End Function

' ============================================================================
' INTERFACE - ABRIR FORMULÁRIOS
' ============================================================================

Public Sub AbrirFormularioNovoContrato()
    ' Abre formulário para criar novo contrato
    frmNovoContrato.Show
End Sub

Public Sub AbrirDashboard()
    ' Abre dashboard de contratos
    frmDashboard.Show
End Sub

' ============================================================================
' AÇÕES RÁPIDAS
' ============================================================================

Public Sub GerarCronogramaRapido()
    ' Gera cronograma para contrato selecionado na planilha

    Dim contratoID As String

    If ActiveSheet.Name <> SHEET_CONTRATOS Then
        MsgBox "Por favor, selecione um contrato na planilha 'Contratos'", vbExclamation, "Atenção"
        Exit Sub
    End If

    If ActiveCell.Row < 2 Then
        MsgBox "Por favor, selecione uma linha de contrato", vbExclamation, "Atenção"
        Exit Sub
    End If

    contratoID = ActiveSheet.Cells(ActiveCell.Row, 1).Value

    If contratoID = "" Then
        MsgBox "ID do contrato não encontrado", vbExclamation, "Erro"
        Exit Sub
    End If

    Call GerarCronograma(contratoID)
End Sub

Public Sub RegistrarPagamentoRapido()
    ' Registra pagamento para contrato selecionado

    Dim contratoID As String
    Dim valor As String
    Dim dataPgto As String

    If ActiveSheet.Name <> SHEET_CONTRATOS Then
        MsgBox "Por favor, selecione um contrato na planilha 'Contratos'", vbExclamation, "Atenção"
        Exit Sub
    End If

    If ActiveCell.Row < 2 Then
        MsgBox "Por favor, selecione uma linha de contrato", vbExclamation, "Atenção"
        Exit Sub
    End If

    contratoID = ActiveSheet.Cells(ActiveCell.Row, 1).Value

    If contratoID = "" Then
        MsgBox "ID do contrato não encontrado", vbExclamation, "Erro"
        Exit Sub
    End If

    ' Solicita dados do pagamento
    valor = InputBox("Valor do pagamento:", "Registrar Pagamento")
    If valor = "" Then Exit Sub

    dataPgto = InputBox("Data do pagamento (dd/mm/aaaa):", "Registrar Pagamento", Format(Date, "dd/mm/yyyy"))
    If dataPgto = "" Then Exit Sub

    Call RegistrarPagamento(contratoID, CDbl(valor), CDate(dataPgto))
End Sub
