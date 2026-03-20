/**
 * Notification Preferences Page
 *
 * UI for managing user notification preferences:
 * - Email notifications toggle
 * - Push notifications toggle
 * - Notification type preferences (signals, risk alerts, performance, system)
 * - Quiet hours settings
 * - Priority threshold
 *
 * Issue #448: 用户通知偏好设置
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  Switch,
  Button,
  Space,
  Typography,
  Divider,
  Message,
  Spin,
  Grid,
  Select,
  TimePicker,
  Form,
  Alert,
  Tag,
  Tooltip,
} from '@arco-design/web-react';
import {
  IconEmail,
  IconNotification,
  IconArrowRise,
  IconExclamationCircle,
  IconDashboard,
  IconSettings,
  IconCheck,
  IconClose,
} from '@arco-design/web-react/icon';
import { useAuth } from '../hooks/useAuth';
import { ErrorBoundary } from '../components/ErrorBoundary';

const { Title, Text, Paragraph } = Typography;
const { Row, Col } = Grid;
const FormItem = Form.Item;
const Option = Select.Option;

// Types
type NotificationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
type DigestFrequency = 'hourly' | 'daily' | 'weekly';

interface NotificationPreferences {
  id: string;
  user_id: string;
  in_app_enabled: boolean;
  email_enabled: boolean;
  push_enabled: boolean;
  signal_notifications: boolean;
  risk_notifications: boolean;
  performance_notifications: boolean;
  system_notifications: boolean;
  priority_threshold: NotificationPriority;
  quiet_hours_enabled: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  quiet_hours_timezone?: string;
  digest_enabled: boolean;
  digest_frequency?: DigestFrequency;
  created_at: string;
  updated_at: string;
}

const priorityOptions = [
  { label: '全部 (LOW+)', value: 'LOW', description: '接收所有通知' },
  { label: '中等 (MEDIUM+)', value: 'MEDIUM', description: '仅接收中等及以上优先级' },
  { label: '高 (HIGH+)', value: 'HIGH', description: '仅接收高优先级通知' },
  { label: '紧急 (URGENT)', value: 'URGENT', description: '仅接收紧急通知' },
];

const digestFrequencyOptions = [
  { label: '每小时', value: 'hourly' },
  { label: '每天', value: 'daily' },
  { label: '每周', value: 'weekly' },
];

const timezoneOptions = [
  { label: 'UTC', value: 'UTC' },
  { label: '北京时间 (UTC+8)', value: 'Asia/Shanghai' },
  { label: '纽约时间 (UTC-5)', value: 'America/New_York' },
  { label: '伦敦时间 (UTC+0)', value: 'Europe/London' },
];

const NotificationPreferencesPage: React.FC = () => {
  const { user, accessToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Form state
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [signalNotifications, setSignalNotifications] = useState(true);
  const [riskNotifications, setRiskNotifications] = useState(true);
  const [performanceNotifications, setPerformanceNotifications] = useState(true);
  const [systemNotifications, setSystemNotifications] = useState(true);
  const [priorityThreshold, setPriorityThreshold] = useState<NotificationPriority>('LOW');
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietHoursStart, setQuietHoursStart] = useState('22:00');
  const [quietHoursEnd, setQuietHoursEnd] = useState('08:00');
  const [quietHoursTimezone, setQuietHoursTimezone] = useState('Asia/Shanghai');
  const [digestEnabled, setDigestEnabled] = useState(false);
  const [digestFrequency, setDigestFrequency] = useState<DigestFrequency>('daily');

  // Fetch preferences
  const fetchPreferences = async () => {
    setLoading(true);
    try {
      const token = accessToken || localStorage.getItem('auth_access_token');
      const response = await fetch('/api/notifications/preferences', {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setPreferences(data.data);
        // Update form state
        setEmailEnabled(data.data.email_enabled);
        setPushEnabled(data.data.push_enabled);
        setSignalNotifications(data.data.signal_notifications);
        setRiskNotifications(data.data.risk_notifications);
        setPerformanceNotifications(data.data.performance_notifications);
        setSystemNotifications(data.data.system_notifications);
        setPriorityThreshold(data.data.priority_threshold);
        setQuietHoursEnabled(data.data.quiet_hours_enabled);
        setQuietHoursStart(data.data.quiet_hours_start || '22:00');
        setQuietHoursEnd(data.data.quiet_hours_end || '08:00');
        setQuietHoursTimezone(data.data.quiet_hours_timezone || 'Asia/Shanghai');
        setDigestEnabled(data.data.digest_enabled);
        setDigestFrequency(data.data.digest_frequency || 'daily');
      } else {
        Message.error(data.error || '加载偏好设置失败');
      }
    } catch (err) {
      console.error('Error fetching preferences:', err);
      Message.error('加载偏好设置失败');
    } finally {
      setLoading(false);
    }
  };

  // Save preferences
  const savePreferences = async () => {
    if (!preferences) return;

    setSaving(true);
    try {
      const token = accessToken || localStorage.getItem('auth_access_token');
      const response = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          email_enabled: emailEnabled,
          push_enabled: pushEnabled,
          signal_notifications: signalNotifications,
          risk_notifications: riskNotifications,
          performance_notifications: performanceNotifications,
          system_notifications: systemNotifications,
          priority_threshold: priorityThreshold,
          quiet_hours_enabled: quietHoursEnabled,
          quiet_hours_start: quietHoursStart,
          quiet_hours_end: quietHoursEnd,
          quiet_hours_timezone: quietHoursTimezone,
          digest_enabled: digestEnabled,
          digest_frequency: digestFrequency,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setPreferences(data.data);
        setHasChanges(false);
        Message.success('偏好设置已保存');
      } else {
        Message.error(data.error || '保存失败');
      }
    } catch (err) {
      console.error('Error saving preferences:', err);
      Message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  // Check for changes
  useEffect(() => {
    if (!preferences) return;

    const changed =
      preferences.email_enabled !== emailEnabled ||
      preferences.push_enabled !== pushEnabled ||
      preferences.signal_notifications !== signalNotifications ||
      preferences.risk_notifications !== riskNotifications ||
      preferences.performance_notifications !== performanceNotifications ||
      preferences.system_notifications !== systemNotifications ||
      preferences.priority_threshold !== priorityThreshold ||
      preferences.quiet_hours_enabled !== quietHoursEnabled ||
      preferences.quiet_hours_start !== quietHoursStart ||
      preferences.quiet_hours_end !== quietHoursEnd ||
      preferences.quiet_hours_timezone !== quietHoursTimezone ||
      preferences.digest_enabled !== digestEnabled ||
      preferences.digest_frequency !== digestFrequency;

    setHasChanges(changed);
  }, [
    emailEnabled,
    pushEnabled,
    signalNotifications,
    riskNotifications,
    performanceNotifications,
    systemNotifications,
    priorityThreshold,
    quietHoursEnabled,
    quietHoursStart,
    quietHoursEnd,
    quietHoursTimezone,
    digestEnabled,
    digestFrequency,
    preferences,
  ]);

  useEffect(() => {
    fetchPreferences();
  }, []);

  // Reset to defaults
  const resetToDefaults = () => {
    setEmailEnabled(false);
    setPushEnabled(false);
    setSignalNotifications(true);
    setRiskNotifications(true);
    setPerformanceNotifications(true);
    setSystemNotifications(true);
    setPriorityThreshold('LOW');
    setQuietHoursEnabled(false);
    setQuietHoursStart('22:00');
    setQuietHoursEnd('08:00');
    setQuietHoursTimezone('Asia/Shanghai');
    setDigestEnabled(false);
    setDigestFrequency('daily');
    Message.info('已重置为默认设置，请点击保存');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <Spin size={40} />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
        <Title heading={4} style={{ marginBottom: 24 }}>
          <IconNotification style={{ marginRight: 8 }} />
          通知偏好设置
        </Title>

        {hasChanges && (
          <Alert
            type="warning"
            content="您有未保存的更改"
            style={{ marginBottom: 16 }}
            closable
          />
        )}

        {/* Notification Channels */}
        <Card title="通知渠道" style={{ marginBottom: 16 }}>
          <Paragraph type="secondary" style={{ marginBottom: 16 }}>
            选择您希望接收通知的方式
          </Paragraph>
          <Row gutter={[24, 16]}>
            <Col span={12}>
              <Card
                hoverable
                style={{
                  borderLeft: emailEnabled ? '4px solid var(--color-primary)' : '4px solid var(--color-border)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Space>
                    <IconEmail style={{ fontSize: 24, color: emailEnabled ? 'var(--color-primary)' : 'var(--color-text-3)' }} />
                    <div>
                      <Text bold>邮件通知</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        通过电子邮件接收重要通知
                      </Text>
                    </div>
                  </Space>
                  <Switch
                    checked={emailEnabled}
                    onChange={setEmailEnabled}
                    checkedText={<IconCheck />}
                    uncheckedText={<IconClose />}
                  />
                </div>
              </Card>
            </Col>
            <Col span={12}>
              <Card
                hoverable
                style={{
                  borderLeft: pushEnabled ? '4px solid var(--color-primary)' : '4px solid var(--color-border)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Space>
                    <IconNotification style={{ fontSize: 24, color: pushEnabled ? 'var(--color-primary)' : 'var(--color-text-3)' }} />
                    <div>
                      <Text bold>推送通知</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        通过浏览器或移动应用推送
                      </Text>
                    </div>
                  </Space>
                  <Switch
                    checked={pushEnabled}
                    onChange={setPushEnabled}
                    checkedText={<IconCheck />}
                    uncheckedText={<IconClose />}
                  />
                </div>
              </Card>
            </Col>
          </Row>
        </Card>

        {/* Notification Types */}
        <Card title="通知类型" style={{ marginBottom: 16 }}>
          <Paragraph type="secondary" style={{ marginBottom: 16 }}>
            选择您希望接收的通知类型
          </Paragraph>
          <Row gutter={[24, 16]}>
            <Col span={12}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
                <Space>
                  <IconArrowRise style={{ fontSize: 20, color: 'rgb(var(--success-6))' }} />
                  <div>
                    <Text>交易信号</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      买入/卖出信号、策略信号
                    </Text>
                  </div>
                </Space>
                <Switch
                  checked={signalNotifications}
                  onChange={setSignalNotifications}
                  checkedText={<IconCheck />}
                  uncheckedText={<IconClose />}
                />
              </div>
            </Col>
            <Col span={12}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
                <Space>
                  <IconExclamationCircle style={{ fontSize: 20, color: 'rgb(var(--warning-6))' }} />
                  <div>
                    <Text>风险告警</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      仓位限制、亏损阈值、风险警告
                    </Text>
                  </div>
                </Space>
                <Switch
                  checked={riskNotifications}
                  onChange={setRiskNotifications}
                  checkedText={<IconCheck />}
                  uncheckedText={<IconClose />}
                />
              </div>
            </Col>
            <Col span={12}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
                <Space>
                  <IconDashboard style={{ fontSize: 20, color: 'rgb(var(--primary-6))' }} />
                  <div>
                    <Text>绩效报告</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      日/周/月绩效摘要
                    </Text>
                  </div>
                </Space>
                <Switch
                  checked={performanceNotifications}
                  onChange={setPerformanceNotifications}
                  checkedText={<IconCheck />}
                  uncheckedText={<IconClose />}
                />
              </div>
            </Col>
            <Col span={12}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
                <Space>
                  <IconSettings style={{ fontSize: 20, color: 'var(--color-text-3)' }} />
                  <div>
                    <Text>系统通知</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      维护、更新、系统消息
                    </Text>
                  </div>
                </Space>
                <Switch
                  checked={systemNotifications}
                  onChange={setSystemNotifications}
                  checkedText={<IconCheck />}
                  uncheckedText={<IconClose />}
                />
              </div>
            </Col>
          </Row>
        </Card>

        {/* Priority Threshold */}
        <Card title="优先级设置" style={{ marginBottom: 16 }}>
          <Paragraph type="secondary" style={{ marginBottom: 16 }}>
            设置最低通知优先级，低于此优先级的通知将被过滤
          </Paragraph>
          <Row gutter={[24, 16]}>
            <Col span={24}>
              <Select
                value={priorityThreshold}
                onChange={setPriorityThreshold}
                style={{ width: '100%' }}
              >
                {priorityOptions.map((opt) => (
                  <Option key={opt.value} value={opt.value}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <span>{opt.label}</span>
                      <Text type="secondary" style={{ fontSize: 12 }}>{opt.description}</Text>
                    </div>
                  </Option>
                ))}
              </Select>
            </Col>
          </Row>
        </Card>

        {/* Quiet Hours */}
        <Card title="静默时段" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <Text>启用静默时段</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                在指定时间段内不发送通知
              </Text>
            </div>
            <Switch
              checked={quietHoursEnabled}
              onChange={setQuietHoursEnabled}
              checkedText={<IconCheck />}
              uncheckedText={<IconClose />}
            />
          </div>

          {quietHoursEnabled && (
            <>
              <Divider style={{ margin: '16px 0' }} />
              <Row gutter={[16, 16]}>
                <Col span={8}>
                  <div style={{ marginBottom: 8 }}>
                    <Text>开始时间</Text>
                  </div>
                  <TimePicker
                    format="HH:mm"
                    value={quietHoursStart}
                    onChange={(_, timeString) => setQuietHoursStart(timeString as string)}
                    style={{ width: '100%' }}
                    placeholder="选择开始时间"
                  />
                </Col>
                <Col span={8}>
                  <div style={{ marginBottom: 8 }}>
                    <Text>结束时间</Text>
                  </div>
                  <TimePicker
                    format="HH:mm"
                    value={quietHoursEnd}
                    onChange={(_, timeString) => setQuietHoursEnd(timeString as string)}
                    style={{ width: '100%' }}
                    placeholder="选择结束时间"
                  />
                </Col>
                <Col span={8}>
                  <div style={{ marginBottom: 8 }}>
                    <Text>时区</Text>
                  </div>
                  <Select
                    value={quietHoursTimezone}
                    onChange={setQuietHoursTimezone}
                    style={{ width: '100%' }}
                  >
                    {timezoneOptions.map((opt) => (
                      <Option key={opt.value} value={opt.value}>
                        {opt.label}
                      </Option>
                    ))}
                  </Select>
                </Col>
              </Row>
              <Alert
                type="info"
                content={
                  <span>
                    静默时段：{quietHoursStart} - {quietHoursEnd} ({timezoneOptions.find(t => t.value === quietHoursTimezone)?.label})
                  </span>
                }
                style={{ marginTop: 16 }}
              />
            </>
          )}
        </Card>

        {/* Digest Settings */}
        <Card title="通知摘要" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <Text>启用通知摘要</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                将多个通知合并为定期摘要发送
              </Text>
            </div>
            <Switch
              checked={digestEnabled}
              onChange={setDigestEnabled}
              checkedText={<IconCheck />}
              uncheckedText={<IconClose />}
            />
          </div>

          {digestEnabled && (
            <>
              <Divider style={{ margin: '16px 0' }} />
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <div style={{ marginBottom: 8 }}>
                    <Text>摘要频率</Text>
                  </div>
                  <Select
                    value={digestFrequency}
                    onChange={setDigestFrequency}
                    style={{ width: '100%' }}
                  >
                    {digestFrequencyOptions.map((opt) => (
                      <Option key={opt.value} value={opt.value}>
                        {opt.label}
                      </Option>
                    ))}
                  </Select>
                </Col>
              </Row>
            </>
          )}
        </Card>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
          <Button onClick={resetToDefaults}>
            恢复默认
          </Button>
          <Button
            type="primary"
            onClick={savePreferences}
            loading={saving}
            disabled={!hasChanges}
          >
            保存设置
          </Button>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default NotificationPreferencesPage;