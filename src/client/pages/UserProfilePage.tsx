/**
 * User Profile Page
 * Public profile page displaying user information, stats, and badges
 */

import React, { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  Avatar,
  Space,
  Button,
  Grid,
  Spin,
  Empty,
  Tag,
  Tabs,
  Statistic,
} from '@arco-design/web-react';
import {
  IconUser,
  IconUserAdd,
  IconLink,
  IconTrophy,
  IconCalendar,
} from '@arco-design/web-react/icon';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { api } from '../utils/api';
import FollowButton from '../components/FollowButton';
import UserListModal from '../components/UserListModal';

const { Row, Col } = Grid;
const { Title, Text, Paragraph } = Typography;
const TabPane = Tabs.TabPane;

// Types
interface UserProfile {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  websiteUrl?: string;
  twitterHandle?: string;
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  isPublic: boolean;
  createdAt: string;
}

interface UserBadge {
  id: string;
  badgeType: string;
  badgeName: string;
  badgeDescription?: string;
  badgeIcon?: string;
  earnedAt: string;
}

const UserProfilePage: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);

  const fetchProfile = async () => {
    if (!username) return;

    setLoading(true);
    setError(null);

    try {
      const data = await api.getUserProfile(username);

      if (!data) {
        throw new Error('Failed to fetch profile');
      }

      setProfile(data);

      // Fetch badges
      const badgesData = await api.getUserBadges(username);
      if (badgesData) {
        setBadges(badgesData);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load profile';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  const handleFollowChange = (isFollowing: boolean) => {
    if (profile) {
      setProfile({
        ...profile,
        isFollowing,
        followersCount: isFollowing
          ? profile.followersCount + 1
          : Math.max(0, profile.followersCount - 1),
      });
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Spin size={40} />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <Empty description={error || 'User not found'} />
        <Button type="primary" onClick={() => navigate('/')} style={{ marginTop: 16 }}>
          Go Home
        </Button>
      </div>
    );
  }

  const isOwnProfile = currentUser?.id === profile.id;

  // Badge icons mapping
  const getBadgeIcon = (badgeType: string): string => {
    const icons: Record<string, string> = {
      trade_master: '🏆',
      strategy_master: '🎯',
      social_butterfly: '🦋',
      profit_king: '👑',
      early_adopter: '⭐',
      verified: '✓',
    };
    return icons[badgeType] || '🏅';
  };

  return (
    <ErrorBoundary>
      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Profile Header */}
        <Card style={{ marginBottom: 24 }}>
          <Row gutter={24} align="center">
            <Col span={4}>
              <Avatar
                size={120}
                style={{ backgroundColor: '#165DFF' }}
                icon={<IconUser />}
              >
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt={profile.username} />
                ) : (
                  profile.displayName?.[0]?.toUpperCase() || profile.username[0]?.toUpperCase()
                )}
              </Avatar>
            </Col>
            <Col span={14}>
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <Title heading={3} style={{ margin: 0 }}>
                  {profile.displayName || profile.username}
                  {badges.length > 0 && (
                    <Space style={{ marginLeft: 8 }}>
                      {badges.slice(0, 3).map((badge) => (
                        <Tag key={badge.id} color="gold">
                          {getBadgeIcon(badge.badgeType)} {badge.badgeName}
                        </Tag>
                      ))}
                      {badges.length > 3 && (
                        <Tag>+{badges.length - 3}</Tag>
                      )}
                    </Space>
                  )}
                </Title>
                <Text type="secondary">@{profile.username}</Text>
                {profile.bio && (
                  <Paragraph style={{ margin: '8px 0' }}>{profile.bio}</Paragraph>
                )}
                <Space>
                  {profile.websiteUrl && (
                    <Button
                      icon={<IconLink />}
                      href={profile.websiteUrl}
                      target="_blank"
                      size="small"
                    >
                      Website
                    </Button>
                  )}
                  {profile.twitterHandle && (
                    <Button
                      icon={<IconUser />}
                      href={`https://twitter.com/${profile.twitterHandle}`}
                      target="_blank"
                      size="small"
                    >
                      @{profile.twitterHandle}
                    </Button>
                  )}
                </Space>
              </Space>
            </Col>
            <Col span={6} style={{ textAlign: 'right' }}>
              {isOwnProfile ? (
                <Button type="primary" onClick={() => navigate('/settings/profile')}>
                  Edit Profile
                </Button>
              ) : currentUser ? (
                <FollowButton
                  targetUserId={profile.id}
                  isFollowing={profile.isFollowing}
                  onFollowChange={handleFollowChange}
                />
              ) : (
                <Button type="primary" onClick={() => navigate('/login')}>
                  Login to Follow
                </Button>
              )}
            </Col>
          </Row>
        </Card>

        {/* Stats Row */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card
              hoverable
              onClick={() => setShowFollowers(true)}
              style={{ cursor: 'pointer', textAlign: 'center' }}
            >
              <Statistic
                title="Followers"
                value={profile.followersCount}
                prefix={<IconUser />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card
              hoverable
              onClick={() => setShowFollowing(true)}
              style={{ cursor: 'pointer', textAlign: 'center' }}
            >
              <Statistic
                title="Following"
                value={profile.followingCount}
                prefix={<IconUserAdd />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card style={{ textAlign: 'center' }}>
              <Statistic
                title="Badges"
                value={badges.length}
                prefix={<IconTrophy />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card style={{ textAlign: 'center' }}>
              <Statistic
                title="Member Since"
                value={new Date(profile.createdAt).toLocaleDateString()}
                prefix={<IconCalendar />}
              />
            </Card>
          </Col>
        </Row>

        {/* Tabs for additional content */}
        <Tabs defaultActiveTab="badges">
          <TabPane key="badges" tab="Badges">
            <Card>
              {badges.length > 0 ? (
                <Row gutter={[16, 16]}>
                  {badges.map((badge) => (
                    <Col span={6} key={badge.id}>
                      <Card hoverable style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 48, marginBottom: 8 }}>
                          {getBadgeIcon(badge.badgeType)}
                        </div>
                        <Title heading={5}>{badge.badgeName}</Title>
                        <Text type="secondary">{badge.badgeDescription}</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Earned {new Date(badge.earnedAt).toLocaleDateString()}
                        </Text>
                      </Card>
                    </Col>
                  ))}
                </Row>
              ) : (
                <Empty description="No badges earned yet" />
              )}
            </Card>
          </TabPane>
          <TabPane key="stats" tab="Trading Stats">
            <Card>
              <Empty description="Trading statistics coming soon" />
            </Card>
          </TabPane>
          <TabPane key="strategies" tab="Public Strategies">
            <Card>
              <Empty description="No public strategies" />
            </Card>
          </TabPane>
        </Tabs>

        {/* Followers Modal */}
        {profile && (
          <UserListModal
            visible={showFollowers}
            title="Followers"
            userId={profile.id}
            type="followers"
            onClose={() => setShowFollowers(false)}
          />
        )}

        {/* Following Modal */}
        {profile && (
          <UserListModal
            visible={showFollowing}
            title="Following"
            userId={profile.id}
            type="following"
            onClose={() => setShowFollowing(false)}
          />
        )}
      </div>
    </ErrorBoundary>
  );
};

export default UserProfilePage;
