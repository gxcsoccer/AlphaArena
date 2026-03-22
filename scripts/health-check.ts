/**
 * Production Health Check Tests
 * 部署后验证测试
 * 
 * 运行方式：
 * E2E_BASE_URL=https://alphaarena.vercel.app npx ts-node --transpile-only tests/deployment/health-check.test.ts
 */

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';

interface HealthCheckResult {
  name: string;
  passed: boolean;
  message: string;
  duration?: number;
}

const results: HealthCheckResult[] = [];

function logResult(result: HealthCheckResult) {
  results.push(result);
  const icon = result.passed ? '✅' : '❌';
  const duration = result.duration ? ` (${result.duration}ms)` : '';
  console.log(`${icon} ${result.name}: ${result.message}${duration}`);
}

async function checkFrontendHealth(): Promise<void> {
  console.log('\n📡 检查前端服务...');
  
  const start = Date.now();
  try {
    const response = await fetch(BASE_URL);
    const duration = Date.now() - start;
    
    if (response.ok) {
      logResult({
        name: '前端服务',
        passed: true,
        message: `HTTP ${response.status}`,
        duration,
      });
    } else {
      logResult({
        name: '前端服务',
        passed: false,
        message: `HTTP ${response.status}`,
        duration,
      });
    }
  } catch (error) {
    logResult({
      name: '前端服务',
      passed: false,
      message: `连接失败: ${(error as Error).message}`,
    });
  }
}

async function checkAPIHealth(): Promise<void> {
  console.log('\n🔌 检查 API 服务...');
  
  const apiEndpoints = [
    { name: '用户 API', path: '/api/users' },
    { name: '信号 API', path: '/api/signals' },
    { name: '市场 API', path: '/api/marketplace' },
  ];
  
  for (const endpoint of apiEndpoints) {
    const start = Date.now();
    try {
      const response = await fetch(`${BASE_URL}${endpoint.path}`);
      const duration = Date.now() - start;
      
      // API 可能返回 401 或其他状态，只要不是 5xx 就算正常
      const passed = response.status < 500;
      
      logResult({
        name: endpoint.name,
        passed,
        message: `HTTP ${response.status}`,
        duration,
      });
    } catch (error) {
      logResult({
        name: endpoint.name,
        passed: false,
        message: `连接失败: ${(error as Error).message}`,
      });
    }
  }
}

async function checkSupabaseConnection(): Promise<void> {
  console.log('\n🗄️ 检查 Supabase 连接...');
  
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  
  if (!supabaseUrl) {
    logResult({
      name: 'Supabase URL',
      passed: false,
      message: '环境变量未配置',
    });
    return;
  }
  
  const start = Date.now();
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        'apikey': process.env.VITE_SUPABASE_ANON_KEY || '',
      },
    });
    const duration = Date.now() - start;
    
    logResult({
      name: 'Supabase 连接',
      passed: response.status < 500,
      message: `HTTP ${response.status}`,
      duration,
    });
  } catch (error) {
    logResult({
      name: 'Supabase 连接',
      passed: false,
      message: `连接失败: ${(error as Error).message}`,
    });
  }
}

async function checkSecurityHeaders(): Promise<void> {
  console.log('\n🔒 检查安全头...');
  
  const securityHeaders = [
    'X-Content-Type-Options',
    'X-Frame-Options',
    'X-XSS-Protection',
    'Referrer-Policy',
  ];
  
  try {
    const response = await fetch(BASE_URL);
    const headers = response.headers;
    
    for (const header of securityHeaders) {
      const value = headers.get(header);
      if (value) {
        logResult({
          name: header,
          passed: true,
          message: value,
        });
      } else {
        logResult({
          name: header,
          passed: false,
          message: '未设置',
        });
      }
    }
  } catch (error) {
    logResult({
      name: '安全头检查',
      passed: false,
      message: `检查失败: ${(error as Error).message}`,
    });
  }
}

async function checkPerformance(): Promise<void> {
  console.log('\n⚡ 检查性能指标...');
  
  const start = Date.now();
  try {
    const response = await fetch(BASE_URL);
    const duration = Date.now() - start;
    
    // 目标：首字节时间 < 600ms
    const passed = duration < 600;
    
    logResult({
      name: '首字节时间 (TTFB)',
      passed,
      message: `${duration}ms (目标: < 600ms)`,
      duration,
    });
    
    // 检查响应大小
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      const sizeKB = parseInt(contentLength) / 1024;
      logResult({
        name: '首页大小',
        passed: sizeKB < 500, // 目标 < 500KB
        message: `${sizeKB.toFixed(2)} KB`,
      });
    }
  } catch (error) {
    logResult({
      name: '性能检查',
      passed: false,
      message: `检查失败: ${(error as Error).message}`,
    });
  }
}

async function checkBuildInfo(): Promise<void> {
  console.log('\n📦 检查构建信息...');
  
  try {
    const response = await fetch(BASE_URL);
    const html = await response.text();
    
    // 检查是否包含预期的资源文件
    const hasAssets = html.includes('/assets/');
    logResult({
      name: '资源文件引用',
      passed: hasAssets,
      message: hasAssets ? '资源文件正常' : '未找到资源文件',
    });
    
    // 检查是否是 React 应用
    const hasReact = html.includes('root') || html.includes('react');
    logResult({
      name: 'React 应用',
      passed: hasReact,
      message: hasReact ? 'React 应用正常挂载' : '未检测到 React 应用',
    });
  } catch (error) {
    logResult({
      name: '构建检查',
      passed: false,
      message: `检查失败: ${(error as Error).message}`,
    });
  }
}

function printSummary(): void {
  console.log('\n' + '='.repeat(50));
  console.log('📊 健康检查总结');
  console.log('='.repeat(50));
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  const percentage = ((passed / total) * 100).toFixed(0);
  
  console.log(`通过: ${passed}/${total} (${percentage}%)`);
  
  if (passed === total) {
    console.log('\n✅ 所有检查通过！部署验证成功！');
    process.exit(0);
  } else {
    console.log('\n⚠️ 部分检查未通过，请查看上述详情。');
    
    // 列出失败的检查
    const failed = results.filter(r => !r.passed);
    if (failed.length > 0) {
      console.log('\n失败的检查：');
      failed.forEach(r => {
        console.log(`  ❌ ${r.name}: ${r.message}`);
      });
    }
    
    process.exit(1);
  }
}

async function main(): Promise<void> {
  console.log('🏥 AlphaArena 生产环境健康检查');
  console.log(`📍 目标 URL: ${BASE_URL}`);
  console.log(`⏰ 检查时间: ${new Date().toISOString()}`);
  console.log('='.repeat(50));
  
  await checkFrontendHealth();
  await checkAPIHealth();
  await checkSupabaseConnection();
  await checkSecurityHeaders();
  await checkPerformance();
  await checkBuildInfo();
  
  printSummary();
}

main().catch(console.error);