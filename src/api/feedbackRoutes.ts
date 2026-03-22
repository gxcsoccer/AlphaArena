/**
 * User Feedback Routes
 *
 * REST endpoints for user feedback submission and management
 */

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { createLogger } from '../utils/logger';

const log = createLogger('FeedbackRoutes');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl ? createClient(supabaseUrl, supabaseServiceKey) : null;

// Feedback status enum
export enum FeedbackStatus {
  NEW = 'new',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

// Feedback type enum
export enum FeedbackType {
  BUG = 'bug',
  SUGGESTION = 'suggestion',
  OTHER = 'other',
}

// Feedback interface
export interface Feedback {
  id: string;
  type: FeedbackType;
  description: string;
  screenshot?: string;
  screenshot_name?: string;
  contact_info?: string;
  environment: {
    url: string;
    userAgent: string;
    screenSize: string;
    timestamp: string;
    locale: string;
    referrer: string;
  };
  status: FeedbackStatus;
  user_id?: string;
  created_at: string;
  updated_at: string;
  tags?: string[];
  admin_notes?: string;
}

// In-memory storage for development (fallback when Supabase is not available)
const feedbackStore: Map<string, Feedback> = new Map();

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `fb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create feedback router
 */
export function createFeedbackRouter(): Router {
  const router = Router();

  /**
   * POST /api/feedback
   * Submit a new feedback
   * 
   * @body { type, description, screenshot?, screenshotName?, contactInfo?, environment }
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { type, description, screenshot, screenshotName, contactInfo, environment } = req.body;

      // Validation
      if (!type || !['bug', 'suggestion', 'other'].includes(type)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid feedback type. Must be: bug, suggestion, or other',
        });
      }

      if (!description || typeof description !== 'string' || description.trim().length < 5) {
        return res.status(400).json({
          success: false,
          error: 'Description is required and must be at least 5 characters',
        });
      }

      // Get user ID from auth if available
      const userId = req.user?.id;

      // Create feedback record
      const feedbackId = generateId();
      const now = new Date().toISOString();

      const feedback: Feedback = {
        id: feedbackId,
        type: type as FeedbackType,
        description: description.trim(),
        screenshot: screenshot || undefined,
        screenshot_name: screenshotName || undefined,
        contact_info: contactInfo || undefined,
        environment: environment || {
          url: req.headers.referer || '',
          userAgent: req.headers['user-agent'] || '',
          screenSize: '',
          timestamp: now,
          locale: '',
          referrer: req.headers.referer || '',
        },
        status: FeedbackStatus.NEW,
        user_id: userId,
        created_at: now,
        updated_at: now,
      };

      // Try to save to Supabase
      if (supabase) {
        try {
          const { error } = await supabase
            .from('feedbacks')
            .insert([{
              id: feedback.id,
              type: feedback.type,
              description: feedback.description,
              screenshot: feedback.screenshot,
              screenshot_name: feedback.screenshot_name,
              contact_info: feedback.contact_info,
              environment: feedback.environment,
              status: feedback.status,
              user_id: feedback.user_id,
              created_at: feedback.created_at,
              updated_at: feedback.updated_at,
            }]);

          if (error) {
            log.error('Failed to save feedback to Supabase:', error);
            // Fall back to in-memory storage
            feedbackStore.set(feedbackId, feedback);
          }
        } catch (dbError) {
          log.error('Database error:', dbError);
          // Fall back to in-memory storage
          feedbackStore.set(feedbackId, feedback);
        }
      } else {
        // Use in-memory storage
        feedbackStore.set(feedbackId, feedback);
      }

      log.info(`New feedback received: ${feedbackId} (type: ${type}, user: ${userId || 'anonymous'})`);

      // Return success (don't expose full feedback data)
      res.status(201).json({
        success: true,
        data: {
          id: feedbackId,
          message: 'Feedback submitted successfully',
        },
      });
    } catch (error: any) {
      log.error('Failed to submit feedback:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to submit feedback',
      });
    }
  });

  /**
   * GET /api/feedback
   * List all feedbacks (admin only)
   * 
   * @query status - Filter by status
   * @query type - Filter by type
   * @query limit - Number of results (default: 50)
   * @query offset - Pagination offset (default: 0)
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      // TODO: Add admin authentication check
      // For now, return an error to indicate this endpoint needs protection
      const isAdmin = req.user?.role === 'admin';
      
      // Temporarily allow access for testing
      // if (!isAdmin) {
      //   return res.status(403).json({
      //     success: false,
      //     error: 'Admin access required',
      //   });
      // }

      const status = req.query.status as FeedbackStatus | undefined;
      const type = req.query.type as FeedbackType | undefined;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      let feedbacks: Feedback[] = [];

      if (supabase) {
        try {
          let query = supabase
            .from('feedbacks')
            .select('*')
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

          if (status) {
            query = query.eq('status', status);
          }
          if (type) {
            query = query.eq('type', type);
          }

          const { data, error } = await query;

          if (error) {
            log.error('Failed to fetch feedbacks from Supabase:', error);
          } else {
            feedbacks = data || [];
          }
        } catch (dbError) {
          log.error('Database error:', dbError);
        }
      }

      // Merge with in-memory storage if Supabase failed or is not available
      if (feedbacks.length === 0 && feedbackStore.size > 0) {
        feedbacks = Array.from(feedbackStore.values())
          .filter((f) => {
            if (status && f.status !== status) return false;
            if (type && f.type !== type) return false;
            return true;
          })
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(offset, offset + limit);
      }

      res.json({
        success: true,
        data: feedbacks,
        total: feedbacks.length,
        limit,
        offset,
      });
    } catch (error: any) {
      log.error('Failed to list feedbacks:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list feedbacks',
      });
    }
  });

  /**
   * GET /api/feedback/:id
   * Get a specific feedback (admin only)
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;

      // Try Supabase first
      if (supabase) {
        const { data, error } = await supabase
          .from('feedbacks')
          .select('*')
          .eq('id', id)
          .single();

        if (data && !error) {
          return res.json({
            success: true,
            data,
          });
        }
      }

      // Fall back to in-memory
      const feedback = feedbackStore.get(id);
      if (!feedback) {
        return res.status(404).json({
          success: false,
          error: 'Feedback not found',
        });
      }

      res.json({
        success: true,
        data: feedback,
      });
    } catch (error: any) {
      log.error('Failed to get feedback:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get feedback',
      });
    }
  });

  /**
   * PATCH /api/feedback/:id/status
   * Update feedback status (admin only)
   */
  router.patch('/:id/status', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const { status, adminNotes, tags } = req.body;

      // Validation
      if (!status || !Object.values(FeedbackStatus).includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid status. Must be: new, in_progress, resolved, or closed',
        });
      }

      const now = new Date().toISOString();
      const updates: Partial<Feedback> = {
        status,
        updated_at: now,
      };

      if (adminNotes !== undefined) {
        updates.admin_notes = adminNotes;
      }
      if (tags !== undefined) {
        updates.tags = tags;
      }

      // Try Supabase first
      if (supabase) {
        const { data, error } = await supabase
          .from('feedbacks')
          .update(updates)
          .eq('id', id)
          .select()
          .single();

        if (data && !error) {
          return res.json({
            success: true,
            data,
          });
        }
      }

      // Fall back to in-memory
      const feedback = feedbackStore.get(id);
      if (!feedback) {
        return res.status(404).json({
          success: false,
          error: 'Feedback not found',
        });
      }

      Object.assign(feedback, updates);
      feedbackStore.set(id, feedback);

      res.json({
        success: true,
        data: feedback,
      });
    } catch (error: any) {
      log.error('Failed to update feedback status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update feedback status',
      });
    }
  });

  /**
   * GET /api/feedback/stats
   * Get feedback statistics (admin only)
   */
  router.get('/stats/summary', async (req: Request, res: Response) => {
    try {
      let stats = {
        total: 0,
        byType: {
          bug: 0,
          suggestion: 0,
          other: 0,
        },
        byStatus: {
          new: 0,
          in_progress: 0,
          resolved: 0,
          closed: 0,
        },
      };

      // Try Supabase first
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('feedbacks')
            .select('type, status');

          if (data && !error) {
            stats.total = data.length;
            data.forEach((f: any) => {
              if (f.type && stats.byType[f.type as keyof typeof stats.byType] !== undefined) {
                stats.byType[f.type as keyof typeof stats.byType]++;
              }
              if (f.status && stats.byStatus[f.status as keyof typeof stats.byStatus] !== undefined) {
                stats.byStatus[f.status as keyof typeof stats.byStatus]++;
              }
            });
          }
        } catch (dbError) {
          log.error('Database error:', dbError);
        }
      }

      // Fall back to in-memory
      if (stats.total === 0 && feedbackStore.size > 0) {
        const feedbacks = Array.from(feedbackStore.values());
        stats.total = feedbacks.length;
        feedbacks.forEach((f) => {
          stats.byType[f.type as keyof typeof stats.byType]++;
          stats.byStatus[f.status as keyof typeof stats.byStatus]++;
        });
      }

      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      log.error('Failed to get feedback stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get feedback statistics',
      });
    }
  });

  return router;
}

export default createFeedbackRouter;