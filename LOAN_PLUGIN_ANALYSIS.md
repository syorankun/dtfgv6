# Análise do Loan Plugin - Problemas e Melhorias

## 🔴 PROBLEMA CRÍTICO: Contratos não salvam

### Causa Identificada:
O problema está no **saveContracts()** no arquivo `loan-plugin.ts` (linhas 409-419).

**Análise do código:**
```typescript
private async saveContracts(): Promise<void> {
  try {
    const data: Record<string, LoanContract> = {};
    this.contracts.forEach((contract, id) => {
      data[id] = contract;
    });
    await this.context.storage.set('contracts', data);
  } catch (error) {
    logger.error('[LoanPlugin] Erro ao salvar contratos:', error);
  }
}
```

**Possíveis causas:**
1. ✅ **Autosave não é chamado imediatamente** - O método `saveContracts()` só é chamado:
   - Quando o evento `kernel:autosave-done` é disparado (a cada ~10s)
   - Durante `createContract()` (linha 492) - OK
   - Durante `dispose()` (linha 1037) - OK

2. ⚠️ **Context.storage pode não estar funcionando** - Verificar se IndexedDB está funcionando corretamente

3. ⚠️ **Erros silenciosos** - O catch apenas loga o erro mas não notifica o usuário

### Solução Recomendada:

```typescript
// Adicionar salvamento explícito com feedback
private async saveContracts(): Promise<void> {
  try {
    const data: Record<string, LoanContract> = {};
    this.contracts.forEach((contract, id) => {
      data[id] = contract;
    });
    
    // Adicionar log de debug
    logger.debug(`[LoanPlugin] Salvando ${this.contracts.size} contratos`);
    
    await this.context.storage.set('contracts', data);
    
    // Verificar se salvou
    const saved = await this.context.storage.get('contracts');
    if (!saved) {
      throw new Error('Falha ao verificar salvamento');
    }
    
    logger.info(`[LoanPlugin] ${this.contracts.size} contratos salvos com sucesso`);
  } catch (error) {
    logger.error('[LoanPlugin] Erro ao salvar contratos:', error);
    // Notificar usuário
    this.context.ui.showToast('⚠️ Erro ao salvar contratos!', 'error');
    throw error; // Re-throw para não silenciar o erro
  }
}

// Modificar createContract para forçar salvamento imediato
public async createContract(data: LoanContractInput): Promise<LoanContract> {
  try {
    // ... código existente ...
    
    this.contracts.set(id, newContract);
    
    // FORÇAR salvamento imediato (não depender do autosave)
    await this.saveContracts();
    await this.savePayments();
    
    // Adicionar verificação
    const loadedContracts = await this.context.storage.get('contracts');
    if (!loadedContracts || !loadedContracts[id]) {
      throw new Error('Contrato criado mas não foi salvo corretamente');
    }
    
    // ... resto do código ...
  } catch (error) {
    logger.error('[LoanPlugin] Erro ao criar contrato:', error);
    throw error;
  }
}
```

---

## ⚠️ PROBLEMA: Seleção de Fluxo de Pagamento não mostra item selecionado

### Localização:
`loan-wizard.ts`, Step 5 (linhas 376-458)

### Problema Identificado:
O código renderiza os radio buttons mas **não atualiza o visual** quando o usuário seleciona uma opção.

**Código atual (linha 392-393):**
```typescript
<input type="radio" name="payment-flow" value="${type.value}" 
  ${flowType === type.value ? 'checked' : ''} style="display: none;">
```

O input está com `display: none`, então o visual depende do CSS do label pai, mas **não há listener** para atualizar o estilo dinamicamente.

### Solução:

```typescript
// No método attachStepSpecificListeners(), adicionar:
if (this.currentStep === 5) {
  document.querySelectorAll('input[name="payment-flow"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const flowType = (e.target as HTMLInputElement).value;
      if (this.formData.paymentFlow) {
        this.formData.paymentFlow.type = flowType as any;
      }

      // ADICIONAR: Atualizar visual de todos os labels
      document.querySelectorAll('input[name="payment-flow"]').forEach(r => {
        const parent = r.parentElement;
        if (parent) {
          if ((r as HTMLInputElement).checked) {
            parent.style.borderColor = '#667eea';
            parent.style.background = '#f0f4ff';
          } else {
            parent.style.borderColor = '#e5e7eb';
            parent.style.background = 'white';
          }
        }
      });

      const scheduledConfig = document.getElementById('scheduled-config');
      if (scheduledConfig) {
        scheduledConfig.style.display = flowType === 'SCHEDULED' ? 'block' : 'none';
      }
    });
  });

  // ADICIONAR: Inicializar visual no carregamento
  document.querySelectorAll('input[name="payment-flow"]').forEach(r => {
    const parent = r.parentElement;
    if (parent && (r as HTMLInputElement).checked) {
      parent.style.borderColor = '#667eea';
      parent.style.background = '#f0f4ff';
    }
  });

  // Código existente para schedule-system...
}
```

---

## 📊 FALTA: Dashboard própria para gestão de contratos

### Funcionalidade Ausente:
Não existe uma dashboard/painel dedicado para visualizar:
- Lista de todos os contratos
- Status dos contratos (ATIVO, QUITADO, etc.)
- Saldos devedores
- Próximos pagamentos
- Indicadores gerais (total captado, total cedido, etc.)

### Proposta de Implementação:

#### 1. Criar arquivo `loan-dashboard.ts`:

```typescript
/**
 * Loan Dashboard - Painel de gestão de contratos
 */

import type { PluginContext } from '@core/types';
import type { LoanContract } from './loan-types';

export class LoanDashboard {
  private context: PluginContext;
  private modalElement: HTMLElement | null = null;

  constructor(context: PluginContext) {
    this.context = context;
  }

  /**
   * Abre a dashboard de gestão de contratos.
   */
  public open(contracts: Map<string, LoanContract>): void {
    this.render(contracts);
  }

  /**
   * Renderiza a dashboard.
   */
  private render(contracts: Map<string, LoanContract>): void {
    this.dispose();

    const contractsArray = Array.from(contracts.values());
    const activeContracts = contractsArray.filter(c => c.status === 'ATIVO');
    const totalCaptado = contractsArray
      .filter(c => c.contractType === 'CAPTADO')
      .reduce((sum, c) => sum + c.currentBalance.balanceBRL, 0);
    const totalCedido = contractsArray
      .filter(c => c.contractType === 'CEDIDO')
      .reduce((sum, c) => sum + c.currentBalance.balanceBRL, 0);

    const modalHTML = `
      <div id="loan-dashboard-modal" style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 10200;">
        <div style="background: #fff; border-radius: 12px; padding: 0; width: 95%; max-width: 1200px; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 24px 48px rgba(0,0,0,0.3);">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 24px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h2 style="margin: 0; font-size: 1.6rem; font-weight: 700;">💼 Gestão de Contratos</h2>
              <p style="margin: 6px 0 0; opacity: 0.95;">${contractsArray.length} contratos cadastrados · ${activeContracts.length} ativos</p>
            </div>
            <button id="dashboard-close" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 1.2rem; font-weight: 700;">×</button>
          </div>

          <!-- KPIs -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; padding: 24px; background: #f9fafb; border-bottom: 1px solid #e5e7eb;">
            <div style="background: white; border-radius: 8px; padding: 16px; border: 2px solid #e5e7eb;">
              <div style="font-size: 0.8rem; color: #6b7280; font-weight: 600; text-transform: uppercase;">Total Contratos</div>
              <div style="font-size: 1.8rem; font-weight: 700; color: #374151; margin-top: 4px;">${contractsArray.length}</div>
              <div style="font-size: 0.85rem; color: #10b981; margin-top: 4px;">${activeContracts.length} ativos</div>
            </div>
            
            <div style="background: white; border-radius: 8px; padding: 16px; border: 2px solid #ef4444;">
              <div style="font-size: 0.8rem; color: #6b7280; font-weight: 600; text-transform: uppercase;">📥 Captado</div>
              <div style="font-size: 1.8rem; font-weight: 700; color: #ef4444; margin-top: 4px;">R$ ${this.formatNumber(totalCaptado)}</div>
              <div style="font-size: 0.85rem; color: #6b7280; margin-top: 4px;">${contractsArray.filter(c => c.contractType === 'CAPTADO').length} contratos</div>
            </div>
            
            <div style="background: white; border-radius: 8px; padding: 16px; border: 2px solid #10b981;">
              <div style="font-size: 0.8rem; color: #6b7280; font-weight: 600; text-transform: uppercase;">📤 Cedido</div>
              <div style="font-size: 1.8rem; font-weight: 700; color: #10b981; margin-top: 4px;">R$ ${this.formatNumber(totalCedido)}</div>
              <div style="font-size: 0.85rem; color: #6b7280; margin-top: 4px;">${contractsArray.filter(c => c.contractType === 'CEDIDO').length} contratos</div>
            </div>
            
            <div style="background: white; border-radius: 8px; padding: 16px; border: 2px solid #667eea;">
              <div style="font-size: 0.8rem; color: #6b7280; font-weight: 600; text-transform: uppercase;">Posição Líquida</div>
              <div style="font-size: 1.8rem; font-weight: 700; color: ${totalCedido - totalCaptado >= 0 ? '#10b981' : '#ef4444'}; margin-top: 4px;">R$ ${this.formatNumber(totalCedido - totalCaptado)}</div>
              <div style="font-size: 0.85rem; color: #6b7280; margin-top: 4px;">Cedido - Captado</div>
            </div>
          </div>

          <!-- Filters -->
          <div style="padding: 16px 24px; background: white; border-bottom: 1px solid #e5e7eb; display: flex; gap: 12px; align-items: center;">
            <input id="dashboard-search" type="text" placeholder="Buscar por ID, contraparte..." style="flex: 1; padding: 10px; border: 2px solid #e5e7eb; border-radius: 6px;">
            <select id="dashboard-filter-status" style="padding: 10px; border: 2px solid #e5e7eb; border-radius: 6px;">
              <option value="">Todos os status</option>
              <option value="ATIVO">ATIVO</option>
              <option value="QUITADO">QUITADO</option>
              <option value="VENCIDO">VENCIDO</option>
            </select>
            <select id="dashboard-filter-type" style="padding: 10px; border: 2px solid #e5e7eb; border-radius: 6px;">
              <option value="">Todos os tipos</option>
              <option value="CAPTADO">CAPTADO</option>
              <option value="CEDIDO">CEDIDO</option>
            </select>
          </div>

          <!-- Contracts Table -->
          <div style="flex: 1; overflow-y: auto; padding: 24px;">
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb;">
                  <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">ID</th>
                  <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Contraparte</th>
                  <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Tipo</th>
                  <th style="padding: 12px; text-align: right; font-weight: 600; color: #374151;">Saldo BRL</th>
                  <th style="padding: 12px; text-align: right; font-weight: 600; color: #374151;">Saldo Origem</th>
                  <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151;">Status</th>
                  <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151;">Próx. Pgto</th>
                  <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151;">Ações</th>
                </tr>
              </thead>
              <tbody id="dashboard-contracts-tbody">
                ${this.renderContractRows(contractsArray)}
              </tbody>
            </table>
          </div>

        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.modalElement = document.getElementById('loan-dashboard-modal');

    this.attachEventListeners(contracts);
  }

  private renderContractRows(contracts: LoanContract[]): string {
    if (contracts.length === 0) {
      return '<tr><td colspan="8" style="padding: 40px; text-align: center; color: #6b7280;">Nenhum contrato cadastrado</td></tr>';
    }

    return contracts.map(contract => {
      const statusColor = contract.status === 'ATIVO' ? '#10b981' : contract.status === 'QUITADO' ? '#6b7280' : '#ef4444';
      const typeColor = contract.contractType === 'CAPTADO' ? '#ef4444' : '#10b981';
      
      return `
        <tr style="border-bottom: 1px solid #e5e7eb;" data-contract-id="${contract.id}">
          <td style="padding: 12px; font-weight: 600; color: #667eea;">${contract.id}</td>
          <td style="padding: 12px; color: #374151;">${contract.counterparty}</td>
          <td style="padding: 12px;">
            <span style="background: ${typeColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: 600;">
              ${contract.contractType}
            </span>
          </td>
          <td style="padding: 12px; text-align: right; font-weight: 600; color: #374151;">R$ ${this.formatNumber(contract.currentBalance.balanceBRL)}</td>
          <td style="padding: 12px; text-align: right; color: #6b7280;">${contract.currency} ${this.formatNumber(contract.currentBalance.balanceOrigin)}</td>
          <td style="padding: 12px; text-align: center;">
            <span style="background: ${statusColor}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 0.85rem; font-weight: 600;">
              ${contract.status}
            </span>
          </td>
          <td style="padding: 12px; text-align: center; color: #6b7280; font-size: 0.9rem;">
            ${contract.currentBalance.nextPaymentDate || 'N/A'}
            ${contract.currentBalance.nextPaymentAmount ? `<br><small>R$ ${this.formatNumber(contract.currentBalance.nextPaymentAmount)}</small>` : ''}
          </td>
          <td style="padding: 12px; text-align: center;">
            <button class="contract-details-btn" data-contract-id="${contract.id}" style="background: #667eea; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 0.85rem;">Detalhes</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  private attachEventListeners(contracts: Map<string, LoanContract>): void {
    document.getElementById('dashboard-close')?.addEventListener('click', () => this.dispose());

    // Search and filters
    const searchInput = document.getElementById('dashboard-search') as HTMLInputElement;
    const statusFilter = document.getElementById('dashboard-filter-status') as HTMLSelectElement;
    const typeFilter = document.getElementById('dashboard-filter-type') as HTMLSelectElement;

    const applyFilters = () => {
      const searchTerm = searchInput.value.toLowerCase();
      const statusValue = statusFilter.value;
      const typeValue = typeFilter.value;

      const filtered = Array.from(contracts.values()).filter(contract => {
        const matchesSearch = contract.id.toLowerCase().includes(searchTerm) || 
                            contract.counterparty.toLowerCase().includes(searchTerm);
        const matchesStatus = !statusValue || contract.status === statusValue;
        const matchesType = !typeValue || contract.contractType === typeValue;

        return matchesSearch && matchesStatus && matchesType;
      });

      const tbody = document.getElementById('dashboard-contracts-tbody');
      if (tbody) {
        tbody.innerHTML = this.renderContractRows(filtered);
        this.attachDetailButtons();
      }
    };

    searchInput?.addEventListener('input', applyFilters);
    statusFilter?.addEventListener('change', applyFilters);
    typeFilter?.addEventListener('change', applyFilters);

    this.attachDetailButtons();
  }

  private attachDetailButtons(): void {
    document.querySelectorAll('.contract-details-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const contractId = (e.target as HTMLElement).getAttribute('data-contract-id');
        if (contractId) {
          this.showContractDetails(contractId);
        }
      });
    });
  }

  private showContractDetails(contractId: string): void {
    // TODO: Implementar modal de detalhes do contrato
    alert(`Detalhes do contrato ${contractId}\n\nEsta funcionalidade será implementada em breve.`);
  }

  private formatNumber(value: number): string {
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  public dispose(): void {
    this.modalElement?.remove();
    this.modalElement = null;
  }
}
```

#### 2. Integrar no `loan-plugin.ts`:

```typescript
// Importar no topo
import { LoanDashboard } from './loan-dashboard';

// Adicionar propriedade privada
private dashboard?: LoanDashboard;

// No método init(), após criar sheets:
this.dashboard = new LoanDashboard(context);

// No registerMenus(), adicionar item:
this.context.ui.addMenuItem({
  id: 'loan-dashboard',
  label: '📊 Dashboard de Contratos',
  parent: 'loan-menu',
  onClick: () => this.showDashboard()
});

// Adicionar método:
private showDashboard(): void {
  if (this.dashboard) {
    this.dashboard.open(this.contracts);
  }
}

// No dispose(), limpar:
this.dashboard?.dispose();
```

---

## 🔧 Outras Melhorias Identificadas

### 1. **Modal de Pagamento - Saldo não atualiza automaticamente**
**Linha 774-776 em loan-plugin.ts:**

O método `updatePaymentModalBalance()` é chamado apenas no change do select, mas deveria ser chamado também ao abrir o modal se houver apenas um contrato.

**Solução:**
```typescript
// Após renderizar o modal (linha 768), adicionar:
if (activeContracts.length === 1) {
  this.updatePaymentModalBalance(activeContracts[0].id);
}
```

### 2. **Validação de dados incompleta no wizard**
Os steps não validam campos opcionais vs obrigatórios adequadamente.

**Solução:**
Adicionar validações mais robustas em `captureCurrentStepData()`.

### 3. **Falta feedback de progresso**
Operações longas (como sincronização PTAX) não mostram progresso.

**Solução:**
Adicionar loader/spinner durante operações assíncronas.

### 4. **Sheets não são atualizadas em tempo real**
Quando um contrato é alterado, as sheets não são atualizadas automaticamente.

**Solução:**
Adicionar evento de atualização e listener nas sheets.

---

## 📝 Resumo das Prioridades

### 🔴 Crítico (fazer primeiro):
1. **Corrigir salvamento de contratos** - Adicionar logs de debug e verificação
2. **Corrigir seleção visual no wizard** - Adicionar listener para atualizar CSS

### 🟡 Importante (fazer em seguida):
3. **Criar dashboard de gestão** - Implementar painel visual completo
4. **Melhorar feedback de salvamento** - Notificar usuário sobre sucesso/erro

### 🟢 Nice to have (fazer depois):
5. **Validações aprimoradas** - Melhorar validação de formulários
6. **Auto-update de sheets** - Atualização em tempo real
7. **Progress feedback** - Mostrar progresso em operações longas

---

## 🛠️ Plano de Ação Recomendado

1. **Fase 1 - Correções Críticas** (1-2 horas):
   - Corrigir salvamento de contratos com logs de debug
   - Corrigir visual de seleção no wizard Step 5

2. **Fase 2 - Dashboard** (3-4 horas):
   - Criar arquivo `loan-dashboard.ts`
   - Integrar dashboard no plugin
   - Testar funcionalidades

3. **Fase 3 - Melhorias** (2-3 horas):
   - Adicionar validações extras
   - Melhorar feedback visual
   - Adicionar progress indicators

---

**Análise gerada em:** 2025-11-04
**Versão do plugin:** 2.0.0
**Arquivos analisados:**
- `src/plugins/loan/loan-plugin.ts`
- `src/plugins/loan/loan-wizard.ts`
- `src/plugins/loan/loan-types.ts`
- `src/plugins/loan/loan-payment-manager.ts`
- `src/plugins/loan/loan-sheets.ts`
