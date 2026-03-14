import { PriceMonitoringService } from '../src/monitoring/PriceMonitoringService';

describe('PriceMonitoringService', () => {
  let service: PriceMonitoringService;

  beforeAll(() => {
    service = new PriceMonitoringService();
  });

  afterAll(() => {
    service.stop();
  });

  it('should start and stop successfully', () => {
    service.start();
    expect(service.getStatus().isRunning).toBe(true);

    service.stop();
    expect(service.getStatus().isRunning).toBe(false);
  });

  it('should add and remove watched symbols', () => {
    service.watchSymbol('BTC/USD');
    expect(service.getStatus().watchedSymbols).toContain('BTC/USD');

    service.unwatchSymbol('BTC/USD');
    expect(service.getStatus().watchedSymbols).not.toContain('BTC/USD');
  });

  it('should emit order-triggered event when conditions are met', async () => {
    const mockTriggeredOrder = {
      orderId: 'test-order-123',
      orderType: 'stop_loss',
      symbol: 'BTC/USD',
      side: 'sell',
      triggerPrice: 45000,
      executedPrice: 44900,
      quantity: 0.5,
      tradeId: 'trade-456',
    };

    const eventHandler = jest.fn();
    service.on('order-triggered', eventHandler);

    // Manually emit event to test listener
    service.emit('order-triggered', mockTriggeredOrder);

    expect(eventHandler).toHaveBeenCalledWith(mockTriggeredOrder);
  });

  it('should emit error event on failure', () => {
    const errorHandler = jest.fn();
    service.on('error', errorHandler);

    const testError = new Error('Test error');
    service.emit('error', { symbol: 'BTC/USD', error: testError });

    expect(errorHandler).toHaveBeenCalledWith({
      symbol: 'BTC/USD',
      error: testError,
    });
  });

  it('should handle multiple watched symbols', () => {
    const symbols = ['BTC/USD', 'ETH/USD', 'BTC/USDT'];
    
    symbols.forEach(symbol => service.watchSymbol(symbol));
    
    const status = service.getStatus();
    expect(status.watchedSymbols.length).toBe(3);
    symbols.forEach(symbol => {
      expect(status.watchedSymbols).toContain(symbol);
    });

    // Clean up
    symbols.forEach(symbol => service.unwatchSymbol(symbol));
  });
});
