/**
 * React hooks for Strategy Portfolio Management
 * 
 * Provides hooks for fetching and managing strategy portfolios
 */

import { useState, useEffect, useCallback } from 'react';
import { Message } from '@arco-design/web-react';
import { createLogger } from '../../utils/logger';

const log = createLogger('useStrategyPortfolio');

/**
 * API base URL
 */
const API_BASE = '/api/strategy-portfolios';

/**
 * Types
 */
export type AllocationMethod = 'equal' | 'custom' | 'risk_parity';
export type PortfolioStatus = 'active' | 'paused' | 'stopped';
export type PortfolioStrategyStatus = 'running' | 'paused' | 'stopped';
export type RebalanceReason = 'threshold' | 'scheduled' | 'manual' | 'strategy_change';

export interface RebalanceConfig {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly' | 'threshold';
  threshold?: number;
  lastRebalanced?: string;
}

export interface PortfolioStrategy {
  id: string;
  portfolioId: string;
  strategyId: string;
  weight: number;
  allocation: number;
  currentAllocation: number;
  status: PortfolioStrategyStatus;
  enabled: boolean;
  currentValue?: number;
  returnAmount?: number;
  returnPct?: number;
  strategyName?: string;
  strategySymbol?: string;
  strategyStatus?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StrategyPortfolio {
  id: string;
  userId: string;
  name: string;
  description?: string;
  totalCapital: number;
  allocationMethod: AllocationMethod;
  rebalanceConfig: RebalanceConfig;
  status: PortfolioStatus;
  totalValue?: number;
  totalReturn?: number;
  totalReturnPct?: number;
  strategies?: PortfolioStrategy[];
  createdAt: string;
  updatedAt: string;
}

export interface CreatePortfolioInput {
  name: string;
  description?: string;
  totalCapital: number;
  allocationMethod: AllocationMethod;
  rebalanceConfig?: Partial<RebalanceConfig>;
  strategies: Array<{
    strategyId: string;
    weight?: number;
  }>;
}

export interface UpdatePortfolioInput {
  name?: string;
  description?: string;
  totalCapital?: number;
  allocationMethod?: AllocationMethod;
  rebalanceConfig?: Partial<RebalanceConfig>;
  status?: PortfolioStatus;
}

export interface Allocation {
  strategyId: string;
  weight: number;
  allocation: number;
}

export interface RebalancePreview {
  needsRebalance: boolean;
  reason: string;
  currentAllocations: Allocation[];
  targetAllocations: Allocation[];
  adjustments: Array<{
    strategyId: string;
    action: 'increase' | 'decrease' | 'none';
    currentAllocation: number;
    targetAllocation: number;
    amount: number;
  }>;
  estimatedImpact: {
    totalTrades: number;
    totalVolume: number;
    estimatedFees: number;
  };
}

export interface StrategyPerformance {
  strategyId: string;
  name: string;
  allocation: number;
  currentValue: number;
  return: number;
  returnPct: number;
  contribution: number;
}

export interface PortfolioPerformance {
  totalValue: number;
  totalReturn: number;
  totalReturnPct: number;
  strategies: StrategyPerformance[];
  correlation?: number[][];
  diversificationRatio?: number;
}

export interface PortfolioRisk {
  concentrationRisk: number;
  maxStrategyWeight: number;
  diversificationScore: number;
}

/**
 * Generic fetch wrapper
 */
async function fetchAPI<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(endpoint, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Hook to fetch all portfolios for the current user
 */
export function usePortfolios(filters?: { status?: string; limit?: number }) {
  const [portfolios, setPortfolios] = useState<StrategyPortfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPortfolios = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.limit) params.append('limit', filters.limit.toString());

      const url = params.toString() ? `${API_BASE}?${params}` : API_BASE;
      const data = await fetchAPI<StrategyPortfolio[]>(url);
      setPortfolios(data);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch portfolios';
      setError(errorMsg);
      log.error('Failed to fetch portfolios:', err);
    } finally {
      setLoading(false);
    }
  }, [filters?.status, filters?.limit]);

  useEffect(() => {
    fetchPortfolios();
  }, [fetchPortfolios]);

  return { portfolios, loading, error, refresh: fetchPortfolios };
}

/**
 * Hook to fetch a single portfolio by ID
 */
export function usePortfolio(portfolioId: string | null) {
  const [portfolio, setPortfolio] = useState<StrategyPortfolio | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPortfolio = useCallback(async () => {
    if (!portfolioId) {
      setPortfolio(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await fetchAPI<StrategyPortfolio>(`${API_BASE}/${portfolioId}`);
      setPortfolio(data);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch portfolio';
      setError(errorMsg);
      log.error('Failed to fetch portfolio:', err);
    } finally {
      setLoading(false);
    }
  }, [portfolioId]);

  useEffect(() => {
    fetchPortfolio();
  }, [fetchPortfolio]);

  return { portfolio, loading, error, refresh: fetchPortfolio };
}

/**
 * Hook for portfolio operations (create, update, delete)
 */
export function usePortfolioOperations() {
  const [loading, setLoading] = useState(false);

  const createPortfolio = useCallback(async (input: CreatePortfolioInput): Promise<StrategyPortfolio> => {
    try {
      setLoading(true);
      const portfolio = await fetchAPI<StrategyPortfolio>(API_BASE, {
        method: 'POST',
        body: JSON.stringify(input),
      });
      Message.success('组合创建成功');
      return portfolio;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create portfolio';
      Message.error(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updatePortfolio = useCallback(async (
    portfolioId: string,
    input: UpdatePortfolioInput
  ): Promise<StrategyPortfolio> => {
    try {
      setLoading(true);
      const portfolio = await fetchAPI<StrategyPortfolio>(`${API_BASE}/${portfolioId}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      });
      Message.success('组合更新成功');
      return portfolio;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update portfolio';
      Message.error(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deletePortfolio = useCallback(async (portfolioId: string): Promise<void> => {
    try {
      setLoading(true);
      await fetchAPI<void>(`${API_BASE}/${portfolioId}`, {
        method: 'DELETE',
      });
      Message.success('组合删除成功');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete portfolio';
      Message.error(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const startPortfolio = useCallback(async (portfolioId: string): Promise<StrategyPortfolio> => {
    try {
      setLoading(true);
      const portfolio = await fetchAPI<StrategyPortfolio>(
        `${API_BASE}/${portfolioId}/start`,
        { method: 'POST' }
      );
      Message.success('组合已启动');
      return portfolio;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to start portfolio';
      Message.error(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const stopPortfolio = useCallback(async (portfolioId: string): Promise<StrategyPortfolio> => {
    try {
      setLoading(true);
      const portfolio = await fetchAPI<StrategyPortfolio>(
        `${API_BASE}/${portfolioId}/stop`,
        { method: 'POST' }
      );
      Message.success('组合已停止');
      return portfolio;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to stop portfolio';
      Message.error(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const pausePortfolio = useCallback(async (portfolioId: string): Promise<StrategyPortfolio> => {
    try {
      setLoading(true);
      const portfolio = await fetchAPI<StrategyPortfolio>(
        `${API_BASE}/${portfolioId}/pause`,
        { method: 'POST' }
      );
      Message.success('组合已暂停');
      return portfolio;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to pause portfolio';
      Message.error(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    createPortfolio,
    updatePortfolio,
    deletePortfolio,
    startPortfolio,
    stopPortfolio,
    pausePortfolio,
  };
}

/**
 * Hook for portfolio strategy management
 */
export function usePortfolioStrategies(portfolioId: string | null) {
  const [loading, setLoading] = useState(false);

  const addStrategy = useCallback(async (
    strategyId: string,
    weight?: number
  ): Promise<PortfolioStrategy> => {
    if (!portfolioId) throw new Error('Portfolio ID required');

    try {
      setLoading(true);
      const strategy = await fetchAPI<PortfolioStrategy>(
        `${API_BASE}/${portfolioId}/strategies`,
        {
          method: 'POST',
          body: JSON.stringify({ strategyId, weight }),
        }
      );
      Message.success('策略添加成功');
      return strategy;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to add strategy';
      Message.error(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [portfolioId]);

  const removeStrategy = useCallback(async (strategyId: string): Promise<void> => {
    if (!portfolioId) throw new Error('Portfolio ID required');

    try {
      setLoading(true);
      await fetchAPI<void>(`${API_BASE}/${portfolioId}/strategies/${strategyId}`, {
        method: 'DELETE',
      });
      Message.success('策略移除成功');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to remove strategy';
      Message.error(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [portfolioId]);

  const updateWeight = useCallback(async (
    strategyId: string,
    weight: number
  ): Promise<void> => {
    if (!portfolioId) throw new Error('Portfolio ID required');

    try {
      setLoading(true);
      await fetchAPI<void>(
        `${API_BASE}/${portfolioId}/strategies/${strategyId}/weight`,
        {
          method: 'PUT',
          body: JSON.stringify({ weight }),
        }
      );
      Message.success('权重更新成功');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update weight';
      Message.error(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [portfolioId]);

  return {
    loading,
    addStrategy,
    removeStrategy,
    updateWeight,
  };
}

/**
 * Hook for portfolio rebalancing
 */
export function usePortfolioRebalance(portfolioId: string | null) {
  const [loading, setLoading] = useState(false);

  const previewRebalance = useCallback(async (): Promise<RebalancePreview> => {
    if (!portfolioId) throw new Error('Portfolio ID required');

    try {
      setLoading(true);
      const preview = await fetchAPI<RebalancePreview>(
        `${API_BASE}/${portfolioId}/rebalance/preview`
      );
      return preview;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to preview rebalance';
      Message.error(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [portfolioId]);

  const executeRebalance = useCallback(async (
    reason: RebalanceReason = 'manual'
  ): Promise<{ success: boolean; message: string }> => {
    if (!portfolioId) throw new Error('Portfolio ID required');

    try {
      setLoading(true);
      const result = await fetchAPI<{ success: boolean; message: string }>(
        `${API_BASE}/${portfolioId}/rebalance`,
        {
          method: 'POST',
          body: JSON.stringify({ reason }),
        }
      );
      Message.success('再平衡执行成功');
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to execute rebalance';
      Message.error(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [portfolioId]);

  return {
    loading,
    previewRebalance,
    executeRebalance,
  };
}

/**
 * Hook for portfolio performance
 */
export function usePortfolioPerformance(portfolioId: string | null) {
  const [performance, setPerformance] = useState<PortfolioPerformance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPerformance = useCallback(async () => {
    if (!portfolioId) {
      setPerformance(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await fetchAPI<PortfolioPerformance>(
        `${API_BASE}/${portfolioId}/performance`
      );
      setPerformance(data);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch performance';
      setError(errorMsg);
      log.error('Failed to fetch performance:', err);
    } finally {
      setLoading(false);
    }
  }, [portfolioId]);

  useEffect(() => {
    fetchPerformance();
  }, [fetchPerformance]);

  return { performance, loading, error, refresh: fetchPerformance };
}

/**
 * Hook for portfolio risk analysis
 */
export function usePortfolioRisk(portfolioId: string | null) {
  const [risk, setRisk] = useState<PortfolioRisk | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRisk = useCallback(async () => {
    if (!portfolioId) {
      setRisk(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await fetchAPI<PortfolioRisk>(`${API_BASE}/${portfolioId}/risk`);
      setRisk(data);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch risk analysis';
      setError(errorMsg);
      log.error('Failed to fetch risk analysis:', err);
    } finally {
      setLoading(false);
    }
  }, [portfolioId]);

  useEffect(() => {
    fetchRisk();
  }, [fetchRisk]);

  return { risk, loading, error, refresh: fetchRisk };
}