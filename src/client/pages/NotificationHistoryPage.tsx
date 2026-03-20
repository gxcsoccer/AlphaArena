/**
 * Notification History Page
 *
 * Displays all user notifications with filtering and management capabilities:
 * - Filter by type (SIGNAL, RISK, PERFORMANCE, SYSTEM)
 * - Filter by read/unread status
 * - Mark individual notifications as read/unread
 * - Mark all as read
 * - Delete notifications
 * - View notification details
 *
 * Issue #449: 通知历史记录页面
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Typography,
  Space,
  Button,
  Tag,
  List,
  Empty,
  Spin,
  Message,
  Modal,
  Grid,
  Select,
  Tabs,
  Badge,
  Dropdown,
  Menu,
  Popconfirm,
  Divider,
} from '@arco-design/web-react';
import {
  IconNotification,
  IconCheck,
  IconClose,
  IconDelete,
  IconRefresh,
  IconMore,
  IconArrowRise,
  IconExclamationCircle,
  IconDashboard,
  IconSettings,
  IconClockCircle,
  IconFilter,
} from '@arco-design/web-react/icon';
import { useAuth } from '../hooks/useAuth';
import { ErrorBoundary } from '../components/ErrorBoundary';

const { Title, Text, Paragraph } = Typography;
const { Row, Col } = Grid;
const Option = Select.Option;

// Types - matching server types
type NotificationType = 'SIGNAL' | 'RISK' | 'PERFORMANCE' | 'SYSTEM';
type NotificationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  data: Record<string, unknown>;
  entity_type?: string;
  entity_id?: string;
  is_read: boolean;
  read_at?: string;
  action_url?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

interface NotificationListResponse {
  success: boolean;
  data: Notification[];
  total: number;
  error?: string;
}

// Type configurations
const typeConfig: Record<NotificationType, { label: string; color: string; icon: React.ReactNode }> = {
  SIGNAL: { label: '交易信号', color: 'green', icon: <IconArrowRise /> },
  RISK: { label: '风险告警', color: 'red', icon: <IconExclamationCircle /> },
  PERFORMANCE: { label: '绩效报告', color: 'blue', icon: <IconDashboard /> },
  SYSTEM: { label: '系统通知', color: 'gray', icon: <IconSettings /> },
};

const priorityConfig: Record<NotificationPriority, { label: string; color: string }> = {
  LOW: { label: '低', color: 'arcoblue' },
  MEDIUM: { label: '中', color: 'orangered' },
  HIGH: { label: '高', color: 'red' },
  URGENT: { label: '紧急', color: 'magenta' },
};

const NotificationHistoryPage: React.FC = () => {
  const { user, accessToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  // Filters
  const [typeFilter, setTypeFilter] = useState<NotificationType | 'all'>('all');
  const [readFilter, setReadFilter] = useState<'all' | 'read' | 'unread'>('all');

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Selected notification for details
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const token = accessToken || localStorage.getItem('auth_access_token');
      const params = new URLSearchParams();
      
      if (typeFilter !== 'all') {
        params.append('type', typeFilter);
      }
      if (readFilter === 'read') {
        params.append('is_read', 'true');
      } else if (readFilter === 'unread') {
        params.append('is_read', 'false');
      }
      params.append('limit', String(pageSize));
      params.append('offset', String((page - 1) * pageSize));

      const response = await fetch(`/api/notifications?${params.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const data: NotificationListResponse = await response.json();

      if (response.ok && data.success) {
        setNotifications(data.data);
        setTotal(data.total);
      } else {
        Message.error(data.error || '加载通知失败');
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
      Message.error('加载通知失败');
    } finally {
      setLoading(false);
    }
  }, [accessToken, typeFilter, readFilter, page]);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const token = accessToken || localStorage.getItem('auth_access_token');
      const response = await fetch('/api/notifications/unread-count', {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setUnreadCount(data.count);
      }
    } catch (err) {
      console.error('Error fetching unread count:', err);
    }
  }, [accessToken]);

  // Mark as read
  const markAsRead = async (id: string) => {
    try {
      const token = accessToken || localStorage.getItem('auth_access_token');
      const response = await fetch(`/api/notifications/${id}/read`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
        Message.success('已标记为已读');
      } else {
        Message.error(data.error || '操作失败');
      }
    } catch (err) {
      console.error('Error marking as read:', err);
      Message.error('操作失败');
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      const token = accessToken || localStorage.getItem('auth_access_token');
      const response = await fetch('/api/notifications/read-all', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
        );
        setUnreadCount(0);
        Message.success(`已标记 ${data.marked_count} 条通知为已读`);
      } else {
        Message.error(data.error || '操作失败');
      }
    } catch (err) {
      console.error('Error marking all as read:', err);
      Message.error('操作失败');
    }
  };

  // Delete notification
  const deleteNotification = async (id: string) => {
    try {
      const token = accessToken || localStorage.getItem('auth_access_token');
      const response = await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const deleted = notifications.find((n) => n.id === id);
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        setTotal((prev) => prev - 1);
        if (deleted && !deleted.is_read) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
        Message.success('通知已删除');
      } else {
        Message.error(data.error || '删除失败');
      }
    } catch (err) {
      console.error('Error deleting notification:', err);
      Message.error('删除失败');
    }
  };

  // Format time
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins} 分钟前`;
    if (diffHours < 24) return `${diffHours} 小时前`;
    if (diffDays < 7) return `${diffDays} 天前`;
    
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Initial load
  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
  }, [fetchNotifications, fetchUnreadCount]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [typeFilter, readFilter]);

  // Render notification item
  const renderNotificationItem = (notification: Notification) => {
    const typeInfo = typeConfig[notification.type];
    const priorityInfo = priorityConfig[notification.priority];

    return (
      <List.Item
        key={notification.id}
        style={{
          backgroundColor: notification.is_read ? 'transparent' : 'rgba(var(--primary-6), 0.05)',
          borderLeft: notification.is_read ? 'none' : '3px solid rgb(var(--primary-6))',
          padding: '16px 20px',
          cursor: 'pointer',
        }}
        onClick={() => setSelectedNotification(notification)}
        actions={[
          <Dropdown
            key="actions"
            droplist={
              <Menu>
                {!notification.is_read && (
                  <Menu.Item
                    key="read"
                    onClick={(e) => {
                      e?.stopPropagation();
                      markAsRead(notification.id);
                    }}
                  >
                    <Space>
                      <IconCheck />
                      标记已读
                    </Space>
                  </Menu.Item>
                )}
                <Menu.Item
                  key="delete"
                  onClick={(e) => {
                    e?.stopPropagation();
                  }}
                >
                  <Popconfirm
                    title="确定删除此通知？"
                    onOk={() => deleteNotification(notification.id)}
                    onCancel={() => {}}
                  >
                    <Space style={{ color: 'rgb(var(--danger-6))' }}>
                      <IconDelete />
                      删除
                    </Space>
                  </Popconfirm>
                </Menu.Item>
              </Menu>
            }
            trigger="click"
          >
            <Button
              type="text"
              size="small"
              icon={<IconMore />}
              onClick={(e) => e.stopPropagation()}
            />
          </Dropdown>,
        ]}
      >
        <List.Item.Meta
          avatar={
            <Badge dot={!notification.is_read} offset={[-4, 4]}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: `var(--color-${typeInfo.color}-light-1)`,
                  color: `rgb(var(--${typeInfo.color}-6))`,
                }}
              >
                {typeInfo.icon}
              </div>
            </Badge>
          }
          title={
            <Space>
              <Text bold={!notification.is_read}>{notification.title}</Text>
              <Tag color={typeInfo.color} size="small">
                {typeInfo.label}
              </Tag>
              <Tag color={priorityInfo.color} size="small">
                {priorityInfo.label}
              </Tag>
            </Space>
          }
          description={
            <div>
              <Text
                type="secondary"
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {notification.message}
              </Text>
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconClockCircle style={{ fontSize: 12, color: 'var(--color-text-3)' }} />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {formatTime(notification.created_at)}
                </Text>
                {notification.is_read && notification.read_at && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    · 已读于 {formatTime(notification.read_at)}
                  </Text>
                )}
              </div>
            </div>
          }
        />
      </List.Item>
    );
  };

  return (
    <ErrorBoundary>
      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        <Row gutter={[24, 24]}>
          {/* Header */}
          <Col span={24}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Space>
                <Title heading={4} style={{ margin: 0 }}>
                  <IconNotification style={{ marginRight: 8 }} />
                  通知历史
                </Title>
                <Badge count={unreadCount} maxCount={99}>
                  <Tag color="blue">共 {total} 条</Tag>
                </Badge>
              </Space>
              <Space>
                <Button
                  icon={<IconRefresh />}
                  onClick={() => {
                    fetchNotifications();
                    fetchUnreadCount();
                  }}
                >
                  刷新
                </Button>
                {unreadCount > 0 && (
                  <Popconfirm
                    title="确定将所有通知标记为已读？"
                    onOk={markAllAsRead}
                  >
                    <Button type="primary" icon={<IconCheck />}>
                      全部标记已读
                    </Button>
                  </Popconfirm>
                )}
              </Space>
            </div>
          </Col>

          {/* Filters */}
          <Col span={24}>
            <Card>
              <Space size="large" wrap>
                <Space>
                  <Text type="secondary">类型：</Text>
                  <Select
                    value={typeFilter}
                    onChange={setTypeFilter}
                    style={{ width: 140 }}
                  >
                    <Option value="all">全部类型</Option>
                    <Option value="SIGNAL">
                      <Space>
                        <IconArrowRise style={{ color: 'rgb(var(--success-6))' }} />
                        交易信号
                      </Space>
                    </Option>
                    <Option value="RISK">
                      <Space>
                        <IconExclamationCircle style={{ color: 'rgb(var(--danger-6))' }} />
                        风险告警
                      </Space>
                    </Option>
                    <Option value="PERFORMANCE">
                      <Space>
                        <IconDashboard style={{ color: 'rgb(var(--primary-6))' }} />
                        绩效报告
                      </Space>
                    </Option>
                    <Option value="SYSTEM">
                      <Space>
                        <IconSettings style={{ color: 'var(--color-text-3)' }} />
                        系统通知
                      </Space>
                    </Option>
                  </Select>
                </Space>

                <Space>
                  <Text type="secondary">状态：</Text>
                  <Select
                    value={readFilter}
                    onChange={setReadFilter}
                    style={{ width: 120 }}
                  >
                    <Option value="all">全部状态</Option>
                    <Option value="unread">
                      <Space>
                        <Badge dot />
                        未读
                      </Space>
                    </Option>
                    <Option value="read">
                      <Space>
                        <IconCheck style={{ color: 'rgb(var(--success-6))' }} />
                        已读
                      </Space>
                    </Option>
                  </Select>
                </Space>
              </Space>
            </Card>
          </Col>

          {/* Notification List */}
          <Col span={24}>
            <Card>
              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
                  <Spin size={40} />
                </div>
              ) : notifications.length === 0 ? (
                <Empty
                  icon={<IconNotification style={{ fontSize: 64, color: 'var(--color-text-3)' }} />}
                  description={
                    <div>
                      <Text type="secondary">暂无通知</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        这里将显示您的所有通知消息
                      </Text>
                    </div>
                  }
                  style={{ padding: '60px 0' }}
                />
              ) : (
                <>
                  <List
                    bordered={false}
                    dataSource={notifications}
                    renderItem={renderNotificationItem}
                    style={{ marginLeft: -20, marginRight: -20 }}
                  />
                  
                  {/* Pagination */}
                  {total > pageSize && (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginTop: 24,
                        gap: 16,
                      }}
                    >
                      <Button
                        disabled={page === 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        上一页
                      </Button>
                      <Text type="secondary">
                        第 {page} 页，共 {Math.ceil(total / pageSize)} 页
                      </Text>
                      <Button
                        disabled={page * pageSize >= total}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        下一页
                      </Button>
                    </div>
                  )}
                </>
              )}
            </Card>
          </Col>
        </Row>

        {/* Notification Detail Modal */}
        <Modal
          title={
            selectedNotification && (
              <Space>
                {typeConfig[selectedNotification.type].icon}
                {selectedNotification.title}
              </Space>
            )
          }
          visible={!!selectedNotification}
          onCancel={() => setSelectedNotification(null)}
          footer={
            selectedNotification && (
              <Space>
                {!selectedNotification.is_read && (
                  <Button
                    type="primary"
                    icon={<IconCheck />}
                    onClick={() => {
                      markAsRead(selectedNotification.id);
                      setSelectedNotification({ ...selectedNotification, is_read: true });
                    }}
                  >
                    标记已读
                  </Button>
                )}
                {selectedNotification.action_url && (
                  <Button
                    type="primary"
                    onClick={() => {
                      window.location.href = selectedNotification.action_url!;
                    }}
                  >
                    查看详情
                  </Button>
                )}
                <Button onClick={() => setSelectedNotification(null)}>关闭</Button>
              </Space>
            )
          }
          style={{ maxWidth: 600 }}
        >
          {selectedNotification && (
            <div>
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <div>
                  <Space size="small">
                    <Tag color={typeConfig[selectedNotification.type].color}>
                      {typeConfig[selectedNotification.type].label}
                    </Tag>
                    <Tag color={priorityConfig[selectedNotification.priority].color}>
                      {priorityConfig[selectedNotification.priority].label}优先级
                    </Tag>
                  </Space>
                </div>

                <div>
                  <Text type="secondary">消息内容</Text>
                  <Paragraph style={{ marginTop: 8 }}>{selectedNotification.message}</Paragraph>
                </div>

                {selectedNotification.data && Object.keys(selectedNotification.data).length > 0 && (
                  <div>
                    <Text type="secondary">详细信息</Text>
                    <Card
                      style={{
                        marginTop: 8,
                        backgroundColor: 'var(--color-fill-1)',
                        fontSize: 12,
                      }}
                    >
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                        {JSON.stringify(selectedNotification.data, null, 2)}
                      </pre>
                    </Card>
                  </div>
                )}

                <Divider style={{ margin: '12px 0' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    <IconClockCircle style={{ marginRight: 4 }} />
                    创建时间：{new Date(selectedNotification.created_at).toLocaleString('zh-CN')}
                  </Text>
                  {selectedNotification.is_read && selectedNotification.read_at && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      <IconCheck style={{ marginRight: 4, color: 'rgb(var(--success-6))' }} />
                      已读时间：{new Date(selectedNotification.read_at).toLocaleString('zh-CN')}
                    </Text>
                  )}
                </div>
              </Space>
            </div>
          )}
        </Modal>
      </div>
    </ErrorBoundary>
  );
};

export default NotificationHistoryPage;