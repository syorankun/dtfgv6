Attribute VB_Name = "RibbonCallbacks"
' ============================================================================
' Módulo: RibbonCallbacks
' Descrição: Callbacks para botões da Ribbon customizada
' Autor: DJ DataForge
' Versão: 1.0.0
' ============================================================================

Option Explicit

' Variável global para armazenar referência da Ribbon
Public ribbonUI As IRibbonUI

' ============================================================================
' EVENTO: Ribbon carregada
' ============================================================================
Public Sub OnRibbonLoad(ribbon As IRibbonUI)
    ' Armazena referência da ribbon para invalidações futuras
    Set ribbonUI = ribbon
End Sub

' ============================================================================
' CALLBACK: Botão Novo Contrato
' ============================================================================
Public Sub OnNovoContratoClick(control As IRibbonControl)
    On Error GoTo ErroHandler
    frmNovoContrato.Show
    Exit Sub

ErroHandler:
    MsgBox "Erro ao abrir formulário de novo contrato: " & Err.Description, vbCritical, "Erro"
End Sub

' ============================================================================
' CALLBACK: Botão Dashboard
' ============================================================================
Public Sub OnDashboardClick(control As IRibbonControl)
    On Error GoTo ErroHandler
    frmDashboard.Show
    Exit Sub

ErroHandler:
    MsgBox "Erro ao abrir dashboard: " & Err.Description, vbCritical, "Erro"
End Sub

' ============================================================================
' CALLBACK: Botão Gerar Cronograma
' ============================================================================
Public Sub OnGerarCronogramaClick(control As IRibbonControl)
    On Error GoTo ErroHandler

    ' Verifica se está na planilha de contratos
    If ActiveSheet.Name <> "Contratos" Then
        MsgBox "Por favor, selecione um contrato na planilha 'Contratos' e tente novamente.", _
               vbInformation, "Atenção"
        Exit Sub
    End If

    ' Chama função rápida
    LoanManager.GerarCronogramaRapido
    Exit Sub

ErroHandler:
    MsgBox "Erro ao gerar cronograma: " & Err.Description, vbCritical, "Erro"
End Sub

' ============================================================================
' CALLBACK: Botão Registrar Pagamento
' ============================================================================
Public Sub OnRegistrarPagamentoClick(control As IRibbonControl)
    On Error GoTo ErroHandler

    ' Verifica se está na planilha de contratos
    If ActiveSheet.Name <> "Contratos" Then
        MsgBox "Por favor, selecione um contrato na planilha 'Contratos' e tente novamente.", _
               vbInformation, "Atenção"
        Exit Sub
    End If

    ' Chama função rápida
    LoanManager.RegistrarPagamentoRapido
    Exit Sub

ErroHandler:
    MsgBox "Erro ao registrar pagamento: " & Err.Description, vbCritical, "Erro"
End Sub

' ============================================================================
' CALLBACK: Botão Abrir Contratos
' ============================================================================
Public Sub OnAbrirContratosClick(control As IRibbonControl)
    On Error GoTo ErroHandler

    ' Verifica se planilha existe
    Dim ws As Worksheet
    Set ws = Nothing

    On Error Resume Next
    Set ws = ThisWorkbook.Worksheets("Contratos")
    On Error GoTo 0

    If ws Is Nothing Then
        MsgBox "Planilha 'Contratos' não encontrada." & vbCrLf & _
               "Crie um contrato primeiro.", vbInformation, "Atenção"
        Exit Sub
    End If

    ' Ativa planilha
    ws.Activate
    ws.Range("A1").Select
    Exit Sub

ErroHandler:
    MsgBox "Erro ao abrir planilha de contratos: " & Err.Description, vbCritical, "Erro"
End Sub

' ============================================================================
' CALLBACK: Botão Atualizar
' ============================================================================
Public Sub OnAtualizarClick(control As IRibbonControl)
    On Error GoTo ErroHandler

    ' Recalcula todas as fórmulas
    Application.CalculateFull

    ' Atualiza tela
    ActiveSheet.Calculate

    MsgBox "Dados atualizados com sucesso!", vbInformation, "Atualizar"
    Exit Sub

ErroHandler:
    MsgBox "Erro ao atualizar: " & Err.Description, vbCritical, "Erro"
End Sub

' ============================================================================
' CALLBACK: Botão Sobre
' ============================================================================
Public Sub OnSobreClick(control As IRibbonControl)
    Dim msg As String

    msg = "LOAN MANAGER - EXCEL ADD-IN" & vbCrLf & vbCrLf
    msg = msg & "Versão: 1.0.0" & vbCrLf
    msg = msg & "Autor: DJ DataForge" & vbCrLf
    msg = msg & "Data: Janeiro 2025" & vbCrLf & vbCrLf
    msg = msg & "Gestão completa de empréstimos com:" & vbCrLf
    msg = msg & "• Criação de contratos (PRICE e SAC)" & vbCrLf
    msg = msg & "• Geração de cronogramas" & vbCrLf
    msg = msg & "• Registro de pagamentos" & vbCrLf
    msg = msg & "• Ledger de transações" & vbCrLf
    msg = msg & "• Suporte a múltiplas moedas" & vbCrLf & vbCrLf
    msg = msg & "Baseado no Loan Plugin do DJ DataForge v6"

    MsgBox msg, vbInformation, "Sobre o Loan Manager"
End Sub

' ============================================================================
' CALLBACK: Botão Ajuda
' ============================================================================
Public Sub OnAjudaClick(control As IRibbonControl)
    Dim msg As String

    msg = "AJUDA - LOAN MANAGER" & vbCrLf & vbCrLf

    msg = msg & "1. CRIAR CONTRATO:" & vbCrLf
    msg = msg & "   • Clique em 'Novo Contrato'" & vbCrLf
    msg = msg & "   • Preencha os dados" & vbCrLf
    msg = msg & "   • Confirme" & vbCrLf & vbCrLf

    msg = msg & "2. GERAR CRONOGRAMA:" & vbCrLf
    msg = msg & "   • Abra a planilha 'Contratos'" & vbCrLf
    msg = msg & "   • Selecione uma linha de contrato" & vbCrLf
    msg = msg & "   • Clique em 'Gerar Cronograma'" & vbCrLf & vbCrLf

    msg = msg & "3. REGISTRAR PAGAMENTO:" & vbCrLf
    msg = msg & "   • Abra a planilha 'Contratos'" & vbCrLf
    msg = msg & "   • Selecione uma linha de contrato" & vbCrLf
    msg = msg & "   • Clique em 'Registrar Pagamento'" & vbCrLf
    msg = msg & "   • Informe valor e data" & vbCrLf & vbCrLf

    msg = msg & "4. DASHBOARD:" & vbCrLf
    msg = msg & "   • Clique em 'Dashboard'" & vbCrLf
    msg = msg & "   • Visualize todos os contratos" & vbCrLf
    msg = msg & "   • Gerencie operações" & vbCrLf & vbCrLf

    msg = msg & "Para mais informações, consulte o README."

    MsgBox msg, vbInformation, "Ajuda"
End Sub

' ============================================================================
' FUNÇÃO AUXILIAR: Invalidar Ribbon (forçar atualização)
' ============================================================================
Public Sub InvalidateRibbon()
    On Error Resume Next
    If Not ribbonUI Is Nothing Then
        ribbonUI.Invalidate
    End If
    On Error GoTo 0
End Sub

' ============================================================================
' FUNÇÃO AUXILIAR: Invalidar controle específico
' ============================================================================
Public Sub InvalidateControl(controlID As String)
    On Error Resume Next
    If Not ribbonUI Is Nothing Then
        ribbonUI.InvalidateControl controlID
    End If
    On Error GoTo 0
End Sub
