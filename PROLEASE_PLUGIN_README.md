# ProLease IFRS 16 Plugin - DataForge v6

Plugin modularizado para cálculo de contratos de arrendamento segundo norma IFRS 16.

## Versão

**v6.0.0** - Módulo ES6 nativo para DataForge v6

## Características

- ✅ **ES6 Module**: Importação nativa via `import/export`
- ✅ **Web Worker**: Cálculos pesados em background
- ✅ **Persistência**: Contratos salvos em IndexedDB
- ✅ **Menus Dinâmicos**: Interface integrada ao DataForge
- ✅ **IFRS 16 Completo**: Todos os cálculos conforme norma

## Como Usar

### Opção 1: Importação no HTML

Se o DataForge v6 carregar plugins via tag `<script type="module">`:

```html
<script type="module">
  import { manifest } from './prolease-ifrs16-plugin.js';

  // Registrar o plugin quando o kernel estiver pronto
  window.DJDataForge.registerPlugin(manifest);
</script>
```

### Opção 2: Importação Programática

```javascript
// No código do DataForge v6
const pluginModule = await import('./prolease-ifrs16-plugin.js');
await window.DJDataForge.registerPlugin(pluginModule.manifest);
```

### Opção 3: Via UI do DataForge

Se o DataForge v6 possui interface para carregar plugins:

1. Acesse o menu de plugins
2. Selecione "Carregar Plugin"
3. Escolha o arquivo `prolease-ifrs16-plugin.js`
4. O plugin será registrado automaticamente

## Funcionalidades

### Criar Novo Contrato

1. Menu: **ProLease → Novo Contrato de Arrendamento (IFRS 16)**
2. Preencha os dados:
   - Nome do Contrato
   - Prazo (meses)
   - Data de Início
   - Aluguel Bruto Mensal
   - Deduções de Serviço
   - Taxa de Desconto Anual (%)
   - Incentivo do Locador
   - Custos Diretos Iniciais

3. O plugin criará uma nova planilha com:
   - Cronograma de amortização mensal
   - Cálculo de passivo de arrendamento
   - Ativo de direito de uso (ROU)
   - Análise de curto/longo prazo
   - Impacto no P&L

### Recalcular Contratos Salvos

Contratos salvos aparecem automaticamente no menu:
- **ProLease - Contratos Salvos → Recalcular: [Nome do Contrato]**

## Estrutura de Dados

### Entrada (Contract Data)

```javascript
{
  contractName: "Contrato Exemplo 1",
  termMonths: 36,
  startDate: "2025-10-23",
  totalRent: 80000,
  serviceDeductions: 5000,
  discountRate: 15,
  initialLandlordAllowance: 0,
  initialDirectCosts: 30000
}
```

### Saída (Planilha IFRS 16)

24 colunas incluindo:
- Month # e Date
- Custos e deduções
- Passivo de arrendamento
- Classificação ST/LT
- Allowance e IDC
- ROU Asset
- Despesas P&L

## Arquitetura Técnica

### Classes Principais

1. **ProLeasePlugin**: Classe principal do plugin
2. **Persistence**: Gerenciamento IndexedDB
3. **Compat**: Helpers de compatibilidade v6
4. **createCalcWorker()**: Factory para Web Worker

### Exports

```javascript
export class ProLeasePlugin { ... }
export const manifest = { ... }
export default manifest;
```

### Context Interface

O plugin espera receber um objeto `context` com:

```javascript
{
  kernel: DJDataForgeKernel,  // Kernel do DataForge
  ui: UIManager,               // Gerenciador de UI
  log: Function,               // Função de log
  error: Function              // Função de erro
}
```

## Compatibilidade

- **Requer**: DataForge Kernel >= v6.0.0
- **Browser**: Navegadores com suporte a ES6 Modules e Web Workers
- **IndexedDB**: Necessário para persistência de contratos

## Migração da v5.0.1

Principais mudanças:

- ❌ Removido: IIFE auto-registrante
- ❌ Removido: Bootstrap com polling
- ✅ Adicionado: Export ES6 modules
- ✅ Adicionado: Manifest padronizado
- ✅ Mantido: Toda lógica IFRS 16 intacta

## Desenvolvimento

### Modificar Cálculos

Os cálculos IFRS 16 estão no Web Worker inline.
Edite a função `generate(d)` dentro de `createCalcWorker()`.

### Adicionar Campos

1. Modifique `_promptForContractData()` para novos inputs
2. Atualize `getHeaders()` no worker para novas colunas
3. Ajuste `generate(d)` para novos cálculos

### Debug

```javascript
// Habilitar logs detalhados
context.log('Mensagem de debug');
context.error('Mensagem de erro');
```

## Licença

Desenvolvido por DJCalc / Código
Portado para ES6 modules em 2025-10-23

## Suporte

Para questões sobre IFRS 16 ou uso do plugin, consulte a documentação oficial da norma ou entre em contato com o desenvolvedor.
