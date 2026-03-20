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
    
    // Arco Design Alert closable button has an icon, not a text label
    // Look for the close icon or the closable class
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    // The Alert component has closable prop which renders a close button
    expect(alert.querySelector('.arco-alert-close-btn')).toBeTruthy();
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

  it('should not show anything when connected and not stale', () => {
    const TestComponent = () => {
      const { setRealtimeConnected, updateQuality } = require('../../src/client/store/connectionStore').useConnection();
      React.useEffect(() => {
        setRealtimeConnected(true); // This sets status to 'connected'
        updateQuality({ latency: 50, isStale: false });
      }, [setRealtimeConnected, updateQuality]);
      return <OfflineIndicator />;
    };

    renderWithProvider(<TestComponent />);
    
    // When connected and not stale, should not show anything
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

  it('should show stale warning when connection is stale', async () => {
    const TestComponent = () => {
      const { setRealtimeConnected, updateQuality } = require('../../src/client/store/connectionStore').useConnection();
      React.useEffect(() => {
        setRealtimeConnected(true); // This sets status to 'connected'
        updateQuality({ latency: 100, isStale: true });
      }, [setRealtimeConnected, updateQuality]);
      return <OfflineIndicator />;
    };

    renderWithProvider(<TestComponent />);
    
    await screen.findByText('连接可能已过期');
    expect(screen.getByText('连接可能已过期')).toBeInTheDocument();
  });

  // Note: Stale warning feature is not implemented in current version
  // When connected, the indicator is hidden regardless of staleness
  
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
