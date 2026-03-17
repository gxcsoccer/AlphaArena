/**
 * AI Assistant DAO
 * Data access layer for AI assistant conversations and messages
 */

import getSupabaseClient from './client.js';

const getSupabase = () => getSupabaseClient();

export type MessageRole = 'user' | 'assistant' | 'system';

export interface AIConversation {
  id: string;
  user_id: string;
  title?: string;
  context: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AIMessage {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  context?: Record<string, unknown>;
  tokens_used?: number;
  model?: string;
  created_at: string;
}

export interface CreateConversationInput {
  user_id: string;
  title?: string;
  context?: Record<string, unknown>;
}

export interface CreateMessageInput {
  conversation_id: string;
  role: MessageRole;
  content: string;
  context?: Record<string, unknown>;
  tokens_used?: number;
  model?: string;
}

export interface ConversationListOptions {
  user_id: string;
  limit?: number;
  offset?: number;
}

export interface MarketAnalysisCache {
  id: string;
  symbol: string;
  analysis_type: string;
  analysis_result: Record<string, unknown>;
  market_data_hash?: string;
  model?: string;
  created_at: string;
  expires_at: string;
}

export interface StrategySuggestionCache {
  id: string;
  strategy_id: string;
  suggestion_type: string;
  suggestion_result: Record<string, unknown>;
  strategy_data_hash?: string;
  model?: string;
  created_at: string;
  expires_at: string;
}

/**
 * Create a new conversation
 */
export async function createConversation(input: CreateConversationInput): Promise<AIConversation> {
  const supabase = getSupabase();
  
  const { data, error } = await supabase
    .from('ai_conversations')
    .insert({
      user_id: input.user_id,
      title: input.title,
      context: input.context || {},
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Get conversation by ID
 */
export async function getConversationById(
  conversationId: string,
  userId: string
): Promise<AIConversation | null> {
  const supabase = getSupabase();
  
  const { data, error } = await supabase
    .from('ai_conversations')
    .select('*')
    .eq('id', conversationId)
    .eq('user_id', userId)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

/**
 * List user's conversations
 */
export async function listConversations(
  options: ConversationListOptions
): Promise<{ conversations: AIConversation[]; total: number }> {
  const supabase = getSupabase();
  const limit = options.limit || 20;
  const offset = options.offset || 0;
  
  const [conversationsResult, countResult] = await Promise.all([
    supabase
      .from('ai_conversations')
      .select('*')
      .eq('user_id', options.user_id)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1),
    supabase
      .from('ai_conversations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', options.user_id),
  ]);
  
  if (conversationsResult.error) throw conversationsResult.error;
  
  return {
    conversations: conversationsResult.data || [],
    total: countResult.count || 0,
  };
}

/**
 * Update conversation
 */
export async function updateConversation(
  conversationId: string,
  userId: string,
  updates: Partial<Pick<AIConversation, 'title' | 'context'>>
): Promise<AIConversation> {
  const supabase = getSupabase();
  
  const { data, error } = await supabase
    .from('ai_conversations')
    .update(updates)
    .eq('id', conversationId)
    .eq('user_id', userId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Delete conversation and all its messages
 */
export async function deleteConversation(
  conversationId: string,
  userId: string
): Promise<void> {
  const supabase = getSupabase();
  
  const { error } = await supabase
    .from('ai_conversations')
    .delete()
    .eq('id', conversationId)
    .eq('user_id', userId);
  
  if (error) throw error;
}

/**
 * Create a message
 */
export async function createMessage(input: CreateMessageInput): Promise<AIMessage> {
  const supabase = getSupabase();
  
  const { data, error } = await supabase
    .from('ai_messages')
    .insert({
      conversation_id: input.conversation_id,
      role: input.role,
      content: input.content,
      context: input.context,
      tokens_used: input.tokens_used,
      model: input.model,
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Get messages for a conversation
 */
export async function getConversationMessages(
  conversationId: string,
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<AIMessage[]> {
  const supabase = getSupabase();
  
  // First verify the conversation belongs to the user
  const conversation = await getConversationById(conversationId, userId);
  if (!conversation) {
    throw new Error('Conversation not found');
  }
  
  const { data, error } = await supabase
    .from('ai_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1);
  
  if (error) throw error;
  return data || [];
}

/**
 * Delete all conversations for a user
 */
export async function deleteAllConversations(userId: string): Promise<void> {
  const supabase = getSupabase();
  
  const { error } = await supabase
    .from('ai_conversations')
    .delete()
    .eq('user_id', userId);
  
  if (error) throw error;
}

/**
 * Get or create market analysis cache
 */
export async function getMarketAnalysisCache(
  symbol: string,
  analysisType: string,
  marketDataHash?: string
): Promise<MarketAnalysisCache | null> {
  const supabase = getSupabase();
  
  let query = supabase
    .from('ai_market_analysis_cache')
    .select('*')
    .eq('symbol', symbol)
    .eq('analysis_type', analysisType)
    .gt('expires_at', new Date().toISOString());
  
  if (marketDataHash) {
    query = query.eq('market_data_hash', marketDataHash);
  }
  
  const { data, error } = await query.single();
  
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

/**
 * Save market analysis to cache
 */
export async function saveMarketAnalysisCache(input: {
  symbol: string;
  analysisType: string;
  analysisResult: Record<string, unknown>;
  marketDataHash?: string;
  model?: string;
  expiresAt?: Date;
}): Promise<MarketAnalysisCache> {
  const supabase = getSupabase();
  
  const { data, error } = await supabase
    .from('ai_market_analysis_cache')
    .upsert(
      {
        symbol: input.symbol,
        analysis_type: input.analysisType,
        analysis_result: input.analysisResult,
        market_data_hash: input.marketDataHash,
        model: input.model,
        expires_at: (input.expiresAt || new Date(Date.now() + 3600000)).toISOString(),
      },
      {
        onConflict: 'symbol,analysis_type,market_data_hash',
      }
    )
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Get or create strategy suggestion cache
 */
export async function getStrategySuggestionCache(
  strategyId: string,
  suggestionType: string,
  strategyDataHash?: string
): Promise<StrategySuggestionCache | null> {
  const supabase = getSupabase();
  
  let query = supabase
    .from('ai_strategy_suggestions_cache')
    .select('*')
    .eq('strategy_id', strategyId)
    .eq('suggestion_type', suggestionType)
    .gt('expires_at', new Date().toISOString());
  
  if (strategyDataHash) {
    query = query.eq('strategy_data_hash', strategyDataHash);
  }
  
  const { data, error } = await query.single();
  
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

/**
 * Save strategy suggestion to cache
 */
export async function saveStrategySuggestionCache(input: {
  strategyId: string;
  suggestionType: string;
  suggestionResult: Record<string, unknown>;
  strategyDataHash?: string;
  model?: string;
  expiresAt?: Date;
}): Promise<StrategySuggestionCache> {
  const supabase = getSupabase();
  
  const { data, error } = await supabase
    .from('ai_strategy_suggestions_cache')
    .upsert(
      {
        strategy_id: input.strategyId,
        suggestion_type: input.suggestionResult,
        suggestion_result: input.suggestionResult,
        strategy_data_hash: input.strategyDataHash,
        model: input.model,
        expires_at: (input.expiresAt || new Date(Date.now() + 3600000)).toISOString(),
      },
      {
        onConflict: 'strategy_id,suggestion_type,strategy_data_hash',
      }
    )
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Clean up expired cache entries
 */
export async function cleanupExpiredCache(): Promise<void> {
  const supabase = getSupabase();
  
  await Promise.all([
    supabase
      .from('ai_market_analysis_cache')
      .delete()
      .lt('expires_at', new Date().toISOString()),
    supabase
      .from('ai_strategy_suggestions_cache')
      .delete()
      .lt('expires_at', new Date().toISOString()),
  ]);
}
