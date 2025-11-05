# 💰 Loan Manager - Excel Add-in

Plugin de Gestão de Empréstimos para Microsoft Excel

Versão adaptada do **Loan Plugin** do DJ DataForge v6, desenvolvido especificamente para funcionar no Microsoft Excel como um Office Add-in.

---

## 📋 Índice

- [Visão Geral](#-visão-geral)
- [Funcionalidades](#-funcionalidades)
- [Requisitos](#-requisitos)
- [Instalação](#-instalação)
- [Como Usar](#-como-usar)
- [Estrutura de Arquivos](#-estrutura-de-arquivos)
- [Diferenças do Plugin Original](#-diferenças-do-plugin-original)
- [Desenvolvimento](#-desenvolvimento)
- [Limitações](#-limitações)
- [Roadmap](#-roadmap)
- [Licença](#-licença)

---

## 🎯 Visão Geral

O **Loan Manager** é um add-in completo para Microsoft Excel que permite gerenciar contratos de empréstimo com:

- ✅ Criação de contratos de empréstimo
- ✅ Suporte a múltiplas moedas (BRL, USD, EUR, GBP)
- ✅ Cálculos financeiros precisos (PRICE e SAC)
- ✅ Geração automática de cronogramas de pagamento
- ✅ Registro de pagamentos e amortizações
- ✅ Ledger completo de transações
- ✅ Persistência em planilhas Excel
- ✅ Interface intuitiva no painel lateral

Este add-in é uma **versão standalone** do Loan Plugin do DJ DataForge v6, adaptado para funcionar independentemente no Excel.

---

## ⚡ Funcionalidades

### 1. Gestão de Contratos

- **Criar contratos** de empréstimo com configuração completa
- Suporte a **dois tipos**: Captado (empréstimo recebido) ou Cedido (empréstimo concedido)
- **Múltiplas moedas**: BRL, USD, EUR, GBP
- Configuração de **taxas de juros** anuais
- **Datas flexíveis** de início e vencimento

### 2. Sistemas de Amortização

- **PRICE (Tabela Price)**: Parcelas fixas
- **SAC (Sistema de Amortização Constante)**: Amortização constante

### 3. Cronogramas Automáticos

- Geração automática de cronogramas de pagamento
- Cálculo detalhado de:
  - Saldo inicial e final
  - Valor da parcela
  - Juros do período
  - Amortização do principal
- Totalização automática

### 4. Registro de Pagamentos

- Registro de pagamentos realizados
- Atualização automática de saldos
- Histórico completo no Ledger
- Controle de status (Ativo/Quitado)

### 5. Planilhas Automáticas

O add-in cria automaticamente as seguintes planilhas:

- **Contratos**: Lista completa de todos os contratos
- **Ledger_[ID]**: Histórico de transações por contrato
- **Cronograma_[ID]**: Cronograma de pagamentos detalhado

---

## 💻 Requisitos

### Software Necessário

- **Microsoft Excel** (versão 2016 ou superior)
  - Excel para Windows
  - Excel para Mac
  - Excel Online (limitado)
- **Navegador moderno** (para desenvolvimento)
  - Chrome, Edge, Firefox, Safari
- **Node.js** (versão 14 ou superior) - apenas para desenvolvimento
- **Servidor HTTP local** (para testes)

### Permissões

O add-in requer permissão **ReadWriteDocument** para:
- Criar e modificar planilhas
- Escrever dados nas células
- Formatar células e intervalos

---

## 📦 Instalação

### Opção 1: Instalação via Sideloading (Desenvolvimento/Teste)

Esta é a forma mais rápida para testar o add-in localmente.

#### Passo 1: Configurar Servidor Local

Você precisa servir os arquivos via HTTP (não funciona com `file://`).

**Opção A: Usar Python (se tiver instalado)**

```bash
# Navegue até a pasta do add-in
cd excel-loan-plugin

# Inicie servidor HTTP na porta 3000
python -m http.server 3000
```

**Opção B: Usar Node.js http-server**

```bash
# Instale http-server globalmente
npm install -g http-server

# Navegue até a pasta do add-in
cd excel-loan-plugin

# Inicie servidor
http-server -p 3000
```

**Opção C: Usar Live Server (VS Code)**

1. Instale a extensão "Live Server" no VS Code
2. Clique com botão direito em `taskpane.html`
3. Selecione "Open with Live Server"

#### Passo 2: Atualizar Manifest

Edite o arquivo `manifest.xml` e substitua `https://localhost:3000` pelo endereço do seu servidor local.

Por exemplo, se usar Python na porta 3000:

```xml
<SourceLocation DefaultValue="http://localhost:3000/taskpane.html"/>
```

#### Passo 3: Carregar no Excel (Windows)

1. Abra o Excel
2. Vá em **Inserir** → **Meus Suplementos** → **Suplementos do Office**
3. Clique em **Adicionar Personalizado** → **Adicionar do Arquivo**
4. Navegue até o arquivo `manifest.xml` e selecione-o
5. Clique em **OK**

O add-in aparecerá na guia **Página Inicial** → **Empréstimos** → **Abrir Painel**

#### Passo 4: Carregar no Excel (Mac)

1. Abra o Excel
2. Vá em **Inserir** → **Suplementos** → **Meus Suplementos**
3. Clique em **Adicionar do Arquivo**
4. Navegue até o arquivo `manifest.xml` e selecione-o
5. Clique em **Adicionar**

#### Passo 5: Carregar no Excel Online

1. Acesse Excel Online ([office.com](https://office.com))
2. Abra uma pasta de trabalho
3. Vá em **Inserir** → **Suplementos**
4. Clique em **Carregar Meu Suplemento**
5. Faça upload do arquivo `manifest.xml`

### Opção 2: Instalação via AppSource (Produção)

Para uso em produção, o add-in pode ser publicado no Microsoft AppSource. Este processo requer:

1. Conta Microsoft Partner
2. Validação da Microsoft
3. Hospedagem em servidor HTTPS público

*Esta opção está fora do escopo deste README.*

---

## 🚀 Como Usar

### 1. Abrindo o Add-in

1. Abra o Excel
2. Vá na guia **Página Inicial**
3. Procure o grupo **Empréstimos**
4. Clique em **Abrir Painel**

O painel lateral será aberto à direita.

### 2. Criando um Contrato

1. No painel lateral, clique em **+ Novo Contrato**
2. Preencha os campos:
   - **Tipo**: Captado (empréstimo recebido) ou Cedido (empréstimo concedido)
   - **Contraparte**: Nome do banco ou instituição (ex: "Banco XYZ")
   - **Moeda**: BRL, USD, EUR ou GBP
   - **Principal**: Valor do empréstimo (ex: 100000.00)
   - **Data Início**: Data de início do contrato
   - **Data Vencimento**: Data de vencimento final
   - **Taxa de Juros**: Taxa anual em % (ex: 12.5)
   - **Sistema**: PRICE (parcela fixa) ou SAC (amortização constante)
   - **Periodicidade**: Mensal, Trimestral, Semestral ou Anual
   - **Parcelas**: Número de parcelas
3. Clique em **✓ Criar Contrato**

**Resultado:**
- Contrato criado com ID único (ex: `LOAN-1730812345-ABC123`)
- Planilha **Contratos** criada/atualizada com os dados
- Planilha **Ledger_[ID]** criada com entrada inicial

### 3. Gerando Cronograma de Pagamentos

1. Na lista de contratos, clique no contrato desejado
2. Escolha **📊 Gerar Cronograma**
3. O cronograma será gerado automaticamente

**Resultado:**
- Planilha **Cronograma_[ID]** criada com:
  - Informações do contrato
  - Tabela completa de parcelas
  - Detalhamento de juros e amortização
  - Totais calculados automaticamente

### 4. Registrando Pagamentos

1. Na lista de contratos, clique no contrato desejado
2. Escolha **💳 Registrar Pagamento**
3. Informe:
   - Valor do pagamento
   - Data do pagamento
4. Confirme

**Resultado:**
- Saldo do contrato atualizado
- Entrada registrada no Ledger
- Status atualizado (se quitado)
- Planilha **Contratos** atualizada

### 5. Visualizando Detalhes

1. Na lista de contratos, clique no contrato desejado
2. Escolha **📄 Ver Detalhes**
3. Visualize todas as informações do contrato

---

## 📁 Estrutura de Arquivos

```
excel-loan-plugin/
├── manifest.xml                  # Manifesto do Office Add-in
├── taskpane.html                 # Interface principal (HTML)
├── taskpane.js                   # Lógica da interface (JavaScript)
├── README.md                     # Este arquivo
├── LOAN_PLUGIN_DOCUMENTATION.md  # Documentação do plugin original
├── assets/                       # Recursos visuais
│   ├── icon-16.png
│   ├── icon-32.png
│   ├── icon-64.png
│   └── icon-80.png
└── src/                          # Código-fonte
    ├── loan-calculator.js        # Calculadora financeira
    └── loan-manager.js           # Gerenciador de contratos
```

### Descrição dos Arquivos Principais

#### `manifest.xml`
Arquivo de configuração do Office Add-in. Define:
- ID do add-in
- Nome e descrição
- Permissões necessárias
- URLs dos recursos
- Ribbon buttons

#### `taskpane.html`
Interface HTML do painel lateral. Contém:
- Formulário de criação de contratos
- Lista de contratos
- Estilos CSS inline
- Carregamento de scripts

#### `taskpane.js`
Lógica de interface e interação com o usuário. Funções principais:
- `showContractForm()`: Exibe formulário de criação
- `createContract()`: Cria novo contrato
- `loadContracts()`: Carrega lista de contratos
- `generateSchedule()`: Gera cronograma
- `registerPayment()`: Registra pagamento

#### `src/loan-calculator.js`
Calculadora financeira pura (sem dependências). Funções:
- `round()`: Arredondamento
- `getDaysBetween()`: Contagem de dias (30/360, ACT/365, ACT/360, BUS/252)
- `calculatePeriodicRate()`: Taxa periódica
- `calculatePMT()`: Valor da parcela (PRICE)
- `calculateIPMT()`: Juros da parcela
- `calculatePPMT()`: Amortização da parcela
- `generatePRICESchedule()`: Cronograma PRICE
- `generateSACSchedule()`: Cronograma SAC

#### `src/loan-manager.js`
Gerenciador de contratos e integração com Excel. Funções:
- `createContract()`: Cria contrato e atualiza planilhas
- `registerPayment()`: Registra pagamento e atualiza saldos
- `generateSchedule()`: Gera cronograma completo
- `updateContractsSheet()`: Atualiza planilha de contratos
- `createLedgerEntry()`: Cria entrada no ledger
- `loadContractsFromSheet()`: Carrega contratos da planilha

---

## 🔄 Diferenças do Plugin Original

O **Loan Manager** para Excel é uma versão **simplificada** do Loan Plugin original do DJ DataForge v6. Principais diferenças:

### Funcionalidades Removidas

❌ **Integração com FX Plugin**: Não há integração com taxas de câmbio (PTAX/BCB)
  - Solução: Usar taxa FX fixa no contrato ou manual

❌ **Múltiplas Pernas de Juros**: Não suporta indexadores compostos (CDI + PTAX)
  - Solução: Usar taxa fixa simples

❌ **Cronograma ACCRUAL**: Não gera cronograma de acúmulo de juros período a período
  - Solução: Usar apenas cronograma de pagamentos (SCHEDULE)

❌ **Dashboard Interativo**: Não possui dashboard visual com KPIs
  - Solução: Usar planilhas Excel para análises

❌ **Sistema de Relatórios Avançados**: Não possui templates de relatórios customizáveis
  - Solução: Criar relatórios manualmente nas planilhas

❌ **Histórico de ACCRUAL**: Não rastreia histórico de acumulação de juros
  - Solução: Usar histórico do Ledger

❌ **Fórmulas Customizadas**: Não registra fórmulas `LOAN.*` no Excel
  - Solução: Usar funções nativas do Excel para cálculos adicionais

### Funcionalidades Mantidas

✅ **Criação de Contratos**: Completo
✅ **Sistemas de Amortização**: PRICE e SAC
✅ **Cronogramas de Pagamento**: Completo
✅ **Registro de Pagamentos**: Completo
✅ **Ledger de Transações**: Completo
✅ **Persistência**: Em planilhas Excel (substitui IndexedDB)
✅ **Interface Visual**: Task Pane no Excel

### Simplificações

- **Taxa FX Fixa**: Apenas 1 taxa de câmbio por contrato (não há mark-to-market)
- **Taxa de Juros Simples**: Apenas 1 taxa anual (não há pernas múltiplas)
- **Convenção de Dias**: Suporta 30/360, ACT/365, ACT/360, BUS/252
- **Capitalização**: Exponencial ou Linear
- **Moedas**: BRL, USD, EUR, GBP (fixas)

---

## 🛠 Desenvolvimento

### Pré-requisitos

- Node.js 14+
- Navegador moderno
- Microsoft Excel

### Configuração do Ambiente

1. Clone ou baixe o repositório
2. Navegue até a pasta do add-in
3. Inicie servidor HTTP local (veja [Instalação](#-instalação))
4. Carregue o manifest no Excel

### Desenvolvimento Local

Para desenvolvimento ativo:

1. Use **Live Server** (VS Code) ou **http-server** (Node.js)
2. Edite os arquivos HTML/JS/CSS
3. Recarregue o Task Pane no Excel (F5 ou feche e reabra)
4. Use **DevTools do Excel**:
   - Windows: Clique com botão direito no Task Pane → **Inspecionar**
   - Mac: Safari Developer Tools → **Develop** → **Show Web Inspector**

### Estrutura de Desenvolvimento

```javascript
// Inicialização do Office Add-in
Office.onReady((info) => {
  if (info.host === Office.HostType.Excel) {
    // Código de inicialização
  }
});

// Interação com Excel
Excel.run(async (context) => {
  const sheets = context.workbook.worksheets;
  // ... operações no Excel
  await context.sync();
});
```

### Debug

- **Console**: Use `console.log()` e visualize no DevTools
- **Breakpoints**: Use DevTools para debugar JavaScript
- **Erros**: Verifique console para erros de Office.js ou Excel

---

## ⚠️ Limitações

### Técnicas

1. **Requer Servidor HTTP**: Não funciona com `file://` (limitação do Office.js)
2. **CORS**: Servidor deve permitir CORS para Excel Online
3. **Persistência**: Dados salvos apenas nas planilhas (sem banco de dados)
4. **Performance**: ACCRUAL diário para períodos longos pode ser lento
5. **Offline**: Requer conexão para Excel Online

### Funcionais

1. **Taxas FX**: Não busca taxas de câmbio automaticamente (PTAX/BCB)
2. **Indexadores**: Não suporta CDI, SELIC ou outros índices automáticos
3. **Calendário**: BUS/252 não considera feriados (apenas finais de semana)
4. **Multiusuário**: Não possui controle de concorrência
5. **Auditoria**: Não rastreia quem fez alterações

### Interface

1. **Task Pane**: Limitado ao espaço lateral (não fullscreen)
2. **Diálogos**: Usa `prompt()` e `confirm()` nativos (limitados)
3. **Validações**: Validações básicas (não tão robustas quanto original)

---

## 🗺️ Roadmap

### Versão 1.1 (Curto Prazo)

- [ ] Melhorar interface com diálogos customizados
- [ ] Adicionar validações mais robustas
- [ ] Suporte a carência (juros ou total)
- [ ] Exportação de relatórios (PDF/Excel)

### Versão 1.2 (Médio Prazo)

- [ ] Integração com API de taxas FX (externa)
- [ ] Suporte a indexadores (CDI via API)
- [ ] Cronograma ACCRUAL simplificado
- [ ] Dashboard visual nas planilhas

### Versão 2.0 (Longo Prazo)

- [ ] Múltiplas pernas de juros
- [ ] Sistema de relatórios avançados
- [ ] Fórmulas customizadas Excel (UDFs)
- [ ] Publicação no AppSource
- [ ] Suporte a Excel para iPad/iPhone

---

## 📝 Exemplos de Uso

### Exemplo 1: Empréstimo Simples em Real

```
Tipo: Captado
Contraparte: Banco ABC
Moeda: BRL
Principal: R$ 100.000,00
Taxa: 12,5% a.a.
Sistema: PRICE
Periodicidade: Mensal
Parcelas: 12
Data Início: 01/01/2025
Data Vencimento: 31/12/2025
```

**Resultado:**
- 12 parcelas fixas de ~R$ 8.884,88
- Juros totais: ~R$ 6.618,56
- Cronograma completo gerado automaticamente

### Exemplo 2: Empréstimo em Dólar com SAC

```
Tipo: Captado
Contraparte: Banco Internacional
Moeda: USD
Principal: USD 50.000,00
Taxa: 8,0% a.a.
Sistema: SAC
Periodicidade: Mensal
Parcelas: 24
Data Início: 01/01/2025
Data Vencimento: 31/12/2026
```

**Resultado:**
- Amortização constante: USD 2.083,33/mês
- Parcela inicial: ~USD 2.416,67
- Parcela final: ~USD 2.097,22
- Cronograma completo gerado automaticamente

---

## 🤝 Contribuindo

Este é um projeto de teste/demonstração. Para contribuir:

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

---

## 📄 Licença

Este projeto é fornecido "como está" para fins educacionais e de demonstração.

Baseado no **Loan Plugin** do DJ DataForge v6.

---

## 🆘 Suporte

Para dúvidas ou problemas:

1. Consulte a [documentação completa](LOAN_PLUGIN_DOCUMENTATION.md) do plugin original
2. Verifique o console do navegador (DevTools) para erros
3. Abra uma issue no repositório

---

## 🎓 Referências

- [Documentação Office Add-ins](https://docs.microsoft.com/en-us/office/dev/add-ins/)
- [Excel JavaScript API](https://docs.microsoft.com/en-us/office/dev/add-ins/reference/overview/excel-add-ins-reference-overview)
- [Loan Plugin Original - Documentação Completa](LOAN_PLUGIN_DOCUMENTATION.md)

---

**Desenvolvido como versão standalone do Loan Plugin do DJ DataForge v6**

Para a versão completa integrada ao DataForge, consulte o plugin original.
