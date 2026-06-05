# alphaarena-dns-configuration

_Saved: 2026-06-05_

# AlphaArena DNS 配置问题

## 问题诊断 (2026-06-06)

### 现象
- alphaarena.app 显示 "Under Construction" 占位页面
- Vercel 项目配置正确，部署成功
- 但访问域名看到的是 Squarespace 的占位页面

### 根因
域名 `alphaarena.app` 的 nameservers 指向 Google Domains (`ns-cloud-a*.googledomains.com`)，而 Google Domains 的 DNS A 记录指向 Squarespace 的 IP：
- 198.49.23.144
- 198.185.159.144
- 198.185.159.145
- 198.49.23.145

### 解决方案
需要在 Google Domains 控制面板修改 DNS：

**选项 A（推荐）**：修改 A 记录
1. 登录 Google Domains
2. 进入 alphaarena.app 的 DNS 设置
3. 添加/修改 A 记录：
   - `@` → `76.76.21.21`
   - `www` → `76.76.21.21`
4. 等待 DNS 传播（通常几分钟到几小时）

**选项 B**：修改 Nameservers
将 nameservers 改为 Vercel 的：
- `ns1.vercel-dns.com`
- `ns2.vercel-dns.com`

### 验证命令
```bash
# 检查 DNS 是否正确
dig alphaarena.app +short
# 应返回: 76.76.21.21

# 检查 HTTP 响应
curl -sI https://alphaarena.app | head -5
# 应显示 server: Vercel
```

### 同样问题影响
- alphaarena.xyz - 也指向 Squarespace
- alphaarena.com - 指向未知 IP，需确认

### Vercel 正确配置
- Vercel 项目名: alphaarena
- Production URL: https://alphaarena-gxcsoccer-s-team.vercel.app
- 框架: Vite
- 输出目录: dist/client
- 域名绑定: 已正确绑定 alphaarena.app, alphaarena.com, alphaarena.xyz