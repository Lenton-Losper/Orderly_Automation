const WebSocket = require('ws');
const redis = require('redis');

class WhatsAppWebSocketServer {
  constructor(options = {}) {
    const { port = 8080, redisUrl = 'redis://localhost:6379' } = options;

    this.port = port;

    this.publisher = redis.createClient({ url: redisUrl });
    this.subscriber = redis.createClient({ url: redisUrl });

    this.wss = new WebSocket.Server({ port: this.port });
    this.connections = new Map(); // vendorId -> Set of WebSocket connections

    this.init();
  }

  async init() {
    await this.publisher.connect();
    await this.subscriber.connect();
    
    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    // Subscribe to all WhatsApp channels
    await this.subscriber.pSubscribe('whatsapp:*', (message, channel) => {
      this.broadcastToVendor(channel, message);
    });

    console.log(`🔌 WebSocket server running on port ${this.port}`);
  }

  handleConnection(ws, req) {
    // Extract vendor ID from query params or headers
    const url = new URL(req.url, 'http://localhost');
    const vendorId = url.searchParams.get('vendorId');
    
    if (!vendorId) {
      ws.close(4000, 'Missing vendorId');
      return;
    }

    console.log(`🔗 New WebSocket connection for vendor: ${vendorId}`);

    // Store connection
    if (!this.connections.has(vendorId)) {
      this.connections.set(vendorId, new Set());
    }
    this.connections.get(vendorId).add(ws);

    ws.on('close', () => {
      console.log(`❌ WebSocket disconnected for vendor: ${vendorId}`);
      this.connections.get(vendorId)?.delete(ws);
      if (this.connections.get(vendorId)?.size === 0) {
        this.connections.delete(vendorId);
      }
    });

    // Send current status on connect
    this.sendCurrentStatus(vendorId, ws);
  }

  async publishUpdate(vendorId, update) {
    console.log(`📤 Publishing update for vendor ${vendorId}:`, update.type);
    await this.publisher.publish(`whatsapp:${vendorId}`, JSON.stringify(update));
  }

  broadcastToVendor(channel, message) {
    const vendorId = channel.split(':')[1];
    const connections = this.connections.get(vendorId);
    
    if (connections) {
      console.log(`📡 Broadcasting to ${connections.size} connection(s) for vendor: ${vendorId}`);
      connections.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      });
    }
  }

  async sendCurrentStatus(vendorId, ws) {
    // Send initial status message
    ws.send(JSON.stringify({
      type: 'connection_status',
      vendorId,
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