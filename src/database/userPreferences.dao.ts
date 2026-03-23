/**
 * User Preferences DAO
 * Data access layer for user preferences (language, theme, notifications, etc.)
 * 
 * Issue #586: 语言切换功能实现
 */

import getSupabaseClient from './client.js';

const getSupabase = () => getSupabaseClient();

export type SupportedLanguage = 'zh-CN' | 'en-US';
export type ThemePreference = 'light' | 'dark' | 'system';

export interface UserPreferences {
  id: string;
  user_id: string;
  language: SupportedLanguage;
  theme: ThemePreference;
  timezone: string;
  notification_settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface UpdateUserPreferencesInput {
  language?: SupportedLanguage;
  theme?: ThemePreference;
  timezone?: string;
  notification_settings?: Record<string, unknown>;
}

const DEFAULT_PREFERENCES: Omit<UserPreferences, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
  language: 'zh-CN',
  theme: 'system',
  timezone: 'Asia/Shanghai',
  notification_settings: {},
};

/**
 * Get user preferences by user ID
 * Returns default preferences if not found
 */
export async function getUserPreferences(userId: string): Promise<UserPreferences | null> {
  const supabase = getSupabase();
  
  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') {
      // No preferences found, return null (caller can create defaults)
      return null;
    }
    throw error;
  }
  return data;
}

/**
 * Get or create user preferences
 * Creates default preferences if they don't exist
 */
export async function getOrCreateUserPreferences(userId: string): Promise<UserPreferences> {
  const existing = await getUserPreferences(userId);
  
  if (existing) {
    return existing;
  }
  
  // Create default preferences
  return createUserPreferences(userId);
}

/**
 * Create user preferences with defaults
 */
export async function createUserPreferences(
  userId: string,
  preferences?: Partial<UpdateUserPreferencesInput>
): Promise<UserPreferences> {
  const supabase = getSupabase();
  
  const { data, error } = await supabase
    .from('user_preferences')
    .insert({
      user_id: userId,
      ...DEFAULT_PREFERENCES,
      ...preferences,
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Update user preferences
 * Creates preferences if they don't exist
 */
export async function updateUserPreferences(
  userId: string,
  updates: UpdateUserPreferencesInput
): Promise<UserPreferences> {
  const supabase = getSupabase();
  
  // Try to update existing preferences
  const { data, error } = await supabase
    .from('user_preferences')
    .upsert(
      {
        user_id: userId,
        ...updates,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id',
      }
    )
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Update language preference
 */
export async function updateLanguagePreference(
  userId: string,
  language: SupportedLanguage
): Promise<UserPreferences> {
  return updateUserPreferences(userId, { language });
}

/**
 * Update theme preference
 */
export async function updateThemePreference(
  userId: string,
  theme: ThemePreference
): Promise<UserPreferences> {
  return updateUserPreferences(userId, { theme });
}

/**
 * Delete user preferences (for account deletion)
 */
export async function deleteUserPreferences(userId: string): Promise<void> {
  const supabase = getSupabase();
  
  const { error } = await supabase
    .from('user_preferences')
    .delete()
    .eq('user_id', userId);
  
  if (error) throw error;
}

/**
 * Validate language code
 */
export function isValidLanguage(lang: string): lang is SupportedLanguage {
  return ['zh-CN', 'en-US'].includes(lang);
}

/**
 * Validate theme preference
 */
export function isValidTheme(theme: string): theme is ThemePreference {
  return ['light', 'dark', 'system'].includes(theme);
}

export default {
  getUserPreferences,
  getOrCreateUserPreferences,
  createUserPreferences,
  updateUserPreferences,
  updateLanguagePreference,
  updateThemePreference,
  deleteUserPreferences,
  isValidLanguage,
  isValidTheme,
};