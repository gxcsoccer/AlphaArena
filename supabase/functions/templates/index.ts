import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
  };

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // GET /templates - List templates
    if (method === 'GET' && (path === '/templates' || path === '/api/templates')) {
      const search = url.searchParams.get('search');
      const category = url.searchParams.get('category');
      const strategyType = url.searchParams.get('strategyType');
      const sortBy = url.searchParams.get('sortBy') || 'created_at';
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      let query = supabase
        .from('strategy_templates')
        .select('*', { count: 'exact' })
        .eq('is_public', true);

      if (search) {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
      }
      if (category) {
        query = query.eq('category', category);
      }
      if (strategyType) {
        query = query.eq('strategy_type', strategyType);
      }

      // Sorting
      const sortColumn = sortBy === 'rating' ? 'rating_avg' : 
                        sortBy === 'use_count' ? 'use_count' : 
                        sortBy === 'name' ? 'name' : 'created_at';
      query = query.order(sortColumn, { ascending: sortBy === 'name' });

      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) throw error;

      return new Response(JSON.stringify({
        success: true,
        data,
        total: count || 0,
        limit,
        offset,
        timestamp: Date.now(),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /templates/categories
    if (method === 'GET' && (path === '/templates/categories' || path === '/api/templates/categories')) {
      const { data, error } = await supabase
        .from('strategy_templates')
        .select('category')
        .eq('is_public', true);

      if (error) throw error;

      const categories = [...new Set(data.map(row => row.category))];
      
      return new Response(JSON.stringify({
        success: true,
        data: categories,
        timestamp: Date.now(),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /templates/tags
    if (method === 'GET' && (path === '/templates/tags' || path === '/api/templates/tags')) {
      const { data, error } = await supabase
        .from('strategy_templates')
        .select('tags')
        .eq('is_public', true);

      if (error) throw error;

      const tags = new Set<string>();
      data.forEach(row => {
        (row.tags || []).forEach((tag: string) => tags.add(tag));
      });

      return new Response(JSON.stringify({
        success: true,
        data: Array.from(tags).sort(),
        timestamp: Date.now(),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /templates/:id
    const templateIdMatch = path.match(/\/templates\/([a-f0-9-]+)$/i) || 
                           path.match(/\/api\/templates\/([a-f0-9-]+)$/i);
    if (method === 'GET' && templateIdMatch) {
      const templateId = templateIdMatch[1];
      
      const { data, error } = await supabase
        .from('strategy_templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return new Response(JSON.stringify({
            success: false,
            error: 'Template not found',
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        throw error;
      }

      return new Response(JSON.stringify({
        success: true,
        data,
        timestamp: Date.now(),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 404 for unmatched routes
    return new Response(JSON.stringify({
      success: false,
      error: 'Not found',
    }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Internal server error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
