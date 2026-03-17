/**
 * StrategyComparisonChart - 策略对比图组件
 * 
 * Compare multiple strategies performance side by side
 */

import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import { Card, Spin, Empty, Typography, Space, Grid, Statistic, Select, Tabs, TabPane } from '@arco-design/web-react';

const { Text, Title } = Typography;
const { Row, Col } = Grid;

export interface StrategyMetrics {
  id: string;
  name: string;
  totalReturn: number;
  annualizedReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  avgReturn: number;
}

export interface StrategyEquityCurve {
  strategyId: string;
  timestamps: number[];
  equities: number[];
}

interface StrategyComparisonChartProps {
  strategies: StrategyMetrics[];
  equityCurves?: StrategyEquityCurve[];
  loading?: boolean;
  title?: string;
  height?: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

const formatPercent = (value: number): string => {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
};

const RadarTooltip: React.FC<{
  active?: boolean;
  payload?: any[];
}> = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div
        style={{
          backgroundColor: 'var(--color-bg-3)',
          border: '1px solid var(--color-border)',
          borderRadius: 4,
          padding: 12,
        }}
      >
        <Text style={{ fontWeight: 'bold' }}>{data.name}</Text>
        <br />
        <Text type="secondary">{data.fullName}: {data.value.toFixed(2)}</Text>
      </div>
    );
  }
  return null;
};

export const StrategyComparisonChart: React.FC<StrategyComparisonChartProps> = ({
  strategies,
  equityCurves,
  loading = false,
  title = '策略对比',
  height = 350,
}) => {
  const radarData = useMemo(() => {
    if (!strategies || strategies.length === 0) return [];
    
    // Normalize metrics to 0-100 scale for radar chart
    const maxValues = {
      totalReturn: Math.max(...strategies.map((s) => Math.abs(s.totalReturn))),
      sharpeRatio: Math.max(...strategies.map((s) => Math.abs(s.sharpeRatio))),
      winRate: 100, // Percentage
      profitFactor: Math.max(...strategies.map((s) => s.profitFactor)),
    };
    
    return [
      {
        metric: '收益',
        fullName: '总收益率',
        ...Object.fromEntries(
          strategies.map((s) => [s.name, (Math.abs(s.totalReturn) / (maxValues.totalReturn || 1)) * 100])
        ),
      },
      {
        metric: '夏普',
        fullName: '夏普比率',
        ...Object.fromEntries(
          strategies.map((s) => [s.name, (Math.abs(s.sharpeRatio) / (maxValues.sharpeRatio || 1)) * 100])
        ),
      },
      {
        metric: '胜率',
        fullName: '胜率',
        ...Object.fromEntries(
          strategies.map((s) => [s.name, s.winRate])
        ),
      },
      {
        metric: '盈亏比',
        fullName: '盈亏因子',
        ...Object.fromEntries(
          strategies.map((s) => [s.name, (s.profitFactor / (maxValues.profitFactor || 1)) * 100])
        ),
      },
    ];
  }, [strategies]);

  const barData = useMemo(() => {
    if (!strategies || strategies.length === 0) return [];
    
    return strategies.map((s) => ({
      name: s.name,
      总收益: s.totalReturn,
      夏普比: s.sharpeRatio * 10, // Scale for visibility
      最大回撤: -s.maxDrawdown,
      胜率: s.winRate,
    }));
  }, [strategies]);

  const equityChartData = useMemo(() => {
    if (!equityCurves || equityCurves.length === 0) return null;
    
    // Find the longest timeline
    const maxLength = Math.max(...equityCurves.map((c) => c.timestamps.length));
    const result: any[] = [];
    
    for (let i = 0; i < maxLength; i++) {
      const point: any = {
        index: i,
      };
      
      for (const curve of equityCurves) {
        if (i < curve.timestamps.length) {
          const strategy = strategies.find((s) => s.id === curve.strategyId);
          if (strategy) {
            point[strategy.name] = curve.equities[i];
          }
        }
      }
      
      result.push(point);
    }
    
    return result;
  }, [equityCurves, strategies]);

  if (loading) {
    return (
      <Card title={title}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height }}>
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  if (!strategies || strategies.length === 0) {
    return (
      <Card title={title}>
        <Empty description="暂无策略数据" />
      </Card>
    );
  }

  return (
    <Card title={title}>
      <Tabs defaultActiveTab="bar">
        <TabPane key="bar" title="柱状对比">
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={barData} layout="vertical" margin={{ left: 60, right: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis type="number" stroke="var(--color-text-3)" />
              <YAxis type="category" dataKey="name" stroke="var(--color-text-3)" width={80} />
              <Tooltip />
              <Legend />
              <Bar dataKey="总收益" fill="#0088FE" />
              <Bar dataKey="最大回撤" fill="#FF8042" />
              <Bar dataKey="胜率" fill="#00C49F" />
            </BarChart>
          </ResponsiveContainer>
        </TabPane>
        
        <TabPane key="radar" title="雷达图">
          <ResponsiveContainer width="100%" height={height}>
            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
              <PolarGrid stroke="var(--color-border)" />
              <PolarAngleAxis dataKey="metric" stroke="var(--color-text-3)" />
              <PolarRadiusAxis stroke="var(--color-text-3)" />
              {strategies.map((s, i) => (
                <Radar
                  key={s.id}
                  name={s.name}
                  dataKey={s.name}
                  stroke={COLORS[i % COLORS.length]}
                  fill={COLORS[i % COLORS.length]}
                  fillOpacity={0.3}
                />
              ))}
              <Legend />
              <Tooltip content={<RadarTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
        </TabPane>
        
        {equityChartData && (
          <TabPane key="equity" title="资金曲线">
            <ResponsiveContainer width="100%" height={height}>
              <LineChart data={equityChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="index" stroke="var(--color-text-3)" />
                <YAxis stroke="var(--color-text-3)" />
                <Tooltip />
                <Legend />
                {strategies.map((s, i) => (
                  <Line
                    key={s.id}
                    type="monotone"
                    dataKey={s.name}
                    stroke={COLORS[i % COLORS.length]}
                    dot={false}
                    strokeWidth={2}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </TabPane>
        )}
      </Tabs>
      
      {/* Strategy metrics table */}
      <div style={{ marginTop: 16, overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              <th style={{ padding: 8, textAlign: 'left' }}>策略</th>
              <th style={{ padding: 8, textAlign: 'right' }}>总收益</th>
              <th style={{ padding: 8, textAlign: 'right' }}>夏普比</th>
              <th style={{ padding: 8, textAlign: 'right' }}>最大回撤</th>
              <th style={{ padding: 8, textAlign: 'right' }}>胜率</th>
              <th style={{ padding: 8, textAlign: 'right' }}>盈亏比</th>
              <th style={{ padding: 8, textAlign: 'right' }}>交易次数</th>
            </tr>
          </thead>
          <tbody>
            {strategies.map((s) => (
              <tr key={s.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: 8 }}>{s.name}</td>
                <td style={{ padding: 8, textAlign: 'right', color: s.totalReturn >= 0 ? 'rgb(var(--success-6))' : 'rgb(var(--danger-6))' }}>
                  {formatPercent(s.totalReturn)}
                </td>
                <td style={{ padding: 8, textAlign: 'right' }}>{s.sharpeRatio.toFixed(2)}</td>
                <td style={{ padding: 8, textAlign: 'right', color: 'rgb(var(--danger-6))' }}>
                  {s.maxDrawdown.toFixed(2)}%
                </td>
                <td style={{ padding: 8, textAlign: 'right' }}>{s.winRate.toFixed(1)}%</td>
                <td style={{ padding: 8, textAlign: 'right' }}>{s.profitFactor.toFixed(2)}</td>
                <td style={{ padding: 8, textAlign: 'right' }}>{s.totalTrades}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

export default StrategyComparisonChart;
