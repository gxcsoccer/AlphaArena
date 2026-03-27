# vercel-domain-conflict-resolution

_Saved: 2026-03-27_

# Vercel 域名冲突解决方案

## 问题症状
生产环境 URL 显示错误的应用内容（如占位页面或其他项目）

## 诊断步骤

1. **检查 Vercel 项目列表**
   ```bash
   vercel project ls
   ```
   查看是否有多个相似名称的项目

2. **检查生产 URL 内容**
   ```bash
   curl -s https://your-production-url.vercel.app | head -50
   ```
   确认返回的是正确框架（Vite vs Next.js）

3. **检查域名归属**
   ```bash
   vercel domains inspect your-domain.vercel.app
   ```

## 解决方案

### 情况1：域名被同一团队的其他项目占用
1. 删除占用域名的旧项目：
   ```bash
   vercel remove old-project-name
   ```
2. 等待域名释放（可能需要几分钟到几小时）
3. 将域名添加到正确项目：
   ```bash
   vercel domains add your-domain.vercel.app
   ```

### 情况2：域名被其他团队/账户占用
1. 当前项目使用默认分配的域名（如 `alphaarena-eight.vercel.app`）
2. 添加自定义域名：
   ```bash
   vercel domains add your-custom-domain.com
   ```
3. 配置 DNS（需要 domain owner 操作）
4. 联系 Vercel 支持释放域名

## 本次修复记录 (2026-03-27)

- **问题**: `alpha-arena.vercel.app` 显示 Next.js 应用而非 Vite 应用
- **原因**: 存在两个 Vercel 项目（`alphaarena` 和 `alpha-arena`），域名被错误项目占用
- **已删除**: `alpha-arena` 项目
- **可用 URL**: `https://alphaarena-eight.vercel.app`
- **未解决**: `alpha-arena.vercel.app` 域名仍被占用，可能需要 Vercel 支持介入

## 预防措施

1. 项目命名时避免使用连字符变体（如 `alpha-arena` vs `alphaarena`）
2. 使用 `vercel.json` 明确配置项目名称
3. 定期清理不用的 Vercel 项目