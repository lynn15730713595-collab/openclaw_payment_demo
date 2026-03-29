#!/usr/bin/env node
// 完整版AI支付交互测试脚本
// 包含：API服务 → 402响应 → 会话密钥 → 验证 → 真实链上支付

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const yaml = require('js-yaml');
const http = require('http');

class CompleteInteractiveTest {
  constructor() {
    this.rl = null;
    this.config = null;
    this.paymentSystem = null;
  }
  
  initReadline() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }
  
  async ask(question) {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer.trim());
      });
    });
  }
  
  // 加载配置
  loadConfig() {
    try {
      const configPath = path.join(__dirname, 'config/demo-config.yaml');
      const configFile = fs.readFileSync(configPath, 'utf8');
      const config = yaml.load(configFile);
      
      // 设置你的私钥
      config.user.private_key = '0x154a29b3234595ac8ccf6bc88e496680048ae90b5c5ec6f6868f279e9da32eaf';
      
      return config;
    } catch (error) {
      console.log('❌ 配置文件加载失败:', error.message);
      process.exit(1);
    }
  }
  
  // 显示欢迎信息
  showWelcome() {
    console.clear();
    console.log('🚀 完整版AI支付交互测试系统');
    console.log('============================\n');
    console.log('📋 系统特性:');
    console.log('   • 8个商品API服务 (端口3000-3007)');
    console.log('   • 402支付要求响应');
    console.log('   • AI会话密钥生成和验证');
    console.log('   • 真实链上ETH支付');
    console.log('   • ETH支付 (不是USDC)');
    console.log('   • 价格不超过0.015 ETH');
    console.log('');
    console.log('💡 可用指令类型:');
    console.log('   🛒 购物指令: "我想买AI API调用包"');
    console.log('   💰 余额查询: "余额"、"我的余额"');
    console.log('   📦 商品查询: "商品列表"、"商品详情 [名称]"');
    console.log('   📊 系统信息: "状态"、"系统状态"');
    console.log('   ❓ 帮助信息: "帮助"');
    console.log('   🚪 退出系统: "退出"');
    console.log('');
    console.log('🔄 完整购物流程:');
    console.log('   1. 输入购买指令');
    console.log('   2. 系统访问API获取402响应');
    console.log('   3. 显示购物车卡片');
    console.log('   4. 生成AI会话密钥');
    console.log('   5. 验证会话权限');
    console.log('   6. 执行真实链上支付');
    console.log('   7. 访问已支付的API');
    console.log('');
  }
  
  // 初始化系统
  async initialize() {
    console.log('🔧 初始化完整支付系统...\n');
    
    try {
      const { AIAgentPayment } = require('./src/ai-agent-payment');
      const { ethers } = require('ethers');
      
      this.config = this.loadConfig();
      
      // 设置环境变量
      if (this.config.user.private_key) {
        process.env.USER_PRIVATE_KEY = this.config.user.private_key;
        console.log('✅ 私钥已设置');
      }
      
      // 创建支付系统实例
      const configPath = path.join(__dirname, 'config/demo-config.yaml');
      this.paymentSystem = new AIAgentPayment(configPath);
      
      // 初始化
      const initResult = await this.paymentSystem.initialize();
      
      if (!initResult.success) {
        throw new Error(initResult.error || '初始化失败');
      }
      
      console.log('✅ 支付系统初始化完成');
      console.log(`   用户地址: ${initResult.user_address}`);
      console.log('');
      
      // 启动API服务
      console.log('🚀 启动商品API服务 (端口3000-3007)...');
      const apiResult = await this.paymentSystem.startApiServices();
      
      if (apiResult.success > 0) {
        console.log(`✅ ${apiResult.success} 个API服务启动成功`);
      } else {
        console.log('⚠️  API服务启动失败，但可以继续');
      }
      console.log('');
      
      // 显示钱包余额
      const provider = new ethers.JsonRpcProvider(this.config.network.rpc_url);
      const wallet = new ethers.Wallet(this.config.user.private_key, provider);
      const address = await wallet.getAddress();
      const balance = await provider.getBalance(address);
      
      console.log('💰 钱包信息:');
      console.log(`   地址: ${address}`);
      console.log(`   ETH余额: ${ethers.formatEther(balance)} ETH`);
      console.log('');
      
      return true;
    } catch (error) {
      console.log('❌ 初始化失败:', error.message);
      console.log('');
      console.log('🔍 错误详情:', error);
      return false;
    }
  }
  
  // 显示商品列表
  showProducts() {
    const products = this.paymentSystem.productCatalog.getAllProducts();
    
    console.log('🛍️  商品列表:');
    console.log('=============\n');
    
    products.forEach((product, index) => {
      console.log(`   ${index + 1}. ${product.name_zh}`);
      console.log(`      价格: ${product.price_eth} ETH`);
      console.log(`      端口: ${product.port}`);
      console.log('');
    });
    
    console.log('💡 购买指令示例:');
    console.log('   • "我想买AI API调用包"');
    console.log('   • "购买数据清洗服务"');
    console.log('   • "需要模型训练时间"');
    console.log('');
  }
  
  // 查询余额
  async checkBalance() {
    console.log('\n💰 查询余额');
    console.log('============\n');
    
    try {
      const { ethers } = require('ethers');
      
      const provider = new ethers.JsonRpcProvider(this.config.network.rpc_url);
      const userWallet = new ethers.Wallet(this.config.user.private_key, provider);
      
      // 用户余额
      const userAddress = await userWallet.getAddress();
      const userBalance = await provider.getBalance(userAddress);
      
      console.log('👤 用户余额:');
      console.log(`   地址: ${userAddress}`);
      console.log(`   ETH余额: ${ethers.formatEther(userBalance)} ETH`);
      console.log('');
      
      // 商户余额
      const merchantAddress = this.config.merchant.address;
      const merchantBalance = await provider.getBalance(merchantAddress);
      
      console.log('🏪 商户余额:');
      console.log(`   地址: ${merchantAddress}`);
      console.log(`   ETH余额: ${ethers.formatEther(merchantBalance)} ETH`);
      console.log('');
      
      // 商户名称
      console.log(`   商户名称: ${this.config.merchant.name}`);
      console.log('');
      
    } catch (error) {
      console.log('❌ 查询余额失败:', error.message);
    }
  }
  
  // 查询商品详情
  async showProductDetails(productName) {
    console.log('\n📦 商品详情');
    console.log('============\n');
    
    try {
      const product = this.paymentSystem.productCatalog.matchProductFromIntent(productName);
      
      if (!product) {
        console.log('❌ 未找到商品');
        return;
      }
      
      console.log(`商品ID: ${product.id}`);
      console.log(`商品名称: ${product.name_zh}`);
      console.log(`英文名称: ${product.name}`);
      console.log(`价格: ${product.price_eth} ETH`);
      console.log(`描述: ${product.description_zh}`);
      console.log(`类别: ${product.category}`);
      console.log(`端口: ${product.port}`);
      console.log(`API端点: ${product.data_endpoint}`);
      console.log(`交付时间: ${product.delivery}`);
      console.log(`有效期: ${product.validity}`);
      console.log('');
      console.log('功能特性:');
      product.features.forEach((feature, index) => {
        console.log(`   ${index + 1}. ${feature}`);
      });
      console.log('');
      
      // 检查API服务状态（使用原生http模块）
      return new Promise((resolve) => {
        const req = http.get(`http://localhost:${product.port}/health`, (res) => {
          console.log('✅ API服务状态: 运行中');
          console.log('');
          resolve();
        });
        
        req.on('error', () => {
          console.log('❌ API服务状态: 未运行');
          console.log('');
          resolve();
        });
        
        req.setTimeout(1000, () => {
          console.log('⏱️  API服务状态: 超时');
          console.log('');
          req.destroy();
          resolve();
        });
      });
      
    } catch (error) {
      console.log('❌ 查询商品详情失败:', error.message);
    }
  }
  
  // 显示系统状态
  async showSystemStatus() {
    console.log('\n📊 系统状态');
    console.log('============\n');
    
    try {
      const { ethers } = require('ethers');
      
      // 网络状态
      console.log('🌐 网络信息:');
      console.log(`   网络: ${this.config.network.name}`);
      console.log(`   Chain ID: ${this.config.network.chain_id}`);
      console.log(`   RPC: ${this.config.network.rpc_url}`);
      console.log(`   浏览器: ${this.config.network.explorer_url}`);
      console.log('');
      
      // 用户钱包
      const provider = new ethers.JsonRpcProvider(this.config.network.rpc_url);
      const userWallet = new ethers.Wallet(this.config.user.private_key, provider);
      const userAddress = await userWallet.getAddress();
      const userBalance = await provider.getBalance(userAddress);
      
      console.log('👤 用户钱包:');
      console.log(`   地址: ${userAddress}`);
      console.log(`   余额: ${ethers.formatEther(userBalance)} ETH`);
      console.log('');
      
      // 商户信息
      const merchantAddress = this.config.merchant.address;
      const merchantBalance = await provider.getBalance(merchantAddress);
      
      console.log('🏪 商户信息:');
      console.log(`   名称: ${this.config.merchant.name}`);
      console.log(`   地址: ${merchantAddress}`);
      console.log(`   余额: ${ethers.formatEther(merchantBalance)} ETH`);
      console.log('');
      
      // 商品统计
      const products = this.paymentSystem.productCatalog.getAllProducts();
      const prices = products.map(p => parseFloat(p.price_eth));
      
      console.log('🛍️  商品统计:');
      console.log(`   商品数量: ${products.length}`);
      console.log(`   价格范围: ${Math.min(...prices)} - ${Math.max(...prices)} ETH`);
      console.log(`   平均价格: ${(prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(6)} ETH`);
      console.log(`   全部 ≤ 0.015 ETH: ${prices.every(p => p <= 0.015) ? '✅' : '❌'}`);
      console.log('');
      
      // API服务状态
      let runningServices = 0;
      
      const checkPromises = [];
      for (let port = 3000; port <= 3007; port++) {
        checkPromises.push(
          new Promise((resolve) => {
            const req = http.get(`http://localhost:${port}/health`, (res) => {
              resolve(1);
            });
            req.on('error', () => resolve(0));
            req.setTimeout(1000, () => {
              req.destroy();
              resolve(0);
            });
          })
        );
      }
      
      const results = await Promise.all(checkPromises);
      runningServices = results.reduce((sum, val) => sum + val, 0);
      
      console.log('📡 API服务:');
      console.log(`   运行中: ${runningServices}/8`);
      console.log(`   端口范围: 3000-3007`);
      console.log('');
      
    } catch (error) {
      console.log('❌ 获取系统状态失败:', error.message);
    }
  }
  
  // 显示帮助信息
  showHelp() {
    console.log('\n📖 帮助信息');
    console.log('============\n');
    
    console.log('🛒 购物指令:');
    console.log('   购买 [商品名称]     - 购买指定商品');
    console.log('   我想买[商品名称]    - 购买指定商品');
    console.log('   需要[商品名称]      - 购买指定商品');
    console.log('');
    
    console.log('💰 余额查询:');
    console.log('   余额                - 查询用户和商户余额');
    console.log('   查询余额            - 查询用户和商户余额');
    console.log('   我的余额            - 查询用户余额');
    console.log('');
    
    console.log('📦 商品查询:');
    console.log('   商品列表            - 显示所有商品');
    console.log('   商品详情 [名称]     - 显示商品详细信息');
    console.log('   [商品名称]详情      - 显示商品详细信息');
    console.log('');
    
    console.log('📊 系统信息:');
    console.log('   状态                - 显示系统完整状态');
    console.log('   系统状态            - 显示系统完整状态');
    console.log('   帮助                - 显示此帮助信息');
    console.log('');
    
    console.log('⚙️  其他指令:');
    console.log('   退出                - 退出系统');
    console.log('   exit/quit           - 退出系统');
    console.log('');
    
    console.log('💡 示例指令:');
    console.log('   • "我想买AI API调用包"');
    console.log('   • "购买数据清洗服务"');
    console.log('   • "余额"');
    console.log('   • "商品详情 AI API调用包"');
    console.log('   • "状态"');
    console.log('');
  }
  
  // 解析用户指令
  async parseCommand(input) {
    const inputLower = input.toLowerCase();
    
    // 退出指令
    if (input === '退出' || input === 'exit' || input === 'quit') {
      return 'exit';
    }
    
    // 帮助指令
    if (input === '帮助' || input === 'help') {
      this.showHelp();
      return 'help';
    }
    
    // 商品列表
    if (input === '商品列表' || input === 'list' || input === '商品') {
      this.showProducts();
      return 'list';
    }
    
    // 余额查询
    if (input.includes('余额') || input.includes('查询余额') || input === '我的余额') {
      await this.checkBalance();
      return 'balance';
    }
    
    // 系统状态
    if (input === '状态' || input === '系统状态' || input === 'status') {
      await this.showSystemStatus();
      return 'status';
    }
    
    // 商品详情
    if (input.includes('详情') || input.includes('商品详情')) {
      const productName = input.replace('详情', '').replace('商品详情', '').trim();
      if (productName) {
        await this.showProductDetails(productName);
        return 'details';
      }
    }
    
    // 购买指令
    if (input.includes('购买') || input.includes('买') || input.includes('我要') || 
        input.includes('想买') || input.includes('需要') || input.includes('订阅')) {
      await this.processPurchase(input);
      return 'purchase';
    }
    
    // 未知指令
    return 'unknown';
  }
  
  // 处理购买流程
  async processPurchase(intent) {
    console.log(`\n🎯 处理购买指令: "${intent}"`);
    console.log('============================\n');
    
    try {
      const { ethers } = require('ethers');
      
      // ========== 步骤1: 匹配商品 ==========
      console.log('📦 步骤1: 匹配商品...');
      const product = this.paymentSystem.productCatalog.matchProductFromIntent(intent);
      
      if (!product) {
        console.log('❌ 未找到匹配的商品');
        return;
      }
      
      console.log('✅ 商品匹配成功');
      console.log(`   商品: ${product.name_zh}`);
      console.log(`   价格: ${product.price_eth} ETH`);
      console.log('');
      
      // ========== 步骤2: 访问API获取402响应 ==========
      console.log('📡 步骤2: 访问商品API获取支付要求...');
      
      const apiResponse = await this.paymentSystem.simulateApiCall(product);
      
      if (!apiResponse.requires_payment) {
        console.log('❌ API未返回支付要求');
        return;
      }
      
      console.log('✅ 收到402 Payment Required响应');
      console.log(`   购物车ID: ${apiResponse.cart.cart_id}`);
      console.log(`   支付金额: ${apiResponse.cart.amount} ETH`);
      console.log(`   收款地址: ${apiResponse.cart.merchant_address}`);
      console.log('');
      
      // ========== 步骤3: 显示购物车卡片 ==========
      console.log('🛒 步骤3: 显示购物车卡片...');
      const cartCard = this.paymentSystem.generateCartCard(product, apiResponse.cart);
      
      console.log('');
      console.log(cartCard.message);
      console.log('');
      
      // ========== 步骤4: 用户确认 ==========
      const confirm = await this.ask('❓ 是否确认支付？(输入 "确认支付" 继续，其他取消): ');
      
      if (confirm !== '确认支付') {
        console.log('❌ 支付取消');
        this.paymentSystem.cancelPayment();
        return;
      }
      
      // ========== 步骤5: 生成会话密钥 ==========
      console.log('\n🔐 步骤5: 生成AI会话密钥...');
      
      const session = this.paymentSystem.wallet.createSession(
        product.id,
        product.price_eth,
        24 // 24小时有效期
      );
      
      console.log('✅ 会话密钥生成成功');
      console.log(`   会话ID: ${session.session_id}`);
      console.log(`   绑定商品: ${session.product_id}`);
      console.log(`   最大金额: ${session.max_amount} ETH`);
      console.log('');
      
      // ========== 步骤6: 验证会话密钥 ==========
      console.log('🔍 步骤6: 验证会话密钥...');
      
      const verification = this.paymentSystem.wallet.verifySession(
        session.session_id,
        session.token
      );
      
      if (!verification.valid) {
        throw new Error(`会话验证失败: ${verification.error}`);
      }
      
      console.log('✅ 会话验证通过');
      console.log(`   用户地址: ${verification.session.userAddress}`);
      console.log(`   AI代理: ${verification.session.aiAgentId}`);
      console.log('');
      
      // ========== 步骤7: 执行真实链上支付 ==========
      console.log('💳 步骤7: 执行真实链上ETH支付...');
      
      const provider = new ethers.JsonRpcProvider(this.config.network.rpc_url);
      const wallet = new ethers.Wallet(this.config.user.private_key, provider);
      const address = await wallet.getAddress();
      
      console.log(`   钱包地址: ${address}`);
      console.log(`   商品: ${product.name_zh}`);
      console.log(`   金额: ${product.price_eth} ETH`);
      console.log(`   收款人: ${apiResponse.cart.merchant_address}`);
      console.log('');
      
      const priceEth = parseFloat(product.price_eth);
      const amountWei = ethers.parseEther(priceEth.toString());
      
      console.log('📤 发送交易...');
      const tx = await wallet.sendTransaction({
        to: apiResponse.cart.merchant_address,
        value: amountWei
      });
      
      console.log(`✅ 交易已发送: ${tx.hash}`);
      console.log('   等待确认...');
      
      const receipt = await tx.wait();
      
      console.log('\n🎉 支付成功！');
      console.log('===========\n');
      
      console.log('📊 交易详情:');
      console.log(`   交易哈希: ${tx.hash}`);
      console.log(`   区块号: ${receipt.blockNumber}`);
      console.log(`   状态: ${receipt.status === 1 ? '成功 ✅' : '失败 ❌'}`);
      console.log(`   Gas使用: ${receipt.gasUsed.toString()}`);
      console.log('');
      
      // ========== 步骤8: 访问已支付的API ==========
      console.log('📡 步骤8: 访问已支付的API获取数据...');
      
      return new Promise((resolve) => {
        const options = {
          hostname: 'localhost',
          port: product.port,
          path: product.data_endpoint,
          method: 'GET',
          headers: {
            'X-Session-Id': session.session_id,
            'X-Transaction-Hash': tx.hash,
            'X-Payment-Verified': 'true'
          }
        };
        
        const req = http.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            console.log('✅ API访问成功');
            console.log(`   状态码: ${res.statusCode}`);
            console.log(`   数据已获取: ${data ? '是' : '否'}`);
            console.log('');
            resolve();
          });
        });
        
        req.on('error', (error) => {
          console.log('⚠️  API访问失败:', error.message);
          console.log('   但支付已完成，交易已上链');
          console.log('');
          resolve();
        });
        
        req.setTimeout(2000, () => {
          console.log('⚠️  API访问超时');
          console.log('   但支付已完成，交易已上链');
          console.log('');
          req.destroy();
          resolve();
        });
        
        req.end();
      });
      
      // ========== 完成 ==========
      console.log('🔗 区块链验证链接:');
      console.log(`   ${this.config.network.explorer_url}/tx/${tx.hash}`);
      console.log('');
      
      console.log('✅ 完整支付流程已完成！');
      console.log('   1. ✅ 匹配商品');
      console.log('   2. ✅ 访问API获取402响应');
      console.log('   3. ✅ 显示购物车卡片');
      console.log('   4. ✅ 用户确认支付');
      console.log('   5. ✅ 生成会话密钥');
      console.log('   6. ✅ 验证会话权限');
      console.log('   7. ✅ 执行真实链上支付');
      console.log('   8. ✅ 访问已支付API');
      console.log('');
      
    } catch (error) {
      console.log('❌ 购买流程失败:', error.message);
      console.log('');
      console.log('🔍 错误详情:', error);
    }
  }
  
  // 主循环
  async mainLoop() {
    this.initReadline();
    this.showWelcome();
    
    const initialized = await this.initialize();
    if (!initialized) {
      this.rl.close();
      return;
    }
    
    this.showProducts();
    
    console.log('💬 输入指令开始 (输入 "帮助" 查看所有命令，输入 "退出" 结束):\n');
    
    while (true) {
      const input = await this.ask('> ');
      
      if (input.trim() === '') {
        continue;
      }
      
      const result = await this.parseCommand(input);
      
      if (result === 'exit') {
        console.log('👋 退出系统');
        break;
      }
      
      if (result === 'unknown') {
        console.log('❌ 未知命令，请输入 "帮助" 查看可用命令\n');
      } else if (result !== 'help' && result !== 'list' && result !== 'balance' && result !== 'status') {
        console.log('\n💬 继续输入指令 (输入 "帮助" 查看命令，输入 "退出" 结束):\n');
      }
    }
    
    this.rl.close();
  }
  
  // 运行
  async run() {
    try {
      await this.mainLoop();
    } catch (error) {
      console.log('❌ 系统运行失败:', error.message);
      if (this.rl) this.rl.close();
      process.exit(1);
    }
  }
}

// 运行
if (require.main === module) {
  const test = new CompleteInteractiveTest();
  test.run().catch(error => {
    console.error('❌ 执行失败:', error);
    process.exit(1);
  });
}