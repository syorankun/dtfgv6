# Guia Rápido - Sistema de Relatórios

## ✅ Build Concluído

O sistema de relatórios foi implementado e o build foi bem-sucedido!

## 🚀 Como Acessar

### 1. Reinicie o Servidor de Desenvolvimento

```bash
# Pare o servidor atual (Ctrl+C)
# Inicie novamente:
npm run dev
```

### 2. Acesse no Navegador

Abra: `http://localhost:5173`

### 3. Localize o Menu

No menu principal da aplicação, você deve ver:

```
Empréstimos
  ├─ Dashboard de Contratos
  ├─ Novo Contrato
  ├─ Registrar Pagamento
  ├─ Gerar ACCRUAL
  │
  ├─ 📊 Relatórios Avançados ← NOVO!
  │   ├─ 💰 Análise de Juros
  │   ├─ 📊 Análise de Principal
  │   ├─ 📋 Visão Consolidada
  │   └─ 🎨 Criar Relatório Personalizado
  │
  └─ Sincronizar PTAX
```

## 🔍 Se Não Aparecer

### Opção 1: Limpar Cache e Recarregar
```bash
# Pare o servidor
Ctrl+C

# Limpe o cache do Vite
rm -rf node_modules/.vite

# Inicie novamente
npm run dev
```

### Opção 2: Hard Refresh no Navegador
- **Chrome/Edge:** `Ctrl+Shift+R` (Windows/Linux) ou `Cmd+Shift+R` (Mac)
- **Firefox:** `Ctrl+F5` (Windows/Linux) ou `Cmd+Shift+R` (Mac)

### Opção 3: Verificar Console do Navegador
Abra o Developer Tools (F12) e verifique se há erros no console.

## 📝 Pré-requisitos

Para usar o sistema de relatórios, você precisa:

1. **Ter contratos cadastrados**
   - Vá em: `Empréstimos → Novo Contrato`
   - Crie pelo menos um contrato de teste

2. **Sincronizar PTAX (opcional)**
   - Vá em: `Empréstimos → Sincronizar PTAX`
   - Sincronize taxas para o período desejado

## 🎯 Testando o Sistema

### Teste 1: Relatório Rápido

1. Clique em: `Empréstimos → 📊 Relatórios Avançados → 💰 Análise de Juros`
2. O sistema deve:
   - Processar contratos existentes
   - Gerar planilha formatada
   - Mostrar toast de sucesso

### Teste 2: Seletor Completo

1. Clique em: `Empréstimos → 📊 Relatórios Avançados`
2. Você verá uma interface moderna com:
   - Cards de templates disponíveis
   - Área de preview
   - Opções de configuração

3. Selecione um template
4. Configure opções:
   - Período (início/fim)
   - Frequência (Diário/Mensal/Anual)
   - Modo de saída (Planilha/Pivot/Ambos)
   - Agrupamento (opcional)

5. Clique em "✨ Gerar Relatório"

### Teste 3: Construtor Visual

1. Clique em: `Empréstimos → 📊 Relatórios Avançados → 🎨 Criar Relatório Personalizado`
2. Você verá:
   - Lista de campos disponíveis (esquerda)
   - Área de construção (centro)
   - Botão "➕ Adicionar Seção"

3. Experimente:
   - Adicionar seções
   - Arrastar campos
   - Salvar template customizado

## 🐛 Troubleshooting

### Erro: "Nenhum contrato cadastrado"
**Solução:** Crie contratos primeiro via `Empréstimos → Novo Contrato`

### Erro: "Template não encontrado"
**Solução:** Verifique se os arquivos foram salvos corretamente:
```bash
ls src/plugins/loan/loan-report-*.ts
```

### Menu não aparece
**Solução:** Verifique o console do navegador (F12) para erros de carregamento

### Build com erros
```bash
# Execute:
npm run type-check

# Se houver erros, eles serão listados
```

## 📊 Estrutura de Arquivos

Os novos arquivos criados:

```
src/plugins/loan/
├── loan-report-templates.ts      ✅ 5 templates pré-definidos
├── loan-report-selector.ts       ✅ Interface de seleção
├── loan-report-builder.ts        ✅ Construtor drag-and-drop
├── loan-report-generator.ts      ✅ Motor de geração
├── loan-report-manager.ts        ✅ Orquestrador
└── loan-plugin.ts                ✅ Integração (modificado)
```

## ✨ Recursos Disponíveis

### Templates Pré-Definidos
- ✅ Análise de Juros
- ✅ Análise de Principal
- ✅ Visão Consolidada
- ✅ Fluxo de Caixa
- ✅ Resumo Executivo

### Funcionalidades
- ✅ Seletor visual com preview
- ✅ Construtor drag-and-drop
- ✅ Múltiplos modos de saída
- ✅ Agrupamento automático
- ✅ Templates customizados salvos
- ✅ Integração com Pivot
- ✅ Formatação profissional

## 📞 Próximos Passos

Se tudo estiver funcionando:

1. **Explore os templates** - Teste cada um com seus dados
2. **Crie templates personalizados** - Use o construtor visual
3. **Experimente o modo Pivot** - Para análises dinâmicas
4. **Documente seus templates** - Salve os que mais usar

## 📚 Documentação Completa

Para detalhes completos, consulte:
- [LOAN_REPORTS_SYSTEM.md](LOAN_REPORTS_SYSTEM.md) - Documentação completa do sistema

---

**Desenvolvido com ❤️ para análise avançada de empréstimos**
