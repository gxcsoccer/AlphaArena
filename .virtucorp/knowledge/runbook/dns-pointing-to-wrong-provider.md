# dns-pointing-to-wrong-provider

_Saved: 2026-05-21_

# DNS 指向错误服务商的排查与修复

## 症状
- 访问域名显示 Squarespace/Wix/其他建站平台的占位页面
- Vercel 部署正常，但域名无法访问

## 排查步骤

1. **检查 DNS 解析**
   ```bash
   dig yourdomain.com +short
   dig www.yourdomain.com +short
   ```

2. **确认 Vercel 部署状态**
   ```bash
   vercel ls --prod
   ```

3. **检查 Vercel 域名配置**
   ```bash
   vercel domains inspect yourdomain.com
   ```

## 常见原因
域名之前托管在其他平台（Squarespace、Wix 等），迁移后 DNS 记录未更新

## 修复方案

### 方案 A：修改 DNS 记录（推荐）
在域名注册商处修改：
- A 记录: `@` → `76.76.21.21` (Vercel IP)
- CNAME: `www` → `cname.vercel-dns.com`

### 方案 B：切换 Nameservers
将域名的 nameservers 改为 Vercel 的：
- `ns1.vercel-dns.com`
- `ns2.vercel-dns.com`

## 验证
```bash
curl -sI https://yourdomain.com | grep -i server
# 应显示 Vercel 相关信息
```

## 案例
- Issue #799: alphaarena.app 指向 Squarespace 而非 Vercel
- 原因：域名之前托管在 Squarespace，迁移后 DNS 未更新
- 修复：在 Google Domains 修改 A 记录指向 76.76.21.21