import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Typography, Card, Table, Tag, Statistic, Avatar, Progress, Space, Select, Button, 
  Tooltip, Grid, Tabs, Modal, Form, Input, InputNumber, DatePicker, Message, 
  List, Comment, Divider, Empty
} from '@arco-design/web-react';
const { Row, Col } = Grid;
const { TabPane } = Tabs;
const { Title, Text, _Paragraph } = Typography;
const { _RangePicker } = DatePicker;

import {
  BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer, RadarChart,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, AreaChart, Area
} from 'recharts';

import { 
  IconRefresh, IconTrophy, IconArrowRise, IconArrowFall, IconHeart, 
  IconMessage, IconUser, IconUserAdd, IconThunderbolt, IconPlus
} from '@arco-design/web-react/icon';

import { ErrorBoundary } from '../components/ErrorBoundary';
import type { TableColumnProps } from '@arco-design/web-react';

// Types
type TimePeriod = 'daily' | 'weekly' | 'monthly' | 'all_time';
type SortCriterion = 'roi' | 'sharpeRatio' | 'maxDrawdown' | 'totalPnL' | 'winRate' | 'totalVolume' | 'comprehensiveScore';

interface EnhancedStrategyMetrics {
  strategyId: string;
  strategyName: string;
  status: string;
  totalTrades: number;
  totalVolume: number;
  totalPnL: number;
  roi: number;
  winRate: number;
  sharpeRatio: number;
  maxDrawdown: number;
  avgTradeSize: number;
  profitableTrades: number;
  losingTrades: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  bestTrade: number;
  worstTrade: number;
  comprehensiveScore: number;
  likesCount: number;
  commentsCount: number;
  followersCount: number;
  rankChange: number;
  badges: Array<{ badgeType: string; badgeName: string; badgeIcon: string }>;
  calculatedAt: string;
}

interface EnhancedLeaderboardEntry {
  rank: number;
  strategyId: string;
  strategyName: string;
  status: string;
  metrics: EnhancedStrategyMetrics;
  rankChange: number;
  userId?: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  isLiked?: boolean;
  isFollowing?: boolean;
}

interface Competition {
  id: string;
  name: string;
  description?: string;
  startTime: string;
  endTime: string;
  status: 'upcoming' | 'active' | 'ended' | 'cancelled';
  entryFee: number;
  prizePool: number;
  maxParticipants?: number;
  participantCount: number;
  rewards: Array<{ rank: number; prize: number; badge?: string }>;
}

interface StrategyComment {
  id: string;
  userId: string;
  content: string;
  likesCount: number;
  createdAt: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  replies?: StrategyComment[];
}

// Mock data for development
const mockLeaderboardData: EnhancedLeaderboardEntry[] = [
  {
    rank: 1,
    strategyId: '1',
    strategyName: 'Alpha Momentum',
    status: 'active',
    metrics: {
      strategyId: '1',
      strategyName: 'Alpha Momentum',
      status: 'active',
      totalTrades: 156,
      totalVolume: 2580000,
      totalPnL: 125000,
      roi: 48.5,
      winRate: 72.5,
      sharpeRatio: 2.8,
      maxDrawdown: 8.2,
      avgTradeSize: 16538,
      profitableTrades: 89,
      losingTrades: 34,
      consecutiveWins: 5,
      consecutiveLosses: 2,
      bestTrade: 8500,
      worstTrade: -2100,
      comprehensiveScore: 85.6,
      likesCount: 234,
      commentsCount: 45,
      followersCount: 120,
      rankChange: 2,
      badges: [
        { badgeType: 'top_trader', badgeName: 'Top Trader', badgeIcon: '🏆' },
        { badgeType: 'high_roi', badgeName: 'ROI Master', badgeIcon: '📈' },
      ],
      calculatedAt: new Date().toISOString(),
    },
    rankChange: 2,
    username: 'trader_alpha',
    displayName: 'Alpha Trader',
    isLiked: false,
    isFollowing: false,
  },
  {
    rank: 2,
    strategyId: '2',
    strategyName: 'Beta Arbitrage',
    status: 'active',
    metrics: {
      strategyId: '2',
      strategyName: 'Beta Arbitrage',
      status: 'active',
      totalTrades: 342,
      totalVolume: 5420000,
      totalPnL: 98000,
      roi: 32.1,
      winRate: 68.2,
      sharpeRatio: 2.1,
      maxDrawdown: 5.8,
      avgTradeSize: 15848,
      profitableTrades: 156,
      losingTrades: 73,
      consecutiveWins: 8,
      consecutiveLosses: 1,
      bestTrade: 6200,
      worstTrade: -1800,
      comprehensiveScore: 78.3,
      likesCount: 189,
      commentsCount: 32,
      followersCount: 95,
      rankChange: -1,
      badges: [
        { badgeType: 'risk_manager', badgeName: 'Risk Manager', badgeIcon: '🛡️' },
      ],
      calculatedAt: new Date().toISOString(),
    },
    rankChange: -1,
    username: 'beta_trader',
    displayName: 'Beta Bot',
    isLiked: true,
    isFollowing: true,
  },
  {
    rank: 3,
    strategyId: '3',
    strategyName: 'Gamma Trend',
    status: 'active',
    metrics: {
      strategyId: '3',
      strategyName: 'Gamma Trend',
      status: 'active',
      totalTrades: 89,
      totalVolume: 1250000,
      totalPnL: 67000,
      roi: 53.6,
      winRate: 75.3,
      sharpeRatio: 3.2,
      maxDrawdown: 12.5,
      avgTradeSize: 14045,
      profitableTrades: 58,
      losingTrades: 19,
      consecutiveWins: 12,
      consecutiveLosses: 3,
      bestTrade: 9200,
      worstTrade: -2500,
      comprehensiveScore: 82.1,
      likesCount: 156,
      commentsCount: 28,
      followersCount: 78,
      rankChange: 4,
      badges: [
        { badgeType: 'sharpe_king', badgeName: 'Sharpe King', badgeIcon: '👑' },
        { badgeType: 'winning_streak', badgeName: 'Winning Streak', badgeIcon: '🔥' },
      ],
      calculatedAt: new Date().toISOString(),
    },
    rankChange: 4,
    username: 'gamma_follower',
    displayName: 'Gamma Master',
    isLiked: false,
    isFollowing: false,
  },
];

const mockCompetitions: Competition[] = [
  {
    id: '1',
    name: 'March Madness Trading',
    description: 'Compete for the highest ROI in March!',
    startTime: new Date(Date.now() - 86400000 * 10).toISOString(),
    endTime: new Date(Date.now() + 86400000 * 5).toISOString(),
    status: 'active',
    entryFee: 100,
    prizePool: 5000,
    maxParticipants: 100,
    participantCount: 45,
    rewards: [
      { rank: 1, prize: 2500, badge: '🥇' },
      { rank: 2, prize: 1500, badge: '🥈' },
      { rank: 3, prize: 1000, badge: '🥉' },
    ],
  },
  {
    id: '2',
    name: 'Q2 Trading Championship',
    description: 'Quarterly trading competition with big prizes',
    startTime: new Date(Date.now() + 86400000 * 5).toISOString(),
    endTime: new Date(Date.now() + 86400000 * 30).toISOString(),
    status: 'upcoming',
    entryFee: 250,
    prizePool: 25000,
    maxParticipants: 200,
    participantCount: 12,
    rewards: [
      { rank: 1, prize: 15000, badge: '🏆' },
      { rank: 2, prize: 7000, badge: '🥈' },
      { rank: 3, prize: 3000, badge: '🥉' },
    ],
  },
];

// COLORS for charts
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

const EnhancedLeaderboardPage: React.FC = () => {
  // State
  const [leaderboard, setLeaderboard] = useState<EnhancedLeaderboardEntry[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortCriterion>('comprehensiveScore');
  const [period, setPeriod] = useState<TimePeriod>('all_time');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState('rankings');
  
  // Modal states
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [competitionModalVisible, setCompetitionModalVisible] = useState(false);
  const [_strategyModalVisible, _setStrategyModalVisible] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<EnhancedLeaderboardEntry | null>(null);
  const [comments, setComments] = useState<StrategyComment[]>([]);
  
  // Form
  const [commentForm] = Form.useForm();
  const [competitionForm] = Form.useForm();

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch data
  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      // In production, this would be an API call
      // const response = await fetch(`/api/leaderboard/enhanced?sortBy=${sortBy}&period=${period}`);
      // const data = await response.json();
      
      // Using mock data for now
      await new Promise(resolve => setTimeout(resolve, 500));
      setLeaderboard(mockLeaderboardData);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
      Message.error('Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  }, [sortBy, period]);

  const fetchCompetitions = useCallback(async () => {
    try {
      // Mock data
      setCompetitions(mockCompetitions);
    } catch (error) {
      console.error('Failed to fetch competitions:', error);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
    fetchCompetitions();
    const interval = setInterval(fetchLeaderboard, 60000);
    return () => clearInterval(interval);
  }, [fetchLeaderboard, fetchCompetitions]);

  // Handlers
  const handleLike = async (_strategyId: string) => {
    Message.success('Liked strategy!');
    // In production: await fetch(`/api/strategies/${_strategyId}/like`, { method: 'POST' });
  };

  const handleFollow = async (_userId: string) => {
    Message.success('Following user!');
    // In production: await fetch('/api/follow', { method: 'POST', body: JSON.stringify({ followingId: _userId }) });
  };

  const handleViewComments = async (strategy: EnhancedLeaderboardEntry) => {
    setSelectedStrategy(strategy);
    setCommentModalVisible(true);
    // In production: fetch comments from API
    setComments([
      {
        id: '1',
        userId: 'user1',
        content: 'Great strategy! The risk management is impressive.',
        likesCount: 12,
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        username: 'crypto_fan',
        displayName: 'Crypto Fan',
      },
    ]);
  };

  const handleSubmitComment = async () => {
    const _values = await commentForm.validate();
    Message.success('Comment posted!');
    setCommentModalVisible(false);
    commentForm.resetFields();
  };

  const handleCreateCompetition = async () => {
    const _values = await competitionForm.validate();
    Message.success('Competition created!');
    setCompetitionModalVisible(false);
    competitionForm.resetFields();
  };

  const handleJoinCompetition = async (_competitionId: string) => {
    Message.success('Joined competition!');
  };

  // Summary stats
  const summaryStats = useMemo(() => {
    if (leaderboard.length === 0) return null;
    const totalTrades = leaderboard.reduce((sum, e) => sum + e.metrics.totalTrades, 0);
    const totalVolume = leaderboard.reduce((sum, e) => sum + e.metrics.totalVolume, 0);
    const avgRoi = leaderboard.reduce((sum, e) => sum + e.metrics.roi, 0) / leaderboard.length;
    const avgSharpe = leaderboard.reduce((sum, e) => sum + e.metrics.sharpeRatio, 0) / leaderboard.length;
    const topScore = Math.max(...leaderboard.map(e => e.metrics.comprehensiveScore));

    return { totalTrades, totalVolume, avgRoi, avgSharpe, topScore, totalStrategies: leaderboard.length };
  }, [leaderboard]);

  // Chart data
  const chartData = useMemo(() => {
    const top10 = leaderboard.slice(0, 10);
    return {
      roiComparison: top10.map(e => ({ name: e.strategyName, roi: e.metrics.roi, pnl: e.metrics.totalPnL })),
      scoreDistribution: top10.map(e => ({ name: e.strategyName, score: e.metrics.comprehensiveScore })),
      winRateDistribution: top10.map(e => ({ name: e.strategyName, winRate: e.metrics.winRate })),
      radarData: top10.slice(0, 5).map(e => ({
        strategy: e.strategyName,
        roi: Math.min(e.metrics.roi / 50, 100),
        sharpe: e.metrics.sharpeRatio * 20,
        winRate: e.metrics.winRate,
        drawdown: 100 - e.metrics.maxDrawdown,
      })),
    };
  }, [leaderboard]);

  // Table columns
  const columns: TableColumnProps<EnhancedLeaderboardEntry>[] = [
    {
      title: 'Rank',
      key: 'rank',
      width: 100,
      fixed: 'left',
      render: (_, record) => {
        const medal = record.rank === 1 ? '🥇' : record.rank === 2 ? '🥈' : record.rank === 3 ? '🥉' : `#${record.rank}`;
        return (
          <Space>
            <Avatar style={{ backgroundColor: record.rank <= 3 ? '#f56a00' : '#87d068' }}>
              {medal}
            </Avatar>
            {record.rankChange > 0 && (
              <Tooltip content={`Moved up ${record.rankChange} positions`}>
                <IconArrowRise style={{ color: '#3f8600', fontSize: 16 }} />
              </Tooltip>
            )}
            {record.rankChange < 0 && (
              <Tooltip content={`Dropped ${Math.abs(record.rankChange)} positions`}>
                <IconArrowFall style={{ color: '#cf1322', fontSize: 16 }} />
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
      render: (name, record) => (
        <Space>
          <Text strong>{name}</Text>
          <Tag color={record.status === 'active' ? 'green' : record.status === 'paused' ? 'orange' : 'red'}>
            {record.status}
          </Tag>
          {record.metrics.badges.slice(0, 2).map(badge => (
            <Tooltip key={badge.badgeType} content={badge.badgeName}>
              <span style={{ fontSize: 16 }}>{badge.badgeIcon}</span>
            </Tooltip>
          ))}
        </Space>
      ),
    },
    {
      title: <Tooltip content="Comprehensive Score">Score</Tooltip>,
      key: 'comprehensiveScore',
      width: 120,
      sorter: (a, b) => a.metrics.comprehensiveScore - b.metrics.comprehensiveScore,
      defaultSortOrder: 'descend',
      render: (_, record) => (
        <Text style={{ color: record.metrics.comprehensiveScore >= 80 ? '#3f8600' : '#faad14', fontWeight: 'bold', fontSize: 16 }}>
          {record.metrics.comprehensiveScore.toFixed(1)}
        </Text>
      ),
    },
    {
      title: 'ROI %',
      key: 'roi',
      width: 100,
      sorter: (a, b) => a.metrics.roi - b.metrics.roi,
      render: (_, record) => (
        <Text style={{ color: record.metrics.roi >= 0 ? '#3f8600' : '#cf1322', fontWeight: 'bold' }}>
          {record.metrics.roi >= 0 ? '+' : ''}{record.metrics.roi.toFixed(2)}%
        </Text>
      ),
    },
    {
      title: 'Sharpe',
      key: 'sharpeRatio',
      width: 90,
      sorter: (a, b) => a.metrics.sharpeRatio - b.metrics.sharpeRatio,
      render: (_, record) => (
        <Text style={{ color: record.metrics.sharpeRatio >= 2 ? '#3f8600' : '#faad14' }}>
          {record.metrics.sharpeRatio.toFixed(2)}
        </Text>
      ),
    },
    {
      title: 'Win Rate',
      key: 'winRate',
      width: 120,
      sorter: (a, b) => a.metrics.winRate - b.metrics.winRate,
      render: (_, record) => (
        <Progress
          percent={record.metrics.winRate}
          strokeColor={{ '0%': '#108ee9', '100%': '#87d068' }}
          formatText={(p) => `${p?.toFixed(1)}%`}
          size="small"
        />
      ),
    },
    {
      title: 'Max DD %',
      key: 'maxDrawdown',
      width: 100,
      sorter: (a, b) => a.metrics.maxDrawdown - b.metrics.maxDrawdown,
      render: (_, record) => (
        <Text style={{ color: record.metrics.maxDrawdown <= 10 ? '#3f8600' : '#cf1322' }}>
          -{record.metrics.maxDrawdown.toFixed(2)}%
        </Text>
      ),
    },
    {
      title: 'Total P&L',
      key: 'totalPnL',
      width: 120,
      sorter: (a, b) => a.metrics.totalPnL - b.metrics.totalPnL,
      render: (_, record) => (
        <Text style={{ color: record.metrics.totalPnL >= 0 ? '#3f8600' : '#cf1322', fontWeight: 'bold', fontFamily: 'monospace' }}>
          ${record.metrics.totalPnL.toLocaleString()}
        </Text>
      ),
    },
    {
      title: 'Social',
      key: 'social',
      width: 150,
      render: (_, record) => (
        <Space>
          <Tooltip content={`${record.metrics.likesCount} likes`}>
            <Space size={4}>
              <IconHeart style={{ color: record.isLiked ? '#f5222d' : '#999' }} />
              <Text type="secondary">{record.metrics.likesCount}</Text>
            </Space>
          </Tooltip>
          <Tooltip content={`${record.metrics.commentsCount} comments`}>
            <Space size={4}>
              <IconMessage style={{ color: '#1890ff' }} />
              <Text type="secondary">{record.metrics.commentsCount}</Text>
            </Space>
          </Tooltip>
          <Tooltip content={`${record.metrics.followersCount} followers`}>
            <Space size={4}>
              <IconUser style={{ color: '#52c41a' }} />
              <Text type="secondary">{record.metrics.followersCount}</Text>
            </Space>
          </Tooltip>
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button 
            size="small" 
            icon={<IconHeart />} 
            type={record.isLiked ? 'primary' : 'outline'}
            onClick={() => handleLike(record.strategyId)}
          />
          <Button 
            size="small" 
            icon={<IconMessage />}
            onClick={() => handleViewComments(record)}
          />
          {record.userId && (
            <Button 
              size="small" 
              icon={<IconUserAdd />}
              type={record.isFollowing ? 'primary' : 'outline'}
              onClick={() => handleFollow(record.userId!)}
            />
          )}
        </Space>
      ),
    },
  ];

  // Competition card component
  const CompetitionCard: React.FC<{ competition: Competition }> = ({ competition }) => {
    const statusColor = {
      upcoming: 'blue',
      active: 'green',
      ended: 'gray',
      cancelled: 'red',
    }[competition.status];

    return (
      <Card 
        style={{ marginBottom: 16 }}
        actions={[
          <Button 
            key="join" 
            type="primary" 
            onClick={() => handleJoinCompetition(competition.id)}
            disabled={competition.status !== 'upcoming' && competition.status !== 'active'}
          >
            {competition.status === 'active' ? 'Join Now' : 'Register'}
          </Button>,
        ]}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
          <div>
            <Title heading={5} style={{ margin: 0 }}>{competition.name}</Title>
            <Text type="secondary">{competition.description}</Text>
          </div>
          <Tag color={statusColor}>{competition.status.toUpperCase()}</Tag>
        </div>
        <Divider style={{ margin: '12px 0' }} />
        <Row gutter={16}>
          <Col span={6}>
            <Statistic title="Prize Pool" value={`\$${competition.prizePool.toLocaleString()}`} />
          </Col>
          <Col span={6}>
            <Statistic title="Entry Fee" value={`\$${competition.entryFee}`} />
          </Col>
          <Col span={6}>
            <Statistic title="Participants" value={competition.participantCount} suffix={competition.maxParticipants ? `/ ${competition.maxParticipants}` : ''} />
          </Col>
          <Col span={6}>
            <Statistic title="Ends In" value={Math.ceil((new Date(competition.endTime).getTime() - Date.now()) / 86400000)} suffix="days" />
          </Col>
        </Row>
        {competition.rewards.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <Text type="secondary">Rewards: </Text>
            {competition.rewards.map(r => (
              <Tag key={r.rank} color="gold">{r.badge} #{r.rank}: ${r.prize}</Tag>
            ))}
          </div>
        )}
      </Card>
    );
  };

  return (
    <ErrorBoundary>
      <div style={{ padding: isMobile ? 12 : 24 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMobile ? 12 : 24, flexWrap: 'wrap', gap: isMobile ? 8 : 0 }}>
          <Title heading={3} style={{ margin: 0 }}>
            <IconTrophy style={{ marginRight: 8 }} />
            Enhanced Leaderboard
          </Title>
          <Space wrap direction={isMobile ? 'vertical' : 'horizontal'}>
            <Text type="secondary" style={{ fontSize: isMobile ? 12 : 14 }}>
              {lastUpdated ? `Updated: ${lastUpdated.toLocaleTimeString()}` : 'Loading...'}
            </Text>
            <Select value={period} onChange={setPeriod} style={{ width: isMobile ? '100%' : 120 }}>
              <Select.Option value="daily">Daily</Select.Option>
              <Select.Option value="weekly">Weekly</Select.Option>
              <Select.Option value="monthly">Monthly</Select.Option>
              <Select.Option value="all_time">All Time</Select.Option>
            </Select>
            <Select value={sortBy} onChange={setSortBy} style={{ width: isMobile ? '100%' : 160 }}>
              <Select.Option value="comprehensiveScore">Comprehensive Score</Select.Option>
              <Select.Option value="roi">ROI</Select.Option>
              <Select.Option value="sharpeRatio">Sharpe Ratio</Select.Option>
              <Select.Option value="winRate">Win Rate</Select.Option>
              <Select.Option value="maxDrawdown">Max Drawdown</Select.Option>
              <Select.Option value="totalPnL">Total P&L</Select.Option>
              <Select.Option value="totalVolume">Volume</Select.Option>
            </Select>
            <Button type="primary" icon={<IconRefresh />} onClick={fetchLeaderboard} loading={loading}>
              Refresh
            </Button>
          </Space>
        </div>

        {/* Stats Overview */}
        {summaryStats && (
          <Row gutter={isMobile ? 8 : 16} style={{ marginBottom: isMobile ? 16 : 24 }}>
            <Col xs={12} sm={8} md={4}>
              <Card><Statistic title="Strategies" value={summaryStats.totalStrategies} prefixText="🎯" /></Card>
            </Col>
            <Col xs={12} sm={8} md={4}>
              <Card><Statistic title="Total Trades" value={summaryStats.totalTrades} prefixText="📊" /></Card>
            </Col>
            <Col xs={12} sm={8} md={4}>
              <Card><Statistic title="Total Volume" value={summaryStats.totalVolume / 1000} suffix="K" prefix="$" /></Card>
            </Col>
            <Col xs={12} sm={8} md={4}>
              <Card><Statistic title="Avg ROI" value={summaryStats.avgRoi.toFixed(2)} suffix="%" /></Card>
            </Col>
            <Col xs={12} sm={8} md={4}>
              <Card><Statistic title="Avg Sharpe" value={summaryStats.avgSharpe.toFixed(2)} /></Card>
            </Col>
            <Col xs={12} sm={8} md={4}>
              <Card><Statistic title="Top Score" value={summaryStats.topScore.toFixed(1)} style={{ color: '#3f8600' }} /></Card>
            </Col>
          </Row>
        )}

        {/* Main Content Tabs */}
        <Tabs activeTab={activeTab} onChange={setActiveTab} type="card-gutter">
          <TabPane key="rankings" title={<><IconTrophy /> Rankings</>}>
            {/* Charts */}
            <Row gutter={isMobile ? 8 : 16} style={{ marginBottom: isMobile ? 16 : 24 }}>
              <Col xs={24} md={12}>
                <Card title="🏆 Comprehensive Score (Top 10)">
                  <ResponsiveContainer width="100%" height={isMobile ? 250 : 300}>
                    <BarChart data={chartData.scoreDistribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: isMobile ? 10 : 12 }} />
                      <YAxis domain={[0, 100]} />
                      <RechartsTooltip />
                      <Bar dataKey="score" fill="#8884d8" name="Score" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card title="📊 Performance Radar (Top 5)">
                  <ResponsiveContainer width="100%" height={isMobile ? 250 : 300}>
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData.radarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="strategy" tick={{ fontSize: isMobile ? 10 : 11 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} />
                      <Radar name="Performance" dataKey="roi" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                      <Radar name="Win Rate" dataKey="winRate" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.6} />
                      <Legend />
                      <RechartsTooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                </Card>
              </Col>
            </Row>

            <Row gutter={isMobile ? 8 : 16} style={{ marginBottom: isMobile ? 16 : 24 }}>
              <Col xs={24} md={12}>
                <Card title="📈 ROI Comparison">
                  <ResponsiveContainer width="100%" height={isMobile ? 250 : 300}>
                    <AreaChart data={chartData.roiComparison}>
                      <defs>
                        <linearGradient id="colorRoi" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: isMobile ? 10 : 12 }} />
                      <YAxis />
                      <RechartsTooltip />
                      <Area type="monotone" dataKey="roi" stroke="#8884d8" fillOpacity={1} fill="url(#colorRoi)" name="ROI %" />
                      <Line type="monotone" dataKey="pnl" stroke="#82ca9d" name="P&L ($)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card title="🎯 Win Rate Distribution">
                  <ResponsiveContainer width="100%" height={isMobile ? 250 : 300}>
                    <BarChart data={chartData.winRateDistribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: isMobile ? 10 : 12 }} />
                      <YAxis domain={[0, 100]} />
                      <RechartsTooltip />
                      <Bar dataKey="winRate" name="Win Rate %">
                        {chartData.winRateDistribution.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </Col>
            </Row>

            {/* Rankings Table */}
            <Card title="🎖️ Full Rankings" bodyStyle={isMobile ? { padding: 0, overflowX: 'auto' } : undefined}>
              <Table
                columns={columns}
                dataSource={leaderboard}
                rowKey="strategyId"
                loading={loading}
                pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `Total ${total} strategies` }}
                size="small"
                scroll={isMobile ? { x: 1400 } : undefined}
              />
            </Card>
          </TabPane>

          <TabPane key="competitions" title={<><IconThunderbolt /> Competitions</>}>
            <div style={{ marginBottom: 16 }}>
              <Button type="primary" icon={<IconPlus />} onClick={() => setCompetitionModalVisible(true)}>
                Create Competition
              </Button>
            </div>

            <Row gutter={16}>
              <Col span={24}>
                <Title heading={5}>Active Competitions</Title>
                {competitions.filter(c => c.status === 'active').map(c => (
                  <CompetitionCard key={c.id} competition={c} />
                ))}
                
                <Title heading={5} style={{ marginTop: 24 }}>Upcoming Competitions</Title>
                {competitions.filter(c => c.status === 'upcoming').map(c => (
                  <CompetitionCard key={c.id} competition={c} />
                ))}

                {competitions.filter(c => c.status === 'active' || c.status === 'upcoming').length === 0 && (
                  <Empty description="No active or upcoming competitions" />
                )}
              </Col>
            </Row>
          </TabPane>

          <TabPane key="badges" title={<><IconTrophy /> Badges</>}>
            <Card title="🏆 Badge Collection">
              <Row gutter={[16, 16]}>
                {[
                  { type: 'top_trader', name: 'Top Trader', icon: '🏆', description: 'Achieved #1 rank' },
                  { type: 'high_roi', name: 'ROI Master', icon: '📈', description: 'ROI exceeds 50%' },
                  { type: 'risk_manager', name: 'Risk Manager', icon: '🛡️', description: 'Max drawdown below 5%' },
                  { type: 'winning_streak', name: 'Winning Streak', icon: '🔥', description: '10+ consecutive wins' },
                  { type: 'sharpe_king', name: 'Sharpe King', icon: '👑', description: 'Sharpe ratio above 3.0' },
                  { type: 'high_volume', name: 'Volume King', icon: '💎', description: 'Volume exceeds $1M' },
                  { type: 'consistent', name: 'Consistent Trader', icon: '⭐', description: 'Win rate above 70%' },
                  { type: 'rising_star', name: 'Rising Star', icon: '🌟', description: 'New trader with positive ROI' },
                ].map(badge => (
                  <Col xs={12} sm={8} md={6} key={badge.type}>
                    <Card hoverable style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 48, marginBottom: 8 }}>{badge.icon}</div>
                      <Title heading={6} style={{ margin: 0 }}>{badge.name}</Title>
                      <Text type="secondary" style={{ fontSize: 12 }}>{badge.description}</Text>
                    </Card>
                  </Col>
                ))}
              </Row>
            </Card>
          </TabPane>
        </Tabs>

        {/* Comment Modal */}
        <Modal
          title={<><IconMessage /> Comments for {selectedStrategy?.strategyName}</>}
          visible={commentModalVisible}
          onCancel={() => setCommentModalVisible(false)}
          footer={null}
          style={{ width: isMobile ? '100%' : 600 }}
        >
          <Form form={commentForm} layout="vertical" onFinish={handleSubmitComment}>
            <Form.Item field="content" rules={[{ required: true, message: 'Please enter a comment' }]}>
              <Input.TextArea placeholder="Write your comment..." rows={3} />
            </Form.Item>
            <Button type="primary" htmlType="submit" style={{ marginBottom: 16 }}>
              Post Comment
            </Button>
          </Form>
          <Divider />
          <List
            dataSource={comments}
            renderItem={(comment) => (
              <List.Item>
                <Comment
                  author={comment.displayName || comment.username}
                  content={comment.content}
                  datetime={new Date(comment.createdAt).toLocaleString()}
                  actions={[
                    <Space key="likes">
                      <IconHeart />
                      {comment.likesCount}
                    </Space>,
                  ]}
                />
              </List.Item>
            )}
            locale={{ emptyText: 'No comments yet' }}
          />
        </Modal>

        {/* Create Competition Modal */}
        <Modal
          title={<><IconThunderbolt /> Create Competition</>}
          visible={competitionModalVisible}
          onCancel={() => setCompetitionModalVisible(false)}
          onOk={handleCreateCompetition}
          style={{ width: isMobile ? '100%' : 600 }}
        >
          <Form form={competitionForm} layout="vertical">
            <Form.Item field="name" label="Competition Name" rules={[{ required: true }]}>
              <Input placeholder="e.g., March Madness Trading" />
            </Form.Item>
            <Form.Item field="description" label="Description">
              <Input.TextArea placeholder="Describe your competition..." rows={2} />
            </Form.Item>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item field="startTime" label="Start Time" rules={[{ required: true }]}>
                  <DatePicker showTime style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item field="endTime" label="End Time" rules={[{ required: true }]}>
                  <DatePicker showTime style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item field="entryFee" label="Entry Fee ($)" initialValue={0}>
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item field="prizePool" label="Prize Pool ($)" initialValue={0}>
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item field="maxParticipants" label="Max Participants">
              <InputNumber min={2} style={{ width: '100%' }} placeholder="Leave empty for unlimited" />
            </Form.Item>
          </Form>
        </Modal>

        {/* Footer */}
        <div style={{ marginTop: 16, textAlign: 'center', color: '#999' }}>
          <Text type="secondary">
            Enhanced Leaderboard with multi-dimensional rankings, time periods, social features, and competitions.
            <br />
            Last updated: {lastUpdated?.toLocaleString() || 'Never'}
          </Text>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default EnhancedLeaderboardPage;
