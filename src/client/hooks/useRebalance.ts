/**
 * Hook for Portfolio Rebalancing
 * 
 * Provides state management and operations for portfolio rebalancing,
 * including target allocation management, preview generation, and execution.
 */

import { useState, useCallback, useEffect } from 'react';
import {
  TargetAllocation,
  RebalancePlan,
  RebalancePreview,
  RebalanceExecution,
  RebalanceTrigger,
  RebalanceExecutionStatus,
} from '../../portfolio/rebalance/types';
import { Position } from '../../portfolio/types';

/**
 * State for target allocations
 */
interface TargetAllocationsState {
  allocations: TargetAllocation[];
  loading: boolean;
  error: string | null;
}

/**
 * State for rebalance plans
 */
interface RebalancePlansState {
  plans: RebalancePlan[];
  loading: boolean;
  error: string | null;
}

/**
 * State for rebalance preview
 */
interface RebalancePreviewState {
  preview: RebalancePreview | null;
  loading: boolean;
  error: string | null;
}

/**
 * State for rebalance execution
 */
interface RebalanceExecutionState {
  execution: RebalanceExecution | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook options
 */
interface UseRebalanceOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

/**
 * Hook return type
 */
interface UseRebalanceReturn {
  // Target allocations
  targetAllocations: TargetAllocation[];
  targetAllocationsLoading: boolean;
  targetAllocationsError: string | null;
  createTargetAllocation: (allocation: Omit<TargetAllocation, 'id' | 'createdAt' | 'updatedAt'>) => Promise<TargetAllocation | null>;
  updateTargetAllocation: (id: string, updates: Partial<TargetAllocation>) => Promise<TargetAllocation | null>;
  deleteTargetAllocation: (id: string) => Promise<boolean>;
  refreshTargetAllocations: () => Promise<void>;

  // Rebalance plans
  plans: RebalancePlan[];
  plansLoading: boolean;
  plansError: string | null;
  createPlan: (plan: Omit<RebalancePlan, 'id' | 'createdAt' | 'updatedAt' | 'targetAllocation'>) => Promise<RebalancePlan | null>;
  updatePlan: (id: string, updates: Partial<RebalancePlan>) => Promise<RebalancePlan | null>;
  deletePlan: (id: string) => Promise<boolean>;
  refreshPlans: () => Promise<void>;

  // Preview
  preview: RebalancePreview | null;
  previewLoading: boolean;
  previewError: string | null;
  generatePreview: (planId: string, positions: Position[]) => Promise<RebalancePreview | null>;

  // Execution
  execution: RebalanceExecution | null;
  executionLoading: boolean;
  executionError: string | null;
  executeRebalance: (planId: string, positions: Position[], trigger?: RebalanceTrigger) => Promise<RebalanceExecution | null>;
  cancelExecution: (executionId: string) => Promise<boolean>;

  // Helpers
  calculateDeviation: (positions: Position[], targetAllocation: TargetAllocation) => Promise<Map<string, number>>;
  needsRebalancing: (positions: Position[], targetAllocation: TargetAllocation, threshold: number) => Promise<boolean>;
  
  // Loading states
  isLoading: boolean;
  error: string | null;
}

const API_BASE = '/api/rebalance';

/**
 * Hook for portfolio rebalancing operations
 */
export function useRebalance(options: UseRebalanceOptions = {}): UseRebalanceReturn {
  const { autoRefresh = false, refreshInterval = 30000 } = options;

  // States
  const [allocationsState, setAllocationsState] = useState<TargetAllocationsState>({
    allocations: [],
    loading: false,
    error: null,
  });

  const [plansState, setPlansState] = useState<RebalancePlansState>({
    plans: [],
    loading: false,
    error: null,
  });

  const [previewState, setPreviewState] = useState<RebalancePreviewState>({
    preview: null,
    loading: false,
    error: null,
  });

  const [executionState, setExecutionState] = useState<RebalanceExecutionState>({
    execution: null,
    loading: false,
    error: null,
  });

  // Computed loading state
  const isLoading = allocationsState.loading || plansState.loading || previewState.loading || executionState.loading;
  const error = allocationsState.error || plansState.error || previewState.error || executionState.error;

  // ==================== Target Allocations ====================

  const fetchTargetAllocations = useCallback(async () => {
    setAllocationsState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch(`${API_BASE}/allocations`);
      if (!response.ok) throw new Error('Failed to fetch target allocations');

      const data = await response.json();
      setAllocationsState({
        allocations: data.map(mapAllocationFromApi),
        loading: false,
        error: null,
      });
    } catch (err: any) {
      setAllocationsState(prev => ({
        ...prev,
        loading: false,
        error: err.message,
      }));
    }
  }, []);

  const createTargetAllocation = useCallback(async (
    allocation: Omit<TargetAllocation, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<TargetAllocation | null> => {
    try {
      const response = await fetch(`${API_BASE}/allocations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(allocation),
      });

      if (!response.ok) throw new Error('Failed to create target allocation');

      const data = await response.json();
      const newAllocation = mapAllocationFromApi(data);

      setAllocationsState(prev => ({
        ...prev,
        allocations: [newAllocation, ...prev.allocations],
      }));

      return newAllocation;
    } catch (err: any) {
      setAllocationsState(prev => ({ ...prev, error: err.message }));
      return null;
    }
  }, []);

  const updateTargetAllocation = useCallback(async (
    id: string,
    updates: Partial<TargetAllocation>
  ): Promise<TargetAllocation | null> => {
    try {
      const response = await fetch(`${API_BASE}/allocations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) throw new Error('Failed to update target allocation');

      const data = await response.json();
      const updatedAllocation = mapAllocationFromApi(data);

      setAllocationsState(prev => ({
        ...prev,
        allocations: prev.allocations.map(a => a.id === id ? updatedAllocation : a),
      }));

      return updatedAllocation;
    } catch (err: any) {
      setAllocationsState(prev => ({ ...prev, error: err.message }));
      return null;
    }
  }, []);

  const deleteTargetAllocation = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/allocations/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete target allocation');

      setAllocationsState(prev => ({
        ...prev,
        allocations: prev.allocations.filter(a => a.id !== id),
      }));

      return true;
    } catch (err: any) {
      setAllocationsState(prev => ({ ...prev, error: err.message }));
      return false;
    }
  }, []);

  // ==================== Rebalance Plans ====================

  const fetchPlans = useCallback(async () => {
    setPlansState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch(`${API_BASE}/plans`);
      if (!response.ok) throw new Error('Failed to fetch rebalance plans');

      const data = await response.json();
      setPlansState({
        plans: data.map(mapPlanFromApi),
        loading: false,
        error: null,
      });
    } catch (err: any) {
      setPlansState(prev => ({
        ...prev,
        loading: false,
        error: err.message,
      }));
    }
  }, []);

  const createPlan = useCallback(async (
    plan: Omit<RebalancePlan, 'id' | 'createdAt' | 'updatedAt' | 'targetAllocation'>
  ): Promise<RebalancePlan | null> => {
    try {
      const response = await fetch(`${API_BASE}/plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(plan),
      });

      if (!response.ok) throw new Error('Failed to create rebalance plan');

      const data = await response.json();
      const newPlan = mapPlanFromApi(data);

      setPlansState(prev => ({
        ...prev,
        plans: [newPlan, ...prev.plans],
      }));

      return newPlan;
    } catch (err: any) {
      setPlansState(prev => ({ ...prev, error: err.message }));
      return null;
    }
  }, []);

  const updatePlan = useCallback(async (
    id: string,
    updates: Partial<RebalancePlan>
  ): Promise<RebalancePlan | null> => {
    try {
      const response = await fetch(`${API_BASE}/plans/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) throw new Error('Failed to update rebalance plan');

      const data = await response.json();
      const updatedPlan = mapPlanFromApi(data);

      setPlansState(prev => ({
        ...prev,
        plans: prev.plans.map(p => p.id === id ? updatedPlan : p),
      }));

      return updatedPlan;
    } catch (err: any) {
      setPlansState(prev => ({ ...prev, error: err.message }));
      return null;
    }
  }, []);

  const deletePlan = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/plans/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete rebalance plan');

      setPlansState(prev => ({
        ...prev,
        plans: prev.plans.filter(p => p.id !== id),
      }));

      return true;
    } catch (err: any) {
      setPlansState(prev => ({ ...prev, error: err.message }));
      return false;
    }
  }, []);

  // ==================== Preview ====================

  const generatePreview = useCallback(async (
    planId: string,
    positions: Position[]
  ): Promise<RebalancePreview | null> => {
    setPreviewState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch(`${API_BASE}/plans/${planId}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positions }),
      });

      if (!response.ok) throw new Error('Failed to generate preview');

      const data = await response.json();
      const preview = mapPreviewFromApi(data);

      setPreviewState({
        preview,
        loading: false,
        error: null,
      });

      return preview;
    } catch (err: any) {
      setPreviewState(prev => ({
        ...prev,
        loading: false,
        error: err.message,
      }));
      return null;
    }
  }, []);

  // ==================== Execution ====================

  const executeRebalance = useCallback(async (
    planId: string,
    positions: Position[],
    trigger: RebalanceTrigger = RebalanceTrigger.MANUAL
  ): Promise<RebalanceExecution | null> => {
    setExecutionState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch(`${API_BASE}/plans/${planId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positions, trigger }),
      });

      if (!response.ok) throw new Error('Failed to execute rebalance');

      const data = await response.json();
      const execution = mapExecutionFromApi(data);

      setExecutionState({
        execution,
        loading: false,
        error: null,
      });

      return execution;
    } catch (err: any) {
      setExecutionState(prev => ({
        ...prev,
        loading: false,
        error: err.message,
      }));
      return null;
    }
  }, []);

  const cancelExecution = useCallback(async (executionId: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/executions/${executionId}/cancel`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to cancel execution');

      setExecutionState(prev => ({
        ...prev,
        execution: prev.execution?.id === executionId
          ? { ...prev.execution, status: RebalanceExecutionStatus.CANCELLED }
          : prev.execution,
      }));

      return true;
    } catch (err: any) {
      setExecutionState(prev => ({ ...prev, error: err.message }));
      return false;
    }
  }, []);

  // ==================== Helpers ====================

  const calculateDeviation = useCallback(async (
    positions: Position[],
    targetAllocation: TargetAllocation
  ): Promise<Map<string, number>> => {
    // Calculate position values
    const portfolioValue = positions.reduce((sum, p) => sum + (p.quantity * p.averageCost), 0);
    const deviations = new Map<string, number>();

    for (const allocation of targetAllocation.allocations) {
      const position = positions.find(p => p.symbol === allocation.symbol);
      const currentValue = position ? position.quantity * position.averageCost : 0;
      const currentWeight = portfolioValue > 0 ? (currentValue / portfolioValue) * 100 : 0;
      const deviation = Math.abs(currentWeight - allocation.targetWeight);
      deviations.set(allocation.symbol, deviation);
    }

    return deviations;
  }, []);

  const needsRebalancing = useCallback(async (
    positions: Position[],
    targetAllocation: TargetAllocation,
    threshold: number
  ): Promise<boolean> => {
    const deviations = await calculateDeviation(positions, targetAllocation);
    return Array.from(deviations.values()).some(d => d > threshold);
  }, [calculateDeviation]);

  // ==================== Auto-refresh ====================

  useEffect(() => {
    fetchTargetAllocations();
    fetchPlans();

    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchTargetAllocations();
        fetchPlans();
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, fetchTargetAllocations, fetchPlans]);

  return {
    // Target allocations
    targetAllocations: allocationsState.allocations,
    targetAllocationsLoading: allocationsState.loading,
    targetAllocationsError: allocationsState.error,
    createTargetAllocation,
    updateTargetAllocation,
    deleteTargetAllocation,
    refreshTargetAllocations: fetchTargetAllocations,

    // Plans
    plans: plansState.plans,
    plansLoading: plansState.loading,
    plansError: plansState.error,
    createPlan,
    updatePlan,
    deletePlan,
    refreshPlans: fetchPlans,

    // Preview
    preview: previewState.preview,
    previewLoading: previewState.loading,
    previewError: previewState.error,
    generatePreview,

    // Execution
    execution: executionState.execution,
    executionLoading: executionState.loading,
    executionError: executionState.error,
    executeRebalance,
    cancelExecution,

    // Helpers
    calculateDeviation,
    needsRebalancing,

    // Loading states
    isLoading,
    error,
  };
}

// ==================== API Mappers ====================

function mapAllocationFromApi(data: any): TargetAllocation {
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    allocations: data.allocations,
    totalWeight: data.total_weight || data.totalWeight,
    createdAt: new Date(data.created_at || data.createdAt),
    updatedAt: new Date(data.updated_at || data.updatedAt),
  };
}

function mapPlanFromApi(data: any): RebalancePlan {
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    targetAllocationId: data.target_allocation_id || data.targetAllocationId,
    targetAllocation: data.targetAllocation ? mapAllocationFromApi(data.targetAllocation) : undefined as any,
    trigger: data.trigger as RebalanceTrigger,
    threshold: data.threshold,
    schedule: data.schedule,
    isActive: data.is_active ?? data.isActive ?? true,
    createdAt: new Date(data.created_at || data.createdAt),
    updatedAt: new Date(data.updated_at || data.updatedAt),
  };
}

function mapPreviewFromApi(data: any): RebalancePreview {
  return {
    planId: data.planId,
    portfolioValue: data.portfolioValue,
    positions: data.positions,
    adjustments: data.adjustments,
    totalEstimatedCost: data.totalEstimatedCost,
    totalEstimatedFees: data.totalEstimatedFees,
    estimatedSlippage: data.estimatedSlippage,
    executionStrategy: data.executionStrategy,
    warnings: data.warnings || [],
    timestamp: new Date(data.timestamp),
  };
}

function mapExecutionFromApi(data: any): RebalanceExecution {
  return {
    id: data.id,
    planId: data.planId,
    status: data.status as RebalanceExecutionStatus,
    trigger: data.trigger as RebalanceTrigger,
    preview: data.preview ? mapPreviewFromApi(data.preview) : undefined as any,
    orders: data.orders || [],
    totalEstimatedCost: data.totalEstimatedCost,
    totalActualCost: data.totalActualCost,
    totalFees: data.totalFees,
    startedAt: new Date(data.startedAt),
    completedAt: data.completedAt ? new Date(data.completedAt) : undefined,
    error: data.error,
    metrics: data.metrics || {
      totalOrders: 0,
      successfulOrders: 0,
      failedOrders: 0,
      totalVolume: 0,
      averageExecutionPrice: 0,
      executionTimeMs: 0,
      slippageBps: 0,
    },
  };
}

export default useRebalance;
