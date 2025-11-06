Attribute VB_Name = "LoanCalculator"
' ============================================================================
' Módulo: LoanCalculator
' Descrição: Calculadora financeira para empréstimos
' Autor: DJ DataForge
' Versão: 1.0.0
' ============================================================================

Option Explicit

' ============================================================================
' FUNÇÕES DE ARREDONDAMENTO E UTILIDADES
' ============================================================================

Public Function RoundDecimal(ByVal valor As Double, ByVal decimais As Integer) As Double
    ' Arredonda um valor para número específico de casas decimais
    RoundDecimal = WorksheetFunction.Round(valor, decimais)
End Function

' ============================================================================
' FUNÇÕES DE CONTAGEM DE DIAS
' ============================================================================

Public Function DiasEntreDatas(ByVal dataInicio As Date, ByVal dataFim As Date, _
                               Optional ByVal convencao As String = "ACT/365") As Long
    ' Calcula dias entre datas com base em convenção
    ' Convenções: 30/360, ACT/365, ACT/360, BUS/252

    Dim dias As Long
    Dim d1 As Integer, m1 As Integer, y1 As Integer
    Dim d2 As Integer, m2 As Integer, y2 As Integer
    Dim dataAtual As Date
    Dim contador As Long

    Select Case UCase(convencao)
        Case "30/360"
            ' Convenção 30/360
            d1 = Day(dataInicio)
            m1 = Month(dataInicio)
            y1 = Year(dataInicio)
            d2 = Day(dataFim)
            m2 = Month(dataFim)
            y2 = Year(dataFim)
            dias = (y2 - y1) * 360 + (m2 - m1) * 30 + (d2 - d1)

        Case "ACT/360", "ACT/365"
            ' Dias corridos
            dias = DateDiff("d", dataInicio, dataFim)

        Case "BUS/252"
            ' Dias úteis (simplificado - não considera feriados)
            contador = 0
            dataAtual = dataInicio
            Do While dataAtual <= dataFim
                If Weekday(dataAtual) <> vbSaturday And Weekday(dataAtual) <> vbSunday Then
                    contador = contador + 1
                End If
                dataAtual = DateAdd("d", 1, dataAtual)
            Loop
            dias = contador

        Case Else
            dias = DateDiff("d", dataInicio, dataFim)
    End Select

    DiasEntreDatas = dias
End Function

Public Function DivisorAnual(ByVal convencao As String) As Long
    ' Retorna o divisor anual baseado na convenção
    Select Case UCase(convencao)
        Case "30/360", "ACT/360"
            DivisorAnual = 360
        Case "ACT/365"
            DivisorAnual = 365
        Case "BUS/252"
            DivisorAnual = 252
        Case Else
            DivisorAnual = 360
    End Select
End Function

' ============================================================================
' FUNÇÕES DE TAXAS
' ============================================================================

Public Function TaxaPeriodica(ByVal taxaAnual As Double, _
                              ByVal capitalizacao As String, _
                              ByVal convencao As String, _
                              ByVal diasPeriodo As Long) As Double
    ' Converte taxa anual para taxa periódica
    ' taxaAnual: em % (ex: 12.5)
    ' capitalizacao: "EXPONENCIAL" ou "LINEAR"

    Dim taxaDecimal As Double
    Dim divisor As Long

    taxaDecimal = taxaAnual / 100
    divisor = DivisorAnual(convencao)

    If UCase(capitalizacao) = "EXPONENCIAL" Then
        ' (1 + i)^(dias/ano) - 1
        TaxaPeriodica = (1 + taxaDecimal) ^ (diasPeriodo / divisor) - 1
    Else
        ' Linear: i * (dias/ano)
        TaxaPeriodica = taxaDecimal * (diasPeriodo / divisor)
    End If
End Function

' ============================================================================
' FUNÇÕES PRICE (PARCELA FIXA)
' ============================================================================

Public Function CalcularPMT(ByVal principal As Double, _
                           ByVal taxaPeriodica As Double, _
                           ByVal numeroParcelas As Long) As Double
    ' Calcula valor da parcela (Sistema PRICE)

    If taxaPeriodica = 0 Then
        CalcularPMT = principal / numeroParcelas
    Else
        CalcularPMT = principal * (taxaPeriodica * (1 + taxaPeriodica) ^ numeroParcelas) / _
                      ((1 + taxaPeriodica) ^ numeroParcelas - 1)
    End If
End Function

Public Function CalcularJurosParcela(ByVal principal As Double, _
                                    ByVal taxaPeriodica As Double, _
                                    ByVal numeroParcela As Long, _
                                    ByVal totalParcelas As Long) As Double
    ' Calcula juros de uma parcela específica (PRICE)

    Dim pmt As Double
    Dim saldo As Double
    Dim i As Long
    Dim juros As Double
    Dim amortizacao As Double

    pmt = CalcularPMT(principal, taxaPeriodica, totalParcelas)
    saldo = principal

    For i = 1 To numeroParcela - 1
        juros = saldo * taxaPeriodica
        amortizacao = pmt - juros
        saldo = saldo - amortizacao
    Next i

    CalcularJurosParcela = saldo * taxaPeriodica
End Function

Public Function CalcularAmortizacaoParcela(ByVal principal As Double, _
                                          ByVal taxaPeriodica As Double, _
                                          ByVal numeroParcela As Long, _
                                          ByVal totalParcelas As Long) As Double
    ' Calcula amortização de uma parcela específica (PRICE)

    Dim pmt As Double
    Dim juros As Double

    pmt = CalcularPMT(principal, taxaPeriodica, totalParcelas)
    juros = CalcularJurosParcela(principal, taxaPeriodica, numeroParcela, totalParcelas)

    CalcularAmortizacaoParcela = pmt - juros
End Function

' ============================================================================
' FUNÇÕES SAC (AMORTIZAÇÃO CONSTANTE)
' ============================================================================

Public Function CalcularParcelaSAC(ByVal principal As Double, _
                                  ByVal taxaPeriodica As Double, _
                                  ByVal numeroParcela As Long, _
                                  ByVal totalParcelas As Long) As Double
    ' Calcula valor da parcela no sistema SAC

    Dim amortizacao As Double
    Dim saldo As Double
    Dim juros As Double

    amortizacao = principal / totalParcelas
    saldo = principal - ((numeroParcela - 1) * amortizacao)
    juros = saldo * taxaPeriodica

    CalcularParcelaSAC = amortizacao + juros
End Function

Public Function AmortizacaoSAC(ByVal principal As Double, _
                              ByVal totalParcelas As Long) As Double
    ' Retorna valor fixo de amortização no SAC
    AmortizacaoSAC = principal / totalParcelas
End Function

' ============================================================================
' FUNÇÕES DE DATA
' ============================================================================

Public Function AdicionarPeriodo(ByVal dataBase As Date, _
                                ByVal quantidade As Long, _
                                ByVal periodicidade As String) As Date
    ' Adiciona períodos a uma data
    ' periodicidade: MENSAL, TRIMESTRAL, SEMESTRAL, ANUAL

    Select Case UCase(periodicidade)
        Case "MENSAL"
            AdicionarPeriodo = DateAdd("m", quantidade, dataBase)
        Case "TRIMESTRAL"
            AdicionarPeriodo = DateAdd("m", quantidade * 3, dataBase)
        Case "SEMESTRAL"
            AdicionarPeriodo = DateAdd("m", quantidade * 6, dataBase)
        Case "ANUAL"
            AdicionarPeriodo = DateAdd("yyyy", quantidade, dataBase)
        Case Else
            AdicionarPeriodo = DateAdd("m", quantidade, dataBase)
    End Select
End Function

' ============================================================================
' FUNÇÃO PÚBLICA PARA CRONOGRAMA PRICE
' ============================================================================

Public Sub GerarCronogramaPRICE(ByVal wsDestino As Worksheet, _
                               ByVal principal As Double, _
                               ByVal taxaAnual As Double, _
                               ByVal numeroParcelas As Long, _
                               ByVal dataInicio As Date, _
                               ByVal periodicidade As String, _
                               Optional ByVal linhaInicial As Long = 1)
    ' Gera cronograma PRICE completo em uma planilha

    Dim i As Long
    Dim taxaPer As Double
    Dim pmt As Double
    Dim saldo As Double
    Dim juros As Double
    Dim amortizacao As Double
    Dim dataPagamento As Date
    Dim linha As Long

    ' Calcula taxa periódica
    Dim dias As Long
    Dim dataPrimeiraParcela As Date
    dataPrimeiraParcela = AdicionarPeriodo(dataInicio, 1, periodicidade)
    dias = DiasEntreDatas(dataInicio, dataPrimeiraParcela, "ACT/365")
    taxaPer = TaxaPeriodica(taxaAnual, "EXPONENCIAL", "ACT/365", dias)

    ' Calcula PMT
    pmt = CalcularPMT(principal, taxaPer, numeroParcelas)
    saldo = principal
    linha = linhaInicial

    ' Cabeçalho
    With wsDestino
        .Cells(linha, 1).Value = "Parcela"
        .Cells(linha, 2).Value = "Data Vencimento"
        .Cells(linha, 3).Value = "Saldo Inicial"
        .Cells(linha, 4).Value = "Valor Parcela"
        .Cells(linha, 5).Value = "Juros"
        .Cells(linha, 6).Value = "Amortização"
        .Cells(linha, 7).Value = "Saldo Final"

        ' Formata cabeçalho
        .Range(.Cells(linha, 1), .Cells(linha, 7)).Font.Bold = True
        .Range(.Cells(linha, 1), .Cells(linha, 7)).Interior.Color = RGB(68, 114, 196)
        .Range(.Cells(linha, 1), .Cells(linha, 7)).Font.Color = RGB(255, 255, 255)
    End With

    linha = linha + 1

    ' Gera parcelas
    For i = 1 To numeroParcelas
        dataPagamento = AdicionarPeriodo(dataInicio, i, periodicidade)
        juros = RoundDecimal(saldo * taxaPer, 2)
        amortizacao = RoundDecimal(pmt - juros, 2)

        With wsDestino
            .Cells(linha, 1).Value = i
            .Cells(linha, 2).Value = dataPagamento
            .Cells(linha, 2).NumberFormat = "dd/mm/yyyy"
            .Cells(linha, 3).Value = saldo
            .Cells(linha, 3).NumberFormat = "#,##0.00"
            .Cells(linha, 4).Value = pmt
            .Cells(linha, 4).NumberFormat = "#,##0.00"
            .Cells(linha, 5).Value = juros
            .Cells(linha, 5).NumberFormat = "#,##0.00"
            .Cells(linha, 6).Value = amortizacao
            .Cells(linha, 6).NumberFormat = "#,##0.00"
            .Cells(linha, 7).Value = saldo - amortizacao
            .Cells(linha, 7).NumberFormat = "#,##0.00"
        End With

        saldo = saldo - amortizacao
        linha = linha + 1
    Next i

    ' Totais
    With wsDestino
        .Cells(linha, 3).Value = "TOTAL"
        .Cells(linha, 3).Font.Bold = True
        .Cells(linha, 4).Formula = "=SUM(" & .Cells(linhaInicial + 1, 4).Address & ":" & .Cells(linha - 1, 4).Address & ")"
        .Cells(linha, 4).NumberFormat = "#,##0.00"
        .Cells(linha, 4).Font.Bold = True
        .Cells(linha, 5).Formula = "=SUM(" & .Cells(linhaInicial + 1, 5).Address & ":" & .Cells(linha - 1, 5).Address & ")"
        .Cells(linha, 5).NumberFormat = "#,##0.00"
        .Cells(linha, 5).Font.Bold = True
        .Cells(linha, 6).Formula = "=SUM(" & .Cells(linhaInicial + 1, 6).Address & ":" & .Cells(linha - 1, 6).Address & ")"
        .Cells(linha, 6).NumberFormat = "#,##0.00"
        .Cells(linha, 6).Font.Bold = True
    End With

    ' Auto-ajusta colunas
    wsDestino.Columns("A:G").AutoFit
End Sub

' ============================================================================
' FUNÇÃO PÚBLICA PARA CRONOGRAMA SAC
' ============================================================================

Public Sub GerarCronogramaSAC(ByVal wsDestino As Worksheet, _
                             ByVal principal As Double, _
                             ByVal taxaAnual As Double, _
                             ByVal numeroParcelas As Long, _
                             ByVal dataInicio As Date, _
                             ByVal periodicidade As String, _
                             Optional ByVal linhaInicial As Long = 1)
    ' Gera cronograma SAC completo em uma planilha

    Dim i As Long
    Dim taxaPer As Double
    Dim amortizacao As Double
    Dim saldo As Double
    Dim juros As Double
    Dim pmt As Double
    Dim dataPagamento As Date
    Dim linha As Long

    ' Calcula taxa periódica
    Dim dias As Long
    Dim dataPrimeiraParcela As Date
    dataPrimeiraParcela = AdicionarPeriodo(dataInicio, 1, periodicidade)
    dias = DiasEntreDatas(dataInicio, dataPrimeiraParcela, "ACT/365")
    taxaPer = TaxaPeriodica(taxaAnual, "EXPONENCIAL", "ACT/365", dias)

    amortizacao = AmortizacaoSAC(principal, numeroParcelas)
    saldo = principal
    linha = linhaInicial

    ' Cabeçalho
    With wsDestino
        .Cells(linha, 1).Value = "Parcela"
        .Cells(linha, 2).Value = "Data Vencimento"
        .Cells(linha, 3).Value = "Saldo Inicial"
        .Cells(linha, 4).Value = "Valor Parcela"
        .Cells(linha, 5).Value = "Juros"
        .Cells(linha, 6).Value = "Amortização"
        .Cells(linha, 7).Value = "Saldo Final"

        ' Formata cabeçalho
        .Range(.Cells(linha, 1), .Cells(linha, 7)).Font.Bold = True
        .Range(.Cells(linha, 1), .Cells(linha, 7)).Interior.Color = RGB(68, 114, 196)
        .Range(.Cells(linha, 1), .Cells(linha, 7)).Font.Color = RGB(255, 255, 255)
    End With

    linha = linha + 1

    ' Gera parcelas
    For i = 1 To numeroParcelas
        dataPagamento = AdicionarPeriodo(dataInicio, i, periodicidade)
        juros = RoundDecimal(saldo * taxaPer, 2)
        pmt = RoundDecimal(amortizacao + juros, 2)

        With wsDestino
            .Cells(linha, 1).Value = i
            .Cells(linha, 2).Value = dataPagamento
            .Cells(linha, 2).NumberFormat = "dd/mm/yyyy"
            .Cells(linha, 3).Value = saldo
            .Cells(linha, 3).NumberFormat = "#,##0.00"
            .Cells(linha, 4).Value = pmt
            .Cells(linha, 4).NumberFormat = "#,##0.00"
            .Cells(linha, 5).Value = juros
            .Cells(linha, 5).NumberFormat = "#,##0.00"
            .Cells(linha, 6).Value = amortizacao
            .Cells(linha, 6).NumberFormat = "#,##0.00"
            .Cells(linha, 7).Value = saldo - amortizacao
            .Cells(linha, 7).NumberFormat = "#,##0.00"
        End With

        saldo = saldo - amortizacao
        linha = linha + 1
    Next i

    ' Totais
    With wsDestino
        .Cells(linha, 3).Value = "TOTAL"
        .Cells(linha, 3).Font.Bold = True
        .Cells(linha, 4).Formula = "=SUM(" & .Cells(linhaInicial + 1, 4).Address & ":" & .Cells(linha - 1, 4).Address & ")"
        .Cells(linha, 4).NumberFormat = "#,##0.00"
        .Cells(linha, 4).Font.Bold = True
        .Cells(linha, 5).Formula = "=SUM(" & .Cells(linhaInicial + 1, 5).Address & ":" & .Cells(linha - 1, 5).Address & ")"
        .Cells(linha, 5).NumberFormat = "#,##0.00"
        .Cells(linha, 5).Font.Bold = True
        .Cells(linha, 6).Formula = "=SUM(" & .Cells(linhaInicial + 1, 6).Address & ":" & .Cells(linha - 1, 6).Address & ")"
        .Cells(linha, 6).NumberFormat = "#,##0.00"
        .Cells(linha, 6).Font.Bold = True
    End With

    ' Auto-ajusta colunas
    wsDestino.Columns("A:G").AutoFit
End Sub
