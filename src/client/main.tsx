import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from '@arco-design/web-react';
import '@arco-design/web-react/dist/css/arco.min.css';
import zhCN from '@arco-design/web-react/es/locale/zh-CN';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { validateConfig, logConfigStatus } from './utils/config';
import './index.css';

// Validate configuration before rendering
const config = validateConfig();
logConfigStatus(config);

if (!config.isConfigured) {
  console.error('[AlphaArena] Critical: Missing required environment variables!');
  console.error('[AlphaArena] Missing:', config.missingVars.join(', '));
  console.error('[AlphaArena] The application may not function correctly.');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN}>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </ConfigProvider>
  </React.StrictMode>
);
