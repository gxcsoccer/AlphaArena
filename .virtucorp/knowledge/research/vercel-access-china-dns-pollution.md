# vercel-access-china-dns-pollution

_Saved: 2026-04-13_

# Vercel 访问问题诊断：DNS 污染与 SNI 阻断

## 诊断日期
2026-04-13

## 问题现象
AlphaArena 项目部署到 Vercel 后，所有 `*.vercel.app` URL 无法访问，返回连接超时。

## 根因分析

### 1. DNS 污染
在中国大陆，`*.vercel.app` 域名被 DNS 污染：
- 正常 IP：76.76.21.21 (Vercel)
- 实际返回：31.13.95.37 (Facebook) 或 108.160.162.104 (Dropbox)

验证方法：
```bash
dig alphaarena.vercel.app +short
# 返回错误 IP

dig alphaarena.vercel.app @8.8.8.8 +short
# Google DNS 也返回错误 IP（污染上游）
```

### 2. SNI 阻断
TLS 握手时，防火墙检测 SNI 字段：
- 如果包含 `vercel.app`，连接被重置
- 绕过 SNI 可正常访问（已验证）

验证方法：
```bash
# 带 SNI - 失败
curl -v --resolve "xxx.vercel.app:443:76.76.21.21" "https://xxx.vercel.app"
# Connection reset by peer

# 不带 SNI - 成功（需跳过证书验证）
curl -sk --connect-to "xxx.vercel.app:76.76.21.21" "https://76.76.21.21" \
  -H "Host: xxx.vercel.app"
```

## 解决方案

### 方案 1：使用自定义域名 + Cloudflare CDN
最可靠的方案：
1. 购买/使用自有域名（如 alphaarena.app）
2. 将域名 DNS 添加到 Cloudflare
3. Cloudflare 配置代理模式（橙色云图标）
4. Cloudflare 添加 Vercel 作为 origin
5. 修改 Vercel 项目域名配置

### 方案 2：正确配置自定义域名 DNS
如果用户有域名控制权：
1. 设置 A 记录：`域名 → 76.76.21.21`
2. 或修改 nameserver 为 Vercel DNS

注意：自定义域名仍可能被 SNI 阻断，需要配合 CDN。

### 方案 3：使用代理/VPN
临时调试可用，但不适合生产环境。

## Tailscale 影响
用户使用 Tailscale（DNS：100.100.100.100），可能加剧 DNS 解析问题：
- search domain：taildb2972.ts.net
- 建议检查 Tailscale 的 DNS 配置是否影响外部域名解析

## 重要结论
这不是 Vercel 服务问题，也不是代码问题。网站部署正常，只是网络访问被限制。