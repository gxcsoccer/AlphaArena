# supabase-function-deployment

_Saved: 2026-03-16_

# Supabase Edge Function 部署流程

## 问题背景

当修改 `supabase/functions/` 目录下的代码时，代码变更不会自动部署到 Supabase。需要手动部署才能生效。

## 前车之鉴

**Issue #165**: 代码变更（commit `0e80bf2`）修改了 `get-market-kline` 函数的 symbol 参数传递方式，但 Edge Function 未重新部署，导致生产环境返回错误数据。

### 症状

- 所有交易对（AAPL、ETH/USD）都返回 BTC/USD 的价格数据
- 前端功能正常，但后端返回错误数据

### 根因

- 前端发送 `symbol=AAPL` 作为 query parameter
- 后端旧版本从 URL 路径解析 symbol，解析失败后默认使用 `BTC/USD`

## 部署命令

```bash
# 部署单个函数
npx supabase functions deploy <function-name> --project-ref plnylmnckssnfpwznpwf

# 示例：部署 K 线数据函数
npx supabase functions deploy get-market-kline --project-ref plnylmnckssnfpwznpwf
```

## 检查部署状态

```bash
# 列出所有函数及其版本
npx supabase functions list --project-ref plnylmnckssnfpwznpwf
```

## 最佳实践

1. **任何修改 `supabase/functions/` 的 PR 合并后，都必须重新部署**
2. **在 Sprint 验收测试前，确认 Edge Function 版本号是否更新**
3. **添加 CI/CD 自动化部署（建议）**

## 自动化部署建议

在 GitHub Actions 中添加自动部署步骤：

```yaml
# .github/workflows/deploy-supabase-functions.yml
name: Deploy Supabase Functions

on:
  push:
    branches: [main]
    paths:
      - 'supabase/functions/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
      - run: supabase functions deploy --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```