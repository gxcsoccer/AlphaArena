/**
 * PDF Reporter
 *
 * @module export/PDFReporter
 * @description Generates PDF reports for trading data
 */

import { TDocumentDefinitions, Content } from 'pdfmake/interfaces';
import {
  TradeExportData,
  PortfolioExportData,
  PerformanceMetrics,
  ExportResult,
} from './types';

/**
 * PDF Reporter class
 * Provides methods to generate PDF reports for various data types
 */
export class PDFReporter {
  private printer: any;

  constructor() {
    // Dynamic import for pdfmake
     
import PdfPrinter from 'pdfmake';
    
    // Define fonts for PDF (using standard fonts)
    const fonts = {
      Roboto: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique',
      },
    };

    this.printer = new PdfPrinter(fonts);
  }

  /**
   * Export trades to PDF
   * @param trades - Array of trade data
   * @param title - Report title
   * @returns Promise with ExportResult
   */
  async exportTrades(trades: TradeExportData[], title: string = 'Trade History Report'): Promise<ExportResult> {
    const tableBody: any[][] = [
      // Header row
      [
        { text: '#', style: 'tableHeader' },
        { text: 'Timestamp', style: 'tableHeader' },
        { text: 'Symbol', style: 'tableHeader' },
        { text: 'Side', style: 'tableHeader' },
        { text: 'Price', style: 'tableHeader' },
        { text: 'Quantity', style: 'tableHeader' },
        { text: 'Total', style: 'tableHeader' },
        { text: 'Fee', style: 'tableHeader' },
        { text: 'P&L', style: 'tableHeader' },
      ],
    ];

    // Add data rows
    trades.forEach((trade, index) => {
      tableBody.push([
        { text: (index + 1).toString(), fontSize: 8 },
        { text: trade.executedAt.toLocaleString(), fontSize: 8 },
        { text: trade.symbol, fontSize: 8 },
        {
          text: trade.side.toUpperCase(),
          fontSize: 8,
          color: trade.side === 'buy' ? 'green' : 'red',
        },
        { text: trade.price.toFixed(8), fontSize: 8, alignment: 'right' },
        { text: trade.quantity.toFixed(8), fontSize: 8, alignment: 'right' },
        { text: trade.total.toFixed(8), fontSize: 8, alignment: 'right' },
        { text: trade.fee.toFixed(8), fontSize: 8, alignment: 'right' },
        {
          text: trade.realizedPnL !== undefined ? trade.realizedPnL.toFixed(8) : '-',
          fontSize: 8,
          alignment: 'right',
          color:
            trade.realizedPnL !== undefined && trade.realizedPnL > 0
              ? 'green'
              : trade.realizedPnL !== undefined && trade.realizedPnL < 0
                ? 'red'
                : 'black',
        },
      ]);
    });

    const docDefinition: TDocumentDefinitions = {
      pageSize: 'A4',
      pageOrientation: 'landscape',
      pageMargins: [40, 60, 40, 60],
      content: [
        {
          text: title,
          style: 'header',
          alignment: 'center',
          margin: [0, 0, 0, 20] as [number, number, number, number],
        },
        {
          text: `Generated: ${new Date().toLocaleString()}`,
          style: 'subheader',
          alignment: 'right',
          margin: [0, 0, 0, 10] as [number, number, number, number],
        },
        {
          text: `Total Trades: ${trades.length}`,
          style: 'subheader',
          margin: [0, 0, 0, 15] as [number, number, number, number],
        },
        {
          table: {
            headerRows: 1,
            widths: ['auto', '*', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto'],
            body: tableBody,
          },
          layout: {
            hLineWidth: () => 1,
            vLineWidth: () => 1,
            hLineColor: () => '#CCCCCC',
            vLineColor: () => '#CCCCCC',
          },
        },
      ],
      styles: {
        header: {
          fontSize: 18,
          bold: true,
        },
        subheader: {
          fontSize: 10,
          color: '#666666',
        },
        tableHeader: {
          bold: true,
          fontSize: 9,
          fillColor: '#EEEEEE',
        },
      },
      defaultStyle: {
        font: 'Roboto',
      },
    };

    return this.createPdf(docDefinition, 'trades');
  }

  /**
   * Export portfolio snapshot to PDF
   * @param portfolio - Portfolio data
   * @returns Promise with ExportResult
   */
  async exportPortfolio(portfolio: PortfolioExportData): Promise<ExportResult> {
    const content: Content[] = [
      {
        text: 'Portfolio Report',
        style: 'header',
        alignment: 'center',
        margin: [0, 0, 0, 20] as [number, number, number, number],
      },
      {
        text: `Generated: ${new Date().toLocaleString()}`,
        style: 'subheader',
        alignment: 'right',
        margin: [0, 0, 0, 20] as [number, number, number, number],
      },
      {
        text: 'Portfolio Summary',
        style: 'sectionHeader',
        margin: [0, 0, 0, 10] as [number, number, number, number],
      },
      {
        table: {
          headerRows: 0,
          widths: ['40%', '60%'],
          body: [
            ['Snapshot Time', portfolio.timestamp.toLocaleString()],
            ['Total Value', `$${portfolio.totalValue.toFixed(2)}`],
            ['Cash Balance', `$${portfolio.cash.toFixed(2)}`],
            ['Unrealized P&L', `$${portfolio.unrealizedPnL.toFixed(2)}`],
          ],
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 20] as [number, number, number, number],
      },
    ];

    // Add positions section if available
    if (portfolio.positions.length > 0) {
      const positionsTable: any[][] = [
        [
          { text: 'Symbol', style: 'tableHeader' },
          { text: 'Quantity', style: 'tableHeader' },
          { text: 'Avg Cost', style: 'tableHeader' },
          { text: 'Value', style: 'tableHeader' },
          { text: 'P&L', style: 'tableHeader' },
          { text: 'P&L %', style: 'tableHeader' },
        ],
      ];

      portfolio.positions.forEach(pos => {
        positionsTable.push([
          { text: pos.symbol, fontSize: 9 },
          { text: pos.quantity.toFixed(8), fontSize: 9, alignment: 'right' },
          { text: pos.averageCost.toFixed(8), fontSize: 9, alignment: 'right' },
          { text: pos.value.toFixed(2), fontSize: 9, alignment: 'right' },
          {
            text: pos.unrealizedPnL.toFixed(2),
            fontSize: 9,
            alignment: 'right',
            color: pos.unrealizedPnL >= 0 ? 'green' : 'red',
          },
          {
            text: `${pos.pnlPercent.toFixed(2)}%`,
            fontSize: 9,
            alignment: 'right',
            color: pos.pnlPercent >= 0 ? 'green' : 'red',
          },
        ]);
      });

      content.push(
        {
          text: 'Positions',
          style: 'sectionHeader',
          margin: [0, 0, 0, 10] as [number, number, number, number],
        },
        {
          table: {
            headerRows: 1,
            widths: ['*', 'auto', 'auto', 'auto', 'auto', 'auto'],
            body: positionsTable,
          },
          layout: {
            hLineWidth: () => 1,
            vLineWidth: () => 1,
            hLineColor: () => '#CCCCCC',
            vLineColor: () => '#CCCCCC',
          },
        }
      );
    }

    const docDefinition: TDocumentDefinitions = {
      pageSize: 'A4',
      pageMargins: [40, 60, 40, 60],
      content,
      styles: {
        header: {
          fontSize: 18,
          bold: true,
        },
        subheader: {
          fontSize: 10,
          color: '#666666',
        },
        sectionHeader: {
          fontSize: 14,
          bold: true,
          margin: [0, 15, 0, 5] as [number, number, number, number],
        },
        tableHeader: {
          bold: true,
          fontSize: 9,
          fillColor: '#EEEEEE',
        },
      },
      defaultStyle: {
        font: 'Roboto',
      },
    };

    return this.createPdf(docDefinition, 'portfolio');
  }

  /**
   * Export performance metrics to PDF
   * @param metrics - Performance metrics data
   * @returns Promise with ExportResult
   */
  async exportPerformance(metrics: PerformanceMetrics): Promise<ExportResult> {
    const docDefinition: TDocumentDefinitions = {
      pageSize: 'A4',
      pageMargins: [40, 60, 40, 60],
      content: [
        {
          text: 'Performance Report',
          style: 'header',
          alignment: 'center',
          margin: [0, 0, 0, 20] as [number, number, number, number],
        },
        {
          text: `Period: ${metrics.startDate.toLocaleDateString()} - ${metrics.endDate.toLocaleDateString()}`,
          style: 'subheader',
          alignment: 'center',
          margin: [0, 0, 0, 20] as [number, number, number, number],
        },
        {
          text: 'Capital Summary',
          style: 'sectionHeader',
        },
        {
          table: {
            headerRows: 0,
            widths: ['50%', '50%'],
            body: [
              ['Initial Capital', `$${metrics.initialCapital.toFixed(2)}`],
              ['Final Capital', `$${metrics.finalCapital.toFixed(2)}`],
              ['Total Return', `${metrics.totalReturn.toFixed(2)}%`],
              ['Annualized Return', `${metrics.annualizedReturn.toFixed(2)}%`],
            ],
          },
          layout: 'noBorders',
          margin: [0, 0, 0, 20] as [number, number, number, number],
        },
        {
          text: 'Risk Metrics',
          style: 'sectionHeader',
        },
        {
          table: {
            headerRows: 0,
            widths: ['50%', '50%'],
            body: [
              ['Sharpe Ratio', metrics.sharpeRatio.toFixed(4)],
              ['Maximum Drawdown', `${metrics.maxDrawdown.toFixed(2)}%`],
            ],
          },
          layout: 'noBorders',
          margin: [0, 0, 0, 20] as [number, number, number, number],
        },
        {
          text: 'Trade Statistics',
          style: 'sectionHeader',
        },
        {
          table: {
            headerRows: 0,
            widths: ['50%', '50%'],
            body: [
              ['Total Trades', metrics.totalTrades.toString()],
              ['Winning Trades', metrics.winningTrades.toString()],
              ['Losing Trades', metrics.losingTrades.toString()],
              ['Win Rate', `${metrics.winRate.toFixed(2)}%`],
              ['Average Win', `$${metrics.avgWin.toFixed(2)}`],
              ['Average Loss', `$${metrics.avgLoss.toFixed(2)}`],
              ['Profit Factor', metrics.profitFactor.toFixed(4)],
              ['Total Volume', `$${metrics.totalVolume.toFixed(2)}`],
              ['Total Fees', `$${metrics.totalFees.toFixed(2)}`],
            ],
          },
          layout: 'noBorders',
        },
      ],
      styles: {
        header: {
          fontSize: 18,
          bold: true,
        },
        subheader: {
          fontSize: 12,
          color: '#666666',
        },
        sectionHeader: {
          fontSize: 14,
          bold: true,
          margin: [0, 15, 0, 5] as [number, number, number, number],
        },
      },
      defaultStyle: {
        font: 'Roboto',
      },
    };

    return this.createPdf(docDefinition, 'performance');
  }

  /**
   * Export backtest results to PDF
   * @param result - Backtest result data
   * @returns Promise with ExportResult
   */
  async exportBacktest(result: any): Promise<ExportResult> {
    const stats = result.stats || {};
    const docDefinition: TDocumentDefinitions = {
      pageSize: 'A4',
      pageMargins: [40, 60, 40, 60],
      content: [
        {
          text: 'Backtest Report',
          style: 'header',
          alignment: 'center',
          margin: [0, 0, 0, 20] as [number, number, number, number],
        },
        {
          text: 'Configuration',
          style: 'sectionHeader',
        },
        {
          table: {
            headerRows: 0,
            widths: ['40%', '60%'],
            body: [
              ['Symbol', result.config?.symbol || '-'],
              ['Strategy', result.config?.strategy || '-'],
              ['Initial Capital', `$${result.config?.capital?.toFixed(2) || '0'}`],
              [
                'Period',
                `${new Date(result.config?.startTime).toLocaleDateString()} - ${new Date(result.config?.endTime).toLocaleDateString()}`,
              ],
              ['Duration', `${result.duration || 0}ms`],
            ],
          },
          layout: 'noBorders',
          margin: [0, 0, 0, 20] as [number, number, number, number],
        },
        {
          text: 'Performance Statistics',
          style: 'sectionHeader',
        },
        {
          table: {
            headerRows: 0,
            widths: ['50%', '50%'],
            body: [
              ['Total Return', `${stats.totalReturn?.toFixed(2) || '0'}%`],
              ['Annualized Return', `${stats.annualizedReturn?.toFixed(2) || '0'}%`],
              ['Sharpe Ratio', stats.sharpeRatio?.toFixed(4) || '0'],
              ['Maximum Drawdown', `${stats.maxDrawdown?.toFixed(2) || '0'}%`],
            ],
          },
          layout: 'noBorders',
          margin: [0, 0, 0, 20] as [number, number, number, number],
        },
        {
          text: 'Trade Statistics',
          style: 'sectionHeader',
        },
        {
          table: {
            headerRows: 0,
            widths: ['50%', '50%'],
            body: [
              ['Total Trades', stats.totalTrades?.toString() || '0'],
              ['Winning Trades', stats.winningTrades?.toString() || '0'],
              ['Losing Trades', stats.losingTrades?.toString() || '0'],
              ['Win Rate', `${stats.winRate?.toFixed(2) || '0'}%`],
              ['Profit Factor', stats.profitFactor?.toFixed(4) || '0'],
            ],
          },
          layout: 'noBorders',
        },
      ],
      styles: {
        header: {
          fontSize: 18,
          bold: true,
        },
        sectionHeader: {
          fontSize: 14,
          bold: true,
          margin: [0, 15, 0, 5] as [number, number, number, number],
        },
      },
      defaultStyle: {
        font: 'Roboto',
      },
    };

    return this.createPdf(docDefinition, 'backtest');
  }

  /**
   * Create PDF from document definition
   * @param docDefinition - pdfmake document definition
   * @param prefix - Filename prefix
   * @returns Promise with ExportResult
   */
  private createPdf(docDefinition: TDocumentDefinitions, prefix: string): Promise<ExportResult> {
    return new Promise((resolve, reject) => {
      try {
        const pdfDoc = this.printer.createPdfKitDocument(docDefinition);
        const chunks: Buffer[] = [];

        pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk));
        pdfDoc.on('end', () => {
          const content = Buffer.concat(chunks);
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const filename = `${prefix}_${timestamp}.pdf`;

          resolve({
            content,
            contentType: 'application/pdf',
            filename,
            size: content.length,
          });
        });
        pdfDoc.on('error', reject);
        pdfDoc.end();
      } catch (error) {
        reject(error);
      }
    });
  }
}
