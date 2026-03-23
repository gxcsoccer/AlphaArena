import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from '@arco-design/web-react';
import zhCN from '@arco-design/web-react/es/locale/zh-CN';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { validateConfig, logConfigStatus } from './utils/config';
import ToastContainer from './components/Toast';
import { initCriticalPreloading } from './utils/resourcePreload';
import { registerServiceWorker } from './utils/serviceWorker';

// i18n - Initialize internationalization (Issue #584)
import './i18n';

// Design System - Import design tokens BEFORE Arco CSS
import './styles/design-tokens.css';
// Arco Design CSS
import '@arco-design/web-react/dist/css/arco.min.css';
// Arco Design theme overrides
import './styles/arco-theme.css';
// Global styles and overrides
import './index.css';
import './styles/ux-improvements.css'; // Issue #514: UX 改进样式
import './styles/visual-optimization.css'; // Issue #573: 视觉优化样式
import './styles/touch-feedback.css'; // Touch feedback utilities
import './styles/interaction-enhancements.css'; // Issue #571: 交互体验优化

// Initialize critical resource preloading for better performance
initCriticalPreloading();

// Register service worker for caching (Issue #559)
if (import.meta.env.PROD) {
  registerServiceWorker().catch(console.error);
}

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
        <ToastContainer />
      </ErrorBoundary>
    </ConfigProvider>
  </React.StrictMode>
);
