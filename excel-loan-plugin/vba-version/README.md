# 💰 Loan Manager - Excel Add-in (.xlam)

## 📌 O que é isso?

Esta é a versão **VBA standalone** do Loan Plugin do DJ DataForge v6, adaptada para rodar como um **Excel Add-in (.xlam)** completo com:

✅ **UserForms (Formulários VBA)**
✅ **Ribbon Customizada** (aba "Empréstimos")
✅ **Sem servidor HTTP**
✅ **Sem dependências externas**
✅ **Funciona 100% offline**

---

## 📦 Arquivos Incluídos

```
vba-version/
├── README.md                        ← Você está aqui
├── GUIA_COMPLETO_INSTALACAO.md      ← Tutorial passo a passo COMPLETO
├── QUICKSTART.md                    ← Instalação rápida (básica)
├── README_XLAM.md                   ← Documentação de uso
├── IMPORTAR_FORMULARIOS.md          ← Como importar os .frm
│
├── LoanCalculator.bas               ← Módulo VBA - Cálculos financeiros
├── LoanManager.bas                  ← Módulo VBA - Gestão de contratos
├── RibbonCallbacks.bas              ← Módulo VBA - Callbacks da Ribbon
│
├── frmNovoContrato.frm              ← UserForm PRONTO - Criar contrato ⭐
├── frmDashboard.frm                 ← UserForm PRONTO - Dashboard ⭐
├── frmPagamento.frm                 ← UserForm PRONTO - Registrar pagamento ⭐
│
├── frmNovoContrato.txt              ← Código-fonte (referência)
├── frmDashboard.txt                 ← Código-fonte (referência)
├── frmPagamento.txt                 ← Código-fonte (referência)
│
└── CustomUI.xml                     ← XML da Ribbon customizada
```

**⭐ NOVO:** Arquivos `.frm` prontos para importar diretamente no VBA Editor!

---

## ⚡ Instalação Rápida

### Passo 1: Importe os Módulos VBA

1. Abra o Excel
2. Pressione `Alt + F11` (VBA Editor)
3. Clique com botão direito no VBAProject
4. **Arquivo → Importar Arquivo**
5. Importe os 3 arquivos `.bas`:
   - `LoanCalculator.bas`
   - `LoanManager.bas`
   - `RibbonCallbacks.bas`

### Passo 2: Importe os Formulários

1. No VBA Editor, clique com botão direito no VBAProject
2. **Arquivo → Importar Arquivo**
3. Importe os 3 arquivos `.frm`:
   - `frmNovoContrato.frm` ⭐
   - `frmDashboard.frm` ⭐
   - `frmPagamento.frm` ⭐

**Detalhes:** Consulte [IMPORTAR_FORMULARIOS.md](IMPORTAR_FORMULARIOS.md)

### Passo 3: Salve como .xlam

1. Arquivo → Salvar Como
2. Tipo: **Suplemento do Excel (.xlam)**
3. Nome: `LoanManager.xlam`

### Passo 4: Ative

1. Arquivo → Opções → Suplementos
2. Marque `LoanManager`
3. OK

**Pronto!** 🎉

**Documentação completa:** [GUIA_COMPLETO_INSTALACAO.md](GUIA_COMPLETO_INSTALACAO.md)

---

## 🎨 Interface Visual

### Ribbon Customizada - Aba "Empréstimos"

A aba customizada na Ribbon do Excel contém 5 grupos de funcionalidades:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  EMPRÉSTIMOS                                                            │
├───────────────┬──────────────┬────────────┬─────────────┬──────────────┤
│  Contratos    │ Cronogramas  │ Pagamentos │ Ferramentas │    Ajuda     │
├───────────────┼──────────────┼────────────┼─────────────┼──────────────┤
│ [📋] Novo     │ [📊] Gerar   │ [💰] Reg.  │ [📂] Abrir  │ [ℹ️] Sobre   │
│   Contrato    │  Cronograma  │  Pagamento │  Contratos  │             │
│               │              │            │ [🔄] Atual. │ [❓] Ajuda   │
│ [📈] Dashboard│              │            │             │             │
└───────────────┴──────────────┴────────────┴─────────────┴──────────────┘
```

### UserForm: Novo Contrato

```
┌─────────────────────────────────────────────┐
│  Novo Contrato de Empréstimo           [X]  │
├─────────────────────────────────────────────┤
│                                             │
│  Tipo de Contrato:     [CAPTADO ▼]        │
│                                             │
│  Contraparte:          [_________________] │
│                                             │
│  Moeda:                [BRL ▼]             │
│                                             │
│  Principal:            [_________________] │
│                                             │
│  Data Início:          [DD/MM/AAAA_______] │
│                                             │
│  Data Vencimento:      [DD/MM/AAAA_______] │
│                                             │
│  Taxa de Juros (% a.a.): [_____________]   │
│                                             │
│  Sistema de Amortização: [PRICE ▼]        │
│                                             │
│  Periodicidade:        [MENSAL ▼]         │
│                                             │
│  Número de Parcelas:   [_________________] │
│                                             │
│         [  Criar Contrato  ]  [ Cancelar ] │
└─────────────────────────────────────────────┘
```

### UserForm: Dashboard

```
┌──────────────────────────────────────────────────────────┐
│  Dashboard de Contratos                             [X]  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ ID              │ Contraparte │ Principal │ Status │ │
│  ├────────────────────────────────────────────────────┤ │
│  │ LOAN-2025...    │ Banco ABC   │ 100.000   │ Ativo │ │
│  │ LOAN-2025...    │ Banco XYZ   │ 50.000    │ Ativo │ │
│  │                                                    │ │
│  │                                                    │ │
│  │                                                    │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  [ Novo Contrato ]  [ Gerar Cronograma ]                │
│  [ Reg. Pagamento ] [ Atualizar ]  [ Fechar ]           │
└──────────────────────────────────────────────────────────┘
```

### UserForm: Registrar Pagamento

```
┌─────────────────────────────────────────────┐
│  Registrar Pagamento                   [X]  │
├─────────────────────────────────────────────┤
│                                             │
│  ID do Contrato:  [LOAN-20250101......]    │
│                   (bloqueado)               │
│                                             │
│  Saldo Atual:     [R$ 100.000,00]         │
│                   (bloqueado)               │
│                                             │
│  Valor do Pagamento:  [_________________]  │
│                                             │
│  Data do Pagamento:   [DD/MM/AAAA_______]  │
│                                             │
│  Descrição (opcional):                     │
│  ┌───────────────────────────────────────┐ │
│  │                                       │ │
│  │                                       │ │
│  └───────────────────────────────────────┘ │
│                                             │
│    [ Confirmar Pagamento ]  [ Cancelar ]   │
└─────────────────────────────────────────────┘
```

---

## 🚀 Funcionalidades

### ✅ O que funciona

- ✅ **Criar contratos** de empréstimo (CAPTADO/CEDIDO)
- ✅ **Sistemas de amortização**: PRICE e SAC
- ✅ **Gerar cronogramas** completos automaticamente
- ✅ **Registrar pagamentos** e atualizar saldos
- ✅ **Ledger de transações** completo
- ✅ **Convenções de dias**: 30/360, ACT/365, ACT/360, BUS/252
- ✅ **Periodicidades**: Mensal, Trimestral, Semestral, Anual
- ✅ **Múltiplas moedas**: BRL, USD, EUR, GBP

### ❌ O que NÃO funciona (vs. versão original)

- ❌ Integração com taxas FX (PTAX/BCB) - usar taxa manual
- ❌ Indexadores automáticos (CDI, SELIC) - usar taxa fixa
- ❌ Cronograma ACCRUAL (acúmulo diário de juros)
- ❌ Dashboard visual com KPIs
- ❌ Relatórios avançados
- ❌ Fórmulas customizadas (LOAN.*)

---

## 📚 Documentação

- **[QUICKSTART.md](QUICKSTART.md)** - Comece aqui (5 minutos)
- **[README_XLAM.md](README_XLAM.md)** - Documentação completa
- **[../LOAN_PLUGIN_DOCUMENTATION.md](../LOAN_PLUGIN_DOCUMENTATION.md)** - Documentação do plugin original
- **[../COMPARISON.md](../COMPARISON.md)** - Comparação detalhada

---

## 🎯 Exemplos de Uso

### Criar Contrato

```vba
contratoID = LoanManager.CriarContrato("CAPTADO", "Banco ABC", "BRL", _
                                       100000, #1/1/2025#, #12/31/2025#, _
                                       12.5, "PRICE", "MENSAL", 12)
```

### Gerar Cronograma

```vba
Call LoanManager.GerarCronograma("LOAN-20250101120000-ABC123")
```

### Registrar Pagamento

```vba
Call LoanManager.RegistrarPagamento("LOAN-20250101120000-ABC123", _
                                    10000, #2/1/2025#, "Primeira parcela")
```

---

## 🔧 Requisitos

- **Microsoft Excel** 2016 ou superior
- **Windows** ou **Mac**
- **Macros habilitadas**

---

## 💡 Vantagens vs. Versão Office.js

| Aspecto | VBA (.xlam) | Office.js (HTTP) |
|---------|-------------|------------------|
| **Instalação** | ✅ Simples (importar) | ❌ Complexa (servidor) |
| **Dependências** | ✅ Zero | ❌ Node.js, servidor HTTP |
| **Offline** | ✅ Funciona 100% | ❌ Precisa de servidor |
| **Portabilidade** | ✅ Arquivo único | ❌ Múltiplos arquivos |
| **Interface** | ⚠️ Simples (VBA forms) | ✅ Moderna (HTML/CSS) |
| **Performance** | ✅ Rápida | ⚠️ Depende do navegador |
| **Compatibilidade** | ✅ Excel 2016+ | ⚠️ Limitações no Mac/Online |

**Recomendação:** Use VBA se você quer **simplicidade** e **portabilidade**.

---

## 🆘 Suporte

**Problemas?**

1. Consulte [README_XLAM.md](README_XLAM.md) → Seção "Solução de Problemas"
2. Verifique se as macros estão habilitadas
3. Revise o código VBA (Alt + F11)

---

## 📄 Licença

Código fornecido para fins educacionais e de demonstração.

Baseado no **Loan Plugin** do DJ DataForge v6.

---

## 🎓 Próximos Passos

1. **Instale** seguindo [QUICKSTART.md](QUICKSTART.md)
2. **Crie** um contrato de teste
3. **Gere** um cronograma
4. **Registre** um pagamento
5. **Explore** as funções disponíveis

---

**Versão:** 1.0.0
**Última atualização:** Janeiro 2025
**Autor:** DJ DataForge

---

**Comece agora:** [QUICKSTART.md](QUICKSTART.md) ⚡
