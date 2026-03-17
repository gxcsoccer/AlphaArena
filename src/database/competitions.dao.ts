import { getSupabaseClient } from './client';

/**
 * Competition - 交易竞赛
 */
export interface Competition {
  id: string;
  name: string;
  description?: string;
  creatorId?: string;
  startTime: Date;
  endTime: Date;
  status: 'upcoming' | 'active' | 'ended' | 'cancelled';
  entryFee: number;
  prizePool: number;
  maxParticipants?: number;
  rules: Record<string, any>;
  rewards: Array<{
    rank: number;
    prize: number;
    badge?: string;
  }>;
  bannerUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Competition Participant - 竞赛参与者
 */
export interface CompetitionParticipant {
  id: string;
  competitionId: string;
  userId: string;
  strategyId?: string;
  initialCapital: number;
  currentValue: number;
  roi: number;
  rank?: number;
  prize: number;
  joinedAt: Date;
  // Joined fields
  username?: string;
  displayName?: string;
  strategyName?: string;
}

/**
 * Competition with participant count
 */
export interface CompetitionWithStats extends Competition {
  participantCount: number;
  isJoined?: boolean;
  userRank?: number;
}

/**
 * Create competition input
 */
export interface CreateCompetitionInput {
  name: string;
  description?: string;
  creatorId?: string;
  startTime: Date;
  endTime: Date;
  entryFee?: number;
  prizePool?: number;
  maxParticipants?: number;
  rules?: Record<string, any>;
  rewards?: Array<{ rank: number; prize: number; badge?: string }>;
  bannerUrl?: string;
}

/**
 * Competitions DAO
 */
export class CompetitionsDAO {
  /**
   * Create a new competition
   */
  async create(input: CreateCompetitionInput): Promise<Competition> {
    const supabase = getSupabaseClient();
    const now = new Date();
    
    // Determine initial status based on start time
    const status = input.startTime > now ? 'upcoming' : 'active';

    const { data, error } = await supabase
      .from('competitions')
      .insert([{
        name: input.name,
        description: input.description,
        creator_id: input.creatorId,
        start_time: input.startTime.toISOString(),
        end_time: input.endTime.toISOString(),
        status,
        entry_fee: input.entryFee || 0,
        prize_pool: input.prizePool || 0,
        max_participants: input.maxParticipants,
        rules: input.rules || {},
        rewards: input.rewards || [],
        banner_url: input.bannerUrl,
      }])
      .select()
      .single();

    if (error) throw error;
    return this.mapToCompetition(data);
  }

  /**
   * Get competition by ID
   */
  async getById(id: string): Promise<Competition | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('competitions')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return this.mapToCompetition(data);
  }

  /**
   * Get competition with stats
   */
  async getWithStats(id: string, userId?: string): Promise<CompetitionWithStats | null> {
    const competition = await this.getById(id);
    if (!competition) return null;

    const supabase = getSupabaseClient();

    // Get participant count
    const { count, error: countError } = await supabase
      .from('competition_participants')
      .select('*', { count: 'exact', head: true })
      .eq('competition_id', id);

    if (countError) throw countError;

    const result: CompetitionWithStats = {
      ...competition,
      participantCount: count || 0,
    };

    // Check if user has joined
    if (userId) {
      const { data: participant, error: participantError } = await supabase
        .from('competition_participants')
        .select('rank')
        .eq('competition_id', id)
        .eq('user_id', userId)
        .single();

      if (!participantError && participant) {
        result.isJoined = true;
        result.userRank = participant.rank;
      }
    }

    return result;
  }

  /**
   * List competitions with filters
   */
  async list(filters?: {
    status?: string;
    upcoming?: boolean;
    active?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<CompetitionWithStats[]> {
    const supabase = getSupabaseClient();
    let query = supabase
      .from('competitions')
      .select('*')
      .order('start_time', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.upcoming) {
      query = query.eq('status', 'upcoming');
    }
    if (filters?.active) {
      query = query.eq('status', 'active');
    }
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Get participant counts for all competitions
    const competitions = data.map(this.mapToCompetition);
    const stats = await Promise.all(
      competitions.map(async (c) => {
        const { count } = await supabase
          .from('competition_participants')
          .select('*', { count: 'exact', head: true })
          .eq('competition_id', c.id);
        return { id: c.id, count: count || 0 };
      })
    );

    return competitions.map((c) => ({
      ...c,
      participantCount: stats.find((s) => s.id === c.id)?.count || 0,
    }));
  }

  /**
   * Update competition
   */
  async update(id: string, updates: Partial<CreateCompetitionInput>): Promise<Competition> {
    const supabase = getSupabaseClient();

    const updateData: Record<string, any> = {};
    if (updates.name) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.startTime) updateData.start_time = updates.startTime.toISOString();
    if (updates.endTime) updateData.end_time = updates.endTime.toISOString();
    if (updates.entryFee !== undefined) updateData.entry_fee = updates.entryFee;
    if (updates.prizePool !== undefined) updateData.prize_pool = updates.prizePool;
    if (updates.maxParticipants !== undefined) updateData.max_participants = updates.maxParticipants;
    if (updates.rules) updateData.rules = updates.rules;
    if (updates.rewards) updateData.rewards = updates.rewards;
    if (updates.bannerUrl !== undefined) updateData.banner_url = updates.bannerUrl;

    const { data, error } = await supabase
      .from('competitions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapToCompetition(data);
  }

  /**
   * Update competition status
   */
  async updateStatus(id: string, status: Competition['status']): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('competitions')
      .update({ status })
      .eq('id', id);

    if (error) throw error;
  }

  /**
   * Delete competition
   */
  async delete(id: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('competitions')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  /**
   * Join competition
   */
  async joinCompetition(
    competitionId: string,
    userId: string,
    initialCapital: number,
    strategyId?: string
  ): Promise<CompetitionParticipant> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('competition_participants')
      .insert([{
        competition_id: competitionId,
        user_id: userId,
        strategy_id: strategyId,
        initial_capital: initialCapital,
        current_value: initialCapital,
      }])
      .select()
      .single();

    if (error) throw error;
    return this.mapToParticipant(data);
  }

  /**
   * Leave competition
   */
  async leaveCompetition(competitionId: string, userId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('competition_participants')
      .delete()
      .eq('competition_id', competitionId)
      .eq('user_id', userId);

    if (error) throw error;
  }

  /**
   * Get competition leaderboard
   */
  async getLeaderboard(competitionId: string, limit = 50): Promise<CompetitionParticipant[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('competition_participants')
      .select(`
        *,
        users (username, display_name),
        strategies (name)
      `)
      .eq('competition_id', competitionId)
      .order('roi', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return data.map((row: any) => ({
      ...this.mapToParticipant(row),
      username: row.users?.username,
      displayName: row.users?.display_name,
      strategyName: row.strategies?.name,
    }));
  }

  /**
   * Update participant value
   */
  async updateParticipantValue(
    competitionId: string,
    userId: string,
    currentValue: number
  ): Promise<void> {
    const supabase = getSupabaseClient();

    // Get initial capital to calculate ROI
    const { data: participant, error: fetchError } = await supabase
      .from('competition_participants')
      .select('initial_capital')
      .eq('competition_id', competitionId)
      .eq('user_id', userId)
      .single();

    if (fetchError) throw fetchError;

    const roi = participant.initial_capital > 0
      ? ((currentValue - participant.initial_capital) / participant.initial_capital) * 100
      : 0;

    const { error } = await supabase
      .from('competition_participants')
      .update({
        current_value: currentValue,
        roi,
      })
      .eq('competition_id', competitionId)
      .eq('user_id', userId);

    if (error) throw error;
  }

  /**
   * Finalize competition - assign ranks and prizes
   */
  async finalizeCompetition(competitionId: string): Promise<void> {
    const supabase = getSupabaseClient();

    // Get competition details
    const competition = await this.getById(competitionId);
    if (!competition) throw new Error('Competition not found');

    // Get all participants ordered by ROI
    const participants = await this.getLeaderboard(competitionId, 1000);

    // Update ranks and prizes
    for (let i = 0; i < participants.length; i++) {
      const participant = participants[i];
      const rank = i + 1;
      const reward = competition.rewards.find(r => r.rank === rank);
      const prize = reward?.prize || 0;

      await supabase
        .from('competition_participants')
        .update({ rank, prize })
        .eq('id', participant.id);
    }

    // Update competition status
    await this.updateStatus(competitionId, 'ended');
  }

  /**
   * Get user's competitions
   */
  async getUserCompetitions(userId: string): Promise<CompetitionWithStats[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('competition_participants')
      .select(`
        competition_id,
        competitions (*)
      `)
      .eq('user_id', userId);

    if (error) throw error;

    const competitions = data.map((row: any) => this.mapToCompetition(row.competitions));
    
    // Get participant counts
    const stats = await Promise.all(
      competitions.map(async (c) => {
        const { count } = await supabase
          .from('competition_participants')
          .select('*', { count: 'exact', head: true })
          .eq('competition_id', c.id);
        return { id: c.id, count: count || 0 };
      })
    );

    return competitions.map((c) => ({
      ...c,
      participantCount: stats.find((s) => s.id === c.id)?.count || 0,
      isJoined: true,
    }));
  }

  private mapToCompetition(row: any): Competition {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      creatorId: row.creator_id,
      startTime: new Date(row.start_time),
      endTime: new Date(row.end_time),
      status: row.status,
      entryFee: parseFloat(row.entry_fee) || 0,
      prizePool: parseFloat(row.prize_pool) || 0,
      maxParticipants: row.max_participants,
      rules: row.rules || {},
      rewards: row.rewards || [],
      bannerUrl: row.banner_url,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapToParticipant(row: any): CompetitionParticipant {
    return {
      id: row.id,
      competitionId: row.competition_id,
      userId: row.user_id,
      strategyId: row.strategy_id,
      initialCapital: parseFloat(row.initial_capital) || 0,
      currentValue: parseFloat(row.current_value) || 0,
      roi: parseFloat(row.roi) || 0,
      rank: row.rank,
      prize: parseFloat(row.prize) || 0,
      joinedAt: new Date(row.joined_at),
    };
  }
}

export default CompetitionsDAO;
