/**
 * usePriceAlerts Hook Unit Tests
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { usePriceAlerts, CreateAlertParams } from '../usePriceAlerts';
import { api, PriceAlert } from '../../utils/api';

// Mock API
jest.mock('../../utils/api', () => ({
  api: {
    getPriceAlerts: jest.fn(),
    createPriceAlert: jest.fn(),
    updatePriceAlert: jest.fn(),
    deletePriceAlert: jest.fn(),
  },
}));

// Mock realtime client
jest.mock('../../utils/realtime', () => ({
  getRealtimeClient: jest.fn(() => ({
    subscribe: jest.fn().mockResolvedValue(undefined),
    on: jest.fn().mockReturnValue(() => {}),
    unsubscribe: jest.fn(),
  })),
}));

// Mock notification service
jest.mock('../../utils/notificationService', () => ({
  getNotificationService: jest.fn(() => ({
    showAlertTriggered: jest.fn(),
    getHistory: jest.fn().mockReturnValue([]),
    getUnreadCount: jest.fn().mockReturnValue(0),
    subscribe: jest.fn().mockReturnValue(() => {}),
    getPermissionStatus: jest.fn().mockReturnValue('default'),
    isSoundEnabled: jest.fn().mockReturnValue(true),
    isNotificationsEnabled: jest.fn().mockReturnValue(true),
  })),
}));

const mockAlerts: PriceAlert[] = [
  {
    id: 'alert-1',
    symbol: 'BTC/USDT',
    conditionType: 'above',
    targetPrice: 50000,
    status: 'active',
    notificationMethod: 'in_app',
    isRecurring: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'alert-2',
    symbol: 'ETH/USDT',
    conditionType: 'below',
    targetPrice: 3000,
    status: 'triggered',
    notificationMethod: 'push',
    isRecurring: true,
    triggeredAt: '2024-01-02T00:00:00Z',
    triggeredPrice: 2950,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
  },
];

describe('usePriceAlerts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.getPriceAlerts as jest.Mock).mockImplementation(async (..._args: any[]) => {
      console.log('[Mock API] getPriceAlerts called');
      return mockAlerts;
    });
  });

  describe('Initial Loading', () => {
    it('should fetch alerts on mount', async () => {
      console.log('[Test] Starting test');
      
      const { result } = renderHook(() => usePriceAlerts());
      
      console.log('[Test] renderHook completed');
      console.log('[Test] Initial loading:', result.current.loading);
      console.log('[Test] API calls:', (api.getPriceAlerts as jest.Mock).mock.calls.length);
      
      // Wait for the initial fetch to complete
      await waitFor(() => {
        console.log('[Test] Checking loading:', result.current.loading);
        expect(result.current.loading).toBe(false);
      }, { timeout: 5000 });

      expect(api.getPriceAlerts).toHaveBeenCalled();
      expect(result.current.alerts).toEqual(mockAlerts);
    }, 10000);

    it('should handle fetch errors', async () => {
      const error = new Error('Network error');
      (api.getPriceAlerts as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => usePriceAlerts());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Network error');
    });

    it('should filter alerts by symbol when provided', async () => {
      renderHook(() => usePriceAlerts({ symbol: 'BTC/USDT' }));

      await waitFor(() => {
        expect(api.getPriceAlerts).toHaveBeenCalledWith(
          expect.objectContaining({ symbol: 'BTC/USDT' })
        );
      });
    });
  });

  describe('Create Alert', () => {
    it('should create a new alert', async () => {
      const newAlert: PriceAlert = {
        id: 'alert-3',
        symbol: 'SOL/USDT',
        conditionType: 'above',
        targetPrice: 150,
        status: 'active',
        notificationMethod: 'in_app',
        isRecurring: false,
        createdAt: '2024-01-03T00:00:00Z',
        updatedAt: '2024-01-03T00:00:00Z',
      };

      (api.createPriceAlert as jest.Mock).mockResolvedValue(newAlert);

      const { result } = renderHook(() => usePriceAlerts());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const params: CreateAlertParams = {
        symbol: 'SOL/USDT',
        conditionType: 'above',
        targetPrice: 150,
        notificationMethod: 'in_app',
      };

      let createdAlert: PriceAlert | null = null;
      await act(async () => {
        createdAlert = await result.current.createAlert(params);
      });

      expect(api.createPriceAlert).toHaveBeenCalledWith(params);
      expect(createdAlert).toEqual(newAlert);
      expect(result.current.alerts).toContainEqual(newAlert);
    });

    it('should handle create errors', async () => {
      (api.createPriceAlert as jest.Mock).mockRejectedValue(new Error('Create failed'));

      const { result } = renderHook(() => usePriceAlerts());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        const response = await result.current.createAlert({
          symbol: 'TEST/USDT',
          conditionType: 'above',
          targetPrice: 100,
        });
        expect(response).toBeNull();
      });

      expect(result.current.error).toBe('Create failed');
    });
  });

  describe('Update Alert', () => {
    it('should update an existing alert', async () => {
      const updatedAlert: PriceAlert = {
        ...mockAlerts[0],
        targetPrice: 55000,
        updatedAt: '2024-01-03T00:00:00Z',
      };

      (api.updatePriceAlert as jest.Mock).mockResolvedValue(updatedAlert);

      const { result } = renderHook(() => usePriceAlerts());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        const response = await result.current.updateAlert('alert-1', {
          targetPrice: 55000,
        });
        expect(response).toEqual(updatedAlert);
      });

      expect(result.current.alerts[0].targetPrice).toBe(55000);
    });
  });

  describe('Delete Alert', () => {
    it('should delete an alert', async () => {
      (api.deletePriceAlert as jest.Mock).mockResolvedValue(true);

      const { result } = renderHook(() => usePriceAlerts());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        const success = await result.current.deleteAlert('alert-1');
        expect(success).toBe(true);
      });

      expect(result.current.alerts).not.toContainEqual(
        expect.objectContaining({ id: 'alert-1' })
      );
    });

    it('should handle delete errors', async () => {
      (api.deletePriceAlert as jest.Mock).mockResolvedValue(false);

      const { result } = renderHook(() => usePriceAlerts());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        const success = await result.current.deleteAlert('alert-1');
        expect(success).toBe(false);
      });
    });
  });

  describe('Status Management', () => {
    it('should toggle alert status', async () => {
      const updatedAlert: PriceAlert = {
        ...mockAlerts[0],
        status: 'disabled',
        updatedAt: '2024-01-03T00:00:00Z',
      };

      (api.updatePriceAlert as jest.Mock).mockResolvedValue(updatedAlert);

      const { result } = renderHook(() => usePriceAlerts());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.toggleAlertStatus('alert-1');
      });

      // The toggleAlertStatus function passes the full alert object with status updated
      expect(api.updatePriceAlert).toHaveBeenCalledWith('alert-1', 
        expect.objectContaining({ status: 'disabled' })
      );
    });
  });

  describe('Counts', () => {
    it('should calculate active and triggered counts', async () => {
      const { result } = renderHook(() => usePriceAlerts());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.activeCount).toBe(1); // Only alert-1 is active
      expect(result.current.triggeredCount).toBe(1); // alert-2 is triggered
    });
  });

  describe('Refresh', () => {
    it('should refresh alerts when refresh is called', async () => {
      const { result } = renderHook(() => usePriceAlerts());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Clear the mock call count
      (api.getPriceAlerts as jest.Mock).mockClear();

      await act(async () => {
        await result.current.refresh();
      });

      expect(api.getPriceAlerts).toHaveBeenCalledTimes(1);
    });
  });
});
