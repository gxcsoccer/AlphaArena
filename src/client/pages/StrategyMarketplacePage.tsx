import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Input,
  Select,
  Tag,
  Button,
  Modal,
  Rate,
  Spin,
  Empty,
  Tabs,
  Tooltip,
  Badge,
  Avatar,
  Space,
  Divider,
  Message,
  Switch,
  Slider,
  Form,
  Typography,
  Statistic,
  Grid,
  List,
  Popconfirm,
} from '@arco-design/web-react';
import {
  IconSearch,
  IconStar,
  IconUser,
  IconFire,
  IconThumbUp,
  IconCopy,
  IconTags,
  IconInfoCircle,
  IconPlus,
  IconDelete,
  IconEye,
  IconTrophy,
  IconDriveFile,
  IconPlayCircle,
  IconPauseCircle,
  IconCheck,
  IconClose,
  IconMessage,
  IconNotification,
} from '@arco-design/web-react/icon';
import './StrategyMarketplacePage.css';

const { Search } = Input;
const { Option } = Select;
const TabPane = Tabs.TabPane;
const { Title, Text } = Typography;
const { _Meta } = Card;
const { Row, Col } = Grid;

// API base URL
const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * Marketplace Strategy interface
 */
interface MarketplaceStrategy {
  id: string;
  publisherId: string;
  name: string;
  description: string | null;
  strategyType: string;
  category: string;
  symbols: string[];
  config: Record<string, unknown>;
  riskParams: Record<string, unknown>;
  tags: string[];
  visibility: string;
  status: string;
  performanceMetrics: {
    totalReturn?: number | null;
    annualizedReturn?: number | null;
    sharpeRatio?: number | null;
    maxDrawdown?: number | null;
    winRate?: number | null;
    profitFactor?: number | null;
    avgTradeDuration?: number | null;
    totalTrades?: number | null;
  };
  subscriptionFee: number;
  feeCurrency: string;
  revenueSharePercent: number;
  subscriberCount: number;
  viewCount: number;
  ratingAvg: number;
  ratingCount: number;
  signalCount: number;
  isFeatured: boolean;
  isVerified: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Strategy Subscription interface
 */
interface StrategySubscription {
  id: string;
  subscriberId: string;
  strategyId: string;
  autoExecute: boolean;
  copyRatio: number;
  fixedAmount: number | null;
  maxRiskPerTrade: number | null;
  allowedSymbols: string[];
  blockedSymbols: string[];
  notifySignal: boolean;
  notifyExecution: boolean;
  status: 'active' | 'paused' | 'cancelled' | 'expired';
  startedAt: string;
  expiresAt: string | null;
  signalsReceived: number;
  signalsExecuted: number;
  totalPnl: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Strategy Review interface
 */
interface StrategyReview {
  id: string;
  strategyId: string;
  userId: string;
  rating: number;
  title: string | null;
  content: string | null;
  isVerifiedSubscriber: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Strategy Signal interface
 */
interface StrategySignal {
  id: string;
  strategyId: string;
  publisherId: string;
  symbol: string;
  side: 'buy' | 'sell';
  signalType: string;
  entryPrice: number | null;
  targetPrice: number | null;
  stopLoss: number | null;
  quantity: number | null;
  title: string | null;
  description: string | null;
  confidenceScore: number | null;
  riskLevel: string;
  status: string;
  createdAt: string;
}

// Get user ID from localStorage or generate a placeholder
function getUserId(): string {
  const stored = localStorage.getItem('userId');
  if (stored) return stored;
  // In a real app, this would come from auth context
  return `user_${Date.now()}`;
}

/**
 * Strategy Card Component
 */
const StrategyCard: React.FC<{
  strategy: MarketplaceStrategy;
  onClick: () => void;
  onSubscribe?: () => void;
  isSubscribed?: boolean;
}> = ({ strategy, onClick, onSubscribe, isSubscribed }) => {
  const categoryColors: Record<string, string> = {
    momentum: 'blue',
    mean_reversion: 'green',
    breakout: 'orange',
    trend_following: 'purple',
    scalping: 'cyan',
    advanced: 'magenta',
    general: 'gray',
  };

  const performance = strategy.performanceMetrics || {};

  return (
    <Card
      className="template-card"
      hoverable
      onClick={onClick}
      actions={[
        isSubscribed ? (
          <Button key="subscribed" type="primary" size="small" icon={<IconCheck />} disabled>
            Subscribed
          </Button>
        ) : (
          <Button
            key="subscribe"
            type="primary"
            size="small"
            icon={<IconPlus />}
            onClick={(e) => {
              e.stopPropagation();
              onSubscribe?.();
            }}
          >
            Subscribe
          </Button>
        ),
      ]}
    >
      <div className="template-card-header">
        <div className="template-card-title">
          <h3>{strategy.name}</h3>
          {strategy.isFeatured && (
            <Badge count="Featured" style={{ backgroundColor: 'rgb(var(--primary-6))' }} />
          )}
          {strategy.isVerified && (
            <Badge count="Verified" style={{ backgroundColor: 'rgb(var(--success-6))' }} />
          )}
        </div>
        <div className="template-card-meta">
          <Tag color={categoryColors[strategy.category] || 'gray'}>
            {strategy.category?.replace('_', ' ') || 'General'}
          </Tag>
          <Tag>{strategy.strategyType?.toUpperCase() || 'STRATEGY'}</Tag>
        </div>
      </div>

      <div className="template-card-description">
        {strategy.description || 'No description available'}
      </div>

      {performance && (
        <div className="template-card-metrics">
          {performance.winRate !== null && performance.winRate !== undefined && (
            <div className="metric">
              <span className="metric-label">Win Rate</span>
              <span className="metric-value">{performance.winRate.toFixed(1)}%</span>
            </div>
          )}
          {performance.sharpeRatio !== null && performance.sharpeRatio !== undefined && (
            <div className="metric">
              <span className="metric-label">Sharpe</span>
              <span className="metric-value">{performance.sharpeRatio.toFixed(2)}</span>
            </div>
          )}
          {performance.maxDrawdown !== null && performance.maxDrawdown !== undefined && (
            <div className="metric">
              <span className="metric-label">Max DD</span>
              <span className="metric-value">{performance.maxDrawdown.toFixed(1)}%</span>
            </div>
          )}
          {performance.totalReturn !== null && performance.totalReturn !== undefined && (
            <div className="metric">
              <span className="metric-label">Return</span>
              <span className="metric-value" style={{ color: performance.totalReturn >= 0 ? 'green' : 'red' }}>
                {performance.totalReturn >= 0 ? '+' : ''}{performance.totalReturn.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      )}

      <div className="template-card-footer">
        <Space>
          <span className="rating">
            <IconStar style={{ color: 'rgb(var(--warning-6))' }} />
            <span>{strategy.ratingAvg?.toFixed(1) || '0.0'}</span>
            <span className="rating-count">({strategy.ratingCount || 0})</span>
          </span>
          <span className="use-count">
            <IconUser />
            <span>{strategy.subscriberCount || 0} subscribers</span>
          </span>
          <span className="view-count">
            <IconEye />
            <span>{strategy.viewCount || 0} views</span>
          </span>
        </Space>
      </div>

      {strategy.tags && strategy.tags.length > 0 && (
        <div className="template-card-tags">
          {strategy.tags.slice(0, 4).map((tag) => (
            <Tag key={tag} size="small" bordered={false}>
              {tag}
            </Tag>
          ))}
        </div>
      )}

      {strategy.subscriptionFee > 0 && (
        <div className="subscription-fee">
          <Text type="secondary">
            {strategy.subscriptionFee} {strategy.feeCurrency}/month
          </Text>
        </div>
      )}
    </Card>
  );
};

/**
 * Subscribe Modal Component
 */
const SubscribeModal: React.FC<{
  strategy: MarketplaceStrategy | null;
  visible: boolean;
  onClose: () => void;
  onConfirm: (settings: {
    autoExecute: boolean;
    copyRatio: number;
    maxRiskPerTrade?: number;
    notifySignal: boolean;
  }) => void;
}> = ({ strategy, visible, onClose, onConfirm }) => {
  const [autoExecute, setAutoExecute] = useState(false);
  const [copyRatio, setCopyRatio] = useState(1);
  const [maxRisk, setMaxRisk] = useState<number | undefined>(undefined);
  const [notifySignal, setNotifySignal] = useState(true);

  useEffect(() => {
    if (visible) {
      setAutoExecute(false);
      setCopyRatio(1);
      setMaxRisk(undefined);
      setNotifySignal(true);
    }
  }, [visible]);

  if (!strategy) return null;

  return (
    <Modal
      title={`Subscribe to ${strategy.name}`}
      visible={visible}
      onCancel={onClose}
      onOk={() => onConfirm({ autoExecute, copyRatio, maxRiskPerTrade: maxRisk, notifySignal })}
      okText="Subscribe"
      style={{ width: 500 }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <div>
          <Text type="secondary">Strategy by: </Text>
          <Text>{strategy.publisherId.slice(0, 8)}...</Text>
        </div>

        {strategy.subscriptionFee > 0 && (
          <Card size="small">
            <Statistic
              title="Subscription Fee"
              value={strategy.subscriptionFee}
              suffix={strategy.feeCurrency}
            />
          </Card>
        )}

        <div>
          <div style={{ marginBottom: 8 }}>
            <Text>Auto Execute Signals</Text>
            <Switch
              checked={autoExecute}
              onChange={setAutoExecute}
              style={{ marginLeft: 12 }}
            />
          </div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Automatically execute trades when signals are received
          </Text>
        </div>

        <div>
          <div style={{ marginBottom: 8 }}>
            <Text>Copy Ratio: {copyRatio}x</Text>
          </div>
          <Slider
            value={copyRatio}
            onChange={(val) => setCopyRatio(val as number)}
            min={0.1}
            max={5}
            step={0.1}
            style={{ width: '100%' }}
          />
        </div>

        <div>
          <div style={{ marginBottom: 8 }}>
            <Text>Max Risk Per Trade (optional)</Text>
          </div>
          <Input
            type="number"
            placeholder="e.g., 100 USDT"
            value={maxRisk}
            onChange={(val) => setMaxRisk(parseFloat(val) || undefined)}
          />
        </div>

        <div>
          <div style={{ marginBottom: 8 }}>
            <Text>Notify on New Signals</Text>
            <Switch
              checked={notifySignal}
              onChange={setNotifySignal}
              style={{ marginLeft: 12 }}
            />
          </div>
        </div>
      </Space>
    </Modal>
  );
};

/**
 * Strategy Detail Modal
 */
const StrategyDetailModal: React.FC<{
  strategy: MarketplaceStrategy | null;
  visible: boolean;
  onClose: () => void;
  onSubscribe?: () => void;
  isSubscribed?: boolean;
  reviews: StrategyReview[];
  signals: StrategySignal[];
  userReview: StrategyReview | null;
  onRate: (rating: number, comment?: string) => void;
}> = ({
  strategy,
  visible,
  onClose,
  onSubscribe,
  isSubscribed,
  reviews,
  signals,
  userReview,
  onRate,
}) => {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [activeDetailTab, setActiveDetailTab] = useState('overview');

  useEffect(() => {
    if (userReview) {
      setRating(userReview.rating);
      setComment(userReview.content || '');
    } else {
      setRating(0);
      setComment('');
    }
  }, [userReview, visible]);

  if (!strategy) return null;

  const performance = strategy.performanceMetrics || {};

  return (
    <Modal
      title={strategy.name}
      visible={visible}
      onCancel={onClose}
      footer={
        <Space>
          <Button onClick={onClose}>Close</Button>
          {isSubscribed ? (
            <Button type="primary" icon={<IconCheck />} disabled>
              Subscribed
            </Button>
          ) : (
            <Button type="primary" icon={<IconPlus />} onClick={onSubscribe}>
              Subscribe
            </Button>
          )}
        </Space>
      }
      style={{ width: '900px', maxWidth: '95vw' }}
    >
      <Tabs activeTab={activeDetailTab} onChange={setActiveDetailTab}>
        <TabPane key="overview" tab="Overview">
          <div className="template-detail">
            <div className="template-detail-header">
              <Space>
                <Tag color="blue">{strategy.category?.replace('_', ' ') || 'General'}</Tag>
                <Tag>{strategy.strategyType?.toUpperCase() || 'STRATEGY'}</Tag>
                {strategy.symbols?.length > 0 && (
                  <Tag>{strategy.symbols.slice(0, 3).join(', ')}</Tag>
                )}
              </Space>
              {strategy.isVerified && (
                <Badge
                  count="Verified Publisher"
                  style={{ backgroundColor: 'rgb(var(--success-6))' }}
                />
              )}
            </div>

            <div className="template-detail-description">
              {strategy.description || 'No description available'}
            </div>

            <Card title="Performance Metrics" className="performance-card">
              <Row gutter={[16, 16]}>
                {performance.totalReturn !== null && performance.totalReturn !== undefined && (
                  <Col span={6}>
                    <Statistic
                      title="Total Return"
                      value={performance.totalReturn}
                      suffix="%"
                      valueStyle={{
                        color: performance.totalReturn >= 0 ? 'green' : 'red',
                      }}
                    />
                  </Col>
                )}
                {performance.annualizedReturn !== null && performance.annualizedReturn !== undefined && (
                  <Col span={6}>
                    <Statistic
                      title="Annual Return"
                      value={performance.annualizedReturn}
                      suffix="%"
                      valueStyle={{
                        color: performance.annualizedReturn >= 0 ? 'green' : 'red',
                      }}
                    />
                  </Col>
                )}
                {performance.sharpeRatio !== null && performance.sharpeRatio !== undefined && (
                  <Col span={6}>
                    <Statistic title="Sharpe Ratio" value={performance.sharpeRatio?.toFixed(2)} />
                  </Col>
                )}
                {performance.maxDrawdown !== null && performance.maxDrawdown !== undefined && (
                  <Col span={6}>
                    <Statistic
                      title="Max Drawdown"
                      value={performance.maxDrawdown}
                      suffix="%"
                      valueStyle={{ color: 'red' }}
                    />
                  </Col>
                )}
                {performance.winRate !== null && performance.winRate !== undefined && (
                  <Col span={6}>
                    <Statistic title="Win Rate" value={performance.winRate?.toFixed(1)} suffix="%" />
                  </Col>
                )}
                {performance.totalTrades !== null && performance.totalTrades !== undefined && (
                  <Col span={6}>
                    <Statistic title="Total Trades" value={performance.totalTrades} />
                  </Col>
                )}
              </Row>
            </Card>

            <Row gutter={16} style={{ marginTop: 16 }}>
              <Col span={8}>
                <Card size="small">
                  <Statistic
                    title="Subscribers"
                    value={strategy.subscriberCount || 0}
                    prefix={<IconUser />}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small">
                  <Statistic
                    title="Signals Sent"
                    value={strategy.signalCount || 0}
                    prefix={<IconDriveFile />}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small">
                  <Statistic
                    title="Rating"
                    value={strategy.ratingAvg?.toFixed(1) || '0.0'}
                    prefix={<IconStar style={{ color: 'gold' }} />}
                    suffix={`/ 5 (${strategy.ratingCount || 0})`}
                  />
                </Card>
              </Col>
            </Row>

            {strategy.tags && strategy.tags.length > 0 && (
              <div className="template-tags-section">
                <h4>
                  <IconTags /> Tags
                </h4>
                <div className="tags-list">
                  {strategy.tags.map((tag) => (
                    <Tag key={tag}>{tag}</Tag>
                  ))}
                </div>
              </div>
            )}
          </div>
        </TabPane>

        <TabPane key="signals" tab={`Signals (${signals.length})`}>
          {signals.length > 0 ? (
            <List
              dataSource={signals}
              renderItem={(signal) => (
                <List.Item
                  actions={[
                    <Tag key="status" color={signal.status === 'active' ? 'green' : 'default'}>
                      {signal.status}
                    </Tag>,
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        <Tag color={signal.side === 'buy' ? 'green' : 'red'}>{signal.side.toUpperCase()}</Tag>
                        <span>{signal.symbol}</span>
                        {signal.title && <Text>{signal.title}</Text>}
                      </Space>
                    }
                    description={
                      <Space split={<Divider type="vertical" />}>
                        {signal.entryPrice && <Text type="secondary">Entry: {signal.entryPrice}</Text>}
                        {signal.targetPrice && <Text type="secondary">Target: {signal.targetPrice}</Text>}
                        {signal.stopLoss && <Text type="secondary">SL: {signal.stopLoss}</Text>}
                        <Text type="secondary">
                          {new Date(signal.createdAt).toLocaleString()}
                        </Text>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          ) : (
            <Empty description="No signals yet" />
          )}
        </TabPane>

        <TabPane key="reviews" tab={`Reviews (${reviews.length})`}>
          <div style={{ marginBottom: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text>Rate this strategy</Text>
              <Rate value={rating} onChange={setRating} />
              <Input.TextArea
                placeholder="Write a review (optional)"
                value={comment}
                onChange={setComment}
                rows={3}
              />
              <Button
                type="primary"
                onClick={() => rating > 0 && onRate(rating, comment || undefined)}
                disabled={rating === 0}
              >
                Submit Review
              </Button>
            </Space>
          </div>

          <Divider />

          {reviews.length > 0 ? (
            <List
              dataSource={reviews}
              renderItem={(review) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<Avatar>{review.userId.slice(0, 2).toUpperCase()}</Avatar>}
                    title={
                      <Space>
                        <span>{review.userId.slice(0, 8)}...</span>
                        <Rate value={review.rating} readonly style={{ fontSize: 12 }} />
                        {review.isVerifiedSubscriber && (
                          <Tag color="green" size="small">
                            Verified Subscriber
                          </Tag>
                        )}
                      </Space>
                    }
                    description={
                      <>
                        {review.content && <Text>{review.content}</Text>}
                        <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
                          {new Date(review.createdAt).toLocaleDateString()}
                        </Text>
                      </>
                    }
                  />
                </List.Item>
              )}
            />
          ) : (
            <Empty description="No reviews yet" />
          )}
        </TabPane>
      </Tabs>
    </Modal>
  );
};

/**
 * My Subscriptions Tab Component
 */
const MySubscriptionsTab: React.FC<{
  subscriptions: StrategySubscription[];
  strategies: Map<string, MarketplaceStrategy>;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  loading: boolean;
}> = ({ subscriptions, strategies, onPause, onResume, onCancel, loading }) => {
  if (loading) {
    return (
      <div className="loading-container">
        <Spin size={40} />
      </div>
    );
  }

  if (subscriptions.length === 0) {
    return (
      <Empty
        description="No subscriptions yet"
        icon={<IconUser />}
      />
    );
  }

  return (
    <List
      dataSource={subscriptions}
      renderItem={(sub) => {
        const strategy = strategies.get(sub.strategyId);
        return (
          <Card style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Title heading={5}>{strategy?.name || 'Unknown Strategy'}</Title>
                <Space split={<Divider type="vertical" />}>
                  <Text type="secondary">
                    Status: <Tag color={sub.status === 'active' ? 'green' : sub.status === 'paused' ? 'orange' : 'default'}>
                      {sub.status}
                    </Tag>
                  </Text>
                  <Text type="secondary">Signals: {sub.signalsReceived}</Text>
                  <Text type="secondary">Executed: {sub.signalsExecuted}</Text>
                  <Text type="secondary" style={{ color: sub.totalPnl >= 0 ? 'green' : 'red' }}>
                    PnL: {sub.totalPnl >= 0 ? '+' : ''}{sub.totalPnl.toFixed(2)}
                  </Text>
                </Space>
              </div>
              <Space>
                {sub.status === 'active' && (
                  <Button
                    type="outline"
                    size="small"
                    icon={<IconPauseCircle />}
                    onClick={() => onPause(sub.id)}
                  >
                    Pause
                  </Button>
                )}
                {sub.status === 'paused' && (
                  <Button
                    type="outline"
                    size="small"
                    icon={<IconPlayCircle />}
                    onClick={() => onResume(sub.id)}
                  >
                    Resume
                  </Button>
                )}
                <Popconfirm
                  title="Are you sure you want to cancel this subscription?"
                  onConfirm={() => onCancel(sub.id)}
                >
                  <Button type="outline" size="small" status="danger" icon={<IconClose />}>
                    Cancel
                  </Button>
                </Popconfirm>
              </Space>
            </div>
          </Card>
        );
      }}
    />
  );
};

/**
 * Main Strategy Marketplace Page
 */
const StrategyMarketplacePage: React.FC = () => {
  const [strategies, setStrategies] = useState<MarketplaceStrategy[]>([]);
  const [subscriptions, setSubscriptions] = useState<StrategySubscription[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState<MarketplaceStrategy | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [subscribeModalVisible, setSubscribeModalVisible] = useState(false);
  const [reviews, setReviews] = useState<StrategyReview[]>([]);
  const [signals, setSignals] = useState<StrategySignal[]>([]);
  const [userReview, setUserReview] = useState<StrategyReview | null>(null);
  const [userId] = useState(getUserId);
  const [strategyMap, setStrategyMap] = useState<Map<string, MarketplaceStrategy>>(new Map());

  // Fetch strategies
  const fetchStrategies = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (selectedCategory) params.append('category', selectedCategory);
      if (selectedType) params.append('strategyType', selectedType);
      if (selectedTags.length > 0) params.append('tags', selectedTags.join(','));
      params.append('orderBy', sortBy);
      params.append('limit', '50');

      const response = await fetch(`${API_BASE}/api/marketplace/strategies?${params}`, {
        headers: { 'x-user-id': userId },
      });
      const data = await response.json();

      if (data.success) {
        setStrategies(data.data);
        const map = new Map<string, MarketplaceStrategy>();
        data.data.forEach((s: MarketplaceStrategy) => map.set(s.id, s));
        setStrategyMap(map);
      }
    } catch (error) {
      Message.error('Failed to load strategies');
      console.error('Failed to fetch strategies:', error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedCategory, selectedType, selectedTags, sortBy, userId]);

  // Fetch subscriptions
  const fetchSubscriptions = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/marketplace/subscriptions`, {
        headers: { 'x-user-id': userId },
      });
      const data = await response.json();

      if (data.success) {
        setSubscriptions(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch subscriptions:', error);
    }
  }, [userId]);

  // Fetch categories and tags
  const fetchFilters = useCallback(async () => {
    try {
      const [categoriesRes, tagsRes] = await Promise.all([
        fetch(`${API_BASE}/api/marketplace/strategies/categories`),
        fetch(`${API_BASE}/api/marketplace/strategies/tags`),
      ]);

      const categoriesData = await categoriesRes.json();
      const tagsData = await tagsRes.json();

      if (categoriesData.success) setCategories(categoriesData.data);
      if (tagsData.success) setTags(tagsData.data);
    } catch (error) {
      console.error('Failed to fetch filters:', error);
    }
  }, []);

  // Fetch strategy details
  const fetchStrategyDetails = useCallback(async (strategyId: string) => {
    try {
      const [reviewsRes, signalsRes, userReviewRes] = await Promise.all([
        fetch(`${API_BASE}/api/marketplace/strategies/${strategyId}/reviews?limit=20`),
        fetch(`${API_BASE}/api/marketplace/strategies/${strategyId}/signals?limit=20`),
        fetch(`${API_BASE}/api/marketplace/strategies/${strategyId}/reviews`, {
          headers: { 'x-user-id': userId },
        }),
      ]);

      const reviewsData = await reviewsRes.json();
      const signalsData = await signalsRes.json();

      if (reviewsData.success) setReviews(reviewsData.data);
      if (signalsData.success) setSignals(signalsData.data);
      
      // Check for user's existing review
      const userReviewData = await userReviewRes.json();
      if (userReviewData.success && userReviewData.data?.length > 0) {
        setUserReview(userReviewData.data.find((r: StrategyReview) => r.userId === userId) || null);
      }
    } catch (error) {
      console.error('Failed to fetch strategy details:', error);
    }
  }, [userId]);

  useEffect(() => {
    fetchFilters();
  }, [fetchFilters]);

  useEffect(() => {
    fetchStrategies();
  }, [fetchStrategies]);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  // Handle strategy click
  const handleStrategyClick = (strategy: MarketplaceStrategy) => {
    setSelectedStrategy(strategy);
    setDetailVisible(true);
    fetchStrategyDetails(strategy.id);
  };

  // Handle subscribe
  const handleSubscribe = async (settings: {
    autoExecute: boolean;
    copyRatio: number;
    maxRiskPerTrade?: number;
    notifySignal: boolean;
  }) => {
    if (!selectedStrategy) return;

    try {
      const response = await fetch(`${API_BASE}/api/marketplace/subscriptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          strategyId: selectedStrategy.id,
          subscriberId: userId,
          ...settings,
        }),
      });

      const data = await response.json();

      if (data.success) {
        Message.success('Subscribed successfully!');
        setSubscribeModalVisible(false);
        fetchSubscriptions();
        fetchStrategies();
      } else {
        Message.error(data.error || 'Failed to subscribe');
      }
    } catch (error) {
      Message.error('Failed to subscribe');
      console.error('Failed to subscribe:', error);
    }
  };

  // Handle pause subscription
  const handlePauseSubscription = async (subscriptionId: string) => {
    try {
      const response = await fetch(
        `${API_BASE}/api/marketplace/subscriptions/${subscriptionId}/pause`,
        {
          method: 'POST',
          headers: { 'x-user-id': userId },
        }
      );

      const data = await response.json();

      if (data.success) {
        Message.success('Subscription paused');
        fetchSubscriptions();
      } else {
        Message.error(data.error || 'Failed to pause');
      }
    } catch (_error) {
      Message.error('Failed to pause subscription');
    }
  };

  // Handle resume subscription
  const handleResumeSubscription = async (subscriptionId: string) => {
    try {
      const response = await fetch(
        `${API_BASE}/api/marketplace/subscriptions/${subscriptionId}/resume`,
        {
          method: 'POST',
          headers: { 'x-user-id': userId },
        }
      );

      const data = await response.json();

      if (data.success) {
        Message.success('Subscription resumed');
        fetchSubscriptions();
      } else {
        Message.error(data.error || 'Failed to resume');
      }
    } catch (_error) {
      Message.error('Failed to resume subscription');
    }
  };

  // Handle cancel subscription
  const handleCancelSubscription = async (subscriptionId: string) => {
    try {
      const response = await fetch(
        `${API_BASE}/api/marketplace/subscriptions/${subscriptionId}`,
        {
          method: 'DELETE',
          headers: { 'x-user-id': userId },
        }
      );

      const data = await response.json();

      if (data.success) {
        Message.success('Subscription cancelled');
        fetchSubscriptions();
        fetchStrategies();
      } else {
        Message.error(data.error || 'Failed to cancel');
      }
    } catch (_error) {
      Message.error('Failed to cancel subscription');
    }
  };

  // Handle rate strategy
  const handleRateStrategy = async (rating: number, comment?: string) => {
    if (!selectedStrategy) return;

    try {
      const response = await fetch(
        `${API_BASE}/api/marketplace/strategies/${selectedStrategy.id}/reviews`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': userId,
          },
          body: JSON.stringify({
            strategyId: selectedStrategy.id,
            userId,
            rating,
            content: comment,
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        Message.success('Review submitted!');
        setUserReview(data.data);
        fetchStrategyDetails(selectedStrategy.id);
      } else {
        Message.error(data.error || 'Failed to submit review');
      }
    } catch (_error) {
      Message.error('Failed to submit review');
    }
  };

  const subscribedIds = new Set(subscriptions.filter(s => s.status === 'active').map(s => s.strategyId));
  const featuredStrategies = strategies.filter((s) => s.isFeatured);
  const topRatedStrategies = [...strategies].sort((a, b) => b.ratingAvg - a.ratingAvg).slice(0, 10);

  return (
    <div className="strategy-marketplace-page">
      <div className="page-header">
        <h1>
          <IconFire /> Strategy Marketplace
        </h1>
        <p>Discover, subscribe, and follow proven trading strategies from top publishers</p>
      </div>

      <Tabs defaultActiveTab="discover">
        <TabPane key="discover" tab="Discover">
          <div className="filters-section">
            <Search
              placeholder="Search strategies..."
              value={searchQuery}
              onChange={setSearchQuery}
              style={{ width: 300 }}
            />
            <Select
              placeholder="Category"
              value={selectedCategory}
              onChange={setSelectedCategory}
              style={{ width: 180 }}
              allowClear
            >
              {categories.map((cat) => (
                <Option key={cat} value={cat}>
                  {cat.replace('_', ' ')}
                </Option>
              ))}
            </Select>
            <Select
              placeholder="Strategy Type"
              value={selectedType}
              onChange={setSelectedType}
              style={{ width: 180 }}
              allowClear
            >
              <Option value="rsi">RSI</Option>
              <Option value="macd">MACD</Option>
              <Option value="bollinger_bands">Bollinger Bands</Option>
              <Option value="vwap">VWAP</Option>
              <Option value="stochastic">Stochastic</Option>
              <Option value="fibonacci">Fibonacci</Option>
              <Option value="atr">ATR</Option>
              <Option value="ichimoku">Ichimoku</Option>
              <Option value="elliott_wave">Elliott Wave</Option>
              <Option value="sma">SMA</Option>
            </Select>
            <Select
              placeholder="Sort by"
              value={sortBy}
              onChange={setSortBy}
              style={{ width: 180 }}
            >
              <Option value="created_at">Newest</Option>
              <Option value="rating_avg">Top Rated</Option>
              <Option value="subscriber_count">Most Subscribers</Option>
              <Option value="view_count">Most Views</Option>
              <Option value="name">Name</Option>
            </Select>
          </div>

          {loading ? (
            <div className="loading-container">
              <Spin size={40} />
            </div>
          ) : strategies.length > 0 ? (
            <div className="templates-grid">
              {strategies.map((strategy) => (
                <StrategyCard
                  key={strategy.id}
                  strategy={strategy}
                  onClick={() => handleStrategyClick(strategy)}
                  onSubscribe={() => {
                    setSelectedStrategy(strategy);
                    setSubscribeModalVisible(true);
                  }}
                  isSubscribed={subscribedIds.has(strategy.id)}
                />
              ))}
            </div>
          ) : (
            <Empty description="No strategies found" />
          )}

          {tags.length > 0 && (
            <Card title="Popular Tags" className="tags-card" style={{ marginTop: 24 }}>
              <div className="tags-cloud">
                {tags.slice(0, 20).map((tag) => (
                  <Tag
                    key={tag}
                    style={{ cursor: 'pointer', margin: '4px' }}
                    color={selectedTags.includes(tag) ? 'blue' : 'gray'}
                    onClick={() => {
                      if (selectedTags.includes(tag)) {
                        setSelectedTags(selectedTags.filter((t) => t !== tag));
                      } else {
                        setSelectedTags([...selectedTags, tag]);
                      }
                    }}
                  >
                    {tag}
                  </Tag>
                ))}
              </div>
            </Card>
          )}
        </TabPane>

        <TabPane
          key="featured"
          tab={
            <span>
              <IconTrophy /> Featured
            </span>
          }
        >
          {featuredStrategies.length > 0 ? (
            <div className="templates-grid">
              {featuredStrategies.map((strategy) => (
                <StrategyCard
                  key={strategy.id}
                  strategy={strategy}
                  onClick={() => handleStrategyClick(strategy)}
                  onSubscribe={() => {
                    setSelectedStrategy(strategy);
                    setSubscribeModalVisible(true);
                  }}
                  isSubscribed={subscribedIds.has(strategy.id)}
                />
              ))}
            </div>
          ) : (
            <Empty description="No featured strategies" />
          )}
        </TabPane>

        <TabPane
          key="top-rated"
          tab={
            <span>
              <IconStar /> Top Rated
            </span>
          }
        >
          <div className="templates-grid">
            {topRatedStrategies.map((strategy) => (
              <StrategyCard
                key={strategy.id}
                strategy={strategy}
                onClick={() => handleStrategyClick(strategy)}
                onSubscribe={() => {
                  setSelectedStrategy(strategy);
                  setSubscribeModalVisible(true);
                }}
                isSubscribed={subscribedIds.has(strategy.id)}
              />
            ))}
          </div>
        </TabPane>

        <TabPane
          key="my-subscriptions"
          tab={
            <span>
              <IconNotification /> My Subscriptions ({subscriptions.filter(s => s.status !== 'cancelled').length})
            </span>
          }
        >
          <MySubscriptionsTab
            subscriptions={subscriptions.filter(s => s.status !== 'cancelled')}
            strategies={strategyMap}
            onPause={handlePauseSubscription}
            onResume={handleResumeSubscription}
            onCancel={handleCancelSubscription}
            loading={loading}
          />
        </TabPane>
      </Tabs>

      <StrategyDetailModal
        strategy={selectedStrategy}
        visible={detailVisible}
        onClose={() => {
          setDetailVisible(false);
          setSelectedStrategy(null);
          setReviews([]);
          setSignals([]);
          setUserReview(null);
        }}
        onSubscribe={() => {
          setDetailVisible(false);
          setSubscribeModalVisible(true);
        }}
        isSubscribed={selectedStrategy ? subscribedIds.has(selectedStrategy.id) : false}
        reviews={reviews}
        signals={signals}
        userReview={userReview}
        onRate={handleRateStrategy}
      />

      <SubscribeModal
        strategy={selectedStrategy}
        visible={subscribeModalVisible}
        onClose={() => setSubscribeModalVisible(false)}
        onConfirm={handleSubscribe}
      />
    </div>
  );
};

export default StrategyMarketplacePage;