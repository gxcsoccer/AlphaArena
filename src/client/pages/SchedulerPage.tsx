import React, { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  Table,
  Tag,
  Space,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Message,
  Drawer,
  InputNumber,
  Spin,
  Empty,
  Switch,
  Tooltip,
  Descriptions,
  Timeline,
  Badge,
  Grid,
} from '@arco-design/web-react';
import {
  IconPlus,
  IconSettings,
  IconDelete,
  IconPlayArrow,
  IconHistory,
  IconClockCircle,
  IconExclamationCircle,
} from '@arco-design/web-react/icon';
import { ErrorBoundary } from '../components/ErrorBoundary';
import SchedulerStatusIndicator from '../components/SchedulerStatusIndicator';
import SchedulerExecutionLog from '../components/SchedulerExecutionLog';

const { Title, Text } = Typography;
const { Row, Col } = Grid;
const FormItem = Form.Item;

interface ScheduleSafetyConfig {
  scheduleId: string;
  maxPositionSize?: number;
  maxPositionPercent?: number;
  maxDailyTrades: number;
  stopLossPercent?: number;
  takeProfitPercent?: number;
  maxConsecutiveFailures: number;
  consecutiveFailures: number;
  isPaused: boolean;
  notifyOnFailure: boolean;
}

interface TradingSchedule {
  id: string;
  userId: string;
  strategyId?: string;
  name: string;
  description?: string;
  cronExpression: string;
  timezone: string;
  scheduleType: 'cron' | 'interval' | 'condition';
  intervalMinutes?: number;
  conditionType?: string;
  conditionParams: Record<string, unknown>;
  params: Record<string, unknown>;
  enabled: boolean;
  lastExecutionAt?: Date;
  lastExecutionResult?: 'success' | 'failed' | 'skipped';
  lastExecutionMessage?: string;
  nextExecutionAt?: Date;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  createdAt: Date;
  updatedAt: Date;
  safetyConfig?: ScheduleSafetyConfig;
}

interface ScheduleExecution {
  id: string;
  scheduleId: string;
  scheduledAt: Date;
  startedAt: Date;
  completedAt?: Date;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'cancelled';
  triggerType: 'scheduled' | 'manual' | 'condition';
  result: Record<string, unknown>;
  errorMessage?: string;
  tradesExecuted: number;
  totalValue?: number;
}

const CRON_PRESETS = [
  { label: 'Every minute', value: '* * * * *' },
  { label: 'Every 5 minutes', value: '*/5 * * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every 6 hours', value: '0 */6 * * *' },
  { label: 'Daily at midnight', value: '0 0 * * *' },
  { label: 'Daily at 9:30 AM', value: '30 9 * * *' },
  { label: 'Every Monday at 9 AM', value: '0 9 * * 1' },
];

const SchedulerPage: React.FC = () => {
  const [schedules, setSchedules] = useState<TradingSchedule[]>([]);
  const [executions, setExecutions] = useState<ScheduleExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [safetyDrawerVisible, setSafetyDrawerVisible] = useState(false);
  const [executionDrawerVisible, setExecutionDrawerVisible] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<TradingSchedule | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [safetyForm] = Form.useForm();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/schedules', {
        headers: {
          'Authorization': 'Bearer ' + token,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch schedules');
      }
      
      const data = await response.json();
      setSchedules(data);
    } catch (error) {
      console.error('Failed to fetch schedules:', error);
      Message.error('Failed to load schedules');
    } finally {
      setLoading(false);
    }
  };

  const fetchExecutions = async (scheduleId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/schedules/' + scheduleId + '/executions?limit=20', {
        headers: {
          'Authorization': 'Bearer ' + token,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch executions');
      }
      
      const data = await response.json();
      setExecutions(data.executions || []);
    } catch (error) {
      console.error('Failed to fetch executions:', error);
      Message.error('Failed to load execution history');
    }
  };

  const handleCreate = async (values: any) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/schedules', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        throw new Error('Failed to create schedule');
      }

      Message.success('Schedule created successfully');
      setCreateModalVisible(false);
      createForm.resetFields();
      fetchSchedules();
    } catch (error) {
      console.error('Failed to create schedule:', error);
      Message.error('Failed to create schedule');
    }
  };

  const handleUpdate = async (values: any) => {
    if (!selectedSchedule) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/schedules/' + selectedSchedule.id, {
        method: 'PUT',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        throw new Error('Failed to update schedule');
      }

      Message.success('Schedule updated successfully');
      setEditModalVisible(false);
      editForm.resetFields();
      fetchSchedules();
    } catch (error) {
      console.error('Failed to update schedule:', error);
      Message.error('Failed to update schedule');
    }
  };

  const handleToggle = async (schedule: TradingSchedule) => {
    try {
      const token = localStorage.getItem('token');
      const endpoint = schedule.enabled ? 'disable' : 'enable';
      const response = await fetch('/api/schedules/' + schedule.id + '/' + endpoint, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to toggle schedule');
      }

      Message.success('Schedule ' + (schedule.enabled ? 'disabled' : 'enabled') + ' successfully');
      fetchSchedules();
    } catch (error) {
      console.error('Failed to toggle schedule:', error);
      Message.error('Failed to toggle schedule');
    }
  };

  const handleDelete = async (scheduleId: string) => {
    Modal.confirm({
      title: 'Confirm Delete',
      content: 'Are you sure you want to delete this schedule?',
      onOk: async () => {
        try {
          const token = localStorage.getItem('token');
          const response = await fetch('/api/schedules/' + scheduleId, {
            method: 'DELETE',
            headers: {
              'Authorization': 'Bearer ' + token,
            },
          });

          if (!response.ok) {
            throw new Error('Failed to delete schedule');
          }

          Message.success('Schedule deleted successfully');
          fetchSchedules();
        } catch (error) {
          console.error('Failed to delete schedule:', error);
          Message.error('Failed to delete schedule');
        }
      },
    });
  };

  const handleExecute = async (scheduleId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/schedules/' + scheduleId + '/execute', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to execute schedule');
      }

      Message.success('Schedule execution triggered');
      fetchSchedules();
    } catch (error) {
      console.error('Failed to execute schedule:', error);
      Message.error('Failed to execute schedule');
    }
  };

  const handleUpdateSafety = async (values: any) => {
    if (!selectedSchedule) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/schedules/' + selectedSchedule.id + '/safety', {
        method: 'PUT',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        throw new Error('Failed to update safety config');
      }

      Message.success('Safety config updated successfully');
      setSafetyDrawerVisible(false);
      fetchSchedules();
    } catch (error) {
      console.error('Failed to update safety config:', error);
      Message.error('Failed to update safety config');
    }
  };

  const handleResetSafety = async () => {
    if (!selectedSchedule) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/schedules/' + selectedSchedule.id + '/safety/reset', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to reset safety config');
      }

      Message.success('Safety config reset successfully');
      fetchSchedules();
    } catch (error) {
      console.error('Failed to reset safety config:', error);
      Message.error('Failed to reset safety config');
    }
  };

  const openEditModal = (schedule: TradingSchedule) => {
    setSelectedSchedule(schedule);
    editForm.setFieldsValue({
      name: schedule.name,
      description: schedule.description,
      cronExpression: schedule.cronExpression,
      timezone: schedule.timezone,
      scheduleType: schedule.scheduleType,
      intervalMinutes: schedule.intervalMinutes,
      enabled: schedule.enabled,
    });
    setEditModalVisible(true);
  };

  const openSafetyDrawer = (schedule: TradingSchedule) => {
    setSelectedSchedule(schedule);
    if (schedule.safetyConfig) {
      safetyForm.setFieldsValue(schedule.safetyConfig);
    }
    setSafetyDrawerVisible(true);
  };

  const openExecutionDrawer = (schedule: TradingSchedule) => {
    setSelectedSchedule(schedule);
    fetchExecutions(schedule.id);
    setExecutionDrawerVisible(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'green';
      case 'failed': return 'red';
      case 'running': return 'blue';
      case 'skipped': return 'orange';
      default: return 'gray';
    }
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: TradingSchedule) => (
        <Space>
          <Text strong>{name}</Text>
          {record.safetyConfig?.isPaused && (
            <Tag color="red">Paused</Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'scheduleType',
      key: 'scheduleType',
      render: (type: string, record: TradingSchedule) => (
        <Space direction="vertical" size="small">
          <Tag color="blue">{type.toUpperCase()}</Tag>
          {type === 'cron' && (
            <Text type="secondary" style={{ fontSize: 12 }}>{record.cronExpression}</Text>
          )}
          {type === 'interval' && (
            <Text type="secondary" style={{ fontSize: 12 }}>Every {record.intervalMinutes} min</Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled: boolean, record: TradingSchedule) => (
        <Space>
          <Switch checked={enabled} onChange={() => handleToggle(record)} />
          <Text>{enabled ? 'Enabled' : 'Disabled'}</Text>
        </Space>
      ),
    },
    {
      title: 'Next Run',
      dataIndex: 'nextExecutionAt',
      key: 'nextExecutionAt',
      render: (date: Date) => (
        date ? new Date(date).toLocaleString() : '-'
      ),
    },
    {
      title: 'Stats',
      key: 'stats',
      render: (_: any, record: TradingSchedule) => (
        <Space direction="vertical" size="small">
          <Text type="secondary">
            Total: {record.totalExecutions} | 
            <Text type="success"> OK:{record.successfulExecutions}</Text> | 
            <Text type="error"> ERR:{record.failedExecutions}</Text>
          </Text>
          {record.lastExecutionResult && (
            <Tag color={getStatusColor(record.lastExecutionResult)}>
              Last: {record.lastExecutionResult}
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: TradingSchedule) => (
        <Space>
          <Tooltip content="Execute Now">
            <Button 
              icon={<IconPlayArrow />} 
              size="small"
              onClick={() => handleExecute(record.id)}
            />
          </Tooltip>
          <Tooltip content="History">
            <Button 
              icon={<IconHistory />} 
              size="small"
              onClick={() => openExecutionDrawer(record)}
            />
          </Tooltip>
          <Tooltip content="Safety Config">
            <Button 
              icon={<IconSettings />} 
              size="small"
              onClick={() => openSafetyDrawer(record)}
            />
          </Tooltip>
          <Tooltip content="Edit">
            <Button 
              icon={<IconClockCircle />} 
              size="small"
              onClick={() => openEditModal(record)}
            />
          </Tooltip>
          <Tooltip content="Delete">
            <Button 
              icon={<IconDelete />} 
              size="small"
              status="danger"
              onClick={() => handleDelete(record.id)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <ErrorBoundary>
      <div style={{ padding: isMobile ? '16px' : '24px' }}>
        {/* Real-time Status Indicator */}
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <SchedulerStatusIndicator 
              userId={(() => {
                try {
                  const token = localStorage.getItem('token');
                  if (token) {
                    const payload = JSON.parse(atob(token.split('.')[1]));
                    return payload.sub || payload.user_id;
                  }
                } catch {
                  return undefined;
                }
                return undefined;
              })()} 
            />
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          {/* Execution Log - Left Side */}
          <Col xs={24} lg={8}>
            <SchedulerExecutionLog 
              userId={(() => {
                try {
                  const token = localStorage.getItem('token');
                  if (token) {
                    const payload = JSON.parse(atob(token.split('.')[1]));
                    return payload.sub || payload.user_id;
                  }
                } catch {
                  return undefined;
                }
                return undefined;
              })()}
              maxEvents={15}
            />
          </Col>

          {/* Schedules Table - Right Side */}
          <Col xs={24} lg={16}>
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Title heading={4} style={{ margin: 0 }}>Trading Schedules</Title>
                <Button 
                  type="primary" 
                  icon={<IconPlus />}
                  onClick={() => setCreateModalVisible(true)}
                >
                  Create Schedule
                </Button>
              </div>

              <Spin loading={loading} style={{ display: 'block' }}>
                {schedules.length === 0 ? (
                  <Empty description="No schedules configured" />
                ) : (
                  <Table 
                    columns={columns} 
                    data={schedules}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                  />
                )}
              </Spin>
            </Card>
          </Col>
        </Row>

        {/* Create Modal */}
        <Modal
          title="Create Schedule"
          visible={createModalVisible}
          onCancel={() => setCreateModalVisible(false)}
          footer={null}
          style={{ width: 600 }}
        >
          <Form form={createForm} layout="vertical" onSubmit={handleCreate}>
            <FormItem label="Name" field="name" rules={[{ required: true }]}>
              <Input placeholder="My trading schedule" />
            </FormItem>

            <FormItem label="Description" field="description">
              <Input.TextArea placeholder="Description..." />
            </FormItem>

            <FormItem label="Schedule Type" field="scheduleType" initialValue="cron">
              <Select>
                <Select.Option value="cron">Cron Expression</Select.Option>
                <Select.Option value="interval">Interval (minutes)</Select.Option>
              </Select>
            </FormItem>

            <FormItem shouldUpdate>
              {(values) => {
                if (values.scheduleType === 'interval') {
                  return (
                    <FormItem label="Interval (minutes)" field="intervalMinutes" rules={[{ required: true }]}>
                      <InputNumber min={1} placeholder="60" />
                    </FormItem>
                  );
                }
                return (
                  <>
                    <FormItem label="Cron Preset" field="cronPreset">
                      <Select placeholder="Select a preset or enter custom cron" allowClear>
                        {CRON_PRESETS.map(preset => (
                          <Select.Option key={preset.value} value={preset.value}>
                            {preset.label}
                          </Select.Option>
                        ))}
                      </Select>
                    </FormItem>
                    <FormItem label="Cron Expression" field="cronExpression" rules={[{ required: true }]}>
                      <Input placeholder="* * * * *" />
                    </FormItem>
                  </>
                );
              }}
            </FormItem>

            <FormItem label="Timezone" field="timezone" initialValue="UTC">
              <Select>
                <Select.Option value="UTC">UTC</Select.Option>
                <Select.Option value="America/New_York">America/New_York</Select.Option>
                <Select.Option value="Asia/Shanghai">Asia/Shanghai</Select.Option>
                <Select.Option value="Europe/London">Europe/London</Select.Option>
              </Select>
            </FormItem>

            <FormItem label="Enabled" field="enabled" initialValue={true} triggerPropName="checked">
              <Switch />
            </FormItem>

            <FormItem>
              <Space>
                <Button type="primary" htmlType="submit">Create</Button>
                <Button onClick={() => setCreateModalVisible(false)}>Cancel</Button>
              </Space>
            </FormItem>
          </Form>
        </Modal>

        {/* Edit Modal */}
        <Modal
          title="Edit Schedule"
          visible={editModalVisible}
          onCancel={() => setEditModalVisible(false)}
          footer={null}
          style={{ width: 600 }}
        >
          <Form form={editForm} layout="vertical" onSubmit={handleUpdate}>
            <FormItem label="Name" field="name" rules={[{ required: true }]}>
              <Input placeholder="My trading schedule" />
            </FormItem>

            <FormItem label="Description" field="description">
              <Input.TextArea placeholder="Description..." />
            </FormItem>

            <FormItem label="Schedule Type" field="scheduleType">
              <Select>
                <Select.Option value="cron">Cron Expression</Select.Option>
                <Select.Option value="interval">Interval (minutes)</Select.Option>
              </Select>
            </FormItem>

            <FormItem shouldUpdate>
              {(values) => {
                if (values.scheduleType === 'interval') {
                  return (
                    <FormItem label="Interval (minutes)" field="intervalMinutes">
                      <InputNumber min={1} placeholder="60" />
                    </FormItem>
                  );
                }
                return (
                  <FormItem label="Cron Expression" field="cronExpression">
                    <Input placeholder="* * * * *" />
                  </FormItem>
                );
              }}
            </FormItem>

            <FormItem label="Timezone" field="timezone">
              <Select>
                <Select.Option value="UTC">UTC</Select.Option>
                <Select.Option value="America/New_York">America/New_York</Select.Option>
                <Select.Option value="Asia/Shanghai">Asia/Shanghai</Select.Option>
                <Select.Option value="Europe/London">Europe/London</Select.Option>
              </Select>
            </FormItem>

            <FormItem>
              <Space>
                <Button type="primary" htmlType="submit">Save</Button>
                <Button onClick={() => setEditModalVisible(false)}>Cancel</Button>
              </Space>
            </FormItem>
          </Form>
        </Modal>

        {/* Safety Config Drawer */}
        <Drawer
          title="Safety Configuration"
          width={500}
          visible={safetyDrawerVisible}
          onCancel={() => setSafetyDrawerVisible(false)}
          footer={
            <Space>
              <Button type="primary" onClick={() => safetyForm.submit()}>Save</Button>
              {selectedSchedule?.safetyConfig?.isPaused && (
                <Button onClick={handleResetSafety}>Reset Pause</Button>
              )}
              <Button onClick={() => setSafetyDrawerVisible(false)}>Cancel</Button>
            </Space>
          }
        >
          {selectedSchedule?.safetyConfig?.isPaused && (
            <Card style={{ marginBottom: 16, backgroundColor: '#fff7e6' }}>
              <Space>
                <IconExclamationCircle style={{ color: '#faad14' }} />
                <Text>This schedule is paused due to consecutive failures</Text>
              </Space>
            </Card>
          )}
          
          <Form form={safetyForm} layout="vertical" onSubmit={handleUpdateSafety}>
            <Title heading={5}>Position Limits</Title>
            
            <FormItem label="Max Position Size" field="maxPositionSize">
              <InputNumber min={0} placeholder="No limit" />
            </FormItem>

            <FormItem label="Max Position % of Portfolio" field="maxPositionPercent">
              <InputNumber min={0} max={100} placeholder="No limit" />
            </FormItem>

            <Title heading={5}>Trade Limits</Title>

            <FormItem label="Max Daily Trades" field="maxDailyTrades" initialValue={10}>
              <InputNumber min={1} />
            </FormItem>

            <FormItem label="Max Daily Value" field="maxDailyValue">
              <InputNumber min={0} placeholder="No limit" />
            </FormItem>

            <Title heading={5}>Risk Management</Title>

            <FormItem label="Stop Loss %" field="stopLossPercent">
              <InputNumber min={0} max={100} placeholder="No stop loss" />
            </FormItem>

            <FormItem label="Take Profit %" field="takeProfitPercent">
              <InputNumber min={0} max={100} placeholder="No take profit" />
            </FormItem>

            <Title heading={5}>Circuit Breaker</Title>

            <FormItem label="Max Consecutive Failures" field="maxConsecutiveFailures" initialValue={3}>
              <InputNumber min={1} />
            </FormItem>

            <FormItem label="Notify on Failure" field="notifyOnFailure" initialValue={true} triggerPropName="checked">
              <Switch />
            </FormItem>
          </Form>
        </Drawer>

        {/* Execution History Drawer */}
        <Drawer
          title="Execution History"
          width={600}
          visible={executionDrawerVisible}
          onCancel={() => setExecutionDrawerVisible(false)}
        >
          <Timeline>
            {executions.map(execution => (
              <Timeline.Item
                key={execution.id}
                dot={
                  <Badge 
                    status={execution.status === 'success' ? 'success' : execution.status === 'failed' ? 'error' : 'processing'} 
                  />
                }
              >
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Status">
                    <Tag color={getStatusColor(execution.status)}>{execution.status}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Time">
                    {new Date(execution.startedAt).toLocaleString()}
                  </Descriptions.Item>
                  <Descriptions.Item label="Trigger">
                    {execution.triggerType}
                  </Descriptions.Item>
                  {execution.tradesExecuted > 0 && (
                    <Descriptions.Item label="Trades">
                      {execution.tradesExecuted}
                    </Descriptions.Item>
                  )}
                  {execution.errorMessage && (
                    <Descriptions.Item label="Error">
                      <Text type="error">{execution.errorMessage}</Text>
                    </Descriptions.Item>
                  )}
                </Descriptions>
              </Timeline.Item>
            ))}
          </Timeline>

          {executions.length === 0 && (
            <Empty description="No execution history" />
          )}
        </Drawer>
      </div>
    </ErrorBoundary>
  );
};

export default SchedulerPage;
