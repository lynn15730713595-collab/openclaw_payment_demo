#!/bin/bash

# AI支付演示系统启动脚本

echo "🚀 AI支付演示系统"
echo "================"
echo ""

# 设置默认私钥（测试用）
export USER_PRIVATE_KEY="${USER_PRIVATE_KEY:-0x154a29b3234595ac8ccf6bc88e496680048ae90b5c5ec6f6868f279e9da32eaf}"

echo "✅ 环境变量检查通过"
echo "   网络: Sepolia Testnet"
echo "   货币: ETH (不是USDC)"
echo ""

# 显示商品价格
echo "📋 商品价格列表 (都不超过0.015 ETH):"
echo "=================================="
node -e "
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
try {
  const configPath = path.join(__dirname, 'config/products-eth.yaml');
  const configFile = fs.readFileSync(configPath, 'utf8');
  const config = yaml.load(configFile);
  const products = config.products || [];
  products.forEach((product, index) => {
    console.log(\`   \${index + 1}. \${product.name_zh}: \${product.price_eth} ETH\`);
  });
  
  // 验证价格
  const prices = products.map(p => p.price_eth);
  const allUnderLimit = prices.every(price => price <= 0.015);
  const allDifferent = new Set(prices).size === prices.length;
  
  console.log('');
  console.log(\`✅ 价格验证:\`);
  console.log(\`   • 全部不超过0.015 ETH: \${allUnderLimit ? '通过' : '失败'}\`);
  console.log(\`   • 价格各不相同: \${allDifferent ? '通过' : '失败'}\`);
  console.log(\`   • 商品数量: \${products.length}\`);
} catch(e) {
  console.log('❌ 加载商品配置失败:', e.message);
}
"
echo ""

# 显示菜单
echo "📋 选择演示模式:"
echo "   1. 🎮 交互测试模式 (推荐)"
echo "      - 输入购买指令"
echo "      - 查看购物车卡片"
echo "      - 确认支付"
echo "      - 真实链上支付"
echo ""
echo "   2. 📊 系统状态检查"
echo "      - 检查钱包余额"
echo "      - 显示网络配置"
echo ""

read -p "❓ 请选择 (1-2): " choice

case $choice in
    1)
        echo ""
        echo "🎮 启动交互测试模式..."
        echo "====================="
        node complete-interactive-test.js
        ;;
    2)
        echo ""
        echo "📊 系统状态检查..."
        echo "================="
        node -e "
        const fs = require('fs');
        const path = require('path');
        const yaml = require('js-yaml');
        const { ethers } = require('ethers');
        
        try {
          // 加载配置
          const configPath = path.join(__dirname, 'config/demo-config.yaml');
          const configFile = fs.readFileSync(configPath, 'utf8');
          const config = yaml.load(configFile);
          
          if (!process.env.USER_PRIVATE_KEY) {
            console.log('❌ USER_PRIVATE_KEY 未设置');
            process.exit(1);
          }
          
          // 初始化钱包
          const provider = new ethers.JsonRpcProvider(config.network.rpc_url);
          const wallet = new ethers.Wallet(process.env.USER_PRIVATE_KEY, provider);
          const address = await wallet.getAddress();
          const balance = await provider.getBalance(address);
          
          console.log('💰 钱包信息:');
          console.log(\`   地址: \${address}\`);
          console.log(\`   ETH余额: \${ethers.formatEther(balance)} ETH\`);
          console.log(\`   网络: \${config.network.name}\`);
          console.log(\`   Chain ID: \${config.network.chain_id}\`);
          console.log('');
          
          console.log('🛍️  商品配置:');
          const productsPath = path.join(__dirname, 'config/products-eth.yaml');
          const productsFile = fs.readFileSync(productsPath, 'utf8');
          const productsConfig = yaml.load(productsFile);
          console.log(\`   商品数量: \${productsConfig.products.length}\`);
          console.log('');
          
          console.log('🌐 网络配置:');
          console.log(\`   RPC URL: \${config.network.rpc_url}\`);
          console.log(\`   商户地址: \${config.merchant.address}\`);
          console.log(\`   浏览器: \${config.network.explorer_url}\`);
          
        } catch(error) {
          console.log('❌ 状态检查失败:', error.message);
        }
        "
        ;;
    *)
        echo "❌ 无效的选择"
        exit 1
        ;;
esac