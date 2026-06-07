# dns-fix-required-investor-action

_Saved: 2026-06-07_

# DNS 配置修复指南

## 问题诊断

域名 `alphaarena.app` 和 `alphaarena.xyz` 的 DNS 记录指向 Squarespace，导致访问时显示 "Under Construction" 占位页。

**根因**：DNS A 记录指向错误的 IP 地址。

```
当前状态:
  alphaarena.app A → 198.49.23.144 (Squarespace)  ❌
  
应为:
  alphaarena.app A → 76.76.21.21 (Vercel)  ✅
```

## 修复步骤

### 1. 登录域名管理面板

访问 https://domains.google.com 或你的域名注册商后台。

### 2. 修改 DNS 记录

对 `alphaarena.app` 和 `alphaarena.xyz` 分别执行：

| 操作 | 记录类型 | 名称 | 值 |
|------|---------|------|-----|
| 删除 | A | @ | 198.49.23.xxx / 198.185.159.xxx |
| 删除 | CNAME | www | ext-sq.squarespace.com |
| **添加** | A | @ | `76.76.21.21` |
| **添加** | CNAME | www | `cname.vercel-dns.com` |

### 3. 等待 DNS 传播

- 通常需要 5-30 分钟
- 可用以下命令验证：
  ```bash
  dig +short alphaarena.app A
  # 应返回: 76.76.21.21
  
  curl -sI https://alphaarena.app | grep -i server
  # 应返回: server: Vercel
  ```

## 临时访问

DNS 修复前可通过 Vercel 预览 URL 访问：
- https://alphaarena-gxcsoccer-s-team.vercel.app
- https://alphaarena-eight.vercel.app

## 状态

- Issue: #820
- Labels: `status/blocked`, `needs-investor-action`, `blocked/dns-config`
- 等待 investor 操作