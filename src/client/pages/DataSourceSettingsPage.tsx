/**
 * Data Source Settings Page
 *
 * UI for managing data source configurations:
 * - Select active data source (Mock / Alpaca / Twelve Data)
 * - Configure API keys for each provider
 * - View connection status
 *
 * Issue #361: 数据源切换 UI
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  Radio,
  Input,
  Button,
  Space,
  Typography,
  Divider,
  Message,
  Tag,
  Spin,
  Switch,
  Form,
  Grid,
  Alert,
  Descriptions,
} from '@arco-design/web-react';
import {
  IconCheck,
  IconClose,
  IconLoading,
  IconSettings,
  IconExclamationCircle,
} from '@arco-design/web-react/icon';
import { useAuth } from '../hooks/useAuth';
import './DataSourceSettingsPage.css';

const { Title, Text } = Typography;
const { Row, Col } = Grid;
const FormItem = Form.Item;

interface DataSourceSettings {
  activeProvider: string;
  alpacaApiKey?: string;
  alpacaApiSecret?: string;
  alpacaTestnet: boolean;
  twelvedataApiKey?: string;
  mockEnabled: boolean;
}

interface ProviderStatus {
  providerId: string;
  status: 'connected' | 'disconnected' | 'error' | 'connecting';
  lastConnected?: Date;
  errorMessage?: string;
  apiCallCount?: number;
}

interface StatusResponse {
  activeProvider: string;
  providers: Record<string, ProviderStatus>;
}

const DataSourceSettingsPage: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [settings, setSettings] = useState<DataSourceSettings>({
    activeProvider: 'mock',
    alpacaTestnet: true,
    mockEnabled: true,
  });
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [alpacaForm] = Form.useForm();
  const [twelvedataForm] = Form.useForm();

  // Fetch current settings and status
  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      // Fetch settings
      const settingsRes = await fetch('/api/data-source/settings', { headers });
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setSettings(data.settings);
      }

      // Fetch status
      const statusRes = await fetch('/api/data-source/status', { headers });
      if (statusRes.ok) {
        const data = await statusRes.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Error fetching data source settings:', error);
      Message.error('获取数据源设置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  // Handle provider change
  const handleProviderChange = async (providerId: string) => {
    if (providerId === settings.activeProvider) return;

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/data-source/provider', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ providerId }),
      });

      const data = await res.json();
      if (res.ok) {
        Message.success(`已切换到 ${getProviderName(providerId)} 数据源`);
        setSettings(prev => ({ ...prev, activeProvider: providerId }));
        await fetchData(); // Refresh status
      } else {
        Message.error(data.error || '切换数据源失败');
      }
    } catch (_error) {
      Message.error('切换数据源失败');
    } finally {
      setSaving(false);
    }
  };

  // Save Alpaca credentials
  const saveAlpacaCredentials = async () => {
    const values = await alpacaForm.validate();
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/data-source/credentials/alpaca', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey: values.apiKey,
          apiSecret: values.apiSecret,
          testnet: values.testnet,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        Message.success('Alpaca 凭证已保存');
        await fetchData();
      } else {
        Message.error(data.error || '保存失败');
      }
    } catch (_error) {
      Message.error('保存凭证失败');
    } finally {
      setSaving(false);
    }
  };

  // Save Twelve Data credentials
  const saveTwelveDataCredentials = async () => {
    const values = await twelvedataForm.validate();
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/data-source/credentials/twelvedata', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey: values.apiKey,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        Message.success('Twelve Data 凭证已保存');
        await fetchData();
      } else {
        Message.error(data.error || '保存失败');
      }
    } catch (_error) {
      Message.error('保存凭证失败');
    } finally {
      setSaving(false);
    }
  };

  // Test connection
  const testConnection = async (providerId: string) => {
    setTesting(providerId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/data-source/test-connection', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ providerId }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        Message.success(`${getProviderName(providerId)} 连接测试成功`);
      } else {
        Message.error(data.error || '连接测试失败');
      }
    } catch (_error) {
      Message.error('连接测试失败');
    } finally {
      setTesting(null);
    }
  };

  // Clear credentials
  const clearCredentials = async (providerId: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/data-source/credentials/${providerId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (res.ok) {
        Message.success('凭证已清除');
        await fetchData();
        if (providerId === 'alpaca') {
          alpacaForm.resetFields();
        } else if (providerId === 'twelvedata') {
          twelvedataForm.resetFields();
        }
      }
    } catch (_error) {
      Message.error('清除凭证失败');
    }
  };

  // Get provider display name
  const getProviderName = (providerId: string): string => {
    const names: Record<string, string> = {
      mock: 'Mock 数据',
      alpaca: 'Alpaca',
      twelvedata: 'Twelve Data',
    };
    return names[providerId] || providerId;
  };

  // Get status tag
  const getStatusTag = (providerStatus?: ProviderStatus) => {
    if (!providerStatus) return <Tag color="gray">未知</Tag>;

    switch (providerStatus.status) {
      case 'connected':
        return (
          <Tag color="green" icon={<IconCheck />}>
            已连接
          </Tag>
        );
      case 'connecting':
        return (
          <Tag color="blue" icon={<IconLoading />}>
            连接中
          </Tag>
        );
      case 'error':
        return (
          <Tag color="red" icon={<IconExclamationCircle />}>
            错误
          </Tag>
        );
      case 'disconnected':
      default:
        return (
          <Tag color="gray" icon={<IconClose />}>
            未连接
          </Tag>
        );
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <Spin size={32} />
        <Text>加载中...</Text>
      </div>
    );
  }

  return (
    <div className="data-source-settings-page">
      <Title heading={4}>
        <IconSettings style={{ marginRight: 8 }} />
        数据源设置
      </Title>
      <Text type="secondary">配置和切换不同的市场数据源</Text>

      <Divider />

      {/* Current Status */}
      <Card title="当前状态" style={{ marginBottom: 20 }}>
        <Descriptions column={3} border>
          <Descriptions.Item label="活跃数据源">
            <Tag color="blue">{getProviderName(settings.activeProvider)}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="连接状态">
            {getStatusTag(status?.providers[settings.activeProvider])}
          </Descriptions.Item>
          <Descriptions.Item label="数据源数量">
            {Object.keys(status?.providers || {}).length} 个已配置
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Provider Selection */}
      <Card title="选择数据源" style={{ marginBottom: 20 }}>
        <Alert
          type="info"
          content="不同数据源提供不同的市场数据覆盖范围。Mock 数据适用于测试，Alpaca 提供美股实时数据，Twelve Data 提供全球市场数据。"
          style={{ marginBottom: 16 }}
        />

        <Radio.Group
          value={settings.activeProvider}
          onChange={handleProviderChange}
          style={{ width: '100%' }}
        >
          <Row gutter={[16, 16]}>
            {/* Mock Provider */}
            <Col span={8}>
              <Radio value="mock" style={{ width: '100%' }}>
                <Card
                  hoverable
                  className={`provider-card ${settings.activeProvider === 'mock' ? 'active' : ''}`}
                >
                  <div className="provider-header">
                    <Text bold>Mock 数据</Text>
                    {getStatusTag(status?.providers.mock)}
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    模拟数据，适用于开发和测试
                  </Text>
                </Card>
              </Radio>
            </Col>

            {/* Alpaca Provider */}
            <Col span={8}>
              <Radio value="alpaca" style={{ width: '100%' }}>
                <Card
                  hoverable
                  className={`provider-card ${settings.activeProvider === 'alpaca' ? 'active' : ''}`}
                >
                  <div className="provider-header">
                    <Text bold>Alpaca</Text>
                    {getStatusTag(status?.providers.alpaca)}
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    美股实时数据，需要 API Key
                  </Text>
                </Card>
              </Radio>
            </Col>

            {/* Twelve Data Provider */}
            <Col span={8}>
              <Radio value="twelvedata" style={{ width: '100%' }}>
                <Card
                  hoverable
                  className={`provider-card ${settings.activeProvider === 'twelvedata' ? 'active' : ''}`}
                >
                  <div className="provider-header">
                    <Text bold>Twelve Data</Text>
                    {getStatusTag(status?.providers.twelvedata)}
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    全球市场数据，需要 API Key
                  </Text>
                </Card>
              </Radio>
            </Col>
          </Row>
        </Radio.Group>
      </Card>

      {/* Alpaca Configuration */}
      <Card title="Alpaca 配置" style={{ marginBottom: 20 }}>
        <Alert
          type="warning"
          content="Alpaca API Key 可以在 Alpaca 控制台获取。建议使用 Paper Trading 账户进行测试。"
          style={{ marginBottom: 16 }}
        />

        <Form form={alpacaForm} layout="vertical" autoComplete="off">
          <Row gutter={16}>
            <Col span={12}>
              <FormItem
                label="API Key"
                field="apiKey"
                rules={[{ required: true, message: '请输入 API Key' }]}
              >
                <Input.Password
                  placeholder={settings.alpacaApiKey || '请输入 Alpaca API Key'}
                  autoComplete="new-password"
                />
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem
                label="API Secret"
                field="apiSecret"
                rules={[{ required: true, message: '请输入 API Secret' }]}
              >
                <Input.Password
                  placeholder={settings.alpacaApiSecret ? '已配置' : '请输入 Alpaca API Secret'}
                  autoComplete="new-password"
                />
              </FormItem>
            </Col>
          </Row>

          <FormItem label="使用测试网络" field="testnet" triggerPropName="checked">
            <Switch defaultChecked={settings.alpacaTestnet} />
          </FormItem>

          <Space>
            <Button
              type="primary"
              onClick={saveAlpacaCredentials}
              loading={saving}
            >
              保存凭证
            </Button>
            <Button
              onClick={() => testConnection('alpaca')}
              loading={testing === 'alpaca'}
            >
              测试连接
            </Button>
            {settings.alpacaApiKey && (
              <Button
                type="outline"
                status="danger"
                onClick={() => clearCredentials('alpaca')}
              >
                清除凭证
              </Button>
            )}
          </Space>
        </Form>
      </Card>

      {/* Twelve Data Configuration */}
      <Card title="Twelve Data 配置" style={{ marginBottom: 20 }}>
        <Alert
          type="info"
          content="Twelve Data 提供免费和付费计划。免费计划有 API 调用限制。"
          style={{ marginBottom: 16 }}
        />

        <Form form={twelvedataForm} layout="vertical" autoComplete="off">
          <FormItem
            label="API Key"
            field="apiKey"
            rules={[{ required: true, message: '请输入 API Key' }]}
          >
            <Input.Password
              placeholder={settings.twelvedataApiKey || '请输入 Twelve Data API Key'}
              autoComplete="new-password"
            />
          </FormItem>

          <Space>
            <Button
              type="primary"
              onClick={saveTwelveDataCredentials}
              loading={saving}
            >
              保存凭证
            </Button>
            <Button
              onClick={() => testConnection('twelvedata')}
              loading={testing === 'twelvedata'}
            >
              测试连接
            </Button>
            {settings.twelvedataApiKey && (
              <Button
                type="outline"
                status="danger"
                onClick={() => clearCredentials('twelvedata')}
              >
                清除凭证
              </Button>
            )}
          </Space>
        </Form>
      </Card>

      {/* Environment Variables Info */}
      <Card title="环境变量支持">
        <Text type="secondary">
          除了在页面配置，您也可以通过环境变量配置 API Key：
        </Text>
        <div style={{ marginTop: 12, fontFamily: 'monospace', fontSize: 12 }}>
          <div>ALPACA_API_KEY=your_key</div>
          <div>ALPACA_API_SECRET=your_secret</div>
          <div>TWELVE_DATA_API_KEY=your_key</div>
        </div>
        <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
          环境变量配置的凭证优先级高于页面配置。
        </Text>
      </Card>
    </div>
  );
};

export default DataSourceSettingsPage;