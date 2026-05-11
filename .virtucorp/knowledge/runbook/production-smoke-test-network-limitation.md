# production-smoke-test-network-limitation

_Saved: 2026-05-11_

# 生产环境冒烟测试网络限制

## 问题

从中国大陆环境运行 UI acceptance tests 时，无法稳定访问 Vercel 部署的应用（`https://alphaarena.vercel.app`）。

## 表现

1. `web_fetch` 工具调用失败（fetch failed）
2. `curl` 命令超时或返回空响应
3. MidsceneJS 测试报告 "Network Error" 或 "Disconnected"

## 根因

中国访问 Vercel 服务存在网络限制，API 请求无法正常完成。

## 解决方案

### 方案 1：使用代理
在测试环境中配置代理，绕过网络限制。

### 方案 2：从非受限环境运行
- 使用 VPN 或海外服务器运行测试
- 或在 Vercel 的 Edge Functions 中运行自动化测试

### 方案 3：使用 Vercel Logs 检查
不依赖 UI 测试，通过 Vercel 部署日志和监控确认服务状态：
```bash
vercel logs alphaarena --output raw
```

### 方案 4：记录为已知限制
如果无法解决网络问题，在 Sprint 文档中记录测试限制，待后续解决。

## 当前状态

**已知限制**：生产环境冒烟测试因网络问题无法从当前环境完成。这不是生产 bug，而是测试基础设施限制。

## 建议

PM 应在 Sprint 规划中考虑此限制，可能需要：
1. 设置海外测试环境
2. 或将冒烟测试改为 API 健康检查（而非 UI 测试）