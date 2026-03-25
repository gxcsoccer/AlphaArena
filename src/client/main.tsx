import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { validateConfig, logConfigStatus } from './utils/config';
import ToastContainer from './components/Toast';
import { initCriticalPreloading } from './utils/resourcePreload';
import { registerServiceWorker } from './utils/serviceWorker';

// i18n - Initialize internationalization (Issue #584)
import { LocaleProvider } from './i18n/LocaleProvider';

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

// Global error handler for uncaught errors
window.addEventListener('error', (event) => {
  console.error('[AlphaArena] Uncaught error:', event.error);
  // Store error for debugging
  try {
    sessionStorage.setItem('lastError', JSON.stringify({
      message: event.error?.message || 'Unknown error',
      stack: event.error?.stack,
      timestamp: Date.now(),
      url: window.location.href,
    }));
  } catch {
    // Ignore storage errors
  }
});

// Global handler for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('[AlphaArena] Unhandled rejection:', event.reason);
  // Store error for debugging
  try {
    sessionStorage.setItem('lastError', JSON.stringify({
      message: event.reason?.message || 'Unhandled promise rejection',
      stack: event.reason?.stack,
      timestamp: Date.now(),
      url: window.location.href,
    }));
  } catch {
    // Ignore storage errors
  }
});

// Render the app with error handling
const rootElement = document.getElementById('root');

if (!rootElement) {
  // This should never happen, but just in case
  document.body.innerHTML = `
    <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 100vh; background: #18181c; color: #e5e6eb; font-family: sans-serif; text-align: center; padding: 20px;">
      <h2 style="color: #ff5252; margin-bottom: 16px;">页面加载错误</h2>
      <p style="color: #b9b9bd; margin-bottom: 24px;">无法找到页面根元素</p>
      <button onclick="location.reload()" style="padding: 12px 24px; background: #3c82ff; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px;">刷新页面</button>
    </div>
  `;
} else {
  try {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <LocaleProvider>
          <ErrorBoundary>
            <App />
            <ToastContainer />
          </ErrorBoundary>
        </LocaleProvider>
      </React.StrictMode>
    );
  } catch (error) {
    console.error('[AlphaArena] Failed to render app:', error);
    // Show error UI if render fails
    rootElement.innerHTML = `
      <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 100vh; background: #18181c; color: #e5e6eb; font-family: sans-serif; text-align: center; padding: 20px;">
        <h2 style="color: #ff5252; margin-bottom: 16px;">页面渲染失败</h2>
        <p style="color: #b9b9bd; margin-bottom: 24px;">应用遇到了一个错误，请尝试刷新页面</p>
        <button onclick="location.reload()" style="padding: 12px 24px; background: #3c82ff; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px;">刷新页面</button>
        <p style="margin-top: 16px; font-size: 12px; color: #7d7d85;">错误信息: ${error instanceof Error ? error.message : '未知错误'}</p>
      </div>
    `;
  }
}
