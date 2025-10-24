# ProLease IFRS 16 Plugin v6.0.0

Plugin nativo para DataForge v6 que implementa cálculos completos de arrendamento segundo a norma IFRS 16.

## Status

✅ **TOTALMENTE FUNCIONAL** - Build bem-sucedido, integrado nativamente ao DataForge v6

## Arquitetura

### Implementação Nativa v6

O plugin foi **completamente refatorado** para seguir a arquitetura nativa do DataForge v6:

- **TypeScript nativo**: Usa interfaces Plugin, PluginContext do v6
- **PluginHost integration**: Carregado automaticamente com outros plugins built-in
- **Context API**: Acesso total ao kernel via context
- **Type-safe**: Tipos corretos para Sheet, Workbook, Cell, etc.

### Estrutura de Arquivos

```
src/plugins/prolease-ifrs16-plugin.ts    ← Plugin TypeScript nativo
src/app.ts                                ← Carregamento automático do plugin
package.json                              ← Dependências atualizadas
dist/                                     ← Build de produção (566 KB)
```

## Funcionalidades

### Cálculos IFRS 16 Completos

O plugin implementa **todos os cálculos** da norma IFRS 16:

1. **Passivo de Arrendamento**
   - Valor presente dos pagamentos futuros
   - Taxa de desconto mensal (conversão anual → mensal)
   - Amortização com juros compostos

2. **Ativo de Direito de Uso (ROU)**
   - Opening balance = Liability + IDC - Allowance
   - Amortização linear mensal
   - Closing balance tracking

3. **Classificação ST/LT**
   - Short-term liability (próximos 12 meses)
   - Long-term liability (após 12 meses)
   - Proof column (ST + LT = Total)

4. **Incentivos e Custos Diretos**
   - Landlord TI Allowance amortization
   - Initial Direct Costs amortization
   - Closing balances tracking

5. **Impacto P&L**
   - Interest expense
   - ROU amortization
   - Non-financial expenses
   - Total reported lease expense

### Interface do Usuário

#### 1. Toolbar Button
- Botão "New Lease" (📋) na barra de ferramentas
- Tooltip: "Create new IFRS 16 lease contract"

#### 2. Control Panel (lado direito)
- Título: "📋 ProLease Manager"
- Botão "Create New Contract"
- Lista de contratos salvos com:
  - Nome do contrato
  - Data de início, duração, valor mensal
  - Botões: Recalculate e Delete

#### 3. Prompts de Entrada
- Contract Name
- Term (months)
- Start Date (YYYY-MM-DD)
- Monthly Rent (gross)
- Monthly Service Deductions
- Annual Discount Rate (%)
- Landlord Allowance
- Initial Direct Costs

### Persistência de Dados

- **Storage**: `context.storage` (PluginStorageAPI)
- **Banco**: IndexedDB isolado por plugin
- **Chave**: 'contracts'
- **Estrutura**: Array de LeaseContract objects

### Fórmulas Registradas

O plugin registra 3 fórmulas customizadas no CalcEngine:

```typescript
=LEASE_PV(monthlyRate, months, payment)
  → Calcula valor presente dos pagamentos

=LEASE_MONTHLY_RATE(annualRate)
  → Converte taxa anual para mensal

=LEASE_ROU_OPENING(leaseLiability, directCosts, allowance)
  → Calcula opening balance do ROU asset
```

## Uso

### Criar Novo Contrato

1. Clique no botão "New Lease" na toolbar
2. Preencha os dados nos prompts:
   - Nome do contrato (ex: "Arrendamento Escritório SP")
   - Prazo em meses (ex: 36)
   - Data de início (ex: 2025-01-01)
   - Aluguel mensal bruto (ex: 80000)
   - Deduções de serviço (ex: 5000)
   - Taxa de desconto anual % (ex: 15)
   - Incentivo do locador (ex: 0)
   - Custos diretos iniciais (ex: 30000)
3. O plugin irá:
   - Salvar o contrato no storage
   - Calcular em background via Web Worker
   - Criar uma nova planilha "IFRS16 - [Nome do Contrato]"
   - Preencher 24 colunas com a amortização mensal

### Recalcular Contrato

1. Vá ao painel "ProLease Manager" (lado direito)
2. Encontre o contrato na lista
3. Clique em "Recalculate"
4. A planilha será atualizada com novos cálculos

### Deletar Contrato

1. Vá ao painel "ProLease Manager"
2. Encontre o contrato na lista
3. Clique no botão "🗑️" (Delete)
4. Confirme a exclusão
5. O contrato será removido do storage

## Planilha Gerada

### Formato de Saída

A planilha gerada contém **24 colunas**:

| Col | Nome | Descrição |
|-----|------|-----------|
| 1 | Month # | Número do mês (1 a N) |
| 2 | Date | Data do mês (YYYY-MM-DD) |
| 3 | A) Sum of All Costs | Aluguel bruto mensal |
| 4 | B) Monthly Service Deductions | Deduções de serviço |
| 5 | C) Landlord TI Allowance | TI Allowance (após início) |
| 6 | D) Total Rent Capitalized | A + B + C |
| 7 | Remaining Present Value | VP dos pagamentos restantes |
| 8 | E) Interest | Juros do período |
| 9 | End of Month Lease Liability | Passivo no fim do mês |
| 10 | Current ST Liability | Passivo curto prazo |
| 11 | Non Current LT Liability | Passivo longo prazo |
| 12 | Proof Column (ST+LT) | Prova (ST + LT) |
| 13 | F) New Initial Landlord Allowance | Allowance inicial |
| 14 | I) Allowance Amortization | Amortização da allowance |
| 15 | J) Allowance Closing Balance | Saldo final da allowance |
| 16 | K) New IDC | Custos diretos iniciais |
| 17 | N) IDC Amortization | Amortização do IDC |
| 18 | O) IDC Closing Balance | Saldo final do IDC |
| 19 | S) Opening ROU Asset | ROU asset abertura |
| 20 | U) ROU Asset Amortization | Amortização do ROU |
| 21 | V) ROU Asset Closing Balance | Saldo final do ROU |
| 22 | Total ROU Closing Balance | Total ROU (J+O+V) |
| 23 | W) Total P&L Non-Financial | Despesa não-financeira |
| 24 | P&L - Reported Lease Expense | Total despesa (E+W) |

### Formato de Células

- **Headers**: Bold, centered, tipo 'string'
- **Datas**: Tipo 'date' (coluna 2)
- **Números**: Tipo 'number' (todas as outras colunas)

## Arquitetura Técnica

### Plugin Class

```typescript
export class ProLeasePlugin implements Plugin {
  manifest: PluginManifest;

  async init(context: PluginContext): Promise<void>;
  async dispose(): Promise<void>;
}
```

### Context APIs Utilizadas

```typescript
// Persistência
await context.storage.set('contracts', contracts);
const contracts = await context.storage.get('contracts');

// UI
context.ui.addToolbarButton({ ... });
context.ui.addPanel({ ... });
context.ui.showToast('Message', 'success');

// Workbook
const wb = context.kernel.workbookManager.getActiveWorkbook();
const sheet = wb.addSheet('IFRS16 - Contract');
sheet.setCell(row, col, value, { type, format });

// Fórmulas
const registry = context.kernel.calcEngine.getRegistry();
registry.register('LEASE_PV', impl, options);

// Eventos
context.kernel.kernel.recalculate(sheetId, undefined, { force: true });
```

### Web Worker

O plugin cria um Web Worker inline para cálculos pesados:

```typescript
private createCalculationWorker(): Worker {
  const code = `/* IFRS 16 calculation logic */`;
  const blob = new Blob([code], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  return new Worker(url);
}
```

**Vantagens**:
- Cálculos não bloqueiam a UI
- Suporta contratos com 100+ meses
- Comunicação via postMessage

## Dependências

### Produção

```json
{
  "nanoid": "^5.x",      // ID generation
  "idb": "^8.x",          // IndexedDB wrapper
  "papaparse": "^5.x",    // CSV parsing (future)
  "xlsx": "^0.18.x"       // Excel export (future)
}
```

### Desenvolvimento

```json
{
  "@types/papaparse": "^5.x"
}
```

## Build e Deploy

### Build Local

```bash
npm install
npm run build
```

**Output**: `dist/assets/index-*.js` (~566 KB)

### Desenvolvimento

```bash
npm run dev
```

Acesse: http://localhost:5173

### Verificar Plugin

1. Abra o console do navegador
2. Procure por: `[ProLeasePlugin] Initializing v6.0.0...`
3. Verifique: `[ProLeasePlugin] Ready with N saved contracts`
4. Confirme: Toast "ProLease IFRS 16 loaded!"

## Troubleshooting

### Plugin não carrega

**Sintoma**: Botão "New Lease" não aparece na toolbar

**Solução**:
1. Abra o console
2. Procure por erros: `[ProLeasePlugin]`
3. Verifique se o plugin foi importado em `src/app.ts`
4. Confirme que o build foi bem-sucedido

### Contratos não são salvos

**Sintoma**: Após refresh, contratos desaparecem

**Solução**:
1. Verifique permissões do IndexedDB no navegador
2. Limpe o storage: DevTools → Application → IndexedDB → DJDataForge_v6
3. Recrie os contratos

### Cálculos incorretos

**Sintoma**: Valores não batem com expectativa

**Solução**:
1. Verifique a taxa de desconto (deve ser anual %)
2. Confirme que serviceDeductions < totalRent
3. Verifique a data de início (formato YYYY-MM-DD)
4. Recalcule o contrato

### Planilha não é criada

**Sintoma**: Worker roda mas planilha não aparece

**Solução**:
1. Verifique o console para erros de TypeScript
2. Confirme que há um workbook ativo
3. Tente criar manualmente: File → New Workbook
4. Recalcule o contrato

## Roadmap (Futuras Melhorias)

### v6.1.0
- [ ] Modal form em vez de prompts
- [ ] Edição de contratos existentes
- [ ] Export para Excel (usar biblioteca xlsx)
- [ ] Import de contratos via CSV

### v6.2.0
- [ ] Gráficos de amortização
- [ ] Dashboard com resumo de todos os contratos
- [ ] Multi-currency support
- [ ] Comparação side-by-side de cenários

### v6.3.0
- [ ] Suporte a modificações contratuais
- [ ] Reavaliação de taxa de desconto
- [ ] Extensões e renovações
- [ ] Rescisões antecipadas

## Documentação Técnica

### Arquivos de Referência

- `ARCHITECTURE_ANALYSIS.md` - Análise completa da arquitetura v6
- `PROLEASE_IMPLEMENTATION_GUIDE.md` - Guia de implementação
- `EXPLORATION_SUMMARY.md` - Resumo executivo
- `ARCHITECTURE_DOCUMENTATION_INDEX.md` - Índice de navegação

### Código Fonte

- `src/plugins/prolease-ifrs16-plugin.ts` - Implementação completa (800+ linhas)
- `src/app.ts` - Integração com o app principal
- `src/@core/plugin-system-consolidated.ts` - Plugin system base

## Licença

Desenvolvido por DJCalc / Código
Portado para DataForge v6 em 2025-10-23

## Suporte

Para questões sobre:
- **Norma IFRS 16**: Consulte a documentação oficial do IASB
- **Plugin**: Abra uma issue no repositório do DataForge
- **Bugs**: Inclua logs do console e passos para reproduzir
