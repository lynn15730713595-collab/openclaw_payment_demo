---
name: AI Shopping Assistant
description: OpenClaw skill for AI-powered shopping with autonomous payment capabilities. Enables OpenClaw to understand shopping intent, select products, check budget, and execute payments.
read_when:
  - User mentions shopping, buying, or purchasing
  - User asks OpenClaw to buy something
  - User wants to use crypto for payments
metadata:
  category: ecommerce
  version: 1.0.0
---

# AI Shopping Assistant Skill

在OpenClaw对话框里直接实现AI支付购物交互。

## 支持的指令类型

### 🛒 购物指令
- "我想买[商品名称]"
- "购买[商品名称]"
- "需要[商品名称]"

**响应流程：**
1. 匹配商品
2. 返回购物车详情卡片
3. 等待用户确认支付
4. 用户确认后执行真实链上支付

### 💰 余额查询
- "余额"
- "查询余额"
- "我的余额"

### 📦 商品查询
- "商品列表"
- "商品"

### 📊 系统状态
- "状态"
- "系统状态"

## 使用方法

在OpenClaw对话框里直接输入指令即可：

```
用户: 我想买AI API调用包
AI: [返回购物车卡片]
用户: 确认支付
AI: [执行支付流程]
```

## 核心实现

调用 `shopping-assistant.js` 实现：

```javascript
const assistant = require('./shopping-assistant.js');

await assistant.initialize();
const result = await assistant.handleIntent(intent);
```

## 配置

- 商品配置：`/root/.openclaw/workspace/ai-agent-payment-demo/config/products-eth.yaml`
- 系统配置：`/root/.openclaw/workspace/ai-agent-payment-demo/config/demo-config.yaml`
- 8个商品，价格 0.0005 - 0.0040 ETH，全部不超过 0.015 ETH

## 注意事项

1. 所有支付都是真实的链上ETH转账（Sepolia测试网）
2. 购物车卡片需要等待用户确认后才执行支付
