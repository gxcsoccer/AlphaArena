#!/usr/bin/env node

/**
 * Create Feishu Document for Sprint 1 Daily Report
 * Date: 2026-03-11
 * Using docs v1 API (legacy) which supports creating docs with content
 */

const https = require('https');

// Feishu credentials should be set via environment variables
const FEISHU_APP_ID = process.env.FEISHU_APP_ID;
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET;

if (!FEISHU_APP_ID || !FEISHU_APP_SECRET) {
  console.error('❌ Missing Feishu credentials. Please set FEISHU_APP_ID and FEISHU_APP_SECRET environment variables.');
  process.exit(1);
}

// Sprint 1 content in markdown
const DOCUMENT_TITLE = 'Sprint 1 每日报告 - 2026-03-11';
const DOCUMENT_CONTENT = `# Sprint 1 完成总结

## 完成情况
- ✅ 6 个 Issue 全部完成
- ✅ 137 个测试通过

## 完成的 Issue
1. Order Book (模拟订单簿)
2. Matching Engine (撮合引擎)
3. Portfolio Tracking (组合跟踪)
4. Strategy Interface (策略接口)
5. SMA Crossover Strategy (基线策略)
6. CLI Runner (CLI 运行器)

---

# TODO

- [ ] BC 迁移 ByteCycle 遗留空间任务

---

# MEMO

- Sprint 1 周期：2026-03-10 → 2026-03-11
- MVP 已完成，所有核心功能就绪
- 下一步：准备 Sprint 2 规划
`;

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function getTenantAccessToken() {
  const options = {
    hostname: 'open.feishu.cn',
    port: 443,
    path: '/open-apis/auth/v3/tenant_access_token/internal',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const body = {
    app_id: FEISHU_APP_ID,
    app_secret: FEISHU_APP_SECRET,
  };

  const result = await request(options, body);
  if (result.data.code !== 0) {
    throw new Error(`Failed to get tenant access token: ${JSON.stringify(result.data)}`);
  }
  return result.data.tenant_access_token;
}

async function createDocsWithContent(token, title, content) {
  // Try the legacy docs API
  const options = {
    hostname: 'open.feishu.cn',
    port: 443,
    path: '/open-apis/docs/v1/create',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  };

  const body = {
    title: title,
    content: content,
  };

  const result = await request(options, body);
  console.log('Create docs API response:', JSON.stringify(result.data, null, 2));

  if (result.data.code !== 0) {
    throw new Error(`Failed to create docs: ${JSON.stringify(result.data)}`);
  }

  // The legacy API returns doc_token
  return result.data.data.doc_token;
}

async function getDocsContent(token, docToken) {
  const options = {
    hostname: 'open.feishu.cn',
    port: 443,
    path: `/open-apis/docs/v1/get?doc_token=${docToken}`,
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const result = await request(options);
  console.log('Get docs API response:', JSON.stringify(result.data, null, 2));

  if (result.data.code !== 0) {
    throw new Error(`Failed to get docs: ${JSON.stringify(result.data)}`);
  }
  return result.data.data;
}

async function main() {
  console.log('📝 Creating Feishu document...');
  console.log(`Title: ${DOCUMENT_TITLE}`);

  try {
    // Step 1: Get tenant access token
    console.log('\n🔑 Step 1: Getting tenant access token...');
    const token = await getTenantAccessToken();
    console.log('✅ Token obtained');

    // Step 2: Create document with content using legacy docs API
    console.log('\n📄 Step 2: Creating document with legacy docs API...');
    const docToken = await createDocsWithContent(token, DOCUMENT_TITLE, DOCUMENT_CONTENT);
    console.log(`✅ Document created: ${docToken}`);

    // Step 3: Verify by reading the document
    console.log('\n🔍 Step 3: Verifying document...');
    const doc = await getDocsContent(token, docToken);
    console.log('✅ Document verified');
    console.log(`Document title: ${doc.title}`);

    // Generate Feishu document URL (legacy docs use different URL format)
    const documentUrl = `https://feishu.cn/docs/${docToken}`;
    console.log(`\n🎉 Document created successfully!`);
    console.log(`📎 URL: ${documentUrl}`);

    return { docToken, documentUrl, title: doc.title };
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

main()
  .then((result) => {
    console.log('\n✅ Task completed successfully');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Task failed');
    process.exit(1);
  });
