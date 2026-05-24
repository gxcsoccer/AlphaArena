# dns-configuration-issue-alphaarena

_Saved: 2026-05-24_

# DNS 配置问题诊断指南

## 问题表现
生产环境 https://alphaarena.app 显示 Squarespace 占位页，而不是 Vercel 部署的应用。

## 诊断步骤

1. **检查 DNS 解析**
   ```bash
   dig alphaarena.app +short
   # 如果返回 Squarespace IP (198.49.23.x, 198.185.159.x)，则是 DNS 问题
   # 应该返回 Vercel IP: 76.76.21.21
   ```

2. **检查响应服务器**
   ```bash
   curl -sI https://alphaarena.app | grep -i server
   # 如果返回 "server: Squarespace"，DNS 指向了错误的服务器
   # 应该返回 "server: Vercel"
   ```

3. **检查 Vercel 配置**
   ```bash
   vercel domains inspect alphaarena.app
   # 查看 Nameservers 部分，确认 Intended vs Current
   ```

## 修复方法

在 Google Domains 控制面板修改 DNS 记录：

### 方案 A：修改 A 记录（推荐，更快生效）
```
类型: A
名称: @
TTL: 3600
IPv4 地址: 76.76.21.21

类型: A
名称: www
TTL: 3600
IPv4 地址: 76.76.21.21
```

### 方案 B：修改 Nameserver（完整方案）
```
ns1.vercel-dns.com
ns2.vercel-dns.com
```
生效时间：24-48 小时

## 临时访问方案
Vercel 默认域名可以正常访问：
- https://alphaarena-gxcsoccer-s-team.vercel.app
- https://alphaarena-eight.vercel.app

## 相关 Issue
- #803: 生产环境显示占位页