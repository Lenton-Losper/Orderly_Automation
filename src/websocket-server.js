const WebSocket = require('ws');
const redis = require('redis');
const { getServiceUrls } = require('./config/docker');

class WhatsAppWebSocketServer {
  constructor(options = {}) {
    const serviceUrls = getServiceUrls();
    const { port = serviceUrls.websocket.port, redisUrl = serviceUrls.redis.url } = options;

    this.port = port;

    this.publisher = redis.createClient({ url: redisUrl });
    this.subscriber = redis.createClient({ url: redisUrl });

    this.wss = new WebSocket.Server({ port: this.port });
    this.connections = new Map(); // vendorId -> Map(tenantId -> Set of WebSocket connections)
    this.tenantConnections = new Map(); // tenantId -> Set of WebSocket connections (for cross-vendor tenant access)

    this.init();
  }

  async init() {
    await this.publisher.connect();
    await this.subscriber.connect();
    
    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    // Subscribe to all WhatsApp channels (vendor-specific)
    await this.subscriber.pSubscribe('whatsapp:*', (message, channel) => {
      this.broadcastToVendor(channel, message);
    });

    // Subscribe to tenant-specific channels
    await this.subscriber.pSubscribe('tenant:*', (message, channel) => {
      this.broadcastToTenant(channel, message);
    });

    console.log(`🔌 WebSocket server running on port ${this.port}`);
  }

  async handleConnection(ws, req) {
    // Extract vendor ID and tenant ID from query params
    const url = new URL(req.url, 'http://localhost');
    const vendorId = url.searchParams.get('vendorId');
    const tenantId = url.searchParams.get('tenantId') || 'default';
    
    if (!vendorId) {
      ws.close(4000, 'Missing vendorId');
      return;
    }

    console.log(`🔗 New WebSocket connection for vendor: ${vendorId}, tenant: ${tenantId}`);

    // Validate tenant access if tenant validator is available
    if (this.tenantValidator) {
      try {
        const validation = await this.tenantValidator.validateWebSocketConnection(vendorId, tenantId);
        
        if (!validation.isValid) {
          console.log(`❌ Tenant validation failed for ${vendorId}:${tenantId}: ${validation.error}`);
          ws.close(4001, `Tenant validation failed: ${validation.error}`);
          return;
        }

        console.log(`✅ Tenant validation successful for ${vendorId}:${tenantId}`);
        
        // Store tenant data in WebSocket object
        ws.tenantData = validation.tenantData;
      } catch (error) {
        console.error(`❌ Tenant validation error for ${vendorId}:${tenantId}:`, error.message);
        ws.close(4002, 'Tenant validation error');
        return;
      }
    } else {
      console.log(`⚠️ No tenant validator available, skipping validation for ${vendorId}:${tenantId}`);
    }

    // Store connection with tenant context
    if (!this.connections.has(vendorId)) {
      this.connections.set(vendorId, new Map());
    }
    if (!this.connections.get(vendorId).has(tenantId)) {
      this.connections.get(vendorId).set(tenantId, new Set());
    }
    this.connections.get(vendorId).get(tenantId).add(ws);

    // Also store in tenant connections for cross-vendor access
    if (!this.tenantConnections.has(tenantId)) {
      this.tenantConnections.set(tenantId, new Set());
    }
    this.tenantConnections.get(tenantId).add(ws);

    // Store tenant context in WebSocket object
    ws.tenantId = tenantId;
    ws.vendorId = vendorId;

    ws.on('close', () => {
      console.log(`❌ WebSocket disconnected for vendor: ${vendorId}, tenant: ${tenantId}`);
      
      // Remove from vendor-tenant connections
      this.connections.get(vendorId)?.get(tenantId)?.delete(ws);
      if (this.connections.get(vendorId)?.get(tenantId)?.size === 0) {
        this.connections.get(vendorId)?.delete(tenantId);
        if (this.connections.get(vendorId)?.size === 0) {
          this.connections.delete(vendorId);
        }
      }

      // Remove from tenant connections
      this.tenantConnections.get(tenantId)?.delete(ws);
      if (this.tenantConnections.get(tenantId)?.size === 0) {
        this.tenantConnections.delete(tenantId);
      }
    });

    // Send current status on connect with tenant context
    this.sendCurrentStatus(vendorId, tenantId, ws);
  }

  async publishUpdate(vendorId, tenantId, update) {
    console.log(`📤 Publishing update for vendor ${vendorId}, tenant ${tenantId}:`, update.type);
    
    // Add tenant context to update
    const updateWithTenant = {
      ...update,
      tenantId,
      vendorId
    };
    
    // Publish to vendor-specific channel
    await this.publisher.publish(`whatsapp:${vendorId}`, JSON.stringify(updateWithTenant));
    
    // Also publish to tenant-specific channel for cross-vendor access
    await this.publisher.publish(`tenant:${tenantId}`, JSON.stringify(updateWithTenant));
  }

  broadcastToVendor(channel, message) {
    const vendorId = channel.split(':')[1];
    const vendorConnections = this.connections.get(vendorId);
    
    if (vendorConnections) {
      let totalConnections = 0;
      vendorConnections.forEach((tenantConnections, tenantId) => {
        console.log(`📡 Broadcasting to ${tenantConnections.size} connection(s) for vendor: ${vendorId}, tenant: ${tenantId}`);
        tenantConnections.forEach(ws => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(message);
            totalConnections++;
          }
        });
      });
      console.log(`📡 Total connections for vendor ${vendorId}: ${totalConnections}`);
    }
  }

  broadcastToTenant(channel, message) {
    const tenantId = channel.split(':')[1];
    const tenantConnections = this.tenantConnections.get(tenantId);
    
    if (tenantConnections) {
      console.log(`📡 Broadcasting to ${tenantConnections.size} connection(s) for tenant: ${tenantId}`);
      tenantConnections.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      });
    }
  }

  async sendCurrentStatus(vendorId, tenantId, ws) {
    // Send initial status message with tenant context
    ws.send(JSON.stringify({
      type: 'connection_status',
      vendorId,
      tenantId,
      status: 'connecting',
      timestamp: new Date().toISOString()
    }));
  }

  async shutdown() {
    try {
      console.log('🛑 Shutting down WebSocket server...');
      if (this.wss) {
        this.wss.clients.forEach(client => {
          try { client.terminate(); } catch (_) {}
        });
        await new Promise(resolve => {
          try { this.wss.close(() => resolve()); } catch (_) { resolve(); }
        });
      }
      if (this.subscriber) {
        try { await this.subscriber.quit(); } catch (_) {}
      }
      if (this.publisher) {
        try { await this.publisher.quit(); } catch (_) {}
      }
      console.log('✅ WebSocket server stopped');
    } catch (error) {
      console.error('❌ Error shutting down WebSocket server:', error.message);
    }
  }
}

module.exports = WhatsAppWebSocketServer;