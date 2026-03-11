import { getSupabaseClient } from './client';

export interface StrategyConfig {
  [key: string]: unknown;
}

export interface Strategy {
  id: string;
  name: string;
  description?: string | null;
  symbol: string;
  status: 'active' | 'paused' | 'stopped';
  config: StrategyConfig;
  createdAt: Date;
  updatedAt: Date;
}

export class StrategiesDAO {
  /**
   * Create a new strategy
   */
  async create(
    name: string,
    symbol: string,
    description?: string,
    config?: StrategyConfig
  ): Promise<Strategy> {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('strategies')
      .insert([{
        name,
        symbol,
        description: description || null,
        config: config || {},
        status: 'active'
      }])
      .select()
      .single();

    if (error) throw error;

    return this.mapToStrategy(data);
  }

  /**
   * Get strategy by ID
   */
  async getById(id: string): Promise<Strategy | null> {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('strategies')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return this.mapToStrategy(data);
  }

  /**
   * Get all active strategies
   */
  async getActive(): Promise<Strategy[]> {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('strategies')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map(this.mapToStrategy);
  }

  /**
   * Get all strategies
   */
  async getAll(): Promise<Strategy[]> {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('strategies')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map(this.mapToStrategy);
  }

  /**
   * Update strategy status
   */
  async updateStatus(id: string, status: 'active' | 'paused' | 'stopped'): Promise<Strategy> {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('strategies')
      .update([{ status, updated_at: new Date().toISOString() }])
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return this.mapToStrategy(data);
  }

  /**
   * Update strategy config
   */
  async updateConfig(id: string, config: StrategyConfig): Promise<Strategy> {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('strategies')
      .update([{ config, updated_at: new Date().toISOString() }])
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return this.mapToStrategy(data);
  }

  /**
   * Delete strategy
   */
  async delete(id: string): Promise<void> {
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('strategies')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  private mapToStrategy(row: any): Strategy {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      symbol: row.symbol,
      status: row.status,
      config: row.config,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}
