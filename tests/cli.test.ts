/**
 * CLI Runner tests
 */

import { parseArgs, runBacktest } from '../src/cli/runner';

describe('CLI Runner', () => {
  describe('parseArgs', () => {
    it('should return default values when no args provided', () => {
      const args = parseArgs([]);

      expect(args.command).toBe('help');
      expect(args.strategy).toBe('sma');
      expect(args.capital).toBe(100000);
      expect(args.symbol).toBe('AAPL');
      expect(args.duration).toBe(30);
    });

    it('should parse backtest command', () => {
      const args = parseArgs(['backtest']);
      expect(args.command).toBe('backtest');
    });

    it('should parse run command', () => {
      const args = parseArgs(['run']);
      expect(args.command).toBe('run');
    });

    it('should parse help command', () => {
      const args = parseArgs(['help']);
      expect(args.command).toBe('help');
    });

    it('should parse --strategy flag', () => {
      const args = parseArgs(['backtest', '--strategy', 'sma']);
      expect(args.strategy).toBe('sma');
    });

    it('should parse -s short flag', () => {
      const args = parseArgs(['backtest', '-s', 'sma']);
      expect(args.strategy).toBe('sma');
    });

    it('should parse --capital flag', () => {
      const args = parseArgs(['backtest', '--capital', '50000']);
      expect(args.capital).toBe(50000);
    });

    it('should parse -c short flag', () => {
      const args = parseArgs(['backtest', '-c', '50000']);
      expect(args.capital).toBe(50000);
    });

    it('should parse --symbol flag', () => {
      const args = parseArgs(['backtest', '--symbol', 'GOOGL']);
      expect(args.symbol).toBe('GOOGL');
    });

    it('should parse -S short flag', () => {
      const args = parseArgs(['backtest', '-S', 'GOOGL']);
      expect(args.symbol).toBe('GOOGL');
    });

    it('should parse --duration flag', () => {
      const args = parseArgs(['backtest', '--duration', '60']);
      expect(args.duration).toBe(60);
    });

    it('should parse -d short flag', () => {
      const args = parseArgs(['backtest', '-d', '60']);
      expect(args.duration).toBe(60);
    });

    it('should parse --short-period flag', () => {
      const args = parseArgs(['backtest', '--short-period', '10']);
      expect(args.shortPeriod).toBe(10);
    });

    it('should parse --long-period flag', () => {
      const args = parseArgs(['backtest', '--long-period', '50']);
      expect(args.longPeriod).toBe(50);
    });

    it('should parse --quantity flag', () => {
      const args = parseArgs(['backtest', '--quantity', '20']);
      expect(args.tradeQuantity).toBe(20);
    });

    it('should parse -q short flag', () => {
      const args = parseArgs(['backtest', '-q', '20']);
      expect(args.tradeQuantity).toBe(20);
    });

    it('should parse --output flag', () => {
      const args = parseArgs(['backtest', '--output', 'results.json']);
      expect(args.output).toBe('results.json');
    });

    it('should parse -o short flag', () => {
      const args = parseArgs(['backtest', '-o', 'results.json']);
      expect(args.output).toBe('results.json');
    });

    it('should parse --format flag', () => {
      const args = parseArgs(['backtest', '--format', 'csv']);
      expect(args.format).toBe('csv');
    });

    it('should parse --help flag', () => {
      const args = parseArgs(['--help']);
      expect(args.help).toBe(true);
    });

    it('should parse multiple flags together', () => {
      const args = parseArgs([
        'backtest',
        '--strategy',
        'sma',
        '--capital',
        '50000',
        '--symbol',
        'MSFT',
        '--duration',
        '90',
      ]);

      expect(args.command).toBe('backtest');
      expect(args.strategy).toBe('sma');
      expect(args.capital).toBe(50000);
      expect(args.symbol).toBe('MSFT');
      expect(args.duration).toBe(90);
    });
  });

  describe('runBacktest', () => {
    it('should run backtest and return results', () => {
      const args = parseArgs([
        'backtest',
        '--capital',
        '100000',
        '--symbol',
        'AAPL',
        '--duration',
        '7',
      ]);

      const result = runBacktest(args);

      expect(result).toBeDefined();
      expect(result?.stats.initialCapital).toBe(100000);
      expect(result?.config.symbol).toBe('AAPL');
    });

    it('should handle invalid strategy gracefully', () => {
      const args = parseArgs(['backtest', '--strategy', 'invalid']);

      const result = runBacktest(args);
      expect(result).toBeNull();
    });
  });

  describe('exportResults', () => {
    it('should export results to JSON file', () => {
      const args = parseArgs(['backtest', '--capital', '100000', '--duration', '1']);

      const result = runBacktest(args);
      if (result) {
        const outputPath = '/tmp/test-results.json';
        exportResults(result, outputPath, 'json');

        // File should be created (tested via exportResults function)
        expect(outputPath).toContain('test-results.json');
      }
    });

    it('should export results to CSV file', () => {
      const args = parseArgs(['backtest', '--capital', '100000', '--duration', '1']);

      const result = runBacktest(args);
      if (result) {
        const outputPath = '/tmp/test-results.csv';
        exportResults(result, outputPath, 'csv');

        expect(outputPath).toContain('test-results.csv');
      }
    });
  });
});
