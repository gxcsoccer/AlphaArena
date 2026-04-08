import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
};

// Default subscription plans data
const DEFAULT_PLANS = [
  {
    id: 'free',
    name: 'free',
    displayName: '免费版',
    price: 0,
    currency: 'CNY',
    billingPeriod: 'monthly',
    features: [
      '最多 3 个并发策略',
      '每日 10 次回测',
      '基础市场数据',
      '社区支持',
    ],
    limits: { maxStrategies: 3, dailyBacktests: 10 },
  },
  {
    id: 'pro',
    name: 'pro',
    displayName: '专业版',
    price: 99,
    currency: 'CNY',
    billingPeriod: 'monthly',
    features: [
      '无限策略运行',
      '无限回测',
      '高级市场数据 (Level 2)',
      'AI 策略助手',
      '风险预警通知',
      '数据导出',
      '优先支持',
    ],
    limits: { maxStrategies: -1, dailyBacktests: -1 },
    isPopular: true,
  },
  {
    id: 'enterprise',
    name: 'enterprise',
    displayName: '企业版',
    price: 0,
    currency: 'CNY',
    billingPeriod: 'monthly',
    features: [
      '所有 Pro 功能',
      '多用户团队管理',
      'API 访问（高配额）',
      '专属客户经理',
      '私有部署支持',
      'SLA 保障',
    ],
    limits: { maxStrategies: -1, dailyBacktests: -1 },
  },
];

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();

    // GET /plans - Get all available subscription plans
    if (req.method === 'GET' && (path === 'plans' || url.pathname.endsWith('/plans'))) {
      return new Response(
        JSON.stringify({ plans: DEFAULT_PLANS }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // GET /plans/:plan - Get a specific plan's details
    if (req.method === 'GET' && path && ['free', 'pro', 'enterprise'].includes(path)) {
      const plan = DEFAULT_PLANS.find(p => p.id === path);
      if (!plan) {
        return new Response(
          JSON.stringify({ error: 'Plan not found' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 404,
          }
        );
      }
      return new Response(
        JSON.stringify({ plan }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Handle other subscription routes - return placeholder for authenticated routes
    if (req.method === 'GET') {
      return new Response(
        JSON.stringify({ message: 'This endpoint requires authentication' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      }
    );
  } catch (error) {
    console.error('Error in subscription function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});