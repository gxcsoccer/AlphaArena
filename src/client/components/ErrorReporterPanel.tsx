/**
 * ErrorReporterPanel - Debug Panel for Captured Errors
 * 
 * Displays captured errors in a collapsible panel for debugging.
 * Only shown in development or when explicitly enabled.
 */

import React, { useState } from 'react';
import { Card, Table, Tag, Button, Typography, Space, Badge } from '@arco-design/web-react';
import { IconBug, IconClose, IconDelete } from '@arco-design/web-react/icon';
import { CapturedError } from '../hooks/useErrorReporter';

const { Text } = Typography;

interface ErrorReporterPanelProps {
  errors: CapturedError[];
  onClear: () => void;
  visible?: boolean;
}

const ErrorReporterPanel: React.FC<ErrorReporterPanelProps> = ({
  errors,
  onClear,
  visible = true,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  if (!visible || errors.length === 0) {
    return null;
  }

  const columns = [
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: string) => (
        <Tag color={type === 'error' ? 'red' : 'orange'}>
          {type === 'error' ? '错误' : '未处理 Promise'}
        </Tag>
      ),
    },
    {
      title: '错误信息',
      dataIndex: 'message',
      key: 'message',
      render: (message: string) => (
        <Text ellipsis style={{ maxWidth: 300 }}>{message}</Text>
      ),
    },
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      render: (timestamp: number) => new Date(timestamp).toLocaleString('zh-CN'),
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      width: 150,
      render: (source?: string) => (
        <Text ellipsis style={{ maxWidth: 150 }}>{source || 'Unknown'}</Text>
      ),
    },
    {
      title: '位置',
      key: 'location',
      width: 100,
      render: (_: any, record: CapturedError) => (
        record.lineno ? `${record.lineno}:${record.colno}` : '-'
      ),
    },
  ];

  return (
    <Card
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        width: 800,
        maxHeight: 400,
        zIndex: 9999,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      }}
      title={
        <Space>
          <IconBug style={{ fontSize: 18, color: '#f53f3f' }} />
          <Text strong>错误报告 ({errors.length})</Text>
          <Badge count={errors.length} style={{ backgroundColor: '#f53f3f' }} />
        </Space>
      }
      extra={
        <Space>
          <Button
            type="text"
            icon={<IconDelete />}
            onClick={onClear}
            size="small"
            title="清除所有错误"
          />
          <Button
            type="text"
            icon={collapsed ? <IconBug /> : <IconClose />}
            onClick={() => setCollapsed(!collapsed)}
            size="small"
            title={collapsed ? '展开' : '收起'}
          />
        </Space>
      }
      bordered
    >
      {!collapsed && (
        <Table
          columns={columns}
          data={errors.slice().reverse()} // Show newest first
          pagination={{
            pageSize: 10,
            total: errors.length,
          }}
          rowKey="id"
          size="small"
          style={{ maxHeight: 300, overflow: 'auto' }}
        />
      )}
    </Card>
  );
};

export default ErrorReporterPanel;
