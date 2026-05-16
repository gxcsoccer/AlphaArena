# P0 Bug #790 修复指南：DNS 配置错误

## 问题诊断

### 症状
- 生产环境 https://alphaarena.app 显示 Squarespace 占位页
- 所有用户无法使用应用

### 根因
**DNS 配置错误**：域名 `alphaarena.app` 的 DNS 记录指向 Squarespace 而非 Vercel。

### 验证证据

**当前 DNS 状态**：
```
$ dig +short alphaarena.app
198.49.23.144    ← Squarespace IP
198.185.159.145  ← Squarespace IP
198.49.23.145    ← Squarespace IP
198.185.159.144  ← Squarespace IP
```

**Vercel 部署状态**：
- ✅ 最新部署正常：`alphaarena-7gxet46ls-gxcsoccer-s-team.vercel.app`
- ✅ Alias 配置正确：`alphaarena.app` 已关联
- ❌ DNS 未指向 Vercel

**Vercel 域名检查**：
```
WARNING! This Domain is not configured properly.
需要：A alphaarena.app 76.76.21.21
```

## 修复方案（需要域名管理员操作）

### 方案 A：修改 DNS 记录（推荐，生效快）

登录 [Google Domains](https://domains.google.com)：

1. 进入 `alphaarena.app` 的 DNS 设置
2. **删除现有 A 记录**：
   - 删除所有指向 198.49.23.x 和 198.185.159.x 的 A 记录
3. **添加新 A 记录**：
   - 主机名：`@`（或留空）
   - 类型：`A`
   - 值：`76.76.21.21`
   - TTL：默认或 3600
4. **修改 www CNAME**：
   - 主机名：`www`
   - 类型：`CNAME`
   - 值：`cname.vercel-dns.com`
5. 保存更改

**生效时间**：5-60 分钟（取决于 TTL 和 DNS 传播）

### 方案 B：更改 Nameservers（彻底，生效慢）

在 Google Domains 域名设置中，将 nameservers 改为：
- `ns1.vercel-dns.com`
- `ns2.vercel-dns.com`

**生效时间**：24-48 小时

## 验证步骤

修复后，在本地运行：

```bash
# 检查 DNS 是否生效
dig +short alphaarena.app
# 应显示：76.76.21.21 或 Vercel 的 IP

# 访问生产环境
curl -I https://alphaarena.app
# 应返回 200 OK，且 X-Vercel-Id 头

# 或直接浏览器访问
open https://alphaarena.app
```

## 紧急程度

**P0 - 最高优先级**
- 生产环境完全不可用
- 所有用户受阻
- 修复需要域名管理员操作
- 预计修复时间：5-60 分钟（DNS 传播）

## 相关信息

- **Bug Issue**: #790
- **域名注册商**: Google Domains (Third Party)
- **Nameservers**: ns-cloud-a[1-4].googledomains.com
- **Vercel 项目**: gxcsoccer-s-team/alphaarena
- **最新部署**: https://alphaarena-7gxet46ls-gxcsoccer-s-team.vercel.app (✅ Ready)