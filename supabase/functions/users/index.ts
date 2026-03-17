import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
};

async function getUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring(7);
  const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;
    return user.id;
  } catch {
    return null;
  }
}

function mapToUser(row: any) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    bio: row.bio,
    websiteUrl: row.website_url,
    twitterHandle: row.twitter_handle,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isPublic: row.is_public,
    followersCount: row.followers_count || 0,
    followingCount: row.following_count || 0,
  };
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const currentUserId = await getUserId(req);

    // PATCH /users/me/profile
    if (method === 'PATCH' && (path === '/users/me/profile' || path === '/api/users/me/profile')) {
      if (!currentUserId) {
        return new Response(JSON.stringify({ success: false, error: 'User not authenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const body = await req.json();
      const updates: Record<string, any> = {};
      if (body.displayName !== undefined) updates.display_name = body.displayName;
      if (body.avatarUrl !== undefined) updates.avatar_url = body.avatarUrl;
      if (body.bio !== undefined) updates.bio = body.bio;
      if (body.websiteUrl !== undefined) updates.website_url = body.websiteUrl;
      if (body.twitterHandle !== undefined) updates.twitter_handle = body.twitterHandle;
      if (body.isPublic !== undefined) updates.is_public = body.isPublic;

      const { data, error } = await supabase.from('users').update(updates).eq('id', currentUserId).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: mapToUser(data) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // GET /users/me/following/feed
    if (method === 'GET' && (path === '/users/me/following/feed' || path === '/api/users/me/following/feed')) {
      if (!currentUserId) {
        return new Response(JSON.stringify({ success: false, error: 'User not authenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { data: following } = await supabase.from('user_follows').select('following_id').eq('follower_id', currentUserId).limit(100);
      return new Response(JSON.stringify({ success: true, data: { activities: [], followingCount: following?.length || 0, message: 'Activity feed coming soon' } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // GET /users/search
    if (method === 'GET' && (path === '/users/search' || path === '/api/users/search' || path === '/users/search/users' || path === '/api/users/search/users')) {
      const q = url.searchParams.get('q');
      if (!q) {
        return new Response(JSON.stringify({ success: false, error: 'Search query is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { data, error } = await supabase.from('users').select('*').or('username.ilike.%' + q + '%,display_name.ilike.%' + q + '%').eq('is_public', true).limit(20);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: data?.map(mapToUser) || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // GET /users/:username
    const usernameMatch = path.match(/^\/(api\/)?users\/([^\/]+)$/);
    if (method === 'GET' && usernameMatch) {
      const username = usernameMatch[2];
      if (username === 'me' || username === 'search') {
        return new Response(JSON.stringify({ success: false, error: 'Not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { data: user, error } = await supabase.from('users').select('*').eq('username', username).single();
      if (error || !user) {
        return new Response(JSON.stringify({ success: false, error: 'User not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      let isFollowing = false;
      if (currentUserId) {
        const { data: follow } = await supabase.from('user_follows').select('id').eq('follower_id', currentUserId).eq('following_id', user.id).single();
        isFollowing = !!follow;
      }
      return new Response(JSON.stringify({ success: true, data: { ...mapToUser(user), isFollowing } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // GET /users/:username/stats
    const statsMatch = path.match(/^\/(api\/)?users\/([^\/]+)\/stats$/);
    if (method === 'GET' && statsMatch) {
      const username = statsMatch[2];
      const { data: user, error } = await supabase.from('users').select('*').eq('username', username).single();
      if (error || !user) {
        return new Response(JSON.stringify({ success: false, error: 'User not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ success: true, data: { followersCount: user.followers_count || 0, followingCount: user.following_count || 0 } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // GET /users/:username/badges
    const badgesMatch = path.match(/^\/(api\/)?users\/([^\/]+)\/badges$/);
    if (method === 'GET' && badgesMatch) {
      const username = badgesMatch[2];
      const { data: user, error: userError } = await supabase.from('users').select('id').eq('username', username).single();
      if (userError || !user) {
        return new Response(JSON.stringify({ success: false, error: 'User not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { data: badges, error } = await supabase.from('user_badges').select('*').eq('user_id', user.id).order('earned_at', { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: badges?.map(b => ({ id: b.id, badgeType: b.badge_type, badgeName: b.badge_name, badgeDescription: b.badge_description, badgeIcon: b.badge_icon, earnedAt: b.earned_at })) || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // GET /users/:username/strategies
    const strategiesMatch = path.match(/^\/(api\/)?users\/([^\/]+)\/strategies$/);
    if (method === 'GET' && strategiesMatch) {
      const username = strategiesMatch[2];
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const offset = parseInt(url.searchParams.get('offset') || '0');
      const { data: user, error: userError } = await supabase.from('users').select('id').eq('username', username).single();
      if (userError || !user) {
        return new Response(JSON.stringify({ success: false, error: 'User not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { data: templates, error, count } = await supabase.from('strategy_templates').select('*', { count: 'exact' }).eq('author_id', user.id).eq('is_public', true).range(offset, offset + limit - 1);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: templates?.map(t => ({ id: t.id, name: t.name, description: t.description, strategyType: t.strategy_type, category: t.category, symbol: t.symbol, tags: t.tags, performanceMetrics: t.performance_metrics, useCount: t.use_count, ratingAvg: t.rating_avg, ratingCount: t.rating_count, createdAt: t.created_at })) || [], pagination: { limit, offset, hasMore: (count || 0) > offset + limit } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // GET /users/:username/activities
    const activitiesMatch = path.match(/^\/(api\/)?users\/([^\/]+)\/activities$/);
    if (method === 'GET' && activitiesMatch) {
      const username = activitiesMatch[2];
      const { data: user, error } = await supabase.from('users').select('id').eq('username', username).single();
      if (error || !user) {
        return new Response(JSON.stringify({ success: false, error: 'User not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ success: true, data: [], pagination: { limit: 20, offset: 0, hasMore: false }, message: 'Activity logging coming soon' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // POST /users/:userId/follow
    const followMatch = path.match(/^\/(api\/)?users\/([^\/]+)\/follow$/);
    if (method === 'POST' && followMatch) {
      if (!currentUserId) {
        return new Response(JSON.stringify({ success: false, error: 'User not authenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const targetUserId = followMatch[2];
      if (currentUserId === targetUserId) {
        return new Response(JSON.stringify({ success: false, error: 'Cannot follow yourself' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { data: existingFollow } = await supabase.from('user_follows').select('id').eq('follower_id', currentUserId).eq('following_id', targetUserId).single();
      if (existingFollow) {
        return new Response(JSON.stringify({ success: false, error: 'Already following this user' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { data: targetUser } = await supabase.from('users').select('id').eq('id', targetUserId).single();
      if (!targetUser) {
        return new Response(JSON.stringify({ success: false, error: 'User not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { error } = await supabase.from('user_follows').insert([{ follower_id: currentUserId, following_id: targetUserId }]);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, message: 'Successfully followed user', data: { followingId: targetUserId } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // DELETE /users/:userId/follow
    if (method === 'DELETE' && followMatch) {
      if (!currentUserId) {
        return new Response(JSON.stringify({ success: false, error: 'User not authenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const targetUserId = followMatch[2];
      const { error } = await supabase.from('user_follows').delete().eq('follower_id', currentUserId).eq('following_id', targetUserId);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, message: 'Successfully unfollowed user', data: { unfollowedId: targetUserId } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // GET /users/:userId/followers
    const followersMatch = path.match(/^\/(api\/)?users\/([^\/]+)\/followers$/);
    if (method === 'GET' && followersMatch) {
      const userId = followersMatch[2];
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = parseInt(url.searchParams.get('offset') || '0');
      const { data: user } = await supabase.from('users').select('id').eq('id', userId).single();
      if (!user) {
        return new Response(JSON.stringify({ success: false, error: 'User not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { data: follows, error } = await supabase.from('user_follows').select('follower_id, users!user_follows_follower_id_fkey (*)').eq('following_id', userId).range(offset, offset + limit - 1);
      if (error) throw error;
      const followers = follows?.map((f: any) => mapToUser(f.users)) || [];
      const followersWithStatus = await Promise.all(followers.map(async (follower) => {
        let isFollowingBack = false;
        if (currentUserId) {
          const { data } = await supabase.from('user_follows').select('id').eq('follower_id', currentUserId).eq('following_id', follower.id).single();
          isFollowingBack = !!data;
        }
        return { ...follower, isFollowing: isFollowingBack };
      }));
      return new Response(JSON.stringify({ success: true, data: followersWithStatus, pagination: { limit, offset, hasMore: followers.length === limit } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // GET /users/:userId/following
    const followingMatch = path.match(/^\/(api\/)?users\/([^\/]+)\/following$/);
    if (method === 'GET' && followingMatch) {
      const userId = followingMatch[2];
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = parseInt(url.searchParams.get('offset') || '0');
      const { data: user } = await supabase.from('users').select('id').eq('id', userId).single();
      if (!user) {
        return new Response(JSON.stringify({ success: false, error: 'User not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { data: follows, error } = await supabase.from('user_follows').select('following_id, users!user_follows_following_id_fkey (*)').eq('follower_id', userId).range(offset, offset + limit - 1);
      if (error) throw error;
      const following = follows?.map((f: any) => mapToUser(f.users)) || [];
      const followingWithStatus = await Promise.all(following.map(async (followedUser) => {
        let currentUserFollows = false;
        if (currentUserId) {
          const { data } = await supabase.from('user_follows').select('id').eq('follower_id', currentUserId).eq('following_id', followedUser.id).single();
          currentUserFollows = !!data;
        }
        return { ...followedUser, isFollowing: currentUserFollows };
      }));
      return new Response(JSON.stringify({ success: true, data: followingWithStatus, pagination: { limit, offset, hasMore: following.length === limit } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: false, error: 'Not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message || 'Internal server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
