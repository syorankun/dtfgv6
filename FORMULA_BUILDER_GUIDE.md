# 🧮 Guia do Construtor de Fórmulas

## Visão Geral

O **Construtor de Fórmulas** é uma ferramenta intuitiva e poderosa projetada para ajudar usuários de todos os níveis a criar fórmulas complexas sem precisar memorizar sintaxe ou nomes de funções.

## Como Acessar

O Construtor de Fórmulas pode ser acessado de 4 formas:

1. **Botão fx na Barra de Fórmulas** ⭐ **NOVO**
   - Clique no botão **fx** ao lado da barra de fórmulas
   - Acesso rápido e direto ao construtor

2. **Ribbon Menu → Fórmulas → Funções Rápidas**
   - Clique em "Todas" 🧮 para ver todas as funções
   - Clique em "AutoSoma" Σ para inserir soma rápida

3. **Ribbon Menu → Fórmulas → Biblioteca de Funções**
   - Clique em "Matemática" 📐
   - Clique em "Estatística" 📊
   - Clique em "Texto" 📝
   - Clique em "Lógica" 🔀
   - Clique em "Pesquisa" 🔍

4. **Atalhos de Teclado**
   - Com o construtor aberto, use Enter, Escape, Ctrl+F e setas

## Interface do Construtor

### 🎯 Estrutura

```
┌─────────────────────────────────────────────────────────┐
│  🧮 Construtor de Fórmulas                        [×]   │
├──────────────┬──────────────────────────────────────────┤
│              │                                          │
│  📚 FUNÇÕES  │         📋 DETALHES DA FUNÇÃO           │
│              │                                          │
│  🔍 Busca    │  • Nome e categoria                      │
│  📂 Filtro   │  • Descrição completa                    │
│              │  • Campos para argumentos                │
│  [Lista de   │  • Exemplo de uso                        │
│   Funções]   │  • Tipo de retorno                       │
│              │                                          │
├──────────────┴──────────────────────────────────────────┤
│  📝 PREVIEW: =SOMA(A1:A10)                              │
│  [Cancelar]              [✓ Inserir Fórmula na Célula] │
└─────────────────────────────────────────────────────────┘
```

### 🔍 Barra Lateral Esquerda

**Busca Inteligente**
- Digite para buscar funções por nome ou descrição
- Busca em tempo real, sem necessidade de pressionar Enter
- Exemplos:
  - `soma` → encontra SOMA, AutoSoma
  - `média` → encontra MÉDIA, funções estatísticas
  - `texto` → encontra CONCATENAR, MAIÚSCULA, etc.

**Filtro por Categoria**
- 📚 Todas as Categorias (padrão)
- 📐 Matemática (SOMA, ABS, RAIZ, etc.)
- 📊 Estatística (MÉDIA, MÁXIMO, MÍNIMO, etc.)
- 📝 Texto (CONCATENAR, MAIÚSCULA, etc.)
- 🔀 Lógica (SE, E, OU, NÃO)
- 🔍 Pesquisa (PROCV)
- ℹ️ Informação (ÉNÚM, ÉTEXTO, ÉVAZIO)

**Lista de Funções**
- Clique em qualquer função para ver detalhes
- Hover mostra highlight visual
- Função selecionada fica destacada

### 📋 Painel de Detalhes (Direita)

**Cabeçalho da Função**
```
SOMA  [📐 Matemática]
Soma todos os números fornecidos
```

**Argumentos Interativos**

Cada argumento mostra:
- ✅ **Nome**: Identificação clara do argumento
- 🏷️ **Tipo**: número, texto, intervalo, lógico, etc.
- 🚨 **Obrigatoriedade**: Badge vermelho (obrigatório) ou cinza (opcional)
- ♾️ **Repetível**: Badge azul "..." indica que aceita múltiplos valores

**Exemplo de Campos**:

```
📋 Argumentos:

número1 (número ou intervalo) [obrigatório]
┌──────────────────────────────────────┐
│ Ex: 42 ou A1:A10                     │
└──────────────────────────────────────┘
ℹ️ Digite um número, célula ou intervalo

número2 (número ou intervalo) [opcional] [...]
┌──────────────────────────────────────┐
│ Ex: 42 ou A1:A10                     │
└──────────────────────────────────────┘
ℹ️ Digite um número, célula ou intervalo
```

**Seção de Exemplo**
```
💡 Exemplo:
=SOMA(A1:A10)
```

**Seção de Retorno**
```
📤 Retorna:
A soma de todos os números
```

### 📝 Preview da Fórmula

- Atualiza **em tempo real** conforme você digita
- Mostra a fórmula completa que será inserida
- Formato: `=NOME_FUNÇÃO(arg1, arg2, ...)`
- Destaque visual com cor primária

### ✓ Inserir Fórmula

- Insere a fórmula na célula atualmente selecionada
- Recalcula automaticamente todas as dependências
- Fecha o construtor após inserir

## 📚 Funções Disponíveis

### 📐 Matemática

| Função | Descrição | Exemplo |
|--------|-----------|---------|
| `SOMA` | Soma todos os números | `=SOMA(A1:A10)` |
| `ARREDONDAR` | Arredonda um número | `=ARREDONDAR(3.14159, 2)` |
| `ABS` | Valor absoluto | `=ABS(-5)` |
| `RAIZ` | Raiz quadrada | `=RAIZ(16)` |
| `POTÊNCIA` | Eleva à potência | `=POTÊNCIA(2, 3)` |

### 📊 Estatística

| Função | Descrição | Exemplo |
|--------|-----------|---------|
| `MÉDIA` | Média aritmética | `=MÉDIA(B1:B10)` |
| `MÁXIMO` | Maior valor | `=MÁXIMO(C1:C10)` |
| `MÍNIMO` | Menor valor | `=MÍNIMO(D1:D10)` |
| `CONT.NÚM` | Conta números | `=CONT.NÚM(A1:A10)` |
| `CONT.VALORES` | Conta valores não vazios | `=CONT.VALORES(A1:A10)` |

### 📝 Texto

| Função | Descrição | Exemplo |
|--------|-----------|---------|
| `CONCATENAR` | Une textos | `=CONCATENAR("Olá", " ", "Mundo")` |
| `MAIÚSCULA` | Converte para maiúsculas | `=MAIÚSCULA("hello")` |
| `MINÚSCULA` | Converte para minúsculas | `=MINÚSCULA("HELLO")` |
| `TEXTO` | Formata como texto | `=TEXTO(1234.5, "pt-BR")` |
| `NÚM.CARACT` | Conta caracteres | `=NÚM.CARACT("Hello")` |

### 🔀 Lógica

| Função | Descrição | Exemplo |
|--------|-----------|---------|
| `SE` | Condicional | `=SE(A1>100, "Alto", "Baixo")` |
| `E` | E lógico (todas verdadeiras) | `=E(A1>0, B1<100)` |
| `OU` | OU lógico (alguma verdadeira) | `=OU(A1>0, B1>0)` |
| `NÃO` | Negação lógica | `=NÃO(A1>100)` |

### 🔍 Pesquisa

| Função | Descrição | Exemplo |
|--------|-----------|---------|
| `PROCV` | Procura vertical em tabela | `=PROCV("João", A1:C10, 2, VERDADEIRO)` |

### ℹ️ Informação

| Função | Descrição | Exemplo |
|--------|-----------|---------|
| `ÉNÚM` | Verifica se é número | `=ÉNÚM(A1)` |
| `ÉTEXTO` | Verifica se é texto | `=ÉTEXTO(A1)` |
| `ÉVAZIO` | Verifica se está vazio | `=ÉVAZIO(A1)` |

## 💡 Dicas de Uso

### Para Iniciantes

1. **Não sabe qual função usar?**
   - Use a busca para descrever o que quer fazer
   - Exemplo: digite "somar" para encontrar SOMA

2. **Não sabe a sintaxe?**
   - Não há problema! O construtor mostra campos claros
   - Basta preencher os campos e ver o preview

3. **Argumentos opcionais**
   - Campos marcados como "opcional" podem ficar vazios
   - O construtor preenche valores padrão quando necessário

4. **Múltiplos valores**
   - Funções com badge "..." aceitam múltiplos argumentos
   - Separe com vírgula: `A1, B1, C1` ou use ranges: `A1:C1`

### Para Usuários Avançados

1. **Referências de célula**
   - Digite diretamente: `A1`, `B2`, `C3`
   - Ranges: `A1:A10`, `B1:C5`
   - Referências absolutas: `$A$1`

2. **Fórmulas aninhadas**
   - Use o resultado de uma função como argumento
   - Exemplo: `=SE(MÉDIA(A1:A10)>50, "Aprovado", "Reprovado")`

3. **Textos**
   - Sempre entre aspas duplas: `"Meu texto"`
   - Números não precisam de aspas: `42`

4. **Valores lógicos**
   - `VERDADEIRO` ou `FALSO` (sem aspas)
   - Comparações: `A1>10`, `B2="Sim"`

## 🎯 Exemplos Práticos

### Exemplo 1: Somar Vendas

**Objetivo**: Somar todas as vendas de janeiro

1. Selecione a célula onde quer o total
2. Abra o Construtor → Matemática
3. Clique em "SOMA"
4. No campo `número1`, digite: `B2:B31`
5. Preview mostra: `=SOMA(B2:B31)`
6. Clique em "Inserir Fórmula"

### Exemplo 2: Classificar por Média

**Objetivo**: Se média for > 7, mostrar "Aprovado", senão "Reprovado"

1. Selecione a célula de resultado
2. Abra o Construtor → Lógica
3. Clique em "SE"
4. Preencha:
   - `condição`: `MÉDIA(B2:B5)>7`
   - `se_verdadeiro`: `"Aprovado"`
   - `se_falso`: `"Reprovado"`
5. Preview: `=SE(MÉDIA(B2:B5)>7, "Aprovado", "Reprovado")`
6. Clique em "Inserir Fórmula"

### Exemplo 3: Nome Completo

**Objetivo**: Juntar primeiro nome e sobrenome

1. Selecione a célula de destino
2. Abra o Construtor → Texto
3. Clique em "CONCATENAR"
4. Preencha:
   - `texto1`: `A2`
   - `texto2`: `" "`
   - Adicione mais: `B2`
5. Preview: `=CONCATENAR(A2, " ", B2)`
6. Clique em "Inserir Fórmula"

## ⚡ Atalhos e Produtividade

### Atalhos de Teclado Disponíveis

- **Enter**: Insere a fórmula na célula e fecha o construtor
- **Escape**: Cancela e fecha o construtor (se não estiver selecionando células)
- **Ctrl+F**: Foca no campo de busca para encontrar funções rapidamente
- **↑ / ↓ (Setas)**: Navega para cima/baixo na lista de funções
- **fx (botão)**: Abre o construtor direto da barra de fórmulas

### Recursos de Seleção

- **📍 Selecionar**: Clique nas células do grid para inserir referências
- **🔍 Auto**: Detecção inteligente de intervalos e tabelas de dados
- **Destaque de Sintaxe**: Preview com cores para melhor visualização
  - Funções em **azul**
  - Referências de células em **laranja**
  - Números em **roxo**
  - Textos em **verde**
  - Operadores em **laranja**

## 🔧 Solução de Problemas

**Fórmula não aparece no preview?**
- Verifique se preencheu todos os campos obrigatórios (badge vermelho)

**Erro ao inserir fórmula?**
- Certifique-se de que uma célula está selecionada
- Verifique se os argumentos estão corretos

**Não encontro a função que preciso?**
- Use a busca por descrição
- Verifique se está no filtro de categoria correto

## 🎓 Próximos Passos

Após dominar o Construtor de Fórmulas:
1. Explore fórmulas aninhadas (usar uma dentro da outra)
2. Crie suas próprias fórmulas complexas
3. Use referências absolutas ($A$1) para fixar células
4. Experimente com ranges nomeados (em breve)

---

**Precisa de mais ajuda?**
Consulte a documentação completa ou use o sistema de plugins para adicionar novas funções personalizadas!
