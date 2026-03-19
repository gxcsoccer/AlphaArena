/**
 * Connection Store Tests
 * 
 * Tests for the connection state management store
 */

import React from 'react';
import { render, act } from '@testing-library/react';
import { ConnectionProvider, useConnection, ConnectionStatus } from '../../src/client/store/connectionStore';

// Test component to access connection context
const TestComponent: React.FC<{
  testFn: (connection: ReturnType<typeof useConnection>) => void;
}> = ({ testFn }) => {
  const connection = useConnection();
  testFn(connection);
  return <div>Test</div>;
};

describe('ConnectionProvider', () => {
  it('should provide connection context', () => {
    const testFn = jest.fn();
    
    render(
      <ConnectionProvider>
        <TestComponent testFn={testFn} />
      </ConnectionProvider>
    );
    
    expect(testFn).toHaveBeenCalledWith(expect.objectContaining({
      status: expect.any(String),
      isOnline: expect.any(Boolean),
      quality: expect.any(Object),
    }));
  });

  it('should initialize with disconnected status', () => {
    let connectionState: any;
    
    render(
      <ConnectionProvider>
        <TestComponent testFn={(conn) => { connectionState = conn; }} />
      </ConnectionProvider>
    );
    
    expect(connectionState.status).toBe('disconnected');
  });

  it('should detect online status from navigator', () => {
    let connectionState: any;
    
    render(
      <ConnectionProvider>
        <TestComponent testFn={(conn) => { connectionState = conn; }} />
      </ConnectionProvider>
    );
    
    expect(typeof connectionState.isOnline).toBe('boolean');
  });
});

describe('ConnectionProvider - State Updates', () => {
  it('should update connection status', () => {
    let connection: any;
    
    const { rerender } = render(
      <ConnectionProvider>
        <TestComponent testFn={(conn) => { connection = conn; }} />
      </ConnectionProvider>
    );
    
    act(() => {
      connection.setStatus('connecting');
    });
    
    rerender(
      <ConnectionProvider>
        <TestComponent testFn={(conn) => { connection = conn; }} />
      </ConnectionProvider>
    );
    
    expect(connection.status).toBe('connecting');
  });

  it('should track connection timestamps', () => {
    let connection: any;
    
    render(
      <ConnectionProvider>
        <TestComponent testFn={(conn) => { connection = conn; }} />
      </ConnectionProvider>
    );
    
    const beforeConnect = Date.now();
    
    act(() => {
      connection.setStatus('connected');
    });
    
    expect(connection.lastConnectedAt).toBeGreaterThanOrEqual(beforeConnect);
    expect(connection.lastDisconnectedAt).toBeNull();
    
    act(() => {
      connection.setStatus('disconnected');
    });
    
    expect(connection.lastDisconnectedAt).toBeGreaterThanOrEqual(beforeConnect);
  });

  it('should update connection quality', () => {
    let connection: any;
    
    render(
      <ConnectionProvider>
        <TestComponent testFn={(conn) => { connection = conn; }} />
      </ConnectionProvider>
    );
    
    act(() => {
      connection.updateQuality({ latency: 50 });
    });
    
    expect(connection.quality.latency).toBe(50);
  });

  it('should update multiple quality metrics', () => {
    let connection: any;
    
    render(
      <ConnectionProvider>
        <TestComponent testFn={(conn) => { connection = conn; }} />
      </ConnectionProvider>
    );
    
    act(() => {
      connection.updateQuality({
        latency: 100,
        isStale: true,
        reconnectAttempts: 3,
      });
    });
    
    expect(connection.quality.latency).toBe(100);
    expect(connection.quality.isStale).toBe(true);
    expect(connection.quality.reconnectAttempts).toBe(3);
  });

  it('should record reconnection attempts', () => {
    let connection: any;
    
    render(
      <ConnectionProvider>
        <TestComponent testFn={(conn) => { connection = conn; }} />
      </ConnectionProvider>
    );
    
    const beforeReconnect = Date.now();
    
    act(() => {
      connection.recordReconnect();
    });
    
    expect(connection.quality.reconnectAttempts).toBe(1);
    expect(connection.quality.lastReconnectAt).toBeGreaterThanOrEqual(beforeReconnect);
  });

  it('should increment reconnect attempts on multiple calls', () => {
    let connection: any;
    
    render(
      <ConnectionProvider>
        <TestComponent testFn={(conn) => { connection = conn; }} />
      </ConnectionProvider>
    );
    
    act(() => {
      connection.recordReconnect();
      connection.recordReconnect();
      connection.recordReconnect();
    });
    
    expect(connection.quality.reconnectAttempts).toBe(3);
  });

  it('should reset state to defaults', () => {
    let connection: any;
    
    render(
      <ConnectionProvider>
        <TestComponent testFn={(conn) => { connection = conn; }} />
      </ConnectionProvider>
    );
    
    act(() => {
      connection.setStatus('connected');
      connection.updateQuality({ latency: 100, reconnectAttempts: 5 });
      connection.recordReconnect();
    });
    
    act(() => {
      connection.reset();
    });
    
    expect(connection.status).toBe('disconnected');
    expect(connection.quality.latency).toBe(0);
    expect(connection.quality.reconnectAttempts).toBe(0);
  });
});

describe('ConnectionProvider - Network Events', () => {
  it('should listen to online events', () => {
    let connection: any;
    
    render(
      <ConnectionProvider>
        <TestComponent testFn={(conn) => { connection = conn; }} />
      </ConnectionProvider>
    );
    
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    
    expect(connection.isOnline).toBe(true);
  });

  it('should listen to offline events', () => {
    let connection: any;
    
    render(
      <ConnectionProvider>
        <TestComponent testFn={(conn) => { connection = conn; }} />
      </ConnectionProvider>
    );
    
    // First set to online
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    
    // Then offline
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    
    expect(connection.isOnline).toBe(false);
  });
});

describe('useConnection hook', () => {
  it('should throw error when used outside provider', () => {
    const TestComponent = () => {
      useConnection();
      return <div>Test</div>;
    };

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useConnection must be used within a ConnectionProvider');
  });
});

describe('ConnectionProvider - All Status Transitions', () => {
  it('should handle all status transitions', () => {
    let connection: any;
    
    render(
      <ConnectionProvider>
        <TestComponent testFn={(conn) => { connection = conn; }} />
      </ConnectionProvider>
    );
    
    const statuses: ConnectionStatus[] = ['disconnected', 'connecting', 'connected', 'reconnecting'];
    
    statuses.forEach((status) => {
      act(() => {
        connection.setStatus(status);
      });
      expect(connection.status).toBe(status);
    });
  });
});
