# dns-fix-required-investor-action

_Saved: 2026-06-07_

# DNS 配置问题处理指南

## 问题特征

当生产环境显示 "Under Construction" 占位页，且：
- Vercel 部署状态正常
- 域名已绑定到 Vercel 项目
- `curl -sI https://alphaarena.app | grep -i server` 返回 `Squarespace`

这是 **DNS 配置问题**，不是代码问题。

## 根本原因

域名 DNS A 记录指向 Squarespace IP（198.49.23.xxx），而非 Vercel IP（76.76.21.21）。

## 解决方案

**需要 investor 在 Google Domains 手动操作**：

1. 登录 https://domains.google.com
2. 选择域名 alphaarena.app
3. 进入 DNS → Custom resource records
4. 删除指向 Squarespace 的 A 记录
5. 添加新 A 记录：
   - 类型: A
   - 名称: @
   - 值: 76.76.21.21
6. 添加 CNAME：
   - 类型: CNAME
   - 名称: www
   - 值: cname.vercel-dns.com
7. 对 alphaarena.xyz 重复相同步骤
8. 等待 DNS 传播（5-30 分钟）

## 验证命令

```bash
dig +short alphaarena.app A
# 应返回: 76.76.21.21

curl -sI https://alphaarena.app | grep -i server
# 应返回: server: Vercel
```

## 系统处理规则

**重要**：标记 `needs-investor-action` 的 Issue：
- ❌ 不要派发 Dev（Dev 无法修复外部配置）
- ❌ 不要创建重复 Issue
- ✅ 向 investor 发送操作指引
- ✅ 等待 investor 确认完成后再验证

## 历史记录

- 2026-05-15 ~ 2026-06-07：系统创建 15+ 个重复 Issue (#820, #815, #814, #813...)
- Dev 多次诊断确认是 DNS 问题
- 问题仍未解决，等待 investor 操作