/**
 * Virtual Account API Routes
 * REST API endpoints for virtual trading account management
 */

import { Router, Request, Response, NextFunction } from 'express';
import { VirtualAccountService } from '../services/VirtualAccountService';
import { authMiddleware, optionalAuthMiddleware } from './authMiddleware';
import { createLogger } from '../utils/logger';

const log = createLogger('VirtualAccountRoutes');

/**
 * Create virtual account router
 */
export function createVirtualAccountRouter(): Router {
  const router = Router();
  const service = VirtualAccountService.getInstance();

  // ============================================
  // Account Endpoints
  // ============================================

  /**
   * @swagger
   * /api/account:
   *   get:
   *     summary: Get account summary
   *     description: Returns the user's virtual account with positions, balance, and P&L
   *     tags: [Virtual Account]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Account summary
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   $ref: '#/components/schemas/AccountSummary'
   *       401:
   *         description: Unauthorized
   */
  router.get('/account', authMiddleware, async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const summary = await service.getAccountSummary(req.user.id);

      if (!summary) {
        return res.status(404).json({
          success: false,
          error: 'Account not found',
        });
      }

      res.json({
        success: true,
        data: summary,
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
   * /api/account/reset:
   *   post:
   *     summary: Reset account
   *     description: Reset account to initial state, clearing all positions and orders
   *     tags: [Virtual Account]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               newCapital:
   *                 type: number
   *                 description: Optional new initial capital amount
   *     responses:
   *       200:
   *         description: Account reset successfully
   *       401:
   *         description: Unauthorized
   */
  router.post('/account/reset', authMiddleware, async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const { newCapital } = req.body;
      const account = await service.resetAccount(req.user.id, newCapital);

      res.json({
        success: true,
        data: account,
        message: 'Account reset successfully',
      });
    } catch (error: any) {
      log.error('Error resetting account:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * @swagger
   * /api/account/history:
   *   get:
   *     summary: Get account history
   *     description: Returns the account's value history for charting
   *     tags: [Virtual Account]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: snapshotType
   *         schema:
   *           type: string
   *           enum: [minute, hourly, daily, weekly]
   *       - in: query
   *         name: startDate
   *         schema:
   *           type: string
   *           format: date-time
   *       - in: query
   *         name: endDate
   *         schema:
   *           type: string
   *           format: date-time
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 100
   *     responses:
   *       200:
   *         description: Account history
   */
  router.get('/account/history', authMiddleware, async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const { snapshotType, startDate, endDate, limit } = req.query;

      const account = await service.getAccount(req.user.id);
      
      // Use DAO directly for history
      const { VirtualAccountDAO } = await import('../database/virtual-account.dao');
      const history = await VirtualAccountDAO.getValueHistory(account.id, {
        snapshotType: snapshotType as any,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: limit ? parseInt(limit as string) : 100,
      });

      res.json({
        success: true,
        data: history,
      });
    } catch (error: any) {
      log.error('Error getting account history:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // ============================================
  // Position Endpoints
  // ============================================

  /**
   * @swagger
   * /api/account/positions:
   *   get:
   *     summary: Get all positions
   *     description: Returns all positions for the user's account
   *     tags: [Virtual Account]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: List of positions
   */
  router.get('/account/positions', authMiddleware, async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const positions = await service.getPositions(req.user.id);

      res.json({
        success: true,
        data: positions,
      });
    } catch (error: any) {
      log.error('Error getting positions:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * @swagger
   * /api/account/positions/{symbol}:
   *   get:
   *     summary: Get position by symbol
   *     description: Returns the position for a specific symbol
   *     tags: [Virtual Account]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: symbol
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Position details
   *       404:
   *         description: Position not found
   */
  router.get('/account/positions/:symbol', authMiddleware, async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const symbol = Array.isArray(req.params.symbol) ? req.params.symbol[0] : req.params.symbol;
      const account = await service.getAccount(req.user.id);
      
      const { VirtualAccountDAO } = await import('../database/virtual-account.dao');
      const position = await VirtualAccountDAO.getPosition(account.id, symbol);

      if (!position) {
        return res.status(404).json({
          success: false,
          error: 'Position not found',
        });
      }

      res.json({
        success: true,
        data: position,
      });
    } catch (error: any) {
      log.error('Error getting position:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // ============================================
  // Order Endpoints
  // ============================================

  /**
   * @swagger
   * /api/account/orders:
   *   get:
   *     summary: Get orders
   *     description: Returns orders for the user's account
   *     tags: [Virtual Account]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: status
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *             enum: [pending, open, partial, filled, cancelled, rejected, expired]
   *       - in: query
   *         name: symbol
   *         schema:
   *           type: string
   *       - in: query
   *         name: side
   *         schema:
   *           type: string
   *           enum: [buy, sell]
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 50
   *       - in: query
   *         name: offset
   *         schema:
   *           type: integer
   *           default: 0
   *     responses:
   *       200:
   *         description: List of orders
   */
  router.get('/account/orders', authMiddleware, async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const { status, symbol, side, limit, offset } = req.query;

      const result = await service.getOrders(req.user.id, {
        status: status ? (status as string).split(',') as any : undefined,
        symbol: symbol as string,
        side: side as 'buy' | 'sell',
        limit: limit ? parseInt(limit as string) : 50,
        offset: offset ? parseInt(offset as string) : 0,
      });

      res.json({
        success: true,
        data: result.orders,
        total: result.total,
      });
    } catch (error: any) {
      log.error('Error getting orders:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * @swagger
   * /api/account/orders/{orderId}:
   *   get:
   *     summary: Get order by ID
   *     description: Returns a specific order
   *     tags: [Virtual Account]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: orderId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Order details
   *       404:
   *         description: Order not found
   */
  router.get('/account/orders/:orderId', authMiddleware, async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const orderId = Array.isArray(req.params.orderId) ? req.params.orderId[0] : req.params.orderId;
      const order = await service.getOrder(req.user.id, orderId);

      if (!order) {
        return res.status(404).json({
          success: false,
          error: 'Order not found',
        });
      }

      res.json({
        success: true,
        data: order,
      });
    } catch (error: any) {
      log.error('Error getting order:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * @swagger
   * /api/account/orders/buy:
   *   post:
   *     summary: Place a buy order
   *     description: Place a buy order (market or limit)
   *     tags: [Virtual Account]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - symbol
   *               - quantity
   *               - orderType
   *             properties:
   *               symbol:
   *                 type: string
   *               quantity:
   *                 type: number
   *               orderType:
   *                 type: string
   *                 enum: [market, limit]
   *               price:
   *                 type: number
   *                 description: Required for limit orders
   *               timeInForce:
   *                 type: string
   *                 enum: [GTC, IOC, FOK, GTD]
   *               expiresAt:
   *                 type: string
   *                 format: date-time
   *     responses:
   *       200:
   *         description: Order placed successfully
   *       400:
   *         description: Invalid parameters
   *       401:
   *         description: Unauthorized
   */
  router.post('/account/orders/buy', authMiddleware, async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const { symbol, quantity, orderType, price, timeInForce, expiresAt } = req.body;

      if (!symbol || !quantity || !orderType) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: symbol, quantity, orderType',
        });
      }

      if (orderType === 'limit' && !price) {
        return res.status(400).json({
          success: false,
          error: 'Price is required for limit orders',
        });
      }

      const result = await service.placeBuyOrder({
        userId: req.user.id,
        symbol,
        quantity,
        orderType,
        price,
        timeInForce,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      });

      if (result.success) {
        res.json({
          success: true,
          data: result.order,
          message: result.order?.status === 'filled' 
            ? 'Order executed successfully' 
            : 'Order placed successfully',
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error: any) {
      log.error('Error placing buy order:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * @swagger
   * /api/account/orders/sell:
   *   post:
   *     summary: Place a sell order
   *     description: Place a sell order (market or limit)
   *     tags: [Virtual Account]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - symbol
   *               - quantity
   *               - orderType
   *             properties:
   *               symbol:
   *                 type: string
   *               quantity:
   *                 type: number
   *               orderType:
   *                 type: string
   *                 enum: [market, limit]
   *               price:
   *                 type: number
   *                 description: Required for limit orders
   *               timeInForce:
   *                 type: string
   *                 enum: [GTC, IOC, FOK, GTD]
   *               expiresAt:
   *                 type: string
   *                 format: date-time
   *     responses:
   *       200:
   *         description: Order placed successfully
   *       400:
   *         description: Invalid parameters
   *       401:
   *         description: Unauthorized
   */
  router.post('/account/orders/sell', authMiddleware, async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const { symbol, quantity, orderType, price, timeInForce, expiresAt } = req.body;

      if (!symbol || !quantity || !orderType) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: symbol, quantity, orderType',
        });
      }

      if (orderType === 'limit' && !price) {
        return res.status(400).json({
          success: false,
          error: 'Price is required for limit orders',
        });
      }

      const result = await service.placeSellOrder({
        userId: req.user.id,
        symbol,
        quantity,
        orderType,
        price,
        timeInForce,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      });

      if (result.success) {
        res.json({
          success: true,
          data: result.order,
          message: result.order?.status === 'filled' 
            ? 'Order executed successfully' 
            : 'Order placed successfully',
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error: any) {
      log.error('Error placing sell order:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * @swagger
   * /api/account/orders/{orderId}/cancel:
   *   post:
   *     summary: Cancel an order
   *     description: Cancel a pending or open order
   *     tags: [Virtual Account]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: orderId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Order cancelled successfully
   *       400:
   *         description: Cannot cancel order
   *       404:
   *         description: Order not found
   */
  router.post('/account/orders/:orderId/cancel', authMiddleware, async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const orderId = Array.isArray(req.params.orderId) ? req.params.orderId[0] : req.params.orderId;
      const result = await service.cancelOrder(req.user.id, orderId);

      if (result.success) {
        res.json({
          success: true,
          data: result.order,
          message: 'Order cancelled successfully',
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error: any) {
      log.error('Error cancelling order:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // ============================================
  // Transaction Endpoints
  // ============================================

  /**
   * @swagger
   * /api/account/transactions:
   *   get:
   *     summary: Get transaction history
   *     description: Returns transaction history for the user's account
   *     tags: [Virtual Account]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: type
   *         schema:
   *           type: string
   *           enum: [deposit, withdraw, buy, sell, dividend, fee, adjustment, reset, frozen, unfrozen]
   *       - in: query
   *         name: symbol
   *         schema:
   *           type: string
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 50
   *       - in: query
   *         name: offset
   *         schema:
   *           type: integer
   *           default: 0
   *       - in: query
   *         name: startDate
   *         schema:
   *           type: string
   *           format: date-time
   *       - in: query
   *         name: endDate
   *         schema:
   *           type: string
   *           format: date-time
   *     responses:
   *       200:
   *         description: Transaction history
   */
  router.get('/account/transactions', authMiddleware, async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const { type, symbol, limit, offset, startDate, endDate } = req.query;

      const result = await service.getTransactions(req.user.id, {
        type: type as any,
        symbol: symbol as string,
        limit: limit ? parseInt(limit as string) : 50,
        offset: offset ? parseInt(offset as string) : 0,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });

      res.json({
        success: true,
        data: result.transactions,
        total: result.total,
      });
    } catch (error: any) {
      log.error('Error getting transactions:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // ============================================
  // Price Update Endpoint
  // ============================================

  /**
   * @swagger
   * /api/account/refresh-prices:
   *   post:
   *     summary: Refresh position prices
   *     description: Update all position prices with current market data
   *     tags: [Virtual Account]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Prices refreshed successfully
   */
  router.post('/account/refresh-prices', authMiddleware, async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      await service.updatePositionPrices(req.user.id);

      res.json({
        success: true,
        message: 'Position prices refreshed',
      });
    } catch (error: any) {
      log.error('Error refreshing prices:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  return router;
}

export default createVirtualAccountRouter;