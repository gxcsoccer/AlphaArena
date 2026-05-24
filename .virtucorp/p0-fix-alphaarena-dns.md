# P0 修复：alphaarena.app DNS 配置错误

## 问题

生产环境 https://alphaarena.app 显示 Squarespace 占位页，而非 AlphaArena 应用。

## 根因

**DNS 配置错误：**
- 域名 `alphaarena.app` 的 A 记录指向 Squarespace IP（198.185.159.144/145, 198.49.23.144/145）
- Vercel 期望的 IP：`76.76.21.21`

## 验证

```bash
# 当前 DNS 解析（错误）
$ dig alphaarena.app +short
198.185.159.145
198.185.159.144
198.49.23.145
198.49.23.144

# Vercel 部署正常
$ curl -I https://alphaarena-o67w6l5uv-gxcsoccer-s-team.vercel.app
# → 正常返回应用
```

## 修复方案

### 方案 A：修改 A 记录（推荐）

1. 登录 [Google Domains](https://domains.google.com/)
2. 选择域名 `alphaarena.app`
3. 进入 DNS 设置
4. 修改或添加 A 记录：
   - **主机名**：`@`（或留空表示根域名）
   - **类型**：A
   - **值**：`76.76.21.21`
   - **TTL**：3600（或默认）
5. 同时添加 www 的 CNAME：
   - **主机名**：`www`
   - **类型**：CNAME
   - **值**：`cname.vercel-dns.com`
6. 保存并等待 DNS 传播（通常 5-30 分钟）

### 方案 B：修改 Nameserver

1. 登录 [Google Domains](https://domains.google.com/)
2. 选择域名 `alphaarena.app`
3. 进入 DNS 设置
4. 切换到 "Use custom name servers"
5. 添加 Vercel nameservers：
   - `ns1.vercel-dns.com`
   - `ns2.vercel-dns.com`
6. 保存并等待传播（可能需要 24-48 小时）

## 推荐方案

**方案 A（修改 A 记录）**：更快生效，保持 DNS 管理在 Google Domains。

## 验证步骤

修改后，等待 DNS 传播（5-30 分钟），然后运行：

```bash
# 验证 DNS 指向正确 IP
dig alphaarena.app +short
# 应该返回：76.76.21.21

# 验证应用加载
curl -s https://alphaarena.app | head -20
# 应该包含：AlphaArena - 算法交易平台

# 运行验收测试
npx midscene-runner .virtucorp/acceptance/smoke-test.yaml --url https://alphaarena.app
```

## 状态

- [ ] 用户修改 DNS 配置
- [ ] DNS 传播完成
- [ ] 生产环境验证通过
- [ ] 关闭 Issue #803

## 注意

此问题无法通过代码修复，需要域名管理员操作。

---
Created: 2026-05-24
Issue: #803