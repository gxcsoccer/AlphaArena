/**
 * Data Source Settings DAO
 *
 * Manages user-specific data source configurations including:
 * - Active data source selection
 * - API keys for various providers
 * - Connection status tracking
 */

import { createClient } from '@supabase/supabase-js';
import { DataSourceConfig } from '../datasource/types';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

interface DataSourceSettingsRecord {
  id: string;
  user_id: string;
  active_provider: string;
  alpaca_api_key?: string;
  alpaca_api_secret?: string;
  alpaca_testnet: boolean;
  twelvedata_api_key?: string;
  mock_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface DataSourceSettings {
  activeProvider: string;
  alpacaApiKey?: string;
  alpacaApiSecret?: string;
  alpacaTestnet: boolean;
  twelvedataApiKey?: string;
  mockEnabled: boolean;
}

export interface ConnectionStatus {
  providerId: string;
  status: 'connected' | 'disconnected' | 'error' | 'connecting';
  lastConnected?: Date;
  errorMessage?: string;
  apiCallCount?: number;
}

/**
 * Data Source Settings DAO
 */
export class DataSourceSettingsDAO {
  private supabase;

  constructor() {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Get data source settings for a user
   */
  async getSettings(userId: string): Promise<DataSourceSettings | null> {
    const { data, error } = await this.supabase
      .from('data_source_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No settings found, return defaults
        return {
          activeProvider: 'mock',
          alpacaTestnet: true,
          mockEnabled: true,
        };
      }
      console.error('Error fetching data source settings:', error);
      throw error;
    }

    return this.recordToSettings(data as DataSourceSettingsRecord);
  }

  /**
   * Update data source settings for a user
   */
  async updateSettings(userId: string, settings: Partial<DataSourceSettings>): Promise<DataSourceSettings> {
    // Check if settings exist
    const existing = await this.getSettings(userId);
    
    // Merge with defaults to ensure all required fields exist
    const mergedSettings: DataSourceSettings = {
      activeProvider: existing?.activeProvider || settings.activeProvider || 'mock',
      alpacaTestnet: existing?.alpacaTestnet ?? settings.alpacaTestnet ?? true,
      mockEnabled: existing?.mockEnabled ?? settings.mockEnabled ?? true,
      alpacaApiKey: settings.alpacaApiKey ?? existing?.alpacaApiKey,
      alpacaApiSecret: settings.alpacaApiSecret ?? existing?.alpacaApiSecret,
      twelvedataApiKey: settings.twelvedataApiKey ?? existing?.twelvedataApiKey,
    };

    const record = this.settingsToRecord(userId, mergedSettings);

    const { data, error } = await this.supabase
      .from('data_source_settings')
      .upsert({
        user_id: userId,
        ...record,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })
      .select()
      .single();

    if (error) {
      console.error('Error updating data source settings:', error);
      throw error;
    }

    return this.recordToSettings(data as DataSourceSettingsRecord);
  }

  /**
   * Set active provider
   */
  async setActiveProvider(userId: string, providerId: string): Promise<void> {
    await this.updateSettings(userId, { activeProvider: providerId });
  }

  /**
   * Get active provider for a user
   */
  async getActiveProvider(userId: string): Promise<string> {
    const settings = await this.getSettings(userId);
    return settings?.activeProvider || 'mock';
  }

  /**
   * Save Alpaca API credentials
   */
  async saveAlpacaCredentials(
    userId: string,
    apiKey: string,
    apiSecret: string,
    testnet: boolean = true
  ): Promise<void> {
    await this.updateSettings(userId, {
      alpacaApiKey: apiKey,
      alpacaApiSecret: apiSecret,
      alpacaTestnet: testnet,
    });
  }

  /**
   * Save Twelve Data API key
   */
  async saveTwelveDataCredentials(userId: string, apiKey: string): Promise<void> {
    await this.updateSettings(userId, {
      twelvedataApiKey: apiKey,
    });
  }

  /**
   * Clear API credentials for a provider
   */
  async clearCredentials(userId: string, providerId: string): Promise<void> {
    const updates: Partial<DataSourceSettings> = {};
    
    switch (providerId) {
      case 'alpaca':
        updates.alpacaApiKey = undefined;
        updates.alpacaApiSecret = undefined;
        break;
      case 'twelvedata':
        updates.twelvedataApiKey = undefined;
        break;
    }

    await this.updateSettings(userId, updates);
  }

  /**
   * Convert database record to settings object
   */
  private recordToSettings(record: DataSourceSettingsRecord): DataSourceSettings {
    return {
      activeProvider: record.active_provider || 'mock',
      alpacaApiKey: record.alpaca_api_key,
      alpacaApiSecret: record.alpaca_api_secret,
      alpacaTestnet: record.alpaca_testnet ?? true,
      twelvedataApiKey: record.twelvedata_api_key,
      mockEnabled: record.mock_enabled ?? true,
    };
  }

  /**
   * Convert settings object to database record
   */
  private settingsToRecord(userId: string, settings: DataSourceSettings): Record<string, unknown> {
    return {
      user_id: userId,
      active_provider: settings.activeProvider,
      alpaca_api_key: settings.alpacaApiKey || null,
      alpaca_api_secret: settings.alpacaApiSecret || null,
      alpaca_testnet: settings.alpacaTestnet,
      twelvedata_api_key: settings.twelvedataApiKey || null,
      mock_enabled: settings.mockEnabled,
    };
  }

  /**
   * Convert settings to DataSourceConfig
   */
  toDataSourceConfig(settings: DataSourceSettings, providerId: string): DataSourceConfig {
    const config: DataSourceConfig = {
      providerId,
    };

    switch (providerId) {
      case 'alpaca':
        config.apiKey = settings.alpacaApiKey;
        config.apiSecret = settings.alpacaApiSecret;
        config.testnet = settings.alpacaTestnet;
        break;
      case 'twelvedata':
        config.apiKey = settings.twelvedataApiKey;
        break;
      case 'mock':
        // Mock doesn't need credentials
        break;
    }

    return config;
  }
}

// Singleton instance
let dataSourceSettingsDAO: DataSourceSettingsDAO | null = null;

export function getDataSourceSettingsDAO(): DataSourceSettingsDAO {
  if (!dataSourceSettingsDAO) {
    dataSourceSettingsDAO = new DataSourceSettingsDAO();
  }
  return dataSourceSettingsDAO;
}