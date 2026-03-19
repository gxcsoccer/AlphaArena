# us-stock-data-sources-comparison

_Saved: 2026-03-18_

# 美股准实时数据源调研

## 调研日期
2026-03-19

## 推荐方案

### 开发/测试阶段
**Twelve Data Free Tier**
- 费用：$0
- 配额：800 API credits/天
- 支持 WebSocket 实时数据流
- 100+ 技术指标

### 生产环境（性价比）
**Financial Modeling Prep Starter**
- 费用：$22/月
- 配额：300 calls/min
- 实时美股数据

### 生产环境（数据质量）
**IEX Cloud Scale**
- 费用：$9/月起（按使用量）
- IEX 交易所官方数据
- 数据质量最高

### 专业级
**Polygon.io Basic**
- 费用：$199/月
- 机构级数据质量
- WebSocket 实时流

## 对比总结

| 数据源 | 免费额度 | 起步价 | 实时数据 | WebSocket | 推荐度 |
|--------|---------|--------|---------|-----------|-------|
| Twelve Data | 800 credits/天 | $29/月 | ✅ | ✅ | ⭐⭐⭐⭐⭐ |
| FMP | 250 calls/天 | $22/月 | ✅ | ✅ | ⭐⭐⭐⭐ |
| IEX Cloud | 50k msg/月 | $9/月 | ✅ | ✅ | ⭐⭐⭐⭐ |
| Finnhub | 有限 | $47/月 | ✅ | ✅ | ⭐⭐⭐ |
| Alpha Vantage | 25 req/天 | $50/月 | ✅ (Premium) | ❌ | ⭐⭐ |
| MarketStack | 100 req/月 | $10/月 | ✅ (Pro+) | ❌ | ⭐⭐ |
| Polygon.io | 无 | $199/月 | ✅ | ✅ | ⭐⭐⭐⭐⭐ (专业) |
| Yahoo Finance | 无限制 | 免费 | ⚠️ 非官方 | ❌ | ⭐ (不推荐) |

## 关键决策因素

1. **预算**：FMP Starter ($22/月) 性价比最高
2. **数据质量**：IEX Cloud 交易所官方数据
3. **实时性**：Twelve Data/Polygon.io 支持 WebSocket
4. **稳定性**：Polygon.io > IEX Cloud > Twelve Data > FMP
5. **功能丰富度**：Twelve Data 内置 100+ 技术指标

## 相关 Issue
- #357 接入真实股票数据源