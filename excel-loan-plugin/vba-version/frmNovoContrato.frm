VERSION 5.00
Begin {C62A69F0-16DC-11CE-9E98-00AA00574A4F} frmNovoContrato
   Caption         =   "Novo Contrato de Empréstimo"
   ClientHeight    =   10770
   ClientLeft      =   120
   ClientTop       =   465
   ClientWidth     =   9015
   StartUpPosition =   1  'CenterOwner
   Begin MSForms.CommandButton cmdCancelar
      Caption         =   "Cancelar"
      Height          =   495
      Left            =   4800
      TabIndex        =   21
      Top             =   9960
      Width           =   1935
   End
   Begin MSForms.CommandButton cmdCriar
      Caption         =   "Criar Contrato"
      Height          =   495
      Left            =   2280
      TabIndex        =   20
      Top             =   9960
      Width           =   2415
   End
   Begin MSForms.TextBox txtParcelas
      Height          =   375
      Left            =   2280
      TabIndex        =   18
      Top             =   9240
      Width           =   4455
   End
   Begin MSForms.ComboBox cboPeriodicidade
      Height          =   315
      Left            =   2280
      Style           =   2  'Dropdown List
      TabIndex        =   16
      Top             =   8640
      Width           =   4455
   End
   Begin MSForms.ComboBox cboSistema
      Height          =   315
      Left            =   2280
      Style           =   2  'Dropdown List
      TabIndex        =   14
      Top             =   8040
      Width           =   4455
   End
   Begin MSForms.TextBox txtTaxaJuros
      Height          =   375
      Left            =   2280
      TabIndex        =   12
      Top             =   7440
      Width           =   4455
   End
   Begin MSForms.TextBox txtDataVencimento
      Height          =   375
      Left            =   2280
      TabIndex        =   10
      Top             =   6240
      Width           =   4455
   End
   Begin MSForms.TextBox txtDataInicio
      Height          =   375
      Left            =   2280
      TabIndex        =   8
      Top             =   5640
      Width           =   4455
   End
   Begin MSForms.TextBox txtPrincipal
      Height          =   375
      Left            =   2280
      TabIndex        =   6
      Top             =   5040
      Width           =   4455
   End
   Begin MSForms.ComboBox cboMoeda
      Height          =   315
      Left            =   2280
      Style           =   2  'Dropdown List
      TabIndex        =   4
      Top             =   4440
      Width           =   4455
   End
   Begin MSForms.TextBox txtContraparte
      Height          =   375
      Left            =   2280
      TabIndex        =   2
      Top             =   3840
      Width           =   4455
   End
   Begin MSForms.ComboBox cboTipo
      Height          =   315
      Left            =   2280
      Style           =   2  'Dropdown List
      TabIndex        =   0
      Top             =   3240
      Width           =   4455
   End
   Begin MSForms.Label Label10
      Caption         =   "Número de Parcelas:"
      Height          =   255
      Left            =   2280
      TabIndex        =   19
      Top             =   8880
      Width           =   4455
   End
   Begin MSForms.Label Label9
      Caption         =   "Periodicidade:"
      Height          =   255
      Left            =   2280
      TabIndex        =   17
      Top             =   8280
      Width           =   4455
   End
   Begin MSForms.Label Label8
      Caption         =   "Sistema de Amortização:"
      Height          =   255
      Left            =   2280
      TabIndex        =   15
      Top             =   7680
      Width           =   4455
   End
   Begin MSForms.Label Label7
      Caption         =   "Taxa de Juros (% a.a.):"
      Height          =   255
      Left            =   2280
      TabIndex        =   13
      Top             =   7080
      Width           =   4455
   End
   Begin MSForms.Label Label6
      Caption         =   "Data Vencimento (dd/mm/aaaa):"
      Height          =   255
      Left            =   2280
      TabIndex        =   11
      Top             =   5880
      Width           =   4455
   End
   Begin MSForms.Label Label5
      Caption         =   "Data Início (dd/mm/aaaa):"
      Height          =   255
      Left            =   2280
      TabIndex        =   9
      Top             =   5280
      Width           =   4455
   End
   Begin MSForms.Label Label4
      Caption         =   "Principal:"
      Height          =   255
      Left            =   2280
      TabIndex        =   7
      Top             =   4680
      Width           =   4455
   End
   Begin MSForms.Label Label3
      Caption         =   "Moeda:"
      Height          =   255
      Left            =   2280
      TabIndex        =   5
      Top             =   4080
      Width           =   4455
   End
   Begin MSForms.Label Label2
      Caption         =   "Contraparte:"
      Height          =   255
      Left            =   2280
      TabIndex        =   3
      Top             =   3480
      Width           =   4455
   End
   Begin MSForms.Label Label1
      Caption         =   "Tipo de Contrato:"
      Height          =   255
      Left            =   2280
      TabIndex        =   1
      Top             =   2880
      Width           =   4455
   End
   Begin MSForms.Label lblTitulo
      Caption         =   "Preencha os dados do novo contrato de empréstimo"
      BeginProperty Font
         Name            =   "Tahoma"
         Size            =   11.25
         Charset         =   0
         Weight          =   700
         Underline       =   0   'False
         Italic          =   0   'False
         Strikethrough   =   0   'False
      EndProperty
      ForeColor       =   &H00800000&
      Height          =   375
      Left            =   2280
      TabIndex        =   22
      Top             =   2280
      Width           =   4455
   End
End
Attribute VB_Name = "frmNovoContrato"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
' ============================================================================
' UserForm: frmNovoContrato
' Descrição: Formulário para criar novo contrato de empréstimo
' ============================================================================

Option Explicit

Private contratoID As String

' ============================================================================
' EVENTO: Inicialização do Formulário
' ============================================================================
Private Sub UserForm_Initialize()
    ' Preenche ComboBox Tipo
    With cboTipo
        .Clear
        .AddItem "CAPTADO"
        .AddItem "CEDIDO"
        .ListIndex = 0
    End With

    ' Preenche ComboBox Moeda
    With cboMoeda
        .Clear
        .AddItem "BRL"
        .AddItem "USD"
        .AddItem "EUR"
        .AddItem "GBP"
        .ListIndex = 0
    End With

    ' Preenche ComboBox Sistema
    With cboSistema
        .Clear
        .AddItem "PRICE"
        .AddItem "SAC"
        .ListIndex = 0
    End With

    ' Preenche ComboBox Periodicidade
    With cboPeriodicidade
        .Clear
        .AddItem "MENSAL"
        .AddItem "TRIMESTRAL"
        .AddItem "SEMESTRAL"
        .AddItem "ANUAL"
        .ListIndex = 0
    End With

    ' Define valores padrão
    txtDataInicio.Value = Format(Date, "dd/mm/yyyy")
    txtDataVencimento.Value = Format(DateAdd("yyyy", 1, Date), "dd/mm/yyyy")
    txtTaxaJuros.Value = "12,5"
    txtParcelas.Value = "12"
End Sub

' ============================================================================
' EVENTO: Botão Criar
' ============================================================================
Private Sub cmdCriar_Click()
    Dim tipo As String
    Dim contraparte As String
    Dim moeda As String
    Dim principal As Double
    Dim dataInicio As Date
    Dim dataVencimento As Date
    Dim taxaJuros As Double
    Dim sistema As String
    Dim periodicidade As String
    Dim parcelas As Long

    ' Validações
    If Trim(txtContraparte.Value) = "" Then
        MsgBox "Informe a contraparte", vbExclamation, "Validação"
        txtContraparte.SetFocus
        Exit Sub
    End If

    On Error Resume Next
    principal = CDbl(Replace(txtPrincipal.Value, ",", "."))
    If Err.Number <> 0 Or principal <= 0 Then
        MsgBox "Informe um valor de principal válido", vbExclamation, "Validação"
        txtPrincipal.SetFocus
        Exit Sub
    End If
    On Error GoTo 0

    On Error Resume Next
    dataInicio = CDate(txtDataInicio.Value)
    If Err.Number <> 0 Then
        MsgBox "Informe uma data de início válida (dd/mm/aaaa)", vbExclamation, "Validação"
        txtDataInicio.SetFocus
        Exit Sub
    End If
    On Error GoTo 0

    On Error Resume Next
    dataVencimento = CDate(txtDataVencimento.Value)
    If Err.Number <> 0 Then
        MsgBox "Informe uma data de vencimento válida (dd/mm/aaaa)", vbExclamation, "Validação"
        txtDataVencimento.SetFocus
        Exit Sub
    End If
    On Error GoTo 0

    If dataVencimento <= dataInicio Then
        MsgBox "A data de vencimento deve ser posterior à data de início", vbExclamation, "Validação"
        txtDataVencimento.SetFocus
        Exit Sub
    End If

    On Error Resume Next
    taxaJuros = CDbl(Replace(txtTaxaJuros.Value, ",", "."))
    If Err.Number <> 0 Or taxaJuros <= 0 Then
        MsgBox "Informe uma taxa de juros válida", vbExclamation, "Validação"
        txtTaxaJuros.SetFocus
        Exit Sub
    End If
    On Error GoTo 0

    On Error Resume Next
    parcelas = CLng(txtParcelas.Value)
    If Err.Number <> 0 Or parcelas <= 0 Then
        MsgBox "Informe um número de parcelas válido", vbExclamation, "Validação"
        txtParcelas.SetFocus
        Exit Sub
    End If
    On Error GoTo 0

    ' Captura valores
    tipo = cboTipo.Value
    contraparte = Trim(txtContraparte.Value)
    moeda = cboMoeda.Value
    sistema = cboSistema.Value
    periodicidade = cboPeriodicidade.Value

    ' Cria contrato
    On Error GoTo ErroAoCriar
    contratoID = LoanManager.CriarContrato(tipo, contraparte, moeda, principal, _
                                          dataInicio, dataVencimento, taxaJuros, _
                                          sistema, periodicidade, parcelas)

    ' Pergunta se deseja gerar cronograma
    If MsgBox("Deseja gerar o cronograma de pagamentos agora?", vbQuestion + vbYesNo, "Cronograma") = vbYes Then
        LoanManager.GerarCronograma contratoID
    End If

    ' Fecha formulário
    Unload Me
    Exit Sub

ErroAoCriar:
    MsgBox "Erro ao criar contrato: " & Err.Description, vbCritical, "Erro"
End Sub

' ============================================================================
' EVENTO: Botão Cancelar
' ============================================================================
Private Sub cmdCancelar_Click()
    Unload Me
End Sub

' ============================================================================
' PROPRIEDADE: Retorna ID do contrato criado
' ============================================================================
Public Property Get ContratoIDCriado() As String
    ContratoIDCriado = contratoID
End Property
