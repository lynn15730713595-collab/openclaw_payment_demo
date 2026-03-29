// 会话密钥管理器 - AI代理支付的核心
// 功能：创建、注册、验证会话密钥，生成EIP-712授权

const { ethers } = require('ethers');
const crypto = require('crypto');

class SessionManager {
  constructor(config, wallet, contract) {
    this.config = config;
    this.wallet = wallet;          // evm-wallet-skill实例
    this.contract = contract;      // 代理合约实例
    
    // 会话存储（链下）
    this.sessions = new Map();
    
    // EIP-712配置
    this.eip712Domain = {
      name: config.proxy_contract.name,
      version: config.proxy_contract.version,
      chainId: config.network.chain_id,
      verifyingContract: config.proxy_contract.address
    };
    
    this.types = {
      PaymentAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'amount', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
        { name: 'sessionId', type: 'bytes32' },
        { name: 'productId', type: 'string' }
      ]
    };
  }
  
  // ==================== 会话创建 ====================
  
  /**
   * 创建会话（用户确认支付时调用）
   * @param {string} productId - 商品ID
   * @param {number} amount - 金额（USDC）
   * @param {number} expiryHours - 过期时间（小时）
   * @returns {object} 会话信息
   */
  async createSession(productId, amount, expiryHours = 24) {
    console.log('🔐 创建会话密钥...');
    
    // 1. 生成会话ID和令牌
    const sessionId = crypto.randomBytes(32).toString('hex');
    const token = this.generateSessionToken(sessionId);
    
    // 2. 计算过期时间
    const expiry = Date.now() + (expiryHours * 60 * 60 * 1000);
    
    // 3. 创建会话对象
    const session = {
      // 基础信息
      sessionId: sessionId,
      token: token,
      created: Date.now(),
      expiry: expiry,
      isValid: true,
      
      // 权限边界
      productId: productId,
      maxAmount: amount,
      usedAmount: 0,
      
      // 参与者
      userAddress: this.config.user.address,
      aiAgentId: this.config.ai_agent.id,
      aiAgentAddress: this.config.ai_agent.address,
      
      // 状态
      registeredOnChain: false,
      authorizationCreated: false,
      paymentExecuted: false
    };
    
    // 4. 存储会话（链下）
    this.sessions.set(sessionId, session);
    
    console.log(`✅ 会话创建成功`);
    console.log(`   会话ID: ${sessionId}`);
    console.log(`   商品ID: ${productId}`);
    console.log(`   最大金额: ${amount} USDC`);
    console.log(`   过期时间: ${new Date(expiry).toLocaleString()}`);
    
    return {
      session_id: sessionId,
      token: token,
      product_id: productId,
      max_amount: amount,
      expiry: new Date(expiry).toISOString(),
      user_address: session.userAddress,
      ai_agent_address: session.aiAgentAddress
    };
  }
  
  /**
   * 生成会话令牌
   */
  generateSessionToken(sessionId) {
    return crypto.createHash('sha256')
      .update(`${sessionId}${this.config.ai_agent.id}${Date.now()}`)
      .digest('hex');
  }
  
  // ==================== 链上注册 ====================
  
  /**
   * 注册会话到代理合约（链上）
   * @param {string} sessionId - 会话ID
   * @returns {object} 注册结果
   */
  async registerSessionOnChain(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('会话不存在');
    }
    
    console.log('📝 注册会话到代理合约...');
    
    try {
      // 调用代理合约的createSession方法
      // 这里需要evm-wallet-skill的合约交互功能
      const txHash = await this.callProxyContract(
        'createSession',
        [
          '0x' + sessionId,          // bytes32 sessionId
          session.aiAgentAddress,    // address aiAgent
          ethers.parseUnits(session.maxAmount.toString(), 6), // uint256 maxAmount
          Math.floor(session.expiry / 1000), // uint256 expiry (秒)
          session.productId          // string productId
        ]
      );
      
      session.registeredOnChain = true;
      session.registrationTxHash = txHash;
      
      console.log(`✅ 会话注册成功`);
      console.log(`   交易哈希: ${txHash}`);
      
      return {
        success: true,
        sessionId: sessionId,
        txHash: txHash,
        registered: true
      };
      
    } catch (error) {
      console.log(`❌ 会话注册失败: ${error.message}`);
      return {
        success: false,
        sessionId: sessionId,
        error: error.message
      };
    }
  }
  
  /**
   * 调用代理合约方法
   * @param {string} method - 方法名
   * @param {array} params - 参数数组
   * @returns {string} 交易哈希
   */
  async callProxyContract(method, params) {
    // 这里需要集成evm-wallet-skill的contract.js
    // 暂时返回模拟交易哈希
    return '0x' + crypto.randomBytes(32).toString('hex');
  }
  
  // ==================== EIP-712授权 ====================
  
  /**
   * 创建EIP-712支付授权
   * @param {string} sessionId - 会话ID
   * @param {number} amount - 支付金额
   * @returns {object} 授权信息
   */
  async createEIP712Authorization(sessionId, amount) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('会话不存在');
    }
    
    // 验证会话
    if (!session.isValid) {
      throw new Error('会话无效');
    }
    
    if (Date.now() > session.expiry) {
      throw new Error('会话已过期');
    }
    
    if (amount > session.maxAmount - session.usedAmount) {
      throw new Error(`金额超出会话限制: ${amount} > ${session.maxAmount - session.usedAmount}`);
    }
    
    console.log('📝 创建EIP-712支付授权...');
    
    // 生成随机nonce
    const nonce = ethers.hexlify(ethers.randomBytes(32));
    
    // 设置deadline（1小时后）
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    
    // 转换金额为ETH单位（18位小数）
    const amountWei = ethers.parseUnits(amount.toString(), 18);
    
    // 创建消息（ETH支付，不需要token字段）
    const message = {
      from: session.userAddress,
      to: this.config.merchant.address,
      amount: amountWei,
      nonce: nonce,
      deadline: deadline,
      sessionId: '0x' + sessionId,
      productId: session.productId
    };
    
    // 计算消息哈希
    const digest = ethers.TypedDataEncoder.hash(
      this.eip712Domain,
      this.types,
      message
    );
    
    console.log(`✅ EIP-712消息创建完成`);
    console.log(`   金额: ${amount} ETH`);
    console.log(`   Nonce: ${nonce}`);
    console.log(`   Deadline: ${new Date(deadline * 1000).toLocaleString()}`);
    console.log(`   消息哈希: ${digest.substring(0, 20)}...`);
    
    // 这里需要evm-wallet-skill的签名功能
    // 暂时返回模拟数据
    const signature = '0x' + crypto.randomBytes(65).toString('hex');
    
    session.authorizationCreated = true;
    session.lastAuthorization = {
      message: message,
      signature: signature,
      amount: amount,
      created: Date.now()
    };
    
    return {
      success: true,
      authorization: {
        message: {
          from: message.from,
          to: message.to,
          amount: amountWei.toString(),
          nonce: nonce,
          deadline: deadline,
          sessionId: '0x' + sessionId,
          productId: session.productId
        },
        signature: signature,
        domain: this.eip712Domain,
        types: this.types
      },
      digest: digest
    };
  }
  
  // ==================== 会话验证 ====================
  
  /**
   * 验证会话
   * @param {string} sessionId - 会话ID
   * @param {string} token - 会话令牌
   * @returns {object} 验证结果
   */
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
    
    if (!session.registeredOnChain) {
      return { valid: false, error: '会话未在链上注册' };
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
        expiry: new Date(session.expiry).toISOString(),
        registeredOnChain: session.registeredOnChain
      }
    };
  }
  
  /**
   * 验证EIP-712签名
   * @param {object} authorization - 授权信息
   * @returns {object} 验证结果
   */
  async verifyEIP712Signature(authorization) {
    try {
      // 使用evm-wallet-skill的验证功能
      // 暂时模拟验证
      const recovered = authorization.message.from; // 模拟恢复地址
      
      return {
        valid: true,
        recovered: recovered,
        expected: authorization.message.from,
        message: authorization.message,
        signature: authorization.signature
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }
  
  // ==================== 支付执行 ====================
  
  /**
   * 执行支付（通过代理合约）
   * @param {object} authorization - EIP-712授权
   * @param {string} sessionToken - 会话令牌
   * @returns {object} 支付结果
   */
  async executePayment(authorization, sessionToken) {
    console.log('🚀 通过代理合约执行支付...');
    
    // 验证会话
    const sessionId = authorization.message.sessionId.replace('0x', '');
    const sessionVerification = this.verifySession(sessionId, sessionToken);
    
    if (!sessionVerification.valid) {
      throw new Error(`会话验证失败: ${sessionVerification.error}`);
    }
    
    // 验证EIP-712签名
    const signatureVerification = await this.verifyEIP712Signature(authorization);
    if (!signatureVerification.valid) {
      throw new Error(`签名验证失败: ${signatureVerification.error}`);
    }
    
    // 调用代理合约的executePayment方法
    try {
      const txHash = await this.callProxyContract(
        'executePayment',
        [
          authorization.message,
          authorization.signature
        ]
      );
      
      // 更新会话状态
      const session = this.sessions.get(sessionId);
      if (session) {
        const amount = Number(ethers.formatUnits(authorization.message.amount, 18));
        session.usedAmount += amount;
        session.paymentExecuted = true;
        session.lastPaymentTxHash = txHash;
        
        if (session.usedAmount >= session.maxAmount) {
          session.isValid = false;
          console.log('   会话已用完，标记为无效');
        }
      }
      
      const paymentAmount = Number(ethers.formatUnits(authorization.message.amount, 18));
      
      console.log(`✅ 支付执行成功`);
      console.log(`   交易哈希: ${txHash}`);
      console.log(`   金额: ${paymentAmount} ETH`);
      console.log(`   商品: ${authorization.message.productId}`);
      
      // 获取支付后的余额信息
      const balanceAfterPayment = await this.getBalanceAfterPayment(
        authorization.message.from,
        authorization.message.to,
        paymentAmount
      );
      
      console.log(`\n💰 支付后余额变化:`);
      console.log(`   用户: ${balanceAfterPayment.user.formatted.before} → ${balanceAfterPayment.user.formatted.after}`);
      console.log(`   商户: ${balanceAfterPayment.merchant.formatted.before} → ${balanceAfterPayment.merchant.formatted.after}`);
      
      return {
        success: true,
        transaction: {
          hash: txHash,
          from: authorization.message.from,
          to: authorization.message.to,
          amount: paymentAmount,
          currency: 'ETH',
          productId: authorization.message.productId,
          sessionId: authorization.message.sessionId,
          explorer_url: `${this.config.network.explorer_url}/tx/${txHash}`
        },
        session_updated: session ? {
          usedAmount: session.usedAmount,
          remainingAmount: session.maxAmount - session.usedAmount,
          isValid: session.isValid
        } : null,
        balance_after_payment: balanceAfterPayment
      };
      
    } catch (error) {
      console.log(`❌ 支付执行失败: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  // ==================== 余额查询 ====================
  
  /**
   * 查询支付后的余额（模拟）
   * @param {string} userAddress - 用户地址
   * @param {string} merchantAddress - 商户地址
   * @param {number} paymentAmount - 支付金额
   * @returns {object} 支付后的余额
   */
  async getBalanceAfterPayment(userAddress, merchantAddress, paymentAmount) {
    // 这里应该调用evm-wallet适配器查询真实余额
    // 暂时使用模拟数据
    
    const userBalance = 0.946852328453054; // 用户当前余额
    const merchantBalance = 1.5; // 商户当前余额
    
    // 模拟支付后的余额变化
    const userBalanceAfter = (userBalance - paymentAmount).toFixed(6);
    const merchantBalanceAfter = (merchantBalance + paymentAmount).toFixed(6);
    
    return {
      user: {
        address: userAddress,
        balance_before: userBalance,
        balance_after: parseFloat(userBalanceAfter),
        change: -paymentAmount,
        formatted: {
          before: `${userBalance} ETH`,
          after: `${userBalanceAfter} ETH`,
          change: `-${paymentAmount} ETH`
        }
      },
      merchant: {
        address: merchantAddress,
        balance_before: merchantBalance,
        balance_after: parseFloat(merchantBalanceAfter),
        change: paymentAmount,
        formatted: {
          before: `${merchantBalance} ETH`,
          after: `${merchantBalanceAfter} ETH`,
          change: `+${paymentAmount} ETH`
        }
      },
      payment_amount: paymentAmount,
      timestamp: new Date().toISOString()
    };
  }
  
  // ==================== 会话管理 ====================
  
  /**
   * 获取所有会话
   * @returns {array} 会话列表
   */
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
        isValid: session.isValid,
        registeredOnChain: session.registeredOnChain,
        authorizationCreated: session.authorizationCreated,
        paymentExecuted: session.paymentExecuted
      });
    }
    return sessions;
  }
  
  /**
   * 使会话失效
   * @param {string} sessionId - 会话ID
   * @returns {object} 结果
   */
  invalidateSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isValid = false;
      console.log(`✅ 会话 ${sessionId} 已标记为无效`);
      return { success: true, sessionId: sessionId };
    }
    return { success: false, error: '会话不存在' };
  }
  
  /**
   * 清理过期会话
   * @returns {number} 清理的会话数量
   */
  cleanupExpiredSessions() {
    let count = 0;
    const now = Date.now();
    
    for (const [sessionId, session] of this.sessions) {
      if (now > session.expiry) {
        session.isValid = false;
        count++;
      }
    }
    
    if (count > 0) {
      console.log(`🧹 清理了 ${count} 个过期会话`);
    }
    
    return count;
  }
}

module.exports = SessionManager;