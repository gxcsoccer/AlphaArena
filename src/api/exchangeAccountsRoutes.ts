/**
 * Exchange Accounts API Routes
 * REST API endpoints for multi-exchange account management
 */

import { Router, Request, Response } from 'express';
import { ExchangeAccountsService } from '../services/ExchangeAccountsService';
import { authMiddleware } from './authMiddleware';
import { createLogger } from '../utils/logger';

const log = createLogger('ExchangeAccountsRoutes');

/**
 * Create exchange accounts router
 */
export function createExchangeAccountsRouter(): Router {
  const router = Router();
  const service = ExchangeAccountsService.getInstance();

  // ============================================
  // Account Endpoints
  // ============================================

  /**
   * @swagger
   * /api/exchange-accounts:
   *   get:
   *     summary: Get all exchange accounts
   *     description: Returns all exchange accounts for the authenticated user
   *     tags: [Exchange Accounts]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: List of exchange accounts
   */
  router.get('/exchange-accounts', authMiddleware, async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const accounts = await service.getAccounts(req.user.id);

      res.json({
        success: true,
        data: accounts,
      });
    } catch (error: any) {
      log.error('Error getting accounts:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * @swagger
   * /api/exchange-accounts/primary:
   *   get:
   *     summary: Get primary account
   *     description: Returns the user's primary exchange account
   *     tags: [Exchange Accounts]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Primary account
   */
  router.get('/exchange-accounts/primary', authMiddleware, async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const account = await service.getPrimaryAccount(req.user.id);

      if (!account) {
        return res.status(404).json({
          success: false,
          error: 'No primary account found',
        });
      }

      res.json({
        success: true,
        data: account,
      });
    } catch (error: any) {
      log.error('Error getting primary account:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * @swagger
   * /api/exchange-accounts/unified:
   *   get:
   *     summary: Get unified account summary
   *     description: Returns a unified view of all accounts with aggregated balances and positions
   *     tags: [Exchange Accounts]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Unified account summary
   */
  router.get('/exchange-accounts/unified', authMiddleware, async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const summary = await service.getUnifiedSummary(req.user.id);

      res.json({
        success: true,
        data: summary,
      });
    } catch (error: any) {
      log.error('Error getting unified summary:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * @swagger
   * /api/exchange-accounts:
   *   post:
   *     summary: Add exchange account
   *     description: Add a new exchange account
   *     tags: [Exchange Accounts]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - name
   *               - exchange
   *               - environment
   *               - apiKey
   *               - apiSecret
   *             properties:
   *               name:
   *                 type: string
   *               exchange:
   *                 type: string
   *                 enum: [alpaca, binance, okx, bybit, mock]
   *               environment:
   *                 type: string
   *                 enum: [live, paper, testnet]
   *               apiKey:
   *                 type: string
   *               apiSecret:
   *                 type: string
   *               apiPassphrase:
   *                 type: string
   *               isPrimary:
   *                 type: boolean
   *     responses:
   *       201:
   *         description: Account created
   */
  router.post('/exchange-accounts', authMiddleware, async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const { name, exchange, environment, apiKey, apiSecret, apiPassphrase, isPrimary } = req.body;

      if (!name || !exchange || !environment || !apiKey || !apiSecret) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: name, exchange, environment, apiKey, apiSecret',
        });
      }

      const account = await service.addAccount(req.user.id, {
        name,
        exchange,
        environment,
        apiKey,
        apiSecret,
        apiPassphrase,
        isPrimary,
      });

      res.status(201).json({
        success: true,
        data: account,
        message: 'Exchange account added successfully',
      });
    } catch (error: any) {
      log.error('Error adding account:', error);
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * @swagger
   * /api/exchange-accounts/{accountId}:
   *   get:
   *     summary: Get account by ID
   *     tags: [Exchange Accounts]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: accountId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Account details
   */
  router.get('/exchange-accounts/:accountId', authMiddleware, async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const accountId = Array.isArray(req.params.accountId) 
        ? req.params.accountId[0] 
        : req.params.accountId;
      const account = await service.getAccount(req.user.id, accountId);

      if (!account) {
        return res.status(404).json({
          success: false,
          error: 'Account not found',
        });
      }

      res.json({
        success: true,
        data: account,
      });
    } catch (error: any) {
      log.error('Error getting account:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * @swagger
   * /api/exchange-accounts/{accountId}:
   *   put:
   *     summary: Update account
   *     tags: [Exchange Accounts]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: accountId
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *               apiKey:
   *                 type: string
   *               apiSecret:
   *                 type: string
   *               isPrimary:
   *                 type: boolean
   *     responses:
   *       200:
   *         description: Account updated
   */
  router.put('/exchange-accounts/:accountId', authMiddleware, async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const accountId = Array.isArray(req.params.accountId) 
        ? req.params.accountId[0] 
        : req.params.accountId;
      const { name, apiKey, apiSecret, apiPassphrase, isPrimary } = req.body;

      const account = await service.updateAccount(req.user.id, accountId, {
        name,
        apiKey,
        apiSecret,
        apiPassphrase,
        isPrimary,
      });

      res.json({
        success: true,
        data: account,
        message: 'Account updated successfully',
      });
    } catch (error: any) {
      log.error('Error updating account:', error);
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * @swagger
   * /api/exchange-accounts/{accountId}:
   *   delete:
   *     summary: Delete account
   *     tags: [Exchange Accounts]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: accountId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Account deleted
   */
  router.delete('/exchange-accounts/:accountId', authMiddleware, async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const accountId = Array.isArray(req.params.accountId) 
        ? req.params.accountId[0] 
        : req.params.accountId;
      await service.deleteAccount(req.user.id, accountId);

      res.json({
        success: true,
        message: 'Account deleted successfully',
      });
    } catch (error: any) {
      log.error('Error deleting account:', error);
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * @swagger
   * /api/exchange-accounts/{accountId}/set-primary:
   *   post:
   *     summary: Set as primary account
   *     tags: [Exchange Accounts]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: accountId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Primary account set
   */
  router.post('/exchange-accounts/:accountId/set-primary', authMiddleware, async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const accountId = Array.isArray(req.params.accountId) 
        ? req.params.accountId[0] 
        : req.params.accountId;
      await service.setPrimaryAccount(req.user.id, accountId);

      res.json({
        success: true,
        message: 'Primary account updated',
      });
    } catch (error: any) {
      log.error('Error setting primary account:', error);
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * @swagger
   * /api/exchange-accounts/{accountId}/switch:
   *   post:
   *     summary: Switch to account
   *     tags: [Exchange Accounts]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: accountId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Account switched
   */
  router.post('/exchange-accounts/:accountId/switch', authMiddleware, async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const accountId = Array.isArray(req.params.accountId) 
        ? req.params.accountId[0] 
        : req.params.accountId;
      const account = await service.switchAccount(req.user.id, accountId);

      res.json({
        success: true,
        data: account,
        message: 'Switched to account successfully',
      });
    } catch (error: any) {
      log.error('Error switching account:', error);
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * @swagger
   * /api/exchange-accounts/{accountId}/sync:
   *   post:
   *     summary: Sync account
   *     tags: [Exchange Accounts]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: accountId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Account synced
   */
  router.post('/exchange-accounts/:accountId/sync', authMiddleware, async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const accountId = Array.isArray(req.params.accountId) 
        ? req.params.accountId[0] 
        : req.params.accountId;
      await service.syncAccount(req.user.id, accountId);

      res.json({
        success: true,
        message: 'Account synced successfully',
      });
    } catch (error: any) {
      log.error('Error syncing account:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // ============================================
  // Account Group Endpoints
  // ============================================

  /**
   * @swagger
   * /api/account-groups:
   *   get:
   *     summary: Get all account groups
   *     tags: [Account Groups]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: List of account groups
   */
  router.get('/account-groups', authMiddleware, async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const groups = await service.getAccountGroups(req.user.id);

      res.json({
        success: true,
        data: groups,
      });
    } catch (error: any) {
      log.error('Error getting account groups:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * @swagger
   * /api/account-groups:
   *   post:
   *     summary: Create account group
   *     tags: [Account Groups]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - name
   *               - accountIds
   *             properties:
   *               name:
   *                 type: string
   *               description:
   *                 type: string
   *               accountIds:
   *                 type: array
   *                 items:
   *                   type: string
   *               strategyAllocation:
   *                 type: object
   *     responses:
   *       201:
   *         description: Account group created
   */
  router.post('/account-groups', authMiddleware, async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const { name, description, accountIds, strategyAllocation } = req.body;

      if (!name || !accountIds || !Array.isArray(accountIds) || accountIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: name, accountIds (non-empty array)',
        });
      }

      const group = await service.createAccountGroup(req.user.id, {
        name,
        description,
        accountIds,
        strategyAllocation,
      });

      res.status(201).json({
        success: true,
        data: group,
        message: 'Account group created successfully',
      });
    } catch (error: any) {
      log.error('Error creating account group:', error);
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * @swagger
   * /api/account-groups/{groupId}:
   *   get:
   *     summary: Get account group by ID
   *     tags: [Account Groups]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: groupId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Account group details
   */
  router.get('/account-groups/:groupId', authMiddleware, async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const groupId = Array.isArray(req.params.groupId) 
        ? req.params.groupId[0] 
        : req.params.groupId;
      const group = await service.getAccountGroup(req.user.id, groupId);

      if (!group) {
        return res.status(404).json({
          success: false,
          error: 'Account group not found',
        });
      }

      res.json({
        success: true,
        data: group,
      });
    } catch (error: any) {
      log.error('Error getting account group:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * @swagger
   * /api/account-groups/{groupId}:
   *   put:
   *     summary: Update account group
   *     tags: [Account Groups]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: groupId
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *               description:
   *                 type: string
   *               accountIds:
   *                 type: array
   *                 items:
   *                   type: string
   *               strategyAllocation:
   *                 type: object
   *     responses:
   *       200:
   *         description: Account group updated
   */
  router.put('/account-groups/:groupId', authMiddleware, async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const groupId = Array.isArray(req.params.groupId) 
        ? req.params.groupId[0] 
        : req.params.groupId;
      const { name, description, accountIds, strategyAllocation } = req.body;

      const group = await service.updateAccountGroup(req.user.id, groupId, {
        name,
        description,
        accountIds,
        strategyAllocation,
      });

      res.json({
        success: true,
        data: group,
        message: 'Account group updated successfully',
      });
    } catch (error: any) {
      log.error('Error updating account group:', error);
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * @swagger
   * /api/account-groups/{groupId}:
   *   delete:
   *     summary: Delete account group
   *     tags: [Account Groups]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: groupId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Account group deleted
   */
  router.delete('/account-groups/:groupId', authMiddleware, async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const groupId = Array.isArray(req.params.groupId) 
        ? req.params.groupId[0] 
        : req.params.groupId;
      await service.deleteAccountGroup(req.user.id, groupId);

      res.json({
        success: true,
        message: 'Account group deleted successfully',
      });
    } catch (error: any) {
      log.error('Error deleting account group:', error);
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  });

  return router;
}

export default createExchangeAccountsRouter;