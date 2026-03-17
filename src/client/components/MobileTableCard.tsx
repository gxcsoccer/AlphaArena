import React from 'react';
import { Card, Tag, Space, Typography } from '@arco-design/web-react';
import './MobileTableCard.css';

const { Text } = Typography;

interface MobileTableCardProps {
  title?: string;
  data: Record<string, any>;
  fields: {
    key: string;
    label: string;
    render?: (value: any, record: Record<string, any>) => React.ReactNode;
    type?: 'text' | 'tag' | 'number' | 'currency' | 'percent' | 'datetime';
    tagColors?: Record<string, string>;
    priority?: 'high' | 'medium' | 'low';
  }[];
  onClick?: () => void;
  actions?: React.ReactNode;
}

const MobileTableCard: React.FC<MobileTableCardProps> = ({
  title,
  data,
  fields,
  onClick,
  actions,
}) => {
  const renderValue = (
    field: MobileTableCardProps['fields'][0],
    value: any
  ): React.ReactNode => {
    if (field.render) {
      return field.render(value, data);
    }

    switch (field.type) {
      case 'tag':
        return (
          <Tag color={field.tagColors?.[value] || 'gray'}>
            {String(value)}
          </Tag>
        );
      case 'number':
        return value != null ? Number(value).toLocaleString() : '-';
      case 'currency':
        return value != null ? `$${Number(value).toLocaleString()}` : '-';
      case 'percent':
        return value != null ? `${(Number(value) * 100).toFixed(2)}%` : '-';
      case 'datetime':
        return value ? new Date(value).toLocaleString() : '-';
      default:
        return value != null ? String(value) : '-';
    }
  };

  // Sort fields by priority
  const sortedFields = [...fields].sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return (priorityOrder[a.priority || 'medium'] || 1) - (priorityOrder[b.priority || 'medium'] || 1);
  });

  return (
    <Card
      className="mobile-table-card"
      onClick={onClick}
      hoverable={!!onClick}
      bordered
    >
      {title && (
        <div className="mobile-table-card__header">
          <Text bold>{title}</Text>
        </div>
      )}
      <div className="mobile-table-card__content">
        {sortedFields.map((field) => (
          <div key={field.key} className="mobile-table-card__row">
            <Text type="secondary" className="mobile-table-card__label">
              {field.label}
            </Text>
            <div className="mobile-table-card__value">
              {renderValue(field, data[field.key])}
            </div>
          </div>
        ))}
      </div>
      {actions && (
        <div className="mobile-table-card__actions">
          <Space>{actions}</Space>
        </div>
      )}
    </Card>
  );
};

export default MobileTableCard;
