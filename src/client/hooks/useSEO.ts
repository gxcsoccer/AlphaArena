/**
 * useSEO Hook
 * Dynamic SEO management for React components
 */

import { useEffect } from 'react';
import { updateSEO, addStructuredData } from '../utils/seo';

export interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string[];
  canonicalUrl?: string;
  ogType?: 'website' | 'article' | 'product';
  ogImage?: string;
  ogImageAlt?: string;
  twitterCard?: 'summary' | 'summary_large_image';
  structuredData?: object | object[];
}

/**
 * Hook to manage SEO meta tags dynamically
 * 
 * @example
 * ```tsx
 * function MyPage() {
 *   useSEO({
 *     title: 'Strategy Performance - AlphaArena',
 *     description: 'View your strategy performance metrics',
 *     keywords: ['trading', 'performance', 'strategy'],
 *   });
 *   return <div>...</div>;
 * }
 * ```
 */
export function useSEO(seoConfig: SEOProps = {}) {
  useEffect(() => {
    // Update meta tags
    updateSEO(seoConfig);

    // Add structured data if provided
    if (seoConfig.structuredData) {
      if (Array.isArray(seoConfig.structuredData)) {
        seoConfig.structuredData.forEach(data => addStructuredData(data));
      } else {
        addStructuredData(seoConfig.structuredData);
      }
    }

    // Cleanup: restore default meta tags when component unmounts
    return () => {
      // Reset to defaults on unmount (optional, but helps with SPA navigation)
      updateSEO({});
    };
  }, [
    seoConfig.title,
    seoConfig.description,
    seoConfig.keywords?.join(','),
    seoConfig.canonicalUrl,
    seoConfig.ogType,
    seoConfig.ogImage,
    seoConfig.ogImageAlt,
    seoConfig.twitterCard,
  ]);
}

/**
 * Page-level SEO configurations
 */
export const PAGE_SEO_CONFIGS: Record<string, SEOProps> = {
  home: {
    title: 'AlphaArena - 算法交易平台 | AI 驱动的智能交易',
    description: 'AlphaArena 是一个专业的算法交易平台，提供 AI 驱动的智能策略、无风险的模拟交易环境、实时市场数据和竞技排名系统。免费注册，即刻开始您的量化交易之旅。',
    keywords: ['算法交易', '量化交易', 'AI 交易', '模拟交易', 'AlphaArena'],
  },
  landing: {
    title: 'AlphaArena - 算法交易平台 | AI 驱动的智能交易',
    description: 'AlphaArena 是一个专业的算法交易平台，提供 AI 驱动的智能策略、无风险的模拟交易环境、实时市场数据和竞技排名系统。免费注册，即刻开始您的量化交易之旅。',
    keywords: ['算法交易', '量化交易', 'AI 交易', '模拟交易', 'AlphaArena'],
  },
  dashboard: {
    title: 'Dashboard - AlphaArena',
    description: '您的个人交易仪表板，查看实时交易数据、策略表现和账户概览。',
    keywords: ['交易仪表板', '策略表现', '账户概览', 'AlphaArena'],
  },
  strategies: {
    title: '策略管理 - AlphaArena',
    description: '管理您的交易策略，创建、编辑和监控您的量化交易策略。',
    keywords: ['交易策略', '量化策略', '策略管理', 'AlphaArena'],
  },
  trades: {
    title: '交易记录 - AlphaArena',
    description: '查看您的所有交易记录，包括历史订单、成交记录和交易分析。',
    keywords: ['交易记录', '订单历史', '交易分析', 'AlphaArena'],
  },
  holdings: {
    title: '持仓管理 - AlphaArena',
    description: '查看和管理您的持仓，实时监控持仓收益和风险敞口。',
    keywords: ['持仓管理', '持仓收益', '风险管理', 'AlphaArena'],
  },
  leaderboard: {
    title: '排行榜 - AlphaArena',
    description: '查看社区交易排行榜，了解最佳策略和顶尖交易者。',
    keywords: ['交易排行榜', '社区排名', '顶尖交易者', 'AlphaArena'],
  },
  performance: {
    title: '绩效分析 - AlphaArena',
    description: '深入分析您的交易绩效，查看收益曲线、风险指标和策略表现。',
    keywords: ['绩效分析', '收益曲线', '风险指标', 'AlphaArena'],
  },
  backtest: {
    title: '策略回测 - AlphaArena',
    description: '使用历史数据测试您的交易策略，评估策略表现和风险。',
    keywords: ['策略回测', '历史数据', '策略评估', 'AlphaArena'],
  },
  marketplace: {
    title: '策略市场 - AlphaArena',
    description: '探索和购买社区精选交易策略，发现优秀策略创作者。',
    keywords: ['策略市场', '交易策略', '策略订阅', 'AlphaArena'],
  },
  subscription: {
    title: '订阅计划 - AlphaArena',
    description: '选择适合您的订阅计划，解锁更多高级功能和专业工具。',
    keywords: ['订阅计划', '高级功能', '会员服务', 'AlphaArena'],
  },
  login: {
    title: '登录 - AlphaArena',
    description: '登录您的 AlphaArena 账户，开始您的量化交易之旅。',
    keywords: ['登录', '用户认证', 'AlphaArena'],
    ogType: 'website',
  },
  register: {
    title: '注册 - AlphaArena',
    description: '免费注册 AlphaArena，开始体验专业级算法交易平台。',
    keywords: ['注册', '免费试用', 'AlphaArena'],
    ogType: 'website',
  },
  apiDocs: {
    title: 'API 文档 - AlphaArena',
    description: 'AlphaArena API 文档，了解如何使用我们的 API 进行量化交易。',
    keywords: ['API 文档', '开发者', '量化交易 API', 'AlphaArena'],
  },
  copyTrading: {
    title: '跟单交易 - AlphaArena',
    description: '发现优秀的交易者，一键复制他们的交易策略。',
    keywords: ['跟单交易', '复制交易', '社交交易', 'AlphaArena'],
  },
  journal: {
    title: '交易日志 - AlphaArena',
    description: '记录您的交易想法和反思，持续改进您的交易策略。',
    keywords: ['交易日志', '交易日记', '策略反思', 'AlphaArena'],
  },
  risk: {
    title: '风险管理 - AlphaArena',
    description: '监控您的风险敞口，管理仓位和止损设置。',
    keywords: ['风险管理', '止损', '仓位管理', 'AlphaArena'],
  },
  sentiment: {
    title: '市场情绪 - AlphaArena',
    description: '查看市场情绪分析，了解市场参与者的情绪倾向。',
    keywords: ['市场情绪', '情绪分析', '市场分析', 'AlphaArena'],
  },
  attribution: {
    title: '绩效归因 - AlphaArena',
    description: '分析您的收益来源，了解策略表现的关键驱动因素。',
    keywords: ['绩效归因', '收益分析', 'AlphaArena'],
  },
  rebalance: {
    title: '组合再平衡 - AlphaArena',
    description: '自动调整您的投资组合，保持目标资产配置。',
    keywords: ['再平衡', '资产配置', '投资组合', 'AlphaArena'],
  },
  scheduler: {
    title: '定时任务 - AlphaArena',
    description: '设置定时执行策略，自动化您的交易流程。',
    keywords: ['定时任务', '自动化', '交易计划', 'AlphaArena'],
  },
  advancedOrders: {
    title: '高级订单 - AlphaArena',
    description: '使用条件单、冰山订单等高级订单类型执行复杂交易策略。',
    keywords: ['高级订单', '条件单', '冰山订单', 'AlphaArena'],
  },
  strategyComparison: {
    title: '策略比较 - AlphaArena',
    description: '比较不同策略的表现，找到最适合您的交易策略。',
    keywords: ['策略比较', '策略表现', 'AlphaArena'],
  },
  strategyPortfolio: {
    title: '策略组合 - AlphaArena',
    description: '管理您的策略组合，分散风险优化收益。',
    keywords: ['策略组合', '分散投资', 'AlphaArena'],
  },
  notificationPreferences: {
    title: '通知设置 - AlphaArena',
    description: '自定义您的通知偏好，接收重要的交易提醒。',
    keywords: ['通知设置', '交易提醒', 'AlphaArena'],
  },
  virtualAccount: {
    title: '虚拟账户 - AlphaArena',
    description: '使用虚拟资金进行模拟交易，零风险学习量化交易。',
    keywords: ['虚拟账户', '模拟交易', '无风险交易', 'AlphaArena'],
  },
  exchangeAccounts: {
    title: '交易所账户 - AlphaArena',
    description: '连接您的交易所账户，实现实盘交易。',
    keywords: ['交易所连接', 'API 密钥', '实盘交易', 'AlphaArena'],
  },
};

export default useSEO;