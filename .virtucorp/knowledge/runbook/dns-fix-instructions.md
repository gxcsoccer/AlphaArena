# dns-fix-instructions

_Saved: 2026-06-07_

# AlphaArena DNS 配置修复指南

## 问题症状
- alphaarena.app 显示 Squarespace "Coming Soon" 页面
- 用户无法访问应用

## 根因
DNS 记录指向 Squarespace IP 而非 Vercel

## 修复步骤（Google Domains）

### 1. 登录域名管理
访问 https://domains.google.com

### 2. 修复 alphaarena.app
1. 选择 alphaarena.app
2. 进入 DNS → Custom resource records
3. 删除所有现有 A 记录（指向 198.49.23.xxx 或 198.185.159.xxx）
4. 添加新记录：
   - 名称: `@`
   - 类型: `A`
   - TTL: `3600`
   - 值: `76.76.21.21`
5. 添加 www 记录：
   - 名称: `www`
   - 类型: `CNAME`
   - TTL: `3600`
   - 值: `cname.vercel-dns.com`

### 3. 修复 alphaarena.xyz
重复相同步骤

### 4. 验证
等待 DNS 传播（5-30分钟），然后：
```bash
dig +short alphaarena.app A
# 应该返回: 76.76.21.21
```

## Vercel 端配置（已完成 ✓）
- 域名已添加到 Vercel 项目
- 无需额外操作