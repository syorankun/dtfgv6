# ProLease IFRS 16 Plugin - Standalone Build

Plugin compilado individualmente para cálculos de arrendamento IFRS 16, pronto para carregamento dinâmico.

## 📦 Arquivos Compilados

```
dist-plugin/
├── prolease-ifrs16-plugin.js          (ES Module - 22 KB, gzip: 6 KB)
├── prolease-ifrs16-plugin.js.map      (Source map para debug)
├── prolease-ifrs16-plugin.iife.js     (IIFE/UMD - 17 KB, gzip: 5.3 KB)
├── prolease-ifrs16-plugin.iife.js.map (Source map para debug)
├── example-usage.html                 (Exemplo de uso)
└── README.md                          (Este arquivo)
```

## 🚀 Como Usar

### Opção 1: ES Module (Recomendado)

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>DataForge + ProLease</title>
</head>
<body>
  <!-- DataForge deve estar carregado primeiro -->
  <script type="module">
    // Importar o plugin compilado
    import { ProLeasePlugin, manifest } from './dist-plugin/prolease-ifrs16-plugin.js';

    // Assumindo que DJDataForgeKernel está disponível globalmente
    const kernel = window.DJDataForgeKernel;

    // Registrar o plugin
    await kernel.pluginHost.loadPlugin(
      { default: ProLeasePlugin },
      manifest
    );

    console.log('✅ ProLease plugin carregado!');
  </script>
</body>
</html>
```

### Opção 2: IIFE (Script Tradicional)

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>DataForge + ProLease</title>
</head>
<body>
  <!-- DataForge deve estar carregado primeiro -->
  <script src="./dataforge-v6.js"></script>

  <!-- Carregar plugin compilado -->
  <script src="./dist-plugin/prolease-ifrs16-plugin.iife.js"></script>

  <script>
    // Acessar via objeto global
    const { ProLeasePlugin, manifest } = window.ProLeasePlugin;

    // Registrar o plugin
    window.DJDataForgeKernel.pluginHost.loadPlugin(
      { default: ProLeasePlugin },
      manifest
    ).then(() => {
      console.log('✅ ProLease plugin carregado!');
    });
  </script>
</body>
</html>
```

### Opção 3: Importação Dinâmica

```javascript
// Carregar o plugin sob demanda
async function loadProLeasePlugin() {
  try {
    const module = await import('./dist-plugin/prolease-ifrs16-plugin.js');

    await window.DJDataForgeKernel.pluginHost.loadPlugin(
      { default: module.ProLeasePlugin },
      module.manifest
    );

    console.log('✅ ProLease carregado dinamicamente!');
  } catch (error) {
    console.error('❌ Erro ao carregar ProLease:', error);
  }
}

// Chamar quando necessário
document.getElementById('load-plugin-btn').addEventListener('click', loadProLeasePlugin);
```

## ⚙️ Requisitos

### DataForge v6 deve estar carregado

O plugin **depende** dos seguintes módulos do DataForge v6:

- `@core/types` - Interfaces TypeScript
- `@core/plugin-system-consolidated` - Sistema de plugins base
- `@core/workbook-consolidated` - Gerenciador de workbooks e sheets
- `@core/storage-utils-consolidated` - Persistência (IndexedDB) e logging

Esses módulos **não estão incluídos** no build standalone e devem ser fornecidos pelo DataForge.

### Navegadores Suportados

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

(Basicamente, qualquer navegador moderno com suporte a ES2020)

## 📋 Manifest do Plugin

```json
{
  "id": "dj.ifrs16.prolease",
  "name": "ProLease IFRS 16",
  "version": "6.0.0",
  "author": "DJCalc / Código",
  "description": "IFRS 16 lease accounting calculator with comprehensive amortization schedules",
  "permissions": [
    "read:workbook",
    "write:workbook",
    "ui:toolbar",
    "ui:panel",
    "formula:register",
    "read:storage",
    "write:storage"
  ],
  "entryPoint": "prolease-ifrs16-plugin.ts"
}
```

## 🔧 API do Plugin

### Classe Principal

```typescript
class ProLeasePlugin implements Plugin {
  manifest: PluginManifest;

  // Inicializa o plugin com o contexto do DataForge
  async init(context: PluginContext): Promise<void>;

  // Limpa recursos quando o plugin é descarregado
  async dispose(): Promise<void>;
}
```

### Context API

Quando o plugin é inicializado, ele recebe um `PluginContext` com:

```typescript
interface PluginContext {
  pluginId: string;
  manifest: PluginManifest;
  kernel: KernelContext;        // Acesso ao kernel do DataForge
  storage: PluginStorageAPI;    // Persistência isolada
  ui: PluginUIAPI;              // APIs de UI (toolbar, panels, toasts)
  events: PluginEventAPI;       // Sistema de eventos
}
```

### Exports Disponíveis

```javascript
import {
  ProLeasePlugin,  // Classe principal do plugin
  manifest         // Manifest com metadados
} from './prolease-ifrs16-plugin.js';

// Também disponível como default export (somente no IIFE)
const module = window.ProLeasePlugin;
module.ProLeasePlugin;
module.manifest;
module.version;    // '6.0.0'
module.name;       // 'ProLease IFRS 16'
```

## 🛠️ Build do Plugin

### Compilar a partir do Código Fonte

```bash
# Clonar o repositório (se aplicável)
git clone <repo-url>
cd dtfgv6

# Instalar dependências
npm install

# Compilar apenas o plugin
npm run build:plugin

# Arquivos gerados em: dist-plugin/
```

### Configuração do Build

O build é configurado em `vite.config.plugin.ts`:

- **Entry**: `src/plugins/index.ts`
- **Formats**: ES Module + IIFE
- **Minification**: Terser
- **Source Maps**: Sim
- **Externals**: Módulos @core do DataForge

## 📊 Funcionalidades IFRS 16

### Cálculos Inclusos

O plugin implementa cálculos completos de IFRS 16:

1. **Passivo de Arrendamento**
   - Valor presente dos pagamentos futuros
   - Taxa de desconto mensal (convertida de anual)
   - Amortização com juros compostos

2. **Ativo de Direito de Uso (ROU)**
   - Opening balance = Liability + IDC - Allowance
   - Amortização linear mensal
   - Tracking de closing balance

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

Quando carregado no DataForge:

- **Toolbar Button**: "New Lease" (📋)
- **Side Panel**: "ProLease Manager" com lista de contratos
- **Toast Notifications**: Feedback de ações
- **Prompts**: Entrada de dados do contrato

### Planilha Gerada

O plugin gera uma planilha com **24 colunas**:

1. Month #
2. Date
3. A) Sum of All Costs
4. B) Monthly Service Deductions
5. C) Landlord TI Allowance after Commence Date
6. D) Total Rent to be Capitalized (A + B + C)
7. Remaining Present Value
8. E) Interest
9. End of Month Lease Liability
10. Current Short Term (ST) Liability
11. Non Current Long Term (LT) Liability
12. Proof Column (ST+LT)
13. F) New Initial Landlord Allowance
14. I) Allowance Amortization
15. J) Allowance Closing Balance
16. K) New IDC
17. N) IDC Amortization
18. O) IDC Closing Balance
19. S) Opening ROU Asset
20. U) ROU Asset Amortization
21. V) ROU Asset Closing Balance
22. Total ROU Asset Closing Balance (J+O+V)
23. W) Total P&L Non-Financial Expense
24. P&L - Reported Lease Expense (E+W)

### Fórmulas Registradas

O plugin registra 3 fórmulas customizadas no CalcEngine:

```typescript
=LEASE_PV(monthlyRate, months, payment)
  // Calcula valor presente dos pagamentos

=LEASE_MONTHLY_RATE(annualRate)
  // Converte taxa anual para mensal

=LEASE_ROU_OPENING(leaseLiability, directCosts, allowance)
  // Calcula opening balance do ROU asset
```

## 🐛 Debugging

### Source Maps

Os arquivos `.map` permitem debugging do código TypeScript original:

```javascript
// No browser DevTools, você verá o código original TypeScript
// em vez do JavaScript compilado
```

### Console Logs

O plugin mantém logs no console:

```
[ProLeasePlugin] Initializing v6.0.0...
[ProLeasePlugin] Loaded N contracts
[ProLeasePlugin] Calculation worker created
[ProLeasePlugin] Ready with N saved contracts
```

### Verificar Carregamento

```javascript
// Verificar se o plugin foi registrado
const plugins = window.DJDataForgeKernel.pluginHost.getLoadedPlugins();
const prolease = plugins.find(p => p.id === 'dj.ifrs16.prolease');

if (prolease) {
  console.log('✅ ProLease está carregado');
  console.log('Version:', prolease.version);
} else {
  console.log('❌ ProLease não foi carregado');
}
```

## 📝 Exemplo Completo

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>DataForge com ProLease Plugin</title>
</head>
<body>
  <div id="app"></div>

  <!-- DataForge principal -->
  <script type="module">
    // Importar DataForge (ajuste o caminho conforme necessário)
    import { DJDataForgeApp } from './dataforge-app.js';

    // Importar ProLease plugin
    import { ProLeasePlugin, manifest } from './dist-plugin/prolease-ifrs16-plugin.js';

    // Inicializar DataForge
    const app = new DJDataForgeApp();
    await app.init();

    // Registrar ProLease plugin
    await window.DJDataForgeKernel.pluginHost.loadPlugin(
      { default: ProLeasePlugin },
      manifest
    );

    console.log('✅ DataForge com ProLease pronto!');
  </script>
</body>
</html>
```

## 🔗 Links Úteis

- **Documentação Completa**: Ver `PROLEASE_V6_README.md` no repositório
- **Exemplo de Uso**: Abrir `example-usage.html` no navegador
- **Código Fonte**: `src/plugins/prolease-ifrs16-plugin.ts`

## 🆘 Troubleshooting

### Plugin não carrega

**Erro**: `Cannot find module '@core/...'`

**Solução**: Certifique-se de que o DataForge v6 está carregado antes do plugin.

### Worker não funciona

**Erro**: `Worker creation failed`

**Solução**: Verifique as configurações de CSP (Content Security Policy) do site.

### Persistência não funciona

**Erro**: `IndexedDB not available`

**Solução**: Verifique se o navegador suporta IndexedDB e se não está em modo privado.

## 📄 Licença

Desenvolvido por DJCalc / Código
Compilado em: 2025-10-24

---

**Versão**: 6.0.0
**Build**: ES2020
**Target**: Navegadores modernos
**Dependencies**: DataForge v6.0.0+
