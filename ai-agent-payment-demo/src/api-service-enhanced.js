// 增强版API服务管理器 - 支持购物车ID和链上字段
const express = require('express');
const cors = require('cors');
const http = require('http');
const crypto = require('crypto');

class EnhancedApiServiceManager {
  constructor(config, productCatalog, proxyContractAddress) {
    this.config = config;
    this.productCatalog = productCatalog;
    this.proxyContractAddress = proxyContractAddress;
    this.servers = new Map();
    this.apps = new Map();
    this.basePort = config.api_services?.base_port || 3000;
    
    // 购物车ID生成器
    this.cartIdPrefix = 'cart_';
  }
  
  // 生成购物车ID
  generateCartId(productId) {
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    return `${this.cartIdPrefix}${productId}_${timestamp}_${random}`;
  }
  
  // 启动所有服务
  async startAllServices() {
    console.log('🚀 启动增强版商品API服务...');
    console.log('==============================\n');
    
    const products = this.productCatalog.getAllProducts();
    const promises = [];
    
    for (const product of products) {
      promises.push(this.startEnhancedService(product));
    }
    
    const results = await Promise.allSettled(promises);
    
    console.log('\n✅ API服务启动完成');
    console.log('================\n');
    
    const success = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
    const failed = results.filter(r => r.status === 'rejected' || !r.value?.success).length;
    
    console.log(`   成功: ${success} 个服务`);
    console.log(`   失败: ${failed} 个服务`);
    console.log('');
    
    return { success, failed, total: products.length };
  }
  
  // 启动单个增强版服务
  async startEnhancedService(product) {
    const port = product.port || (this.basePort + parseInt(product.id.split('-').pop()) || 0);
    
    try {
      const app = express();
      app.use(cors());
      app.use(express.json());
      
      // 健康检查端点
      app.get('/health', (req, res) => {
        res.json({
          status: 'healthy',
          service: product.name,
          port: port,
          product_id: product.id
        });
      });
      
      // 商品数据端点 - 返回402支付要求
      app.get(product.data_endpoint || '/api/data', (req, res) => {
        const cartId = this.generateCartId(product.id);
        const merchantAddress = this.config.merchant?.address || '0x1ef391d266f3BCdF0d9b30660FDc4032B868cDeb';
        
        // 检查是否已支付
        const sessionId = req.headers['x-session-id'];
        const txHash = req.headers['x-transaction-hash'];
        
        if (sessionId && txHash) {
          // 已支付，返回数据
          const mockData = this.generateMockData(product.id);
          return res.status(200).json({
            success: true,
            message: 'Payment verified. Here is your data.',
            product: {
              id: product.id,
              name: product.name,
              delivery_status: 'delivered'
            },
            payment: {
              verified: true,
              transaction_hash: txHash,
              session_id: sessionId
            },
            data: mockData
          });
        }
        
        // 未支付，返回402
        const price = product.price_eth || product.price_usdc || 0.001;
        const currency = product.price_eth ? 'ETH' : 'USDC';
        
        res.status(402).json({
          success: false,
          error: 'Payment required',
          message: `This API requires payment of ${price} ${currency}`,
          cart: {
            cart_id: cartId,
            product_id: product.id,
            product_name: product.name,
            product_name_zh: product.name_zh,
            amount: price,
            currency: currency,
            merchant_address: merchantAddress,
            proxy_contract: this.proxyContractAddress,
            requires_session: true
          },
          headers: {
            'X-Payment-Required': 'true',
            'X-Cart-ID': cartId,
            'X-Product-ID': product.id,
            'X-Total-Amount': `${price}`,
            'X-Currency': currency,
            'X-Merchant-Address': merchantAddress
          }
        });
      });
      
      // 创建HTTP服务器
      const server = http.createServer(app);
      
      return new Promise((resolve, reject) => {
        server.listen(port, () => {
          console.log(`✅ 服务启动成功: ${product.name_zh || product.name}`);
          console.log(`   端口: ${port}`);
          console.log(`   商品ID: ${product.id}`);
          console.log(`   健康检查: http://localhost:${port}/health`);
          console.log(`   API端点: http://localhost:${port}${product.data_endpoint || '/api/data'}`);
          console.log('');
          
          this.servers.set(port, server);
          this.apps.set(port, app);
          
          resolve({ success: true, port, product_id: product.id });
        });
        
        server.on('error', (error) => {
          if (error.code === 'EADDRINUSE') {
            console.log(`⚠️  端口 ${port} 已被占用，跳过 ${product.name}`);
            resolve({ success: false, port, product_id: product.id, error: 'Port in use' });
          } else {
            reject(error);
          }
        });
      });
      
    } catch (error) {
      console.log(`❌ 服务启动失败: ${product.name}`);
      console.log(`   错误: ${error.message}`);
      return { success: false, port, product_id: product.id, error: error.message };
    }
  }
  
  // 生成模拟数据
  generateMockData(productId) {
    const mockDataMap = {
      'ai-api-1000': {
        api_key: `sk_${crypto.randomBytes(16).toString('hex')}`,
        credits: 1000,
        endpoints: ['https://api.ai-service.com/v1/chat'],
        expiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      },
      'data-cleaning-10gb': {
        job_id: `job_${crypto.randomBytes(8).toString('hex')}`,
        data_size: '10GB',
        cleaning_status: 'completed',
        download_url: `https://storage.service.com/cleaned-data.zip`
      },
      'gpu-training-24h': {
        reservation_id: `gpu_${crypto.randomBytes(6).toString('hex')}`,
        gpu_type: 'NVIDIA A100 80GB',
        hours: 24,
        access_url: 'ssh://gpu-cluster.service.com:2222'
      },
      'analysis-report': {
        report_id: `report_${crypto.randomBytes(6).toString('hex')}`,
        format: 'PDF',
        download_url: 'https://reports.service.com/analysis.pdf'
      },
      'monitoring-7d': {
        monitoring_id: `monitor_${crypto.randomBytes(6).toString('hex')}`,
        dashboard_url: 'https://monitoring.service.com/dashboard',
        duration_days: 7
      },
      'consulting-1h': {
        booking_id: `consult_${crypto.randomBytes(6).toString('hex')}`,
        expert_name: 'Dr. Jane Smith',
        meeting_link: 'https://meet.service.com/room'
      },
      'api-documentation': {
        doc_id: `docs_${crypto.randomBytes(6).toString('hex')}`,
        openapi_url: 'https://docs.service.com/openapi.yaml',
        interactive_url: 'https://docs.service.com/swagger-ui'
      },
      'data-backup-1tb': {
        backup_id: `backup_${crypto.randomBytes(6).toString('hex')}`,
        storage_size: '1TB',
        access_url: 'https://backup.service.com/console'
      }
    };
    
    return mockDataMap[productId] || { message: 'Data delivered successfully' };
  }
  
  // 停止所有服务
  async stopAllServices() {
    console.log('🛑 停止所有API服务...');
    
    const promises = [];
    for (const [port, server] of this.servers) {
      promises.push(
        new Promise((resolve) => {
          server.close(() => {
            console.log(`   端口 ${port} 已关闭`);
            resolve(port);
          });
        })
      );
    }
    
    await Promise.all(promises);
    
    this.servers.clear();
    this.apps.clear();
    
    console.log('✅ 所有服务已停止');
    return { success: true };
  }
  
  // 获取服务状态
  getServiceStatus() {
    const status = [];
    for (const [port, server] of this.servers) {
      status.push({
        port: port,
        running: server.listening
      });
    }
    return status;
  }
}

module.exports = EnhancedApiServiceManager;
