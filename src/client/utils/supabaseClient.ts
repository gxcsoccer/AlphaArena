/**
 * Frontend Supabase Client
 * 
 * This is a frontend-specific Supabase client that uses Vite environment variables.
 * It's separate from the server-side client in src/database/client.ts which uses process.env.
 * 
 * Used for:
 * - Auth session management (getSession)
 * - Realtime subscriptions
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { validateConfig } from './config';

let frontendSupabaseClient: SupabaseClient | null = null;

/**
 * Get the frontend Supabase client
 * Uses VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables
 */
export function getFrontendSupabaseClient(): SupabaseClient {
  if (!frontendSupabaseClient) {
    const config = validateConfig();
    const supabaseUrl = config.supabaseUrl;
    const supabaseAnonKey = config.supabaseAnonKey;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[FrontendSupabaseClient] Missing Supabase configuration');
      console.error('[FrontendSupabaseClient] VITE_SUPABASE_URL:', supabaseUrl || 'missing');
      console.error('[FrontendSupabaseClient] VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'present' : 'missing');
      
      // Return a dummy client that won't crash but won't work
      // This allows the app to load even if Supabase is not configured
      frontendSupabaseClient = createClient('https://placeholder.supabase.co', 'placeholder-key', {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
      return frontendSupabaseClient;
    }

    frontendSupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      },
    });
    
    console.log('[FrontendSupabaseClient] Client initialized successfully');
  }

  return frontendSupabaseClient;
}

export default getFrontendSupabaseClient;