/**
 * Signal Notification Settings Component
 * User preferences for signal notifications with per-strategy configuration
 * Issue #670: 策略信号通知增强
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Form,
  Switch,
  Select,
  InputNumber,
  Typography,
  Divider,
  Message,
  Space,
  Button,
  Table,
  Tag,
  Slider,
  Collapse,
  Alert,
  Tooltip,
  Spin,
} from '@arco-design/web-react';
import {
  IconNotification,
  IconBulb,
  IconArrowRise as IconTrendingUp,
  IconMoon,
  IconCheck,
  IconClose,
  IconInfoCircle,
} from '@arco-design/web-react/icon';
import './SignalNotificationSettings.css';

const { Title, Text, Paragraph } = Typography;
const FormItem = Form.Item;
const CollapseItem = Collapse.Item;

interface StrategyConfig {
  id: string;
  strategyId: string;
  strategyName: string;
  enabled: boolean;
  signalTypes: string[];
  minConfidenceScore: number;
  riskLevels: string[];
  notifyInApp: boolean;
  notifyPush: boolean;
  notifyEmail: boolean;
  notifySms: boolean;
}

interface PushConfig {
  pushEnabled: boolean;
  signalTypes: string[];
  frequency: string;
  browserNotify: boolean;
  inAppNotify: boolean;
  soundEnabled: boolean;
  minConfidenceScore: number;
  riskLevels: string[];
  symbols: string[];
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  quietHoursTimezone: string;
}

interface SignalNotificationSettingsProps {
  compact?: boolean;
}

const SignalNotificationSettings: React.FC<SignalNotificationSettingsProps> = ({ compact = false }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pushConfig, setPushConfig] = useState<PushConfig | null>(null);
  const [strategyConfigs, setStrategyConfigs] = useState<StrategyConfig[]>([]);
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>('default');

  const [form] = Form.useForm();

  // Load configurations
  useEffect(() => {
    loadConfigurations();
    checkBrowserPermission();
  }, []);

  const loadConfigurations = async () => {
    try {
      setLoading(true);

      // TODO: Replace with actual API calls
      // For now, use mock data
      const mockPushConfig: PushConfig = {
        pushEnabled: true,
        signalTypes: ['all'],
        frequency: 'realtime',
        browserNotify: true,
        inAppNotify: true,
        soundEnabled: true,
        minConfidenceScore: 0,
        riskLevels: ['low', 'medium', 'high', 'very_high'],
        symbols: [],
        quietHoursEnabled: false,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
        quietHoursTimezone: 'Asia/Shanghai',
      };

      const mockStrategyConfigs: StrategyConfig[] = [
        {
          id: '1',
          strategyId: 'strategy-1',
          strategyName: 'MA 交叉策略',
          enabled: true,
          signalTypes: ['all'],
          minConfidenceScore: 70,
          riskLevels: ['low', 'medium', 'high'],
          notifyInApp: true,
          notifyPush: true,
          notifyEmail: false,
          notifySms: false,
        },
        {
          id: '2',
          strategyId: 'strategy-2',
          strategyName: 'RSI 超卖策略',
          enabled: true,
          signalTypes: ['buy'],
          minConfidenceScore: 80,
          riskLevels: ['low', 'medium'],
          notifyInApp: true,
          notifyPush: false,
          notifyEmail: true,
          notifySms: false,
        },
      ];

      setPushConfig(mockPushConfig);
      setStrategyConfigs(mockStrategyConfigs);

      // Initialize form
      form.setFieldsValue({
        pushEnabled: mockPushConfig.pushEnabled,
        frequency: mockPushConfig.frequency,
        browserNotify: mockPushConfig.browserNotify,
        soundEnabled: mockPushConfig.soundEnabled,
        minConfidenceScore: mockPushConfig.minConfidenceScore,
        riskLevels: mockPushConfig.riskLevels,
        quietHoursEnabled: mockPushConfig.quietHoursEnabled,
        quietHoursStart: mockPushConfig.quietHoursStart,
        quietHoursEnd: mockPushConfig.quietHoursEnd,
      });
    } catch (error) {
      Message.error('加载配置失败');
    } finally {
      setLoading(false);
    }
  };

  const checkBrowserPermission = async () => {
    if ('Notification' in window) {
      setBrowserPermission(Notification.permission);
    }
  };

  const requestBrowserPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setBrowserPermission(permission);
      if (permission === 'granted') {
        Message.success('浏览器通知已启用');
      } else {
        Message.warning('浏览器通知权限被拒绝，请在浏览器设置中启用');
      }
    }
  };

  const handleSaveGlobal = async (values: Partial<PushConfig>) => {
    setSaving(true);
    try {
      // TODO: Replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 500));
      Message.success('全局配置已保存');
    } catch (error) {
      Message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleStrategyToggle = useCallback(async (strategyId: string, enabled: boolean) => {
    setStrategyConfigs(prev =>
      prev.map(config =>
        config.strategyId === strategyId ? { ...config, enabled } : config
      )
    );
    // TODO: Call API to update
    Message.success(enabled ? '已启用该策略通知' : '已禁用该策略通知');
  }, []);

  const handleStrategyUpdate = useCallback(async (
    strategyId: string,
    updates: Partial<StrategyConfig>
  ) => {
    setStrategyConfigs(prev =>
      prev.map(config =>
        config.strategyId === strategyId ? { ...config, ...updates } : config
      )
    );
    // TODO: Call API to update
    Message.success('配置已更新');
  }, []);

  // Strategy table columns
  const strategyColumns = [
    {
      title: '策略名称',
      dataIndex: 'strategyName',
      key: 'strategyName',
      render: (name: string) => <Text bold>{name}</Text>,
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (enabled: boolean, record: StrategyConfig) => (
        <Switch
          checked={enabled}
          onChange={(checked) => handleStrategyToggle(record.strategyId, checked)}
        />
      ),
    },
    {
      title: '信号类型',
      dataIndex: 'signalTypes',
      key: 'signalTypes',
      width: 150,
      render: (types: string[]) => (
        <Select
          mode="multiple"
          value={types}
          style={{ width: '100%' }}
          disabled
          placeholder="全部"
        >
          <Select.Option value="all">全部</Select.Option>
          <Select.Option value="buy">买入</Select.Option>
          <Select.Option value="sell">卖出</Select.Option>
          <Select.Option value="stop_loss">止损</Select.Option>
          <Select.Option value="take_profit">止盈</Select.Option>
        </Select>
      ),
    },
    {
      title: '最低置信度',
      dataIndex: 'minConfidenceScore',
      key: 'minConfidenceScore',
      width: 120,
      render: (score: number) => (
        <Tag color={score >= 80 ? 'green' : score >= 60 ? 'orange' : 'gray'}>
          {score}%
        </Tag>
      ),
    },
    {
      title: '通知渠道',
      key: 'channels',
      width: 200,
      render: (_: unknown, record: StrategyConfig) => (
        <Space>
          <Tooltip content="应用内">
            <Tag
              color={record.notifyInApp ? 'blue' : 'gray'}
              style={{ cursor: 'pointer' }}
              onClick={() => handleStrategyUpdate(record.strategyId, { notifyInApp: !record.notifyInApp })}
            >
              {record.notifyInApp ? <IconCheck /> : <IconClose />} 应用
            </Tag>
          </Tooltip>
          <Tooltip content="推送">
            <Tag
              color={record.notifyPush ? 'green' : 'gray'}
              style={{ cursor: 'pointer' }}
              onClick={() => handleStrategyUpdate(record.strategyId, { notifyPush: !record.notifyPush })}
            >
              {record.notifyPush ? <IconCheck /> : <IconClose />} 推送
            </Tag>
          </Tooltip>
          <Tooltip content="邮件">
            <Tag
              color={record.notifyEmail ? 'orange' : 'gray'}
              style={{ cursor: 'pointer' }}
              onClick={() => handleStrategyUpdate(record.strategyId, { notifyEmail: !record.notifyEmail })}
            >
              {record.notifyEmail ? <IconCheck /> : <IconClose />} 邮件
            </Tag>
          </Tooltip>
        </Space>
      ),
    },
  ];

  if (loading) {
    return (
      <Card>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <Spin size={40} />
        </div>
      </Card>
    );
  }

  return (
    <div className="signal-notification-settings">
      {/* Browser Permission Alert */}
      {browserPermission !== 'granted' && (
        <Alert
          type="warning"
          content={
            <Space>
              <IconNotification />
              <span>浏览器通知未启用</span>
              <Button
                type="primary"
                size="small"
                onClick={requestBrowserPermission}
                disabled={browserPermission === 'denied'}
              >
                {browserPermission === 'denied' ? '已在浏览器中禁用' : '启用通知'}
              </Button>
            </Space>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      <Collapse defaultActiveKey={['global', 'strategies']}>
        {/* Global Settings */}
        <CollapseItem
          header={
            <Space>
              <IconNotification />
              <Text bold>全局通知设置</Text>
            </Space>
          }
          name="global"
        >
          <Form
            form={form}
            layout="vertical"
            onSubmit={handleSaveGlobal}
          >
            <Card bordered={false}>
              {/* Master Toggle */}
              <FormItem
                label={
                  <Space>
                    <Text bold>启用信号通知</Text>
                    <Tooltip content="关闭后将停止所有策略信号通知">
                      <IconInfoCircle style={{ color: 'var(--color-text-3)' }} />
                    </Tooltip>
                  </Space>
                }
                field="pushEnabled"
                triggerPropName="checked"
              >
                <Switch />
              </FormItem>

              <Divider />

              {/* Push Frequency */}
              <FormItem label="推送频率" field="frequency">
                <Select style={{ width: 200 }}>
                  <Select.Option value="realtime">
                    <Space>
                      <IconBulb />
                      实时推送
                    </Space>
                  </Select.Option>
                  <Select.Option value="batch_1m">每分钟汇总</Select.Option>
                  <Select.Option value="batch_5m">每5分钟汇总</Select.Option>
                  <Select.Option value="batch_15m">每15分钟汇总</Select.Option>
                </Select>
              </FormItem>

              {/* Notification Channels */}
              <Title heading={6}>通知渠道</Title>
              <FormItem label="浏览器推送" field="browserNotify" triggerPropName="checked">
                <Switch />
              </FormItem>
              <FormItem label="应用内通知" field="inAppNotify" triggerPropName="checked">
                <Switch />
              </FormItem>
              <FormItem label="声音提醒" field="soundEnabled" triggerPropName="checked">
                <Switch />
              </FormItem>

              <Divider />

              {/* Filters */}
              <Title heading={6}>信号过滤</Title>
              <FormItem label="最低置信度" field="minConfidenceScore">
                <Slider
                  style={{ width: 300 }}
                  min={0}
                  max={100}
                  marks={{ 0: '0%', 50: '50%', 80: '80%', 100: '100%' }}
                  formatTooltip={(value) => `${value}%`}
                />
              </FormItem>

              <FormItem label="风险等级" field="riskLevels">
                <Select mode="multiple" style={{ width: 300 }}>
                  <Select.Option value="low">低风险</Select.Option>
                  <Select.Option value="medium">中等风险</Select.Option>
                  <Select.Option value="high">高风险</Select.Option>
                  <Select.Option value="very_high">极高风险</Select.Option>
                </Select>
              </FormItem>

              <Divider />

              {/* Quiet Hours */}
              <Title heading={6}>
                <Space>
                  <IconMoon />
                  安静时段
                </Space>
              </Title>
              <Paragraph type="secondary">
                在安静时段内，将暂停推送通知（应用内通知不受影响）
              </Paragraph>

              <FormItem label="启用安静时段" field="quietHoursEnabled" triggerPropName="checked">
                <Switch />
              </FormItem>

              <Form.Item shouldUpdate noStyle>
                {(fields) => {
                  const quietHoursEnabled = fields.quietHoursEnabled;
                  return quietHoursEnabled ? (
                    <Space size="large">
                      <FormItem label="开始时间" field="quietHoursStart">
                        <InputNumber
                          style={{ width: 100 }}
                          min={0}
                          max={23}
                          formatter={(value) => `${value}:00`}
                          parser={(value) => value?.replace(':00', '') || '0'}
                        />
                      </FormItem>
                      <FormItem label="结束时间" field="quietHoursEnd">
                        <InputNumber
                          style={{ width: 100 }}
                          min={0}
                          max={23}
                          formatter={(value) => `${value}:00`}
                          parser={(value) => value?.replace(':00', '') || '0'}
                        />
                      </FormItem>
                    </Space>
                  ) : null;
                }}
              </Form.Item>

              <Divider />

              <FormItem>
                <Button type="primary" htmlType="submit" loading={saving}>
                  保存全局设置
                </Button>
              </FormItem>
            </Card>
          </Form>
        </CollapseItem>

        {/* Per-Strategy Settings */}
        <CollapseItem
          header={
            <Space>
              <IconTrendingUp />
              <Text bold>策略通知配置</Text>
              <Tag color="blue">{strategyConfigs.length} 个策略</Tag>
            </Space>
          }
          name="strategies"
        >
          <Card bordered={false}>
            <Paragraph type="secondary" style={{ marginBottom: 16 }}>
              为每个策略单独配置通知偏好。未配置的策略将使用全局设置。
            </Paragraph>

            <Table
              columns={strategyColumns}
              data={strategyConfigs}
              rowKey="id"
              pagination={false}
              border={{
                wrapper: true,
                cell: true,
              }}
            />
          </Card>
        </CollapseItem>
      </Collapse>

      {/* Notification Stats */}
      <Card
        title={
          <Space>
            <IconBulb />
            <Text bold>通知统计</Text>
          </Space>
        }
        style={{ marginTop: 16 }}
      >
        <div className="notification-stats">
          <div className="stat-item">
            <Text type="secondary">今日通知</Text>
            <Text bold style={{ fontSize: 24 }}>12</Text>
          </div>
          <div className="stat-item">
            <Text type="secondary">本周通知</Text>
            <Text bold style={{ fontSize: 24 }}>48</Text>
          </div>
          <div className="stat-item">
            <Text type="secondary">信号准确率</Text>
            <Text bold style={{ fontSize: 24, color: 'var(--color-success-6)' }}>76%</Text>
          </div>
          <div className="stat-item">
            <Text type="secondary">平均响应时间</Text>
            <Text bold style={{ fontSize: 24 }}>2.3s</Text>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default SignalNotificationSettings;