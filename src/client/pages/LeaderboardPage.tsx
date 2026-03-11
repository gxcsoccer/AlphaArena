import React, { useState, useMemo, useEffect } from 'react';
import { Typography, Card, Table, Tag, Grid, Statistic, Avatar, Progress, Space, Select, Button, Tooltip, Divider } from '@arco-design/web-react';
const { Row, Col } = Grid;
import {
  IconDashboard,
  IconRefresh,
  IconTrophy,
  IconArrowRise,
  IconArrowFall,
  IconThunderbolt,
  IconStar,
} from '@arco-design/web-react/icon';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import { useStrategies, useTrades } from '../hooks/useData';
import { api, LeaderboardEntry, StrategyMetrics } from '../utils/api';
import type { TableProps } from '@arco-design/web-react';

const { Title, Text } = Typography;
const Option = Select.Option;

const LeaderboardPage: React.FC = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<string>('roi');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Fetch leaderboard data
  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const data = await api.getLeaderboard(sortBy);
      setLeaderboard(data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('[Leaderboard] Failed to fetch:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 60000);
    return () => clearInterval(interval);
  }, [sortBy]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    if (leaderboard.length === 0) return null;

    const totalStrategies = leaderboard.length;
    const totalTrades = leaderboard.reduce((sum, e) => sum + e.metrics.totalTrades, 0);
    const totalVolume = leaderboard.reduce((sum, e) => sum + e.metrics.totalVolume, 0);
    const avgRoi = leaderboard.reduce((sum, e) => sum + e.metrics.roi, 0) / totalStrategies;
    const bestRoi = Math.max(...leaderboard.map(e => e.metrics.roi));
    const bestSharpe = Math.max(...leaderboard.map(e => e.metrics.sharpeRatio));

    return {
      totalStrategies,
      totalTrades,
      totalVolume,
      avgRoi,
      bestRoi,
      bestSharpe,
    };
  }, [leaderboard]);

  // Prepare chart data
  const rankingChartData = leaderboard.slice(0, 10).map((entry) => ({
    name: entry.strategyName,
    rank: entry.rank,
    roi: entry.metrics.roi,
  }));

  const radarData = leaderboard.slice(0, 5).map(entry => ({
    strategy: entry.strategyName,
    roi: Math.abs(entry.metrics.roi) / 10,
    sharpeRatio: entry.metrics.sharpeRatio / 5,
    winRate: entry.metrics.winRate,
    volume: entry.metrics.totalVolume / 10000,
    trades: entry.metrics.totalTrades / 5,
  }));

  // Get medal based on rank
  const getRankStyling = (rank: number) => {
    if (rank === 1) return { medal: '🥇', badge: '1st', color: '#f7ba1e' };
    if (rank === 2) return { medal: '🥈', badge: '2nd', color: '#c9cdd4' };
    if (rank === 3) return { medal: '🥉', badge: '3rd', color: '#cd7f32' };
    return { medal: `#${rank}`, badge: null, color: '#165dff' };
  };

  // Ranking table columns
  const rankingColumns: TableProps['columns'] = [
    {
      title: 'Rank',
      key: 'rank',
      width: 100,
      fixed: 'left',
      render: (_: any, record: LeaderboardEntry) => {
        const rank = record.rank;
        const styling = getRankStyling(rank);
        const rankChange = record.rankChange;
        
        return (
          <Space>
            <Avatar 
              size={40}
              style={{ backgroundColor: styling.color }}
            >
              {styling.medal}
            </Avatar>
            <div style={{ minWidth: 30 }}>
              {rankChange > 0 && <IconArrowRise style={{ color: '#00b42a' }} />}
              {rankChange < 0 && <IconArrowFall style={{ color: '#f53f3f' }} />}
              {rankChange === 0 && <Text type="secondary">-</Text>}
            </div>
          </Space>
        );
      },
    },
    {
      title: 'Strategy',
      dataIndex: 'strategyName',
      key: 'strategyName',
      width: 200,
      fixed: 'left',
      render: (name: string, record: LeaderboardEntry) => (
        <Space>
          <Avatar 
            size={40}
            style={{ backgroundColor: '#165dff' }}
          >
            <IconThunderbolt />
          </Avatar>
          <div>
            <div style={{ fontWeight: 600 }}>{name}</div>
            <Tag color={record.status === 'active' ? 'green' : record.status === 'paused' ? 'orange' : 'arcoblue'}>
              {record.status}
            </Tag>
          </div>
        </Space>
      ),
    },
    {
      title: 'ROI %',
      dataIndex: ['metrics', 'roi'],
      key: 'roi',
      width: 100,
      render: (roi: number) => (
        <Text strong style={{ color: roi >= 0 ? '#00b42a' : '#f53f3f' }}>
          {roi >= 0 ? '+' : ''}{roi.toFixed(2)}%
        </Text>
      ),
      sorter: (a, b) => a.metrics.roi - b.metrics.roi,
    },
    {
      title: 'Sharpe',
      dataIndex: ['metrics', 'sharpeRatio'],
      key: 'sharpeRatio',
      width: 90,
      render: (sharpe: number) => (
        <Text style={{ color: sharpe >= 2 ? '#00b42a' : sharpe >= 1 ? '#165dff' : '#ff7d00' }}>
          {sharpe.toFixed(2)}
        </Text>
      ),
      sorter: (a, b) => a.metrics.sharpeRatio - b.metrics.sharpeRatio,
    },
    {
      title: 'Max DD %',
      dataIndex: ['metrics', 'maxDrawdown'],
      key: 'maxDrawdown',
      width: 100,
      render: (dd: number) => (
        <Text style={{ color: dd <= 10 ? '#00b42a' : dd <= 20 ? '#ff7d00' : '#f53f3f' }}>
          -{dd.toFixed(2)}%
        </Text>
      ),
      sorter: (a, b) => a.metrics.maxDrawdown - b.metrics.maxDrawdown,
    },
    {
      title: 'Win Rate',
      dataIndex: ['metrics', 'winRate'],
      key: 'winRate',
      width: 120,
      render: (rate: number) => (
        <Progress
          percent={rate}
          strokeColor={rate >= 70 ? '#00b42a' : rate >= 50 ? '#165dff' : '#f53f3f'}
          size="small"
          format={(percent) => `${percent?.toFixed(1)}%`}
        />
      ),
      sorter: (a, b) => a.metrics.winRate - b.metrics.winRate,
    },
    {
      title: 'Total P&L',
      dataIndex: ['metrics', 'totalPnL'],
      key: 'totalPnL',
      width: 120,
      render: (pnl: number) => (
        <Text strong style={{ color: pnl >= 0 ? '#00b42a' : '#f53f3f', fontFamily: 'monospace' }}>
          ${pnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </Text>
      ),
      sorter: (a, b) => a.metrics.totalPnL - b.metrics.totalPnL,
    },
    {
      title: 'Volume',
      dataIndex: ['metrics', 'totalVolume'],
      key: 'totalVolume',
      width: 100,
      render: (volume: number) => (
        <Text style={{ fontFamily: 'monospace' }}>
          ${(volume / 1000).toFixed(1)}K
        </Text>
      ),
      sorter: (a, b) => a.metrics.totalVolume - b.metrics.totalVolume,
    },
    {
      title: 'Trades',
      dataIndex: ['metrics', 'totalTrades'],
      key: 'totalTrades',
      width: 90,
      render: (trades: number) => trades,
      sorter: (a, b) => a.metrics.totalTrades - b.metrics.totalTrades,
    },
  ];

  return (
    <div className="fade-in">
      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <Space>
          <Avatar 
            size={40}
            style={{ backgroundColor: '#f7ba1e' }}
          >
            <IconTrophy />
          </Avatar>
          <div>
            <Title heading={4} style={{ margin: 0 }}>
              Strategy Leaderboard
            </Title>
            <Text type="secondary">Real-time ranking of trading strategies</Text>
          </div>
        </Space>
        
        <div style={{ float: 'right' }}>
          <Space>
            <Text type="secondary" style={{ fontSize: 13 }}>
              <IconRefresh /> {lastUpdated ? `Updated: ${lastUpdated.toLocaleTimeString()}` : 'Loading...'}
            </Text>
            <Select 
              value={sortBy} 
              onChange={setSortBy}
              style={{ width: 160 }}
            >
              <Option value="roi">ROI</Option>
              <Option value="sharpeRatio">Sharpe Ratio</Option>
              <Option value="maxDrawdown">Max Drawdown</Option>
              <Option value="totalPnL">Total P&L</Option>
              <Option value="winRate">Win Rate</Option>
              <Option value="totalVolume">Volume</Option>
            </Select>
            <Button 
              type="primary" 
              icon={<IconRefresh />} 
              onClick={fetchLeaderboard}
              loading={loading}
            >
              Refresh
            </Button>
          </Space>
        </div>
      </div>

      {/* Summary Stats */}
      {summaryStats && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={4}>
            <Card>
              <Statistic 
                title="Total Strategies" 
                value={summaryStats.totalStrategies}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic 
                title="Best ROI" 
                value={summaryStats.bestRoi}
                precision={2}
                suffix="%"
                valueStyle={{ color: '#00b42a' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic 
                title="Best Sharpe" 
                value={summaryStats.bestSharpe}
                precision={2}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic 
                title="Total Trades" 
                value={summaryStats.totalTrades}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic 
                title="Total Volume" 
                value={(summaryStats.totalVolume / 1000).toFixed(1)}
                suffix="K"
                prefix="$"
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic 
                title="Avg ROI" 
                value={summaryStats.avgRoi}
                precision={2}
                suffix="%"
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Main Leaderboard Table */}
      <Card title="Strategy Rankings" style={{ marginBottom: 24 }}>
        <Table
          columns={rankingColumns}
          dataSource={leaderboard}
          rowKey="strategyId"
          pagination={{ pageSize: 20 }}
          scroll={{ x: 1200 }}
          size="small"
        />
      </Card>

      {/* Charts */}
      <Row gutter={16}>
        <Col span={12}>
          <Card title="Top 10 Performance">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={rankingChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" stroke="#8c8c8c" />
                <YAxis stroke="#8c8c8c" />
                <RechartsTooltip />
                <Legend />
                <Bar dataKey="roi" name="ROI %" fill="#165dff" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Strategy Comparison (Top 5)">
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="strategy" />
                <PolarRadiusAxis />
                <Radar name="Performance" dataKey="roi" stroke="#165dff" fill="#165dff" fillOpacity={0.3} />
                <Legend />
                <RechartsTooltip />
              </RadarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default LeaderboardPage;
