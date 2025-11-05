/**
 * Loan Dashboard - Painel de gestão de contratos
 * 
 * Fornece uma interface visual para gerenciar todos os contratos:
 * - KPIs agregados (total captado, cedido, posição líquida)
 * - Lista completa com filtros e busca
 * - Ações rápidas por contrato
 */

import type { PluginContext } from '@core/types';
import type { LoanContract } from './loan-types';

export type LoanDashboardHandlers = {
  showReportsMenu: (contracts: LoanContract[]) => void;
  registerPayment: (contractId?: string) => void;
  quickReport: (type: 'interest' | 'principal' | 'consolidated', contracts: LoanContract[]) => void | Promise<void>;
  createTemplate: () => void | Promise<void>;
  openContract: (contractId: string) => void | Promise<void>;
};

export class LoanDashboard {
  private context: PluginContext;
  private modalElement: HTMLElement | null = null;
  private contractsSnapshot: Map<string, LoanContract> = new Map();
  private handlers: LoanDashboardHandlers;

  constructor(context: PluginContext) {
    this.context = context;
    this.handlers = {
      showReportsMenu: (contracts) => {
        this.context.events.emit('loan:show-reports-menu', { contracts });
      },
      registerPayment: () => {
        this.context.events.emit('loan:dashboard:register-payment', {});
      },
      quickReport: (type, contracts) => {
        this.context.events.emit('loan:quick-report', { type, contracts });
      },
      createTemplate: () => {
        this.context.events.emit('loan:create-template', {});
      },
      openContract: (contractId) => {
        this.context.ui.showToast(`Detalhes do contrato ${contractId} indisponíveis no momento.`, 'info');
      }
    };
  }

  /**
   * Abre a dashboard de gestão de contratos.
   */
  public open(contracts: Map<string, LoanContract>): void {
    this.contractsSnapshot = new Map(contracts);
    this.render();
  }

  /**
   * Renderiza a dashboard.
   */
  private render(): void {
    this.dispose();

    const contractsArray = Array.from(this.contractsSnapshot.values());
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

          <!-- Action Buttons -->
          <div style="padding: 20px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-bottom: 3px solid rgba(255,255,255,0.2); display: flex; gap: 12px; flex-wrap: wrap;">
            <button id="btn-reports-menu" style="
              background: white;
              color: #667eea;
              border: none;
              padding: 12px 20px;
              border-radius: 8px;
              cursor: pointer;
              font-weight: 700;
              font-size: 14px;
              display: flex;
              align-items: center;
              gap: 8px;
              box-shadow: 0 4px 12px rgba(0,0,0,0.15);
              transition: all 0.2s;
            "
            onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(0,0,0,0.2)'"
            onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)'">
              📊 Relatórios Avançados
            </button>

            <button id="btn-register-payment" style="
              background: #10b981;
              color: white;
              border: none;
              padding: 12px 20px;
              border-radius: 8px;
              cursor: pointer;
              font-weight: 700;
              font-size: 14px;
              display: flex;
              align-items: center;
              gap: 8px;
              box-shadow: 0 4px 12px rgba(16,185,129,0.25);
              transition: all 0.2s;
            "
            onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(16,185,129,0.35)'"
            onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(16,185,129,0.25)'">
              💸 Registrar Pagamento
            </button>

            <button id="btn-quick-interest" style="
              background: rgba(255,255,255,0.2);
              color: white;
              border: 2px solid rgba(255,255,255,0.3);
              padding: 10px 16px;
              border-radius: 8px;
              cursor: pointer;
              font-weight: 600;
              font-size: 13px;
              transition: all 0.2s;
            "
            onmouseover="this.style.background='rgba(255,255,255,0.3)'"
            onmouseout="this.style.background='rgba(255,255,255,0.2)'">
              💰 Análise de Juros
            </button>

            <button id="btn-quick-principal" style="
              background: rgba(255,255,255,0.2);
              color: white;
              border: 2px solid rgba(255,255,255,0.3);
              padding: 10px 16px;
              border-radius: 8px;
              cursor: pointer;
              font-weight: 600;
              font-size: 13px;
              transition: all 0.2s;
            "
            onmouseover="this.style.background='rgba(255,255,255,0.3)'"
            onmouseout="this.style.background='rgba(255,255,255,0.2)'">
              📊 Análise de Principal
            </button>

            <button id="btn-quick-consolidated" style="
              background: rgba(255,255,255,0.2);
              color: white;
              border: 2px solid rgba(255,255,255,0.3);
              padding: 10px 16px;
              border-radius: 8px;
              cursor: pointer;
              font-weight: 600;
              font-size: 13px;
              transition: all 0.2s;
            "
            onmouseover="this.style.background='rgba(255,255,255,0.3)'"
            onmouseout="this.style.background='rgba(255,255,255,0.2)'">
              📋 Visão Consolidada
            </button>

            <button id="btn-custom-template" style="
              background: rgba(255,255,255,0.2);
              color: white;
              border: 2px solid rgba(255,255,255,0.3);
              padding: 10px 16px;
              border-radius: 8px;
              cursor: pointer;
              font-weight: 600;
              font-size: 13px;
              transition: all 0.2s;
            "
            onmouseover="this.style.background='rgba(255,255,255,0.3)'"
            onmouseout="this.style.background='rgba(255,255,255,0.2)'">
              🎨 Template Personalizado
            </button>
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
            <input id="dashboard-search" type="text" placeholder="🔍 Buscar por ID, contraparte..." style="flex: 1; padding: 10px; border: 2px solid #e5e7eb; border-radius: 6px;">
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
            ${contractsArray.length === 0 ? `
              <div style="text-align: center; padding: 60px 20px;">
                <div style="font-size: 4rem; margin-bottom: 16px;">📋</div>
                <h3 style="margin: 0 0 8px; color: #374151;">Nenhum contrato cadastrado</h3>
                <p style="color: #6b7280; margin: 0;">Crie seu primeiro contrato usando o menu "Novo Contrato"</p>
              </div>
            ` : `
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
            `}
          </div>

        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.modalElement = document.getElementById('loan-dashboard-modal');

    this.attachEventListeners();
  }

  public registerHandlers(handlers: Partial<LoanDashboardHandlers>): void {
    this.handlers = {
      ...this.handlers,
      ...handlers
    };
  }

  private renderContractRows(contracts: LoanContract[]): string {
    if (contracts.length === 0) {
      return '<tr><td colspan="8" style="padding: 40px; text-align: center; color: #6b7280;">Nenhum contrato encontrado</td></tr>';
    }

    return contracts.map(contract => {
      const statusColor = contract.status === 'ATIVO' ? '#10b981' : contract.status === 'QUITADO' ? '#6b7280' : '#ef4444';
      const typeColor = contract.contractType === 'CAPTADO' ? '#ef4444' : '#10b981';
      
      return `
        <tr style="border-bottom: 1px solid #e5e7eb; transition: background 0.2s;" onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background='white'" data-contract-id="${contract.id}">
          <td style="padding: 12px; font-weight: 600; color: #667eea;">${contract.id}</td>
          <td style="padding: 12px; color: #374151;">${contract.counterparty}</td>
          <td style="padding: 12px;">
            <span style="background: ${typeColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: 600;">
              ${contract.contractType === 'CAPTADO' ? '📥' : '📤'} ${contract.contractType}
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
            ${contract.currentBalance.nextPaymentAmount ? `<br><small style="color: #667eea; font-weight: 600;">R$ ${this.formatNumber(contract.currentBalance.nextPaymentAmount)}</small>` : ''}
          </td>
          <td style="padding: 12px; text-align: center;">
            <button class="contract-details-btn" data-contract-id="${contract.id}" 
              style="background: #667eea; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 0.85rem; transition: background 0.2s;"
              onmouseover="this.style.background='#5568d3'" onmouseout="this.style.background='#667eea'">
              📊 Ver
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  private attachEventListeners(): void {
    document.getElementById('dashboard-close')?.addEventListener('click', () => this.dispose());

    // Report buttons
    document.getElementById('btn-reports-menu')?.addEventListener('click', () => {
      const contractsArray = Array.from(this.contractsSnapshot.values());
      this.dispose();
      this.handlers.showReportsMenu(contractsArray);
    });

    document.getElementById('btn-register-payment')?.addEventListener('click', () => {
      this.dispose();
      this.handlers.registerPayment();
    });

    document.getElementById('btn-quick-interest')?.addEventListener('click', () => {
      const contractsArray = Array.from(this.contractsSnapshot.values());
      this.dispose();
      Promise.resolve(this.handlers.quickReport('interest', contractsArray)).catch(error => {
        console.error('[LoanDashboard] quickReport(interest) failed', error);
      });
    });

    document.getElementById('btn-quick-principal')?.addEventListener('click', () => {
      const contractsArray = Array.from(this.contractsSnapshot.values());
      this.dispose();
      Promise.resolve(this.handlers.quickReport('principal', contractsArray)).catch(error => {
        console.error('[LoanDashboard] quickReport(principal) failed', error);
      });
    });

    document.getElementById('btn-quick-consolidated')?.addEventListener('click', () => {
      const contractsArray = Array.from(this.contractsSnapshot.values());
      this.dispose();
      Promise.resolve(this.handlers.quickReport('consolidated', contractsArray)).catch(error => {
        console.error('[LoanDashboard] quickReport(consolidated) failed', error);
      });
    });

    document.getElementById('btn-custom-template')?.addEventListener('click', () => {
      this.dispose();
      Promise.resolve(this.handlers.createTemplate()).catch(error => {
        console.error('[LoanDashboard] createTemplate failed', error);
      });
    });

    // Search and filters
    const searchInput = document.getElementById('dashboard-search') as HTMLInputElement;
    const statusFilter = document.getElementById('dashboard-filter-status') as HTMLSelectElement;
    const typeFilter = document.getElementById('dashboard-filter-type') as HTMLSelectElement;

    const applyFilters = () => {
      const searchTerm = searchInput?.value.toLowerCase() || '';
      const statusValue = statusFilter?.value || '';
      const typeValue = typeFilter?.value || '';

      const filtered = Array.from(this.contractsSnapshot.values()).filter(contract => {
        const matchesSearch = !searchTerm || 
          contract.id.toLowerCase().includes(searchTerm) || 
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
    if (!this.contractsSnapshot.has(contractId)) {
      this.context.ui.showToast(`Contrato ${contractId} não encontrado`, 'warning');
      return;
    }

    this.dispose();
    Promise.resolve(this.handlers.openContract(contractId)).catch(error => {
      console.error('[LoanDashboard] openContract failed', error);
    });
  }

  private formatNumber(value: number): string {
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  public dispose(): void {
    this.modalElement?.remove();
    this.modalElement = null;
  }
}
