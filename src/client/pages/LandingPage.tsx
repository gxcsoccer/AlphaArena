/**
 * Landing Page
 * Marketing landing page for non-authenticated users
 * Features: Hero section, value proposition, features, social proof, CTA
 */

import React, { useState, useEffect } from 'react';
import { 
  Typography, 
  Button, 
  Space, 
  Card, 
  Grid,
  Divider,
  Tag,
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
} from '@arco-design/web-react/icon';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const { Title, Text, Paragraph } = Typography;
const { Row, Col } = Grid;

// Features data
const features = [
  {
    icon: <IconRobot style={{ fontSize: 32, color: '#165dff' }} />,
    title: 'AI 驱动策略',
    description: '利用先进的 AI 算法，自动分析市场趋势，生成交易信号和策略建议。',
    highlights: ['智能市场分析', '策略优化建议', '风险管理指导'],
  },
  {
    icon: <IconDashboard style={{ fontSize: 32, color: '#00b42a' }} />,
    title: '模拟交易',
    description: '在真实市场环境中练习交易，无需承担真实资金风险。实时行情，零风险学习。',
    highlights: ['真实市场数据', '无风险练习', '完整交易体验'],
  },
  {
    icon: <IconTrophy style={{ fontSize: 32, color: '#ff7d00' }} />,
    title: '竞技排名',
    description: '与其他交易者同台竞技，展示您的交易技巧，攀登排行榜获得荣誉。',
    highlights: ['实时排行榜', '策略竞赛', '社区互动'],
  },
  {
    icon: <IconThunderbolt style={{ fontSize: 32, color: '#722ed1' }} />,
    title: '极速执行',
    description: '毫秒级订单执行，支持多种订单类型，满足专业交易者的高要求。',
    highlights: ['毫秒级执行', '高级订单类型', '实时订单簿'],
  },
];

// Testimonials data
const testimonials = [
  {
    name: '张明',
    role: '量化交易爱好者',
    content: 'AlphaArena 的模拟交易功能让我在真实投入前充分测试了我的策略，避免了不必要的损失。',
    rating: 5,
  },
  {
    name: '李华',
    role: '独立交易者',
    content: 'AI 助手的建议非常有帮助，特别是在我需要快速决策时，节省了大量研究时间。',
    rating: 5,
  },
  {
    name: '王芳',
    role: '金融专业学生',
    content: '作为学习工具，AlphaArena 提供了完整的专业交易体验，让我在实践中学习。',
    rating: 5,
  },
];

// Stats data
const stats = [
  { value: '10K+', label: '活跃用户' },
  { value: '100M+', label: '模拟交易量' },
  { value: '99.9%', label: '系统可用性' },
  { value: '24/7', label: '实时监控' },
];

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();
  const [isMobile, setIsMobile] = useState(false);

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

  // Handle share
  const handleShare = async () => {
    const shareData = {
      title: 'AlphaArena - 算法交易平台',
      text: '免费体验专业级算法交易，AI 驱动的智能策略，无风险的模拟交易环境。',
      url: window.location.origin,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // User cancelled or error - fallback to clipboard
        navigator.clipboard.writeText(window.location.origin);
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.origin);
    }
  };

  if (isLoading) {
    return null;
  }

  return (
    <div style={styles.container}>
      {/* Hero Section */}
      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <Space direction="vertical" size="large" align="center">
            <Tag color="blue" size="large">
              <IconStar /> 免费开始交易
            </Tag>
            <Title 
              heading={isMobile ? 3 : 1} 
              style={{ textAlign: 'center', marginBottom: 0 }}
            >
              专业级算法交易
              <br />
              <span style={{ color: '#165dff' }}>AI 驱动 · 无风险</span>
            </Title>
            <Paragraph 
              style={{ 
                textAlign: 'center', 
                fontSize: isMobile ? 14 : 18,
                maxWidth: 600,
                color: 'var(--color-text-2)',
              }}
            >
              在真实市场环境中练习算法交易策略，利用 AI 助手优化决策，
              与全球交易者竞技排名，无需承担任何真实资金风险。
            </Paragraph>
            <Space size="large" wrap>
              <Button
                type="primary"
                size="large"
                icon={<IconUser />}
                onClick={() => navigate('/register')}
                style={{ minWidth: 140 }}
              >
                免费注册
              </Button>
              <Button
                size="large"
                icon={<IconShareAlt />}
                onClick={handleShare}
                style={{ minWidth: 140 }}
              >
                分享给朋友
              </Button>
            </Space>
          </Space>

          {/* Stats */}
          <Row 
            justify="center" 
            style={{ ...styles.statsRow, marginTop: isMobile ? 32 : 48 }}
            gutter={isMobile ? [16, 16] : [48, 0]}
          >
            {stats.map((stat, index) => (
              <Col key={index} style={{ textAlign: 'center' }}>
                <Title heading={isMobile ? 5 : 4} style={{ marginBottom: 4, color: '#165dff' }}>
                  {stat.value}
                </Title>
                <Text type="secondary">{stat.label}</Text>
              </Col>
            ))}
          </Row>
        </div>
      </section>

      {/* Features Section */}
      <section style={styles.section}>
        <Title heading={3} style={{ textAlign: 'center', marginBottom: 48 }}>
          核心功能
        </Title>
        <Row 
          gutter={[24, 24]} 
          justify="center"
        >
          {features.map((feature, index) => (
            <Col 
              key={index} 
              xs={24} 
              sm={12} 
              md={6}
            >
              <Card 
                hoverable 
                style={{ height: '100%', textAlign: 'center' }}
                bodyStyle={{ padding: 24 }}
              >
                <div style={{ marginBottom: 16 }}>{feature.icon}</div>
                <Title heading={5}>{feature.title}</Title>
                <Paragraph style={{ color: 'var(--color-text-2)', marginBottom: 16 }}>
                  {feature.description}
                </Paragraph>
                <div style={{ textAlign: 'left' }}>
                  {feature.highlights.map((h, i) => (
                    <div key={i} style={{ marginBottom: 4 }}>
                      <IconCheck style={{ color: '#00b42a', marginRight: 8 }} />
                      <Text type="secondary">{h}</Text>
                    </div>
                  ))}
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </section>

      {/* How It Works */}
      <section style={{ ...styles.section, background: 'var(--color-fill-1)' }}>
        <Title heading={3} style={{ textAlign: 'center', marginBottom: 48 }}>
          开始使用
        </Title>
        <Row gutter={[48, 24]} justify="center" style={{ maxWidth: 900, margin: '0 auto' }}>
          {[
            { step: 1, title: '注册账户', desc: '免费创建账户，即刻开始' },
            { step: 2, title: '选择策略', desc: '内置多种策略模板，或自定义' },
            { step: 3, title: '模拟交易', desc: '在真实环境中测试您的策略' },
            { step: 4, title: '优化改进', desc: '利用 AI 助手优化策略表现' },
          ].map((item) => (
            <Col key={item.step} xs={12} sm={6} style={{ textAlign: 'center' }}>
              <div 
                style={{ 
                  width: 48, 
                  height: 48, 
                  borderRadius: '50%', 
                  background: '#165dff',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                  fontSize: 20,
                  fontWeight: 'bold',
                }}
              >
                {item.step}
              </div>
              <Title heading={6}>{item.title}</Title>
              <Text type="secondary">{item.desc}</Text>
            </Col>
          ))}
        </Row>
      </section>

      {/* Testimonials */}
      <section style={styles.section}>
        <Title heading={3} style={{ textAlign: 'center', marginBottom: 48 }}>
          用户评价
        </Title>
        <Row gutter={[24, 24]} justify="center">
          {testimonials.map((testimonial, index) => (
            <Col key={index} xs={24} sm={8}>
              <Card style={{ height: '100%' }}>
                <div style={{ marginBottom: 12 }}>
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <IconStar key={i} style={{ color: '#ff7d00', fontSize: 16 }} />
                  ))}
                </div>
                <Paragraph style={{ marginBottom: 16, fontStyle: 'italic' }}>
                  "{testimonial.content}"
                </Paragraph>
                <Divider style={{ margin: '12px 0' }} />
                <div>
                  <Text strong>{testimonial.name}</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {testimonial.role}
                  </Text>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </section>

      {/* CTA Section */}
      <section style={styles.ctaSection}>
        <Space direction="vertical" size="large" align="center">
          <Title heading={3} style={{ color: 'white', textAlign: 'center' }}>
            准备好开始您的算法交易之旅了吗？
          </Title>
          <Paragraph style={{ color: 'rgba(255,255,255,0.8)', textAlign: 'center', maxWidth: 500 }}>
            立即注册，免费体验专业级算法交易平台，无任何门槛。
          </Paragraph>
          <Button
            type="primary"
            size="large"
            icon={<IconArrowRight />}
            onClick={() => navigate('/register')}
            style={{ 
              background: 'white', 
              color: '#165dff',
              minWidth: 180,
            }}
          >
            立即开始
          </Button>
        </Space>
      </section>

      {/* Footer */}
      <footer style={styles.footer}>
        <Row gutter={[24, 24]} justify="center">
          <Col xs={24} sm={8} style={{ textAlign: isMobile ? 'center' : 'left' }}>
            <Title heading={5}>AlphaArena</Title>
            <Paragraph style={{ color: 'var(--color-text-2)', fontSize: 12 }}>
              专业级算法交易平台
              <br />
              AI 驱动 · 无风险模拟交易
            </Paragraph>
          </Col>
          <Col xs={12} sm={4}>
            <Text strong>产品</Text>
            <div style={{ marginTop: 8 }}>
              <div><a href="/register" style={styles.footerLink}>注册</a></div>
              <div><a href="/login" style={styles.footerLink}>登录</a></div>
              <div><a href="/docs/api" style={styles.footerLink}>API 文档</a></div>
            </div>
          </Col>
          <Col xs={12} sm={4}>
            <Text strong>资源</Text>
            <div style={{ marginTop: 8 }}>
              <div><a href="/leaderboard" style={styles.footerLink}>排行榜</a></div>
              <div><a href="/subscription" style={styles.footerLink}>订阅方案</a></div>
            </div>
          </Col>
        </Row>
        <Divider style={{ margin: '24px 0' }} />
        <Text type="secondary" style={{ fontSize: 12, display: 'block', textAlign: 'center' }}>
          © {new Date().getFullYear()} AlphaArena. All rights reserved.
        </Text>
      </footer>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: 'var(--color-bg-1)',
  },
  hero: {
    padding: '80px 24px',
    background: 'linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroContent: {
    maxWidth: 900,
    width: '100%',
  },
  statsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  section: {
    padding: '64px 24px',
    maxWidth: 1200,
    margin: '0 auto',
  },
  ctaSection: {
    padding: '80px 24px',
    background: 'linear-gradient(135deg, #165dff 0%, #722ed1 100%)',
    textAlign: 'center',
  },
  footer: {
    padding: '48px 24px',
    background: 'var(--color-bg-2)',
    borderTop: '1px solid var(--color-border-1)',
  },
  footerLink: {
    color: 'var(--color-text-2)',
    textDecoration: 'none',
    fontSize: 12,
    lineHeight: '24px',
  },
};

export default LandingPage;