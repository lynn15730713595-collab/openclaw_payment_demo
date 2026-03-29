// AI代理支付主逻辑 - 整合所有组件
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// 导入组件
const AIAgentWallet = require('./wallet-module');
const EnhancedApiServiceManager = require('./api-service-enhanced');

// 商品目录类
class ProductCatalog {
  constructor(config) {
    this.config = config;
    this.products = this.loadProducts();
  }
  
  loadProducts() {
    try {
      // 优先加载 products-eth.yaml，如果不存在则加载 products.yaml
      let productsPath = path.join(__dirname, '../config/products-eth.yaml');
      if (!fs.existsSync(productsPath)) {
        productsPath = path.join(__dirname, '../config/products.yaml');
      }
      
      const productsFile = fs.readFileSync(productsPath, 'utf8');
      const data = yaml.load(productsFile);
      return data.products || [];
    } catch (error) {
      console.error('加载商品目录失败:', error.message);
      return [];
    }
  }
  
  // 根据商品ID获取商品
  getProductById(productId) {
    return this.products.find(p => p.id === productId) || null;
  }
  
  // 根据商品名称（中文）获取商品
  getProductByName(name) {
    return this.products.find(p => p.name_zh.includes(name) || p.name.includes(name)) || null;
  }
  
  // 根据端口获取商品
  getProductByPort(port) {
    return this.products.find(p => p.port === port) || null;
  }
  
  // 获取所有商品
  getAllProducts() {
    return this.products;
  }
  
  // 根据意图匹配商品
  matchProductFromIntent(intent) {
    const intentLower = intent.toLowerCase();
    
    // 关键词映射
    const keywordMap = [
      { keywords: ['ai api', 'api调用', 'gpt', '人工智能接口'], productId: 'ai-api-1000' },
      { keywords: ['数据清洗', '数据清理', '数据整理', '清洗服务'], productId: 'data-cleaning-10gb' },
      { keywords: ['模型训练', 'gpu训练', '显卡训练', '深度学习'], productId: 'gpu-training-24h' },
      { keywords: ['分析报告', '商业分析', '市场分析', '数据分析'], productId: 'analysis-report' },
      { keywords: ['系统监控', '监控服务', '性能监控', '实时监控'], productId: 'monitoring-7d' },
      { keywords: ['技术咨询', '专家咨询', '架构咨询', '咨询'], productId: 'consulting-1h' },
      { keywords: ['api文档', '接口文档', 'swagger', 'openapi'], productId: 'api-documentation' },
      { keywords: ['数据备份', '备份服务', '存储备份', '云备份'], productId: 'data-backup-1tb' }
    ];
    
    for (const mapping of keywordMap) {
      for (const keyword of mapping.keywords) {
        if (intentLower.includes(keyword)) {
          return this.getProductById(mapping.productId);
        }
      }
    }
    
    return null;
  }
  
  // 模拟增强版API响应（402）
  simulateEnhancedApiResponse(productId, merchantAddress, proxyContractAddress, cartId, sessionId = null) {
    const product = this.getProductById(productId);
    if (!product) {
      return {
        status: 404,
        body: { error: 'Product not found' }
      };
    }
    
    return {
      status: 402,
      status_text: 'Payment Required',
      headers: {
        'Content-Type': 'application/json',
        'X-Payment-Required': 'true',
        'X-Cart-ID': cartId,
        'X-Product-ID': product.id,
        'X-Product-Name': product.name,
        'X-Total-Amount': `${product.price_usdc}`,
        'X-Currency': 'USDC',
        'X-Merchant-Address': merchantAddress,
        'X-Proxy-Contract': proxyContractAddress,
        'X-Session-Required': 'true',
        'X-API-Port': product.port.toString()
      },
      body: {
        success: false,
        error: 'Payment required',
        message: `This API requires payment of ${product.price_usdc} USDC`,
        cart: {
          cart_id: cartId,
          product_id: product.id,
          product_name: product.name,
          product_name_zh: product.name_zh,
          amount: product.price_usdc,
          currency: 'USDC',
          merchant_address: merchantAddress,
          proxy_contract: proxyContractAddress,
          requires_session: true,
          session_instructions: 'AI需要获取会话授权并调用代理合约'
        },
        product: {
          id: product.id,
          name: product.name,
          name_zh: product.name_zh,
          description: product.description,
          description_zh: product.description_zh,
          price_usdc: product.price_usdc,
          features: product.features,
          delivery: product.delivery,
          validity: product.validity
        },
        payment: {
          amount: product.price_usdc,
          currency: 'USDC',
          address: merchantAddress,
          required: true
        },
        api: {
          endpoint: `http://localhost:${product.port}${product.data_endpoint}`,
          method: 'GET',
          requires_payment: true
        },
        session_id: sessionId
      }
    };
  }
  
  // 模拟支付成功后的API响应
  simulatePaidApiResponse(productId, transactionHash, sessionId) {
    const product = this.getProductById(productId);
    if (!product) {
      return {
        status: 404,
        body: { error: 'Product not found' }
      };
    }
    
    // 生成模拟数据
    const mockData = this.generateMockData(productId);
    
    return {
      status: 200,
      status_text: 'OK',
      headers: {
        'Content-Type': 'application/json',
        'X-Payment-Status': 'verified',
        'X-Transaction-Hash': transactionHash,
        'X-Session-Id': sessionId,
        'X-Product-Delivered': 'true'
      },
      body: {
        success: true,
        message: 'Payment verified. Here is your data.',
        product: {
          id: product.id,
          name: product.name,
          delivery_status: 'delivered'
        },
        payment: {
          verified: true,
          transaction_hash: transactionHash,
          session_id: sessionId,
          delivery_time: new Date().toISOString()
        },
        data: mockData,
        metadata: {
          generated_at: new Date().toISOString(),
          data_size: 'varies by product'
        }
      }
    };
  }
  
  // 生成模拟数据
  generateMockData(productId) {
    const mockDataMap = {
      'ai-api-1000': {
        api_key: `sk_${require('crypto').randomBytes(16).toString('hex')}`,
        credits: 1000,
        endpoints: ['https://api.ai-service.com/v1/chat', 'https://api.ai-service.com/v1/completions'],
        expiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      },
      'data-cleaning-10gb': {
        job_id: `job_${require('crypto').randomBytes(8).toString('hex')}`,
        data_size: '10GB',
        cleaning_status: 'completed',
        download_url: `https://storage.service.com/cleaned-data-${require('crypto').randomBytes(4).toString('hex')}.zip`
      },
      'gpu-training-24h': {
        reservation_id: `gpu_${require('crypto').randomBytes(6).toString('hex')}`,
        gpu_type: 'NVIDIA A100 80GB',
        hours: 24,
        access_url: 'ssh://gpu-cluster.service.com:2222'
      },
      'analysis-report': {
        report_id: `report_${require('crypto').randomBytes(6).toString('hex')}`,
        format: 'PDF',
        download_url: `https://reports.service.com/analysis-${require('crypto').randomBytes(4).toString('hex')}.pdf`
      },
      'monitoring-7d': {
        monitoring_id: `monitor_${require('crypto').randomBytes(6).toString('hex')}`,
        dashboard_url: 'https://monitoring.service.com/dashboard',
        duration_days: 7
      },
      'consulting-1h': {
        booking_id: `consult_${require('crypto').randomBytes(6).toString('hex')}`,
        expert_name: 'Dr. Jane Smith',
        meeting_link: 'https://meet.service.com/consultation-room',
        duration_minutes: 60
      },
      'api-documentation': {
        doc_id: `docs_${require('crypto').randomBytes(6).toString('hex')}`,
        openapi_url: `https://docs.service.com/openapi-${require('crypto').randomBytes(4).toString('hex')}.yaml`,
        interactive_url: 'https://docs.service.com/swagger-ui'
      },
      'data-backup-1tb': {
        backup_id: `backup_${require('crypto').randomBytes(6).toString('hex')}`,
        storage_size: '1TB',
        encryption_key: `enc_${require('crypto').randomBytes(32).toString('hex')}`,
        access_url: 'https://backup.service.com/console'
      }
    };
    
    return mockDataMap[productId] || { message: 'Data for this product is not available' };
  }
}

// AI代理支付主类
class AIAgentPayment {
  constructor(configPath) {
    this.config = this.loadConfig(configPath);
    this.productCatalog = null;
    this.apiServiceManager = null;
    this.wallet = null;
    this.currentState = {
      step: 'initialized',
      currentProduct: null,
      currentCart: null,
      currentSession: null,
      currentAuthorization: null
    };
  }
  
  // 加载配置
  loadConfig(configPath) {
    try {
      const configFile = fs.readFileSync(configPath, 'utf8');
      const config = yaml.load(configFile);
      
      // 设置默认值
      config.proxy_contract = config.proxy_contract || {
        address: '0x0000000000000000000000000000000000000000',
        name: 'AI Payment Proxy',
        version: '1.0.0'
      };
      
      return config;
    } catch (error) {
      console.error('加载配置失败:', error.message);
      process.exit(1);
    }
  }
  
  // 初始化系统
  async initialize() {
    console.log('🚀 AI代理支付系统初始化');
    console.log('======================\n');
    
    try {
      // 1. 初始化商品目录
      this.productCatalog = new ProductCatalog(this.config);
      console.log('✅ 商品目录加载完成');
      console.log(`   商品数量: ${this.productCatalog.getAllProducts().length}`);
      
      // 2. 初始化钱包
      this.wallet = new AIAgentWallet(this.config);
      const walletInit = await this.wallet.initialize();
      if (!walletInit) {
        throw new Error('钱包初始化失败');
      }
      
      // 3. 初始化API服务管理器
      this.apiServiceManager = new EnhancedApiServiceManager(
        this.config,
        this.productCatalog,
        this.config.proxy_contract.address
      );
      
      console.log('\n🎉 系统初始化完成！');
      console.log('================\n');
      
      return {
        success: true,
        products_count: this.productCatalog.getAllProducts().length,
        user_address: this.wallet.userWallet?.address || '模拟模式',
        ai_agent_address: this.wallet.aiAgentWallet?.address,
        proxy_contract: this.config.proxy_contract.address
      };
      
    } catch (error) {
      console.error('❌ 系统初始化失败:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  // 启动API服务
  async startApiServices() {
    if (!this.apiServiceManager) {
      throw new Error('系统未初始化');
    }
    
    console.log('🚀 启动API服务...');
    const result = await this.apiServiceManager.startAllServices();
    
    return result;
  }
  
  // 停止API服务
  async stopApiServices() {
    if (!this.apiServiceManager) {
      throw new Error('API服务未运行');
    }
    
    return await this.apiServiceManager.stopAllServices();
  }
  
  // 获取商品目录
  getProductCatalog() {
    const products = this.productCatalog.getAllProducts();
    return products.map(p => ({
      id: p.id,
      name: p.name_zh,
      description: p.description_zh,
      price: `${p.price_usdc} USDC`,
      port: p.port,
      category: p.category,
      delivery: p.delivery,
      validity: p.validity
    }));
  }
  
  // 处理用户意图
  async processUserIntent(userIntent) {
    console.log(`🤖 处理用户意图: "${userIntent}"`);
    console.log('==============================\n');
    
    // 重置当前状态
    this.currentState = {
      step: 'intent_received',
      currentProduct: null,
      currentCart: null,
      currentSession: null,
      currentAuthorization: null
    };
    
    // 1. 匹配商品
    const product = this.productCatalog.matchProductFromIntent(userIntent);
    if (!product) {
      console.log('❌ 无法匹配商品，请尝试其他描述');
      return {
        success: false,
        type: 'product_not_found',
        message: '未找到匹配的商品，请尝试其他描述',
        suggestions: this.getProductCatalog().map(p => p.name)
      };
    }
    
    this.currentState.currentProduct = product;
    console.log(`✅ 匹配到商品: ${product.name_zh}`);
    console.log(`   商品ID: ${product.id}`);
    console.log(`   端口: ${product.port}`);
    console.log(`   价格: ${product.price_usdc} USDC`);
    console.log('');
    
    // 2. 访问API获取402响应
    console.log('📡 访问商品API获取支付要求...');
    const apiResponse = await this.simulateApiCall(product);
    
    if (!apiResponse.requires_payment) {
      console.log('❌ API未返回支付要求');
      return {
        success: false,
        type: 'api_error',
        message: 'API未返回支付要求',
        product: product
      };
    }
    
    this.currentState.currentCart = apiResponse.cart;
    console.log(`✅ 收到402支付要求`);
    console.log(`   购物车ID: ${apiResponse.cart.cart_id}`);
    console.log(`   金额: ${apiResponse.cart.amount} USDC`);
    console.log(`   收款地址: ${apiResponse.cart.merchant_address}`);
    console.log('');
    
    // 3. 生成购物车卡片
    const cartCard = this.generateCartCard(product, apiResponse.cart);
    
    return {
      success: true,
      type: 'payment_required',
      product: product,
      cart: apiResponse.cart,
      cart_card: cartCard,
      next_step: '等待用户确认支付',
      instructions: '请回复"确认支付"继续，或"取消"取消支付'
    };
  }
  
  // 模拟API调用
  async simulateApiCall(product) {
    // 在实际系统中，这里会实际调用 http://localhost:${product.port}/api/data
    // 现在模拟返回402响应
    
    const cartId = `cart_${product.id}_${Date.now()}_${require('crypto').randomBytes(4).toString('hex')}`;
    
    return {
      status: 402,
      requires_payment: true,
      cart: {
        cart_id: cartId,
        product_id: product.id,
        product_name: product.name,
        product_name_zh: product.name_zh,
        amount: product.price_usdc,
        currency: 'USDC',
        merchant_address: this.config.merchant.address,
        proxy_contract: this.config.proxy_contract.address,
        requires_session: true
      },
      headers: {
        'X-Cart-ID': cartId,
        'X-Product-ID': product.id,
        'X-Product-Name': product.name,
        'X-Total-Amount': `${product.price_usdc}`,
        'X-Currency': 'USDC',
        'X-Merchant-Address': this.config.merchant.address,
        'X-Proxy-Contract': this.config.proxy_contract.address
      }
    };
  }
  
  // 生成购物车卡片
  generateCartCard(product, cart) {
    return {
      title: `🛒 购物车确认`,
      product: product.name_zh,
      description: product.description_zh,
      price: `${cart.amount} ${cart.currency}`,
      details: [
        `商品: ${product.name_zh}`,
        `价格: ${cart.amount} ${cart.currency}`,
        `收款方: ${cart.merchant_address.substring(0, 10)}...`,
        `代理合约: ${cart.proxy_contract.substring(0, 10)}...`,
        `需要会话授权: ${cart.requires_session ? '是' : '否'}`
      ],
      actions: [
        { label: '确认支付', command: 'confirm_payment' },
        { label: '取消', command: 'cancel_payment' }
      ]
    };
  }
  
  // 确认支付（用户确认后）
  async confirmPayment() {
    if (!this.currentState.currentProduct) {
      return {
        success: false,
        type: 'no_active_payment',
        message: '没有待处理的支付'
      };
    }
    
    const product = this.currentState.currentProduct;
    const cart = this.currentState.currentCart;
    
    console.log('✅ 用户确认支付');
    console.log('==============\n');
    
    // 1. 创建会话
    console.log('🔐 创建会话密钥...');
    const session = this.wallet.createSession(
      product.id,
      product.price_usdc,
      24 // 24小时有效期
    );
    
    this.currentState.currentSession = session;
    console.log(`✅ 会话创建成功`);
    console.log(`   会话ID: ${session.session_id}`);
    console.log(`   绑定商品: ${session.product_id}`);
    console.log(`   最大金额: ${session.max_amount} USDC`);
    console.log('');
    
    // 2. 创建EIP-712支付授权
    console.log('📝 创建EIP-712支付授权...');
    const authorization = await this.wallet.createPaymentAuthorization(
      product.id,
      product.price_usdc,
      session.session_id
    );
    
    if (!authorization.success) {
      console.log(`❌ 支付授权失败: ${authorization.error}`);
      return {
        success: false,
        type: 'authorization_failed',
        message: `支付授权失败: ${authorization.error}`,
        product: product
      };
    }
    
    this.currentState.currentAuthorization = authorization;
    console.log(`✅ EIP-712支付授权创建成功`);
    console.log(`   Nonce: ${authorization.authorization.message.nonce}`);
    console.log(`   Deadline: ${new Date(authorization.authorization.message.deadline * 1000).toLocaleString()}`);
    console.log('');
    
    // 3. 执行支付
    console.log('🚀 执行支付...');
    const paymentResult = await this.wallet.executePayment(
      authorization.raw,
      session.token
    );
    
    if (!paymentResult.success) {
      console.log(`❌ 支付失败: ${paymentResult.error}`);
      return {
        success: false,
        type: 'payment_failed',
        message: `支付失败: ${paymentResult.error}`,
        product: product
      };
    }
    
    console.log(`🎉 支付成功！`);
    console.log(`   交易哈希: ${paymentResult.transaction.hash}`);
    console.log(`   金额: ${paymentResult.transaction.amount} USDC`);
    console.log(`   商品: ${paymentResult.transaction.productId}`);
    console.log(`   查看: ${paymentResult.transaction.explorer_url}`);
    console.log('');
    
    // 4. 访问已支付的API获取数据
    console.log('📡 访问已支付的API获取数据...');
    const dataResponse = this.productCatalog.simulatePaidApiResponse(
      product.id,
      paymentResult.transaction.hash,
      session.session_id
    );
    
    console.log(`✅ 数据获取成功`);
    console.log(`   数据大小: ${dataResponse.body.data ? '已生成' : '无数据'}`);
    console.log('');
    
    // 更新状态
    this.currentState.step = 'payment_completed';
    
    return {
      success: true,
      type: 'payment_completed',
      product: product,
      session: session,
      transaction: paymentResult.transaction,
      data: dataResponse.body.data,
      message: `支付成功！交易哈希: ${paymentResult.transaction.hash}，数据已准备就绪。`
    };
  }
  
  // 取消支付
  cancelPayment() {
    console.log('❌ 用户取消支付');
    
    this.currentState = {
      step: 'cancelled',
      currentProduct: null,
      currentCart: null,
      currentSession: null,
      currentAuthorization: null
    };
    
    return {
      success: false,
      type: 'payment_cancelled',
      message: '支付已取消'
    };
  }
  
  // 获取系统状态
  getSystemStatus() {
    return {
      step: this.currentState.step,
      product: this.currentState.currentProduct ? {
        id: this.currentState.currentProduct.id,
        name: this.currentState.currentProduct.name_zh,
        price: this.currentState.currentProduct.price_usdc
      } : null,
      cart: this.currentState.currentCart,
      session: this.currentState.currentSession ? {
        session_id: this.currentState.currentSession.session_id,
        product_id: this.currentState.currentSession.product_id,
        expiry: this.currentState.currentSession.expiry
      } : null,
      authorization: this.currentState.currentAuthorization ? {
        created: true,
        nonce: this.currentState.currentAuthorization.authorization?.message.nonce
      } : null,
      timestamp: new Date().toISOString()
    };
  }
  
  // 获取钱包信息
  async getWalletInfo() {
    if (!this.wallet) {
      return { error: '钱包未初始化' };
    }
    
    const balance = await this.wallet.getBalance();
    const sessions = this.wallet.getAllSessions();
    
    return {
      user_address: this.wallet.userWallet?.address || '模拟模式',
      ai_agent_address: this.wallet.aiAgentWallet?.address,
      balance: balance,
      sessions_count: sessions.length,
      active_sessions: sessions.filter(s => s.isValid).length,
      proxy_contract: this.config.proxy_contract.address
    };
  }
}

// 导出
module.exports = {
  AIAgentPayment,
  ProductCatalog,
  AIAgentWallet,
  EnhancedApiServiceManager
};