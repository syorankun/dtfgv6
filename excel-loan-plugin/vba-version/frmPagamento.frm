VERSION 5.00
Begin {C62A69F0-16DC-11CE-9E98-00AA00574A4F} frmPagamento
   Caption         =   "Registrar Pagamento"
   ClientHeight    =   6945
   ClientLeft      =   120
   ClientTop       =   465
   ClientWidth     =   9015
   StartUpPosition =   1  'CenterOwner
   Begin MSForms.CommandButton cmdCancelar
      Caption         =   "Cancelar"
      Height          =   495
      Left            =   4800
      TabIndex        =   11
      Top             =   6120
      Width           =   1935
   End
   Begin MSForms.CommandButton cmdConfirmar
      Caption         =   "Confirmar Pagamento"
      Height          =   495
      Left            =   2280
      TabIndex        =   10
      Top             =   6120
      Width           =   2415
   End
   Begin MSForms.TextBox txtDescricao
      Height          =   1335
      Left            =   2280
      MultiLine       =   -1  'True
      ScrollBars      =   2  'Vertical
      TabIndex        =   9
      Top             =   4560
      Width           =   4455
   End
   Begin MSForms.TextBox txtData
      Height          =   375
      Left            =   2280
      TabIndex        =   7
      Top             =   3960
      Width           =   4455
   End
   Begin MSForms.TextBox txtValor
      Height          =   375
      Left            =   2280
      TabIndex        =   5
      Top             =   3360
      Width           =   4455
   End
   Begin MSForms.TextBox txtSaldoAtual
      BackColor       =   &H8000000F&
      Height          =   375
      Left            =   2280
      Locked          =   -1  'True
      TabIndex        =   3
      Top             =   2160
      Width           =   4455
   End
   Begin MSForms.TextBox txtContratoID
      BackColor       =   &H8000000F&
      Height          =   375
      Left            =   2280
      Locked          =   -1  'True
      TabIndex        =   1
      Top             =   1560
      Width           =   4455
   End
   Begin MSForms.Label Label3
      Caption         =   "Descrição (opcional):"
      Height          =   255
      Left            =   2280
      TabIndex        =   8
      Top             =   4200
      Width           =   4455
   End
   Begin MSForms.Label Label2
      Caption         =   "Data do Pagamento (dd/mm/aaaa):"
      Height          =   255
      Left            =   2280
      TabIndex        =   6
      Top             =   3600
      Width           =   4455
   End
   Begin MSForms.Label Label1
      Caption         =   "Valor do Pagamento:"
      Height          =   255
      Left            =   2280
      TabIndex        =   4
      Top             =   3000
      Width           =   4455
   End
   Begin MSForms.Label lblSaldoAtual
      Caption         =   "Saldo Atual:"
      Height          =   255
      Left            =   2280
      TabIndex        =   2
      Top             =   1800
      Width           =   4455
   End
   Begin MSForms.Label lblContratoID
      Caption         =   "ID do Contrato:"
      Height          =   255
      Left            =   2280
      TabIndex        =   0
      Top             =   1200
      Width           =   4455
   End
End
Attribute VB_Name = "frmPagamento"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
' ============================================================================
' UserForm: frmPagamento
' Descrição: Formulário para registrar pagamento
' ============================================================================

Option Explicit

Private mContratoID As String

' ============================================================================
' PROPRIEDADE: Define ID do contrato
' ============================================================================
Public Property Let ContratoID(ByVal valor As String)
    mContratoID = valor
    txtContratoID.Value = valor
    Call CarregarSaldoAtual
End Property

Public Property Get ContratoID() As String
    ContratoID = mContratoID
End Property

' ============================================================================
' EVENTO: Inicialização do Formulário
' ============================================================================
Private Sub UserForm_Initialize()
    ' Define data padrão
    txtData.Value = Format(Date, "dd/mm/yyyy")
End Sub

' ============================================================================
' SUB: Carrega saldo atual do contrato
' ============================================================================
Private Sub CarregarSaldoAtual()
    Dim ws As Worksheet
    Dim linha As Long
    Dim saldo As Double
    Dim moeda As String

    On Error Resume Next
    Set ws = ThisWorkbook.Worksheets("Contratos")
    If Err.Number <> 0 Then
        txtSaldoAtual.Value = "Erro ao carregar"
        Exit Sub
    End If
    On Error GoTo 0

    ' Busca saldo
    For linha = 2 To ws.Cells(ws.Rows.Count, 1).End(xlUp).Row
        If ws.Cells(linha, 1).Value = mContratoID Then
            saldo = ws.Cells(linha, 12).Value
            moeda = ws.Cells(linha, 4).Value
            txtSaldoAtual.Value = moeda & " " & Format(saldo, "#,##0.00")
            Exit For
        End If
    Next linha
End Sub

' ============================================================================
' EVENTO: Botão Confirmar
' ============================================================================
Private Sub cmdConfirmar_Click()
    Dim valor As Double
    Dim dataPgto As Date
    Dim descricao As String

    ' Validações
    On Error Resume Next
    valor = CDbl(Replace(txtValor.Value, ",", "."))
    If Err.Number <> 0 Or valor <= 0 Then
        MsgBox "Informe um valor válido", vbExclamation, "Validação"
        txtValor.SetFocus
        Exit Sub
    End If
    On Error GoTo 0

    On Error Resume Next
    dataPgto = CDate(txtData.Value)
    If Err.Number <> 0 Then
        MsgBox "Informe uma data válida (dd/mm/aaaa)", vbExclamation, "Validação"
        txtData.SetFocus
        Exit Sub
    End If
    On Error GoTo 0

    descricao = Trim(txtDescricao.Value)
    If descricao = "" Then descricao = "Pagamento"

    ' Confirmação
    If MsgBox("Confirma o pagamento de " & Format(valor, "#,##0.00") & "?", _
              vbQuestion + vbYesNo, "Confirmação") = vbNo Then
        Exit Sub
    End If

    ' Registra pagamento
    On Error GoTo ErroAoRegistrar
    LoanManager.RegistrarPagamento mContratoID, valor, dataPgto, descricao

    ' Fecha formulário
    Unload Me
    Exit Sub

ErroAoRegistrar:
    MsgBox "Erro ao registrar pagamento: " & Err.Description, vbCritical, "Erro"
End Sub

' ============================================================================
' EVENTO: Botão Cancelar
' ============================================================================
Private Sub cmdCancelar_Click()
    Unload Me
End Sub
