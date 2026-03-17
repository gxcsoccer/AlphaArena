/**
 * Follow Button Component
 * Button to follow/unfollow users
 */

import React, { useState } from 'react';
import { Button, Message, Spin } from '@arco-design/web-react';
import {
  IconUserAdd,
  IconUser,
} from '@arco-design/web-react/icon';
import { useAuth } from '../hooks/useAuth';

interface FollowButtonProps {
  targetUserId: string;
  isFollowing: boolean;
  onFollowChange?: (isFollowing: boolean) => void;
  size?: 'small' | 'default' | 'large';
  style?: React.CSSProperties;
}

const FollowButton: React.FC<FollowButtonProps> = ({
  targetUserId,
  isFollowing: initialIsFollowing,
  onFollowChange,
  size = 'default',
  style,
}) => {
  const { user } = useAuth();
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [loading, setLoading] = useState(false);

  const handleFollow = async () => {
    if (!user?.token) {
      Message.warning('Please login to follow users');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/users/${targetUserId}/follow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to follow user');
      }

      setIsFollowing(true);
      onFollowChange?.(true);
      Message.success('Successfully followed user');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to follow user';
      Message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleUnfollow = async () => {
    if (!user?.token) return;

    setLoading(true);

    try {
      const response = await fetch(`/api/users/${targetUserId}/follow`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to unfollow user');
      }

      setIsFollowing(false);
      onFollowChange?.(false);
      Message.success('Successfully unfollowed user');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to unfollow user';
      Message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Button disabled style={style}>
        <Spin size={16} style={{ marginRight: 4 }} />
        {isFollowing ? 'Unfollowing...' : 'Following...'}
      </Button>
    );
  }

  if (isFollowing) {
    return (
      <Button
        type="outline"
        status="success"
        icon={<IconUser />}
        onClick={handleUnfollow}
        size={size}
        style={style}
      >
        Following
      </Button>
    );
  }

  return (
    <Button
      type="primary"
      icon={<IconUserAdd />}
      onClick={handleFollow}
      size={size}
      style={style}
    >
      Follow
    </Button>
  );
};

export default FollowButton;
