/**
 * NotificationBell Component
 * Bell icon with unread count badge
 */

import React from 'react';
import { Badge, Dropdown, Button, Space, List, Typography, Empty, Spin } from '@arco-design/web-react';
import { IconNotification, IconCheck, IconDelete } from '@arco-design/web-react/icon';
import { useNotifications } from '../hooks/useNotifications.js';
import type { Notification } from '../hooks/useNotifications.js';
import './NotificationBell.css';

const { Text, Title } = Typography;

interface NotificationBellProps {
  onNotificationClick?: (notification: Notification) => void;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ onNotificationClick }) => {
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
  } = useNotifications({ limit: 10 });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'SIGNAL':
        return '📈';
      case 'RISK':
        return '⚠️';
      case 'PERFORMANCE':
        return '📊';
      case 'SYSTEM':
        return 'ℹ️';
      default:
        return '📌';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return '#f53f3f';
      case 'HIGH':
        return '#ff7d00';
      case 'MEDIUM':
        return '#165dff';
      case 'LOW':
        return '#86909c';
      default:
        return '#86909c';
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
    onNotificationClick?.(notification);
  };

  const droplist = (
    <div className="notification-dropdown">
      <div className="notification-header">
        <Title heading={5} style={{ margin: 0 }}>Notifications</Title>
        {unreadCount > 0 && (
          <Button
            type="text"
            size="small"
            onClick={markAllAsRead}
            icon={<IconCheck />}
          >
            Mark all read
          </Button>
        )}
      </div>

      <div className="notification-list">
        {loading ? (
          <div className="notification-loading">
            <Spin />
          </div>
        ) : notifications.length === 0 ? (
          <Empty description="No notifications" />
        ) : (
          <List
            dataSource={notifications}
            render={(item: Notification) => (
              <List.Item
                key={item.id}
                className={`notification-item ${!item.is_read ? 'unread' : ''}`}
                onClick={() => handleNotificationClick(item)}
              >
                <div className="notification-content">
                  <div className="notification-icon">
                    {getTypeIcon(item.type)}
                  </div>
                  <div className="notification-body">
                    <div className="notification-title-row">
                      <Text
                        weight={item.is_read ? 400 : 600}
                        className="notification-title"
                      >
                        {item.title}
                      </Text>
                      <span
                        className="notification-priority"
                        style={{ backgroundColor: getPriorityColor(item.priority) }}
                      />
                    </div>
                    <Text type="secondary" className="notification-message">
                      {item.message.length > 60
                        ? `${item.message.substring(0, 60)}...`
                        : item.message}
                    </Text>
                    <Text type="tertiary" className="notification-time">
                      {formatTime(item.created_at)}
                    </Text>
                  </div>
                </div>
              </List.Item>
            )}
          />
        )}
      </div>

      <div className="notification-footer">
        <Button type="text" long href="/notifications">
          View all notifications
        </Button>
      </div>
    </div>
  );

  return (
    <Dropdown
      droplist={droplist}
      trigger="click"
      position="br"
      popupVisible={undefined}
    >
      <Badge count={unreadCount} dot={false} offset={[-5, 5]}>
        <Button
          type="text"
          icon={<IconNotification style={{ fontSize: 20 }} />}
          className="notification-bell-button"
        />
      </Badge>
    </Dropdown>
  );
};

export default NotificationBell;
