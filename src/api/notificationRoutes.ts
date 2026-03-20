/**
 * Notification API Routes
 * RESTful endpoints for notification management
 */

import { Router, Request, Response, NextFunction } from 'express';
import { NotificationService } from '../notification/NotificationService.js';
import getSupabaseClient from '../database/client.js';

const router = Router();

/**
 * Authentication middleware
 * Extracts user ID from Supabase auth token
 */
async function authenticateUser(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }
  
  const token = authHeader.substring(7);
  
  try {
    const supabase = getSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }
    
    (req as any).userId = user.id;
    next();
  } catch (err) {
    console.error('Auth error:', err);
    res.status(401).json({ error: 'Authentication failed' });
  }
}

/**
 * GET /api/notifications
 * Get user's notifications with optional filters
 */
router.get('/', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { type, is_read, priority, limit, offset } = req.query;
    
    const result = await NotificationService.getUserNotifications(userId, {
      type: type as any,
      is_read: is_read === 'true' ? true : is_read === 'false' ? false : undefined,
      priority: priority as any,
      limit: limit ? parseInt(String(limit), 10) : 20,
      offset: offset ? parseInt(String(offset), 10) : 0,
    });
    
    res.json({
      success: true,
      data: result.notifications,
      total: result.total,
    });
  } catch (err) {
    console.error('Error getting notifications:', err);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

/**
 * GET /api/notifications/unread-count
 * Get count of unread notifications
 */
router.get('/unread-count', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const count = await NotificationService.getUserUnreadCount(userId);
    
    res.json({
      success: true,
      count,
    });
  } catch (err) {
    console.error('Error getting unread count:', err);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

/**
 * PUT /api/notifications/:id/read
 * Mark a notification as read
 */
router.put('/:id/read', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    
    const notification = await NotificationService.readNotification(id, userId);
    
    if (!notification) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }
    
    res.json({
      success: true,
      data: notification,
    });
  } catch (err) {
    console.error('Error marking notification as read:', err);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

/**
 * PUT /api/notifications/read-all
 * Mark all notifications as read
 */
router.put('/read-all', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const count = await NotificationService.readAllNotifications(userId);
    
    res.json({
      success: true,
      marked_count: count,
    });
  } catch (err) {
    console.error('Error marking all notifications as read:', err);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

/**
 * DELETE /api/notifications/:id
 * Delete a notification
 */
router.delete('/:id', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    
    const success = await NotificationService.removeNotification(id, userId);
    
    if (!success) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }
    
    res.json({
      success: true,
    });
  } catch (err) {
    console.error('Error deleting notification:', err);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

/**
 * GET /api/notifications/preferences
 * Get user's notification preferences
 */
router.get('/preferences', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const preferences = await NotificationService.getUserPreferences(userId);
    
    if (!preferences) {
      res.status(404).json({ error: 'Preferences not found' });
      return;
    }
    
    res.json({
      success: true,
      data: preferences,
    });
  } catch (err) {
    console.error('Error getting preferences:', err);
    res.status(500).json({ error: 'Failed to get preferences' });
  }
});

/**
 * PUT /api/notifications/preferences
 * Update user's notification preferences
 */
router.put('/preferences', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const updates = req.body;
    
    // Validate input
    const validFields = [
      'in_app_enabled', 'email_enabled', 'push_enabled',
      'signal_notifications', 'risk_notifications', 
      'performance_notifications', 'system_notifications',
      'priority_threshold', 'quiet_hours_enabled',
      'quiet_hours_start', 'quiet_hours_end', 'quiet_hours_timezone',
      'digest_enabled', 'digest_frequency',
    ];
    
    const filteredUpdates: Record<string, any> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (validFields.includes(key)) {
        filteredUpdates[key] = value;
      }
    }
    
    if (Object.keys(filteredUpdates).length === 0) {
      res.status(400).json({ error: 'No valid fields to update' });
      return;
    }
    
    const preferences = await NotificationService.updateUserPreferences(userId, filteredUpdates);
    
    if (!preferences) {
      res.status(500).json({ error: 'Failed to update preferences' });
      return;
    }
    
    res.json({
      success: true,
      data: preferences,
    });
  } catch (err) {
    console.error('Error updating preferences:', err);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

/**
 * POST /api/notifications/test
 * Create a test notification (for development/testing)
 */
router.post('/test', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { type: _type = 'SYSTEM', title = 'Test Notification', message = 'This is a test notification' } = req.body;
    
    const notification = await NotificationService.createSystemNotification(
      userId,
      title,
      message,
      { event_type: 'info', details: 'Test notification created via API' }
    );
    
    if (!notification) {
      res.status(500).json({ error: 'Failed to create test notification' });
      return;
    }
    
    res.json({
      success: true,
      data: notification,
    });
  } catch (err) {
    console.error('Error creating test notification:', err);
    res.status(500).json({ error: 'Failed to create test notification' });
  }
});

export default router;
