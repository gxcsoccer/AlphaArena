/**
 * Configuration Validation for AlphaArena Frontend
 * 
 * Validates required environment variables at app startup
 * and provides helpful error messages if they're missing.
 */

export interface AppConfig {
  apiUrl: string;
  wsUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  isConfigured: boolean;
  missingVars: string[];
}

/**
 * Validate required environment variables
 * 
 * Note: Vite replaces import.meta.env.VITE_* at build time.
 * If these are empty in production, it means the environment
 * variables were not set during the Vercel build.
 */
export function validateConfig(): AppConfig {
  const missingVars: string[] = [];
  
  // Get environment variables (Vite replaces these at build time)
  const apiUrl = import.meta.env.VITE_API_URL || '';
  const wsUrl = import.meta.env.VITE_WS_URL || '';
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  
  // Check required variables
  if (!supabaseUrl) {
    missingVars.push('VITE_SUPABASE_URL');
  }
  
  if (!supabaseAnonKey) {
    missingVars.push('VITE_SUPABASE_ANON_KEY');
  }
  
  // API URL is optional (has fallback)
  // WebSocket URL is optional (has fallback)
  
  // Default API URL to Supabase Edge Functions (not localhost!)
  // This ensures production builds work even if VITE_API_URL is missing
  const defaultSupabaseUrl = 'https://plnylmnckssnfpwznpwf.supabase.co';
  const defaultApiUrl = `${defaultSupabaseUrl}/functions/v1`;
  
  return {
    apiUrl: apiUrl || defaultApiUrl,
    wsUrl: wsUrl || 'ws://localhost:3001',
    supabaseUrl: supabaseUrl || defaultSupabaseUrl,
    supabaseAnonKey,
    isConfigured: missingVars.length === 0,
    missingVars,
  };
}

/**
 * Get configuration error message for display
 */
export function getConfigErrorMessage(config: AppConfig): string {
  if (config.isConfigured) {
    return '';
  }
  
  return `缺少必要的环境变量：${config.missingVars.join(', ')}。请检查 Vercel 项目设置中的环境变量配置。`;
}

/**
 * Log configuration status to console (development only)
 */
export function logConfigStatus(config: AppConfig): void {
  if (!config.isConfigured) {
    console.error('[Config] ❌ Missing environment variables:', config.missingVars);
    console.error('[Config] This usually means:');
    console.error('[Config] 1. Environment variables are not set in Vercel project settings');
    console.error('[Config] 2. Build was triggered without the required VITE_* variables');
    console.error('[Config] 3. vercel.json env configuration is not being applied');
    console.error('[Config]');
    console.error('[Config] To fix:');
    console.error('[Config] - Go to Vercel Dashboard > Project > Settings > Environment Variables');
    console.error('[Config] - Add: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_URL');
    console.error('[Config] - Ensure they are marked as "Build" variables (not just Runtime)');
    console.error('[Config] - Redeploy the application');
  } else {
    console.log('[Config] ✅ Configuration validated successfully');
    console.log('[Config] API URL:', config.apiUrl);
    console.log('[Config] Supabase URL:', config.supabaseUrl);
    console.log('[Config] Supabase Key present:', config.supabaseAnonKey ? 'Yes (***' + config.supabaseAnonKey.slice(-8) + ')' : 'No');
  }
}

/**
 * Check if Supabase configuration appears valid (basic sanity check)
 */
export function isSupabaseConfigValid(config: AppConfig): boolean {
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    return false;
  }
  
  // Basic validation: Supabase URL should be a valid URL
  try {
    new URL(config.supabaseUrl);
  } catch {
    return false;
  }
  
  // Supabase anon key should be a JWT (has 3 parts separated by dots)
  const keyParts = config.supabaseAnonKey.split('.');
  if (keyParts.length !== 3) {
    return false;
  }
  
  return true;
}
