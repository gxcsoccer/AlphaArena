# AlphaArena 回滚流程

## 概述

本文档详细描述了 AlphaArena 生产环境的回滚流程，确保在出现严重问题时能够快速恢复服务。

---

## 回滚场景

### 何时需要回滚

1. **功能性严重问题**
   - 用户无法登录
   - 核心功能（交易、图表）不可用
   - 数据丢失或损坏

2. **性能问题**
   - 页面加载时间 > 10s
   - API 响应时间 > 5s
   - 大量 5xx 错误

3. **安全问题**
   - 发现数据泄露
   - 认证绕过
   - 注入攻击漏洞

4. **用户体验严重下降**
   - 界面完全无法使用
   - 大量用户投诉
   - 功能与预期严重不符

---

## 回滚方式

### 方式一：Vercel Dashboard 回滚（推荐）

这是最快、最安全的方式。

1. 登录 [Vercel Dashboard](https://vercel.com/dashboard)
2. 选择 AlphaArena 项目
3. 点击 **Deployments** 标签
4. 找到上一个成功的部署
5. 点击部署右侧的 "..." 菜单
6. 选择 **Promote to Production**
7. 等待几秒钟，验证回滚成功

**预计时间**：1-2 分钟

### 方式二：Vercel CLI 回滚

适用于命令行操作场景：

```bash
# 1. 查看最近的部署
vercel ls

# 2. 找到需要回滚的部署 URL（例如：alphaarena-abc123.vercel.app）

# 3. 将该部署设置为生产环境
vercel alias set alphaarena-abc123.vercel.app alphaarena.vercel.app

# 或使用部署 ID
vercel inspect [deployment-id]
```

**预计时间**：2-3 分钟

### 方式三：Git 回滚后重新部署

适用于代码有问题需要修复后重新部署：

```bash
# 1. 找到上一个成功的 commit
git log --oneline -10

# 2. 创建回滚分支
git checkout -b rollback/$(date +%Y%m%d-%H%M%S) [previous-good-commit]

# 3. 强制推送（会触发自动部署）
# 警告：这会改变历史，确保团队知情
git push origin HEAD:main --force

# 或者更安全的方式：创建 revert commit
git checkout main
git revert [bad-commit]
git push origin main
```

**预计时间**：5-10 分钟

---

## 分组件回滚

### 仅前端回滚

如果问题仅在前端代码，只需回滚 Vercel 部署：

```bash
vercel --prod
# 选择上一个成功的部署
```

### Supabase Edge Functions 回滚

如果 Edge Functions 有问题：

```bash
# 1. 查看函数版本
supabase functions list

# 2. 重新部署上一个版本
cd supabase/functions
git checkout [previous-version] -- [function-name]
supabase functions deploy [function-name]
```

### 数据库回滚

如果数据库迁移有问题：

```bash
# 1. 连接到 Supabase 数据库
supabase db remote connect

# 2. 回滚迁移（需要预先创建回滚脚本）
# 假设你有 rollback_[migration_name].sql
psql -f supabase/migrations/rollback_[migration_name].sql

# 3. 或使用 Supabase CLI
supabase migration repair [migration-id] --status reverted
```

**警告**：数据库回滚可能导致数据丢失，谨慎操作！

---

## 回滚验证清单

### 必须验证

- [ ] 网站可正常访问
- [ ] 用户可正常登录
- [ ] API 请求正常返回
- [ ] WebSocket 连接正常
- [ ] 无控制台错误

### 建议验证

- [ ] 核心用户流程正常
- [ ] 图表数据加载正常
- [ ] 订单提交功能正常
- [ ] 实时数据更新正常

---

## 回滚后行动

### 立即行动

1. **通知团队**
   - 通知所有相关人员回滚已完成
   - 说明回滚原因和影响范围

2. **问题记录**
   - 创建 GitHub Issue 记录问题
   - 添加标签 `priority/p0` 和 `type/bug`
   - 详细描述问题现象和复现步骤

3. **用户通知**
   - 如果影响用户，通过适当渠道通知
   - 说明问题已解决，服务已恢复

### 后续行动

1. **根因分析**
   - 分析问题根因
   - 确定需要修复的代码或配置

2. **修复开发**
   - 在 feature 分支修复问题
   - 添加测试防止回归
   - Code Review 后合并

3. **重新部署**
   - 按照正常流程重新部署
   - 额外关注之前出问题的功能

---

## 紧急联系

### 服务状态页面
- Vercel Status: https://www.vercel-status.com/
- Supabase Status: https://status.supabase.com/

### 支持
- Vercel Support: https://vercel.com/support
- Supabase Support: https://supabase.com/support

---

## 回滚脚本参考

### 快速状态检查脚本

```bash
#!/bin/bash
# check-status.sh

echo "=== AlphaArena 状态检查 ==="
echo ""

echo "1. 检查前端..."
curl -s -o /dev/null -w "前端状态: %{http_code} (响应时间: %{time_total}s)\n" https://alphaarena.vercel.app

echo ""
echo "2. 检查 API..."
curl -s -o /dev/null -w "API 状态: %{http_code} (响应时间: %{time_total}s)\n" https://plnylmnckssnfpwznpwf.supabase.co/functions/v1/users

echo ""
echo "3. 检查 WebSocket..."
# 需要使用 wscat 或类似工具
# wscat -c wss://alphaarena-production.up.railway.app

echo ""
echo "=== 检查完成 ==="
```

### 回滚通知模板

```
🚨 AlphaArena 生产环境回滚通知

时间：YYYY-MM-DD HH:MM
执行人：[名字]
原因：[简要说明]

回滚详情：
- 回滚前版本：[commit hash or deployment id]
- 回滚后版本：[commit hash or deployment id]
- 影响范围：[描述]

当前状态：✅ 服务已恢复

后续行动：
1. [待办事项1]
2. [待办事项2]

问题追踪：#[issue number]
```