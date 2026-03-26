/**
 * ReferralPage - User invitation system page
 * Issue #653: 用户邀请系统 - 邀请码生成、邀请记录、奖励发放
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Grid,
  Card,
  Space,
  Button,
  Statistic,
  Table,
  Tag,
  Message,
  Spin,
  Modal,
  Input,
  Skeleton,
  Divider,
  Tooltip,
  Progress,
} from '@arco-design/web-react';
import {
  IconCopy,
  IconShareAlt,
  IconGift,
  IconUserAdd,
  IconTrophy,
  IconCheckCircle,
  IconClockCircle,
  IconRefresh,
  IconQuestionCircle,
} from '@arco-design/web-react/icon';
import { useNavigate } from 'react-router-dom';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useSEO } from '../hooks/useSEO';
import { useAuth } from '../hooks/useAuth';
import { api } from '../utils/api';

const { Title, Text, Paragraph } = Typography;
const { Row, Col } = Grid;

interface ReferralCode {
  code: string;
  referralLink: string;
  stats: {
    totalReferrals: number;
    successfulReferrals: number;
    pendingRewards: number;
    totalRewardsEarned: number;
  };
}

interface ReferralStats {
  hasCode: boolean;
  referralCode: string | null;
  totalReferrals: number;
  successfulReferrals: number;
  pendingRewards: number;
  totalRewardsEarned: number;
  recentReferrals: Array<{
    id: string;
    status: string;
    invitedAt: string;
    registeredAt: string | null;
    activatedAt: string | null;
  }>;
  earningsSummary: {
    pending: number;
    processed: number;
    total: number;
    vipDaysEarned: number;
  };
  rewardRules: {
    inviteeBonusDays: number;
    referrerBonusDays: number;
    activationCriteria: string;
  };
}

interface Referral {
  id: string;
  status: string;
  inviteEmail: string | null;
  invitedAt: string;
  registeredAt: string | null;
  activatedAt: string | null;
}

interface Reward {
  id: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  description: string | null;
  scheduledAt: string | null;
  processedAt: string | null;
  createdAt: string;
}

const ReferralPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [referralCode, setReferralCode] = useState<ReferralCode | null>(null);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);

  // SEO
  useSEO({
    title: '邀请好友 - AlphaArena',
    description: '邀请好友获得 VIP 奖励，共享交易成长',
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [codeRes, statsRes, referralsRes, rewardsRes] = await Promise.all([
        api.get('/api/referral/code'),
        api.get('/api/referral/stats'),
        api.get('/api/referral/referrals?limit=10'),
        api.get('/api/referral/rewards?limit=10'),
      ]);

      if (codeRes.data.success) {
        setReferralCode(codeRes.data.data);
      }
      if (statsRes.data.success) {
        setStats(statsRes.data.data);
      }
      if (referralsRes.data.success) {
        setReferrals(referralsRes.data.data.referrals || []);
      }
      if (rewardsRes.data.success) {
        setRewards(rewardsRes.data.data.rewards || []);
      }
    } catch (error) {
      Message.error('加载邀请数据失败');
      console.error('Failed to load referral data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, fetchData]);

  const copyReferralLink = () => {
    if (!referralCode) return;
    const link = `${window.location.origin}/register?ref=${referralCode.code}`;
    navigator.clipboard.writeText(link);
    Message.success('邀请链接已复制到剪贴板');
  };

  const copyReferralCode = () => {
    if (!referralCode) return;
    navigator.clipboard.writeText(referralCode.code);
    Message.success('邀请码已复制到剪贴板');
  };

  const handleInvite = async () => {
    if (!inviteEmail) {
      Message.warning('请输入邮箱地址');
      return;
    }

    try {
      setInviting(true);
      const res = await api.post('/api/referral/invite', { inviteEmail });
      if (res.data.success) {
        Message.success('邀请已发送');
        setInviteModalVisible(false);
        setInviteEmail('');
        fetchData();
      } else {
        Message.error(res.data.error || '发送邀请失败');
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      Message.error(err.response?.data?.error || '发送邀请失败');
    } finally {
      setInviting(false);
    }
  };

  const getStatusTag = (status: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      pending: { color: 'orange', text: '待注册' },
      registered: { color: 'blue', text: '已注册' },
      activated: { color: 'green', text: '已激活' },
      rewarded: { color: 'purple', text: '已奖励' },
      cancelled: { color: 'red', text: '已取消' },
    };
    const config = statusMap[status] || { color: 'gray', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const referralColumns = [
    {
      title: '状态',
      dataIndex: 'status',
      render: (status: string) => getStatusTag(status),
    },
    {
      title: '邀请邮箱',
      dataIndex: 'inviteEmail',
      render: (email: string | null) => email || '-',
    },
    {
      title: '邀请时间',
      dataIndex: 'invitedAt',
      render: (date: string) => formatDate(date),
    },
    {
      title: '注册时间',
      dataIndex: 'registeredAt',
      render: (date: string | null) => formatDate(date),
    },
    {
      title: '激活时间',
      dataIndex: 'activatedAt',
      render: (date: string | null) => formatDate(date),
    },
  ];

  const rewardColumns = [
    {
      title: '类型',
      dataIndex: 'type',
      render: (type: string) => {
        const typeMap: Record<string, string> = {
          referral_bonus: '邀请奖励',
          invitee_bonus: '新用户奖励',
          activation_bonus: '激活奖励',
          manual: '手动奖励',
        };
        return typeMap[type] || type;
      },
    },
    {
      title: 'VIP 天数',
      dataIndex: 'amount',
      render: (amount: number) => `${Math.round(amount * 30 / 100)} 天`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status: string) => {
        const statusMap: Record<string, { color: string; text: string }> = {
          pending: { color: 'orange', text: '待发放' },
          processed: { color: 'green', text: '已发放' },
          cancelled: { color: 'red', text: '已取消' },
        };
        const config = statusMap[status] || { color: 'gray', text: status };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '说明',
      dataIndex: 'description',
      render: (desc: string | null) => desc || '-',
    },
    {
      title: '发放时间',
      dataIndex: 'processedAt',
      render: (date: string | null) => formatDate(date),
    },
  ];

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin size={32} />
        <Text style={{ display: 'block', marginTop: 16 }}>加载中...</Text>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <Title heading={4} style={{ margin: 0 }}>
            <IconUserAdd style={{ marginRight: 8 }} />
            邀请好友
          </Title>
          <Text type="secondary">邀请好友注册，双方均可获得 VIP Pro 奖励</Text>
        </div>

        {/* Reward Rules */}
        <Card style={{ marginBottom: 24 }}>
          <Row gutter={24}>
            <Col xs={24} sm={12} md={8}>
              <div style={{ textAlign: 'center', padding: 16 }}>
                <IconGift style={{ fontSize: 32, color: 'rgb(var(--primary-6))' }} />
                <Title heading={6} style={{ marginTop: 8, marginBottom: 4 }}>新用户奖励</Title>
                <Text type="secondary">
                  通过邀请链接注册，立即获得{' '}
                  <Text bold style={{ color: 'rgb(var(--primary-6))' }}>
                    {stats?.rewardRules?.inviteeBonusDays || 7} 天
                  </Text>{' '}
                  VIP Pro
                </Text>
              </div>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <div style={{ textAlign: 'center', padding: 16 }}>
                <IconTrophy style={{ fontSize: 32, color: 'rgb(var(--warning-6))' }} />
                <Title heading={6} style={{ marginTop: 8, marginBottom: 4 }}>邀请人奖励</Title>
                <Text type="secondary">
                  被邀请人激活后，您获得{' '}
                  <Text bold style={{ color: 'rgb(var(--warning-6))' }}>
                    {stats?.rewardRules?.referrerBonusDays || 30} 天
                  </Text>{' '}
                  VIP Pro
                </Text>
              </div>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <div style={{ textAlign: 'center', padding: 16 }}>
                <IconCheckCircle style={{ fontSize: 32, color: 'rgb(var(--success-6))' }} />
                <Title heading={6} style={{ marginTop: 8, marginBottom: 4 }}>激活条件</Title>
                <Text type="secondary">
                  {stats?.rewardRules?.activationCriteria || '首次订阅或交易'}
                </Text>
              </div>
            </Col>
          </Row>
        </Card>

        {/* Referral Code Card */}
        <Card style={{ marginBottom: 24 }}>
          <Title heading={5}>我的邀请码</Title>
          {referralCode ? (
            <div>
              <Row gutter={16} align="center" style={{ marginBottom: 16 }}>
                <Col>
                  <div
                    style={{
                      background: 'linear-gradient(135deg, rgb(var(--primary-6)), rgb(var(--primary-5)))',
                      color: 'white',
                      padding: '16px 32px',
                      borderRadius: 8,
                      fontSize: 24,
                      fontWeight: 'bold',
                      letterSpacing: 2,
                      display: 'inline-block',
                    }}
                  >
                    {referralCode.code}
                  </div>
                </Col>
              </Row>
              <Space size="medium">
                <Button
                  type="primary"
                  icon={<IconCopy />}
                  onClick={copyReferralCode}
                >
                  复制邀请码
                </Button>
                <Button
                  type="outline"
                  icon={<IconCopy />}
                  onClick={copyReferralLink}
                >
                  复制邀请链接
                </Button>
                <Button
                  type="outline"
                  icon={<IconShareAlt />}
                  onClick={() => setInviteModalVisible(true)}
                >
                  发送邀请
                </Button>
              </Space>
            </div>
          ) : (
            <Skeleton text={{ rows: 2 }} animation />
          )}
        </Card>

        {/* Statistics */}
        <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="邀请人数"
                value={stats?.totalReferrals || 0}
                suffix="人"
                prefix={<IconUserAdd />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="成功激活"
                value={stats?.successfulReferrals || 0}
                suffix="人"
                prefix={<IconCheckCircle />}
                valueStyle={{ color: 'rgb(var(--success-6))' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="待发放奖励"
                value={stats?.pendingRewards || 0}
                prefix={<IconClockCircle />}
                valueStyle={{ color: 'rgb(var(--warning-6))' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="累计获得"
                value={stats?.earningsSummary?.vipDaysEarned || 0}
                suffix="天 VIP"
                prefix={<IconTrophy />}
                valueStyle={{ color: 'rgb(var(--primary-6))' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Conversion Rate */}
        {stats && stats.totalReferrals > 0 && (
          <Card style={{ marginBottom: 24 }}>
            <Row align="center" gutter={24}>
              <Col span={12}>
                <Text>邀请转化率</Text>
                <Progress
                  percent={Math.round((stats.successfulReferrals / stats.totalReferrals) * 100)}
                  style={{ marginTop: 8 }}
                />
              </Col>
              <Col span={12}>
                <Text type="secondary">
                  {stats.totalReferrals} 次邀请中有 {stats.successfulReferrals} 人成功激活
                </Text>
              </Col>
            </Row>
          </Card>
        )}

        {/* Tabs for Referrals and Rewards */}
        <Row gutter={24}>
          <Col xs={24} lg={12}>
            <Card title="邀请记录">
              <Table
                columns={referralColumns}
                data={referrals}
                pagination={false}
                scroll={{ x: 500 }}
                noDataElement={
                  <div style={{ padding: 24, textAlign: 'center' }}>
                    <IconUserAdd style={{ fontSize: 32, color: 'var(--color-text-3)' }} />
                    <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                      暂无邀请记录
                    </Text>
                  </div>
                }
              />
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title="奖励记录">
              <Table
                columns={rewardColumns}
                data={rewards}
                pagination={false}
                scroll={{ x: 500 }}
                noDataElement={
                  <div style={{ padding: 24, textAlign: 'center' }}>
                    <IconGift style={{ fontSize: 32, color: 'var(--color-text-3)' }} />
                    <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                      暂无奖励记录
                    </Text>
                  </div>
                }
              />
            </Card>
          </Col>
        </Row>

        {/* FAQ Section */}
        <Card style={{ marginTop: 24 }} title="常见问题">
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <Text bold>1. 如何邀请好友？</Text>
              <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                复制您的专属邀请码或邀请链接，发送给好友。好友通过邀请链接注册后，双方都能获得 VIP 奖励。
              </Paragraph>
            </div>
            <Divider style={{ margin: '8px 0' }} />
            <div>
              <Text bold>2. 奖励什么时候发放？</Text>
              <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                新用户奖励在注册后立即发放。邀请人奖励在被邀请人激活（首次订阅或交易）后立即发放。
              </Paragraph>
            </div>
            <Divider style={{ margin: '8px 0' }} />
            <div>
              <Text bold>3. VIP 天数可以累积吗？</Text>
              <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                是的，获得的 VIP 天数会自动累加到您的账户中，可延长您的 VIP 有效期。
              </Paragraph>
            </div>
            <Divider style={{ margin: '8px 0' }} />
            <div>
              <Text bold>4. 有邀请数量限制吗？</Text>
              <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                目前没有邀请数量限制，您可以邀请任意数量的好友。但我们会检测异常行为以防止滥用。
              </Paragraph>
            </div>
          </Space>
        </Card>

        {/* Invite Modal */}
        <Modal
          title="发送邀请"
          visible={inviteModalVisible}
          onOk={handleInvite}
          onCancel={() => setInviteModalVisible(false)}
          confirmLoading={inviting}
          okText="发送邀请"
          cancelText="取消"
        >
          <div style={{ marginBottom: 16 }}>
            <Text type="secondary">
              输入好友邮箱，我们将发送邀请链接到该邮箱
            </Text>
          </div>
          <Input
            placeholder="请输入好友邮箱"
            value={inviteEmail}
            onChange={setInviteEmail}
            type="email"
          />
        </Modal>
      </div>
    </ErrorBoundary>
  );
};

export default ReferralPage;