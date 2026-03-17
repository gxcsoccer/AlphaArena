/**
 * Sentiment Page
 * 
 * Full-page market sentiment dashboard with navigation integration.
 */

import React from 'react';
import { Typography, Grid } from '@arco-design/web-react';
const { Row, Col } = Grid;
const { Title, Text } = Typography;

import SentimentDashboard from '../components/SentimentDashboard';
import { ErrorBoundary } from '../components/ErrorBoundary';

const SentimentPage: React.FC = () => {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <ErrorBoundary>
      <div style={{ padding: isMobile ? 12 : 24 }}>
        <div style={{ marginBottom: isMobile ? 16 : 24 }}>
          <Title heading={3} style={{ marginBottom: 8 }}>
            市场情绪仪表板
          </Title>
          <Text type="secondary">
            实时分析市场恐惧与贪婪情绪，辅助交易决策
          </Text>
        </div>
        <SentimentDashboard refreshInterval={10000} historyDays={30} compact={false} />
      </div>
    </ErrorBoundary>
  );
};

export default SentimentPage;
