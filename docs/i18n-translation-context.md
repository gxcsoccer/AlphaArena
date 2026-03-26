# i18n 翻译上下文注释

本文档为关键翻译 key 提供上下文描述，帮助翻译人员理解使用场景，确保术语一致性和翻译准确性。

## 金融术语对照表

### 核心交易术语

| Key | 中文 | English | 日本語 | 한국어 | 上下文说明 |
|-----|------|---------|--------|-------|-----------|
| `trading.order.market` | 市价单 | Market Order | 成行注文 | 시장가 주문 | 以当前市场最优价格立即成交的订单 |
| `trading.order.limit` | 限价单 | Limit Order | 指値注文 | 지정가 주문 | 以指定价格或更优价格成交的订单 |
| `trading.order.stop` | 止损单 | Stop Order | ストップ注文 | 스탑 주문 | 价格达到触发价时执行的止损订单 |
| `trading.order.stopLimit` | 止损限价单 | Stop-Limit Order | ストップリミット注文 | 스탑 리밋 주문 | 触发后以限价单方式执行的订单 |
| `trading.order.trailingStop` | 追踪止损单 | Trailing Stop Order | トレーリングストップ注文 | 트레일링 스톱 주문 | 跟随市场价格移动的动态止损订单 |
| `trading.order.iceberg` | 冰山订单 | Iceberg Order | アイスバーグ注文 | 아이스버그 주문 | 大额订单分拆隐藏，仅显示部分数量 |
| `trading.order.fillOrKill` | 全部成交或取消 | Fill or Kill (FOK) | FOK（全数実行または取消） | 전량 체결 또는 취소 | 必须全部成交否则全部取消 |
| `trading.order.immediateOrCancel` | 立即成交或取消 | Immediate or Cancel (IOC) | IOC（即時実行または取消） | 즉시 체결 또는 취소 | 立即成交可成交部分，剩余取消 |

### 持仓相关术语

| Key | 中文 | English | 日本語 | 한국어 | 上下文说明 |
|-----|------|---------|--------|-------|-----------|
| `trading.position.open` | 持仓中 | Open Position | 建玉 | 진입 | 当前持有的未平仓头寸 |
| `trading.position.closed` | 已平仓 | Closed Position | 決済済み | 청산 | 已完成平仓的头寸 |
| `trading.position.entryPrice` | 开仓价 | Entry Price | 参入価格 | 진입 가격 | 建仓时的平均价格 |
| `trading.position.exitPrice` | 平仓价 | Exit Price | 決済価格 | 청산 가격 | 平仓时的价格 |
| `trading.position.pnl` | 盈亏 | Profit and Loss (PnL) | 損益 | 손익 | 已实现或未实现的盈利/亏损 |
| `trading.position.margin` | 保证金 | Margin | 証拠金 | 마진 | 杠杆交易所需的抵押资金 |
| `trading.position.leverage` | 杠杆 | Leverage | レバレッジ | 레버리지 | 放大交易规模的倍数 |
| `trading.position.liquidationPrice` | 强平价 | Liquidation Price | 清算価格 | 청산 가격 | 触发强制平仓的价格点 |

### 订单簿术语

| Key | 中文 | English | 日本語 | 한국어 | 上下文说明 |
|-----|------|---------|--------|-------|-----------|
| `trading.orderbook.asks` | 卖单 | Asks (Sell Orders) | 売り注文 | 매도 | 待成交的卖出订单 |
| `trading.orderbook.bids` | 买单 | Bids (Buy Orders) | 買い注文 | 매수 | 待成交的买入订单 |

### 策略类型术语

| Key | 中文 | English | 日本語 | 한국어 | 上下文说明 |
|-----|------|---------|--------|-------|-----------|
| `strategy.type.trend` | 趋势跟踪 | Trend Following | トレンドフォロー | 추세 추종 | 跟随市场趋势方向交易 |
| `strategy.type.meanReversion` | 均值回归 | Mean Reversion | 平均回帰 | 평균 회귀 | 价格回归均值时交易 |
| `strategy.type.momentum` | 动量 | Momentum | モメンタム | 모멘텀 | 基于价格动能交易 |
| `strategy.type.breakout` | 突破 | Breakout | ブレイクアウト | 돌파 | 价格突破关键位时交易 |
| `strategy.type.arbitrage` | 套利 | Arbitrage | アービトラージ | 차익 거래 | 利用价格差异无风险获利 |
| `strategy.type.marketMaking` | 做市 | Market Making | マーケットメイキング | 마켓 메이킹 | 提供流动性赚取买卖价差 |

### 绩效指标术语

| Key | 中文 | English | 日本語 | 한국어 | 上下文说明 |
|-----|------|---------|--------|-------|-----------|
| `strategy.performance.totalReturn` | 总收益 | Total Return | 総リターン | 총 수익률 | 累计收益率百分比 |
| `strategy.performance.annualReturn` | 年化收益 | Annual Return | 年間リターン | 연간 수익률 | 年化后的平均收益率 |
| `strategy.performance.maxDrawdown` | 最大回撤 | Maximum Drawdown | 最大ドローダウン | 최대 낙폭 | 从峰值到谷底的最大跌幅 |
| `strategy.performance.sharpeRatio` | 夏普比率 | Sharpe Ratio | シャープレシオ | 샤프 비율 | 风险调整后收益指标 |
| `strategy.performance.sortinoRatio` | 索提诺比率 | Sortino Ratio | ソルティノレシオ | 소르티노 비율 | 只考虑下行风险的风险调整收益 |
| `strategy.performance.calmarRatio` | 卡玛比率 | Calmar Ratio | カルマーレシオ | 칼마 비율 | 年化收益与最大回撤的比值 |
| `strategy.performance.winRate` | 胜率 | Win Rate | 勝率 | 승률 | 盈利交易占比 |
| `strategy.performance.profitFactor` | 盈利因子 | Profit Factor | プロフィットファクター | 프로핏 팩터 | 总盈利与总亏损的比值 |

### 图表术语

| Key | 中文 | English | 日本語 | 한국어 | 上下文说明 |
|-----|------|---------|--------|-------|-----------|
| `common.chart.equity` | 资产 | Equity | 純資産 | 자산 | 账户净值曲线 |
| `common.chart.drawdown` | 回撤 | Drawdown | ドローダウン | 낙폭 | 从历史最高点的下跌幅度 |
| `common.chart.highWaterMark` | 最高值 | High Water Mark | ハイウォーターマーク | 최대 자산가 | 账户历史最高净值，用于计算绩效费 |

## UI 元素上下文

### 按钮操作

| Key | 上下文说明 |
|-----|-----------|
| `common.button.submit` | 表单提交按钮 |
| `common.button.confirm` | 确认对话框的确认按钮 |
| `common.button.cancel` | 取消操作按钮 |
| `common.button.save` | 保存设置或更改 |
| `common.button.delete` | 删除项目（危险操作，需二次确认） |
| `common.button.retry` | 操作失败后重试 |
| `common.button.enable/disable` | 开关功能的启用/禁用状态切换 |

### 状态标签

| Key | 上下文说明 |
|-----|-----------|
| `common.label.active/inactive` | 表示功能或策略的激活状态 |
| `common.label.enabled/disabled` | 表示设置项的开关状态 |
| `common.label.online/offline` | 表示用户或服务的在线状态 |
| `common.label.success/error/warning/info` | 操作结果或消息类型标识 |

### 验证消息

| Key | 上下文说明 |
|-----|-----------|
| `common.validation.required` | 必填字段为空时的提示 |
| `common.validation.email` | 邮箱格式不正确时的提示 |
| `common.validation.minLength/maxLength` | 输入长度不符合要求时的提示 |
| `common.validation.min/max` | 数值超出范围时的提示 |
| `common.validation.pattern` | 输入格式不匹配时的提示 |

## 错误消息上下文

### 认证错误

| Key | 上下文说明 |
|-----|-----------|
| `errors.auth.loginFailed` | 登录失败的一般性错误 |
| `errors.auth.invalidCredentials` | 用户名或密码错误 |
| `errors.auth.emailExists` | 注册时邮箱已被占用 |
| `errors.auth.tokenExpired` | 登录会话过期，需重新登录 |
| `errors.auth.unauthorized` | 未登录访问需要认证的页面 |
| `errors.auth.forbidden` | 权限不足，无法访问某功能 |

### 交易错误

| Key | 上下文说明 |
|-----|-----------|
| `errors.trading.insufficientBalance` | 余额不足以下单 |
| `errors.trading.insufficientMargin` | 保证金不足以开仓 |
| `errors.trading.orderFailed` | 下单失败的一般性错误 |
| `errors.trading.cancelFailed` | 撤单失败 |
| `errors.trading.modifyFailed` | 修改订单失败 |
| `errors.trading.invalidPrice/invalidAmount` | 价格或数量参数无效 |
| `errors.trading.marketClosed` | 市场休市期间无法交易 |
| `errors.trading.rateLimited` | 请求频率过高被限制 |

### API 错误

| Key | 上下文说明 |
|-----|-----------|
| `errors.api.invalidKey` | API 密钥无效 |
| `errors.api.keyExpired` | API 密钥已过期 |
| `errors.api.permissionDenied` | API 权限不足 |
| `errors.api.rateLimited` | API 请求频率超限 |

## 翻译风格指南

### 中文 (zh-CN)
- 使用简体中文
- 金融术语保持专业性，避免口语化
- 按钮使用动宾结构（如"提交"、"确认"）
- 状态使用"已+动词"形式（如"已成交"、"已取消"）

### 英文 (en-US)
- 使用美式英语拼写
- 按钮使用动词原形（如"Submit"、"Confirm"）
- 状态使用过去分词（如"Filled"、"Cancelled"）
- 专业术语保持行业通用写法

### 日文 (ja-JP)
- 使用敬语风格（です・ます调）
- 金融术语优先使用片假名外来语（如"ストラテジー"）
- 按钮使用动词原形（如"送信"、"確認"）
- 用户名本地化为日本常见姓名

### 韩文 (ko-KR)
- 使用敬语风格（합니다体）
- 金融术语优先使用固有词或汉字词
- 按钮使用动词基本形（如"제출"、"확인"）
- 用户名本地化为韩国常见姓名

## 相关文档

- [翻译 Key 命名规范](./i18n-naming-convention.md)
- [开发指南](./i18n-development-guide.md)