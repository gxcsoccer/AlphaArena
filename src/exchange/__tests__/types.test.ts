import { OrderSide, OrderType, OrderStatus, TimeInForce, ConnectionStatus, ExchangeError, ExchangeErrorType } from '../types';

describe('Exchange Types', () => {
  describe('Enums', () => {
    it('should define OrderSide values', () => { expect(OrderSide.BUY).toBe('buy'); expect(OrderSide.SELL).toBe('sell'); });
    it('should define OrderType values', () => { expect(OrderType.MARKET).toBe('market'); expect(OrderType.LIMIT).toBe('limit'); });
    it('should define OrderStatus values', () => { expect(OrderStatus.NEW).toBe('new'); expect(OrderStatus.FILLED).toBe('filled'); });
    it('should define TimeInForce values', () => { expect(TimeInForce.GOOD_TILL_CANCEL).toBe('GTC'); });
    it('should define ConnectionStatus values', () => { expect(ConnectionStatus.CONNECTED).toBe('connected'); });
    it('should define ExchangeErrorType values', () => { expect(ExchangeErrorType.CONNECTION_ERROR).toBe('connection_error'); });
  });

  describe('ExchangeError', () => {
    it('should create an error with type and message', () => {
      const error = new ExchangeError(ExchangeErrorType.INVALID_ORDER, 'Test error');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ExchangeError);
      expect(error.name).toBe('ExchangeError');
      expect(error.message).toBe('Test error');
      expect(error.type).toBe(ExchangeErrorType.INVALID_ORDER);
    });

    it('should create an error with exchange ID', () => {
      const error = new ExchangeError(ExchangeErrorType.CONNECTION_ERROR, 'Connection failed', 'binance');
      expect(error.exchangeId).toBe('binance');
    });

    it('should be throwable and catchable', () => {
      expect(() => { throw new ExchangeError(ExchangeErrorType.RATE_LIMIT_ERROR, 'Rate limited'); }).toThrow(ExchangeError);
    });
  });
});
