# dns-configuration-alphaarena

_Saved: 2026-05-18_

# DNS 配置指南 - AlphaArena

## 问题现象
生产环境 https://alphaarena.app 显示「建设中」占位页，而非实际应用。

## 根本原因
域名 DNS 配置指向了错误的服务商（Squarespace），而非 Vercel。

## 正确配置

### 方案 A：添加 A 记录（推荐，快速生效）
在域名 DNS 管理后台添加：
```
类型: A
名称: @
值: 76.76.21.21
TTL: 3600
```

生效时间：5-30 分钟

### 方案 B：修改 Nameservers（完整控制）
将 nameservers 改为：
```
ns1.vercel-dns.com
ns2.vercel-dns.com
```

生效时间：24-48 小时

## 验证命令
```bash
# 检查 DNS 解析
dig alphaarena.app +short
# 应返回: 76.76.21.21

# 检查 HTTP 响应
curl -sI https://alphaarena.app | grep server
# 应返回: server: Vercel 或类似
```

## 相关域名
- alphaarena.app（主要）
- alphaarena.com（同样需要检查）
- www.alphaarena.com（需要配置 CNAME 或 A 记录）

## 注意事项
- 此问题无法通过代码修复
- 必须在域名注册商后台手动操作
- Google Domains 或 Squarespace 管理 DNS