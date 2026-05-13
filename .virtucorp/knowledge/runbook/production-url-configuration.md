# production-url-configuration

_Saved: 2026-05-13_

# AlphaArena Production URL Configuration

## 正确的生产环境 URL

**重要：** AlphaArena 的正确 Vercel 项目 URL 是：

```
https://alphaarena-eight.vercel.app
```

## 历史问题 (Issue #778, #781)

`alphaarena.vercel.app` 指向的是一个**不同的项目 (APL/BLACKROSE)**，不是 AlphaArena。

如果在 `alphaarena.vercel.app` 上执行烟雾测试，会看到：
- Header: "USER: GUEST", "ABOUT BLACKROSE", "JOIN DISCORD"
- Navigation: "LIVE", "LEADERBOARD", "MODELS"
- 这是 BLACKROSE 项目的界面，不是 AlphaArena

## 烟雾测试配置

烟雾测试文件 `.virtucorp/acceptance/smoke-test.yaml` 已正确配置：

```yaml
url: "https://alphaarena-eight.vercel.app"
```

## 验证命令

```bash
# 使用正确 URL 运行烟雾测试
vc_ui_accept_run file=smoke-test.yaml

# 或使用 vc_ui_accept 直接测试
vc_ui_accept url="https://alphaarena-eight.vercel.app" tasks=[...]
```

## 未来注意

创建 P0 bug issue 时，务必确认测试使用的 URL 是正确的：
- 正确：`alphaarena-eight.vercel.app`
- 错误：`alphaarena.vercel.app`（指向 BLACKROSE 项目）