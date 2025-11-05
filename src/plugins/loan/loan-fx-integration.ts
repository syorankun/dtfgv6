/**
 * Loan FX Integration - Integração com FX Finance Plugin
 *
 * Gerencia a integração com o FX Finance Plugin para obter taxas de câmbio
 * e sincronizar dados PTAX.
 */

import type { PluginContext } from '@core/types';
import { logger } from '@core/storage-utils-consolidated';

export type CurrencyCode = string;

export interface FXRateResult {
  rate: number;
  source: string;
}

export interface FXPluginAPI {
  getRate(date: string, currency: CurrencyCode, source?: 'PTAX' | 'MANUAL' | 'AUTO'): Promise<number | null>;
  syncPTAX?(startDate: string, endDate: string, currencies: CurrencyCode[]): Promise<void>;
}

/**
 * Gerencia a integração com o FX Finance Plugin.
 * Abstrai a complexidade de obter taxas de câmbio e sincronizar dados.
 */
export class LoanFXIntegration {
  private fxPlugin: FXPluginAPI | null = null;
  private context: PluginContext | null = null;
  // Evita sincronizações repetidas para a mesma chave (moeda|data)
  private attemptedSync: Set<string> = new Set();

  constructor(context?: PluginContext) {
    this.context = context || null;
  }

  /**
   * Tenta se conectar ao FX Plugin, com fallback para versões mais antigas.
   * Armazena a capability do plugin para uso posterior.
   */
  public async connectFXPlugin(): Promise<boolean> {
    console.log(`🔌 [LoanFXIntegration] Tentando conectar ao FX Plugin...`);
    
    if (!this.context) {
      console.error(`❌ [LoanFXIntegration] Context não fornecido`);
      logger.warn('[LoanFXIntegration] Context não fornecido, FX Plugin não disponível');
      return false;
    }

    console.log(`🔎 [LoanFXIntegration] Context disponível, verificando kernel...`);
    console.log(`   → Kernel existe:`, !!this.context.kernel);
    console.log(`   → getCapability existe:`, typeof (this.context.kernel as any).getCapability);

    try {
      console.log(`🔎 [LoanFXIntegration] Tentando obter capability 'dj.fx.rates@3'...`);
      // Tenta obter a versão 3 (mais recente)
      const capability = this.context.kernel.getCapability?.('dj.fx.rates@3');
      console.log(`   → Capability v3 retornada:`, !!capability);
      if (capability) {
        this.fxPlugin = capability as FXPluginAPI;
        console.log(`✅ [LoanFXIntegration] Conectado ao FX Plugin v3`);
        console.log(`   → API disponível:`, {
          getRate: typeof this.fxPlugin.getRate,
          syncPTAX: typeof this.fxPlugin.syncPTAX
        });
        logger.info('[LoanFXIntegration] ✓ Conectado ao FX Plugin v3');
        return true;
      }
    } catch (error) {
      console.error(`❌ [LoanFXIntegration] Erro ao conectar FX Plugin v3:`, error);
      logger.warn('[LoanFXIntegration] Erro ao conectar FX Plugin v3:', error);
    }

    try {
      console.log(`🔎 [LoanFXIntegration] Tentando obter capability 'dj.fx.rates@1'...`);
      // Se falhar, tenta a versão 1 (fallback)
      const capability = this.context.kernel.getCapability?.('dj.fx.rates@1');
      console.log(`   → Capability v1 retornada:`, !!capability);
      if (capability) {
        this.fxPlugin = capability as FXPluginAPI;
        console.log(`✅ [LoanFXIntegration] Conectado ao FX Plugin v1 (fallback)`);
        console.log(`   → API disponível:`, {
          getRate: typeof this.fxPlugin.getRate,
          syncPTAX: typeof this.fxPlugin.syncPTAX
        });
        logger.info('[LoanFXIntegration] ✓ Conectado ao FX Plugin v1 (fallback)');
        return true;
      }
    } catch (error) {
      console.error(`❌ [LoanFXIntegration] Erro ao conectar FX Plugin v1:`, error);
      logger.warn('[LoanFXIntegration] Erro ao conectar FX Plugin v1:', error);
    }

    console.error(`❌ [LoanFXIntegration] FX Plugin NÃO DISPONÍVEL em nenhuma versão`);
    logger.warn('[LoanFXIntegration] ⚠️ FX Plugin não disponível. Taxas manuais ou contrato serão usadas.');
    this.fxPlugin = null;
    return false;
  }

  /**
   * Obtém a taxa de câmbio para uma determinada data e moeda.
   * Segue uma estratégia de fallback: PTAX do contrato, taxa manual, PTAX do BCB.
   * @param date A data para a qual a taxa é necessária ('YYYY-MM-DD').
   * @param currency A moeda de origem.
   * @param contractFXRate A taxa PTAX opcional fixada no contrato.
   * @returns A taxa de câmbio ou null se nenhuma for encontrada.
   */
  public async getConversionRate(
    date: string,
    currency: CurrencyCode,
    contractFXRate?: number
  ): Promise<FXRateResult | null> {
    // BRL não precisa conversão
    if (currency === 'BRL') {
      return { rate: 1, source: 'BRL' };
    }

    // 1. Prioridade: PTAX do Contrato (se informado)
    if (contractFXRate && contractFXRate > 0) {
      return { rate: contractFXRate, source: 'Contrato' };
    }

    // Se FX plugin indisponível, tenta conectar e seguir; se ainda assim indisponível, retorna null
    if (!this.fxPlugin) {
      await this.connectFXPlugin();
      if (!this.fxPlugin) {
        logger.debug('[LoanFXIntegration] FX Plugin não disponível, usando fallback');
        return null;
      }
    }

    try {
      logger.debug(`[LoanFXIntegration] Buscando taxa: ${currency} em ${date}`);
      
      // 2. Busca por taxa MANUAL inserida no FX Plugin para a data
      const manualRate = await this.fxPlugin.getRate(date, currency, 'MANUAL');
      if (manualRate && manualRate > 0) {
        logger.info(`[LoanFXIntegration] ✓ Taxa MANUAL encontrada: ${currency} ${manualRate} em ${date}`);
        return { rate: manualRate, source: 'Manual' };
      }

      // 3. Busca por PTAX (BCB) no FX Plugin para a data
      const ptaxRate = await this.fxPlugin.getRate(date, currency, 'PTAX');
      if (ptaxRate && ptaxRate > 0) {
        logger.info(`[LoanFXIntegration] ✓ Taxa PTAX encontrada: ${currency} ${ptaxRate} em ${date}`);
        return { rate: ptaxRate, source: 'PTAX (BCB)' };
      }

      // 4. Tenta AUTO (fallback do próprio FX Plugin)
      const autoRate = await this.fxPlugin.getRate(date, currency, 'AUTO');
      if (autoRate && autoRate > 0) {
        logger.info(`[LoanFXIntegration] ✓ Taxa AUTO encontrada: ${currency} ${autoRate} em ${date}`);
        return { rate: autoRate, source: 'AUTO' };
      }

      // 5. Nenhuma taxa: tenta sincronizar automaticamente PTAX para a data/período
      const key = `${currency}|${date}`;
      if (!this.attemptedSync.has(key)) {
        this.attemptedSync.add(key);
        const startDate = date;
        const endDate = date;
        try {
          await this.syncPTAX(startDate, endDate, [currency]);
          // Tenta novamente após sincronizar
          const syncedRate = await this.fxPlugin.getRate(date, currency, 'PTAX');
          if (syncedRate && syncedRate > 0) {
            logger.info(`[LoanFXIntegration] ✓ PTAX sincronizada sob demanda: ${currency} ${syncedRate} em ${date}`);
            return { rate: syncedRate, source: 'PTAX (BCB)' };
          }
        } catch (syncErr) {
          logger.warn('[LoanFXIntegration] Falha ao sincronizar PTAX sob demanda', syncErr);
        }
      }

      // 6. Se nada for encontrado
      logger.warn(`[LoanFXIntegration] ⚠️ Nenhuma taxa encontrada para ${currency} em ${date}`);
      return null;

    } catch (error) {
      logger.error('[LoanFXIntegration] Erro ao buscar taxa no FX Plugin:', error);
      return null;
    }
  }

  /**
   * Delega a sincronização de taxas PTAX para o FX Plugin.
   * @param startDate Data de início do período de sincronização.
   * @param endDate Data de fim do período.
   * @param currencies Lista de moedas para sincronizar.
   */
  public async syncPTAX(startDate: string, endDate: string, currencies: CurrencyCode[]): Promise<void> {
    if (!this.fxPlugin) {
      if (this.context) {
        this.context.ui.showToast?.('FX Plugin não está disponível para sincronizar taxas PTAX.', 'error');
      }
      return;
    }

    try {
      if (this.fxPlugin.syncPTAX) {
        await this.fxPlugin.syncPTAX(startDate, endDate, currencies);
        if (this.context) {
          this.context.ui.showToast?.('Taxas PTAX sincronizadas com sucesso!', 'success');
        }
      } else {
        logger.warn('[LoanFXIntegration] FX Plugin não possui método syncPTAX');
        if (this.context) {
          this.context.ui.showToast?.('Versão do FX Plugin não suporta sincronização automática.', 'warning');
        }
      }
    } catch (error) {
      logger.error('[LoanFXIntegration] Erro ao sincronizar PTAX:', error);
      if (this.context) {
        this.context.ui.showToast?.('Ocorreu um erro ao sincronizar as taxas PTAX.', 'error');
      }
    }
  }

  /**
   * Obtém a taxa mais recente disponível para uma moeda.
   * Útil quando a data exata não tem taxa cadastrada.
   */
  public async getLastAvailableRate(currency: CurrencyCode): Promise<FXRateResult | null> {
    if (currency === 'BRL') {
      return { rate: 1, source: 'BRL' };
    }

    if (!this.fxPlugin) {
      return null;
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const rate = await this.fxPlugin.getRate(today, currency, 'AUTO');

      if (rate) {
        return { rate, source: 'Última disponível' };
      }

      return null;
    } catch (error) {
      logger.error('[LoanFXIntegration] Erro ao buscar última taxa disponível:', error);
      return null;
    }
  }

  /**
   * Verifica se o FX Plugin está disponível.
   */
  public isAvailable(): boolean {
    return this.fxPlugin !== null;
  }
}
