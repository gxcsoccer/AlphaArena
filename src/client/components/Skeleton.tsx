import React from 'react';
import { Skeleton as ArcoSkeleton, Card, Grid } from '@arco-design/web-react';
import './Skeleton.css';

const { Row, Col } = Grid;

interface SkeletonProps {
  type?: 'card' | 'table' | 'list' | 'chart' | 'form';
  rows?: number;
  loading?: boolean;
  children?: React.ReactNode;
}

/**
 * Mobile-optimized skeleton loading components
 */
const Skeleton: React.FC<SkeletonProps> = ({
  type = 'card',
  rows = 3,
  loading = true,
  children,
}) => {
  if (!loading) {
    return <>{children}</>;
  }

  switch (type) {
    case 'card':
      return (
        <Card className="skeleton-card">
          <ArcoSkeleton
            animation
            text={{ rows: 2, width: ['60%', '80%'] }}
          />
        </Card>
      );

    case 'table':
      return (
        <div className="skeleton-table">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="skeleton-table-row">
              <ArcoSkeleton
                animation
                text={{ rows: 1, width: '100%' }}
              />
            </div>
          ))}
        </div>
      );

    case 'list':
      return (
        <div className="skeleton-list">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="skeleton-list-item">
              <ArcoSkeleton
                animation
                avatar={{ shape: 'circle', size: 'small' }}
                text={{ rows: 1, width: '70%' }}
              />
            </div>
          ))}
        </div>
      );

    case 'chart':
      return (
        <Card className="skeleton-chart">
          <ArcoSkeleton animation graphic={{ rows: 4, columns: 8 }} />
        </Card>
      );

    case 'form':
      return (
        <div className="skeleton-form">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="skeleton-form-item">
              <ArcoSkeleton
                animation
                text={{ rows: 2, width: ['30%', '100%'] }}
              />
            </div>
          ))}
        </div>
      );

    default:
      return null;
  }
};

/**
 * Dashboard skeleton for mobile
 */
export const DashboardSkeleton: React.FC<{ isMobile?: boolean }> = ({ isMobile = false }) => {
  const colSpan = isMobile ? 12 : 6;

  return (
    <div className="skeleton-dashboard">
      <Row gutter={[12, 12]}>
        {Array.from({ length: isMobile ? 2 : 4 }).map((_, i) => (
          <Col key={i} span={colSpan}>
            <Skeleton type="card" />
          </Col>
        ))}
      </Row>
      <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
        <Col span={24}>
          <Skeleton type="table" rows={5} />
        </Col>
      </Row>
    </div>
  );
};

/**
 * Trading page skeleton for mobile
 */
export const TradingSkeleton: React.FC<{ isMobile?: boolean }> = ({ isMobile = false }) => {
  return (
    <div className="skeleton-trading">
      <Skeleton type="card" />
      <div style={{ marginTop: 12 }}>
        <Skeleton type="chart" />
      </div>
    </div>
  );
};

export default Skeleton;
