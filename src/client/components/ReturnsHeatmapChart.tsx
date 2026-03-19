/**
 * ReturnsHeatmapChart - 月度/年度收益热力图组件
 * 
 * Visualizes monthly returns as a calendar heatmap
 */

import React, { useMemo } from 'react';
import { Card, Spin, Empty, Typography, Space, Tooltip } from '@arco-design/web-react';

const { Text, _Title } = Typography;

export interface MonthlyReturn {
  year: number;
  month: number;
  return: number; // Percentage
  trades: number;
}

interface ReturnsHeatmapChartProps {
  data: MonthlyReturn[];
  loading?: boolean;
  title?: string;
  showYearlyTotals?: boolean;
}

const MONTHS = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
const MONTHS_SHORT = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

const formatPercent = (value: number): string => {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
};

const getColorForReturn = (returnValue: number): string => {
  // Color scale from red (negative) to green (positive)
  const absValue = Math.min(Math.abs(returnValue), 20); // Cap at 20%
  const intensity = absValue / 20; // 0 to 1
  
  if (returnValue >= 0) {
    // Green shades
    const green = Math.floor(180 + intensity * 75);
    return `rgb(${Math.floor(0 + intensity * 50)}, ${green}, ${Math.floor(100 - intensity * 50)})`;
  } else {
    // Red shades
    const red = Math.floor(180 + intensity * 75);
    return `rgb(${red}, ${Math.floor(100 - intensity * 50)}, ${Math.floor(80 - intensity * 30)})`;
  }
};

export const ReturnsHeatmapChart: React.FC<ReturnsHeatmapChartProps> = ({
  data,
  loading = false,
  title = '月度收益热力图',
  showYearlyTotals = true,
}) => {
  const heatmapData = useMemo(() => {
    if (!data || data.length === 0) return null;
    
    // Group by year
    const years: number[] = [];
    const yearMap: Map<number, Map<number, MonthlyReturn>> = new Map();
    
    for (const item of data) {
      if (!yearMap.has(item.year)) {
        yearMap.set(item.year, new Map());
        years.push(item.year);
      }
      yearMap.get(item.year)!.set(item.month, item);
    }
    
    years.sort((a, b) => b - a); // Most recent first
    
    // Calculate yearly totals
    const yearlyTotals: Map<number, number> = new Map();
    for (const [year, months] of yearMap) {
      const total = Array.from(months.values()).reduce((sum, m) => sum + m.return, 0);
      yearlyTotals.set(year, total);
    }
    
    return { years, yearMap, yearlyTotals };
  }, [data]);

  if (loading) {
    return (
      <Card title={title}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  if (!heatmapData) {
    return (
      <Card title={title}>
        <Empty description="暂无数据" />
      </Card>
    );
  }

  const { years, yearMap, yearlyTotals } = heatmapData;

  return (
    <Card title={title}>
      {/* Color legend */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        <Space>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 16, height: 16, backgroundColor: getColorForReturn(-20), borderRadius: 2 }} />
            <Text type="secondary">-20%</Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 16, height: 16, backgroundColor: getColorForReturn(-5), borderRadius: 2 }} />
            <Text type="secondary">-5%</Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 16, height: 16, backgroundColor: getColorForReturn(0), borderRadius: 2 }} />
            <Text type="secondary">0%</Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 16, height: 16, backgroundColor: getColorForReturn(5), borderRadius: 2 }} />
            <Text type="secondary">+5%</Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 16, height: 16, backgroundColor: getColorForReturn(20), borderRadius: 2 }} />
            <Text type="secondary">+20%</Text>
          </div>
        </Space>
      </div>

      {/* Heatmap grid */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ padding: 8, textAlign: 'center', width: 60 }}>年份</th>
              {MONTHS_SHORT.map((month, i) => (
                <th key={i} style={{ padding: 4, textAlign: 'center', minWidth: 50 }}>
                  {month}
                </th>
              ))}
              {showYearlyTotals && (
                <th style={{ padding: 8, textAlign: 'center', width: 70 }}>年度总计</th>
              )}
            </tr>
          </thead>
          <tbody>
            {years.map((year) => (
              <tr key={year}>
                <td style={{ padding: 8, textAlign: 'center', fontWeight: 'bold' }}>
                  {year}
                </td>
                {Array.from({ length: 12 }, (_, i) => {
                  const monthData = yearMap.get(year)?.get(i + 1);
                  if (!monthData) {
                    return (
                      <td key={i} style={{ padding: 2 }}>
                        <div
                          style={{
                            width: '100%',
                            height: 28,
                            backgroundColor: 'var(--color-fill-2)',
                            borderRadius: 2,
                          }}
                        />
                      </td>
                    );
                  }
                  
                  return (
                    <td key={i} style={{ padding: 2 }}>
                      <Tooltip
                        content={
                          <div>
                            <Text style={{ fontWeight: 'bold' }}>{MONTHS[i]} {year}</Text>
                            <br />
                            <Text>收益: {formatPercent(monthData.return)}</Text>
                            <br />
                            <Text type="secondary">交易: {monthData.trades} 次</Text>
                          </div>
                        }
                      >
                        <div
                          style={{
                            width: '100%',
                            height: 28,
                            backgroundColor: getColorForReturn(monthData.return),
                            borderRadius: 2,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: Math.abs(monthData.return) > 10 ? '#fff' : 'var(--color-text-1)',
                            cursor: 'pointer',
                          }}
                        >
                          {monthData.return.toFixed(0)}%
                        </div>
                      </Tooltip>
                    </td>
                  );
                })}
                {showYearlyTotals && (
                  <td style={{ padding: 2 }}>
                    <Tooltip content={`年度总收益: ${formatPercent(yearlyTotals.get(year) || 0)}`}>
                      <div
                        style={{
                          width: '100%',
                          height: 28,
                          backgroundColor: getColorForReturn(yearlyTotals.get(year) || 0),
                          borderRadius: 2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                        }}
                      >
                        {formatPercent(yearlyTotals.get(year) || 0)}
                      </div>
                    </Tooltip>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

export default ReturnsHeatmapChart;
