# AlphaArena 生产部署检查清单

## 部署前检查 (Pre-Deployment)

### 1. 代码质量
- [ ] 所有测试通过：`npm test` (目标：173 suites / 2984 tests)
- [ ] TypeScript 编译无错误：`npm run build`
- [ ] ESLint 无严重问题：`npm run lint`
- [ ] 代码格式化检查：`npm run format:check`

### 2. 环境变量配置
在 Vercel Dashboard → Settings → Environment Variables 中确认：

- [ ] `VITE_API_URL` = `https://plnylmnckssnfpwznpwf.supabase.co/functions/v1`
- [ ] `VITE_WS_URL` = `wss://alphaarena-production.up.railway.app`
- [ ] `VITE_SUPABASE_URL` = `https://plnylmnckssnfpwznpwf.supabase.co`
- [ ] `VITE_SUPABASE_ANON_KEY` = (从 Supabase Dashboard 获取)

**重要**：确保这些变量在 **Production** 环境中设置，并且标记为 **Build** 变量。

### 3. Supabase 服务状态
- [ ] Supabase 项目状态正常
- [ ] Edge Functions 已部署且正常工作
- [ ] 数据库迁移已应用
- [ ] RLS (Row Level Security) 策略已配置

### 4. Railway WebSocket 服务
- [ ] WebSocket 服务正在运行
- [ ] 健康检查端点响应正常
- [ ] 连接数和资源使用在正常范围

### 5. 依赖项检查
- [ ] `package-lock.json` 已更新
- [ ] 无已知安全漏洞：`npm audit`
- [ ] 无过期的重要依赖

### 6. 构建 Bundle 分析
```bash
npm run build
```
检查输出：
- [ ] 无构建错误
- [ ] Bundle 大小合理（主要 chunks < 1MB）
- [ ] 无意外的敏感信息泄露

---

## 部署执行 (Deployment)

### 1. 创建发布分支
```bash
git checkout main
git pull origin main
git checkout -b release/$(date +%Y%m%d-%H%M%S)
```

### 2. 执行部署
```bash
# 方式一：通过 Vercel CLI
vercel --prod

# 方式二：推送到 main 分支触发自动部署
git push origin main
```

### 3. 记录部署信息
- [ ] 记录部署 ID (Deployment ID)
- [ ] 记录部署时间
- [ ] 记录 Git commit hash
- [ ] 记录部署 URL

---

## 部署后验证 (Post-Deployment)

### 1. 基础功能检查
- [ ] 首页正常加载
- [ ] 用户可以登录
- [ ] 交易对切换正常
- [ ] 图表数据加载正常

### 2. API 连接检查
- [ ] API 请求返回正常（检查 Network 标签）
- [ ] WebSocket 连接成功
- [ ] 实时数据更新正常

### 3. 监控检查
- [ ] 检查 Supabase Dashboard 日志无错误
- [ ] 检查 Vercel 部署日志
- [ ] 检查 Railway 服务状态

### 4. 性能检查
- [ ] 首屏加载时间 < 3s
- [ ] API 响应时间 < 500ms
- [ ] 无内存泄漏迹象

### 5. 安全检查
- [ ] 无敏感信息泄露到客户端
- [ ] CORS 配置正确
- [ ] CSP 头正确设置

---

## 回滚准备 (Rollback Readiness)

如果部署出现问题，立即执行回滚：

### 快速回滚步骤
1. 在 Vercel Dashboard 中找到上一个成功的部署
2. 点击 "..." 菜单 → "Promote to Production"
3. 验证回滚成功

详细回滚流程见：[ROLLBACK_PROCEDURE.md](./ROLLBACK_PROCEDURE.md)

---

## 联系信息

### 服务提供商
- **Vercel**: https://vercel.com/dashboard
- **Supabase**: https://app.supabase.com
- **Railway**: https://railway.app/dashboard

### 紧急联系人
- 记录项目负责人联系方式
- 记录服务提供商支持渠道

---

## 部署记录模板

```markdown
## 部署记录 - YYYY-MM-DD HH:MM

### 基本信息
- 部署 ID:
- Commit Hash:
- 部署 URL:
- 执行人:

### 变更内容
- [变更描述]

### 验证结果
- [ ] 基础功能检查
- [ ] API 连接检查
- [ ] 监控检查
- [ ] 性能检查
- [ ] 安全检查

### 问题记录
- [如有问题，记录详情]

### 备注
- [其他需要记录的信息]
```