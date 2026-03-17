/**
 * Rebalance DAO
 * 
 * Database access layer for portfolio rebalancing data.
 */

import { getSupabaseClient } from './client';
import {
  TargetAllocation,
  RebalancePlan,
  RebalanceExecution,
  RebalanceOrder,
  RebalanceTrigger,
  RebalanceExecutionStatus,
  RebalanceOrderStatus,
  RebalanceOrderType,
  ScheduleConfig,
} from '../portfolio/rebalance/types';

/**
 * Database representation of TargetAllocation
 */
interface TargetAllocationRow {
  id: string;
  name: string;
  description: string | null;
  allocations: Array<{ symbol: string; targetWeight: number; tolerance?: number }>;
  total_weight: number;
  created_at: string;
  updated_at: string;
}

/**
 * Database representation of RebalancePlan
 */
interface RebalancePlanRow {
  id: string;
  name: string;
  description: string | null;
  target_allocation_id: string;
  trigger: string;
  threshold: number | null;
  schedule: ScheduleConfig | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Database representation of RebalanceExecution
 */
interface RebalanceExecutionRow {
  id: string;
  plan_id: string;
  status: string;
  trigger: string;
  preview: any;
  orders: any[];
  total_estimated_cost: number;
  total_actual_cost: number;
  total_fees: number;
  started_at: string;
  completed_at: string | null;
  error: string | null;
  metrics: any;
  created_at: string;
}

/**
 * Database representation of RebalanceOrder
 */
interface RebalanceOrderRow {
  id: string;
  execution_id: string;
  plan_id: string;
  symbol: string;
  side: string;
  order_type: string;
  quantity: number;
  limit_price: number | null;
  status: string;
  filled_quantity: number;
  filled_price: number;
  fee: number;
  error: string | null;
  created_at: string;
  executed_at: string | null;
  completed_at: string | null;
}

/**
 * Rebalance DAO class
 */
export class RebalanceDAO {
  // ==================== Target Allocations ====================

  /**
   * Create a new target allocation
   */
  async createTargetAllocation(
    allocation: Omit<TargetAllocation, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<TargetAllocation> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('rebalance_allocations')
      .insert([
        {
          name: allocation.name,
          description: allocation.description || null,
          allocations: allocation.allocations,
          total_weight: allocation.totalWeight,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return this.mapToTargetAllocation(data);
  }

  /**
   * Get target allocation by ID
   */
  async getTargetAllocation(id: string): Promise<TargetAllocation | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('rebalance_allocations')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return this.mapToTargetAllocation(data);
  }

  /**
   * Get all target allocations
   */
  async getTargetAllocations(): Promise<TargetAllocation[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('rebalance_allocations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map(this.mapToTargetAllocation);
  }

  /**
   * Update target allocation
   */
  async updateTargetAllocation(
    id: string,
    updates: Partial<Omit<TargetAllocation, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<TargetAllocation> {
    const supabase = getSupabaseClient();

    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.allocations !== undefined) updateData.allocations = updates.allocations;
    if (updates.totalWeight !== undefined) updateData.total_weight = updates.totalWeight;

    const { data, error } = await supabase
      .from('rebalance_allocations')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return this.mapToTargetAllocation(data);
  }

  /**
   * Delete target allocation
   */
  async deleteTargetAllocation(id: string): Promise<void> {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('rebalance_allocations')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // ==================== Rebalance Plans ====================

  /**
   * Create a new rebalance plan
   */
  async createPlan(
    plan: Omit<RebalancePlan, 'id' | 'createdAt' | 'updatedAt' | 'targetAllocation'>
  ): Promise<RebalancePlan> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('rebalance_plans')
      .insert([
        {
          name: plan.name,
          description: plan.description || null,
          target_allocation_id: plan.targetAllocationId,
          trigger: plan.trigger,
          threshold: plan.threshold || null,
          schedule: plan.schedule || null,
          is_active: plan.isActive,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    // Fetch the target allocation to include in the plan
    const targetAllocation = await this.getTargetAllocation(plan.targetAllocationId);

    return {
      ...this.mapToRebalancePlan(data),
      targetAllocation: targetAllocation!,
    };
  }

  /**
   * Get rebalance plan by ID
   */
  async getPlan(id: string): Promise<RebalancePlan | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('rebalance_plans')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    const plan = this.mapToRebalancePlan(data);
    const targetAllocation = await this.getTargetAllocation(plan.targetAllocationId);

    return {
      ...plan,
      targetAllocation: targetAllocation!,
    };
  }

  /**
   * Get all rebalance plans
   */
  async getPlans(activeOnly = false): Promise<RebalancePlan[]> {
    const supabase = getSupabaseClient();

    let query = supabase.from('rebalance_plans').select('*');

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    const plans = data.map(this.mapToRebalancePlan);

    // Fetch target allocations for all plans
    const allocationIds = plans.map(p => p.targetAllocationId);
    const { data: allocations, error: allocError } = await supabase
      .from('rebalance_allocations')
      .select('*')
      .in('id', allocationIds);

    if (allocError) throw allocError;

    const allocationMap = new Map(
      allocations.map(a => [a.id, this.mapToTargetAllocation(a)])
    );

    return plans.map(p => ({
      ...p,
      targetAllocation: allocationMap.get(p.targetAllocationId)!,
    }));
  }

  /**
   * Update rebalance plan
   */
  async updatePlan(
    id: string,
    updates: Partial<Omit<RebalancePlan, 'id' | 'createdAt' | 'updatedAt' | 'targetAllocation'>>
  ): Promise<RebalancePlan> {
    const supabase = getSupabaseClient();

    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.targetAllocationId !== undefined) updateData.target_allocation_id = updates.targetAllocationId;
    if (updates.trigger !== undefined) updateData.trigger = updates.trigger;
    if (updates.threshold !== undefined) updateData.threshold = updates.threshold;
    if (updates.schedule !== undefined) updateData.schedule = updates.schedule;
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

    const { data, error } = await supabase
      .from('rebalance_plans')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    const plan = this.mapToRebalancePlan(data);
    const targetAllocation = await this.getTargetAllocation(plan.targetAllocationId);

    return {
      ...plan,
      targetAllocation: targetAllocation!,
    };
  }

  /**
   * Delete rebalance plan
   */
  async deletePlan(id: string): Promise<void> {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('rebalance_plans')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // ==================== Rebalance Executions ====================

  /**
   * Create a new execution
   */
  async createExecution(execution: Omit<RebalanceExecution, 'id'>): Promise<RebalanceExecution> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('rebalance_executions')
      .insert([
        {
          plan_id: execution.planId,
          status: execution.status,
          trigger: execution.trigger,
          preview: execution.preview,
          orders: execution.orders,
          total_estimated_cost: execution.totalEstimatedCost,
          total_actual_cost: execution.totalActualCost,
          total_fees: execution.totalFees,
          started_at: execution.startedAt.toISOString(),
          completed_at: execution.completedAt?.toISOString() || null,
          error: execution.error || null,
          metrics: execution.metrics,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return this.mapToRebalanceExecution(data);
  }

  /**
   * Get execution by ID
   */
  async getExecution(id: string): Promise<RebalanceExecution | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('rebalance_executions')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return this.mapToRebalanceExecution(data);
  }

  /**
   * Get executions for a plan
   */
  async getExecutions(planId: string, limit = 50): Promise<RebalanceExecution[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('rebalance_executions')
      .select('*')
      .eq('plan_id', planId)
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return data.map(this.mapToRebalanceExecution);
  }

  /**
   * Update execution
   */
  async updateExecution(
    id: string,
    updates: Partial<RebalanceExecution>
  ): Promise<RebalanceExecution> {
    const supabase = getSupabaseClient();

    const updateData: any = {};
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.orders !== undefined) updateData.orders = updates.orders;
    if (updates.totalActualCost !== undefined) updateData.total_actual_cost = updates.totalActualCost;
    if (updates.totalFees !== undefined) updateData.total_fees = updates.totalFees;
    if (updates.completedAt !== undefined) updateData.completed_at = updates.completedAt?.toISOString() || null;
    if (updates.error !== undefined) updateData.error = updates.error || null;
    if (updates.metrics !== undefined) updateData.metrics = updates.metrics;

    const { data, error } = await supabase
      .from('rebalance_executions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return this.mapToRebalanceExecution(data);
  }

  // ==================== Rebalance Orders ====================

  /**
   * Create order
   */
  async createOrder(order: Omit<RebalanceOrder, 'id'>): Promise<RebalanceOrder> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('rebalance_orders')
      .insert([
        {
          execution_id: order.planId, // Note: we store plan_id here for reference
          plan_id: order.planId,
          symbol: order.symbol,
          side: order.side,
          order_type: order.orderType,
          quantity: order.quantity,
          limit_price: order.limitPrice || null,
          status: order.status,
          filled_quantity: order.filledQuantity,
          filled_price: order.filledPrice,
          fee: order.fee,
          error: order.error || null,
          executed_at: order.executedAt?.toISOString() || null,
          completed_at: order.completedAt?.toISOString() || null,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return this.mapToRebalanceOrder(data);
  }

  /**
   * Update order
   */
  async updateOrder(id: string, updates: Partial<RebalanceOrder>): Promise<RebalanceOrder> {
    const supabase = getSupabaseClient();

    const updateData: any = {};
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.filledQuantity !== undefined) updateData.filled_quantity = updates.filledQuantity;
    if (updates.filledPrice !== undefined) updateData.filled_price = updates.filledPrice;
    if (updates.fee !== undefined) updateData.fee = updates.fee;
    if (updates.error !== undefined) updateData.error = updates.error || null;
    if (updates.completedAt !== undefined) updateData.completed_at = updates.completedAt?.toISOString() || null;

    const { data, error } = await supabase
      .from('rebalance_orders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return this.mapToRebalanceOrder(data);
  }

  // ==================== Mappers ====================

  private mapToTargetAllocation(row: TargetAllocationRow): TargetAllocation {
    return {
      id: row.id,
      name: row.name,
      description: row.description || undefined,
      allocations: row.allocations,
      totalWeight: parseFloat(row.total_weight.toString()),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapToRebalancePlan(row: RebalancePlanRow): Omit<RebalancePlan, 'targetAllocation'> {
    return {
      id: row.id,
      name: row.name,
      description: row.description || undefined,
      targetAllocationId: row.target_allocation_id,
      trigger: row.trigger as RebalanceTrigger,
      threshold: row.threshold || undefined,
      schedule: row.schedule || undefined,
      isActive: row.is_active,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapToRebalanceExecution(row: RebalanceExecutionRow): RebalanceExecution {
    return {
      id: row.id,
      planId: row.plan_id,
      status: row.status as RebalanceExecutionStatus,
      trigger: row.trigger as RebalanceTrigger,
      preview: row.preview,
      orders: (row.orders || []).map(this.mapToRebalanceOrderFromJson),
      totalEstimatedCost: parseFloat(row.total_estimated_cost?.toString() || '0'),
      totalActualCost: parseFloat(row.total_actual_cost?.toString() || '0'),
      totalFees: parseFloat(row.total_fees?.toString() || '0'),
      startedAt: new Date(row.started_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      error: row.error || undefined,
      metrics: row.metrics || {
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

  private mapToRebalanceOrder(row: RebalanceOrderRow): RebalanceOrder {
    return {
      id: row.id,
      planId: row.plan_id,
      symbol: row.symbol,
      side: row.side as 'buy' | 'sell',
      orderType: row.order_type as RebalanceOrderType,
      quantity: parseFloat(row.quantity?.toString() || '0'),
      limitPrice: row.limit_price ? parseFloat(row.limit_price.toString()) : undefined,
      status: row.status as RebalanceOrderStatus,
      filledQuantity: parseFloat(row.filled_quantity?.toString() || '0'),
      filledPrice: parseFloat(row.filled_price?.toString() || '0'),
      fee: parseFloat(row.fee?.toString() || '0'),
      error: row.error || undefined,
      createdAt: new Date(row.created_at),
      executedAt: row.executed_at ? new Date(row.executed_at) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    };
  }

  private mapToRebalanceOrderFromJson(order: any): RebalanceOrder {
    return {
      id: order.id,
      planId: order.planId,
      symbol: order.symbol,
      side: order.side,
      orderType: order.orderType,
      quantity: order.quantity,
      limitPrice: order.limitPrice,
      status: order.status,
      filledQuantity: order.filledQuantity,
      filledPrice: order.filledPrice,
      fee: order.fee,
      error: order.error,
      createdAt: new Date(order.createdAt),
      executedAt: order.executedAt ? new Date(order.executedAt) : undefined,
      completedAt: order.completedAt ? new Date(order.completedAt) : undefined,
    };
  }
}

export const rebalanceDAO = new RebalanceDAO();
