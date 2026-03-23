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
 * 
 * Issue #585: 核心页面英文翻译
 * - Added i18n support for all hardcoded Chinese text
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
import { useTranslation } from 'react-i18next';
import './LandingPage.css';

const { Title, Text, Paragraph } = Typography;
const { Row, Col } = Grid;

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
  const { t } = useTranslation('landing');
  const [isMobile, setIsMobile] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [animateStats, setAnimateStats] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);

  // Features data with translations
  const features = [
    {
      icon: <IconRobot />,
      title: t('features.aiStrategy.title'),
      description: t('features.aiStrategy.description'),
      highlights: [
        t('features.aiStrategy.highlights.marketAnalysis'),
        t('features.aiStrategy.highlights.strategyOptimization'),
        t('features.aiStrategy.highlights.riskManagement'),
      ],
      color: 'var(--color-primary)',
      gradient: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
    },
    {
      icon: <IconDashboard />,
      title: t('features.simulation.title'),
      description: t('features.simulation.description'),
      highlights: [
        t('features.simulation.highlights.realData'),
        t('features.simulation.highlights.riskFree'),
        t('features.simulation.highlights.fullExperience'),
      ],
      color: 'var(--color-success)',
      gradient: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
    },
    {
      icon: <IconTrophy />,
      title: t('features.competition.title'),
      description: t('features.competition.description'),
      highlights: [
        t('features.competition.highlights.leaderboard'),
        t('features.competition.highlights.strategyCompetition'),
        t('features.competition.highlights.community'),
      ],
      color: 'var(--color-warning)',
      gradient: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
    },
    {
      icon: <IconThunderbolt />,
      title: t('features.execution.title'),
      description: t('features.execution.description'),
      highlights: [
        t('features.execution.highlights.msExecution'),
        t('features.execution.highlights.advancedOrders'),
        t('features.execution.highlights.orderBook'),
      ],
      color: 'var(--color-secondary-500)',
      gradient: 'linear-gradient(135deg, #A855F7 0%, #9333EA 100%)',
    },
  ];

  // Testimonials data with translations
  const testimonials = [
    {
      name: t('testimonials.items.zhangming.name'),
      role: t('testimonials.items.zhangming.role'),
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=zhangming',
      content: t('testimonials.items.zhangming.content'),
      rating: 5,
      stats: t('testimonials.items.zhangming.stats'),
    },
    {
      name: t('testimonials.items.lihua.name'),
      role: t('testimonials.items.lihua.role'),
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=lihua',
      content: t('testimonials.items.lihua.content'),
      rating: 5,
      stats: t('testimonials.items.lihua.stats'),
    },
    {
      name: t('testimonials.items.wangfang.name'),
      role: t('testimonials.items.wangfang.role'),
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=wangfang',
      content: t('testimonials.items.wangfang.content'),
      rating: 5,
      stats: t('testimonials.items.wangfang.stats'),
    },
  ];

  // Stats data with translations
  const stats = [
    { value: '10,000+', label: t('stats.activeUsers'), icon: <IconUser /> },
    { value: '$100M+', label: t('stats.simulationVolume'), icon: <IconDashboard /> },
    { value: '99.9%', label: t('stats.systemUptime'), icon: <IconSafe /> },
    { value: '24/7', label: t('stats.realTimeMonitoring'), icon: <IconHeart /> },
  ];

  // Trust Badges with translations
  const trustBadges = [
    { label: t('trustBadges.bankSecurity'), icon: <IconSafe /> },
    { label: t('trustBadges.trustedUsers'), icon: <IconUser /> },
    { label: t('trustBadges.freeUse'), icon: <IconStar /> },
  ];

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
      Message.success(t('share.linkCopied'));
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      Message.success(t('share.linkCopied'));
    }
  }, [getShareUrl, t]);

  // Share to social platform
  const shareToPlatform = useCallback((platform: typeof socialPlatforms[0]) => {
    const url = getShareUrl(platform.name.toLowerCase());
    const text = t('share.text');
    
    const shareUrl = platform.generateUrl(url, text);
    
    if (shareUrl) {
      window.open(shareUrl, '_blank', 'width=600,height=400');
    } else {
      copyLinkToClipboard();
    }
  }, [getShareUrl, copyLinkToClipboard, t]);

  // Handle native share
  const handleNativeShare = useCallback(async () => {
    const url = getShareUrl('native_share');
    const shareData = {
      title: t('share.title'),
      text: t('share.text'),
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
  }, [getShareUrl, showShareMenu, t]);

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
            {t('hero.title')}
            <span className="hero-title-highlight">{t('hero.titleHighlight')}</span>
          </h1>

          <p className="hero-subtitle">
            {t('hero.subtitle')}
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
              {t('hero.cta.register')}
            </Button>
            <Button
              size="large"
              className="cta-secondary"
              onClick={handleNativeShare}
            >
              <IconShareAlt />
              {t('hero.cta.share')}
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
                <Tooltip content={t('common.button.copy', { ns: 'common' })}>
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
                {t('hero.shareHint')}
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
                <Text className="screenshot-title">{t('screenshot.title')}</Text>
              </div>
              <div className="screenshot-content">
                <div className="mock-chart">
                  <div className="chart-line chart-line-up" />
                  <div className="chart-line chart-line-down" />
                  <div className="chart-line chart-line-up" />
                </div>
                <div className="mock-stats">
                  <div className="mock-stat">
                    <span className="stat-label">{t('screenshot.stats.returnRate')}</span>
                    <span className="stat-value positive">+12.5%</span>
                  </div>
                  <div className="mock-stat">
                    <span className="stat-label">{t('screenshot.stats.strategies')}</span>
                    <span className="stat-value">8</span>
                  </div>
                  <div className="mock-stat">
                    <span className="stat-label">{t('screenshot.stats.winRate')}</span>
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
            {t('features.sectionTitle')}
          </h2>
          <p className="section-subtitle">
            {t('features.sectionSubtitle')}
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
            {t('howItWorks.sectionTitle')}
          </h2>
          <p className="section-subtitle">
            {t('howItWorks.sectionSubtitle')}
          </p>
        </div>

        <div className="steps-container">
          {[
            { step: 1, title: t('howItWorks.steps.register.title'), desc: t('howItWorks.steps.register.description'), icon: <IconUser /> },
            { step: 2, title: t('howItWorks.steps.selectStrategy.title'), desc: t('howItWorks.steps.selectStrategy.description'), icon: <IconDashboard /> },
            { step: 3, title: t('howItWorks.steps.simulate.title'), desc: t('howItWorks.steps.simulate.description'), icon: <IconList /> },
            { step: 4, title: t('howItWorks.steps.optimize.title'), desc: t('howItWorks.steps.optimize.description'), icon: <IconRobot /> },
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
            {t('testimonials.sectionTitle')}
          </h2>
          <p className="section-subtitle">
            {t('testimonials.sectionSubtitle')}
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
            {t('cta.title')}
          </h2>
          <p className="cta-subtitle">
            {t('cta.subtitle')}
          </p>
          <Button
            type="primary"
            size="large"
            className="cta-button"
            onClick={handleRegister}
          >
            {t('cta.button')}
            <IconArrowRight />
          </Button>
          <Text className="cta-hint">
            {t('cta.hint')}
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
              {t('footer.brandTagline')}
              <br />
              {t('footer.brandSubtagline')}
            </Paragraph>
          </Col>
          <Col xs={12} sm={4} className="footer-links">
            <Text strong>{t('footer.product')}</Text>
            <div className="footer-link-list">
              <a href="/register">{t('footer.links.register')}</a>
              <a href="/login">{t('footer.links.login')}</a>
              <a href="/docs/api">{t('footer.links.apiDocs')}</a>
            </div>
          </Col>
          <Col xs={12} sm={4} className="footer-links">
            <Text strong>{t('footer.resources')}</Text>
            <div className="footer-link-list">
              <a href="/leaderboard">{t('footer.links.leaderboard')}</a>
              <a href="/subscription">{t('footer.links.subscription')}</a>
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