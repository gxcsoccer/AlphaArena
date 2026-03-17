-- Enhanced Leaderboard Migration
-- Adds competition, social features, and badges for enhanced leaderboard

-- Users table (if not exists) - 用户信息
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100),
  avatar_url TEXT,
  bio TEXT,
  website_url TEXT,
  twitter_handle VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_public BOOLEAN DEFAULT true,
  followers_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0
);

-- User Follows table - 用户关注关系
CREATE TABLE IF NOT EXISTS user_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON user_follows(following_id);

-- Competitions table - 交易竞赛
CREATE TABLE IF NOT EXISTS competitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  creator_id UUID REFERENCES users(id),
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(20) DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'ended', 'cancelled')),
  entry_fee DECIMAL(20, 8) DEFAULT 0,
  prize_pool DECIMAL(20, 8) DEFAULT 0,
  max_participants INTEGER,
  rules JSONB DEFAULT '{}',
  rewards JSONB DEFAULT '[]',
  banner_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_competitions_status ON competitions(status);
CREATE INDEX IF NOT EXISTS idx_competitions_start_time ON competitions(start_time);
CREATE INDEX IF NOT EXISTS idx_competitions_end_time ON competitions(end_time);

-- Competition Participants table - 竞赛参与者
CREATE TABLE IF NOT EXISTS competition_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID REFERENCES competitions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  strategy_id UUID REFERENCES strategies(id),
  initial_capital DECIMAL(20, 8) NOT NULL,
  current_value DECIMAL(20, 8) NOT NULL,
  roi DECIMAL(10, 4) DEFAULT 0,
  rank INTEGER,
  prize DECIMAL(20, 8) DEFAULT 0,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(competition_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_competition_participants_competition ON competition_participants(competition_id);
CREATE INDEX IF NOT EXISTS idx_competition_participants_user ON competition_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_competition_participants_rank ON competition_participants(rank);

-- Strategy Comments table - 策略评论
CREATE TABLE IF NOT EXISTS strategy_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID REFERENCES strategies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES strategy_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_strategy_comments_strategy ON strategy_comments(strategy_id);
CREATE INDEX IF NOT EXISTS idx_strategy_comments_user ON strategy_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_strategy_comments_parent ON strategy_comments(parent_id);

-- Strategy Likes table - 策略点赞
CREATE TABLE IF NOT EXISTS strategy_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID REFERENCES strategies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(strategy_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_strategy_likes_strategy ON strategy_likes(strategy_id);
CREATE INDEX IF NOT EXISTS idx_strategy_likes_user ON strategy_likes(user_id);

-- Comment Likes table - 评论点赞
CREATE TABLE IF NOT EXISTS comment_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID REFERENCES strategy_comments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(comment_id, user_id)
);

-- User Badges table - 用户徽章
CREATE TABLE IF NOT EXISTS user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  badge_type VARCHAR(50) NOT NULL,
  badge_name VARCHAR(100) NOT NULL,
  badge_description TEXT,
  badge_icon TEXT,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  UNIQUE(user_id, badge_type)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_type ON user_badges(badge_type);

-- Strategy Shares table - 策略分享记录
CREATE TABLE IF NOT EXISTS strategy_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID REFERENCES strategies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  share_type VARCHAR(20) DEFAULT 'public' CHECK (share_type IN ('public', 'private', 'followers')),
  share_code VARCHAR(20) UNIQUE,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_strategy_shares_strategy ON strategy_shares(strategy_id);
CREATE INDEX IF NOT EXISTS idx_strategy_shares_code ON strategy_shares(share_code);

-- Rank History table - 排名历史
CREATE TABLE IF NOT EXISTS rank_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID REFERENCES strategies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL,
  previous_rank INTEGER,
  period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly', 'all_time')),
  sort_by VARCHAR(50) NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(strategy_id, period_type, sort_by, recorded_at)
);

CREATE INDEX IF NOT EXISTS idx_rank_history_strategy ON rank_history(strategy_id);
CREATE INDEX IF NOT EXISTS idx_rank_history_user ON rank_history(user_id);
CREATE INDEX IF NOT EXISTS idx_rank_history_period ON rank_history(period_type, recorded_at);

-- Leaderboard Views table - 排行榜浏览记录（用于统计）
CREATE TABLE IF NOT EXISTS leaderboard_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  view_type VARCHAR(50) NOT NULL,
  filters JSONB DEFAULT '{}',
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_views_user ON leaderboard_views(user_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_views_type ON leaderboard_views(view_type);

-- Strategy Stats table - 策略统计（缓存）
CREATE TABLE IF NOT EXISTS strategy_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID REFERENCES strategies(id) ON DELETE CASCADE UNIQUE,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  followers_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,
  period_stats JSONB DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_strategy_stats_strategy ON strategy_stats(strategy_id);

-- Functions

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_competitions_updated_at ON competitions;
CREATE TRIGGER update_competitions_updated_at
  BEFORE UPDATE ON competitions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_strategy_comments_updated_at ON strategy_comments;
CREATE TRIGGER update_strategy_comments_updated_at
  BEFORE UPDATE ON strategy_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to update followers count
CREATE OR REPLACE FUNCTION update_followers_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE users SET followers_count = followers_count + 1 WHERE id = NEW.following_id;
    UPDATE users SET following_count = following_count + 1 WHERE id = NEW.follower_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE users SET followers_count = GREATEST(followers_count - 1, 0) WHERE id = OLD.following_id;
    UPDATE users SET following_count = GREATEST(following_count - 1, 0) WHERE id = OLD.follower_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_followers_count_trigger ON user_follows;
CREATE TRIGGER update_followers_count_trigger
  AFTER INSERT OR DELETE ON user_follows
  FOR EACH ROW
  EXECUTE FUNCTION update_followers_count();

-- Function to update comment likes count
CREATE OR REPLACE FUNCTION update_comment_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE strategy_comments SET likes_count = likes_count + 1 WHERE id = NEW.comment_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE strategy_comments SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.comment_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_comment_likes_count_trigger ON comment_likes;
CREATE TRIGGER update_comment_likes_count_trigger
  AFTER INSERT OR DELETE ON comment_likes
  FOR EACH ROW
  EXECUTE FUNCTION update_comment_likes_count();

-- Comments on tables
COMMENT ON TABLE users IS 'User profiles for social features';
COMMENT ON TABLE user_follows IS 'User follow relationships';
COMMENT ON TABLE competitions IS 'Trading competitions';
COMMENT ON TABLE competition_participants IS 'Participants in trading competitions';
COMMENT ON TABLE strategy_comments IS 'Comments on strategies';
COMMENT ON TABLE strategy_likes IS 'Likes on strategies';
COMMENT ON TABLE user_badges IS 'Badges earned by users';
COMMENT ON TABLE strategy_shares IS 'Strategy sharing configuration';
COMMENT ON TABLE rank_history IS 'Historical ranking data';

-- Row Level Security (optional, can be enabled based on requirements)
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE competition_participants ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE strategy_comments ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE strategy_likes ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;