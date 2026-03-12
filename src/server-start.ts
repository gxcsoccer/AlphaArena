/**
 * AlphaArena Server Startup Script
 * 
 * This is the entry point for production deployment (Railway, etc.)
 * Starts the API server and keeps it running.
 */

import { APIServer } from './api/server';

// Get port from environment variable or use default
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

console.log(`[Startup] Starting AlphaArena API server on port ${PORT}...`);

const server = new APIServer({
  port: PORT,
  corsOrigin: [
    'https://alphaarena-production.up.railway.app',
    'https://*.vercel.app',
    'https://alpha-arena-*.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173',
  ],
});

server.start()
  .then(() => {
    console.log(`[Startup] Server is running on port ${PORT}`);
    console.log(`[Startup] Health check: http://localhost:${PORT}/health`);
  })
  .catch((error) => {
    console.error('[Startup] Failed to start server:', error);
    process.exit(1);
  });

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Startup] SIGTERM received, shutting down gracefully...');
  server.stop()
    .then(() => {
      console.log('[Startup] Server closed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[Startup] Error during shutdown:', error);
      process.exit(1);
    });
});

process.on('SIGINT', () => {
  console.log('[Startup] SIGINT received, shutting down gracefully...');
  server.stop()
    .then(() => {
      console.log('[Startup] Server closed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[Startup] Error during shutdown:', error);
      process.exit(1);
    });
});
