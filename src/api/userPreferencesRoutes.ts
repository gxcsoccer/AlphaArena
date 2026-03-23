/**
 * User Preferences API Routes
 * 
 * Provides endpoints for managing user preferences including:
 * - Language preference
 * - Theme preference
 * - Notification settings
 * 
 * Issue #586: 语言切换功能实现
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from './authMiddleware';
import {
  getUserPreferences,
  updateUserPreferences,
  updateLanguagePreference,
  isValidLanguage,
  isValidTheme,
  SupportedLanguage,
  ThemePreference,
} from '../database/userPreferences.dao';
import { createLogger } from '../utils/logger';

const log = createLogger('UserPreferencesRoutes');

const router = Router();

/**
 * GET /api/user/preferences
 * Get current user's preferences
 */
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const preferences = await getUserPreferences(userId);

    res.json({
      success: true,
      data: preferences || {
        language: 'zh-CN',
        theme: 'system',
        timezone: 'Asia/Shanghai',
        notification_settings: {},
      },
    });
  } catch (error: any) {
    log.error('Error fetching user preferences:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user preferences',
    });
  }
});

/**
 * PATCH /api/user/preferences
 * Update user preferences
 */
router.patch('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const { language, theme, timezone, notification_settings } = req.body;
    const updates: {
      language?: SupportedLanguage;
      theme?: ThemePreference;
      timezone?: string;
      notification_settings?: Record<string, unknown>;
    } = {};

    // Validate and apply language update
    if (language !== undefined) {
      if (!isValidLanguage(language)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid language code. Supported: zh-CN, en-US',
        });
      }
      updates.language = language;
    }

    // Validate and apply theme update
    if (theme !== undefined) {
      if (!isValidTheme(theme)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid theme. Supported: light, dark, system',
        });
      }
      updates.theme = theme;
    }

    // Validate and apply timezone update
    if (timezone !== undefined) {
      if (typeof timezone !== 'string' || timezone.length > 50) {
        return res.status(400).json({
          success: false,
          error: 'Invalid timezone format',
        });
      }
      updates.timezone = timezone;
    }

    // Apply notification settings update
    if (notification_settings !== undefined) {
      if (typeof notification_settings !== 'object' || notification_settings === null) {
        return res.status(400).json({
          success: false,
          error: 'Invalid notification settings format',
        });
      }
      updates.notification_settings = notification_settings;
    }

    // Check if there's anything to update
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid update fields provided',
      });
    }

    const preferences = await updateUserPreferences(userId, updates);

    res.json({
      success: true,
      data: preferences,
    });
  } catch (error: any) {
    log.error('Error updating user preferences:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user preferences',
    });
  }
});

/**
 * PUT /api/user/preferences/language
 * Update only the language preference
 */
router.put('/language', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const { language } = req.body;

    if (!language) {
      return res.status(400).json({
        success: false,
        error: 'Language is required',
      });
    }

    if (!isValidLanguage(language)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid language code. Supported: zh-CN, en-US',
      });
    }

    const preferences = await updateLanguagePreference(userId, language);

    res.json({
      success: true,
      data: preferences,
    });
  } catch (error: any) {
    log.error('Error updating language preference:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update language preference',
    });
  }
});

export default router;