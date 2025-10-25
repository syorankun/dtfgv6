/**
 * DJ DataForge v6 - Plugin Example
 *
 * Este é um exemplo de como criar um plugin personalizado para o DataForge.
 * Você pode instalar este plugin através do menu Configurações > Plugins.
 *
 * FORMAS DE INSTALAÇÃO:
 * 1. URL: Hospede este arquivo em um servidor e use a URL
 * 2. Arquivo: Faça upload deste arquivo .js
 * 3. Código: Copie e cole o código abaixo
 *
 * ESTRUTURA BÁSICA:
 * - Seu plugin deve ser uma classe com uma propriedade `manifest`
 * - Deve implementar o método `init(context)`
 * - Opcionalmente pode implementar `dispose()` para cleanup
 */

class ExamplePlugin {
  // Manifest é obrigatório - define as informações do plugin
  manifest = {
    id: 'example-plugin',
    name: 'Plugin de Exemplo',
    version: '1.0.0',
    author: 'Seu Nome',
    description: 'Um plugin de exemplo que demonstra as capacidades do sistema',
    permissions: [
      'read:workbook',    // Ler dados do workbook
      'write:workbook',   // Escrever dados no workbook
      'ui:toolbar',       // Adicionar botões na toolbar
      'ui:panel',         // Adicionar painéis laterais
      'ui:menu'           // Adicionar itens de menu
    ],
    entryPoint: 'example-plugin.js'
  };

  /**
   * Método init - chamado quando o plugin é carregado
   * @param {PluginContext} context - Contexto do plugin com acesso ao kernel, storage, UI, etc.
   */
  async init(context) {
    console.log('[ExamplePlugin] Inicializando...', context);

    // 1. Adicionar botão na toolbar (aba "Inserir")
    context.ui.addToolbarButton({
      id: 'example-btn',
      label: 'Exemplo',
      icon: '🔧',
      tooltip: 'Executar ação de exemplo',
      onClick: () => {
        this.executeExample(context);
      }
    });

    // 2. Adicionar painel lateral
    context.ui.addPanel({
      id: 'example-panel',
      title: '🔧 Plugin de Exemplo',
      render: (container) => {
        container.innerHTML = `
          <div style="padding: 12px;">
            <p style="margin-bottom: 8px;">Este é um painel de exemplo!</p>
            <button id="example-panel-btn" style="width: 100%; padding: 8px; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer;">
              Clique aqui
            </button>
          </div>
        `;

        // Adicionar event listener ao botão
        const btn = container.querySelector('#example-panel-btn');
        if (btn) {
          btn.addEventListener('click', () => {
            context.ui.showToast('Botão do painel clicado!', 'success');
          });
        }
      }
    });

    // 3. Adicionar item de menu (aba "Fórmulas")
    context.ui.addMenuItem({
      id: 'example-menu',
      label: 'Exemplo',
      icon: '⚡',
      tooltip: 'Função de exemplo',
      onClick: () => {
        this.insertExampleFormula(context);
      }
    });

    // 4. Escutar eventos do sistema
    context.events.on('workbook:created', (data) => {
      console.log('[ExamplePlugin] Novo workbook criado:', data);
      context.ui.showToast(`Workbook "${data.name}" criado!`, 'info');
    });

    // 5. Usar storage persistente
    const savedData = await context.storage.get('example-data');
    if (!savedData) {
      await context.storage.set('example-data', {
        installDate: new Date().toISOString(),
        usageCount: 0
      });
    }

    console.log('[ExamplePlugin] Inicializado com sucesso!');
  }

  /**
   * Executar ação de exemplo
   */
  executeExample(context) {
    // Acessar o kernel (core do sistema)
    const kernel = context.kernel;

    // Obter workbook ativo
    const wb = kernel.workbookManager.getActiveWorkbook();
    if (!wb) {
      context.ui.showToast('Nenhum workbook ativo', 'error');
      return;
    }

    // Obter sheet ativo
    const sheet = wb.getActiveSheet();
    if (!sheet) {
      context.ui.showToast('Nenhuma sheet ativa', 'error');
      return;
    }

    // Adicionar dados de exemplo
    const data = [
      ['Produto', 'Quantidade', 'Preço'],
      ['Item A', 10, 25.50],
      ['Item B', 5, 12.75],
      ['Item C', 8, 45.00]
    ];

    data.forEach((row, rowIdx) => {
      row.forEach((value, colIdx) => {
        sheet.setCell(rowIdx, colIdx, value);
      });
    });

    // Adicionar fórmula de total
    sheet.setCell(4, 1, 0, { formula: '=SOMA(B2:B4)' });
    sheet.setCell(4, 2, 0, { formula: '=SOMA(C2:C4)' });

    // Recalcular
    kernel.recalculate(sheet.id);

    // Atualizar contador de uso
    context.storage.get('example-data').then(data => {
      if (data) {
        data.usageCount = (data.usageCount || 0) + 1;
        context.storage.set('example-data', data);
      }
    });

    context.ui.showToast('Dados de exemplo adicionados!', 'success');
  }

  /**
   * Inserir fórmula de exemplo
   */
  insertExampleFormula(context) {
    const formulas = [
      '=SOMA(A1:A10)',
      '=MÉDIA(B1:B10)',
      '=SE(C1>100, "Alto", "Baixo")',
      '=CONCATENAR(A1, " ", B1)'
    ];

    const formula = formulas[Math.floor(Math.random() * formulas.length)];

    alert(`Exemplo de fórmula:\n\n${formula}\n\nDigite na célula ou use a barra de fórmulas!`);
  }

  /**
   * Método dispose - chamado quando o plugin é desinstalado (opcional)
   */
  async dispose() {
    console.log('[ExamplePlugin] Desinstalando...');

    // Cleanup se necessário
    // Por exemplo, remover event listeners, limpar storage, etc.
  }
}

// IMPORTANTE: A classe deve estar disponível globalmente
// Se você estiver usando este código inline, a classe já estará disponível
// Se estiver carregando de um arquivo, certifique-se de que a classe é exportada
