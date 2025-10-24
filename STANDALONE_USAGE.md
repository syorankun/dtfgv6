# ProLease Plugin - Uso no HTML Standalone

## ⚠️ Problema Identificado

O plugin compilado (`prolease-ifrs16-plugin.js` e `prolease-ifrs16-plugin.iife.js`) **NÃO funciona** no HTML standalone porque:

1. ❌ Usa imports ES6 de módulos `@core/...`
2. ❌ Esses módulos estão inline no HTML, não como arquivos separados
3. ❌ O browser não consegue resolver os imports

**Erro gerado**: `TypeError: h is not a constructor`

## ✅ Solução: Versão Standalone

Foi criada uma versão **especial para HTML standalone**:

```
dist-plugin/prolease-ifrs16-plugin-standalone.js
```

### Características desta versão:

✅ **Sem imports ES6** - Usa apenas `window` globals
✅ **Auto-registro** - Se registra automaticamente quando carregado
✅ **Espera o DataForge** - Aguarda o kernel estar pronto
✅ **Funciona inline** - Compatível com HTML standalone
✅ **Sem dependências externas** - Código completamente standalone

## 📝 Como Usar no HTML Standalone

### Método 1: Copiar e Colar no HTML

Copie o conteúdo de `prolease-ifrs16-plugin-standalone.js` e cole **ANTES** do fechamento da tag `</body>` no seu HTML:

```html
<!DOCTYPE html>
<html>
<head>
  <!-- ... seu DataForge inline ... -->
</head>
<body>
  <div id="app"></div>

  <script>
    // ... todo o código inline do DataForge v6 ...
  </script>

  <!-- ADICIONE O PLUGIN AQUI -->
  <script>
    // Cole aqui o conteúdo completo de prolease-ifrs16-plugin-standalone.js
  </script>

</body>
</html>
```

### Método 2: Carregar via Script Tag (se permitido)

Se o HTML standalone permitir carregar scripts externos:

```html
<script src="dist-plugin/prolease-ifrs16-plugin-standalone.js"></script>
```

### Método 3: Via Input File no DataForge

1. No DataForge, use o botão "Load Plugin"
2. Selecione o arquivo `prolease-ifrs16-plugin-standalone.js`
3. O plugin será carregado dinamicamente

## 🔍 Verificar se Funcionou

Abra o console do navegador e procure por:

```
✅ Sucesso:
[ProLeasePlugin] Initializing v6.0.0-standalone...
[ProLeasePlugin] Loaded N contracts
[ProLeasePlugin] Calculation worker created
[ProLeasePlugin] UI elements registered
[ProLeasePlugin] Ready with N saved contracts
[ProLeasePlugin] Registered successfully

✅ Toast notification:
"ProLease IFRS 16 loaded! N contract(s)"

✅ UI:
- Botão "New Lease" (📋) na toolbar
- Painel "ProLease Manager" no lado direito
```

## 🛠️ Diferenças entre Versões

| Recurso | Standalone | ES Module / IIFE |
|---------|------------|------------------|
| Importa módulos `@core` | ❌ Não | ✅ Sim (via import/require) |
| Funciona no HTML inline | ✅ Sim | ❌ Não |
| Usa window globals | ✅ Sim | ❌ Não |
| Auto-registro | ✅ Sim | ❌ Não |
| Tamanho | ~30 KB | 17-22 KB |
| Minificado | ❌ Não | ✅ Sim |

## 📋 Código de Exemplo Completo

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>DataForge v6 + ProLease</title>
  <style>
    /* ... estilos do DataForge ... */
  </style>
</head>
<body>
  <div id="app"></div>

  <script>
    // ==========================================
    // DataForge v6 (código inline completo)
    // ==========================================
    (function() {
      'use strict';

      // ... todo o código do DataForge inline ...

      // Kernel, Workbook, CalcEngine, etc.
      window.DJDataForgeKernel = /* ... */;

      // Inicializar app
      const app = new DJDataForgeApp();
      app.init();
    })();
  </script>

  <script>
    // ==========================================
    // ProLease Plugin (código standalone)
    // ==========================================
    (function(window) {
      'use strict';

      // ... conteúdo completo de prolease-ifrs16-plugin-standalone.js ...

    })(window);
  </script>

  <script>
    // ==========================================
    // Verificação (opcional)
    // ==========================================
    window.addEventListener('load', () => {
      setTimeout(() => {
        const plugins = window.DJDataForgeKernel?.pluginHost?.plugins || [];
        const prolease = plugins.find(p => p.manifest?.id === 'dj.ifrs16.prolease');

        if (prolease) {
          console.log('✅ ProLease plugin está ativo!');
          console.log('Versão:', prolease.manifest.version);
        } else {
          console.log('❌ ProLease plugin não foi carregado');
        }
      }, 2000);
    });
  </script>

</body>
</html>
```

## 🐛 Troubleshooting

### Plugin não aparece na UI

**Problema**: Botão "New Lease" não está na toolbar

**Verificações**:
1. Abra o console e procure por erros
2. Verifique se o script standalone foi carregado
3. Confirme que `window.ProLeasePluginStandalone` existe:
   ```javascript
   console.log(window.ProLeasePluginStandalone);
   ```

**Solução**: Certifique-se de que o script standalone está **DEPOIS** do código do DataForge.

### Erro "DJDataForgeKernel is not defined"

**Problema**: Plugin tentou carregar antes do DataForge

**Solução**: O plugin standalone tem lógica de espera automática, mas certifique-se de que:
1. O DataForge está carregado primeiro
2. O script standalone está após o DataForge
3. Não há erros no carregamento do DataForge

### Contratos não são salvos

**Problema**: Após refresh, contratos desaparecem

**Verificações**:
1. IndexedDB está habilitado no navegador?
2. Não está em modo privado/anônimo?
3. Console mostra `[ProLeasePlugin] Saved N contracts`?

**Solução**:
```javascript
// Verificar IndexedDB
window.indexedDB.databases().then(dbs => {
  console.log('Databases:', dbs);
});
```

## 🎯 Resumo Rápido

**Para usar no HTML standalone:**

1. ✅ Use: `prolease-ifrs16-plugin-standalone.js`
2. ❌ NÃO use: `prolease-ifrs16-plugin.js` ou `.iife.js`
3. 📋 Cole o código **DEPOIS** do DataForge
4. 🔍 Verifique o console para confirmação

## 📦 Arquivos Disponíveis

```
dist-plugin/
├── prolease-ifrs16-plugin.js              ← ES Module (NÃO funciona inline)
├── prolease-ifrs16-plugin.iife.js         ← IIFE (NÃO funciona inline)
├── prolease-ifrs16-plugin-standalone.js   ← ✅ Use este para HTML standalone
├── example-usage.html                     ← Exemplo
└── README.md                              ← Documentação
```

## ✨ Próximos Passos

Após carregar o plugin:

1. **Criar contrato**: Clique em "New Lease" (📋)
2. **Ver contratos salvos**: Painel "ProLease Manager"
3. **Recalcular**: Botão "Recalculate" em cada contrato
4. **Deletar**: Botão "🗑️" em cada contrato

A planilha será criada automaticamente com **24 colunas** de análise IFRS 16!

---

**Desenvolvido por**: DJCalc / Código
**Versão Standalone**: 6.0.0-standalone
**Data**: 2025-10-24
