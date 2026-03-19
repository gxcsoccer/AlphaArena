/**
 * Virtual Account API Routes
 * REST API endpoints for virtual trading account management
 */

import { Router, Request, Response } from 'express';
import { VirtualAccountService } from '../services/VirtualAccountService';
import { authMiddleware } from './authMiddleware';
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
   *     description: Place a buy order (market, limit, stop, or stop-limit)
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
   *                 enum: [market, limit, stop, stop_limit]
   *               price:
   *                 type: number
   *                 description: Required for limit and stop-limit orders
   *               stopPrice:
   *                 type: number
   *                 description: Required for stop and stop-limit orders
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

      const { symbol, quantity, orderType, price, stopPrice, timeInForce, expiresAt } = req.body;

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

      if ((orderType === 'stop' || orderType === 'stop_limit') && !stopPrice) {
        return res.status(400).json({
          success: false,
          error: 'Stop price is required for stop and stop-limit orders',
        });
      }

      if (orderType === 'stop_limit' && !price) {
        return res.status(400).json({
          success: false,
          error: 'Price is required for stop-limit orders',
        });
      }

      const result = await service.placeBuyOrder({
        userId: req.user.id,
        symbol,
        quantity,
        orderType,
        price,
        stopPrice,
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
   *     description: Place a sell order (market, limit, stop, stop-limit, or take-profit)
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
   *                 enum: [market, limit, stop, stop_limit, take_profit]
   *               price:
   *                 type: number
   *                 description: Required for limit and stop-limit orders
   *               stopPrice:
   *                 type: number
   *                 description: Required for stop, stop-limit, and take-profit orders
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

      const { symbol, quantity, orderType, price, stopPrice, timeInForce, expiresAt } = req.body;

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

      if ((orderType === 'stop' || orderType === 'stop_limit' || orderType === 'take_profit') && !stopPrice) {
        return res.status(400).json({
          success: false,
          error: 'Stop price is required for stop, stop-limit, and take-profit orders',
        });
      }

      if (orderType === 'stop_limit' && !price) {
        return res.status(400).json({
          success: false,
          error: 'Price is required for stop-limit orders',
        });
      }

      const result = await service.placeSellOrder({
        userId: req.user.id,
        symbol,
        quantity,
        orderType,
        price,
        stopPrice,
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

  /**
   * @swagger
   * /api/account/orders/{orderId}/modify:
   *   put:
   *     summary: Modify an order
   *     description: Modify price, stop price, or quantity of an open order
   *     tags: [Virtual Account]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: orderId
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               price:
   *                 type: number
   *               stopPrice:
   *                 type: number
   *               quantity:
   *                 type: number
   *     responses:
   *       200:
   *         description: Order modified successfully
   *       400:
   *         description: Cannot modify order
   *       404:
   *         description: Order not found
   */
  router.put('/account/orders/:orderId/modify', authMiddleware, async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const orderId = Array.isArray(req.params.orderId) ? req.params.orderId[0] : req.params.orderId;
      const { price, stopPrice, quantity } = req.body;

      const result = await service.modifyOrder(req.user.id, orderId, {
        price,
        stopPrice,
        quantity,
      });

      if (result.success) {
        res.json({
          success: true,
          data: result.order,
          message: 'Order modified successfully',
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error: any) {
      log.error('Error modifying order:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // ============================================
  // Advanced Order Endpoints
  // ============================================

  /**
   * @swagger
   * /api/account/orders/stop-loss:
   *   post:
   *     summary: Place a stop-loss order
   *     description: Place a stop-loss order that triggers a market order when price reaches stop price
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
   *               - side
   *               - quantity
   *               - stopPrice
   *             properties:
   *               symbol:
   *                 type: string
   *               side:
   *                 type: string
   *                 enum: [buy, sell]
   *               quantity:
   *                 type: number
   *               stopPrice:
   *                 type: number
   *               timeInForce:
   *                 type: string
   *                 enum: [GTC, IOC, FOK, GTD]
   *               expiresAt:
   *                 type: string
   *                 format: date-time
   *     responses:
   *       200:
   *         description: Stop-loss order placed successfully
   */
  router.post('/account/orders/stop-loss', authMiddleware, async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const { symbol, side, quantity, stopPrice, timeInForce, expiresAt } = req.body;

      if (!symbol || !side || !quantity || !stopPrice) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: symbol, side, quantity, stopPrice',
        });
      }

      const result = await service.placeStopLossOrder({
        userId: req.user.id,
        symbol,
        side,
        quantity,
        stopPrice,
        timeInForce,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      });

      if (result.success) {
        res.json({
          success: true,
          data: result.order,
          message: 'Stop-loss order placed successfully',
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error: any) {
      log.error('Error placing stop-loss order:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * @swagger
   * /api/account/orders/stop-limit:
   *   post:
   *     summary: Place a stop-limit order
   *     description: Place a stop-limit order that becomes a limit order when price reaches stop price
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
   *               - side
   *               - quantity
   *               - stopPrice
   *               - limitPrice
   *             properties:
   *               symbol:
   *                 type: string
   *               side:
   *                 type: string
   *                 enum: [buy, sell]
   *               quantity:
   *                 type: number
   *               stopPrice:
   *                 type: number
   *               limitPrice:
   *                 type: number
   *               timeInForce:
   *                 type: string
   *                 enum: [GTC, IOC, FOK, GTD]
   *               expiresAt:
   *                 type: string
   *                 format: date-time
   *     responses:
   *       200:
   *         description: Stop-limit order placed successfully
   */
  router.post('/account/orders/stop-limit', authMiddleware, async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const { symbol, side, quantity, stopPrice, limitPrice, timeInForce, expiresAt } = req.body;

      if (!symbol || !side || !quantity || !stopPrice || !limitPrice) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: symbol, side, quantity, stopPrice, limitPrice',
        });
      }

      const result = await service.placeStopLimitOrder({
        userId: req.user.id,
        symbol,
        side,
        quantity,
        stopPrice,
        limitPrice,
        timeInForce,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      });

      if (result.success) {
        res.json({
          success: true,
          data: result.order,
          message: 'Stop-limit order placed successfully',
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error: any) {
      log.error('Error placing stop-limit order:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * @swagger
   * /api/account/orders/take-profit:
   *   post:
   *     summary: Place a take-profit order
   *     description: Place a take-profit order to sell when price reaches target
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
   *               - targetPrice
   *             properties:
   *               symbol:
   *                 type: string
   *               quantity:
   *                 type: number
   *               targetPrice:
   *                 type: number
   *               timeInForce:
   *                 type: string
   *                 enum: [GTC, IOC, FOK, GTD]
   *               expiresAt:
   *                 type: string
   *                 format: date-time
   *     responses:
   *       200:
   *         description: Take-profit order placed successfully
   */
  router.post('/account/orders/take-profit', authMiddleware, async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const { symbol, quantity, targetPrice, timeInForce, expiresAt } = req.body;

      if (!symbol || !quantity || !targetPrice) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: symbol, quantity, targetPrice',
        });
      }

      const result = await service.placeTakeProfitOrder({
        userId: req.user.id,
        symbol,
        quantity,
        targetPrice,
        timeInForce,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      });

      if (result.success) {
        res.json({
          success: true,
          data: result.order,
          message: 'Take-profit order placed successfully',
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error: any) {
      log.error('Error placing take-profit order:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * @swagger
   * /api/account/orders/bracket:
   *   post:
   *     summary: Place a bracket order (OCO)
   *     description: Place a bracket order combining stop-loss and take-profit orders
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
   *               - stopLossPrice
   *               - takeProfitPrice
   *             properties:
   *               symbol:
   *                 type: string
   *               quantity:
   *                 type: number
   *               stopLossPrice:
   *                 type: number
   *               takeProfitPrice:
   *                 type: number
   *               timeInForce:
   *                 type: string
   *                 enum: [GTC, IOC, FOK, GTD]
   *               expiresAt:
   *                 type: string
   *                 format: date-time
   *     responses:
   *       200:
   *         description: Bracket order placed successfully
   */
  router.post('/account/orders/bracket', authMiddleware, async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const { symbol, quantity, stopLossPrice, takeProfitPrice, timeInForce, expiresAt } = req.body;

      if (!symbol || !quantity || !stopLossPrice || !takeProfitPrice) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: symbol, quantity, stopLossPrice, takeProfitPrice',
        });
      }

      const result = await service.placeBracketOrder({
        userId: req.user.id,
        symbol,
        quantity,
        stopLossPrice,
        takeProfitPrice,
        timeInForce,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      });

      if (result.success) {
        res.json({
          success: true,
          data: {
            stopLossOrder: result.stopLossOrder,
            takeProfitOrder: result.takeProfitOrder,
          },
          message: 'Bracket order placed successfully',
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error: any) {
      log.error('Error placing bracket order:', error);
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