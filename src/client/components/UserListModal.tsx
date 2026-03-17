/**
 * User List Modal Component
 * Modal to display list of followers or following users
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  List,
  Avatar,
  Button,
  Spin,
  Empty,
  Typography,
  Space,
} from '@arco-design/web-react';
import { IconUser } from '@arco-design/web-react/icon';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../utils/api';
import FollowButton from './FollowButton';

const { Text } = Typography;

interface UserListItem {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
}

interface UserListModalProps {
  visible: boolean;
  title: string;
  userId: string;
  type: 'followers' | 'following';
  onClose: () => void;
}

const UserListModal: React.FC<UserListModalProps> = ({
  visible,
  title,
  userId,
  type,
  onClose,
}) => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const PAGE_SIZE = 20;

  const fetchUsers = useCallback(async (reset = false) => {
    if (!visible) return;

    setLoading(true);
    setError(null);

    const offset = reset ? 0 : page * PAGE_SIZE;

    try {
      let newUsers: UserListItem[] = [];
      if (type === 'followers') {
        newUsers = await api.getUserFollowers(userId, PAGE_SIZE, offset);
      } else {
        newUsers = await api.getUserFollowing(userId, PAGE_SIZE, offset);
      }

      setUsers((prev) => (reset ? newUsers : [...prev, ...newUsers]));
      setHasMore(newUsers.length === PAGE_SIZE);
      if (!reset) {
        setPage((prev) => prev + 1);
      } else {
        setPage(1);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : `Failed to fetch ${type}`;
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [visible, userId, type, page, currentUser?.token]);

  useEffect(() => {
    if (visible) {
      setUsers([]);
      setPage(0);
      setHasMore(true);
      fetchUsers(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleUserClick = (username: string) => {
    onClose();
    navigate(`/user/${username}`);
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      fetchUsers();
    }
  };

  const handleFollowChange = (userId: string, isFollowing: boolean) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, isFollowing } : u))
    );
  };

  return (
    <Modal
      visible={visible}
      title={title}
      onCancel={onClose}
      footer={null}
      style={{ width: 500 }}
    >
      {loading && users.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size={32} />
        </div>
      ) : error ? (
        <Empty description={error} />
      ) : users.length === 0 ? (
        <Empty description={`No ${type} yet`} />
      ) : (
        <>
          <List
            dataSource={users}
            render={(user: UserListItem) => (
              <List.Item
                key={user.id}
                style={{ cursor: 'pointer' }}
                onClick={() => handleUserClick(user.username)}
              >
                <List.Item.Meta
                  avatar={
                    <Avatar style={{ backgroundColor: '#165DFF' }} icon={<IconUser />}>
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.username} />
                      ) : (
                        user.displayName?.[0]?.toUpperCase() || user.username[0]?.toUpperCase()
                      )}
                    </Avatar>
                  }
                  title={
                    <Space>
                      <Text strong>{user.displayName || user.username}</Text>
                      <Text type="secondary">@{user.username}</Text>
                    </Space>
                  }
                  description={
                    <Text
                      type="secondary"
                      style={{
                        display: 'block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: 300,
                      }}
                    >
                      {user.bio || `${user.followersCount} followers · ${user.followingCount} following`}
                    </Text>
                  }
                />
                <div onClick={(e) => e.stopPropagation()}>
                  {currentUser && currentUser.id !== user.id && (
                    <FollowButton
                      targetUserId={user.id}
                      isFollowing={user.isFollowing}
                      onFollowChange={(isFollowing) => handleFollowChange(user.id, isFollowing)}
                      size="small"
                    />
                  )}
                </div>
              </List.Item>
            )}
          />
          {hasMore && (
            <div style={{ textAlign: 'center', padding: 16 }}>
              <Button onClick={handleLoadMore} loading={loading}>
                Load More
              </Button>
            </div>
          )}
        </>
      )}
    </Modal>
  );
};

export default UserListModal;
