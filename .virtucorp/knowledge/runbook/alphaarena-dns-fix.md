# alphaarena-dns-fix

_Saved: 2026-05-23_

# AlphaArena DNS 修复指南

## 问题描述
`alphaarena.app` 完全不可访问，返回 ERR_CONNECTION_CLOSED 错误。

## 根本原因
DNS A 记录配置错误，指向 Squarespace 停车页面 IP 而非 Vercel。

## 诊断证据

### 当前 DNS 配置（错误）
```
$ nslookup alphaarena.app
Name:   alphaarena.app
Address: 198.49.23.145
Address: 198.185.159.145
Address: 198.49.23.144
Address: 198.185.159.144
```

这些 IP 属于 Squarespace（域名注册商）的停车页面，没有 SSL 证书。

### 正确配置
- Vercel A 记录：`76.76.21.21`
- 或 Vercel CNAME：`cname.vercel-dns.com`

## 修复步骤

### 步骤 1：访问 DNS 管理面板
- Nameservers 是 Google Domains（ns-cloud-a1/2/3/4.googledomains.com）
- 需要访问 Google Domains 或 Squarespace 控制面板

### 步骤 2：修改 DNS 记录
删除现有的 A 记录，添加：
```
类型: A
名称: @
值: 76.76.21.21
TTL: 3600（或默认）
```

或者使用 CNAME：
```
类型: CNAME
名称: @
值: cname.vercel-dns.com
```

### 步骤 3：验证修复
```bash
# 等待 DNS 传播（5-30 分钟）
nslookup alphaarena.app

# 应该返回 76.76.21.21 或 Vercel 的 IP

# 测试 HTTPS
curl -I https://alphaarena.app
# 应该返回 200 OK
```

## Vercel 项目信息
- Project ID: prj_QfKnQpqG5OcARmx6TLUTUWiOkVc6
- Project Name: alphaarena
- GitHub: https://github.com/gxcsoccer/AlphaArena

## 注意事项
- DNS 传播可能需要 5-30 分钟
- Vercel 会自动配置 SSL 证书（Let's Encrypt）
- 修改后 Vercel 会自动检测域名变更