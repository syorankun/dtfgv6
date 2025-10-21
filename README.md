# 🔧 DJ DataForge v6

> **Excel-like data grid com engine de fórmulas, sistema de plugins e suporte multi-empresa - 100% client-side**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.0-646CFF.svg)](https://vitejs.dev/)

## 📋 Status do Projeto

**Fase Atual:** Foundation (Fase 1) ✅

- ✅ Setup do projeto (Vite + TypeScript)
- ✅ Core types consolidados
- ✅ Workbook model (Workbook, Sheet, Column, Cell)
- ✅ Calc Engine (Parser, Evaluator, Registry com 20+ fórmulas)
- ✅ Storage (IndexedDB com PersistenceManager)
- ✅ Kernel (orquestrador central)
- ✅ Multi-Company (CompanyManager)
- ✅ Logger e utilitários
- ✅ UI básica funcional
- 🚧 Grid virtualizado (Fase 4)
- 🚧 Plugin System (Fase 5)
- 🚧 UI completa (Fase 4)

## 🚀 Quick Start

### Instalação

```bash
# Clone o repositório
git clone <repo-url>
cd dj-dataforge-v6

# Instalar dependências
npm install

# Iniciar dev server
npm run dev

# Abrir http://localhost:5173
```

### Primeiro Uso

A aplicação inicializa automaticamente com:

- Uma empresa padrão: "Minha Empresa"
- IndexedDB configurado
- Sistema de auto-save (10s)
- Logger ativo

**Testar via Console do Navegador:**

```javascript
// Acessar o kernel
const kernel = window.DJKernel;

// Criar workbook
const wb = kernel.createWorkbook("Vendas 2025");
const sheet = wb.getActiveSheet();

// Adicionar dados
sheet.setCell(0, 0, "Produto");
sheet.setCell(0, 1, "Quantidade");
sheet.setCell(0, 2, "Preço");
sheet.setCell(0, 3, "Total");

sheet.setCell(1, 0, "Notebook");
sheet.setCell(1, 1, 5);
sheet.setCell(1, 2, 3000);
sheet.setCell(1, 3, "=B2*C2", { formula: "=B2*C2", type: "formula" });

sheet.setCell(2, 0, "Mouse");
sheet.setCell(2, 1, 10);
sheet.setCell(2, 2, 50);
sheet.setCell(2, 3, "=B3*C3", { formula: "=B3*C3", type: "formula" });

// Adicionar totais
sheet.setCell(3, 2, "TOTAL:");
sheet.setCell(3, 3, "=SOMA(D2:D3)", {
  formula: "=SOMA(D2:D3)",
  type: "formula",
});

// Recalcular
await kernel.recalculate(sheet.id);

// Ver resultados
console.log(sheet.getCellValue(1, 3)); // 15000
console.log(sheet.getCellValue(2, 3)); // 500
console.log(sheet.getCellValue(3, 3)); // 15500

// Salvar
await kernel.saveWorkbook(wb.id);
```

## 📚 Documentação Completa

Este projeto possui **11 SPECs** completos na pasta do projeto:

1. **SPEC-00**: README & Leitura (5 min)
2. **SPEC-01**: Architecture (30 min) - Fundações e decisões
3. **SPEC-02**: Core API (45 min) - Workbook, CalcEngine, Storage
4. **SPEC-03**: UI/UX (40 min) - Grid, navegação Excel
5. **SPEC-04**: Plugin System (35 min) - Extensibilidade
6. **SPEC-05**: Multi-Company (30 min) - Contexto empresarial
7. **SPEC-06**: Dev Guide (25 min) - Plano de implementação
8. **SPEC-07**: Tech Stack (20 min) - Libs, configs, deploy
9. **SPEC-08**: I/O & Transform (30 min) - Import/Export, filtros
10. **SPEC-09**: Testing (25 min) - Unit, E2E, Performance
11. **SPEC-11**: API Reference (ref) - Assinaturas completas

**Tempo total de leitura:** ~3h 25min

## 🧪 Fórmulas Disponíveis

### Matemática

- `SOMA(...números)` - Soma todos os números
- `MÉDIA(...números)` - Média aritmética
- `MÁXIMO(...números)` - Valor máximo
- `MÍNIMO(...números)` - Valor mínimo
- `ARREDONDAR(num, decimais)` - Arredondar
- `ABS(num)` - Valor absoluto
- `RAIZ(num)` - Raiz quadrada
- `POTÊNCIA(base, exp)` - Potência

### Texto

- `CONCATENAR(...textos)` - Concatenar textos
- `MAIÚSCULA(texto)` - Converter para maiúsculas
- `MINÚSCULA(texto)` - Converter para minúsculas
- `TEXTO(valor, formato)` - Formatar como texto
- `NÚM.CARACT(texto)` - Número de caracteres

### Lógica

- `SE(condição, verdadeiro, falso)` - Condicional
- `E(...condições)` - E lógico
- `OU(...condições)` - OU lógico
- `NÃO(valor)` - Negação

### Informação

- `ÉNÚM(valor)` - Verifica se é número
- `ÉTEXTO(valor)` - Verifica se é texto
- `ÉVAZIO(valor)` - Verifica se está vazio

### Contagem

- `CONT.NÚM(...valores)` - Contar números
- `CONT.VALORES(...valores)` - Contar valores não vazios

### Lookup

- `PROCV(valor, tabela, coluna, exato)` - Procura vertical

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────┐
│           🎨 UI LAYER (Fase 4)              │
│  Grid Virtual | Panels | Toolbar | Dialogs │
└──────────────────┬──────────────────────────┘
                   │ Events/Commands
┌──────────────────▼──────────────────────────┐
│        🧠 CORE LAYER (Fase 1-3)             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │ Workbook │ │   Calc   │ │ Storage  │    │
│  │ Manager  │ │  Engine  │ │ IndexedDB│    │
│  └──────────┘ └──────────┘ └──────────┘    │
│         ┌─────────────────────┐             │
│         │   Kernel (Maestro)  │             │
│         └─────────────────────┘             │
└──────────────────┬──────────────────────────┘
                   │ Plugin API
┌──────────────────▼──────────────────────────┐
│       🔌 PLUGIN LAYER (Fase 5)              │
│  FX-Pack | Charts | Pivot | Custom         │
└─────────────────────────────────────────────┘
```

## 📦 Estrutura de Arquivos (Consolidada)

```
src/
├── @core/
│   ├── types/index.ts                    # Todos os types
│   ├── workbook-consolidated.ts          # Workbook, Sheet, Column, Manager
│   ├── calc-engine-consolidated.ts       # Parser, Evaluator, Registry, DAG
│   ├── storage-utils-consolidated.ts     # Storage, Logger, Formatters, Assert
│   └── kernel.ts                         # Orquestrador central
├── app.ts                                # Entry point
└── style.css                             # Estilos consolidados
```

**Nota:** Arquivos consolidados possuem comentários `// FUTURE SPLIT POINTS:` indicando onde dividir no futuro.

## 🔧 Scripts Disponíveis

```bash
# Development
npm run dev              # Inicia dev server (localhost:5173)
npm run build            # Build para produção
npm run preview          # Preview do build

# Quality
npm run type-check       # Verificar tipos TypeScript
npm run lint             # ESLint
npm run format           # Prettier

# Testing (quando implementado)
npm run test             # Todos os testes
npm run test:unit        # Testes unitários
npm run test:e2e         # Testes E2E
npm run coverage         # Cobertura de testes
```

## 🎯 Roadmap

### Fase 2: Calc Engine Avançado (8-10h)

- [ ] Funções financeiras (VPL, TIR, PGTO)
- [ ] Funções de data (HOJE, AGORA, DIA, MÊS, ANO)
- [ ] Otimização do parser
- [ ] Suporte a ranges nomeados

### Fase 3: I/O & Transform (10-12h)

- [ ] CSV import/export
- [ ] XLSX import/export (SheetJS)
- [ ] JSON import/export
- [ ] Format sniffer (auto-detect)
- [ ] Schema inference (tipos automáticos)
- [ ] Transform pipeline (Filter, Sort, Group, Pivot)
- [ ] Undo/Redo completo

### Fase 4: UI Shell (16-18h) ⚠️ CRÍTICO

- [ ] Grid virtualizado com Canvas
- [ ] Selection manager (ranges)
- [ ] Inline cell editor (F2)
- [ ] Excel keyboard navigation
- [ ] Copy/Paste/Cut
- [ ] Formula bar com autocomplete
- [ ] Transform panel
- [ ] Plugin manager UI

### Fase 5: Plugin System (12-14h)

- [ ] Plugin host + loader
- [ ] Plugin API + security
- [ ] Plugin storage (IndexedDB isolado)
- [ ] 3 plugins nativos:
  - FX-Pack (fórmulas financeiras)
  - Charts (Chart.js wrapper)
  - Pivot Table

### Fase 6: Polish & QA (6-8h)

- [ ] Performance tuning (60 FPS grid)
- [ ] Accessibility (WCAG AA)
- [ ] Error handling
- [ ] Documentation
- [ ] Testing (50%+ coverage)

## 🤝 Contribuindo

Este projeto é desenvolvido seguindo SPECs rigorosas. Antes de contribuir:

1. Leia SPEC-00 a SPEC-06 (~3h)
2. Respeite limites de arquivo (500 linhas TS)
3. Siga convenções de código TypeScript strict
4. Adicione testes para novas features
5. Documente APIs públicas

## 📄 Licença

MIT License - veja [LICENSE](LICENSE)

## 🙏 Agradecimentos

Construído com:

- [Vite](https://vitejs.dev/) - Build tool
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [PapaParse](https://www.papaparse.com/) - CSV parsing
- [SheetJS](https://sheetjs.com/) - XLSX support
- [idb](https://github.com/jakearchibald/idb) - IndexedDB wrapper
- [Chart.js](https://www.chartjs.org/) - Gráficos
- [decimal.js](https://github.com/MikeMcl/decimal.js/) - Precisão numérica

---

**DJ DataForge v6** - Planilha profissional 100% client-side 🚀
