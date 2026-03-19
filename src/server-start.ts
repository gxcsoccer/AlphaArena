/**
 * AlphaArena Server Startup Script
 * 
 * This is the entry point for production deployment (Railway, etc.)
 * Starts the API server and keeps it running.
 */

import { APIServer } from './api/server';
import { getPriceAlertMonitor } from './monitoring/PriceAlertMonitor';
import { PaperTradingEngine } from './services/PaperTradingEngine';

// Get port from environment variable or use default
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

console.log(`[Startup] Starting AlphaArena API server on port ${PORT}...`);

const server = new APIServer({
  port: PORT,
  corsOrigin: [
    'https://alphaarena-production.up.railway.app',
    'https://alphaarena.vercel.app',
    'https://alphaarena-eight.vercel.app',
    'https://alphaarena-hymr9xflt-gxcsoccer-s-team.vercel.app',
    'https://*.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173',
  ],
});

server.start()
  .then(async () => {
    console.log(`[Startup] Server is running on port ${PORT}`);
    console.log(`[Startup] Health check: http://localhost:${PORT}/health`);
    
    // Start price alert monitor
    const alertMonitor = getPriceAlertMonitor({
      checkIntervalMs: parseInt(process.env.PRICE_ALERT_CHECK_INTERVAL || '5000'),
    });
    alertMonitor.start();
    console.log('[Startup] Price alert monitor started');
    
    // Start paper trading engine
    try {
      const tradingEngine = PaperTradingEngine.getInstance({
        feeConfig: {
          commission: 0.0003,      // 0.03%
          minCommission: 5,        // $5 minimum
          stamp: 0.001,            // 0.1% (sell only)
          transfer: 0.00001,       // 0.001%
        },
        priceCheckIntervalMs: 1000,
      });
      await tradingEngine.start();
      console.log('[Startup] Paper trading engine started');
    } catch (error) {
      console.error('[Startup] Error starting paper trading engine:', error);
    }
  })
  .catch((error) => {
    console.error('[Startup] Failed to start server:', error);
    process.exit(1);
  });

// Handle graceful shutdown
const gracefulShutdown = async (signal: string) => {
  console.log(`[Startup] ${signal} received, shutting down gracefully...`);
  
  // Stop paper trading engine
  try {
    const tradingEngine = PaperTradingEngine.getInstance();
    tradingEngine.stop();
    console.log('[Startup] Paper trading engine stopped');
  } catch (error) {
    console.error('[Startup] Error stopping trading engine:', error);
  }
  
  // Stop price alert monitor
  try {
    const alertMonitor = getPriceAlertMonitor();
    alertMonitor.stop();
    console.log('[Startup] Price alert monitor stopped');
  } catch (error) {
    console.error('[Startup] Error stopping alert monitor:', error);
  }
  
  // Stop server
  try {
    await server.stop();
    console.log('[Startup] Server closed');
    process.exit(0);
  } catch (error) {
    console.error('[Startup] Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
