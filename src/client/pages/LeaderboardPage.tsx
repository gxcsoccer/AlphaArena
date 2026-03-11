import React, { useState, useMemo } from 'react';
import { Layout, Typography, Card, Table, Tag, Row, Col, Statistic, Avatar, Progress, Space } from 'antd';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import { useStrategies, useTrades } from '../hooks/useData';
import type { ColumnsType } from 'antd/es/table';
import type { Strategy, Trade } from '../utils/api';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

interface StrategyRanking {
  id: string;
  name: string;
  totalTrades: number;
  winRate: number;
  totalPnL: number;
  totalVolume: number;
  avgTradeSize: number;
  roi: number;
}

const LeaderboardPage: React.FC = () => {
  const { strategies, loading: strategiesLoading } = useStrategies();
  const { trades, loading: tradesLoading } = useTrades({}, 1000);

  // Calculate rankings
  const rankings: StrategyRanking[] = useMemo(() => {
    return strategies.map(strategy => {
      const strategyTrades = trades.filter(t => t.strategyId === strategy.id);
      const buys = strategyTrades.filter(t => t.side === 'buy');
      const sells = strategyTrades.filter(t => t.side === 'sell');

      const totalCost = buys.reduce((sum, t) => sum + t.total, 0);
      const totalProceeds = sells.reduce((sum, t) => sum + t.total, 0);
      const totalPnL = totalProceeds - totalCost;
      const totalVolume = strategyTrades.reduce((sum, t) => sum + t.total, 0);

      // Calculate win rate (simplified: count profitable sells)
      const profitableSells = sells.filter(sell => {
        const correspondingBuy = buys.find(b => b.id === sell.sellOrderId);
        return correspondingBuy && sell.total > correspondingBuy.total;
      }).length;
      const winRate = sells.length > 0 ? (profitableSells / sells.length) * 100 : 0;

      // Calculate ROI
      const roi = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

      return {
        id: strategy.id,
        name: strategy.name,
        totalTrades: strategyTrades.length,
        winRate,
        totalPnL,
        totalVolume,
        avgTradeSize: strategyTrades.length > 0 ? totalVolume / strategyTrades.length : 0,
        roi,
      };
    }).sort((a, b) => b.totalPnL - a.totalPnL);
  }, [strategies, trades]);

  // Prepare chart data
  const rankingChartData = rankings.map((r, index) => ({
    name: `#${index + 1}`,
    strategy: r.name,
    pnl: r.totalPnL,
    roi: r.roi,
  }));

  const radarData = rankings.slice(0, 5).map(r => ({
    strategy: r.name,
    pnl: Math.abs(r.totalPnL) / 1000, // Normalize
    winRate: r.winRate,
    volume: r.totalVolume / 10000, // Normalize
    trades: r.totalTrades,
  }));

  const winRateData = rankings.map(r => ({
    name: r.name,
    winRate: r.winRate,
    lossRate: 100 - r.winRate,
  }));

  // Ranking table columns
  const rankingColumns: ColumnsType<StrategyRanking> = [
    {
      title: 'Rank',
      key: 'rank',
      width: 80,
      render: (_: any, __: any, index: number) => {
        const rank = index + 1;
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
        return (
          <Space>
            <Avatar style={{ backgroundColor: rank <= 3 ? '#f56a00' : '#87d068' }}>
              {medal}
            </Avatar>
          </Space>
        );
      },
    },
    {
      title: 'Strategy',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: 'Status',
      key: 'status',
      width: 100,
      render: (_: any, record: StrategyRanking) => {
        const strategy = strategies.find(s => s.id === record.id);
        const status = strategy?.status || 'stopped';
        const colorMap: Record<string, string> = {
          active: 'green',
          paused: 'orange',
          stopped: 'red',
        };
        return <Tag color={colorMap[status] || 'default'}>{status.toUpperCase()}</Tag>;
      },
    },
    {
      title: 'Total Trades',
      dataIndex: 'totalTrades',
      key: 'totalTrades',
      width: 100,
      sorter: (a, b) => a.totalTrades - b.totalTrades,
    },
    {
      title: 'Win Rate',
      dataIndex: 'winRate',
      key: 'winRate',
      width: 120,
      render: (rate: number) => (
        <Progress
          percent={rate}
          strokeColor={{
            '0%': '#108ee9',
            '100%': '#87d068',
          }}
          format={(percent) => `${percent?.toFixed(1)}%`}
        />
      ),
      sorter: (a, b) => a.winRate - b.winRate,
    },
    {
      title: 'Total P&L',
      dataIndex: 'totalPnL',
      key: 'totalPnL',
      width: 120,
      render: (pnl: number) => (
        <Text style={{ color: pnl >= 0 ? '#3f8600' : '#cf1322', fontWeight: 'bold' }}>
          ${pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
      ),
      sorter: (a, b) => a.totalPnL - b.totalPnL,
    },
    {
      title: 'ROI',
      dataIndex: 'roi',
      key: 'roi',
      width: 100,
      render: (roi: number) => (
        <Text style={{ color: roi >= 0 ? '#3f8600' : '#cf1322' }}>
          {roi >= 0 ? '+' : ''}{roi.toFixed(2)}%
        </Text>
      ),
      sorter: (a, b) => a.roi - b.roi,
    },
    {
      title: 'Total Volume',
      dataIndex: 'totalVolume',
      key: 'totalVolume',
      width: 120,
      render: (volume: number) => `$${(volume / 1000).toFixed(1)}K`,
      sorter: (a, b) => a.totalVolume - b.totalVolume,
    },
    {
      title: 'Avg Trade Size',
      dataIndex: 'avgTradeSize',
      key: 'avgTradeSize',
      width: 120,
      render: (size: number) => `$${size.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      sorter: (a, b) => a.avgTradeSize - b.avgTradeSize,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header>
        <Title level={2} style={{ color: 'white', margin: 0 }}>
          AlphaArena - Leaderboard
        </Title>
      </Header>
      <Content style={{ padding: '24px' }}>
        {/* Top Stats */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card loading={strategiesLoading}>
              <Statistic
                title="Total Strategies"
                value={strategies.length}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card loading={tradesLoading}>
              <Statistic
                title="Total Trades"
                value={trades.length}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card loading={tradesLoading}>
              <Statistic
                title="Best ROI"
                value={rankings.length > 0 ? Math.max(...rankings.map(r => r.roi)) : 0}
                suffix="%"
                precision={2}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card loading={tradesLoading}>
              <Statistic
                title="Total Volume"
                value={rankings.reduce((sum, r) => sum + r.totalVolume, 0) / 1000}
                suffix="K"
                prefix="$"
              />
            </Card>
          </Col>
        </Row>

        {/* Charts */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={12}>
            <Card title="P&L Ranking" loading={strategiesLoading}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={rankingChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="strategy" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="pnl" fill="#8884d8" name="P&L ($)" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Col>
          <Col span={12}>
            <Card title="Strategy Performance Radar" loading={strategiesLoading}>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="strategy" />
                  <PolarRadiusAxis />
                  <Radar name="Performance" dataKey="pnl" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                  <Legend />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        </Row>

        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={24}>
            <Card title="Win Rate Comparison" loading={strategiesLoading}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={winRateData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="winRate" stackId="a" fill="#82ca9d" name="Win Rate %" />
                  <Bar dataKey="lossRate" stackId="a" fill="#ffc658" name="Loss Rate %" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        </Row>

        {/* Rankings Table */}
        <Card title="Strategy Rankings">
          <Table
            columns={rankingColumns}
            dataSource={rankings}
            rowKey="id"
            loading={strategiesLoading || tradesLoading}
            pagination={false}
            size="small"
            scroll={{ x: 1200 }}
          />
        </Card>
      </Content>
    </Layout>
  );
};

export default LeaderboardPage;
