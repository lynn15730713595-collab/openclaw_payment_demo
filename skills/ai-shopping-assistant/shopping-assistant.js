/**
 * AI购物助手 - OpenClaw对话框交互模块
 * 用于在OpenClaw对话框里直接处理购物指令
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { ethers } = require('ethers');

class AIShoppingAssistant {
  constructor() {
    this.config = null;
    this.paymentSystem = null;
    this.currentCart = null;
    this.initialized = false;
  }

  /**
   * 初始化购物助手
   */
  async initialize() {
    if (this.initialized) {
      return true;
    }

    try {
      const configPath = '/root/.openclaw/workspace/ai-agent-payment-demo/config/demo-config.yaml';
      const configFile = fs.readFileSync(configPath, 'utf8');
      this.config = yaml.load(configFile);

      // 设置私钥
      this.config.user.private_key = '0x154a29b3234595ac8ccf6bc88e496680048ae90b5c5ec6f6868f279e9da32eaf';
      process.env.USER_PRIVATE_KEY = this.config.user.private_key;

      // 加载AIAgentPayment
      const { AIAgentPayment } = require('/root/.openclaw/workspace/ai-agent-payment-demo/src/ai-agent-payment');
      this.paymentSystem = new AIAgentPayment(configPath);
      
      const initResult = await this.paymentSystem.initialize();
      
      if (!initResult.success) {
        throw new Error(initResult.error || '初始化失败');
      }

      this.initialized = true;
      return true;
    } catch (error) {
      console.error('初始化失败:', error.message);
      return false;
    }
  }

  /**
   * 解析用户指令
   */
  parseIntent(input) {
    const inputLower = input.toLowerCase();

    // 余额查询
    if (input.includes('余额') || input.includes('查询余额') || input === '我的余额') {
      return { type: 'balance' };
    }

    // 商品列表
    if (input.includes('商品列表') || input.includes('商品目录') || input === '商品') {
      return { type: 'product_list' };
    }

    // 商品详情
    if (input.includes('详情') || input.includes('详细信息')) {
      const productName = input.replace('详情', '').replace('详细信息', '').trim();
      return { type: 'product_detail', productName };
    }

    // 系统状态
    if (input === '状态' || input === '系统状态') {
      return { type: 'status' };
    }

    // 确认支付
    if (input === '确认支付' || input === '确认') {
      return { type: 'confirm_payment' };
    }

    // 取消支付
    if (input === '取消支付' || input === '取消') {
      return { type: 'cancel_payment' };
    }

    // 购买指令
    if (input.includes('购买') || input.includes('买') || input.includes('我要') || 
        input.includes('想买') || input.includes('需要') || input.includes('订阅')) {
      return { type: 'purchase', intent: input };
    }

    // 帮助
    if (input === '帮助' || input === 'help') {
      return { type: 'help' };
    }

    return { type: 'unknown' };
  }

  /**
   * 处理用户指令
   */
  async handleIntent(intent) {
    if (!this.initialized) {
      await this.initialize();
    }

    switch (intent.type) {
      case 'balance':
        return await this.getBalance();

      case 'product_list':
        return this.getProductList();

      case 'product_detail':
        return await this.getProductDetail(intent.productName);

      case 'status':
        return await this.getSystemStatus();

      case 'purchase':
        return await this.handlePurchase(intent.intent);

      case 'confirm_payment':
        return await this.executePayment();

      case 'cancel_payment':
        this.currentCart = null;
        return '❌ 支付已取消';

      case 'help':
        return this.getHelp();

      default:
        return '❌ 未知指令。输入"帮助"查看可用命令。';
    }
  }

  /**
   * 获取余额
   */
  async getBalance() {
    try {
      const provider = new ethers.JsonRpcProvider(this.config.network.rpc_url);
      const userWallet = new ethers.Wallet(this.config.user.private_key, provider);

      const userAddress = await userWallet.getAddress();
      const userBalance = await provider.getBalance(userAddress);

      const merchantAddress = this.config.merchant.address;
      const merchantBalance = await provider.getBalance(merchantAddress);

      return `💰 **余额查询**

👤 **用户余额**
   地址: \`${userAddress}\`
   ETH余额: **${ethers.formatEther(userBalance)} ETH**

🏪 **商户余额**
   名称: ${this.config.merchant.name}
   地址: \`${merchantAddress}\`
   ETH余额: **${ethers.formatEther(merchantBalance)} ETH**`;
    } catch (error) {
      return `❌ 查询余额失败: ${error.message}`;
    }
  }

  /**
   * 获取商品列表
   */
  getProductList() {
    const products = this.paymentSystem.productCatalog.getAllProducts();

    let response = '🛍️ **商品列表**\n\n';

    products.forEach((product, index) => {
      response += `${index + 1}. **${product.name_zh}**\n`;
      response += `   价格: ${product.price_eth} ETH\n`;
      response += `   描述: ${product.description_zh}\n\n`;
    });

    response += '💡 **购买指令示例**\n';
    response += '   • "我想买AI API调用包"\n';
    response += '   • "购买数据清洗服务"';

    return response;
  }

  /**
   * 获取商品详情
   */
  async getProductDetail(productName) {
    const product = this.paymentSystem.productCatalog.matchProductFromIntent(productName);

    if (!product) {
      return '❌ 未找到商品';
    }

    let response = `📦 **商品详情**\n\n`;
    response += `商品ID: ${product.id}\n`;
    response += `商品名称: **${product.name_zh}**\n`;
    response += `英文名称: ${product.name}\n`;
    response += `价格: **${product.price_eth} ETH**\n`;
    response += `描述: ${product.description_zh}\n`;
    response += `类别: ${product.category}\n`;
    response += `交付时间: ${product.delivery}\n`;
    response += `有效期: ${product.validity}\n\n`;
    response += `✨ **功能特性**\n`;
    product.features.forEach((feature, index) => {
      response += `   ${index + 1}. ${feature}\n`;
    });

    return response;
  }

  /**
   * 获取系统状态
   */
  async getSystemStatus() {
    try {
      const provider = new ethers.JsonRpcProvider(this.config.network.rpc_url);
      const userWallet = new ethers.Wallet(this.config.user.private_key, provider);
      const userAddress = await userWallet.getAddress();
      const userBalance = await provider.getBalance(userAddress);

      const products = this.paymentSystem.productCatalog.getAllProducts();
      const prices = products.map(p => parseFloat(p.price_eth));

      let response = `📊 **系统状态**\n\n`;
      response += `🌐 **网络信息**\n`;
      response += `   网络: ${this.config.network.name}\n`;
      response += `   Chain ID: ${this.config.network.chain_id}\n\n`;

      response += `👤 **用户钱包**\n`;
      response += `   地址: \`${userAddress}\`\n`;
      response += `   余额: **${ethers.formatEther(userBalance)} ETH**\n\n`;

      response += `🛍️ **商品统计**\n`;
      response += `   商品数量: ${products.length}\n`;
      response += `   价格范围: ${Math.min(...prices)} - ${Math.max(...prices)} ETH\n`;
      response += `   平均价格: ${(prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(6)} ETH\n`;
      response += `   全部 ≤ 0.015 ETH: ${prices.every(p => p <= 0.015) ? '✅' : '❌'}`;

      return response;
    } catch (error) {
      return `❌ 获取系统状态失败: ${error.message}`;
    }
  }

  /**
   * 处理购买意图
   */
  async handlePurchase(intent) {
    try {
      // 匹配商品
      const product = this.paymentSystem.productCatalog.matchProductFromIntent(intent);

      if (!product) {
        return '❌ 未找到匹配的商品。请使用"商品列表"查看所有商品。';
      }

      // 模拟API调用获取402响应
      const apiResponse = await this.paymentSystem.simulateApiCall(product);

      // 保存当前购物车
      this.currentCart = {
        product,
        cart: apiResponse.cart
      };

      // 生成购物车卡片消息
      let cardMessage = `╔══════════════════════════════════════╗\n`;
      cardMessage += `║         🛒 购物车详情                 ║\n`;
      cardMessage += `╠══════════════════════════════════════╣\n`;
      cardMessage += `║ 📦 商品信息                          ║\n`;
      cardMessage += `║   商品名称: ${product.name_zh.padEnd(20)}║\n`;
      cardMessage += `║   价格: ${product.price_eth} ETH`.padEnd(38) + `║\n`;
      cardMessage += `║   描述: ${product.description_zh.substring(0, 20)}...`.padEnd(38) + `║\n`;
      cardMessage += `║                                      ║\n`;
      cardMessage += `║ 💳 支付信息                          ║\n`;
      cardMessage += `║   网络: Sepolia Testnet              ║\n`;
      cardMessage += `║   货币: ETH                          ║\n`;
      cardMessage += `║   收款地址: ${apiResponse.cart.merchant_address.substring(0, 16)}...`.padEnd(38) + `║\n`;
      cardMessage += `║   购物车ID: ${apiResponse.cart.cart_id.substring(0, 20)}...`.padEnd(38) + `║\n`;
      cardMessage += `║                                      ║\n`;
      cardMessage += `║ ✨ 商品特性                          ║\n`;
      
      // 添加商品特性
      const features = product.features.slice(0, 3);
      features.forEach(feature => {
        cardMessage += `║   • ${feature.substring(0, 28)}`.padEnd(38) + `║\n`;
      });
      
      cardMessage += `╚══════════════════════════════════════╝\n`;

      // 返回购物车卡片
      return `${cardMessage}\n❓ **是否确认支付？** 请回复"确认支付"继续，或回复"取消"取消支付。`;
    } catch (error) {
      return `❌ 处理购买失败: ${error.message}`;
    }
  }

  /**
   * 执行支付
   */
  async executePayment() {
    if (!this.currentCart) {
      return '❌ 没有待支付的订单。请先输入购买指令。';
    }

    try {
      const { product, cart } = this.currentCart;

      // 创建会话
      const session = this.paymentSystem.wallet.createSession(
        product.id,
        product.price_eth,
        24
      );

      // 验证会话
      const verification = this.paymentSystem.wallet.verifySession(
        session.session_id,
        session.token
      );

      if (!verification.valid) {
        throw new Error(`会话验证失败: ${verification.error}`);
      }

      // 执行支付
      const provider = new ethers.JsonRpcProvider(this.config.network.rpc_url);
      const wallet = new ethers.Wallet(this.config.user.private_key, provider);

      const priceEth = parseFloat(product.price_eth);
      const amountWei = ethers.parseEther(priceEth.toString());

      // 发送交易
      const tx = await wallet.sendTransaction({
        to: cart.merchant_address,
        value: amountWei
      });

      // 等待确认
      const receipt = await tx.wait();

      // 清空购物车
      this.currentCart = null;

      // 返回支付结果
      let response = `🎉 **支付成功！**\n\n`;
      response += `📊 **交易详情**\n`;
      response += `   交易哈希: \`${tx.hash}\`\n`;
      response += `   区块号: ${receipt.blockNumber}\n`;
      response += `   状态: ${receipt.status === 1 ? '✅ 成功' : '❌ 失败'}\n`;
      response += `   Gas使用: ${receipt.gasUsed.toString()}\n\n`;
      response += `🔗 **区块链验证**\n`;
      response += `   ${this.config.network.explorer_url}/tx/${tx.hash}`;

      return response;
    } catch (error) {
      return `❌ 支付失败: ${error.message}`;
    }
  }

  /**
   * 获取帮助信息
   */
  getHelp() {
    return `📖 **帮助信息**

🛒 **购物指令**
   购买 [商品名称] - 购买指定商品
   我想买[商品名称] - 购买指定商品

💰 **余额查询**
   余额 - 查询用户和商户余额
   我的余额 - 查询用户余额

📦 **商品查询**
   商品列表 - 显示所有商品
   商品详情 [名称] - 显示商品详细信息

📊 **系统信息**
   状态 - 显示系统完整状态

⚙️ **其他指令**
   确认支付 - 确认当前订单支付
   取消支付 - 取消当前订单
   帮助 - 显示此帮助信息

💡 **示例指令**
   • "我想买AI API调用包"
   • "余额"
   • "商品列表"
   • "状态"`;
  }
}

// 导出单例
module.exports = new AIShoppingAssistant();
