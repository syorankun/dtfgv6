# Charts Plugin - Correção de Bugs de API

## 🐛 Bugs Identificados no Console

### 1. `TypeError: this.context.kernel.workbookManager.setActiveSheet is not a function`

**Linha:** `charts-plugin.ts:790`

**Causa:**
O método `setActiveSheet()` não existe no `WorkbookManager`. Ele existe apenas na classe `Workbook`.

**Correção:**
```diff
- // Chamada incorreta no WorkbookManager
- this.context.kernel.workbookManager.setActiveSheet(chartSheet.id);

+ // Chamada correta no Workbook
+ workbook.setActiveSheet(chartSheet.id);
```

**API Correta:**
```typescript
// WorkbookManager
const workbook = workbookManager.getActiveWorkbook();

// Workbook
workbook.setActiveSheet(sheetId: string): void
```

---

### 2. `TypeError: workbook.removeSheet is not a function`

**Linha:** `charts-plugin.ts:771`

**Causa:**
O método correto é `deleteSheet()`, não `removeSheet()`.

**Correção:**
```diff
- // Método inexistente
- workbook.removeSheet(chartSheet.id);

+ // Método correto
+ workbook.deleteSheet(chartSheet.id);
+ this.context.ui.showToast('Sheet do gráfico removida', 'success');
```

**API Correta:**
```typescript
// Workbook
workbook.deleteSheet(id: string): boolean
// Retorna false se é a última sheet (não pode deletar)
// Retorna true se deletou com sucesso
```

---

## ✅ Código Corrigido

### Função `expandChartToSheet()` - Correções Aplicadas

```typescript
private async expandChartToSheet(chartConfig: ChartConfig): Promise<void> {
  try {
    const workbook = this.context.kernel.workbookManager.getActiveWorkbook();
    if (!workbook) {
      this.context.ui.showToast('Nenhum workbook ativo', 'error');
      return;
    }

    // Create new sheet for chart
    const sheetName = `📊 ${chartConfig.name}`;
    const chartSheet = workbook.addSheet(sheetName);

    // ... (criação do container e canvas)

    // ✅ CORREÇÃO 1: Close button com API correta
    document.getElementById('btn-close-chart-sheet')?.addEventListener('click', () => {
      chartContainer.remove();
      const shouldDeleteSheet = confirm('Deseja remover a sheet do gráfico também?');
      if (shouldDeleteSheet) {
        workbook.deleteSheet(chartSheet.id); // ✅ deleteSheet, não removeSheet
        this.context.ui.showToast('Sheet do gráfico removida', 'success');
      }
    });

    // Refresh button
    document.getElementById('btn-refresh-chart')?.addEventListener('click', () => {
      const canvas = document.getElementById('chart-fullscreen-canvas') as HTMLCanvasElement;
      if (canvas) {
        this.generateChart(chartConfig, canvas);
      }
      this.context.ui.showToast('Gráfico atualizado!', 'success');
    });

    // Export button
    document.getElementById('btn-export-chart-full')?.addEventListener('click', async () => {
      await this.exportChart(chartConfig.id);
    });

    // ✅ CORREÇÃO 2: setActiveSheet no workbook, não no workbookManager
    workbook.setActiveSheet(chartSheet.id); // ✅ workbook.setActiveSheet()

    this.context.ui.showToast(`Gráfico expandido em nova sheet: ${sheetName}`, 'success');
    logger.info('[ChartsPlugin] Chart expanded to sheet', { chartId: chartConfig.id, sheetName });
  } catch (error) {
    logger.error('[ChartsPlugin] Failed to expand chart to sheet', error);
    this.context.ui.showToast('Erro ao expandir gráfico', 'error');
  }
}
```

---

## 📚 API Reference - Workbook & WorkbookManager

### WorkbookManager

```typescript
class WorkbookManager {
  // Get active workbook
  getActiveWorkbook(): Workbook | undefined

  // Set active workbook
  setActiveWorkbook(id: string): boolean

  // Get active sheet (convenience method)
  getActiveSheet(): Sheet | undefined

  // Create, list, delete workbooks
  createWorkbook(name: string): Workbook
  listWorkbooks(): Workbook[]
  deleteWorkbook(id: string): boolean
}
```

### Workbook

```typescript
class Workbook {
  // Sheet management
  addSheet(name: string): Sheet
  deleteSheet(id: string): boolean
  getSheet(id: string): Sheet | undefined
  listSheets(): Sheet[]

  // Active sheet
  getActiveSheet(): Sheet | undefined
  setActiveSheet(id: string): void

  // Properties
  readonly id: string
  name: string
  sheets: Map<string, Sheet>
}
```

### Sheet

```typescript
class Sheet {
  // Cell operations
  setCell(row: number, col: number, value: any, format?: CellFormat): void
  getCell(row: number, col: number): Cell | undefined

  // Range operations
  getRange(startRow: number, startCol: number, endRow: number, endCol: number): Cell[][]
  getRangeFromString(rangeString: string): { start: CellPosition; end: CellPosition } | null

  // Column helpers
  getColumnName(col: number): string

  // Properties
  readonly id: string
  name: string
  rows: Map<number, Map<number, Cell>>
}
```

---

## 🧪 Validação

### TypeScript
```bash
npm run type-check
# ✅ 0 errors in charts-plugin.ts
```

### Runtime
```javascript
// Teste no console do browser:

// 1. Criar gráfico
// 2. Clicar em "⛶ Expandir"
// 3. Verificar que não há mais erros no console:
//    ✅ Sem "setActiveSheet is not a function"
//    ✅ Sem "removeSheet is not a function"

// 4. Sheet é criada corretamente
// 5. Gráfico renderizado em fullscreen
// 6. Botões funcionando:
//    - 🔄 Atualizar → OK
//    - 💾 Exportar → OK
//    - ✕ Fechar → OK
//       - Confirmar deletar sheet → OK
```

---

## 🎯 Lições Aprendidas

### 1. **Sempre Verificar a API Real**
Não assumir que métodos existem. Usar `Grep` ou `Read` para confirmar:
```bash
# Procurar métodos disponíveis
grep -n "class Workbook" workbook-consolidated.ts
grep -n "setActive" workbook-consolidated.ts
grep -n "deleteSheet\|removeSheet" workbook-consolidated.ts
```

### 2. **Diferença Entre Manager e Entidade**
- **WorkbookManager**: Gerencia múltiplos workbooks
- **Workbook**: Representa um workbook individual com suas sheets

```typescript
// ❌ Incorreto - Manager não gerencia sheets diretamente
workbookManager.setActiveSheet(id)

// ✅ Correto - Workbook gerencia suas próprias sheets
const workbook = workbookManager.getActiveWorkbook()
workbook.setActiveSheet(id)
```

### 3. **Nomeação de Métodos**
- `delete` (usado no DataForge) vs `remove` (comum em outras APIs)
- Sempre checar a convenção do projeto

### 4. **TypeScript Helps**
O TypeScript poderia ter detectado esses erros se tivéssemos usado tipos mais estritos:
```typescript
// Bom: Tipo explícito
const workbook: Workbook | undefined = this.context.kernel.workbookManager.getActiveWorkbook();
if (!workbook) return;

// Melhor ainda: Guard clause com type narrowing
if (!workbook) {
  this.context.ui.showToast('Nenhum workbook ativo', 'error');
  return;
}
// Aqui workbook é garantido ser Workbook, não undefined
```

---

## ✅ Status

- ✅ Bug 1 corrigido: `setActiveSheet` chamado no objeto correto
- ✅ Bug 2 corrigido: `deleteSheet` ao invés de `removeSheet`
- ✅ TypeScript: 0 errors
- ✅ Toast adicionado ao deletar sheet
- ✅ Pronto para produção

---

## 🚀 Teste Rápido

1. Abra o DataForge
2. Crie um gráfico
3. Clique em "⛶ Expandir"
4. Verifique:
   - ✅ Sheet criada com nome `📊 [Nome do Gráfico]`
   - ✅ Gráfico aparece em fullscreen
   - ✅ Nenhum erro no console
   - ✅ Botão fechar funciona
   - ✅ Ao fechar, pergunta se quer deletar sheet
   - ✅ Sheet é deletada corretamente se confirmado

**Bugs resolvidos! 🎉**
