# Sistema de Relatórios e Visualizações - Loan Plugin

## Visão Geral

Sistema completo de geração de relatórios customizáveis para análise de empréstimos, com templates pré-definidos, construtor visual drag-and-drop, e integração com tabelas dinâmicas (pivot).

## 🎯 Funcionalidades Principais

### 1. **Templates Pré-Definidos**
- ✅ **Análise de Juros** - Foco em juros acumulados e variações cambiais
- ✅ **Análise de Principal** - Evolução do saldo devedor
- ✅ **Visão Consolidada** - Todas as métricas em um único relatório
- ✅ **Fluxo de Caixa** - Análise de competência e impacto financeiro
- ✅ **Resumo Executivo** - Visão simplificada para apresentações

### 2. **Seletor Visual de Templates**
- Interface moderna com preview de cada template
- Busca e filtros por categoria
- Visualização da estrutura de colunas
- Preview de dados de exemplo
- Configuração de período, frequência e opções de saída

### 3. **Construtor Visual com Drag-and-Drop**
- Criação de templates personalizados do zero
- Drag-and-drop de campos disponíveis
- Organização em seções personalizáveis
- Configuração de propriedades de colunas
- Salvamento de templates customizados

### 4. **Geração de Relatórios**
- Processamento de múltiplos contratos
- Agrupamento por moeda, tipo ou contraparte
- Saída para planilhas estáticas ou tabelas pivot
- Geração automática de gráficos (opcional)
- Consolidação de dados de accrual

### 5. **Integração com Pivot**
- Registro automático de fontes de dados
- Tabelas dinâmicas totalmente interativas
- Suporte para análises ad-hoc
- Exportação de datasets estruturados

## 📁 Arquitetura

```
src/plugins/loan/
├── loan-report-templates.ts      # Templates pré-definidos
├── loan-report-selector.ts       # Seletor visual de templates
├── loan-report-builder.ts        # Construtor drag-and-drop
├── loan-report-generator.ts      # Gerador de relatórios
├── loan-report-manager.ts        # Orquestrador central
└── loan-plugin.ts                # Integração principal
```

## 🎨 Componentes

### LoanReportTemplates
**Arquivo:** `loan-report-templates.ts`

Define 5 templates pré-configurados com diferentes visões:
- Estrutura de seções e colunas
- Metadados para exibição
- Configurações de formato e estilo
- Definições de agregações (sum, avg, last)

### LoanReportSelector
**Arquivo:** `loan-report-selector.ts`

Interface visual para seleção de templates:
- Grid de cards com preview
- Busca e filtros
- Configuração de parâmetros
- Preview de estrutura
- Botões de ação (Gerar/Personalizar)

### LoanReportBuilder
**Arquivo:** `loan-report-builder.ts`

Construtor visual de templates:
- Lista de campos disponíveis (25+ campos)
- Áreas de drop para seções
- Drag-and-drop de colunas
- Editor de propriedades
- Validação e salvamento

**Campos Disponíveis:**
- **Período:** Data, Dias, Taxa Efetiva
- **Moeda Origem:** Saldos e Juros
- **BRL Contrato:** Saldos, Juros e FX
- **BRL PTAX:** Saldos, Juros e FX
- **Variação Cambial:** Absoluta e Percentual
- **Genéricos:** Consolidados

### LoanReportGenerator
**Arquivo:** `loan-report-generator.ts`

Motor de geração de relatórios:
- Processa múltiplos contratos
- Coleta dados de accrual
- Agrupa por critérios
- Cria planilhas formatadas
- Registra fontes pivot
- Adiciona gráficos (integração futura)

### LoanReportManager
**Arquivo:** `loan-report-manager.ts`

Orquestrador central do sistema:
- Gerencia templates (built-in + customizados)
- Coordena selector, builder e generator
- Persiste templates no IndexedDB
- Fornece API para componentes
- Gerencia lifecycle completo

## 🚀 Como Usar

### 1. Acessar Menu de Relatórios

No menu "Empréstimos", acesse:
```
Empréstimos → 📊 Relatórios Avançados
```

### 2. Relatórios Rápidos

Gere relatórios instantâneos:
- **💰 Análise de Juros** - Últimos 30 dias, mensal
- **📊 Análise de Principal** - Evolução de saldos
- **📋 Visão Consolidada** - Todas as métricas

### 3. Relatório Personalizado

1. Clique em "🎨 Criar Relatório Personalizado"
2. Escolha template base ou crie do zero
3. Arraste campos para seções
4. Configure propriedades
5. Salve e gere relatório

### 4. Usando o Seletor

1. Selecione contratos
2. Defina período (início/fim)
3. Escolha frequência (Diário/Mensal/Anual)
4. Configure saída (Planilha/Pivot/Ambos)
5. Opcional: Habilite gráficos
6. Opcional: Agrupe por moeda/tipo/contraparte

## 📊 Templates Disponíveis

### Interest Analysis (Análise de Juros)
**ID:** `interest-analysis`
**Categoria:** Análise Detalhada

**Estrutura:**
- Período (Data, Dias)
- Juros em Moeda Origem
- Juros em BRL (Contrato e PTAX)
- Taxas de Câmbio
- Variação Cambial

**Caso de Uso:** Análise de despesas financeiras e impacto cambial

### Principal Analysis (Análise de Principal)
**ID:** `principal-analysis`
**Categoria:** Análise Detalhada

**Estrutura:**
- Período
- Saldos em Moeda Origem (Abertura, Juros, Fechamento)
- Saldos em BRL - Taxa Contrato
- Saldos em BRL - PTAX

**Caso de Uso:** Acompanhamento da evolução da dívida

### Consolidated (Visão Consolidada)
**ID:** `consolidated`
**Categoria:** Visão Geral

**Estrutura:**
- Período (Data, Dias)
- Principal (Saldos BRL)
- Juros (Total BRL + Taxa Efetiva)
- Câmbio (FX + Variação)

**Caso de Uso:** Relatórios mensais e análise completa

### Cashflow (Fluxo de Caixa)
**ID:** `cashflow`
**Categoria:** Financeiro

**Estrutura:**
- Período
- Accrual (Juros Provisionados, Variação Principal)
- Fluxo de Caixa (Impacto Total, Acumulado)

**Caso de Uso:** Análise de impacto financeiro e provisões

### Executive Summary (Resumo Executivo)
**ID:** `executive-summary`
**Categoria:** Gerencial

**Estrutura:**
- Período (Data, Dias)
- Métricas Principais (Saldo, Juros, Impacto FX, Taxa Média)

**Caso de Uso:** Apresentações executivas e decisões rápidas

## 🔧 Configurações Avançadas

### Agrupamento de Contratos

**Por Moeda:**
```typescript
groupBy: 'currency'
// Gera um relatório separado para cada moeda (USD, EUR, etc.)
```

**Por Tipo:**
```typescript
groupBy: 'type'
// Separa CAPTADO vs CEDIDO
```

**Por Contraparte:**
```typescript
groupBy: 'counterparty'
// Um relatório por instituição
```

### Modo de Saída

**Planilha Estática:**
```typescript
outputMode: 'sheet'
// Cria planilha formatada e não editável
```

**Tabela Pivot:**
```typescript
outputMode: 'pivot'
// Registra fonte de dados para análise dinâmica
```

**Ambos:**
```typescript
outputMode: 'both'
// Máxima flexibilidade
```

### Frequência de Dados

- **Diário:** Uma linha por dia útil
- **Mensal:** Uma linha por mês
- **Anual:** Uma linha por ano

## 🎯 Casos de Uso

### 1. Análise Mensal de Juros
```
Template: Interest Analysis
Período: Último mês
Frequência: Diário
Saída: Planilha + Pivot
Gráficos: Sim
```

### 2. Relatório Executivo Trimestral
```
Template: Executive Summary
Período: Último trimestre
Frequência: Mensal
Saída: Planilha
Agrupamento: Por tipo (CAPTADO/CEDIDO)
```

### 3. Análise de Fluxo de Caixa
```
Template: Cashflow
Período: Ano atual
Frequência: Mensal
Saída: Ambos
Gráficos: Sim
```

### 4. Comparação por Moeda
```
Template: Consolidated
Período: Personalizado
Frequência: Mensal
Agrupamento: Por moeda
Saída: Pivot (para análise ad-hoc)
```

## 💾 Persistência

### Templates Customizados
- **Storage Key:** `loan:custom-templates`
- **Formato:** Array de CustomTemplate
- **IndexedDB:** `plugin_data` store

### Estrutura de Dados
```typescript
interface CustomTemplate {
  id: string;
  name: string;
  description?: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  config: AccrualSheetViewConfig;
}
```

## 🔌 Integração com Pivot Plugin

### Registro de Fonte de Dados

O sistema emite eventos para o pivot plugin:
```typescript
context.events.emit('pivot:registerSource', {
  sourceId: 'loan-report:template:group:timestamp',
  plugin: 'dj.finance.loans',
  columns: [...], // Colunas com tipos
  rows: [...],    // Dados estruturados
  metadata: {
    templateId,
    templateName,
    groupName,
    startDate,
    endDate,
    frequency,
    contracts: count,
    title
  }
});
```

### Colunas Exportadas
- contractId, contractCurrency, contractType, counterparty
- periodStart, periodEnd
- Todas as colunas do template selecionado

## 📈 Gráficos (Integração Futura)

O sistema está preparado para integração com o Charts Plugin:
```typescript
context.events.emit('charts:request', {
  sheetName,
  chartType: 'line',
  dataSource: 'loan-accrual',
  config: {
    title: 'Evolução de Juros e Principal',
    xAxis: 'date',
    yAxis: ['interestBRL', 'closingBalanceBRL']
  }
});
```

## 🎨 Estilização

### Paleta de Cores
- **Primary:** #667eea (Azul)
- **Secondary:** #764ba2 (Roxo)
- **Success:** #10b981 (Verde)
- **Warning:** #f59e0b (Laranja)
- **Danger:** #ef4444 (Vermelho)

### Formatação de Células
- **Números:** Alinhamento à direita, 2-8 decimais
- **Datas:** Alinhamento centralizado
- **Texto:** Alinhamento à esquerda
- **Headers:** Negrito, fundo escuro
- **Totais:** Negrito, fundo destacado

## 🚦 Status do Projeto

### ✅ Implementado
- [x] 5 templates pré-definidos
- [x] Seletor visual com preview
- [x] Construtor drag-and-drop
- [x] Gerador de relatórios
- [x] Integração com pivot
- [x] Persistência de templates customizados
- [x] Agrupamento de contratos
- [x] Múltiplos modos de saída
- [x] Sistema de metadados
- [x] Validações e error handling

### 🔄 Em Desenvolvimento
- [ ] Gráficos automáticos
- [ ] Exportação XLSX/CSV/PDF
- [ ] Relatórios comparativos entre períodos
- [ ] Scheduler de relatórios automáticos
- [ ] Email de relatórios

### 💡 Roadmap Futuro
- [ ] Templates compartilháveis
- [ ] Biblioteca de templates da comunidade
- [ ] Suporte para fórmulas customizadas
- [ ] Visualizações interativas (D3.js)
- [ ] Dashboard de KPIs em tempo real

## 📚 Referências

### Arquivos Relacionados
- [loan-accrual-view.ts](src/plugins/loan/loan-accrual-view.ts) - Sistema de views base
- [loan-accrual-customizer.ts](src/plugins/loan/loan-accrual-customizer.ts) - Customizador de views
- [loan-sheets.ts](src/plugins/loan/loan-sheets.ts) - Gerador de planilhas
- [loan-scheduler.ts](src/plugins/loan/loan-scheduler.ts) - Motor de accrual

### Documentação
- [CLAUDE.md](CLAUDE.md) - Visão geral do projeto
- [ARCHITECTURE_ANALYSIS.md](ARCHITECTURE_ANALYSIS.md) - Análise arquitetural

## 🤝 Contribuindo

Para adicionar novos templates:

1. Defina o template em `loan-report-templates.ts`
2. Adicione metadados em `TEMPLATE_METADATA`
3. Registre em `REPORT_TEMPLATES`
4. Template estará disponível automaticamente

## 📝 Licença

Parte do DJ DataForge v6 - Todos os direitos reservados.

---

**Desenvolvido com ❤️ para análise avançada de empréstimos**
