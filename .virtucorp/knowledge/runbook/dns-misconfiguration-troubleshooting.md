# dns-misconfiguration-troubleshooting

_Saved: 2026-05-28_

# DNS 配置错误排查手册

## 症状

- 访问自定义域名（如 alphaarena.app）显示 "Under Construction" 占位页面
- 页面没有应用功能，只有域名显示

## 排查步骤

### 1. 检查 DNS 解析

```bash
nslookup alphaarena.app
# 或
dig alphaarena.app +short
```

**正确结果**: 应返回 Vercel IP `76.76.21.21`
**错误结果**: 返回 `198.49.23.*` 或 `198.185.159.*` (Squarespace)

### 2. 检查 HTTP 响应头

```bash
curl -sI https://alphaarena.app/ | grep -i server
```

**正确结果**: `server: Vercel` 或类似
**错误结果**: `server: Squarespace`

### 3. 验证 Vercel 部署

```bash
# 检查 Vercel 默认域名
nslookup alpha-arena.vercel.app
curl -sI https://alpha-arena.vercel.app/
```

如果 Vercel 默认域名正常，但自定义域名异常 → DNS 配置问题

## 修复方案

在域名 Registrar（Google Domains/Squarespace）更新 DNS：

1. 删除指向 Squarespace 的 A 记录
2. 添加 A 记录: `@ → 76.76.21.21`
3. 添加 CNAME 记录: `www → cname.vercel-dns.com`
4. 等待 DNS 传播（5-30 分钟）

## 相关 Issues

- #803, #805, #806, #807, #809 - 重复报告同一 DNS 问题
- 文档: docs/deployment/DNS_CONFIGURATION.md

## 教训

- 多个 P0 Issues 可能是同一问题的重复报告
- 检查 DNS 解析应该是第一排查步骤
- 标记 `needs-investor-action` 表示需要域名所有者操作