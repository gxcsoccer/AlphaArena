/**
 * Mock for lightweight-charts library
 */

export const CandlestickSeries = 'CandlestickSeries';
export const HistogramSeries = 'HistogramSeries';

export const createChart = jest.fn(() => ({
  addSeries: jest.fn((type: string, options?: any) => ({
    setData: jest.fn(),
    update: jest.fn(),
    applyOptions: jest.fn(),
  })),
  remove: jest.fn(),
  applyOptions: jest.fn(),
  resize: jest.fn(),
  priceScale: jest.fn(() => ({
    applyOptions: jest.fn(),
  })),
  timeScale: jest.fn(() => ({
    applyOptions: jest.fn(),
    scrollToPosition: jest.fn(),
    setVisibleRange: jest.fn(),
  })),
}));

export type IChartApi = any;
export type ISeriesApi<T = any> = any;
export type CandlestickData<T = any> = any;
export type Time = number | string;
export type UTCTimestamp = number;
