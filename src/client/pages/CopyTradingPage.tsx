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
  Tabs,
  Statistic,
  Grid,

  Message,
  Drawer,
  InputNumber,
  Spin,
  Empty,
} from '@arco-design/web-react';
import {
  IconUserAdd,
  IconUser,
  IconSettings,
  IconDelete,
  IconPause,
  IconPlayArrow,
} from '@arco-design/web-react/icon';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { api, Follower, CopyTrade, FollowerSettings, FollowerStatsRecord } from '../utils/api';

const { Title, Text } = Typography;
const { Row, Col } = Grid;
const { TabPane } = Tabs;

const CURRENT_USER_ID = 'user_demo_001';

interface FollowFormValues {
  leaderUserId: string;
  copyMode: 'proportional' | 'fixed' | 'mirror';
  copyRatio: number;
  fixedAmount?: number;
  maxCopyAmount?: number;
  stopLossPct?: number;
  takeProfitPct?: number;
  maxDailyTrades: number;
  maxDailyVolume?: number;
}

const CopyTradingPage: React.FC = () => {
  const [following, setFollowing] = useState<Follower[]>([]);
  const [copyTrades, setCopyTrades] = useState<CopyTrade[]>([]);
  const [leaderboard, setLeaderboard] = useState<FollowerStatsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [followModalVisible, setFollowModalVisible] = useState(false);
  const [settingsDrawerVisible, setSettingsDrawerVisible] = useState(false);
  const [selectedFollower, setSelectedFollower] = useState<Follower | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [followForm] = Form.useForm();
  const [settingsForm] = Form.useForm();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [followingData, tradesData, leaderboardData] = await Promise.all([
        api.getFollowing(CURRENT_USER_ID),
        api.getCopyTrades({ followerUserId: CURRENT_USER_ID, limit: 50 }),
        api.getCopyTradingLeaderboard('monthly', 10),
      ]);

      setFollowing(followingData);
      setCopyTrades(tradesData);
      setLeaderboard(leaderboardData);
    } catch (error) {
      console.error('Failed to fetch copy trading data:', error);
      Message.error('Failed to load copy trading data');
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async (values: FollowFormValues) => {
    try {
      const settings: Partial<FollowerSettings> = {
        copyMode: values.copyMode,
        copyRatio: values.copyRatio,
        fixedAmount: values.fixedAmount,
        maxCopyAmount: values.maxCopyAmount,
        stopLossPct: values.stopLossPct,
        takeProfitPct: values.takeProfitPct,
        maxDailyTrades: values.maxDailyTrades,
        maxDailyVolume: values.maxDailyVolume,
      };

      const result = await api.followTrader(CURRENT_USER_ID, values.leaderUserId, settings);

      if (result) {
        Message.success(`Started following ${values.leaderUserId}`);
        setFollowModalVisible(false);
        followForm.resetFields();
        fetchData();
      }
    } catch (error: any) {
      Message.error(error.message || 'Failed to follow trader');
    }
  };

  const handleUnfollow = async (followerId: string) => {
    Modal.confirm({
      title: 'Confirm Unfollow',
      content: 'Are you sure you want to stop copying this trader?',
      onOk: async () => {
        try {
          const success = await api.unfollowTrader(followerId);
          if (success) {
            Message.success('Successfully unfollowed');
            fetchData();
          }
        } catch (error) {
          Message.error('Failed to unfollow');
        }
      },
    });
  };

  const handleTogglePause = async (follower: Follower) => {
    try {
      const result = follower.status === 'active'
        ? await api.pauseFollowing(follower.id)
        : await api.resumeFollowing(follower.id);

      if (result) {
        Message.success(follower.status === 'active' ? 'Paused following' : 'Resumed following');
        fetchData();
      }
    } catch (error) {
      Message.error('Failed to update status');
    }
  };

  const handleOpenSettings = (follower: Follower) => {
    setSelectedFollower(follower);
    settingsForm.setFieldsValue({
      copyMode: follower.settings.copyMode,
      copyRatio: follower.settings.copyRatio,
      fixedAmount: follower.settings.fixedAmount,
      maxCopyAmount: follower.settings.maxCopyAmount,
      stopLossPct: follower.settings.stopLossPct,
      takeProfitPct: follower.settings.takeProfitPct,
      maxDailyTrades: follower.settings.maxDailyTrades,
      maxDailyVolume: follower.settings.maxDailyVolume,
    });
    setSettingsDrawerVisible(true);
  };

  const handleUpdateSettings = async (values: any) => {
    if (!selectedFollower) return;

    try {
      const result = await api.updateFollowerSettings(selectedFollower.id, {
        settings: {
          copyMode: values.copyMode,
          copyRatio: values.copyRatio,
          fixedAmount: values.fixedAmount,
          maxCopyAmount: values.maxCopyAmount,
          stopLossPct: values.stopLossPct,
          takeProfitPct: values.takeProfitPct,
          maxDailyTrades: values.maxDailyTrades,
          maxDailyVolume: values.maxDailyVolume,
        },
      });

      if (result) {
        Message.success('Settings updated');
        setSettingsDrawerVisible(false);
        fetchData();
      }
    } catch (error) {
      Message.error('Failed to update settings');
    }
  };

  const totalStats = following.reduce(
    (acc, f) => ({
      totalCopiedTrades: acc.totalCopiedTrades + f.stats.totalCopiedTrades,
      totalCopiedVolume: acc.totalCopiedVolume + f.stats.totalCopiedVolume,
      totalPnl: acc.totalPnl + f.stats.totalPnl,
    }),
    { totalCopiedTrades: 0, totalCopiedVolume: 0, totalPnl: 0 }
  );

  const followingColumns = [
    {
      title: 'Leader',
      dataIndex: 'leaderUserId',
      key: 'leaderUserId',
      render: (userId: string) => (
        <Space>
          <IconUser />
          <Text>{userId}</Text>
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          active: 'green',
          paused: 'orange',
          cancelled: 'red',
        };
        return <Tag color={colorMap[status] || 'gray'}>{status.toUpperCase()}</Tag>;
      },
    },
    {
      title: 'Copy Mode',
      dataIndex: 'settings',
      key: 'copyMode',
      render: (settings: FollowerSettings) => (
        <Text>
          {settings.copyMode === 'proportional' && `${settings.copyRatio * 100}% proportional`}
          {settings.copyMode === 'fixed' && `$${settings.fixedAmount} fixed`}
          {settings.copyMode === 'mirror' && 'Mirror'}
        </Text>
      ),
    },
    {
      title: 'Trades',
      dataIndex: 'stats',
      key: 'trades',
      render: (stats: any) => <Text>{stats.totalCopiedTrades}</Text>,
    },
    {
      title: 'PnL',
      dataIndex: 'stats',
      key: 'pnl',
      render: (stats: any) => (
        <Text style={{ color: stats.totalPnl >= 0 ? 'rgb(var(--success-6))' : 'rgb(var(--danger-6))' }}>
          {stats.totalPnl >= 0 ? '+' : ''}{stats.totalPnl.toFixed(2)} USDT
        </Text>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Follower) => (
        <Space>
          <Button
            size="small"
            icon={record.status === 'active' ? <IconPause /> : <IconPlayArrow />}
            onClick={() => handleTogglePause(record)}
          />
          <Button
            size="small"
            icon={<IconSettings />}
            onClick={() => handleOpenSettings(record)}
          />
          <Button
            size="small"
            icon={<IconDelete />}
            status="danger"
            onClick={() => handleUnfollow(record.id)}
          />
        </Space>
      ),
    },
  ];

  const tradesColumns = [
    {
      title: 'Time',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: 'Symbol',
      dataIndex: 'symbol',
      key: 'symbol',
    },
    {
      title: 'Side',
      dataIndex: 'side',
      key: 'side',
      render: (side: string) => (
        <Tag color={side === 'buy' ? 'green' : 'red'}>
          {side.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Original Qty',
      dataIndex: 'originalQuantity',
      key: 'originalQuantity',
      render: (qty: number) => qty.toFixed(4),
    },
    {
      title: 'Copied Qty',
      dataIndex: 'copiedQuantity',
      key: 'copiedQuantity',
      render: (qty: number) => qty.toFixed(4),
    },
    {
      title: 'Price',
      dataIndex: 'copiedPrice',
      key: 'price',
      render: (price?: number) => price ? price.toFixed(2) : '-',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          pending: 'blue',
          executing: 'orange',
          filled: 'green',
          partial: 'cyan',
          failed: 'red',
          cancelled: 'gray',
        };
        return <Tag color={colorMap[status] || 'gray'}>{status.toUpperCase()}</Tag>;
      },
    },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Spin size={40} />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div style={{ padding: isMobile ? '12px' : '24px' }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title heading={4} style={{ margin: 0 }}>
              Copy Trading
            </Title>
            <Button
              type="primary"
              icon={<IconUserAdd />}
              onClick={() => setFollowModalVisible(true)}
            >
              Follow Trader
            </Button>
          </div>

          <Card>
            <Row gutter={[16, 16]}>
              <Col xs={12} sm={6}>
                <Statistic
                  title="Following"
                  value={following.filter(f => f.status === 'active').length}
                  suffix="traders"
                />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic
                  title="Total Trades"
                  value={totalStats.totalCopiedTrades}
                />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic
                  title="Total Volume"
                  value={totalStats.totalCopiedVolume.toFixed(2)}
                  prefix="$"
                />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic
                  title="Total PnL"
                  value={totalStats.totalPnl.toFixed(2)}
                  prefix="$"
                  style={{
                    color: totalStats.totalPnl >= 0 ? 'rgb(var(--success-6))' : 'rgb(var(--danger-6))',
                  }}
                />
              </Col>
            </Row>
          </Card>

          <Card>
            <Tabs defaultActiveTab="following">
              <TabPane key="following" tab="Following">
                {following.length === 0 ? (
                  <Empty description="Not following any traders yet" />
                ) : (
                  <Table
                    columns={followingColumns}
                    data={following}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: 'max-content' }}
                  />
                )}
              </TabPane>

              <TabPane key="trades" tab="Copy Trades">
                {copyTrades.length === 0 ? (
                  <Empty description="No copy trades yet" />
                ) : (
                  <Table
                    columns={tradesColumns}
                    data={copyTrades}
                    rowKey="id"
                    pagination={{ pageSize: 20 }}
                    scroll={{ x: 'max-content' }}
                  />
                )}
              </TabPane>

              <TabPane key="leaderboard" tab="Top Followers">
                {leaderboard.length === 0 ? (
                  <Empty description="No leaderboard data available" />
                ) : (
                  <Table
                    columns={[
                      {
                        title: 'Rank',
                        key: 'rank',
                        render: (_: any, __: any, index: number) => index + 1,
                      },
                      {
                        title: 'ROI',
                        dataIndex: 'roiPct',
                        key: 'roiPct',
                        render: (roi: number) => (
                          <Text style={{ color: roi >= 0 ? 'rgb(var(--success-6))' : 'rgb(var(--danger-6))' }}>
                            {roi >= 0 ? '+' : ''}{roi.toFixed(2)}%
                          </Text>
                        ),
                      },
                      {
                        title: 'Total Trades',
                        dataIndex: 'totalTrades',
                        key: 'totalTrades',
                      },
                      {
                        title: 'Win Rate',
                        key: 'winRate',
                        render: (_: any, record: FollowerStatsRecord) => {
                          const winRate = record.totalTrades > 0
                            ? (record.winningTrades / record.totalTrades * 100)
                            : 0;
                          return <Text>{winRate.toFixed(1)}%</Text>;
                        },
                      },
                    ]}
                    data={leaderboard}
                    rowKey="id"
                    pagination={false}
                  />
                )}
              </TabPane>
            </Tabs>
          </Card>
        </Space>

        <Modal
          title="Follow Trader"
          visible={followModalVisible}
          onCancel={() => setFollowModalVisible(false)}
          footer={null}
          style={{ width: isMobile ? '100%' : 600 }}
        >
          <Form
            form={followForm}
            layout="vertical"
            initialValues={{
              copyMode: 'proportional',
              copyRatio: 1.0,
              maxDailyTrades: 10,
            }}
            onSubmit={handleFollow as any}
          >
            <Form.Item
              label="Leader User ID"
              field="leaderUserId"
              rules={[{ required: true, message: 'Please enter leader user ID' }]}
            >
              <Input placeholder="Enter the trader's user ID to follow" />
            </Form.Item>

            <Form.Item label="Copy Mode" field="copyMode">
              <Select>
                <Select.Option value="proportional">Proportional</Select.Option>
                <Select.Option value="fixed">Fixed Amount</Select.Option>
                <Select.Option value="mirror">Mirror (Same Quantity)</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item
              label="Copy Ratio"
              field="copyRatio"
              rules={[{ required: true }]}
              extra="For proportional mode: 0.5 = copy at 50% scale"
            >
              <InputNumber min={0.01} max={10} step={0.1} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              noStyle
              shouldUpdate={(prev, cur) => prev.copyMode !== cur.copyMode}
            >
              {(values) =>
                values.copyMode === 'fixed' && (
                  <Form.Item label="Fixed Amount (USDT)" field="fixedAmount">
                    <InputNumber min={1} style={{ width: '100%' }} />
                  </Form.Item>
                )
              }
            </Form.Item>

            <Form.Item label="Max Copy Amount per Trade (USDT)" field="maxCopyAmount">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="Stop Loss %" field="stopLossPct">
                  <InputNumber min={0} max={100} step={1} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Take Profit %" field="takeProfitPct">
                  <InputNumber min={0} max={1000} step={1} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item label="Max Daily Trades" field="maxDailyTrades">
              <InputNumber min={1} max={100} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item>
              <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                <Button onClick={() => setFollowModalVisible(false)}>Cancel</Button>
                <Button type="primary" htmlType="submit">Follow</Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>

        <Drawer
          title="Follower Settings"
          width={isMobile ? '100%' : 400}
          visible={settingsDrawerVisible}
          onCancel={() => setSettingsDrawerVisible(false)}
          footer={null}
        >
          <Form
            form={settingsForm}
            layout="vertical"
            onSubmit={handleUpdateSettings as any}
          >
            <Form.Item label="Copy Mode" field="copyMode">
              <Select>
                <Select.Option value="proportional">Proportional</Select.Option>
                <Select.Option value="fixed">Fixed Amount</Select.Option>
                <Select.Option value="mirror">Mirror</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item label="Copy Ratio" field="copyRatio">
              <InputNumber min={0.01} max={10} step={0.1} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item label="Fixed Amount" field="fixedAmount">
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item label="Max Copy Amount" field="maxCopyAmount">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="Stop Loss %" field="stopLossPct">
                  <InputNumber min={0} max={100} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Take Profit %" field="takeProfitPct">
                  <InputNumber min={0} max={1000} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item label="Max Daily Trades" field="maxDailyTrades">
              <InputNumber min={1} max={100} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item label="Max Daily Volume" field="maxDailyVolume">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item>
              <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                <Button onClick={() => setSettingsDrawerVisible(false)}>Cancel</Button>
                <Button type="primary" htmlType="submit">Save</Button>
              </Space>
            </Form.Item>
          </Form>
        </Drawer>
      </div>
    </ErrorBoundary>
  );
};

export default CopyTradingPage;
