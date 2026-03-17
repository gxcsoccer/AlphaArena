import React, { useState, useEffect } from 'react';
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
} from '@arco-design/web-react';
import Message from '@arco-design/web-react/es/Message';
import {
  IconSearch,
  IconStar,
  IconUser,
  IconFire,
  IconThumbUp,
  IconCopy,
  IconTags,
  IconInfoCircle,
} from '@arco-design/web-react/icon';
import './StrategyMarketplacePage.css';

const { Search } = Input;
const { Option } = Select;
const TabPane = Tabs.TabPane;

/**
 * Strategy Template interface
 */
interface StrategyTemplate {
  id: string;
  name: string;
  description: string | null;
  authorUserId: string | null;
  authorName: string | null;
  strategyType: string;
  category: string;
  symbol: string;
  config: Record<string, any>;
  riskParams: Record<string, any>;
  tags: string[];
  isPublic: boolean;
  isFeatured: boolean;
  isBuiltin: boolean;
  performanceMetrics: {
    winRate?: number;
    avgReturn?: number;
    sharpeRatio?: number;
    maxDrawdown?: number;
  };
  backtestPeriod: string | null;
  useCount: number;
  ratingAvg: number;
  ratingCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Template Rating interface
 */
interface TemplateRating {
  id: string;
  templateId: string;
  userId: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
}

/**
 * Template detail modal props
 */
interface TemplateDetailModalProps {
  template: StrategyTemplate | null;
  visible: boolean;
  onClose: () => void;
  onUse: (template: StrategyTemplate) => void;
  onRate: (templateId: string, rating: number, comment?: string) => void;
  userRating: TemplateRating | null;
}

/**
 * Template Card component
 */
const TemplateCard: React.FC<{
  template: StrategyTemplate;
  onClick: () => void;
  onUse: () => void;
}> = ({ template, onClick, onUse }) => {
  const categoryColors: Record<string, string> = {
    momentum: 'blue',
    mean_reversion: 'green',
    breakout: 'orange',
    trend_following: 'purple',
    scalping: 'cyan',
    advanced: 'magenta',
    general: 'gray',
  };

  return (
    <Card
      className="template-card"
      hoverable
      onClick={onClick}
      actions={[
        <Button
          key="use"
          type="primary"
          size="small"
          icon={<IconCopy />}
          onClick={(e) => {
            e.stopPropagation();
            onUse();
          }}
        >
          Use Template
        </Button>,
      ]}
    >
      <div className="template-card-header">
        <div className="template-card-title">
          <h3>{template.name}</h3>
          {template.isFeatured && (
            <Badge count="Featured" style={{ backgroundColor: 'rgb(var(--primary-6))' }} />
          )}
          {template.isBuiltin && (
            <Badge count="Official" style={{ backgroundColor: 'rgb(var(--success-6))' }} />
          )}
        </div>
        <div className="template-card-meta">
          <Tag color={categoryColors[template.category] || 'gray'}>
            {template.category.replace('_', ' ')}
          </Tag>
          <Tag>{template.strategyType.toUpperCase()}</Tag>
        </div>
      </div>

      <div className="template-card-description">
        {template.description || 'No description available'}
      </div>

      {template.performanceMetrics && (
        <div className="template-card-metrics">
          {template.performanceMetrics.winRate && (
            <div className="metric">
              <span className="metric-label">Win Rate</span>
              <span className="metric-value">{template.performanceMetrics.winRate}%</span>
            </div>
          )}
          {template.performanceMetrics.sharpeRatio && (
            <div className="metric">
              <span className="metric-label">Sharpe</span>
              <span className="metric-value">{template.performanceMetrics.sharpeRatio}</span>
            </div>
          )}
          {template.performanceMetrics.maxDrawdown && (
            <div className="metric">
              <span className="metric-label">Max DD</span>
              <span className="metric-value">{template.performanceMetrics.maxDrawdown}%</span>
            </div>
          )}
        </div>
      )}

      <div className="template-card-footer">
        <Space>
          <span className="rating">
            <IconStar style={{ color: 'rgb(var(--warning-6))' }} />
            <span>{template.ratingAvg.toFixed(1)}</span>
            <span className="rating-count">({template.ratingCount})</span>
          </span>
          <span className="use-count">
            <IconUser />
            <span>{template.useCount} uses</span>
          </span>
        </Space>
      </div>

      {template.tags && template.tags.length > 0 && (
        <div className="template-card-tags">
          {template.tags.slice(0, 4).map((tag) => (
            <Tag key={tag} size="small" bordered={false}>
              {tag}
            </Tag>
          ))}
        </div>
      )}
    </Card>
  );
};

/**
 * Template Detail Modal component
 */
const TemplateDetailModal: React.FC<TemplateDetailModalProps> = ({
  template,
  visible,
  onClose,
  onUse,
  onRate,
  userRating,
}) => {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [ratings, setRatings] = useState<TemplateRating[]>([]);
  const [loadingRatings, setLoadingRatings] = useState(false);

  useEffect(() => {
    if (template && visible) {
      fetchRatings();
      setRating(userRating?.rating || 0);
      setComment(userRating?.comment || '');
    }
  }, [template, visible, userRating]);

  const fetchRatings = async () => {
    if (!template) return;
    setLoadingRatings(true);
    try {
      const response = await fetch(`/api/templates/\${template.id}/ratings?limit=10`);
      const data = await response.json();
      if (data.success) {
        setRatings(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch ratings:', error);
    } finally {
      setLoadingRatings(false);
    }
  };

  const handleRate = () => {
    if (rating > 0 && template) {
      onRate(template.id, rating, comment || undefined);
    }
  };

  if (!template) return null;

  return (
    <Modal
      title={template.name}
      visible={visible}
      onCancel={onClose}
      footer={
        <Space>
          <Button onClick={onClose}>Close</Button>
          <Button type="primary" icon={<IconCopy />} onClick={() => onUse(template)}>
            Use Template
          </Button>
        </Space>
      }
      style={{ width: '800px', maxWidth: '90vw' }}
    >
      <div className="template-detail">
        <div className="template-detail-header">
          <Space>
            <Tag color="blue">{template.category.replace('_', ' ')}</Tag>
            <Tag>{template.strategyType.toUpperCase()}</Tag>
            <Tag>{template.symbol}</Tag>
          </Space>
          {template.isBuiltin && (
            <Badge count="Official AlphaArena Template" style={{ backgroundColor: 'rgb(var(--success-6))' }} />
          )}
        </div>

        <div className="template-detail-description">
          {template.description || 'No description available'}
        </div>

        {template.performanceMetrics && (
          <Card title="Performance Metrics" className="performance-card">
            <div className="performance-metrics">
              {template.performanceMetrics.winRate && (
                <div className="metric-item">
                  <div className="metric-value">{template.performanceMetrics.winRate}%</div>
                  <div className="metric-label">Win Rate</div>
                </div>
              )}
              {template.performanceMetrics.avgReturn && (
                <div className="metric-item">
                  <div className="metric-value">{template.performanceMetrics.avgReturn}%</div>
                  <div className="metric-label">Avg Return</div>
                </div>
              )}
              {template.performanceMetrics.sharpeRatio && (
                <div className="metric-item">
                  <div className="metric-value">{template.performanceMetrics.sharpeRatio}</div>
                  <div className="metric-label">Sharpe Ratio</div>
                </div>
              )}
              {template.performanceMetrics.maxDrawdown && (
                <div className="metric-item">
                  <div className="metric-value">{template.performanceMetrics.maxDrawdown}%</div>
                  <div className="metric-label">Max Drawdown</div>
                </div>
              )}
            </div>
            {template.backtestPeriod && (
              <div className="backtest-period">Backtest Period: {template.backtestPeriod}</div>
            )}
          </Card>
        )}

        <Card title="Strategy Configuration" className="config-card">
          <pre className="config-preview">{JSON.stringify(template.config, null, 2)}</pre>
        </Card>

        {template.riskParams && Object.keys(template.riskParams).length > 0 && (
          <Card title="Risk Parameters" className="risk-card">
            <pre className="config-preview">{JSON.stringify(template.riskParams, null, 2)}</pre>
          </Card>
        )}

        {template.tags && template.tags.length > 0 && (
          <div className="template-tags-section">
            <h4>
              <IconTags /> Tags
            </h4>
            <div className="tags-list">
              {template.tags.map((tag) => (
                <Tag key={tag}>{tag}</Tag>
              ))}
            </div>
          </div>
        )}

        <Divider />

        <div className="template-rating-section">
          <h4>
            <IconStar /> Rate this Template
          </h4>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Rate value={rating} onChange={setRating} />
            <Input.TextArea
              placeholder="Write a comment (optional)"
              value={comment}
              onChange={setComment}
              rows={3}
            />
            <Button type="primary" onClick={handleRate} disabled={rating === 0}>
              Submit Rating
            </Button>
          </Space>
        </div>

        <Divider />

        <div className="template-ratings-list">
          <h4>Recent Reviews ({ratings.length})</h4>
          {loadingRatings ? (
            <Spin />
          ) : ratings.length > 0 ? (
            <div className="ratings-list">
              {ratings.map((r) => (
                <div key={r.id} className="rating-item">
                  <div className="rating-header">
                    <span className="rating-user">User {r.userId.slice(0, 8)}</span>
                    <Rate value={r.rating} readonly />
                  </div>
                  {r.comment && <div className="rating-comment">{r.comment}</div>}
                  <div className="rating-date">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty description="No reviews yet" />
          )}
        </div>
      </div>
    </Modal>
  );
};

/**
 * Main Strategy Marketplace Page
 */
const StrategyMarketplacePage: React.FC = () => {
  const [templates, setTemplates] = useState<StrategyTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<StrategyTemplate | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [userRating, setUserRating] = useState<TemplateRating | null>(null);
  const [userId] = useState(`user_\${Date.now()}`); // In real app, get from auth

  // Fetch templates
  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (selectedCategory) params.append('category', selectedCategory);
      if (selectedType) params.append('strategyType', selectedType);
      if (selectedTags.length > 0) params.append('tags', selectedTags.join(','));
      params.append('sortBy', sortBy);
      params.append('limit', '50');

      const response = await fetch(`/api/templates?\${params}`);
      const data = await response.json();

      if (data.success) {
        setTemplates(data.data);
      }
    } catch (error) {
      Message.error('Failed to load templates');
      console.error('Failed to fetch templates:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch categories and tags
  const fetchFilters = async () => {
    try {
      const [categoriesRes, tagsRes] = await Promise.all([
        fetch('/api/templates/categories'),
        fetch('/api/templates/tags'),
      ]);

      const categoriesData = await categoriesRes.json();
      const tagsData = await tagsRes.json();

      if (categoriesData.success) setCategories(categoriesData.data);
      if (tagsData.success) setTags(tagsData.data);
    } catch (error) {
      console.error('Failed to fetch filters:', error);
    }
  };

  useEffect(() => {
    fetchFilters();
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [searchQuery, selectedCategory, selectedType, selectedTags, sortBy]);

  // Handle template selection
  const handleTemplateClick = async (template: StrategyTemplate) => {
    setSelectedTemplate(template);
    setDetailVisible(true);
    // Fetch user's rating for this template
    try {
      const response = await fetch(`/api/templates/\${template.id}?userId=\${userId}`);
      const data = await response.json();
      if (data.success && data.userRating) {
        setUserRating(data.userRating);
      } else {
        setUserRating(null);
      }
    } catch (error) {
      console.error('Failed to fetch user rating:', error);
    }
  };

  // Handle use template
  const handleUseTemplate = async (template: StrategyTemplate) => {
    try {
      const response = await fetch(`/api/templates/\${template.id}/use`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          strategyName: `\${template.name} (Copy)`,
        }),
      });

      const data = await response.json();

      if (data.success) {
        Message.success('Strategy created successfully!');
        setDetailVisible(false);
        // In real app, navigate to strategy page
      } else {
        Message.error(data.error || 'Failed to create strategy');
      }
    } catch (error) {
      Message.error('Failed to create strategy');
      console.error('Failed to use template:', error);
    }
  };

  // Handle rate template
  const handleRateTemplate = async (templateId: string, rating: number, comment?: string) => {
    try {
      const response = await fetch(`/api/templates/\${templateId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          rating,
          comment,
        }),
      });

      const data = await response.json();

      if (data.success) {
        Message.success('Rating submitted successfully!');
        setUserRating(data.data);
        // Refresh templates to update rating
        fetchTemplates();
      } else {
        Message.error(data.error || 'Failed to submit rating');
      }
    } catch (error) {
      Message.error('Failed to submit rating');
      console.error('Failed to rate template:', error);
    }
  };

  // Featured templates
  const featuredTemplates = templates.filter((t) => t.isFeatured);
  const builtinTemplates = templates.filter((t) => t.isBuiltin);

  return (
    <div className="strategy-marketplace-page">
      <div className="page-header">
        <h1>
          <IconFire /> Strategy Template Marketplace
        </h1>
        <p>Discover and use proven trading strategy templates from the community</p>
      </div>

      <div className="filters-section">
        <Search
          placeholder="Search templates..."
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
          <Option value="rating">Top Rated</Option>
          <Option value="use_count">Most Popular</Option>
          <Option value="name">Name</Option>
        </Select>
      </div>

      {selectedTags.length > 0 && (
        <div className="selected-tags">
          {selectedTags.map((tag) => (
            <Tag
              key={tag}
              closable
              onClose={() => setSelectedTags(selectedTags.filter((t) => t !== tag))}
            >
              {tag}
            </Tag>
          ))}
        </div>
      )}

      <Tabs defaultActiveTab="all">
        <TabPane key="all" tab="All Templates">
          {loading ? (
            <div className="loading-container">
              <Spin size={40} />
            </div>
          ) : templates.length > 0 ? (
            <div className="templates-grid">
              {templates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onClick={() => handleTemplateClick(template)}
                  onUse={() => handleUseTemplate(template)}
                />
              ))}
            </div>
          ) : (
            <Empty description="No templates found" />
          )}
        </TabPane>

        <TabPane
          key="featured"
          tab={
            <span>
              <IconThumbUp /> Featured
            </span>
          }
        >
          <div className="templates-grid">
            {featuredTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onClick={() => handleTemplateClick(template)}
                onUse={() => handleUseTemplate(template)}
              />
            ))}
          </div>
        </TabPane>

        <TabPane
          key="official"
          tab={
            <span>
              <IconStar /> Official
            </span>
          }
        >
          <div className="templates-grid">
            {builtinTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onClick={() => handleTemplateClick(template)}
                onUse={() => handleUseTemplate(template)}
              />
            ))}
          </div>
        </TabPane>
      </Tabs>

      {tags.length > 0 && (
        <Card title="Popular Tags" className="tags-card">
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

      <TemplateDetailModal
        template={selectedTemplate}
        visible={detailVisible}
        onClose={() => {
          setDetailVisible(false);
          setSelectedTemplate(null);
          setUserRating(null);
        }}
        onUse={handleUseTemplate}
        onRate={handleRateTemplate}
        userRating={userRating}
      />
    </div>
  );
};

export default StrategyMarketplacePage;
