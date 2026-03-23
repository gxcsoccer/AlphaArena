/**
 * Share Image Generator
 * Generates shareable images using Canvas for social media
 */

export interface ShareImageConfig {
  width?: number;
  height?: number;
  backgroundColor?: string;
  primaryColor?: string;
  textColor?: string;
  logo?: string;
}

export interface TradeResultData {
  pair: string;
  side: 'buy' | 'sell';
  profit: number;
  percentage: number;
  timestamp?: string;
}

export interface StrategyPerformanceData {
  name: string;
  return: number;
  winRate: number;
  trades: number;
  period?: string;
}

export interface ReferralData {
  referralCode: string;
  reward?: string;
}

export interface ProfileData {
  username: string;
  rank?: number;
  performance?: string;
}

export interface LeaderboardData {
  rank: number;
  performance: string;
  period?: string;
}

const DEFAULT_CONFIG: Required<ShareImageConfig> = {
  width: 1200,
  height: 630,
  backgroundColor: '#1a1a2e',
  primaryColor: '#4a9eff',
  textColor: '#ffffff',
  logo: '/logo-white.png',
};

/**
 * Create a canvas and context for image generation
 */
function createCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }
  return { canvas, ctx };
}

/**
 * Draw rounded rectangle
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Draw the base template with branding
 */
function drawBaseTemplate(
  ctx: CanvasRenderingContext2D,
  config: Required<ShareImageConfig>,
  title: string
): void {
  const { width, height, backgroundColor, primaryColor, textColor } = config;

  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, backgroundColor);
  gradient.addColorStop(1, '#16213e');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Decorative elements
  ctx.fillStyle = primaryColor + '20'; // 20 = 12.5% opacity
  ctx.beginPath();
  ctx.arc(width - 100, 100, 200, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(100, height - 100, 150, 0, Math.PI * 2);
  ctx.fill();

  // Brand header
  ctx.fillStyle = primaryColor;
  roundRect(ctx, 40, 30, 200, 40, 8);
  ctx.fill();

  ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.fillText('AlphaArena', 140, 57);

  // Title
  ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = textColor;
  ctx.textAlign = 'left';
  ctx.fillText(title, 40, 120);

  // Divider line
  ctx.strokeStyle = primaryColor + '60';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(40, 140);
  ctx.lineTo(width - 40, 140);
  ctx.stroke();
}

/**
 * Generate trade result share image
 */
export function generateTradeResultImage(
  data: TradeResultData,
  config: ShareImageConfig = {}
): string {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const { canvas, ctx } = createCanvas(cfg.width, cfg.height);

  drawBaseTemplate(ctx, cfg, '交易结果');

  // Trade pair
  ctx.font = 'bold 48px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = cfg.textColor;
  ctx.textAlign = 'left';
  ctx.fillText(data.pair, 40, 220);

  // Side badge
  const sideColor = data.side === 'buy' ? '#10b981' : '#ef4444';
  ctx.fillStyle = sideColor;
  roundRect(ctx, 40, 250, 100, 36, 8);
  ctx.fill();
  ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(data.side === 'buy' ? '买入' : '卖出', 90, 275);

  // Profit section
  ctx.font = '32px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = cfg.textColor + '80';
  ctx.textAlign = 'left';
  ctx.fillText('盈亏', 40, 360);

  const profitColor = data.profit >= 0 ? '#10b981' : '#ef4444';
  ctx.font = 'bold 64px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = profitColor;
  ctx.fillText(
    `${data.profit >= 0 ? '+' : ''}$${Math.abs(data.profit).toFixed(2)}`,
    40,
    430
  );

  // Percentage
  ctx.font = 'bold 32px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(
    `${data.percentage >= 0 ? '+' : ''}${data.percentage.toFixed(2)}%`,
    40,
    480
  );

  // Timestamp
  if (data.timestamp) {
    ctx.font = '18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = cfg.textColor + '60';
    ctx.fillText(data.timestamp, 40, 560);
  }

  // Footer
  ctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = cfg.textColor + '60';
  ctx.textAlign = 'center';
  ctx.fillText('alphaarena.app', cfg.width / 2, cfg.height - 30);

  return canvas.toDataURL('image/png');
}

/**
 * Generate strategy performance share image
 */
export function generateStrategyPerformanceImage(
  data: StrategyPerformanceData,
  config: ShareImageConfig = {}
): string {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const { canvas, ctx } = createCanvas(cfg.width, cfg.height);

  drawBaseTemplate(ctx, cfg, '策略表现');

  // Strategy name
  ctx.font = 'bold 40px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = cfg.textColor;
  ctx.textAlign = 'left';
  ctx.fillText(data.name, 40, 220);

  // Metrics grid
  const metrics = [
    { label: '收益率', value: `${data.return >= 0 ? '+' : ''}${data.return.toFixed(2)}%`, color: data.return >= 0 ? '#10b981' : '#ef4444' },
    { label: '胜率', value: `${data.winRate.toFixed(1)}%`, color: cfg.primaryColor },
    { label: '交易次数', value: `${data.trades}`, color: cfg.primaryColor },
  ];

  metrics.forEach((metric, i) => {
    const x = 40 + (i * 380);
    
    // Card background
    ctx.fillStyle = cfg.textColor + '10';
    roundRect(ctx, x, 280, 340, 140, 12);
    ctx.fill();

    // Label
    ctx.font = '20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = cfg.textColor + '80';
    ctx.textAlign = 'left';
    ctx.fillText(metric.label, x + 20, 320);

    // Value
    ctx.font = 'bold 48px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = metric.color;
    ctx.fillText(metric.value, x + 20, 390);
  });

  // Period
  if (data.period) {
    ctx.font = '18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = cfg.textColor + '60';
    ctx.textAlign = 'left';
    ctx.fillText(`统计周期：${data.period}`, 40, 480);
  }

  // Footer
  ctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = cfg.textColor + '60';
  ctx.textAlign = 'center';
  ctx.fillText('alphaarena.app', cfg.width / 2, cfg.height - 30);

  return canvas.toDataURL('image/png');
}

/**
 * Generate referral share image
 */
export function generateReferralImage(
  data: ReferralData,
  config: ShareImageConfig = {}
): string {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const { canvas, ctx } = createCanvas(cfg.width, cfg.height);

  drawBaseTemplate(ctx, cfg, '邀请好友');

  // Main message
  ctx.font = 'bold 40px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = cfg.textColor;
  ctx.textAlign = 'center';
  ctx.fillText('邀请好友，共同成长', cfg.width / 2, 220);

  // Referral code card
  ctx.fillStyle = cfg.primaryColor + '20';
  roundRect(ctx, (cfg.width - 400) / 2, 260, 400, 120, 16);
  ctx.fill();

  ctx.strokeStyle = cfg.primaryColor;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font = '20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = cfg.textColor + '80';
  ctx.fillText('我的邀请码', cfg.width / 2, 300);

  ctx.font = 'bold 48px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = cfg.primaryColor;
  ctx.fillText(data.referralCode, cfg.width / 2, 360);

  // Reward info
  if (data.reward) {
    ctx.font = '24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#10b981';
    ctx.fillText(`成功邀请奖励：${data.reward}`, cfg.width / 2, 440);
  }

  // Footer
  ctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = cfg.textColor + '60';
  ctx.fillText('alphaarena.app', cfg.width / 2, cfg.height - 30);

  return canvas.toDataURL('image/png');
}

/**
 * Generate profile share image
 */
export function generateProfileImage(
  data: ProfileData,
  config: ShareImageConfig = {}
): string {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const { canvas, ctx } = createCanvas(cfg.width, cfg.height);

  drawBaseTemplate(ctx, cfg, '我的主页');

  // Username
  ctx.font = 'bold 48px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = cfg.textColor;
  ctx.textAlign = 'center';
  ctx.fillText(`@${data.username}`, cfg.width / 2, 240);

  // Stats
  if (data.rank) {
    ctx.font = '24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = cfg.textColor + '80';
    ctx.fillText(`排名 #${data.rank}`, cfg.width / 2, 300);
  }

  if (data.performance) {
    ctx.font = 'bold 40px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = cfg.primaryColor;
    ctx.fillText(data.performance, cfg.width / 2, 380);
  }

  // Footer
  ctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = cfg.textColor + '60';
  ctx.fillText('alphaarena.app', cfg.width / 2, cfg.height - 30);

  return canvas.toDataURL('image/png');
}

/**
 * Generate leaderboard share image
 */
export function generateLeaderboardImage(
  data: LeaderboardData,
  config: ShareImageConfig = {}
): string {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const { canvas, ctx } = createCanvas(cfg.width, cfg.height);

  drawBaseTemplate(ctx, cfg, '排行榜');

  // Rank badge
  const rankColors: Record<number, string> = {
    1: '#ffd700', // Gold
    2: '#c0c0c0', // Silver
    3: '#cd7f32', // Bronze
  };
  const badgeColor = rankColors[data.rank] || cfg.primaryColor;

  ctx.fillStyle = badgeColor + '30';
  ctx.beginPath();
  ctx.arc(cfg.width / 2, 280, 100, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = 'bold 80px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = badgeColor;
  ctx.textAlign = 'center';
  ctx.fillText(`#${data.rank}`, cfg.width / 2, 310);

  // Performance
  ctx.font = '24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = cfg.textColor + '80';
  ctx.fillText('表现', cfg.width / 2, 420);

  ctx.font = 'bold 48px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = cfg.primaryColor;
  ctx.fillText(data.performance, cfg.width / 2, 480);

  // Period
  if (data.period) {
    ctx.font = '18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = cfg.textColor + '60';
    ctx.fillText(data.period, cfg.width / 2, 530);
  }

  // Footer
  ctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = cfg.textColor + '60';
  ctx.fillText('alphaarena.app', cfg.width / 2, cfg.height - 30);

  return canvas.toDataURL('image/png');
}

/**
 * Generate generic share image
 */
export function generateGenericImage(
  title: string,
  subtitle?: string,
  config: ShareImageConfig = {}
): string {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const { canvas, ctx } = createCanvas(cfg.width, cfg.height);

  drawBaseTemplate(ctx, cfg, title);

  if (subtitle) {
    ctx.font = '32px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = cfg.textColor + '80';
    ctx.textAlign = 'center';
    ctx.fillText(subtitle, cfg.width / 2, 300);
  }

  // Footer
  ctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = cfg.textColor + '60';
  ctx.fillText('alphaarena.app', cfg.width / 2, cfg.height - 30);

  return canvas.toDataURL('image/png');
}

export default {
  generateTradeResultImage,
  generateStrategyPerformanceImage,
  generateReferralImage,
  generateProfileImage,
  generateLeaderboardImage,
  generateGenericImage,
};