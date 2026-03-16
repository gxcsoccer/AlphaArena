/**
 * Notification Center Component
 * 
 * Displays price alert notifications with history, unread count badge,
 * and settings for enabling/disabling notifications and sounds.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Badge,
  Button,
  Card,
  Dropdown,
  Empty,
  List,
  Menu,
  Space,
  Switch,
  Tag,
  Typography,
  Popconfirm,
  Divider,
} from '@arco-design/web-react';
import {
  IconNotification,
  IconCheck,
  IconDelete,
  IconSound,
  IconClose,
  IconSettings,
} from '@arco-design/web-react/icon';
import { getNotificationService, PriceAlertNotification } from '../utils/notificationService';

const { Text, Title } = Typography;

interface NotificationCenterProps {
  compact?: boolean;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ compact = false }) => {
  const [notifications, setNotifications] = useState<PriceAlertNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');
  const notificationService = getNotificationService();

  // Initialize and subscribe to notifications
  useEffect(() => {
    setNotifications(notificationService.getHistory());
    setUnreadCount(notificationService.getUnreadCount());
    setSoundEnabled(notificationService.isSoundEnabled());
    setNotificationsEnabled(notificationService.isNotificationsEnabled());
    setPermissionStatus(notificationService.getPermissionStatus());

    const unsubscribe = notificationService.subscribe((updated) => {
      setNotifications(updated);
      setUnreadCount(notificationService.getUnreadCount());
    });

    return unsubscribe;
  }, []);

  // Handle permission request
  const handleRequestPermission = useCallback(async () => {
    const status = await notificationService.requestPermission();
    setPermissionStatus(status);
  }, [notificationService]);

  // Handle sound toggle
  const handleSoundToggle = useCallback((enabled: boolean) => {
    notificationService.setSoundEnabled(enabled);
    setSoundEnabled(enabled);
  }, [notificationService]);

  // Handle notifications toggle
  const handleNotificationsToggle = useCallback((enabled: boolean) => {
    notificationService.setNotificationsEnabled(enabled);
    setNotificationsEnabled(enabled);
  }, [notificationService]);

  // Handle mark as read
  const handleMarkAsRead = useCallback((id: string) => {
    notificationService.markAsRead(id);
  }, [notificationService]);

  // Handle mark all as read
  const handleMarkAllAsRead = useCallback(() => {
    notificationService.markAllAsRead();
  }, [notificationService]);

  // Handle clear all
  const handleClearAll = useCallback(() => {
    notificationService.clearAll();
  }, [notificationService]);

  // Play test sound
  const handleTestSound = useCallback(() => {
    notificationService.playAlertSound();
  }, [notificationService]);

  // Render notification item
  const renderNotificationItem = (item: PriceAlertNotification) => {
    const conditionColor = item.conditionType === 'above' ? 'green' : 'red';
    const timeAgo = getTimeAgo(item.timestamp);

    return (
      <List.Item
        key={item.id}
        style={{
          backgroundColor: item.read ? 'transparent' : 'var(--color-primary-light-1)',
          padding: '12px 16px',
          borderRadius: 4,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Text bold={!item.read}>{item.title}</Text>
              {!item.read && <Tag size="small" color="blue">新</Tag>}
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>{item.message}</Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <Tag size="small" color={conditionColor}>
                {item.conditionType === 'above' ? '高于' : '低于'}
              </Tag>
              <Text type="secondary" style={{ fontSize: 11 }}>
                目标: ${item.targetPrice.toLocaleString()}
                {item.triggeredPrice && ` | 触发: $${item.triggeredPrice.toLocaleString()}`}
              </Text>
              <Text type="secondary" style={{ fontSize: 11 }}>{timeAgo}</Text>
            </div>
          </div>
          {!item.read && (
            <Button
              type="text"
              size="mini"
              icon={<IconCheck />}
              onClick={() => handleMarkAsRead(item.id)}
            />
          )}
        </div>
      </List.Item>
    );
  };

  // Settings dropdown
  const settingsDropdown = (
    <Menu>
      <Menu.Item key="sound">
        <Space>
          <IconSound />
          <span>声音提醒</span>
          <Switch
            size="small"
            checked={soundEnabled}
            onChange={handleSoundToggle}
          />
        </Space>
      </Menu.Item>
      <Menu.Item key="notifications">
        <Space>
          <IconNotification />
          <span>浏览器通知</span>
          <Switch
            size="small"
            checked={notificationsEnabled}
            onChange={handleNotificationsToggle}
          />
        </Space>
      </Menu.Item>
      {notificationsEnabled && permissionStatus !== 'granted' && (
        <Menu.Item key="permission">
          <Button
            type="primary"
            size="small"
            onClick={handleRequestPermission}
          >
            {permissionStatus === 'denied' ? '通知已被阻止' : '授权通知'}
          </Button>
        </Menu.Item>
      )}
      <Menu.Item key="test-sound">
        <Button
          type="text"
          size="small"
          onClick={handleTestSound}
        >
          🔊 测试声音
        </Button>
      </Menu.Item>
    </Menu>
  );

  // Notification dropdown content
  const notificationContent = (
    <Card
      style={{ width: compact ? 300 : 400, maxHeight: 500, overflow: 'hidden' }}
      bodyStyle={{ padding: 0 }}
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text bold>通知中心</Text>
          <Space size={4}>
            {unreadCount > 0 && (
              <Button
                type="text"
                size="mini"
                onClick={handleMarkAllAsRead}
              >
                全部已读
              </Button>
            )}
            <Popconfirm
              title="确定清除所有通知？"
              onOk={handleClearAll}
            >
              <Button
                type="text"
                size="mini"
                icon={<IconDelete />}
              >
                清空
              </Button>
            </Popconfirm>
            <Dropdown
              droplist={settingsDropdown}
              position="br"
            >
              <Button
                type="text"
                size="mini"
                icon={<IconSettings />}
              />
            </Dropdown>
          </Space>
        </div>
      }
    >
      {notifications.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <Empty description="暂无通知" />
        </div>
      ) : (
        <div style={{ maxHeight: 400, overflow: 'auto' }}>
          <List
            dataSource={notifications}
            renderItem={renderNotificationItem}
            style={{ padding: 8 }}
          />
        </div>
      )}
    </Card>
  );

  return (
    <Dropdown
      droplist={notificationContent}
      position="br"
      trigger="click"
    >
      <Button
        type="text"
        size={compact ? 'small' : 'default'}
        icon={
          <Badge count={unreadCount} dot={unreadCount > 0}>
            <IconNotification style={{ fontSize: compact ? 16 : 20 }} />
          </Badge>
        }
        style={{ padding: compact ? 4 : 8 }}
      />
    </Dropdown>
  );
};

// Helper function to format time ago
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}天前`;
  if (hours > 0) return `${hours}小时前`;
  if (minutes > 0) return `${minutes}分钟前`;
  return '刚刚';
}

export default NotificationCenter;
