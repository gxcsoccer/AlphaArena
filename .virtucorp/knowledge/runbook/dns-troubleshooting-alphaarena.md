# dns-troubleshooting-alphaarena

_Saved: 2026-05-25_

# DNS 故障排查指南 - alphaarena.app

## 症状
- 生产环境 https://alphaarena.app 显示 "We're under construction" 占位页
- 页面有 Squarespace 标识
- 应用无法使用

## 快速诊断

```bash
# 检查 DNS 解析
dig alphaarena.app +short

# 如果返回 Squarespace IP (198.49.23.x 或 198.185.159.x)，说明 DNS 配置错误
# 正确应该返回: 76.76.21.21 (Vercel)
```

## 根本原因
域名 DNS 记录指向 Squarespace 而非 Vercel。

## 修复步骤

### 需要 Investor 操作（在 Google Domains）

1. 登录 [Google Domains](https://domains.google.com/)
2. 选择 `alphaarena.app`
3. 进入 DNS 设置
4. 删除现有 A 记录和 CNAME 记录
5. 添加：
   - A 记录: `@` → `76.76.21.21`
   - A 记录: `www` → `76.76.21.21`
6. 保存

### 验证修复

```bash
# 等待 5-30 分钟后验证
dig alphaarena.app +short
# 期望: 76.76.21.21

curl -s https://alphaarena.app | grep '<title>'
# 期望: AlphaArena 相关标题
```

## 相关文件
- `DNS-FIX-INSTRUCTIONS.md` - 详细修复指南
- Issue #803 - P0 Bug 追踪

## 历史记录
- 2026-05-25: 首次诊断，确认为 DNS 配置问题，非代码 Bug