VERSION 5.00
Begin {C62A69F0-16DC-11CE-9E98-00AA00574A4F} frmDashboard
   Caption         =   "Dashboard de Contratos"
   ClientHeight    =   10185
   ClientLeft      =   120
   ClientTop       =   465
   ClientWidth     =   13500
   StartUpPosition =   1  'CenterOwner
   Begin MSForms.CommandButton cmdFechar
      Caption         =   "Fechar"
      Height          =   495
      Left            =   9960
      TabIndex        =   6
      Top             =   9360
      Width           =   1695
   End
   Begin MSForms.CommandButton cmdAtualizar
      Caption         =   "Atualizar"
      Height          =   495
      Left            =   8040
      TabIndex        =   5
      Top             =   9360
      Width           =   1695
   End
   Begin MSForms.CommandButton cmdRegistrarPagamento
      Caption         =   "Registrar Pagamento"
      Height          =   495
      Left            =   5880
      TabIndex        =   4
      Top             =   9360
      Width           =   1935
   End
   Begin MSForms.CommandButton cmdGerarCronograma
      Caption         =   "Gerar Cronograma"
      Height          =   495
      Left            =   3960
      TabIndex        =   3
      Top             =   9360
      Width           =   1695
   End
   Begin MSForms.CommandButton cmdNovoContrato
      Caption         =   "Novo Contrato"
      Height          =   495
      Left            =   2160
      TabIndex        =   2
      Top             =   9360
      Width           =   1575
   End
   Begin MSForms.ListBox lstContratos
      Height          =   6690
      Left            =   2160
      TabIndex        =   1
      Top             =   2400
      Width           =   9495
   End
   Begin MSForms.Label lblInstrucoes
      Caption         =   "Duplo clique em um contrato para ver detalhes completos"
      ForeColor       =   &H00808080&
      Height          =   255
      Left            =   2160
      TabIndex        =   7
      Top             =   2040
      Width           =   9495
   End
   Begin MSForms.Label Label1
      Caption         =   "Contratos de Empréstimo"
      BeginProperty Font
         Name            =   "Tahoma"
         Size            =   14.25
         Charset         =   0
         Weight          =   700
         Underline       =   0   'False
         Italic          =   0   'False
         Strikethrough   =   0   'False
      EndProperty
      ForeColor       =   &H00800000&
      Height          =   495
      Left            =   2160
      TabIndex        =   0
      Top             =   1440
      Width           =   9495
   End
End
Attribute VB_Name = "frmDashboard"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
' ============================================================================
' UserForm: frmDashboard
' Descrição: Dashboard para visualizar e gerenciar contratos
' ============================================================================

Option Explicit

' ============================================================================
' EVENTO: Inicialização do Formulário
' ============================================================================
Private Sub UserForm_Initialize()
    ' Configura ListBox
    With lstContratos
        .ColumnCount = 7
        .ColumnWidths = "120;80;100;80;80;80;80"
    End With

    ' Carrega contratos
    Call CarregarContratos
End Sub

' ============================================================================
' SUB: Carrega lista de contratos
' ============================================================================
Private Sub CarregarContratos()
    Dim ws As Worksheet
    Dim linha As Long
    Dim ultimaLinha As Long
    Dim dados() As String
    Dim i As Integer

    ' Limpa lista
    lstContratos.Clear

    ' Adiciona cabeçalhos manualmente
    lstContratos.AddItem
    lstContratos.List(0, 0) = "ID"
    lstContratos.List(0, 1) = "Tipo"
    lstContratos.List(0, 2) = "Contraparte"
    lstContratos.List(0, 3) = "Moeda"
    lstContratos.List(0, 4) = "Principal"
    lstContratos.List(0, 5) = "Saldo"
    lstContratos.List(0, 6) = "Status"

    ' Verifica se planilha existe
    On Error Resume Next
    Set ws = ThisWorkbook.Worksheets("Contratos")
    If Err.Number <> 0 Then
        lstContratos.AddItem
        lstContratos.List(1, 0) = "Nenhum contrato cadastrado"
        Exit Sub
    End If
    On Error GoTo 0

    ' Carrega dados
    ultimaLinha = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row

    If ultimaLinha < 2 Then
        lstContratos.AddItem
        lstContratos.List(1, 0) = "Nenhum contrato cadastrado"
        Exit Sub
    End If

    For linha = 2 To ultimaLinha
        lstContratos.AddItem
        lstContratos.List(lstContratos.ListCount - 1, 0) = ws.Cells(linha, 1).Value  ' ID
        lstContratos.List(lstContratos.ListCount - 1, 1) = ws.Cells(linha, 2).Value  ' Tipo
        lstContratos.List(lstContratos.ListCount - 1, 2) = ws.Cells(linha, 3).Value  ' Contraparte
        lstContratos.List(lstContratos.ListCount - 1, 3) = ws.Cells(linha, 4).Value  ' Moeda
        lstContratos.List(lstContratos.ListCount - 1, 4) = Format(ws.Cells(linha, 5).Value, "#,##0.00")  ' Principal
        lstContratos.List(lstContratos.ListCount - 1, 5) = Format(ws.Cells(linha, 12).Value, "#,##0.00") ' Saldo
        lstContratos.List(lstContratos.ListCount - 1, 6) = ws.Cells(linha, 13).Value ' Status
    Next linha
End Sub

' ============================================================================
' EVENTO: Botão Novo Contrato
' ============================================================================
Private Sub cmdNovoContrato_Click()
    frmNovoContrato.Show
    Call CarregarContratos
End Sub

' ============================================================================
' EVENTO: Botão Gerar Cronograma
' ============================================================================
Private Sub cmdGerarCronograma_Click()
    Dim contratoID As String

    If lstContratos.ListIndex < 1 Then
        MsgBox "Selecione um contrato", vbExclamation, "Atenção"
        Exit Sub
    End If

    contratoID = lstContratos.List(lstContratos.ListIndex, 0)

    If contratoID = "" Or contratoID = "Nenhum contrato cadastrado" Then
        MsgBox "Selecione um contrato válido", vbExclamation, "Atenção"
        Exit Sub
    End If

    ' Gera cronograma
    LoanManager.GerarCronograma contratoID
End Sub

' ============================================================================
' EVENTO: Botão Registrar Pagamento
' ============================================================================
Private Sub cmdRegistrarPagamento_Click()
    Dim contratoID As String

    If lstContratos.ListIndex < 1 Then
        MsgBox "Selecione um contrato", vbExclamation, "Atenção"
        Exit Sub
    End If

    contratoID = lstContratos.List(lstContratos.ListIndex, 0)

    If contratoID = "" Or contratoID = "Nenhum contrato cadastrado" Then
        MsgBox "Selecione um contrato válido", vbExclamation, "Atenção"
        Exit Sub
    End If

    ' Abre formulário de pagamento
    frmPagamento.ContratoID = contratoID
    frmPagamento.Show
    Call CarregarContratos
End Sub

' ============================================================================
' EVENTO: Botão Atualizar
' ============================================================================
Private Sub cmdAtualizar_Click()
    Call CarregarContratos
End Sub

' ============================================================================
' EVENTO: Botão Fechar
' ============================================================================
Private Sub cmdFechar_Click()
    Unload Me
End Sub

' ============================================================================
' EVENTO: Duplo clique em um contrato
' ============================================================================
Private Sub lstContratos_DblClick(ByVal Cancel As MSForms.ReturnBoolean)
    ' Mostra detalhes do contrato
    Dim contratoID As String
    Dim ws As Worksheet
    Dim linha As Long
    Dim msg As String

    If lstContratos.ListIndex < 1 Then Exit Sub

    contratoID = lstContratos.List(lstContratos.ListIndex, 0)
    If contratoID = "" Or contratoID = "Nenhum contrato cadastrado" Then Exit Sub

    ' Busca dados completos
    On Error Resume Next
    Set ws = ThisWorkbook.Worksheets("Contratos")
    If Err.Number <> 0 Then Exit Sub
    On Error GoTo 0

    For linha = 2 To ws.Cells(ws.Rows.Count, 1).End(xlUp).Row
        If ws.Cells(linha, 1).Value = contratoID Then
            msg = "DETALHES DO CONTRATO" & vbCrLf & vbCrLf
            msg = msg & "ID: " & ws.Cells(linha, 1).Value & vbCrLf
            msg = msg & "Tipo: " & ws.Cells(linha, 2).Value & vbCrLf
            msg = msg & "Contraparte: " & ws.Cells(linha, 3).Value & vbCrLf
            msg = msg & "Moeda: " & ws.Cells(linha, 4).Value & vbCrLf
            msg = msg & "Principal: " & Format(ws.Cells(linha, 5).Value, "#,##0.00") & vbCrLf
            msg = msg & "Taxa Juros: " & ws.Cells(linha, 6).Value & "% a.a." & vbCrLf
            msg = msg & "Data Início: " & Format(ws.Cells(linha, 7).Value, "dd/mm/yyyy") & vbCrLf
            msg = msg & "Data Vencimento: " & Format(ws.Cells(linha, 8).Value, "dd/mm/yyyy") & vbCrLf
            msg = msg & "Sistema: " & ws.Cells(linha, 9).Value & vbCrLf
            msg = msg & "Periodicidade: " & ws.Cells(linha, 10).Value & vbCrLf
            msg = msg & "Parcelas: " & ws.Cells(linha, 11).Value & vbCrLf
            msg = msg & "Saldo Atual: " & Format(ws.Cells(linha, 12).Value, "#,##0.00") & vbCrLf
            msg = msg & "Status: " & ws.Cells(linha, 13).Value

            MsgBox msg, vbInformation, "Detalhes - " & contratoID
            Exit For
        End If
    Next linha
End Sub
