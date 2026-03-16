/**
 * Export Utilities for Trading History
 * 
 * Provides client-side generation of exports in CSV, JSON, and PDF formats.
 * Uses Papa Parse for CSV generation and jsPDF for PDF generation.
 */

import type { Trade } from './api';

export type ExportFormat = 'csv' | 'json' | 'pdf';

export interface ExportFilters {
  symbol?: string;
  side?: 'buy' | 'sell';
  strategyId?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface ExportProgress {
  status: 'preparing' | 'generating' | 'downloading' | 'complete' | 'error';
  progress: number; // 0-100
  message: string;
}

export interface ExportOptions {
  format: ExportFormat;
  filters: ExportFilters;
  includeSummary: boolean;
  timezone: string;
}

/**
 * Format a date for export
 */
function formatDate(date: Date | string, timezone: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/**
 * Format a number for export
 */
function formatNumber(num: number, decimals: number = 8): string {
  return num.toFixed(decimals);
}

/**
 * Calculate P&L summary from trades
 */
function calculateSummary(trades: Trade[]): {
  totalTrades: number;
  totalVolume: number;
  totalFees: number;
  buyCount: number;
  sellCount: number;
  buyVolume: number;
  sellVolume: number;
  averageTradeSize: number;
} {
  const buyTrades = trades.filter(t => t.side === 'buy');
  const sellTrades = trades.filter(t => t.side === 'sell');
  
  const buyVolume = buyTrades.reduce((sum, t) => sum + t.total, 0);
  const sellVolume = sellTrades.reduce((sum, t) => sum + t.total, 0);
  const totalVolume = buyVolume + sellVolume;
  const totalFees = trades.reduce((sum, t) => sum + (t.fee || 0), 0);
  
  return {
    totalTrades: trades.length,
    totalVolume,
    totalFees,
    buyCount: buyTrades.length,
    sellCount: sellTrades.length,
    buyVolume,
    sellVolume,
    averageTradeSize: trades.length > 0 ? totalVolume / trades.length : 0,
  };
}

/**
 * Filter trades based on export filters
 */
export function filterTrades(trades: Trade[], filters: ExportFilters): Trade[] {
  return trades.filter(trade => {
    if (filters.symbol && trade.symbol !== filters.symbol) return false;
    if (filters.side && trade.side !== filters.side) return false;
    if (filters.strategyId && trade.strategyId !== filters.strategyId) return false;
    if (filters.startDate) {
      const tradeDate = new Date(trade.executedAt);
      if (tradeDate < filters.startDate) return false;
    }
    if (filters.endDate) {
      const tradeDate = new Date(trade.executedAt);
      if (tradeDate > filters.endDate) return false;
    }
    return true;
  });
}

/**
 * Export trades to CSV format (Excel compatible)
 */
export function exportToCSV(
  trades: Trade[],
  options: ExportOptions,
  onProgress?: (progress: ExportProgress) => void
): string {
  onProgress?.({ status: 'generating', progress: 10, message: 'Generating CSV...' });
  
  const timezone = options.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const filteredTrades = filterTrades(trades, options.filters);
  
  // CSV header (BOM for Excel compatibility)
  const BOM = '\uFEFF';
  const headers = [
    'Timestamp',
    'Strategy ID',
    'Symbol',
    'Side',
    'Price',
    'Quantity',
    'Total',
    'Fee',
    'Order ID',
    'Trade ID',
  ];
  
  onProgress?.({ status: 'generating', progress: 30, message: 'Processing trades...' });
  
  // CSV rows
  const rows = filteredTrades.map(trade => [
    formatDate(trade.executedAt, timezone),
    trade.strategyId || '',
    trade.symbol,
    trade.side.toUpperCase(),
    formatNumber(trade.price),
    formatNumber(trade.quantity),
    formatNumber(trade.total, 2),
    trade.fee ? formatNumber(trade.fee, 4) : '0',
    trade.buyOrderId || trade.sellOrderId || '',
    trade.id,
  ]);
  
  onProgress?.({ status: 'generating', progress: 70, message: 'Finalizing CSV...' });
  
  // Build CSV content
  let csvContent = BOM + headers.join(',') + '\n';
  rows.forEach(row => {
    // Escape fields that contain commas or quotes
    const escapedRow = row.map(field => {
      if (field.includes(',') || field.includes('"') || field.includes('\n')) {
        return '"' + field.replace(/"/g, '""') + '"';
      }
      return field;
    });
    csvContent += escapedRow.join(',') + '\n';
  });
  
  // Add summary if requested
  if (options.includeSummary && filteredTrades.length > 0) {
    const summary = calculateSummary(filteredTrades);
    csvContent += '\n';
    csvContent += 'SUMMARY\n';
    csvContent += 'Total Trades,' + summary.totalTrades + '\n';
    csvContent += 'Total Volume,$' + summary.totalVolume.toFixed(2) + '\n';
    csvContent += 'Total Fees,$' + summary.totalFees.toFixed(4) + '\n';
    csvContent += 'Buy Trades,' + summary.buyCount + '\n';
    csvContent += 'Sell Trades,' + summary.sellCount + '\n';
    csvContent += 'Buy Volume,$' + summary.buyVolume.toFixed(2) + '\n';
    csvContent += 'Sell Volume,$' + summary.sellVolume.toFixed(2) + '\n';
    csvContent += 'Average Trade Size,$' + summary.averageTradeSize.toFixed(2) + '\n';
  }
  
  onProgress?.({ status: 'complete', progress: 100, message: 'CSV export complete' });
  
  return csvContent;
}

/**
 * Export trades to JSON format
 */
export function exportToJSON(
  trades: Trade[],
  options: ExportOptions,
  onProgress?: (progress: ExportProgress) => void
): string {
  onProgress?.({ status: 'generating', progress: 10, message: 'Generating JSON...' });
  
  const timezone = options.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const filteredTrades = filterTrades(trades, options.filters);
  
  onProgress?.({ status: 'generating', progress: 30, message: 'Processing trades...' });
  
  const exportData = {
    exportInfo: {
      exportedAt: new Date().toISOString(),
      timezone: timezone,
      filters: options.filters,
      totalRecords: filteredTrades.length,
    },
    trades: filteredTrades.map(trade => ({
      id: trade.id,
      strategyId: trade.strategyId,
      symbol: trade.symbol,
      side: trade.side,
      price: trade.price,
      quantity: trade.quantity,
      total: trade.total,
      fee: trade.fee || 0,
      executedAt: formatDate(trade.executedAt, timezone),
      executedAtISO: new Date(trade.executedAt).toISOString(),
    })),
  };
  
  onProgress?.({ status: 'generating', progress: 70, message: 'Finalizing JSON...' });
  
  // Add summary if requested
  if (options.includeSummary && filteredTrades.length > 0) {
    (exportData as any).summary = calculateSummary(filteredTrades);
  }
  
  onProgress?.({ status: 'complete', progress: 100, message: 'JSON export complete' });
  
  return JSON.stringify(exportData, null, 2);
}

/**
 * Export trades to PDF format (HTML)
 */
export function exportToPDF(
  trades: Trade[],
  options: ExportOptions,
  onProgress?: (progress: ExportProgress) => void
): string {
  onProgress?.({ status: 'generating', progress: 10, message: 'Generating PDF...' });
  
  const timezone = options.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const filteredTrades = filterTrades(trades, options.filters);
  
  onProgress?.({ status: 'generating', progress: 30, message: 'Building PDF content...' });
  
  const summary = options.includeSummary && filteredTrades.length > 0 
    ? calculateSummary(filteredTrades) 
    : null;
  
  const filterInfo = [];
  if (options.filters.symbol) filterInfo.push('<p><strong>Symbol Filter:</strong> ' + options.filters.symbol + '</p>');
  if (options.filters.side) filterInfo.push('<p><strong>Side Filter:</strong> ' + options.filters.side + '</p>');
  if (options.filters.startDate) filterInfo.push('<p><strong>Start Date:</strong> ' + options.filters.startDate.toLocaleDateString() + '</p>');
  if (options.filters.endDate) filterInfo.push('<p><strong>End Date:</strong> ' + options.filters.endDate.toLocaleDateString() + '</p>');
  
  let summarySection = '';
  if (summary) {
    summarySection = `
  <h2>Summary</h2>
  <div class="summary-grid">
    <div class="summary-card">
      <h3>Total Trades</h3>
      <p>${summary.totalTrades}</p>
    </div>
    <div class="summary-card">
      <h3>Total Volume</h3>
      <p>$${summary.totalVolume.toFixed(2)}</p>
    </div>
    <div class="summary-card">
      <h3>Total Fees</h3>
      <p>$${summary.totalFees.toFixed(4)}</p>
    </div>
    <div class="summary-card">
      <h3>Buy Trades</h3>
      <p>${summary.buyCount}</p>
    </div>
    <div class="summary-card">
      <h3>Sell Trades</h3>
      <p>${summary.sellCount}</p>
    </div>
    <div class="summary-card">
      <h3>Avg Trade Size</h3>
      <p>$${summary.averageTradeSize.toFixed(2)}</p>
    </div>
  </div>`;
  }
  
  onProgress?.({ status: 'generating', progress: 60, message: 'Building trade table...' });
  
  // Build trades table rows
  const tradeRows = filteredTrades.map(trade => {
    const sideClass = trade.side === 'buy' ? 'buy' : 'sell';
    return `<tr>
        <td>${formatDate(trade.executedAt, timezone)}</td>
        <td>${trade.symbol}</td>
        <td class="${sideClass}">${trade.side.toUpperCase()}</td>
        <td>$${trade.price.toLocaleString()}</td>
        <td>${trade.quantity.toFixed(8)}</td>
        <td>$${trade.total.toLocaleString()}</td>
        <td>${trade.fee ? '$' + trade.fee.toFixed(4) : '-'}</td>
      </tr>`;
  }).join('\n');
  
  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Trading History Export - ${new Date().toLocaleDateString()}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      margin: 40px;
      color: #333;
      line-height: 1.6;
    }
    h1 {
      color: #1a1a1a;
      border-bottom: 2px solid #4a90d9;
      padding-bottom: 10px;
    }
    h2 {
      color: #4a90d9;
      margin-top: 30px;
    }
    .export-info {
      background: #f5f5f5;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .export-info p {
      margin: 5px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
      font-size: 12px;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 10px 8px;
      text-align: left;
    }
    th {
      background: #4a90d9;
      color: white;
      font-weight: 600;
    }
    tr:nth-child(even) {
      background: #f9f9f9;
    }
    .buy {
      color: #22c55e;
      font-weight: 600;
    }
    .sell {
      color: #ef4444;
      font-weight: 600;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
      margin-top: 20px;
    }
    .summary-card {
      background: #f5f5f5;
      padding: 15px;
      border-radius: 8px;
      text-align: center;
    }
    .summary-card h3 {
      margin: 0;
      font-size: 14px;
      color: #666;
    }
    .summary-card p {
      margin: 10px 0 0;
      font-size: 24px;
      font-weight: 600;
      color: #1a1a1a;
    }
    .footer {
      margin-top: 40px;
      text-align: center;
      color: #666;
      font-size: 12px;
    }
    @media print {
      body { margin: 20px; }
      .summary-grid { grid-template-columns: repeat(3, 1fr); }
    }
  </style>
</head>
<body>
  <h1>Trading History Report</h1>
  
  <div class="export-info">
    <p><strong>Exported:</strong> ${new Date().toLocaleString()}</p>
    <p><strong>Timezone:</strong> ${timezone}</p>
    <p><strong>Total Records:</strong> ${filteredTrades.length}</p>
    ${filterInfo.join('')}
  </div>
  
  ${summarySection}
  
  <h2>Trade History</h2>
  <table>
    <thead>
      <tr>
        <th>Timestamp</th>
        <th>Symbol</th>
        <th>Side</th>
        <th>Price</th>
        <th>Quantity</th>
        <th>Total</th>
        <th>Fee</th>
      </tr>
    </thead>
    <tbody>
      ${tradeRows}
    </tbody>
  </table>
  
  <div class="footer">
    <p>Generated by AlphaArena Trading Platform</p>
  </div>
</body>
</html>`;
  
  onProgress?.({ status: 'complete', progress: 100, message: 'PDF export complete' });
  
  return htmlContent;
}

/**
 * Download exported content as a file
 */
export function downloadExport(
  content: string,
  format: ExportFormat,
  filename?: string
): void {
  const timestamp = new Date().toISOString().split('T')[0];
  const defaultFilename = 'trades-export-' + timestamp;
  
  let mimeType: string;
  let extension: string;
  
  switch (format) {
    case 'csv':
      mimeType = 'text/csv;charset=utf-8';
      extension = '.csv';
      break;
    case 'json':
      mimeType = 'application/json;charset=utf-8';
      extension = '.json';
      break;
    case 'pdf':
      mimeType = 'text/html;charset=utf-8';
      extension = '.html';
      break;
    default:
      mimeType = 'text/plain;charset=utf-8';
      extension = '.txt';
  }
  
  const finalFilename = filename || (defaultFilename + extension);
  
  // Create blob and download
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = finalFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Main export function that handles all formats
 */
export function exportTrades(
  trades: Trade[],
  options: ExportOptions,
  onProgress?: (progress: ExportProgress) => void
): string {
  onProgress?.({ status: 'preparing', progress: 0, message: 'Preparing export...' });
  
  let content: string;
  
  switch (options.format) {
    case 'csv':
      content = exportToCSV(trades, options, onProgress);
      break;
    case 'json':
      content = exportToJSON(trades, options, onProgress);
      break;
    case 'pdf':
      content = exportToPDF(trades, options, onProgress);
      break;
    default:
      throw new Error('Unsupported export format: ' + options.format);
  }
  
  return content;
}
