/**
 * Data Source Settings Routes
 *
 * API endpoints for managing data source configurations:
 * - Get/update active data source
 * - Configure API keys for providers
 * - Check connection status
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from './authMiddleware';
import { getDataSourceSettingsDAO, DataSourceSettings, ConnectionStatus } from '../database/data-source-settings.dao';
import { getDataSourceManager } from '../datasource/DataSourceManager';
import { DataSourceStatus } from '../datasource/types';
import { MockDataProvider } from '../datasource/providers/MockDataProvider';
import { AlpacaDataProvider } from '../datasource/providers/AlpacaDataProvider';
import { TwelveDataProvider } from '../datasource/providers/TwelveDataProvider';
import { createLogger } from '../utils/logger';

const log = createLogger('DataSourceRoutes');

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /api/data-source/settings
 * Get current data source settings for the authenticated user
 */
router.get('/settings', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const dao = getDataSourceSettingsDAO();
    const settings = await dao.getSettings(userId);

    // Mask sensitive data
    const maskedSettings = {
      ...settings,
      alpacaApiKey: settings?.alpacaApiKey ? `${settings.alpacaApiKey.slice(0, 4)}***` : undefined,
      alpacaApiSecret: settings?.alpacaApiSecret ? '***' : undefined,
      twelvedataApiKey: settings?.twelvedataApiKey ? `${settings.twelvedataApiKey.slice(0, 4)}***` : undefined,
    };

    res.json({ settings: maskedSettings });
  } catch (error) {
    log.error('Error getting data source settings:', error);
    res.status(500).json({ error: 'Failed to get data source settings' });
  }
});

/**
 * PUT /api/data-source/settings
 * Update data source settings
 */
router.put('/settings', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const updates: Partial<DataSourceSettings> = req.body;
    
    // Validate active provider
    if (updates.activeProvider && !['mock', 'alpaca', 'twelvedata'].includes(updates.activeProvider)) {
      return res.status(400).json({ error: 'Invalid provider. Must be mock, alpaca, or twelvedata' });
    }

    const dao = getDataSourceSettingsDAO();
    const settings = await dao.updateSettings(userId, updates);

    // Mask sensitive data in response
    const maskedSettings = {
      ...settings,
      alpacaApiKey: settings.alpacaApiKey ? `${settings.alpacaApiKey.slice(0, 4)}***` : undefined,
      alpacaApiSecret: settings.alpacaApiSecret ? '***' : undefined,
      twelvedataApiKey: settings.twelvedataApiKey ? `${settings.twelvedataApiKey.slice(0, 4)}***` : undefined,
    };

    res.json({ settings: maskedSettings });
  } catch (error) {
    log.error('Error updating data source settings:', error);
    res.status(500).json({ error: 'Failed to update data source settings' });
  }
});

/**
 * POST /api/data-source/provider
 * Switch to a different data source provider
 */
router.post('/provider', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { providerId } = req.body;
    
    if (!providerId || !['mock', 'alpaca', 'twelvedata'].includes(providerId)) {
      return res.status(400).json({ error: 'Invalid provider. Must be mock, alpaca, or twelvedata' });
    }

    const dao = getDataSourceSettingsDAO();
    const settings = await dao.getSettings(userId);

    // Check if required credentials are available
    if (providerId === 'alpaca' && (!settings?.alpacaApiKey || !settings?.alpacaApiSecret)) {
      return res.status(400).json({ 
        error: 'Alpaca API credentials not configured. Please set up your API key and secret first.' 
      });
    }

    if (providerId === 'twelvedata' && !settings?.twelvedataApiKey) {
      return res.status(400).json({ 
        error: 'Twelve Data API key not configured. Please set up your API key first.' 
      });
    }

    // Update active provider
    await dao.setActiveProvider(userId, providerId);

    // Initialize the provider
    const manager = getDataSourceManager();
    let provider = await manager.getProvider(providerId, false);

    if (!provider) {
      // Create provider instance
      switch (providerId) {
        case 'mock':
          provider = new MockDataProvider();
          break;
        case 'alpaca':
          provider = new AlpacaDataProvider();
          break;
        case 'twelvedata':
          provider = new TwelveDataProvider();
          break;
      }

      if (provider) {
        const config = dao.toDataSourceConfig(settings!, providerId);
        manager.registerProvider(provider, config);
      }
    }

    // Switch to the provider
    await manager.setActiveProvider(providerId, true);

    res.json({ 
      success: true, 
      activeProvider: providerId,
      message: `Successfully switched to ${providerId} data source`
    });
  } catch (error) {
    log.error('Error switching data source:', error);
    res.status(500).json({ error: 'Failed to switch data source' });
  }
});

/**
 * POST /api/data-source/credentials/alpaca
 * Save Alpaca API credentials
 */
router.post('/credentials/alpaca', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { apiKey, apiSecret, testnet = true } = req.body;

    if (!apiKey || !apiSecret) {
      return res.status(400).json({ error: 'API key and secret are required' });
    }

    // Validate API key format (Alpaca keys are typically 32 characters)
    if (apiKey.length < 20 || apiSecret.length < 20) {
      return res.status(400).json({ error: 'Invalid API key format' });
    }

    const dao = getDataSourceSettingsDAO();
    await dao.saveAlpacaCredentials(userId, apiKey, apiSecret, testnet);

    res.json({ 
      success: true, 
      message: 'Alpaca credentials saved successfully' 
    });
  } catch (error) {
    log.error('Error saving Alpaca credentials:', error);
    res.status(500).json({ error: 'Failed to save Alpaca credentials' });
  }
});

/**
 * POST /api/data-source/credentials/twelvedata
 * Save Twelve Data API key
 */
router.post('/credentials/twelvedata', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { apiKey } = req.body;

    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required' });
    }

    const dao = getDataSourceSettingsDAO();
    await dao.saveTwelveDataCredentials(userId, apiKey);

    res.json({ 
      success: true, 
      message: 'Twelve Data credentials saved successfully' 
    });
  } catch (error) {
    log.error('Error saving Twelve Data credentials:', error);
    res.status(500).json({ error: 'Failed to save Twelve Data credentials' });
  }
});

/**
 * DELETE /api/data-source/credentials/:providerId
 * Clear credentials for a provider
 */
router.delete('/credentials/:providerId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { providerId } = req.params;
    const provider = Array.isArray(providerId) ? providerId[0] : providerId;
    
    if (!provider || !['alpaca', 'twelvedata'].includes(provider)) {
      return res.status(400).json({ error: 'Invalid provider' });
    }

    const dao = getDataSourceSettingsDAO();
    await dao.clearCredentials(userId, provider);

    res.json({ 
      success: true, 
      message: `${providerId} credentials cleared` 
    });
  } catch (error) {
    log.error('Error clearing credentials:', error);
    res.status(500).json({ error: 'Failed to clear credentials' });
  }
});

/**
 * GET /api/data-source/status
 * Get connection status for all providers
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const dao = getDataSourceSettingsDAO();
    const settings = await dao.getSettings(userId);
    const manager = getDataSourceManager();

    const statusMap: Record<string, ConnectionStatus> = {
      mock: {
        providerId: 'mock',
        status: 'connected',
        apiCallCount: 0,
      },
      alpaca: {
        providerId: 'alpaca',
        status: settings?.alpacaApiKey ? 'disconnected' : 'disconnected',
      },
      twelvedata: {
        providerId: 'twelvedata',
        status: settings?.twelvedataApiKey ? 'disconnected' : 'disconnected',
      },
    };

    // Check actual provider status
    const activeProviderId = manager.getActiveProviderId();
    if (activeProviderId) {
      const activeProvider = manager.getActiveProvider();
      if (activeProvider) {
        const providerStatus = activeProvider.status;
        const currentStatus = statusMap[activeProviderId];
        if (currentStatus) {
          statusMap[activeProviderId] = {
            ...currentStatus,
            status: mapStatus(providerStatus),
            lastConnected: providerStatus === DataSourceStatus.CONNECTED ? new Date() : undefined,
          };
        }
      }
    }

    res.json({ 
      activeProvider: settings?.activeProvider || 'mock',
      providers: statusMap
    });
  } catch (error) {
    log.error('Error getting connection status:', error);
    res.status(500).json({ error: 'Failed to get connection status' });
  }
});

/**
 * POST /api/data-source/test-connection
 * Test connection to a provider
 */
router.post('/test-connection', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { providerId } = req.body;
    
    if (!providerId || !['mock', 'alpaca', 'twelvedata'].includes(providerId)) {
      return res.status(400).json({ error: 'Invalid provider' });
    }

    const dao = getDataSourceSettingsDAO();
    const settings = await dao.getSettings(userId);

    // Check credentials
    if (providerId === 'alpaca' && (!settings?.alpacaApiKey || !settings?.alpacaApiSecret)) {
      return res.status(400).json({ 
        success: false,
        error: 'Alpaca credentials not configured' 
      });
    }

    if (providerId === 'twelvedata' && !settings?.twelvedataApiKey) {
      return res.status(400).json({ 
        success: false,
        error: 'Twelve Data credentials not configured' 
      });
    }

    // Create a test provider instance
    let testProvider;
    switch (providerId) {
      case 'mock':
        testProvider = new MockDataProvider();
        break;
      case 'alpaca':
        testProvider = new AlpacaDataProvider();
        break;
      case 'twelvedata':
        testProvider = new TwelveDataProvider();
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid provider'
        });
    }

    if (!testProvider) {
      return res.status(400).json({
        success: false,
        error: 'Failed to create provider instance'
      });
    }

    // Try to connect
    const config = dao.toDataSourceConfig(settings!, providerId);
    await testProvider.connect(config);

    // Try to fetch a quote to verify connection
    await testProvider.getQuote('AAPL');

    // Disconnect after test
    await testProvider.disconnect();

    res.json({ 
      success: true, 
      message: `Successfully connected to ${providerId}` 
    });
  } catch (error: any) {
    log.error('Error testing connection:', error);
    res.status(400).json({ 
      success: false, 
      error: error.message || 'Connection test failed' 
    });
  }
});

/**
 * Map DataSourceStatus to connection status string
 */
function mapStatus(status: DataSourceStatus): 'connected' | 'disconnected' | 'error' | 'connecting' {
  switch (status) {
    case DataSourceStatus.CONNECTED:
      return 'connected';
    case DataSourceStatus.CONNECTING:
      return 'connecting';
    case DataSourceStatus.RECONNECTING:
      return 'connecting';
    case DataSourceStatus.ERROR:
      return 'error';
    case DataSourceStatus.DISCONNECTED:
    default:
      return 'disconnected';
  }
}

export { router as dataSourceRoutes };