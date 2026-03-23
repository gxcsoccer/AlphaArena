/**
 * Landing Page - Redesigned
 * Marketing landing page for non-authenticated users
 * Features: Hero section, value proposition, features, social proof, CTA
 * 
 * Issue #570: Landing Page 改版 - 提升转化率和品牌形象
 * - Redesigned Hero with animated gradient and geometric shapes
 * - Product screenshot/mockup showcase
 * - Trust badges and social proof
 * - Enhanced visual hierarchy
 * - Mobile-optimized experience
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Typography, 
  Button, 
  Space, 
  Card, 
  Grid,
  Divider,
  Tag,
  Message,
  Tooltip,
  Avatar,
} from '@arco-design/web-react';
import {
  IconTrophy,
  IconRobot,
  IconDashboard,
  IconThunderbolt,
  IconCheck,
  IconUser,
  IconStar,
  IconArrowRight,
  IconShareAlt,
  IconLink,
  IconSafe,
  IconHeart,
  IconList,
  IconBulb,
  IconFire,
} from '@arco-design/web-react/icon';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSEO, PAGE_SEO_CONFIGS } from '../hooks/useSEO';
import './LandingPage.css';

const { Title, Text, Paragraph } = Typography;
const { Row, Col } = Grid;

// ============================================
// Features Data
// ============================================
const features = [
  {
    icon: <IconRobot />,
    title: 'AI 驱动策略',
    description: '利用先进的 AI 算法，自动分析市场趋势，生成交易信号和策略建议。',
    highlights: ['智能市场分析', '策略优化建议', '风险管理指导'],
    color: 'var(--color-primary)',
    gradient: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
  },
  {
    icon: <IconDashboard />,
    title: '模拟交易',
    description: '在真实市场环境中练习交易，无需承担真实资金风险。实时行情，零风险学习。',
    highlights: ['真实市场数据', '无风险练习', '完整交易体验'],
    color: 'var(--color-success)',
    gradient: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
  },
  {
    icon: <IconTrophy />,
    title: '竞技排名',
    description: '与其他交易者同台竞技，展示您的交易技巧，攀登排行榜获得荣誉。',
    highlights: ['实时排行榜', '策略竞赛', '社区互动'],
    color: 'var(--color-warning)',
    gradient: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
  },
  {
    icon: <IconThunderbolt />,
    title: '极速执行',
    description: '毫秒级订单执行，支持多种订单类型，满足专业交易者的高要求。',
    highlights: ['毫秒级执行', '高级订单类型', '实时订单簿'],
    color: 'var(--color-secondary-500)',
    gradient: 'linear-gradient(135deg, #A855F7 0%, #9333EA 100%)',
  },
];

// ============================================
// Testimonials Data
// ============================================
const testimonials = [
  {
    name: '张明',
    role: '量化交易爱好者',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=zhangming',
    content: 'AlphaArena 的模拟交易功能让我在真实投入前充分测试了我的策略，避免了不必要的损失。AI 助手的建议非常有价值。',
    rating: 5,
    stats: '使用 6 个月',
  },
  {
    name: '李华',
    role: '独立交易者',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=lihua',
    content: 'AI 助手的建议非常有帮助，特别是在我需要快速决策时，节省了大量研究时间。收益率提升了 30%。',
    rating: 5,
    stats: '收益率 +30%',
  },
  {
    name: '王芳',
    role: '金融专业学生',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=wangfang',
    content: '作为学习工具，AlphaArena 提供了完整的专业交易体验，让我在实践中学习。比教科书有用多了！',
    rating: 5,
    stats: '学习时长 200h+',
  },
];

// ============================================
// Stats Data
// ============================================
const stats = [
  { value: '10,000+', label: '活跃用户', icon: <IconUser /> },
  { value: '$100M+', label: '模拟交易量', icon: <IconDashboard /> },
  { value: '99.9%', label: '系统可用性', icon: <IconSafe /> },
  { value: '24/7', label: '实时监控', icon: <IconHeart /> },
];

// ============================================
// Trust Badges
// ============================================
const trustBadges = [
  { label: '银行级安全', icon: <IconSafe /> },
  { label: '10K+ 用户信赖', icon: <IconUser /> },
  { label: '免费使用', icon: <IconStar /> },
];

// ============================================
// Social Platforms
// ============================================
const socialPlatforms = [
  {
    name: '微信',
    icon: '💬',
    color: '#07C160',
    generateUrl: () => null,
  },
  {
    name: 'Twitter',
    icon: '🐦',
    color: '#1DA1F2',
    generateUrl: (url: string, text: string) => {
      return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}&hashtags=AlphaArena,量化交易,AI交易`;
    },
  },
  {
    name: 'Facebook',
    icon: '📘',
    color: '#4267B2',
    generateUrl: (url: string, text: string) => {
      return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`;
    },
  },
];

// ============================================
// Generate UTM Parameters
// ============================================
function generateUTMParams(medium: string = 'social', source: string = 'share'): string {
  const utmParams = new URLSearchParams({
    utm_source: source,
    utm_medium: medium,
    utm_campaign: 'landing_page_share',
    utm_content: 'share_button',
    utm_term: 'organic',
  });
  return utmParams.toString();
}

// ============================================
// Landing Page Component
// ============================================
const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, isLoading } = useAuth();
  const [isMobile, setIsMobile] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [animateStats, setAnimateStats] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);

  // SEO: Update meta tags for landing page
  useSEO(PAGE_SEO_CONFIGS.landing);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  // Animate stats on scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setAnimateStats(true);
          }
        });
      },
      { threshold: 0.3 }
    );

    if (statsRef.current) {
      observer.observe(statsRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Generate share URL with UTM parameters
  const getShareUrl = useCallback((source: string = 'direct') => {
    const baseUrl = window.location.origin;
    const utmParams = generateUTMParams('social', source);
    return `${baseUrl}?${utmParams}`;
  }, []);

  // Copy link to clipboard
  const copyLinkToClipboard = useCallback(async () => {
    const url = getShareUrl('copy_link');
    try {
      await navigator.clipboard.writeText(url);
      Message.success('链接已复制到剪贴板');
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      Message.success('链接已复制到剪贴板');
    }
  }, [getShareUrl]);

  // Share to social platform
  const shareToPlatform = useCallback((platform: typeof socialPlatforms[0]) => {
    const url = getShareUrl(platform.name.toLowerCase());
    const text = 'AlphaArena - 专业级算法交易平台，AI 驱动的智能策略，无风险模拟交易环境。免费注册，即刻开始您的量化交易之旅！';
    
    const shareUrl = platform.generateUrl(url, text);
    
    if (shareUrl) {
      window.open(shareUrl, '_blank', 'width=600,height=400');
    } else {
      copyLinkToClipboard();
    }
  }, [getShareUrl, copyLinkToClipboard]);

  // Handle native share
  const handleNativeShare = useCallback(async () => {
    const url = getShareUrl('native_share');
    const shareData = {
      title: 'AlphaArena - 算法交易平台',
      text: '专业级算法交易平台，AI 驱动的智能策略，无风险模拟交易环境。免费注册，即刻开始！',
      url,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('[Share] Native share error:', err);
        }
      }
    } else {
      setShowShareMenu(!showShareMenu);
    }
  }, [getShareUrl, showShareMenu]);

  // Register with referral tracking
  const handleRegister = useCallback(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      navigate(`/register?ref=${ref}`);
    } else {
      navigate('/register');
    }
  }, [navigate, searchParams]);

  if (isLoading) {
    return null;
  }

  return (
    <div className="landing-page">
      {/* ============================================ */}
      {/* Hero Section */}
      {/* ============================================ */}
      <section className="hero-section">
        {/* Animated background */}
        <div className="hero-bg">
          <div className="hero-gradient" />
          <div className="hero-shapes">
            <div className="shape shape-1" />
            <div className="shape shape-2" />
            <div className="shape shape-3" />
            <div className="shape shape-4" />
          </div>
          <div className="hero-grid" />
        </div>

        <div className="hero-content">
          {/* Trust Badges */}
          <div className="trust-badges">
            {trustBadges.map((badge, index) => (
              <div key={index} className="trust-badge">
                {badge.icon}
                <span>{badge.label}</span>
              </div>
            ))}
          </div>

          {/* Main Headline */}
          <h1 className="hero-title">
            专业级算法交易
            <span className="hero-title-highlight">AI 驱动 · 无风险</span>
          </h1>

          <p className="hero-subtitle">
            在真实市场环境中练习算法交易策略，利用 AI 助手优化决策，
            与全球交易者竞技排名，无需承担任何真实资金风险。
          </p>

          {/* CTA Buttons */}
          <div className="hero-cta">
            <Button
              type="primary"
              size="large"
              className="cta-primary"
              onClick={handleRegister}
            >
              <IconUser />
              免费注册
            </Button>
            <Button
              size="large"
              className="cta-secondary"
              onClick={handleNativeShare}
            >
              <IconShareAlt />
              分享给朋友
            </Button>
          </div>

          {/* Social Share Menu */}
          {showShareMenu && (
            <Card className="share-menu">
              <Space size="medium">
                {socialPlatforms.map((platform) => (
                  <Tooltip key={platform.name} content={platform.name}>
                    <Button
                      shape="circle"
                      size="large"
                      onClick={() => shareToPlatform(platform)}
                      className="share-button"
                      style={{ background: platform.color }}
                    >
                      {platform.icon}
                    </Button>
                  </Tooltip>
                ))}
                <Tooltip content="复制链接">
                  <Button
                    shape="circle"
                    size="large"
                    onClick={copyLinkToClipboard}
                    className="share-button"
                  >
                    <IconLink />
                  </Button>
                </Tooltip>
              </Space>
              <Text type="secondary" className="share-hint">
                分享给朋友，一起开始量化交易之旅！
              </Text>
            </Card>
          )}

          {/* Product Screenshot */}
          <div className="hero-screenshot">
            <div className="screenshot-wrapper">
              <div className="screenshot-header">
                <div className="screenshot-dots">
                  <span className="dot red" />
                  <span className="dot yellow" />
                  <span className="dot green" />
                </div>
                <Text className="screenshot-title">AlphaArena Dashboard</Text>
              </div>
              <div className="screenshot-content">
                <div className="mock-chart">
                  <div className="chart-line chart-line-up" />
                  <div className="chart-line chart-line-down" />
                  <div className="chart-line chart-line-up" />
                </div>
                <div className="mock-stats">
                  <div className="mock-stat">
                    <span className="stat-label">收益率</span>
                    <span className="stat-value positive">+12.5%</span>
                  </div>
                  <div className="mock-stat">
                    <span className="stat-label">策略数</span>
                    <span className="stat-value">8</span>
                  </div>
                  <div className="mock-stat">
                    <span className="stat-label">胜率</span>
                    <span className="stat-value positive">68%</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="screenshot-glow" />
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* Stats Section */}
      {/* ============================================ */}
      <section ref={statsRef} className="stats-section">
        <div className="stats-container">
          {stats.map((stat, index) => (
            <div 
              key={index} 
              className={`stat-item ${animateStats ? 'animate' : ''}`}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="stat-icon">{stat.icon}</div>
              <div className="stat-value">{stat.value}</div>
              <div className="stat-label">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ============================================ */}
      {/* Features Section */}
      {/* ============================================ */}
      <section className="features-section">
        <div className="section-header">
          <h2 className="section-title">
            <IconBulb className="section-icon" />
            核心功能
          </h2>
          <p className="section-subtitle">
            专业工具，助力您的量化交易之旅
          </p>
        </div>

        <Row gutter={[24, 24]} justify="center" className="features-grid">
          {features.map((feature, index) => (
            <Col key={index} xs={24} sm={12} lg={6}>
              <Card 
                className="feature-card"
                hoverable
              >
                <div 
                  className="feature-icon-wrapper"
                  style={{ background: feature.gradient }}
                >
                  {feature.icon}
                </div>
                <Title heading={5} className="feature-title">{feature.title}</Title>
                <Paragraph className="feature-description">
                  {feature.description}
                </Paragraph>
                <div className="feature-highlights">
                  {feature.highlights.map((h, i) => (
                    <div key={i} className="highlight-item">
                      <IconCheck className="highlight-icon" />
                      <Text>{h}</Text>
                    </div>
                  ))}
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </section>

      {/* ============================================ */}
      {/* How It Works Section */}
      {/* ============================================ */}
      <section className="how-it-works-section">
        <div className="section-header">
          <h2 className="section-title">
            <IconFire className="section-icon" />
            开始使用
          </h2>
          <p className="section-subtitle">
            四步开启您的量化交易之旅
          </p>
        </div>

        <div className="steps-container">
          {[
            { step: 1, title: '注册账户', desc: '免费创建账户，即刻开始', icon: <IconUser /> },
            { step: 2, title: '选择策略', desc: '内置多种策略模板，或自定义', icon: <IconDashboard /> },
            { step: 3, title: '模拟交易', desc: '在真实环境中测试您的策略', icon: <IconList /> },
            { step: 4, title: '优化改进', desc: '利用 AI 助手优化策略表现', icon: <IconRobot /> },
          ].map((item, index) => (
            <div key={item.step} className="step-item" style={{ animationDelay: `${index * 0.15}s` }}>
              <div className="step-number">{item.step}</div>
              <div className="step-icon">{item.icon}</div>
              <Title heading={6} className="step-title">{item.title}</Title>
              <Text type="secondary" className="step-desc">{item.desc}</Text>
              {index < 3 && <div className="step-connector" />}
            </div>
          ))}
        </div>
      </section>

      {/* ============================================ */}
      {/* Testimonials Section */}
      {/* ============================================ */}
      <section className="testimonials-section">
        <div className="section-header">
          <h2 className="section-title">
            <IconStar className="section-icon" />
            用户评价
          </h2>
          <p className="section-subtitle">
            来自真实用户的反馈
          </p>
        </div>

        <Row gutter={[24, 24]} justify="center" className="testimonials-grid">
          {testimonials.map((testimonial, index) => (
            <Col key={index} xs={24} sm={8}>
              <Card className="testimonial-card">
                <div className="testimonial-header">
                  <Avatar size={48} className="testimonial-avatar">
                    <img src={testimonial.avatar} alt={testimonial.name} />
                  </Avatar>
                  <div className="testimonial-info">
                    <Text strong className="testimonial-name">{testimonial.name}</Text>
                    <Text type="secondary" className="testimonial-role">{testimonial.role}</Text>
                  </div>
                </div>
                <div className="testimonial-rating">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <IconStar key={i} className="star-icon" />
                  ))}
                </div>
                <Paragraph className="testimonial-content">
                  "{testimonial.content}"
                </Paragraph>
                <div className="testimonial-stats">
                  <Tag className="stats-tag">{testimonial.stats}</Tag>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </section>

      {/* ============================================ */}
      {/* CTA Section */}
      {/* ============================================ */}
      <section className="cta-section">
        <div className="cta-bg">
          <div className="cta-gradient" />
        </div>
        <div className="cta-content">
          <h2 className="cta-title">
            准备好开始您的算法交易之旅了吗？
          </h2>
          <p className="cta-subtitle">
            立即注册，免费体验专业级算法交易平台，无任何门槛。
          </p>
          <Button
            type="primary"
            size="large"
            className="cta-button"
            onClick={handleRegister}
          >
            立即开始
            <IconArrowRight />
          </Button>
          <Text className="cta-hint">
            无需信用卡 · 免费使用核心功能 · 随时升级
          </Text>
        </div>
      </section>

      {/* ============================================ */}
      {/* Footer */}
      {/* ============================================ */}
      <footer className="landing-footer">
        <Row gutter={[24, 24]} justify="center">
          <Col xs={24} sm={8} className="footer-brand">
            <Title heading={5}>AlphaArena</Title>
            <Paragraph className="footer-description">
              专业级算法交易平台
              <br />
              AI 驱动 · 无风险模拟交易
            </Paragraph>
          </Col>
          <Col xs={12} sm={4} className="footer-links">
            <Text strong>产品</Text>
            <div className="footer-link-list">
              <a href="/register">注册</a>
              <a href="/login">登录</a>
              <a href="/docs/api">API 文档</a>
            </div>
          </Col>
          <Col xs={12} sm={4} className="footer-links">
            <Text strong>资源</Text>
            <div className="footer-link-list">
              <a href="/leaderboard">排行榜</a>
              <a href="/subscription">订阅方案</a>
            </div>
          </Col>
        </Row>
        <Divider className="footer-divider" />
        <Text type="secondary" className="footer-copyright">
          © {new Date().getFullYear()} AlphaArena. All rights reserved.
        </Text>
      </footer>
    </div>
  );
};

export default LandingPage;