#!/bin/bash

# DNS 验证脚本 - 检查 alphaarena.app 是否正确配置
# 用法: ./scripts/check-dns.sh

set -e

DOMAIN="alphaarena.app"
VERCEL_IP="76.76.21.21"

echo "🔍 DNS 配置检查 - $DOMAIN"
echo "================================"
echo ""

# 检查 nameservers
echo "📡 Nameservers:"
echo "当前配置:"
nslookup -type=NS $DOMAIN 2>/dev/null | grep "nameserver" | awk '{print "  - " $4}' || echo "  无法获取 nameservers"
echo ""
echo "期望配置 (Vercel):"
echo "  - ns1.vercel-dns.com"
echo "  - ns2.vercel-dns.com"
echo ""

# 检查 A 记录
echo "🌐 A 记录:"
RESOLVED_IPS=$(nslookup $DOMAIN 2>/dev/null | grep "Address" | grep -v "#" | awk '{print $2}')
echo "当前解析:"
for ip in $RESOLVED_IPS; do
    echo "  - $ip"
done
echo ""
echo "期望解析 (Vercel):"
echo "  - $VERCEL_IP"
echo ""

# 检查是否指向 Squarespace
if echo "$RESOLVED_IPS" | grep -q "198.185.159\|198.49.23"; then
    echo "⚠️  警告: DNS 指向 Squarespace IP (198.185.159.x 或 198.49.23.x)"
    echo "   这会导致显示 'Coming Soon' 页面而非 AlphaArena 应用"
    echo ""
fi

# 检查是否指向 Vercel
if echo "$RESOLVED_IPS" | grep -q "$VERCEL_IP"; then
    echo "✅ DNS 已正确指向 Vercel ($VERCEL_IP)"
    echo ""
elif echo "$RESOLVED_IPS" | grep -q "76.76.21\|76.76.76\|64.98.145"; then
    echo "✅ DNS 已指向 Vercel IP 范围"
    echo ""
else
    echo "❌ DNS 未指向 Vercel"
    echo ""
fi

# 检查网站内容
echo "📄 网站内容检查:"
HTTP_CONTENT=$(curl -s -m 10 https://$DOMAIN 2>/dev/null || echo "")

if echo "$HTTP_CONTENT" | grep -qi "squarespace\|Coming Soon"; then
    echo "❌ 网站显示 Squarespace 占位页"
    echo "   请按照 docs/DNS_FIX_GUIDE.md 中的步骤修复 DNS 配置"
elif echo "$HTTP_CONTENT" | grep -qi "alphaarena\|算法交易"; then
    echo "✅ 网站内容正确 (AlphaArena)"
else
    echo "⚠️  无法验证网站内容"
fi

echo ""
echo "================================"
echo "📋 后续步骤:"
echo "1. 如果 DNS 配置错误，请访问 Google Domains 控制台"
echo "2. 参考 docs/DNS_FIX_GUIDE.md 进行修复"
echo "3. 修复后等待 DNS 传播 (5-30 分钟)"
echo "4. 重新运行此脚本验证"