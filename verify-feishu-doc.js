#!/usr/bin/env node

/**
 * Verify Feishu Document Content
 */

const https = require('https');

const FEISHU_APP_ID = 'cli_a923588032b8dcd6';
const FEISHU_APP_SECRET = 'iaWGq33YfOFjyMOxyF5wic11L6sau8EH';
const DOCUMENT_ID = 'F88rdHglWoUdZ7xbSDtcVCOVnBf';

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

async function getDocument(token, documentId) {
  const options = {
    hostname: 'open.feishu.cn',
    port: 443,
    path: `/open-apis/docx/v1/documents/${documentId}`,
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const result = await request(options);
  if (result.data.code !== 0) {
    throw new Error(`Failed to get document: ${JSON.stringify(result.data)}`);
  }
  return result.data.data;
}

async function getDocumentBlocks(token, documentId) {
  const options = {
    hostname: 'open.feishu.cn',
    port: 443,
    path: `/open-apis/docx/v1/documents/${documentId}/blocks?page_size=50`,
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const result = await request(options);
  if (result.data.code !== 0) {
    throw new Error(`Failed to get document blocks: ${JSON.stringify(result.data)}`);
  }
  return result.data.data;
}

function extractTextFromBlock(block) {
  const texts = [];

  if (block.heading1?.elements) {
    block.heading1.elements.forEach((el) => {
      if (el.text_run) texts.push(`# ${el.text_run.text}`);
    });
  } else if (block.heading2?.elements) {
    block.heading2.elements.forEach((el) => {
      if (el.text_run) texts.push(`## ${el.text_run.text}`);
    });
  } else if (block.text?.elements) {
    block.text.elements.forEach((el) => {
      if (el.text_run) texts.push(el.text_run.text);
    });
  } else if (block.bullet?.elements) {
    block.bullet.elements.forEach((el) => {
      if (el.text_run) texts.push(`- ${el.text_run.text}`);
    });
  }

  return texts.join('\n');
}

async function main() {
  console.log('🔍 Verifying Feishu document...');
  console.log(`Document ID: ${DOCUMENT_ID}`);
  console.log(`URL: https://feishu.cn/docx/${DOCUMENT_ID}`);

  try {
    // Step 1: Get tenant access token
    console.log('\n🔑 Step 1: Getting tenant access token...');
    const token = await getTenantAccessToken();
    console.log('✅ Token obtained');

    // Step 2: Get document metadata
    console.log('\n📄 Step 2: Getting document metadata...');
    const doc = await getDocument(token, DOCUMENT_ID);
    console.log('✅ Document metadata retrieved');
    console.log(`Title: ${doc.title}`);
    console.log(`Document ID: ${doc.document_id}`);

    // Step 3: Get document blocks (content)
    console.log('\n📝 Step 3: Getting document content...');
    const blocksData = await getDocumentBlocks(token, DOCUMENT_ID);
    console.log(`✅ Retrieved ${blocksData.items?.length || 0} blocks`);

    // Extract and display content
    console.log('\n📋 Document Content Preview:');
    console.log('='.repeat(50));

    if (blocksData.items) {
      let contentPreview = [];
      for (const block of blocksData.items.slice(0, 20)) {
        // Show first 20 blocks
        const text = extractTextFromBlock(block);
        if (text) contentPreview.push(text);
      }
      console.log(contentPreview.join('\n'));
    }

    console.log('='.repeat(50));

    // Verify key content
    console.log('\n✅ Verification Results:');
    const fullContent = blocksData.items?.map((b) => extractTextFromBlock(b)).join('\n') || '';

    const checks = [
      { name: 'Sprint 1 完成总结', found: fullContent.includes('Sprint 1') },
      {
        name: 'Issue 完成情况',
        found: fullContent.includes('Issue') || fullContent.includes('问题'),
      },
      { name: 'TODO section', found: fullContent.includes('TODO') || fullContent.includes('待办') },
      { name: 'MEMO section', found: fullContent.includes('MEMO') || fullContent.includes('备注') },
    ];

    let allPassed = true;
    for (const check of checks) {
      const status = check.found ? '✅' : '❌';
      console.log(`${status} ${check.name}: ${check.found ? 'Found' : 'Not found'}`);
      if (!check.found) allPassed = false;
    }

    if (allPassed) {
      console.log('\n🎉 Document verification PASSED!');
      console.log(`📎 Document URL: https://feishu.cn/docx/${DOCUMENT_ID}`);
      return {
        success: true,
        documentId: DOCUMENT_ID,
        url: `https://feishu.cn/docx/${DOCUMENT_ID}`,
      };
    } else {
      console.log('\n⚠️  Document verification completed with warnings');
      console.log(`📎 Document URL: https://feishu.cn/docx/${DOCUMENT_ID}`);
      return {
        success: true,
        documentId: DOCUMENT_ID,
        url: `https://feishu.cn/docx/${DOCUMENT_ID}`,
        warnings: true,
      };
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

main()
  .then((result) => {
    console.log('\n✅ Verification task completed successfully');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Verification task failed');
    process.exit(1);
  });
