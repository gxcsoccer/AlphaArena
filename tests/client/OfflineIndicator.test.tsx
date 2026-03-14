/**
 * OfflineIndicator Component Tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import OfflineIndicator from '../../src/client/components/OfflineIndicator';
import { ConnectionProvider } from '../../src/client/store/connectionStore';

const renderWithProvider = (component: React.ReactElement) => {
  return render(
    <ConnectionProvider>
      {component}
    </ConnectionProvider>
  );
};

describe('OfflineIndicator', () => {
  it('should not render when connected and online', () => {
    const TestComponent = () => {
      const { setStatus, setOnline } = require('../../src/client/store/connectionStore').useConnection();
      React.useEffect(() => {
        setStatus('connected');
        setOnline(true);
      }, [setStatus, setOnline]);
      return <OfflineIndicator />;
    };

    renderWithProvider(<TestComponent />);
    
    // Should not show any alert
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('should render when disconnected', () => {
    const TestComponent = () => {
      const { setStatus } = require('../../src/client/store/connectionStore').useConnection();
      React.useEffect(() => {
        setStatus('disconnected');
      }, [setStatus]);
      return <OfflineIndicator />;
    };

    renderWithProvider(<TestComponent />);
    
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('should render when reconnecting', () => {
    const TestComponent = () => {
      const { setStatus } = require('../../src/client/store/connectionStore').useConnection();
      React.useEffect(() => {
        setStatus('reconnecting');
      }, [setStatus]);
      return <OfflineIndicator />;
    };

    renderWithProvider(<TestComponent />);
    
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent('重连中');
  });

  it('should show offline message when network is offline', () => {
    const TestComponent = () => {
      const { setOnline } = require('../../src/client/store/connectionStore').useConnection();
      React.useEffect(() => {
        setOnline(false);
      }, [setOnline]);
      return <OfflineIndicator />;
    };

    renderWithProvider(<TestComponent />);
    
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('网络已断开');
  });

  it('should show reconnect attempt count', () => {
    const TestComponent = () => {
      const { setStatus, updateQuality } = require('../../src/client/store/connectionStore').useConnection();
      React.useEffect(() => {
        setStatus('reconnecting');
        updateQuality({ reconnectAttempts: 3 });
      }, [setStatus, updateQuality]);
      return <OfflineIndicator />;
    };

    renderWithProvider(<TestComponent />);
    
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('3');
  });

  it('should be closable', () => {
    const TestComponent = () => {
      const { setStatus } = require('../../src/client/store/connectionStore').useConnection();
      React.useEffect(() => {
        setStatus('disconnected');
      }, [setStatus]);
      return <OfflineIndicator />;
    };

    renderWithProvider(<TestComponent />);
    
    const closeButton = screen.getByLabelText('关闭');
    expect(closeButton).toBeInTheDocument();
  });

  it('should show status tag', () => {
    const TestComponent = () => {
      const { setStatus } = require('../../src/client/store/connectionStore').useConnection();
      React.useEffect(() => {
        setStatus('connecting');
      }, [setStatus]);
      return <OfflineIndicator />;
    };

    renderWithProvider(<TestComponent />);
    
    expect(screen.getByText('连接中')).toBeInTheDocument();
  });

  it('should show connection quality when connected', () => {
    const TestComponent = () => {
      const { setStatus, updateQuality } = require('../../src/client/store/connectionStore').useConnection();
      React.useEffect(() => {
        setStatus('connected');
        updateQuality({ latency: 50, isStale: false });
      }, [setStatus, updateQuality]);
      return <OfflineIndicator />;
    };

    renderWithProvider(<TestComponent />);
    
    // Should show latency tag
    expect(screen.getByText('延迟：50ms')).toBeInTheDocument();
  });

  it('should show stale warning when connection is stale', () => {
    const TestComponent = () => {
      const { setStatus, updateQuality } = require('../../src/client/store/connectionStore').useConnection();
      React.useEffect(() => {
        setStatus('connected');
        updateQuality({ latency: 100, isStale: true });
      }, [setStatus, updateQuality]);
      return <OfflineIndicator />;
    };

    renderWithProvider(<TestComponent />);
    
    expect(screen.getByText('连接可能已过期')).toBeInTheDocument();
  });

  it('should show reconnect progress when reconnecting', () => {
    const TestComponent = () => {
      const { setStatus, updateQuality } = require('../../src/client/store/connectionStore').useConnection();
      React.useEffect(() => {
        setStatus('reconnecting');
        updateQuality({ reconnectAttempts: 2 });
      }, [setStatus, updateQuality]);
      return <OfflineIndicator />;
    };

    renderWithProvider(<TestComponent />);
    
    // Should show progress bar
    const progress = screen.getByRole('progressbar');
    expect(progress).toBeInTheDocument();
  });

  it('should have fixed positioning at top of page', () => {
    const TestComponent = () => {
      const { setStatus } = require('../../src/client/store/connectionStore').useConnection();
      React.useEffect(() => {
        setStatus('disconnected');
      }, [setStatus]);
      return <OfflineIndicator />;
    };

    renderWithProvider(<TestComponent />);
    
    const alert = screen.getByRole('alert');
    const style = window.getComputedStyle(alert);
    expect(style.position).toBe('fixed');
  });

  it('should have high z-index', () => {
    const TestComponent = () => {
      const { setStatus } = require('../../src/client/store/connectionStore').useConnection();
      React.useEffect(() => {
        setStatus('disconnected');
      }, [setStatus]);
      return <OfflineIndicator />;
    };

    renderWithProvider(<TestComponent />);
    
    const alert = screen.getByRole('alert');
    const style = window.getComputedStyle(alert);
    expect(style.zIndex).toBe('9999');
  });
});
