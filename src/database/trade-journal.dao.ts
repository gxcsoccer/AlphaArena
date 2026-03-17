import { getSupabaseClient } from './client';

/**
 * Emotion types for trade journal entries
 */
export type EmotionType = 
  | 'confident' 
  | 'hesitant' 
  | 'fearful' 
  | 'greedy' 
  | 'regretful' 
  | 'hopeful' 
  | 'anxious' 
  | 'calm';

/**
 * Trade journal entry type
 */
export type TradeJournalType = 'long' | 'short';

/**
 * Trade journal entry status
 */
export type TradeJournalStatus = 'open' | 'closed' | 'cancelled';

/**
 * Trade journal entry interface
 */
export interface TradeJournal {
  id: string;
  userId: string;
  
  // Basic trade info
  symbol: string;
  type: TradeJournalType;
  status: TradeJournalStatus;
  
  // Entry details
  entryPrice: number;
  entryQuantity: number;
  entryReason?: string;
  entryDate: Date;
  
  // Exit details (optional, for closed trades)
  exitPrice?: number;
  exitQuantity?: number;
  exitReason?: string;
  exitDate?: Date;
  
  // Financials
  pnl?: number;
  pnlPercent?: number;
  fees?: number;
  
  // Notes and metadata
  notes?: string;
  tags: string[];
  emotion: EmotionType;
  
  // Screenshots (stored as URLs)
  screenshots: string[];
  
  // Strategy association
  strategyId?: string;
  strategyName?: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input for creating a trade journal entry
 */
export interface CreateTradeJournalInput {
  userId: string;
  symbol: string;
  type: TradeJournalType;
  entryPrice: number;
  entryQuantity: number;
  entryReason?: string;
  entryDate?: Date;
  notes?: string;
  tags?: string[];
  emotion: EmotionType;
  screenshots?: string[];
  strategyId?: string;
  strategyName?: string;
}

/**
 * Input for updating a trade journal entry
 */
export interface UpdateTradeJournalInput {
  symbol?: string;
  type?: TradeJournalType;
  status?: TradeJournalStatus;
  entryPrice?: number;
  entryQuantity?: number;
  entryReason?: string;
  entryDate?: Date;
  exitPrice?: number;
  exitQuantity?: number;
  exitReason?: string;
  exitDate?: Date;
  pnl?: number;
  pnlPercent?: number;
  fees?: number;
  notes?: string;
  tags?: string[];
  emotion?: EmotionType;
  screenshots?: string[];
  strategyId?: string;
  strategyName?: string;
}

/**
 * Filters for querying trade journal entries
 */
export interface TradeJournalFilters {
  userId: string;
  symbol?: string;
  type?: TradeJournalType;
  status?: TradeJournalStatus;
  emotion?: EmotionType;
  strategyId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Trade journal statistics
 */
export interface TradeJournalStats {
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnl: number;
  avgPnl: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  avgHoldingTime: number; // in hours
  bestTrade: number;
  worstTrade: number;
  emotionBreakdown: Record<EmotionType, number>;
  symbolBreakdown: Record<string, { count: number; pnl: number }>;
  strategyBreakdown: Record<string, { count: number; pnl: number }>;
}

/**
 * Trade Journal DAO
 * Handles all database operations for the trading journal
 */
export class TradeJournalDAO {
  /**
   * Create a new trade journal entry
   */
  async create(input: CreateTradeJournalInput): Promise<TradeJournal> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('trade_journal')
      .insert([
        {
          user_id: input.userId,
          symbol: input.symbol.toUpperCase(),
          type: input.type,
          status: 'open',
          entry_price: input.entryPrice.toString(),
          entry_quantity: input.entryQuantity.toString(),
          entry_reason: input.entryReason || null,
          entry_date: (input.entryDate || new Date()).toISOString(),
          notes: input.notes || null,
          tags: input.tags || [],
          emotion: input.emotion,
          screenshots: input.screenshots || [],
          strategy_id: input.strategyId || null,
          strategy_name: input.strategyName || null,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return this.mapToTradeJournal(data);
  }

  /**
   * Get a trade journal entry by ID
   */
  async getById(id: string, userId: string): Promise<TradeJournal | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('trade_journal')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return this.mapToTradeJournal(data);
  }

  /**
   * Get multiple trade journal entries with filters
   */
  async getMany(filters: TradeJournalFilters): Promise<TradeJournal[]> {
    const supabase = getSupabaseClient();

    let query = supabase
      .from('trade_journal')
      .select('*')
      .eq('user_id', filters.userId);

    if (filters.symbol) {
      query = query.eq('symbol', filters.symbol.toUpperCase());
    }
    if (filters.type) {
      query = query.eq('type', filters.type);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.emotion) {
      query = query.eq('emotion', filters.emotion);
    }
    if (filters.strategyId) {
      query = query.eq('strategy_id', filters.strategyId);
    }
    if (filters.startDate) {
      query = query.gte('entry_date', filters.startDate.toISOString());
    }
    if (filters.endDate) {
      query = query.lte('entry_date', filters.endDate.toISOString());
    }

    query = query.order('entry_date', { ascending: false });

    if (filters.limit) {
      query = query.limit(filters.limit);
    }
    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 100) - 1);
    }

    const { data, error } = await query;

    if (error) throw error;

    return data.map(this.mapToTradeJournal);
  }

  /**
   * Update a trade journal entry
   */
  async update(id: string, userId: string, input: UpdateTradeJournalInput): Promise<TradeJournal> {
    const supabase = getSupabaseClient();

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (input.symbol !== undefined) updateData.symbol = input.symbol.toUpperCase();
    if (input.type !== undefined) updateData.type = input.type;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.entryPrice !== undefined) updateData.entry_price = input.entryPrice.toString();
    if (input.entryQuantity !== undefined) updateData.entry_quantity = input.entryQuantity.toString();
    if (input.entryReason !== undefined) updateData.entry_reason = input.entryReason;
    if (input.entryDate !== undefined) updateData.entry_date = input.entryDate.toISOString();
    if (input.exitPrice !== undefined) updateData.exit_price = input.exitPrice?.toString() || null;
    if (input.exitQuantity !== undefined) updateData.exit_quantity = input.exitQuantity?.toString() || null;
    if (input.exitReason !== undefined) updateData.exit_reason = input.exitReason;
    if (input.exitDate !== undefined) updateData.exit_date = input.exitDate?.toISOString() || null;
    if (input.pnl !== undefined) updateData.pnl = input.pnl?.toString() || null;
    if (input.pnlPercent !== undefined) updateData.pnl_percent = input.pnlPercent?.toString() || null;
    if (input.fees !== undefined) updateData.fees = input.fees?.toString() || null;
    if (input.notes !== undefined) updateData.notes = input.notes;
    if (input.tags !== undefined) updateData.tags = input.tags;
    if (input.emotion !== undefined) updateData.emotion = input.emotion;
    if (input.screenshots !== undefined) updateData.screenshots = input.screenshots;
    if (input.strategyId !== undefined) updateData.strategy_id = input.strategyId;
    if (input.strategyName !== undefined) updateData.strategy_name = input.strategyName;

    const { data, error } = await supabase
      .from('trade_journal')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    return this.mapToTradeJournal(data);
  }

  /**
   * Delete a trade journal entry
   */
  async delete(id: string, userId: string): Promise<void> {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('trade_journal')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
  }

  /**
   * Close a trade (set exit details and calculate PnL)
   */
  async closeTrade(
    id: string,
    userId: string,
    exitDetails: {
      exitPrice: number;
      exitQuantity?: number;
      exitReason?: string;
      exitDate?: Date;
      fees?: number;
    }
  ): Promise<TradeJournal> {
    // First get the current entry
    const entry = await this.getById(id, userId);
    if (!entry) {
      throw new Error('Trade journal entry not found');
    }

    if (entry.status !== 'open') {
      throw new Error('Can only close open trades');
    }

    const exitQuantity = exitDetails.exitQuantity || entry.entryQuantity;
    const exitDate = exitDetails.exitDate || new Date();

    // Calculate PnL
    let pnl: number;
    let pnlPercent: number;

    if (entry.type === 'long') {
      pnl = (exitDetails.exitPrice - entry.entryPrice) * exitQuantity;
      pnlPercent = ((exitDetails.exitPrice - entry.entryPrice) / entry.entryPrice) * 100;
    } else {
      pnl = (entry.entryPrice - exitDetails.exitPrice) * exitQuantity;
      pnlPercent = ((entry.entryPrice - exitDetails.exitPrice) / entry.entryPrice) * 100;
    }

    // Subtract fees if provided
    if (exitDetails.fees) {
      pnl -= exitDetails.fees;
    }

    return this.update(id, userId, {
      status: 'closed',
      exitPrice: exitDetails.exitPrice,
      exitQuantity,
      exitReason: exitDetails.exitReason,
      exitDate,
      pnl,
      pnlPercent,
      fees: exitDetails.fees,
    });
  }

  /**
   * Get trade statistics for a user
   */
  async getStats(userId: string, filters?: Omit<TradeJournalFilters, 'userId'>): Promise<TradeJournalStats> {
    // Get all closed trades for the user
    const trades = await this.getMany({
      userId,
      status: 'closed',
      ...filters,
      limit: undefined,
      offset: undefined,
    });

    const openTrades = await this.getMany({
      userId,
      status: 'open',
      ...filters,
      limit: undefined,
      offset: undefined,
    });

    const closedTrades = trades;
    const winningTrades = closedTrades.filter(t => (t.pnl || 0) > 0);
    const losingTrades = closedTrades.filter(t => (t.pnl || 0) < 0);

    const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const avgPnl = closedTrades.length > 0 ? totalPnl / closedTrades.length : 0;
    const avgWin = winningTrades.length > 0 
      ? winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / winningTrades.length 
      : 0;
    const avgLoss = losingTrades.length > 0 
      ? losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / losingTrades.length 
      : 0;

    // Calculate profit factor
    const totalWins = winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0));
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;

    // Calculate average holding time
    const holdingTimes = closedTrades
      .filter(t => t.exitDate)
      .map(t => {
        const entryTime = new Date(t.entryDate).getTime();
        const exitTime = new Date(t.exitDate!).getTime();
        return (exitTime - entryTime) / (1000 * 60 * 60); // hours
      });
    const avgHoldingTime = holdingTimes.length > 0 
      ? holdingTimes.reduce((sum, t) => sum + t, 0) / holdingTimes.length 
      : 0;

    // Best and worst trades
    const pnls = closedTrades.map(t => t.pnl || 0);
    const bestTrade = pnls.length > 0 ? Math.max(...pnls) : 0;
    const worstTrade = pnls.length > 0 ? Math.min(...pnls) : 0;

    // Emotion breakdown
    const emotionBreakdown: Record<EmotionType, number> = {
      confident: 0,
      hesitant: 0,
      fearful: 0,
      greedy: 0,
      regretful: 0,
      hopeful: 0,
      anxious: 0,
      calm: 0,
    };
    closedTrades.forEach(t => {
      emotionBreakdown[t.emotion]++;
    });

    // Symbol breakdown
    const symbolBreakdown: Record<string, { count: number; pnl: number }> = {};
    closedTrades.forEach(t => {
      if (!symbolBreakdown[t.symbol]) {
        symbolBreakdown[t.symbol] = { count: 0, pnl: 0 };
      }
      symbolBreakdown[t.symbol].count++;
      symbolBreakdown[t.symbol].pnl += t.pnl || 0;
    });

    // Strategy breakdown
    const strategyBreakdown: Record<string, { count: number; pnl: number }> = {};
    closedTrades.forEach(t => {
      const key = t.strategyName || t.strategyId || 'No Strategy';
      if (!strategyBreakdown[key]) {
        strategyBreakdown[key] = { count: 0, pnl: 0 };
      }
      strategyBreakdown[key].count++;
      strategyBreakdown[key].pnl += t.pnl || 0;
    });

    return {
      totalTrades: closedTrades.length + openTrades.length,
      openTrades: openTrades.length,
      closedTrades: closedTrades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0,
      totalPnl,
      avgPnl,
      avgWin,
      avgLoss,
      profitFactor,
      avgHoldingTime,
      bestTrade,
      worstTrade,
      emotionBreakdown,
      symbolBreakdown,
      strategyBreakdown,
    };
  }

  /**
   * Export trade journal entries to CSV
   */
  async exportToCSV(userId: string, filters?: Omit<TradeJournalFilters, 'userId'>): Promise<string> {
    const trades = await this.getMany({
      userId,
      ...filters,
      limit: undefined,
      offset: undefined,
    });

    const headers = [
      'ID',
      'Symbol',
      'Type',
      'Status',
      'Entry Price',
      'Entry Quantity',
      'Entry Reason',
      'Entry Date',
      'Exit Price',
      'Exit Quantity',
      'Exit Reason',
      'Exit Date',
      'PnL',
      'PnL %',
      'Fees',
      'Emotion',
      'Tags',
      'Strategy',
      'Notes',
      'Created At',
    ];

    const rows = trades.map(trade => [
      trade.id,
      trade.symbol,
      trade.type,
      trade.status,
      trade.entryPrice.toString(),
      trade.entryQuantity.toString(),
      trade.entryReason || '',
      new Date(trade.entryDate).toISOString(),
      trade.exitPrice?.toString() || '',
      trade.exitQuantity?.toString() || '',
      trade.exitReason || '',
      trade.exitDate ? new Date(trade.exitDate).toISOString() : '',
      trade.pnl?.toString() || '',
      trade.pnlPercent?.toString() || '',
      trade.fees?.toString() || '',
      trade.emotion,
      trade.tags.join(';'),
      trade.strategyName || trade.strategyId || '',
      trade.notes?.replace(/"/g, '""') || '',
      new Date(trade.createdAt).toISOString(),
    ]);

    return [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');
  }

  /**
   * Import trade journal entries from JSON
   */
  async importFromJSON(userId: string, entries: Partial<CreateTradeJournalInput>[]): Promise<{
    success: number;
    failed: number;
    errors: string[];
  }> {
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      try {
        if (!entry.symbol || !entry.type || entry.entryPrice === undefined || entry.entryQuantity === undefined) {
          throw new Error('Missing required fields: symbol, type, entryPrice, entryQuantity');
        }

        await this.create({
          userId,
          symbol: entry.symbol,
          type: entry.type,
          entryPrice: entry.entryPrice,
          entryQuantity: entry.entryQuantity,
          entryReason: entry.entryReason,
          entryDate: entry.entryDate,
          notes: entry.notes,
          tags: entry.tags,
          emotion: entry.emotion || 'calm',
          screenshots: entry.screenshots,
          strategyId: entry.strategyId,
          strategyName: entry.strategyName,
        });
        success++;
      } catch (error: any) {
        failed++;
        errors.push(`Entry ${i + 1}: ${error.message}`);
      }
    }

    return { success, failed, errors };
  }

  /**
   * Map database row to TradeJournal interface
   */
  private mapToTradeJournal(row: any): TradeJournal {
    return {
      id: row.id,
      userId: row.user_id,
      symbol: row.symbol,
      type: row.type as TradeJournalType,
      status: row.status as TradeJournalStatus,
      entryPrice: parseFloat(row.entry_price),
      entryQuantity: parseFloat(row.entry_quantity),
      entryReason: row.entry_reason,
      entryDate: new Date(row.entry_date),
      exitPrice: row.exit_price ? parseFloat(row.exit_price) : undefined,
      exitQuantity: row.exit_quantity ? parseFloat(row.exit_quantity) : undefined,
      exitReason: row.exit_reason,
      exitDate: row.exit_date ? new Date(row.exit_date) : undefined,
      pnl: row.pnl ? parseFloat(row.pnl) : undefined,
      pnlPercent: row.pnl_percent ? parseFloat(row.pnl_percent) : undefined,
      fees: row.fees ? parseFloat(row.fees) : undefined,
      notes: row.notes,
      tags: row.tags || [],
      emotion: row.emotion as EmotionType,
      screenshots: row.screenshots || [],
      strategyId: row.strategy_id,
      strategyName: row.strategy_name,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
