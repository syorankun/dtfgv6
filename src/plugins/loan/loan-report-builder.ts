/**
 * Loan Report Builder - Construtor visual de templates com drag-and-drop
 *
 * Permite criar/editar templates customizados:
 * - Drag-and-drop de colunas
 * - Organização em seções
 * - Configuração de estilos
 * - Preview em tempo real
 * - Salvar como template personalizado
 */

import type { PluginContext } from '@core/types';
import type {
  AccrualSheetViewConfig,
  AccrualSheetSection,
  AccrualSheetColumnDescriptor,
  AccrualRowField
} from './loan-accrual-view';
import { cloneAccrualViewConfig } from './loan-accrual-view';
import { REPORT_TEMPLATES } from './loan-report-templates';
import { logger } from '@core/storage-utils-consolidated';
import { nanoid } from 'nanoid';

export interface ColumnFieldOption {
  field: AccrualRowField;
  label: string;
  category: string;
  type: 'number' | 'string' | 'date';
  defaultDecimals?: number;
}

/**
 * Catálogo de campos disponíveis para construir templates
 */
export const AVAILABLE_FIELDS: ColumnFieldOption[] = [
  // Temporal
  { field: 'date', label: 'Data', category: 'Período', type: 'date' },
  { field: 'days', label: 'Dias', category: 'Período', type: 'number', defaultDecimals: 0 },
  { field: 'effRate', label: 'Taxa Efetiva', category: 'Período', type: 'number', defaultDecimals: 8 },

  // Origem
  { field: 'openingBalanceOrigin', label: 'Saldo Inicial (Origem)', category: 'Moeda Origem', type: 'number', defaultDecimals: 4 },
  { field: 'interestOrigin', label: 'Juros (Origem)', category: 'Moeda Origem', type: 'number', defaultDecimals: 4 },
  { field: 'accruedInterestOrigin', label: 'Juros Acumulados (Origem)', category: 'Moeda Origem', type: 'number', defaultDecimals: 4 },
  { field: 'closingBalanceOrigin', label: 'Saldo Final (Origem)', category: 'Moeda Origem', type: 'number', defaultDecimals: 4 },

  // BRL Contrato
  { field: 'openingBalanceBRLContract', label: 'Saldo Inicial BRL (Contrato)', category: 'BRL Contrato', type: 'number', defaultDecimals: 2 },
  { field: 'interestBRLContract', label: 'Juros BRL (Contrato)', category: 'BRL Contrato', type: 'number', defaultDecimals: 2 },
  { field: 'accruedInterestBRLContract', label: 'Juros Acumulados BRL (Contrato)', category: 'BRL Contrato', type: 'number', defaultDecimals: 2 },
  { field: 'closingBalanceBRLContract', label: 'Saldo Final BRL (Contrato)', category: 'BRL Contrato', type: 'number', defaultDecimals: 2 },
  { field: 'fxRateContract', label: 'FX Contrato', category: 'BRL Contrato', type: 'number', defaultDecimals: 6 },

  // BRL PTAX
  { field: 'openingBalanceBRLPTAX', label: 'Saldo Inicial BRL (PTAX)', category: 'BRL PTAX', type: 'number', defaultDecimals: 2 },
  { field: 'interestBRLPTAX', label: 'Juros BRL (PTAX)', category: 'BRL PTAX', type: 'number', defaultDecimals: 2 },
  { field: 'accruedInterestBRLPTAX', label: 'Juros Acumulados BRL (PTAX)', category: 'BRL PTAX', type: 'number', defaultDecimals: 2 },
  { field: 'closingBalanceBRLPTAX', label: 'Saldo Final BRL (PTAX)', category: 'BRL PTAX', type: 'number', defaultDecimals: 2 },
  { field: 'fxRatePTAX', label: 'FX PTAX', category: 'BRL PTAX', type: 'number', defaultDecimals: 6 },
  { field: 'fxSourcePTAX', label: 'Fonte PTAX', category: 'BRL PTAX', type: 'string' },

  // Variação Cambial
  { field: 'fxVariationOpeningBRL', label: 'Δ Principal (BRL)', category: 'Variação FX', type: 'number', defaultDecimals: 2 },
  { field: 'fxVariationInterestBRL', label: 'Δ Juros (BRL)', category: 'Variação FX', type: 'number', defaultDecimals: 2 },
  { field: 'fxVariationBRL', label: 'Δ Saldo (BRL)', category: 'Variação FX', type: 'number', defaultDecimals: 2 },
  { field: 'fxVariationPercent', label: 'Variação Cambial (%)', category: 'Variação FX', type: 'number', defaultDecimals: 4 },

  // Genéricos
  { field: 'openingBalanceBRL', label: 'Saldo Inicial BRL', category: 'Genérico', type: 'number', defaultDecimals: 2 },
  { field: 'interestBRL', label: 'Juros BRL', category: 'Genérico', type: 'number', defaultDecimals: 2 },
  { field: 'closingBalanceBRL', label: 'Saldo Final BRL', category: 'Genérico', type: 'number', defaultDecimals: 2 },
  { field: 'fxRate', label: 'Taxa FX', category: 'Genérico', type: 'number', defaultDecimals: 6 },
  { field: 'fxSource', label: 'Fonte FX', category: 'Genérico', type: 'string' }
];

export class LoanReportBuilder {
  private context: PluginContext;
  private modalElement: HTMLElement | null = null;
  private currentTemplate: AccrualSheetViewConfig | null = null;
  private onSave: ((template: AccrualSheetViewConfig) => void) | null = null;
  private customTemplatesMap: Map<string, any> = new Map();

  constructor(context: PluginContext) {
    this.context = context;
  }

  /**
   * Define templates customizados disponíveis para edição
   */
  public setCustomTemplates(templates: Map<string, any>): void {
    this.customTemplatesMap = templates;
  }

  /**
   * Abre o builder para criar novo template
   */
  public createNew(onSave: (template: AccrualSheetViewConfig) => void): void {
    this.currentTemplate = {
      id: `custom-${nanoid(8)}`,
      title: 'Novo Template',
      description: '',
      summaryLabel: 'Totais',
      sections: []
    };
    this.onSave = onSave;
    this.render();
  }

  /**
   * Abre o builder para editar template existente (built-in ou customizado)
   */
  public edit(templateId: string, onSave: (template: AccrualSheetViewConfig) => void): void {
    // Tenta buscar template customizado primeiro
    const customTemplate = this.customTemplatesMap.get(templateId);
    if (customTemplate && customTemplate.config) {
      this.currentTemplate = cloneAccrualViewConfig(customTemplate.config);
      this.onSave = onSave;
      this.render();
      return;
    }

    // Se não for customizado, busca nos built-in
    const template = REPORT_TEMPLATES[templateId as keyof typeof REPORT_TEMPLATES];
    if (!template) {
      this.context.ui.showToast('Template não encontrado', 'error');
      return;
    }

    this.currentTemplate = cloneAccrualViewConfig(template);
    this.onSave = onSave;
    this.render();
  }

  /**
   * Renderiza o modal do builder
   */
  private render(): void {
    if (!this.currentTemplate) return;

    // Salva cópia local antes de dispose() limpar this.currentTemplate
    const currentTemplate = this.currentTemplate;

    this.dispose();

    // Reassocia currentTemplate para renderSections() e outros métodos internos
    this.currentTemplate = currentTemplate;

    const modalHTML = `
      <div id="loan-report-builder-modal" style="position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(12px); display: flex; align-items: center; justify-content: center; z-index: 10400;">
        <div style="background: #ffffff; border-radius: 16px; width: 96%; max-width: 1600px; height: 94vh; display: flex; flex-direction: column; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.6); overflow: hidden;">

          <!-- Header -->
          <div style="background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); color: white; padding: 24px 32px; display: flex; justify-content: space-between; align-items: center; border-bottom: 4px solid rgba(255,255,255,0.2);">
            <div style="flex: 1;">
              <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                <span style="font-size: 32px;">🎨</span>
                <input id="template-title" value="${currentTemplate.title}" style="
                  background: rgba(255,255,255,0.2);
                  border: 2px solid rgba(255,255,255,0.3);
                  color: white;
                  font-size: 24px;
                  font-weight: 700;
                  padding: 8px 14px;
                  border-radius: 8px;
                  flex: 1;
                  max-width: 400px;
                  outline: none;
                "
                placeholder="Nome do Template"
                onfocus="this.style.background='rgba(255,255,255,0.3)'" onblur="this.style.background='rgba(255,255,255,0.2)'">
              </div>
              <input id="template-description" value="${currentTemplate.description || ''}" style="
                background: rgba(255,255,255,0.15);
                border: 1px solid rgba(255,255,255,0.2);
                color: white;
                font-size: 14px;
                padding: 6px 12px;
                border-radius: 6px;
                width: 100%;
                max-width: 600px;
                outline: none;
              "
              placeholder="Descrição do template (opcional)">
            </div>
            <button id="close-builder" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 10px; border-radius: 50%; cursor: pointer; font-size: 24px; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; font-weight: bold;"
              onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">×</button>
          </div>

          <!-- Content Area -->
          <div style="display: flex; flex: 1; overflow: hidden;">

            <!-- Left Panel: Available Fields -->
            <div style="width: 320px; background: #f8f9fa; border-right: 2px solid #e5e7eb; display: flex; flex-direction: column; overflow: hidden;">
              <div style="padding: 20px; border-bottom: 1px solid #e5e7eb;">
                <h3 style="margin: 0 0 8px 0; font-size: 15px; font-weight: 700; color: #374151;">📦 Campos Disponíveis</h3>
                <p style="margin: 0; font-size: 12px; color: #6b7280;">Arraste para adicionar às seções</p>
              </div>

              <div style="flex: 1; overflow-y: auto; padding: 16px;">
                ${this.renderAvailableFields()}
              </div>
            </div>

            <!-- Center Panel: Template Builder -->
            <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden; background: #ffffff;">

              <!-- Toolbar -->
              <div style="padding: 16px 24px; border-bottom: 2px solid #e5e7eb; background: #fafafa; display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; gap: 12px;">
                  <button id="add-section-btn" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 10px 18px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 13px; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3); transition: all 0.2s;"
                    onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 12px rgba(102, 126, 234, 0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(102, 126, 234, 0.3)'">
                    ➕ Adicionar Seção
                  </button>
                </div>

                <div style="display: flex; gap: 8px;">
                  <button id="preview-btn" style="background: white; color: #667eea; border: 2px solid #667eea; padding: 10px 18px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 13px; transition: all 0.2s;"
                    onmouseover="this.style.background='#f0f4ff'" onmouseout="this.style.background='white'">
                    👁️ Preview
                  </button>
                </div>
              </div>

              <!-- Sections Container -->
              <div id="sections-container" style="flex: 1; overflow-y: auto; padding: 24px;">
                ${this.renderSections()}
              </div>

            </div>

            <!-- Right Panel: Properties -->
            <div id="properties-panel" style="width: 340px; background: #f8f9fa; border-left: 2px solid #e5e7eb; overflow-y: auto; padding: 20px; display: none;">
              <h3 style="margin: 0 0 16px 0; font-size: 15px; font-weight: 700; color: #374151;">⚙️ Propriedades</h3>
              <div id="properties-content">
                <p style="color: #6b7280; font-size: 13px;">Selecione uma coluna para editar suas propriedades</p>
              </div>
            </div>

          </div>

          <!-- Footer -->
          <div style="padding: 20px 32px; border-top: 2px solid #e5e7eb; background: #fafafa; display: flex; justify-content: space-between; align-items: center;">
            <div style="font-size: 13px; color: #6b7280;">
              💡 Dica: Arraste campos da esquerda para as seções, reorganize colunas e configure propriedades
            </div>
            <div style="display: flex; gap: 12px;">
              <button id="cancel-btn" style="padding: 12px 24px; background: white; color: #6b7280; border: 2px solid #e5e7eb; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px; transition: all 0.2s;"
                onmouseover="this.style.borderColor='#d1d5db'" onmouseout="this.style.borderColor='#e5e7eb'">
                Cancelar
              </button>
              <button id="save-template-btn" style="padding: 12px 32px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 14px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3); transition: all 0.2s;"
                onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(16, 185, 129, 0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(16, 185, 129, 0.3)'">
                💾 Salvar Template
              </button>
            </div>
          </div>

        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.modalElement = document.getElementById('loan-report-builder-modal');

    this.attachEventListeners();
  }

  /**
   * Renderiza campos disponíveis agrupados por categoria
   */
  private renderAvailableFields(): string {
    const byCategory = AVAILABLE_FIELDS.reduce((acc, field) => {
      if (!acc[field.category]) acc[field.category] = [];
      acc[field.category].push(field);
      return acc;
    }, {} as Record<string, ColumnFieldOption[]>);

    return Object.entries(byCategory).map(([category, fields]) => `
      <div style="margin-bottom: 20px;">
        <div style="font-size: 12px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 2px solid #e5e7eb;">
          ${category}
        </div>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          ${fields.map(field => `
            <div class="draggable-field" draggable="true" data-field="${field.field}" data-label="${field.label}" data-type="${field.type}" data-decimals="${field.defaultDecimals || 2}" style="
              background: white;
              border: 2px solid #e5e7eb;
              border-radius: 6px;
              padding: 10px 12px;
              cursor: grab;
              transition: all 0.2s;
              font-size: 13px;
              color: #374151;
              font-weight: 500;
            "
            onmouseover="this.style.borderColor='#667eea'; this.style.transform='translateX(4px)'"
            onmouseout="this.style.borderColor='#e5e7eb'; this.style.transform='translateX(0)'">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 16px;">⋮⋮</span>
                <span>${field.label}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
  }

  /**
   * Renderiza seções do template
   */
  private renderSections(): string {
    if (!this.currentTemplate) return '';

    if (this.currentTemplate.sections.length === 0) {
      return `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center;">
          <div style="font-size: 64px; margin-bottom: 16px; opacity: 0.3;">📋</div>
          <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 700; color: #374151;">Nenhuma Seção Criada</h3>
          <p style="margin: 0; font-size: 14px; color: #6b7280;">Clique em "Adicionar Seção" para começar</p>
        </div>
      `;
    }

    return this.currentTemplate.sections.map((section, sectionIndex) => `
      <div class="template-section" data-section-id="${section.id}" style="
        background: white;
        border: 2px solid #e5e7eb;
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 20px;
        transition: all 0.2s;
      ">

        <!-- Section Header -->
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid #f3f4f6;">
          <span style="font-size: 20px; cursor: grab;">⋮⋮</span>
          <input class="section-title-input" data-section-index="${sectionIndex}" value="${section.title}" style="
            flex: 1;
            font-size: 16px;
            font-weight: 700;
            color: #667eea;
            border: 2px solid transparent;
            border-radius: 6px;
            padding: 6px 10px;
            outline: none;
            transition: all 0.2s;
          "
          onfocus="this.style.borderColor='#667eea'; this.style.background='#f0f4ff'" onblur="this.style.borderColor='transparent'; this.style.background='transparent'"
          placeholder="Nome da Seção">
          <button class="delete-section-btn" data-section-index="${sectionIndex}" style="
            background: #fee2e2;
            color: #dc2626;
            border: none;
            padding: 6px 10px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 600;
            transition: all 0.2s;
          "
          onmouseover="this.style.background='#fecaca'" onmouseout="this.style.background='#fee2e2'">
            🗑️ Remover
          </button>
        </div>

        <!-- Columns Drop Zone -->
        <div class="columns-dropzone" data-section-id="${section.id}" style="
          min-height: 80px;
          border: 2px dashed #d1d5db;
          border-radius: 8px;
          padding: 12px;
          background: #fafafa;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-content: flex-start;
        ">
          ${section.columns.length === 0 ? `
            <div style="width: 100%; text-align: center; padding: 20px; color: #9ca3af; font-size: 13px;">
              Arraste campos aqui
            </div>
          ` : section.columns.map((col, colIndex) => this.renderColumn(section.id, col, colIndex)).join('')}
        </div>

      </div>
    `).join('');
  }

  /**
   * Renderiza uma coluna
   */
  private renderColumn(sectionId: string, column: AccrualSheetColumnDescriptor, colIndex: number): string {
    return `
      <div class="template-column" draggable="true" data-section-id="${sectionId}" data-column-index="${colIndex}" style="
        background: white;
        border: 2px solid #667eea;
        border-radius: 8px;
        padding: 10px 14px;
        cursor: grab;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
      "
      onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 8px rgba(0,0,0,0.1)'"
      onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 4px rgba(0,0,0,0.05)'">
        <span style="font-size: 14px; opacity: 0.5;">⋮⋮</span>
        <span style="font-size: 13px; font-weight: 600; color: #374151;">${column.label}</span>
        ${column.summary ? `<span style="background: #dbeafe; color: #1e40af; font-size: 11px; font-weight: 700; padding: 2px 6px; border-radius: 4px;">∑</span>` : ''}
        <button class="delete-column-btn" data-section-id="${sectionId}" data-column-index="${colIndex}" style="
          background: transparent;
          border: none;
          color: #dc2626;
          cursor: pointer;
          font-size: 14px;
          padding: 4px;
          margin-left: auto;
          opacity: 0.6;
          transition: opacity 0.2s;
        "
        onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'">×</button>
      </div>
    `;
  }

  /**
   * Anexa event listeners
   */
  private attachEventListeners(): void {
    // Close button
    document.getElementById('close-builder')?.addEventListener('click', () => this.dispose());
    document.getElementById('cancel-btn')?.addEventListener('click', () => this.dispose());

    // Save template
    document.getElementById('save-template-btn')?.addEventListener('click', () => this.saveTemplate());

    // Preview button
    document.getElementById('preview-btn')?.addEventListener('click', () => this.showPreview());

    // Add section
    document.getElementById('add-section-btn')?.addEventListener('click', () => this.addSection());

    // Delete section buttons
    document.querySelectorAll('.delete-section-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sectionIndex = parseInt((e.target as HTMLElement).getAttribute('data-section-index') || '0');
        this.deleteSection(sectionIndex);
      });
    });

    // Section title inputs
    document.querySelectorAll('.section-title-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const sectionIndex = parseInt((e.target as HTMLElement).getAttribute('data-section-index') || '0');
        const title = (e.target as HTMLInputElement).value;
        if (this.currentTemplate) {
          this.currentTemplate.sections[sectionIndex].title = title;
        }
      });
    });

    // Template metadata inputs
    document.getElementById('template-title')?.addEventListener('input', (e) => {
      if (this.currentTemplate) {
        this.currentTemplate.title = (e.target as HTMLInputElement).value;
      }
    });

    document.getElementById('template-description')?.addEventListener('input', (e) => {
      if (this.currentTemplate) {
        this.currentTemplate.description = (e.target as HTMLInputElement).value;
      }
    });

    // Drag and drop - Available fields
    document.querySelectorAll('.draggable-field').forEach(field => {
      field.addEventListener('dragstart', (e) => {
        const fieldElement = e.target as HTMLElement;
        const fieldData = {
          field: fieldElement.getAttribute('data-field'),
          label: fieldElement.getAttribute('data-label'),
          type: fieldElement.getAttribute('data-type'),
          decimals: parseInt(fieldElement.getAttribute('data-decimals') || '2')
        };
        const dataTransfer = (e as DragEvent).dataTransfer;
        if (dataTransfer) {
          dataTransfer.setData('field-data', JSON.stringify(fieldData));
          dataTransfer.effectAllowed = 'copy';
        }
      });
    });

    // Drag and drop - Drop zones
    document.querySelectorAll('.columns-dropzone').forEach(zone => {
      zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        (e as DragEvent).dataTransfer!.dropEffect = 'copy';
        (zone as HTMLElement).style.background = '#e0e7ff';
        (zone as HTMLElement).style.borderColor = '#667eea';
      });

      zone.addEventListener('dragleave', () => {
        (zone as HTMLElement).style.background = '#fafafa';
        (zone as HTMLElement).style.borderColor = '#d1d5db';
      });

      zone.addEventListener('drop', (e) => {
        e.preventDefault();
        (zone as HTMLElement).style.background = '#fafafa';
        (zone as HTMLElement).style.borderColor = '#d1d5db';

        const sectionId = (zone as HTMLElement).getAttribute('data-section-id');
        const fieldDataStr = (e as DragEvent).dataTransfer!.getData('field-data');

        if (fieldDataStr && sectionId) {
          const fieldData = JSON.parse(fieldDataStr);
          this.addColumnToSection(sectionId, fieldData);
        }
      });
    });

    // Delete column buttons
    document.querySelectorAll('.delete-column-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sectionId = (e.target as HTMLElement).getAttribute('data-section-id');
        const colIndex = parseInt((e.target as HTMLElement).getAttribute('data-column-index') || '0');
        if (sectionId) {
          this.deleteColumn(sectionId, colIndex);
        }
      });
    });
  }

  /**
   * Adiciona nova seção
   */
  private addSection(): void {
    if (!this.currentTemplate) return;

    const newSection: AccrualSheetSection = {
      id: `section-${nanoid(8)}`,
      title: `Seção ${this.currentTemplate.sections.length + 1}`,
      columns: []
    };

    this.currentTemplate.sections.push(newSection);
    this.refreshSections();
  }

  /**
   * Remove seção
   */
  private deleteSection(sectionIndex: number): void {
    if (!this.currentTemplate) return;

    if (confirm(`Remover seção "${this.currentTemplate.sections[sectionIndex].title}"?`)) {
      this.currentTemplate.sections.splice(sectionIndex, 1);
      this.refreshSections();
    }
  }

  /**
   * Adiciona coluna à seção
   */
  private addColumnToSection(sectionId: string, fieldData: any): void {
    if (!this.currentTemplate) return;

    const section = this.currentTemplate.sections.find(s => s.id === sectionId);
    if (!section) return;

    const newColumn: AccrualSheetColumnDescriptor = {
      id: `col-${nanoid(8)}`,
      pivotKey: fieldData.field,
      field: fieldData.field as AccrualRowField,
      label: fieldData.label,
      type: fieldData.type,
      decimals: fieldData.decimals,
      width: 120,
      format: { alignment: fieldData.type === 'number' ? 'right' : 'left' }
    };

    section.columns.push(newColumn);
    this.refreshSections();
  }

  /**
   * Remove coluna
   */
  private deleteColumn(sectionId: string, colIndex: number): void {
    if (!this.currentTemplate) return;

    const section = this.currentTemplate.sections.find(s => s.id === sectionId);
    if (!section) return;

    section.columns.splice(colIndex, 1);
    this.refreshSections();
  }

  /**
   * Atualiza renderização das seções
   */
  private refreshSections(): void {
    const container = document.getElementById('sections-container');
    if (container) {
      container.innerHTML = this.renderSections();
      this.attachEventListeners();
    }
  }

  /**
   * Salva o template
   */
  private saveTemplate(): void {
    if (!this.currentTemplate || !this.onSave) return;

    // Validações
    if (!this.currentTemplate.title || !this.currentTemplate.title.trim()) {
      this.context.ui.showToast('Digite um nome para o template', 'warning');
      return;
    }

    if (this.currentTemplate.sections.length === 0) {
      this.context.ui.showToast('Adicione pelo menos uma seção', 'warning');
      return;
    }

    const hasColumns = this.currentTemplate.sections.some(s => s.columns.length > 0);
    if (!hasColumns) {
      this.context.ui.showToast('Adicione pelo menos uma coluna', 'warning');
      return;
    }

    logger.info('[LoanReportBuilder] Salvando template', this.currentTemplate);

    this.onSave(this.currentTemplate);
    this.context.ui.showToast(`Template "${this.currentTemplate.title}" salvo com sucesso!`, 'success');
    this.dispose();
  }

  /**
   * Mostra preview do template
   */
  private showPreview(): void {
    if (!this.currentTemplate) return;

    // Validações básicas
    if (this.currentTemplate.sections.length === 0) {
      this.context.ui.showToast('Adicione pelo menos uma seção para visualizar o preview', 'warning');
      return;
    }

    const hasColumns = this.currentTemplate.sections.some(s => s.columns.length > 0);
    if (!hasColumns) {
      this.context.ui.showToast('Adicione pelo menos uma coluna para visualizar o preview', 'warning');
      return;
    }

    const previewHTML = this.generatePreviewHTML();

    // Cria modal de preview
    const previewModal = `
      <div id="template-preview-modal" style="position: fixed; inset: 0; background: rgba(0,0,0,0.9); backdrop-filter: blur(20px); display: flex; align-items: center; justify-content: center; z-index: 10500;">
        <div style="background: #ffffff; border-radius: 16px; width: 94%; max-width: 1400px; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.8); overflow: hidden;">

          <!-- Header -->
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px 28px; display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid rgba(255,255,255,0.2);">
            <div>
              <h3 style="margin: 0 0 4px 0; font-size: 22px; font-weight: 700;">👁️ Preview: ${this.currentTemplate.title}</h3>
              <p style="margin: 0; opacity: 0.9; font-size: 13px;">${this.currentTemplate.description || 'Visualização da estrutura do template'}</p>
            </div>
            <button id="close-preview" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 8px; border-radius: 50%; cursor: pointer; font-size: 20px; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; font-weight: bold;"
              onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">×</button>
          </div>

          <!-- Preview Content -->
          <div style="flex: 1; overflow: auto; padding: 28px; background: #f9fafb;">
            ${previewHTML}
          </div>

          <!-- Footer -->
          <div style="padding: 16px 28px; background: white; border-top: 2px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center;">
            <div style="font-size: 13px; color: #6b7280;">
              💡 Esta é uma visualização da estrutura. Os dados reais aparecerão após gerar o relatório.
            </div>
            <button onclick="document.getElementById('template-preview-modal').remove()" style="padding: 10px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px; box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3); transition: all 0.2s;"
              onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 12px rgba(102, 126, 234, 0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(102, 126, 234, 0.3)'">
              Fechar Preview
            </button>
          </div>

        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', previewModal);

    // Attach close listener
    document.getElementById('close-preview')?.addEventListener('click', () => {
      document.getElementById('template-preview-modal')?.remove();
    });
  }

  /**
   * Gera HTML do preview
   */
  private generatePreviewHTML(): string {
    if (!this.currentTemplate) return '';

    let html = '<div style="background: white; border-radius: 12px; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">';

    // Template header
    html += `
      <div style="margin-bottom: 28px; padding-bottom: 20px; border-bottom: 3px solid #f3f4f6;">
        <h2 style="margin: 0 0 8px 0; font-size: 26px; font-weight: 700; color: #1f2937;">${this.currentTemplate.title}</h2>
        ${this.currentTemplate.description ? `<p style="margin: 0; color: #6b7280; font-size: 15px;">${this.currentTemplate.description}</p>` : ''}
        <div style="margin-top: 12px; display: flex; gap: 16px; font-size: 13px;">
          <span style="background: #dbeafe; color: #1e40af; padding: 4px 12px; border-radius: 6px; font-weight: 600;">
            ${this.currentTemplate.sections.length} seções
          </span>
          <span style="background: #d1fae5; color: #065f46; padding: 4px 12px; border-radius: 6px; font-weight: 600;">
            ${this.currentTemplate.sections.reduce((sum, s) => sum + s.columns.length, 0)} colunas
          </span>
        </div>
      </div>
    `;

    // Sections
    this.currentTemplate.sections.forEach((section, sectionIndex) => {
      html += `
        <div style="margin-bottom: 32px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 18px; border-radius: 8px 8px 0 0; display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 18px; font-weight: 700;">${sectionIndex + 1}</span>
            <span style="font-size: 16px; font-weight: 700;">${section.title}</span>
            <span style="background: rgba(255,255,255,0.2); padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; margin-left: auto;">
              ${section.columns.length} colunas
            </span>
          </div>

          <div style="background: white; border: 2px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; overflow: hidden;">
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb;">
                  ${section.columns.map(col => `
                    <th style="padding: 14px 16px; text-align: ${col.format?.alignment || 'left'}; font-weight: 700; font-size: 13px; color: #374151; border-right: 1px solid #e5e7eb; white-space: nowrap;">
                      ${col.label}
                      ${col.summary ? '<span style="color: #667eea; font-size: 11px;"> ∑</span>' : ''}
                    </th>
                  `).join('')}
                </tr>
              </thead>
              <tbody>
                ${[1, 2, 3].map(_ => `
                  <tr style="border-bottom: 1px solid #e5e7eb;">
                    ${section.columns.map(col => `
                      <td style="padding: 12px 16px; text-align: ${col.format?.alignment || 'left'}; font-size: 13px; color: #6b7280; border-right: 1px solid #f3f4f6; background: ${col.format?.bgColor || 'transparent'};">
                        ${this.generateSampleValue(col)}
                      </td>
                    `).join('')}
                  </tr>
                `).join('')}
                ${section.columns.some(c => c.summary) ? `
                  <tr style="background: #f9fafb; border-top: 2px solid #667eea; font-weight: 600;">
                    ${section.columns.map(col => `
                      <td style="padding: 12px 16px; text-align: ${col.format?.alignment || 'left'}; font-size: 13px; color: #374151; border-right: 1px solid #e5e7eb; background: ${col.summaryFormat?.bgColor || '#f9fafb'};">
                        ${col.summary ? `<strong>${this.currentTemplate?.summaryLabel || 'Total'}: ${this.generateSampleValue(col)}</strong>` : ''}
                      </td>
                    `).join('')}
                  </tr>
                ` : ''}
              </tbody>
            </table>
          </div>
        </div>
      `;
    });

    html += '</div>';
    return html;
  }

  /**
   * Gera valores de exemplo para preview
   */
  private generateSampleValue(column: AccrualSheetColumnDescriptor): string {
    switch (column.type) {
      case 'date':
        return '31/12/2025';
      case 'number':
        const decimals = column.decimals ?? 2;
        if (column.label.toLowerCase().includes('taxa') || column.label.toLowerCase().includes('rate')) {
          return (Math.random() * 0.1).toFixed(decimals);
        }
        if (column.label.toLowerCase().includes('dias') || column.label.toLowerCase().includes('days')) {
          return Math.floor(Math.random() * 30).toString();
        }
        return (Math.random() * 100000).toFixed(decimals);
      case 'string':
      default:
        return 'Exemplo';
    }
  }

  /**
   * Fecha e limpa o modal
   */
  public dispose(): void {
    this.modalElement?.remove();
    this.modalElement = null;
    this.currentTemplate = null;
    this.onSave = null;
  }
}
