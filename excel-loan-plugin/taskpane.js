/**
 * TaskPane JavaScript - Interface do Loan Manager para Excel
 */

Office.onReady((info) => {
  if (info.host === Office.HostType.Excel) {
    console.log('Loan Manager Add-in carregado com sucesso!');

    // Carrega contratos quando o add-in inicia
    loadContracts();

    // Define data padrão para hoje
    document.getElementById('startDate').valueAsDate = new Date();

    // Define data de vencimento padrão para 12 meses
    const maturityDate = new Date();
    maturityDate.setMonth(maturityDate.getMonth() + 12);
    document.getElementById('maturityDate').valueAsDate = maturityDate;
  }
});

/**
 * Mostra o formulário de criação de contrato
 */
function showContractForm() {
  document.getElementById('contractsList').classList.add('hidden');
  document.getElementById('contractForm').classList.remove('hidden');
  hideMessage();
}

/**
 * Esconde o formulário de criação de contrato
 */
function hideContractForm() {
  document.getElementById('contractForm').classList.add('hidden');
  document.getElementById('contractsList').classList.remove('hidden');
}

/**
 * Cria um novo contrato
 */
async function createContract() {
  try {
    hideMessage();

    // Validação básica
    const counterparty = document.getElementById('counterparty').value.trim();
    const principal = parseFloat(document.getElementById('principal').value);
    const startDate = document.getElementById('startDate').value;
    const maturityDate = document.getElementById('maturityDate').value;
    const interestRate = parseFloat(document.getElementById('interestRate').value);
    const installments = parseInt(document.getElementById('installments').value);

    if (!counterparty || !principal || !startDate || !maturityDate || !interestRate || !installments) {
      showMessage('Por favor, preencha todos os campos obrigatórios.', 'error');
      return;
    }

    if (principal <= 0) {
      showMessage('O valor principal deve ser maior que zero.', 'error');
      return;
    }

    if (new Date(startDate) >= new Date(maturityDate)) {
      showMessage('A data de vencimento deve ser posterior à data de início.', 'error');
      return;
    }

    if (installments <= 0) {
      showMessage('O número de parcelas deve ser maior que zero.', 'error');
      return;
    }

    // Dados do contrato
    const contractData = {
      contractType: document.getElementById('contractType').value,
      counterparty,
      currency: document.getElementById('currency').value,
      principalOrigin: principal,
      principalBRL: principal, // Simplificado: assumir BRL ou usar taxa FX
      contractFXRate: 1,
      startDate,
      maturityDate,
      interestRate,
      dayCountBasis: 'ACT/365',
      compounding: 'EXPONENCIAL',
      paymentSystem: document.getElementById('paymentSystem').value,
      periodicity: document.getElementById('periodicity').value,
      installments
    };

    // Cria contrato
    showLoading('Criando contrato...');
    const contract = await loanManager.createContract(contractData);

    showMessage(
      `✓ Contrato ${contract.id} criado com sucesso!<br>` +
      `Contraparte: ${contract.counterparty}<br>` +
      `Principal: ${contract.currency} ${contract.principalOrigin.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      'success'
    );

    // Limpa formulário
    document.getElementById('counterparty').value = '';
    document.getElementById('principal').value = '';

    // Volta para lista
    hideContractForm();
    await loadContracts();

  } catch (error) {
    console.error('Erro ao criar contrato:', error);
    showMessage(`Erro ao criar contrato: ${error.message}`, 'error');
  }
}

/**
 * Carrega lista de contratos
 */
async function loadContracts() {
  try {
    const container = document.getElementById('contractsContainer');
    container.innerHTML = '<p class="loading"><div class="spinner"></div>Carregando contratos...</p>';

    // Carrega contratos da planilha
    await loanManager.loadContractsFromSheet();

    const contracts = loanManager.listContracts();

    if (contracts.length === 0) {
      container.innerHTML = '<p style="text-align: center; color: #7f8c8d; padding: 20px;">Nenhum contrato cadastrado ainda.</p>';
      return;
    }

    // Renderiza lista de contratos
    container.innerHTML = '';
    contracts.forEach(contract => {
      const item = document.createElement('div');
      item.className = 'contract-item';
      item.onclick = () => showContractActions(contract.id);

      const badgeClass = contract.status === 'ATIVO' ? 'badge-active' : 'badge-paid';

      item.innerHTML = `
        <h3>${contract.id}</h3>
        <p><strong>Contraparte:</strong> ${contract.counterparty}</p>
        <p><strong>Principal:</strong> ${contract.currency} ${contract.principalOrigin.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        <p><strong>Taxa:</strong> ${contract.interestRate}% a.a. | <strong>Sistema:</strong> ${contract.paymentSystem}</p>
        <p><strong>Saldo Atual:</strong> ${contract.currency} ${contract.currentBalance.balanceOrigin.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        <span class="badge ${badgeClass}">${contract.status}</span>
      `;

      container.appendChild(item);
    });

  } catch (error) {
    console.error('Erro ao carregar contratos:', error);
    const container = document.getElementById('contractsContainer');
    container.innerHTML = `<p class="error-box">Erro ao carregar contratos: ${error.message}</p>`;
  }
}

/**
 * Mostra ações disponíveis para um contrato
 */
function showContractActions(contractId) {
  const contract = loanManager.getContract(contractId);
  if (!contract) return;

  const actions = [
    {
      text: '📊 Gerar Cronograma',
      action: () => generateSchedule(contractId)
    },
    {
      text: '💳 Registrar Pagamento',
      action: () => showPaymentForm(contractId)
    },
    {
      text: '📄 Ver Detalhes',
      action: () => showContractDetails(contractId)
    }
  ];

  const message = `<strong>${contract.id}</strong><br>` +
    `Contraparte: ${contract.counterparty}<br>` +
    `Saldo: ${contract.currency} ${contract.currentBalance.balanceOrigin.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}<br><br>` +
    `<strong>Ações disponíveis:</strong>`;

  let html = `<div class="info-box">${message}</div>`;

  actions.forEach(act => {
    html += `<button class="btn-primary btn-full" onclick="event.stopPropagation(); ${act.action.toString()}()">${act.text}</button>`;
  });

  // Mostra em um diálogo simples (pode ser melhorado)
  if (confirm(`${contract.id}\n\nDeseja gerar o cronograma de pagamentos?`)) {
    generateSchedule(contractId);
  }
}

/**
 * Gera cronograma de pagamentos
 */
async function generateSchedule(contractId) {
  try {
    hideMessage();
    showLoading('Gerando cronograma...');

    await loanManager.generateSchedule(contractId);

    showMessage('✓ Cronograma de pagamentos gerado com sucesso!', 'success');
  } catch (error) {
    console.error('Erro ao gerar cronograma:', error);
    showMessage(`Erro ao gerar cronograma: ${error.message}`, 'error');
  }
}

/**
 * Mostra formulário de pagamento (simplificado)
 */
function showPaymentForm(contractId) {
  const amount = prompt('Valor do pagamento:');
  if (!amount || isNaN(parseFloat(amount))) return;

  const date = prompt('Data do pagamento (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
  if (!date) return;

  registerPayment(contractId, parseFloat(amount), date);
}

/**
 * Registra pagamento
 */
async function registerPayment(contractId, amount, date) {
  try {
    hideMessage();
    showLoading('Registrando pagamento...');

    await loanManager.registerPayment(contractId, {
      paymentDate: date,
      amountBRL: amount,
      description: 'Pagamento registrado via add-in'
    });

    showMessage('✓ Pagamento registrado com sucesso!', 'success');
    await loadContracts();
  } catch (error) {
    console.error('Erro ao registrar pagamento:', error);
    showMessage(`Erro ao registrar pagamento: ${error.message}`, 'error');
  }
}

/**
 * Mostra detalhes do contrato
 */
function showContractDetails(contractId) {
  const contract = loanManager.getContract(contractId);
  if (!contract) return;

  const details = `
    <strong>ID:</strong> ${contract.id}<br>
    <strong>Tipo:</strong> ${contract.contractType}<br>
    <strong>Contraparte:</strong> ${contract.counterparty}<br>
    <strong>Principal:</strong> ${contract.currency} ${contract.principalOrigin.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}<br>
    <strong>Taxa:</strong> ${contract.interestRate}% a.a.<br>
    <strong>Sistema:</strong> ${contract.paymentSystem}<br>
    <strong>Periodicidade:</strong> ${contract.periodicity}<br>
    <strong>Parcelas:</strong> ${contract.installments}<br>
    <strong>Início:</strong> ${contract.startDate}<br>
    <strong>Vencimento:</strong> ${contract.maturityDate}<br>
    <strong>Saldo Atual:</strong> ${contract.currency} ${contract.currentBalance.balanceOrigin.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}<br>
    <strong>Status:</strong> ${contract.status}
  `;

  showMessage(details, 'info');
}

/**
 * Mostra mensagem
 */
function showMessage(message, type = 'info') {
  const messageBox = document.getElementById('messageBox');
  messageBox.className = type === 'error' ? 'error-box' :
    type === 'success' ? 'success-box' : 'info-box';
  messageBox.innerHTML = message;
  messageBox.classList.remove('hidden');

  // Auto-esconder mensagens de sucesso após 5 segundos
  if (type === 'success') {
    setTimeout(() => hideMessage(), 5000);
  }
}

/**
 * Esconde mensagem
 */
function hideMessage() {
  const messageBox = document.getElementById('messageBox');
  messageBox.classList.add('hidden');
}

/**
 * Mostra loading
 */
function showLoading(message) {
  showMessage(`<div class="spinner"></div>${message}`, 'info');
}
