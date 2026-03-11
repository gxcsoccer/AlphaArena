import React, { useState, useMemo, useEffect } from 'react';
import { Layout, Typography, Card, Table, Tag, Row, Col, Statistic, Avatar, Progress, Space, Select, Button, Tooltip } from 'antd';
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
  AreaChart,
  Area,
} from 'recharts';
import { useStrategies, useTrades } from '../hooks/useData';
import { api, LeaderboardEntry, StrategyMetrics } from '../utils/api';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined, TrophyOutlined, RiseOutlined, FallOutlined } from '@ant-design/icons';

const { Header, Content } = Layout;
const { Title, Text } = Typography;
const { Option } = Select;

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
    const interval = setInterval(fetchLeaderboard, 60000); // Auto-refresh every minute
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
    const lowestDrawdown = Math.min(...leaderboard.map(e => e.metrics.maxDrawdown));

    return {
      totalStrategies,
      totalTrades,
      totalVolume,
      avgRoi,
      bestRoi,
      bestSharpe,
      lowestDrawdown,
    };
  }, [leaderboard]);

  // Prepare chart data
  const rankingChartData = leaderboard.slice(0, 10).map((entry) => ({
    name: entry.strategyName,
    rank: entry.rank,
    roi: entry.metrics.roi,
    sharpeRatio: entry.metrics.sharpeRatio,
  }));

  const radarData = leaderboard.slice(0, 5).map(entry => ({
    strategy: entry.strategyName,
    roi: Math.abs(entry.metrics.roi) / 10, // Normalize
    sharpeRatio: entry.metrics.sharpeRatio / 5, // Normalize
    winRate: entry.metrics.winRate,
    volume: entry.metrics.totalVolume / 10000, // Normalize
    trades: entry.metrics.totalTrades / 5, // Normalize
  }));

  const roiComparisonData = leaderboard.slice(0, 10).map(entry => ({
    name: entry.strategyName,
    roi: entry.metrics.roi,
    pnl: entry.metrics.totalPnL,
  }));

  const rankHistoryData = leaderboard.map((entry, index) => ({
    name: entry.strategyName,
    currentRank: entry.rank,
    previousRank: entry.rank - entry.rankChange,
  }));

  // Ranking table columns
  const rankingColumns: ColumnsType<LeaderboardEntry> = [
    {
      title: 'Rank',
      key: 'rank',
      width: 100,
      render: (_: any, record: LeaderboardEntry) => {
        const rank = record.rank;
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
        const rankChange = record.rankChange;
        
        return (
          <Space>
            <Avatar 
              style={{ 
                backgroundColor: rank <= 3 ? '#f56a00' : '#87d068',
                marginRight: 4,
              }}
            >
              {medal}
            </Avatar>
            {rankChange > 0 && (
              <Tooltip title={`Moved up ${rankChange} positions`}>
                <RiseOutlined style={{ color: '#3f8600', fontSize: 16 }} />
              </Tooltip>
            )}
            {rankChange < 0 && (
              <Tooltip title={`Dropped ${Math.abs(rankChange)} positions`}>
                <FallOutlined style={{ color: '#cf1322', fontSize: 16 }} />
              </Tooltip>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Strategy',
      dataIndex: 'strategyName',
      key: 'strategyName',
      width: 200,
      render: (name: string, record: LeaderboardEntry) => (
        <Space>
          <Text strong>{name}</Text>
          <Tag color={
            record.status === 'active' ? 'green' :
            record.status === 'paused' ? 'orange' : 'red'
          }>
            {record.status.toUpperCase()}
          </Tag>
        </Space>
      ),
    },
    {
      title: (
        <Tooltip title="Return on Investment">
          <span>ROI %</span>
        </Tooltip>
      ),
      dataIndex: ['metrics', 'roi'],
      key: 'roi',
      width: 100,
      render: (roi: number) => (
        <Text style={{ 
          color: roi >= 0 ? '#3f8600' : '#cf1322', 
          fontWeight: 'bold',
          fontSize: 14,
        }}>
          {roi >= 0 ? '+' : ''}{roi.toFixed(2)}%
        </Text>
      ),
      sorter: (a, b) => a.metrics.roi - b.metrics.roi,
      defaultSortOrder: sortBy === 'roi' ? 'descend' : undefined,
    },
    {
      title: (
        <Tooltip title="Sharpe Ratio (risk-adjusted return)">
          <span>Sharpe</span>
        </Tooltip>
      ),
      dataIndex: ['metrics', 'sharpeRatio'],
      key: 'sharpeRatio',
      width: 90,
      render: (sharpe: number) => (
        <Text style={{ 
          color: sharpe >= 1 ? '#3f8600' : sharpe >= 0 ? '#faad14' : '#cf1322',
          fontWeight: sharpe >= 1 ? 'bold' : 'normal',
        }}>
          {sharpe.toFixed(2)}
        </Text>
      ),
      sorter: (a, b) => a.metrics.sharpeRatio - b.metrics.sharpeRatio,
    },
    {
      title: (
        <Tooltip title="Maximum Drawdown (largest peak-to-trough decline)">
          <span>Max DD %</span>
        </Tooltip>
      ),
      dataIndex: ['metrics', 'maxDrawdown'],
      key: 'maxDrawdown',
      width: 100,
      render: (dd: number) => (
        <Text style={{ 
          color: dd <= 10 ? '#3f8600' : dd <= 20 ? '#faad14' : '#cf1322',
        }}>
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
          strokeColor={{
            '0%': '#108ee9',
            '100%': '#87d068',
          }}
          format={(percent) => `${percent?.toFixed(1)}%`}
          size="small"
        />
      ),
      sorter: (a, b) => a.metrics.winRate - b.metrics.winRate,
    },
    {
      title: (
        <Tooltip title="Total Profit and Loss">
          <span>Total P&L</span>
        </Tooltip>
      ),
      dataIndex: ['metrics', 'totalPnL'],
      key: 'totalPnL',
      width: 120,
      render: (pnl: number) => (
        <Text style={{ 
          color: pnl >= 0 ? '#3f8600' : '#cf1322', 
          fontWeight: 'bold',
          fontFamily: 'monospace',
        }}>
          ${pnl.toLocaleString(undefined, { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
          })}
        </Text>
      ),
      sorter: (a, b) => a.metrics.totalPnL - b.metrics.totalPnL,
    },
    {
      title: (
        <Tooltip title="Total Trading Volume">
          <span>Volume</span>
        </Tooltip>
      ),
      dataIndex: ['metrics', 'totalVolume'],
      key: 'totalVolume',
      width: 100,
      render: (volume: number) => (
        <Text>
          ${(volume / 1000).toFixed(1)}K
        </Text>
      ),
      sorter: (a, b) => a.metrics.totalVolume - b.metrics.totalVolume,
    },
    {
      title: 'Total Trades',
      dataIndex: ['metrics', 'totalTrades'],
      key: 'totalTrades',
      width: 90,
      sorter: (a, b) => a.metrics.totalTrades - b.metrics.totalTrades,
    },
    {
      title: (
        <Tooltip title="Average Trade Size">
          <span>Avg Trade</span>
        </Tooltip>
      ),
      dataIndex: ['metrics', 'avgTradeSize'],
      key: 'avgTradeSize',
      width: 100,
      render: (size: number) => (
        <Text>
          ${size.toLocaleString(undefined, { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
          })}
        </Text>
      ),
      sorter: (a, b) => a.metrics.avgTradeSize - b.metrics.avgTradeSize,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={2} style={{ color: 'white', margin: 0 }}>
          <TrophyOutlined style={{ marginRight: 8 }} />
          Strategy Leaderboard
        </Title>
        <Space>
          <Text style={{ color: 'rgba(255,255,255,0.8)' }}>
            {lastUpdated ? `Updated: ${lastUpdated.toLocaleTimeString()}` : 'Loading...'}
          </Text>
          <Select 
            value={sortBy} 
            onChange={setSortBy}
            style={{ width: 150 }}
            size="large"
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
            icon={<ReloadOutlined />} 
            onClick={fetchLeaderboard}
            loading={loading}
          >
            Refresh
          </Button>
        </Space>
      </Header>
      <Content style={{ padding: '24px' }}>
        {/* Top Stats */}
        {summaryStats && (
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={4}>
              <Card loading={loading}>
                <Statistic
                  title="Total Strategies"
                  value={summaryStats.totalStrategies}
                  prefix="🎯"
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card loading={loading}>
                <Statistic
                  title="Total Trades"
                  value={summaryStats.totalTrades}
                  prefix="📊"
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card loading={loading}>
                <Statistic
                  title="Total Volume"
                  value={summaryStats.totalVolume / 1000}
                  suffix="K"
                  prefix="$"
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card loading={loading}>
                <Statistic
                  title="Best ROI"
                  value={summaryStats.bestRoi}
                  suffix="%"
                  precision={2}
                  valueStyle={{ color: '#3f8600' }}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card loading={loading}>
                <Statistic
                  title="Best Sharpe"
                  value={summaryStats.bestSharpe}
                  precision={2}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card loading={loading}>
                <Statistic
                  title="Lowest Drawdown"
                  value={summaryStats.lowestDrawdown}
                  suffix="%"
                  precision={2}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
          </Row>
        )}

        {/* Charts */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={12}>
            <Card title="🏆 Top 10 Strategies by ROI">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={roiComparisonData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  <Bar dataKey="roi" fill="#8884d8" name="ROI %" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Col>
          <Col span={12}>
            <Card title="📈 Performance Radar (Top 5)">
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="strategy" tick={{ fontSize: 11 }} />
                  <PolarRadiusAxis />
                  <Radar 
                    name="Performance" 
                    dataKey="roi" 
                    stroke="#8884d8" 
                    fill="#8884d8" 
                    fillOpacity={0.6} 
                  />
                  <Legend />
                  <RechartsTooltip />
                </RadarChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        </Row>

        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={24}>
            <Card title="📊 ROI Comparison (Top 10)">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={roiComparisonData}>
                  <defs>
                    <linearGradient id="colorRoi" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="roi" 
                    stroke="#8884d8" 
                    fillOpacity={1} 
                    fill="url(#colorRoi)" 
                    name="ROI %" 
                  />
                  <Line type="monotone" dataKey="pnl" stroke="#82ca9d" name="P&L ($)" />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        </Row>

        {/* Rankings Table */}
        <Card 
          title="🎖️ Full Rankings"
          extra={
            <Text type="secondary">
              Sorted by: <Text strong>{sortBy}</Text>
            </Text>
          }
        >
          <Table
            columns={rankingColumns}
            dataSource={leaderboard}
            rowKey="strategyId"
            loading={loading}
            pagination={false}
            size="small"
            scroll={{ x: 1400 }}
            onChange={(pagination, filters, sorter) => {
              // Handle table sorting if needed
            }}
          />
        </Card>

        {/* Footer info */}
        <div style={{ marginTop: 16, textAlign: 'center', color: '#999' }}>
          <Text type="secondary">
            Leaderboard updates automatically every minute. Last updated: {lastUpdated?.toLocaleString() || 'Never'}
          </Text>
        </div>
      </Content>
    </Layout>
  );
};

export default LeaderboardPage;
