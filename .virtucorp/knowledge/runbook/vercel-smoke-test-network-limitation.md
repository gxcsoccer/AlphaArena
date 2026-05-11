# vercel-smoke-test-network-limitation

_Saved: 2026-05-11_

# Vercel 冒烟测试网络限制

## 问题

从中国大陆运行 UI acceptance tests (`vc_ui_accept`) 访问 Vercel 部署的应用时，会遇到网络限制：
- 页面显示 "Error: Network Error"
- API 健康检查失败
- curl/web_fetch 无法连接到 Vercel 域名

## 根因

Vercel CDN 边缘节点在中国可能被限制访问。这不是生产环境 bug，而是测试环境网络限制。

## 验证方法

使用 Vercel CLI 检查部署状态（CLI 使用不同网络路径）：
```bash
vercel ls
```

如果部署显示 `● Ready` 状态，生产环境正常。

## 解决方案

1. **短期**：通过 Vercel CLI 确认部署状态，不依赖 UI 测试
2. **长期**：从非受限环境运行冒烟测试（VPN、海外服务器、或 GitHub Actions）
3. **备选**：配置 Vercel 使用中国可访问的 CDN（如阿里云）

## 判断标准

| 检查方式 | 结果 | 判断 |
|---------|------|------|
| UI 测试 Network Error | 失败 | ⚠️ 待确认 |
| Vercel CLI `vercel ls` | Ready | ✅ 生产正常 |
| curl/web_fetch | 失败 | ⚠️ 网络限制 |

**不要因 UI 测试 Network Error 创建 P0 bug** — 先用 Vercel CLI 确认部署状态。