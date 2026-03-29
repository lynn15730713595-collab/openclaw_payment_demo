// AI代理支付钱包模块
// 功能：EOA操作、会话密钥管理、EIP-712签名

const { ethers } = require('ethers');
const crypto = require('crypto');

class AIAgentWallet {
  constructor(config) {
    this.config = config;
    this.provider = null;
    this.userWallet = null;
    this.aiAgentWallet = null;
    this.sessions = new Map(); // 会话存储
    this.initialized = false;
  }
  
  // 初始化钱包
  async initialize() {
    try {
      // 创建provider
      this.provider = new ethers.JsonRpcProvider(
        this.config.network.rpc_url,
        this.config.network.chain_id
      );
      
      // 创建用户钱包（从私钥）
      if (process.env.USER_PRIVATE_KEY) {
        this.userWallet = new ethers.Wallet(process.env.USER_PRIVATE_KEY, this.provider);
        console.log(`✅ 用户钱包初始化完成`);
        console.log(`   地址: ${this.userWallet.address}`);
      } else {
        console.log(`⚠️  用户私钥未设置，使用模拟模式`);
        // 创建模拟钱包（仅用于演示）
        this.userWallet = ethers.Wallet.createRandom();
      }
      
      // 创建AI代理钱包
      this.aiAgentWallet = ethers.Wallet.createRandom();
      console.log(`✅ AI代理钱包创建完成`);
      console.log(`   地址: ${this.aiAgentWallet.address}`);
      console.log(`   网络: ${this.config.network.name} (Chain ID: ${this.config.network.chain_id})`);
      
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('钱包初始化失败:', error.message);
      return false;
    }
  }
  
  // 创建会话（单次有效，绑定特定商品）
  createSession(productId, maxAmount, expiryHours = 24) {
    if (!this.initialized) {
      throw new Error('钱包未初始化');
    }
    
    // 生成会话ID
    const sessionId = crypto.randomBytes(32).toString('hex');
    
    // 生成会话令牌
    const token = crypto.createHash('sha256')
      .update(`${sessionId}${this.config.ai_agent.id}${Date.now()}`)
      .digest('hex');
    
    // 计算过期时间
    const expiry = Date.now() + (expiryHours * 60 * 60 * 1000);
    
    const session = {
      sessionId: sessionId,
      token: token,
      userAddress: this.userWallet.address,
      aiAgentId: this.config.ai_agent.id,
      aiAgentAddress: this.aiAgentWallet.address,
      productId: productId,
      maxAmount: maxAmount,
      usedAmount: 0,
      created: Date.now(),
      expiry: expiry,
      isValid: true
    };
    
    // 存储会话
    this.sessions.set(sessionId, session);
    
    console.log(`✅ 会话创建成功`);
    console.log(`   会话ID: ${sessionId}`);
    console.log(`   商品ID: ${productId}`);
    console.log(`   最大金额: ${maxAmount} USDC`);
    console.log(`   过期时间: ${new Date(expiry).toLocaleString()}`);
    
    return {
      session_id: sessionId,
      token: token,
      user_address: this.userWallet.address,
      ai_agent_address: this.aiAgentWallet.address,
      product_id: productId,
      max_amount: maxAmount,
      expiry: new Date(expiry).toISOString(),
      proxy_contract: this.config.proxy_contract.address
    };
  }
  
  // 验证会话
  verifySession(sessionId, token) {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return { valid: false, error: '会话不存在' };
    }
    
    if (session.token !== token) {
      return { valid: false, error: '令牌无效' };
    }
    
    if (!session.isValid) {
      return { valid: false, error: '会话已失效' };
    }
    
    if (Date.now() > session.expiry) {
      return { valid: false, error: '会话已过期' };
    }
    
    return {
      valid: true,
      session: {
        sessionId: session.sessionId,
        userAddress: session.userAddress,
        aiAgentId: session.aiAgentId,
        aiAgentAddress: session.aiAgentAddress,
        productId: session.productId,
        maxAmount: session.maxAmount,
        usedAmount: session.usedAmount,
        remainingAmount: session.maxAmount - session.usedAmount,
        expiry: new Date(session.expiry).toISOString()
      }
    };
  }
  
  // 创建EIP-712支付授权
  async createPaymentAuthorization(productId, amount, sessionId) {
    if (!this.initialized) {
      throw new Error('钱包未初始化');
    }
    
    // 验证会话
    const sessionVerification = this.verifySession(sessionId, 'skip-token-check');
    if (!sessionVerification.valid) {
      throw new Error(`会话无效: ${sessionVerification.error}`);
    }
    
    const session = sessionVerification.session;
    
    // 验证商品匹配
    if (session.productId !== productId) {
      throw new Error(`会话绑定商品不匹配: ${session.productId} != ${productId}`);
    }
    
    // 验证金额
    if (amount > session.remainingAmount) {
      throw new Error(`金额超出会话限制: ${amount} > ${session.remainingAmount}`);
    }
    
    // 生成随机nonce
    const nonce = ethers.hexlify(ethers.randomBytes(32));
    
    // 设置deadline（1小时后）
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    
    // 转换金额为USDC单位（6位小数）
    const amountWei = ethers.parseUnits(amount.toString(), 6);
    
    // EIP-712域定义
    const domain = {
      name: this.config.proxy_contract.name,
      version: this.config.proxy_contract.version,
      chainId: this.config.network.chain_id,
      verifyingContract: this.config.proxy_contract.address
    };
    
    // 类型定义
    const types = {
      PaymentAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'token', type: 'address' },
        { name: 'amount', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
        { name: 'sessionId', type: 'bytes32' },
        { name: 'productId', type: 'string' }
      ]
    };
    
    // 消息
    const message = {
      from: session.userAddress,
      to: this.config.merchant.address,
      token: this.config.network.usdc_address,
      amount: amountWei,
      nonce: nonce,
      deadline: deadline,
      sessionId: ethers.hexlify('0x' + sessionId),
      productId: productId
    };
    
    // 签名
    const signature = await this.userWallet.signTypedData(domain, types, message);
    
    // 解析签名
    const sig = ethers.Signature.from(signature);
    
    console.log(`✅ EIP-712支付授权创建成功`);
    console.log(`   金额: ${amount} USDC`);
    console.log(`   Nonce: ${nonce}`);
    console.log(`   Deadline: ${new Date(deadline * 1000).toLocaleString()}`);
    console.log(`   签名: ${signature.substring(0, 64)}...`);
    
    return {
      success: true,
      authorization: {
        message: {
          from: message.from,
          to: message.to,
          token: message.token,
          amount: amountWei.toString(),
          nonce: nonce,
          deadline: deadline,
          sessionId: ethers.hexlify('0x' + sessionId),
          productId: productId
        },
        signature: signature,
        domain: domain,
        types: types
      },
      raw: {
        message: message,
        signature: signature,
        domain: domain,
        types: types
      }
    };
  }
  
  // 执行支付（调用代理合约）
  async executePayment(authorization, sessionToken) {
    if (!this.initialized) {
      throw new Error('钱包未初始化');
    }
    
    // 这里应该调用代理合约的executePayment方法
    // 由于代理合约尚未部署，我们模拟这个过程
    
    console.log(`🚀 模拟调用代理合约执行支付...`);
    console.log(`   付款人: ${authorization.message.from}`);
    console.log(`   收款人: ${authorization.message.to}`);
    console.log(`   金额: ${ethers.formatUnits(authorization.message.amount, 6)} USDC`);
    console.log(`   商品: ${authorization.message.productId}`);
    console.log(`   会话ID: ${authorization.message.sessionId}`);
    
    // 模拟交易哈希
    const txHash = '0x' + crypto.randomBytes(32).toString('hex');
    
    // 更新会话使用金额
    const sessionId = authorization.message.sessionId.replace('0x', '');
    const session = this.sessions.get(sessionId);
    if (session) {
      const amount = Number(ethers.formatUnits(authorization.message.amount, 6));
      session.usedAmount += amount;
      if (session.usedAmount >= session.maxAmount) {
        session.isValid = false;
        console.log(`   会话已用完，标记为无效`);
      }
    }
    
    return {
      success: true,
      transaction: {
        hash: txHash,
        from: authorization.message.from,
        to: authorization.message.to,
        amount: ethers.formatUnits(authorization.message.amount, 6),
        currency: 'USDC',
        productId: authorization.message.productId,
        sessionId: authorization.message.sessionId,
        explorer_url: `${this.config.network.explorer_url}/tx/${txHash}`
      },
      session_updated: session ? {
        usedAmount: session.usedAmount,
        remainingAmount: session.maxAmount - session.usedAmount,
        isValid: session.isValid
      } : null
    };
  }
  
  // 查询余额
  async getBalance(address = null) {
    if (!this.initialized) {
      throw new Error('钱包未初始化');
    }
    
    const targetAddress = address || this.userWallet.address;
    
    try {
      // 查询ETH余额
      const ethBalance = await this.provider.getBalance(targetAddress);
      
      // 查询USDC余额（需要USDC合约）
      const usdcAbi = ['function balanceOf(address owner) view returns (uint256)'];
      const usdcContract = new ethers.Contract(
        this.config.network.usdc_address,
        usdcAbi,
        this.provider
      );
      
      const usdcBalance = await usdcContract.balanceOf(targetAddress);
      
      return {
        address: targetAddress,
        eth_balance: ethers.formatEther(ethBalance),
        usdc_balance: ethers.formatUnits(usdcBalance, 6),
        formatted: {
          eth: `${parseFloat(ethers.formatEther(ethBalance)).toFixed(6)} ETH`,
          usdc: `${parseFloat(ethers.formatUnits(usdcBalance, 6)).toFixed(2)} USDC`
        },
        network: this.config.network.name
      };
    } catch (error) {
      console.error('查询余额失败:', error.message);
      return {
        address: targetAddress,
        error: error.message,
        success: false
      };
    }
  }
  
  // 获取所有会话
  getAllSessions() {
    const sessions = [];
    for (const [sessionId, session] of this.sessions) {
      sessions.push({
        sessionId: sessionId,
        userAddress: session.userAddress,
        aiAgentId: session.aiAgentId,
        productId: session.productId,
        maxAmount: session.maxAmount,
        usedAmount: session.usedAmount,
        remainingAmount: session.maxAmount - session.usedAmount,
        created: new Date(session.created).toISOString(),
        expiry: new Date(session.expiry).toISOString(),
        isValid: session.isValid
      });
    }
    return sessions;
  }
  
  // 使会话失效
  invalidateSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isValid = false;
      console.log(`✅ 会话 ${sessionId} 已标记为无效`);
      return { success: true, sessionId: sessionId };
    }
    return { success: false, error: '会话不存在' };
  }
}

module.exports = AIAgentWallet;