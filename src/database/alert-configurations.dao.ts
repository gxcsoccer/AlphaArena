/**
 * Alert Configurations DAO
 * Data access layer for user alert configurations
 */

import { getSupabaseClient } from './client';

const getSupabase = () => getSupabaseClient();

export interface AlertConfiguration {
  id: string;
  user_id: string;
  alerts_enabled: boolean;
  default_channels: {
    in_app: boolean;
    email: boolean;
    webhook: boolean;
  };
  default_webhook_url?: string;
  email_enabled: boolean;
  email_address?: string;
  quiet_hours_enabled: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  quiet_hours_timezone?: string;
  max_alerts_per_hour: number;
  alert_cooldown_minutes: number;
  alert_preferences: Record<string, { enabled: boolean; severity_threshold: string }>;
  created_at: Date;
  updated_at: Date;
}

export interface UpdateAlertConfigurationInput {
  alerts_enabled?: boolean;
  default_channels?: {
    in_app: boolean;
    email: boolean;
    webhook: boolean;
  };
  default_webhook_url?: string;
  email_enabled?: boolean;
  email_address?: string;
  quiet_hours_enabled?: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  quiet_hours_timezone?: string;
  max_alerts_per_hour?: number;
  alert_cooldown_minutes?: number;
  alert_preferences?: Record<string, { enabled: boolean; severity_threshold: string }>;
}

/**
 * Get alert configuration for a user
 */
export async function getAlertConfiguration(userId: string): Promise<AlertConfiguration | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('alert_configurations')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    // If no configuration exists, create default one
    if (error.code === 'PGRST116') {
      return createDefaultAlertConfiguration(userId);
    }
    console.error('Error getting alert configuration:', error);
    return null;
  }

  return mapToAlertConfiguration(data);
}

/**
 * Create default alert configuration
 */
export async function createDefaultAlertConfiguration(
  userId: string
): Promise<AlertConfiguration | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('alert_configurations')
    .insert({ user_id: userId })
    .select()
    .single();

  if (error) {
    console.error('Error creating default alert configuration:', error);
    return null;
  }

  return mapToAlertConfiguration(data);
}

/**
 * Update alert configuration
 */
export async function updateAlertConfiguration(
  userId: string,
  input: UpdateAlertConfigurationInput
): Promise<AlertConfiguration | null> {
  // Ensure configuration exists
  const existing = await getAlertConfiguration(userId);
  if (!existing) {
    return null;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('alert_configurations')
    .update(input)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error updating alert configuration:', error);
    return null;
  }

  return mapToAlertConfiguration(data);
}

/**
 * Check if user is in quiet hours
 */
export async function isInQuietHours(userId: string): Promise<boolean> {
  const config = await getAlertConfiguration(userId);
  if (!config || !config.quiet_hours_enabled) {
    return false;
  }

  const now = new Date();
  const timezone = config.quiet_hours_timezone ?? 'UTC';
  
  try {
    // Get current time in the configured timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    });
    const currentHour = parseInt(formatter.format(now), 10);

    // Parse quiet hours
    const startHour = config.quiet_hours_start
      ? parseInt(config.quiet_hours_start.split(':')[0], 10)
      : 22;
    const endHour = config.quiet_hours_end
      ? parseInt(config.quiet_hours_end.split(':')[0], 10)
      : 8;

    // Check if current hour is within quiet hours
    if (startHour > endHour) {
      // Overnight quiet hours (e.g., 22:00 - 08:00)
      return currentHour >= startHour || currentHour < endHour;
    } else {
      // Daytime quiet hours
      return currentHour >= startHour && currentHour < endHour;
    }
  } catch {
    // If timezone is invalid, use UTC
    const currentHour = now.getUTCHours();
    const startHour = config.quiet_hours_start
      ? parseInt(config.quiet_hours_start.split(':')[0], 10)
      : 22;
    const endHour = config.quiet_hours_end
      ? parseInt(config.quiet_hours_end.split(':')[0], 10)
      : 8;

    if (startHour > endHour) {
      return currentHour >= startHour || currentHour < endHour;
    } else {
      return currentHour >= startHour && currentHour < endHour;
    }
  }
}

/**
 * Check if alert type is enabled for user
 */
export async function isAlertTypeEnabled(
  userId: string,
  alertType: string,
  severity: string
): Promise<boolean> {
  const config = await getAlertConfiguration(userId);
  if (!config || !config.alerts_enabled) {
    return false;
  }

  const preference = config.alert_preferences[alertType];
  if (!preference || !preference.enabled) {
    return false;
  }

  // Check severity threshold
  const severityLevels: Record<string, number> = {
    low: 0,
    medium: 1,
    high: 2,
    critical: 3,
  };

  const currentLevel = severityLevels[severity] ?? 1;
  const thresholdLevel = severityLevels[preference.severity_threshold] ?? 0;

  return currentLevel >= thresholdLevel;
}

/**
 * Helper to map database record to AlertConfiguration
 */
function mapToAlertConfiguration(data: Record<string, unknown>): AlertConfiguration {
  return {
    id: data.id as string,
    user_id: data.user_id as string,
    alerts_enabled: (data.alerts_enabled as boolean) ?? true,
    default_channels: (data.default_channels as {
      in_app: boolean;
      email: boolean;
      webhook: boolean;
    }) ?? { in_app: true, email: false, webhook: false },
    default_webhook_url: data.default_webhook_url as string | undefined,
    email_enabled: (data.email_enabled as boolean) ?? false,
    email_address: data.email_address as string | undefined,
    quiet_hours_enabled: (data.quiet_hours_enabled as boolean) ?? false,
    quiet_hours_start: data.quiet_hours_start as string | undefined,
    quiet_hours_end: data.quiet_hours_end as string | undefined,
    quiet_hours_timezone: data.quiet_hours_timezone as string | undefined,
    max_alerts_per_hour: (data.max_alerts_per_hour as number) ?? 10,
    alert_cooldown_minutes: (data.alert_cooldown_minutes as number) ?? 5,
    alert_preferences: (data.alert_preferences as Record<string, {
      enabled: boolean;
      severity_threshold: string;
    }>) ?? {
      consecutive_failures: { enabled: true, severity_threshold: 'medium' },
      execution_timeout: { enabled: true, severity_threshold: 'low' },
      position_limit: { enabled: true, severity_threshold: 'high' },
      circuit_breaker: { enabled: true, severity_threshold: 'critical' },
      error_rate: { enabled: true, severity_threshold: 'medium' },
      custom: { enabled: true, severity_threshold: 'medium' },
    },
    created_at: new Date(data.created_at as string),
    updated_at: new Date(data.updated_at as string),
  };
}

export const alertConfigurationsDao = {
  getAlertConfiguration,
  createDefaultAlertConfiguration,
  updateAlertConfiguration,
  isInQuietHours,
  isAlertTypeEnabled,
};

export default alertConfigurationsDao;
