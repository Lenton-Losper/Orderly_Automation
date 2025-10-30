const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

class WhatsAppWebService {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.isAuthenticated = false;
        this.qrCodeGenerated = false;
        this.botInfo = null;
        this.connectionRetries = 0;
        this.maxRetries = 5;
        this.currentQR = null;

        // Auth directory for session storage
        this.authDir = path.join(process.cwd(), 'auth');
        if (!fs.existsSync(this.authDir)) {
            fs.mkdirSync(this.authDir, { recursive: true });
        }

        // Public directory for QR code storage
        this.publicDir = path.join(process.cwd(), 'public');
        if (!fs.existsSync(this.publicDir)) {
            fs.mkdirSync(this.publicDir, { recursive: true });
        }

        console.log('✅ WhatsApp Web Service initialized');
        console.log(`📁 Auth directory: ${this.authDir}`);
        console.log(`📁 Public directory: ${this.publicDir}`);
    }

    async initialize() {
        try {
            console.log('🚀 Initializing WhatsApp Web connection...');

            // Create WhatsApp client with whatsapp-web.js
            this.client = new Client({
                authStrategy: new LocalAuth({
                    clientId: 'lll-farming-bot',
                    dataPath: this.authDir
                }),
                puppeteer: {
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--no-first-run',
                        '--no-zygote',
                        '--disable-gpu',
                        '--disable-web-security',
                        '--disable-features=VizDisplayCompositor'
                    ]
                },
                webVersionCache: {
                    type: 'local',
                    path: './.wwebjs_cache/version'
                }
            });

            console.log('✅ WhatsApp client created');

            // Set up event handlers
            this.setupEventHandlers();

            // Initialize the client
            await this.client.initialize();

            console.log('✅ WhatsApp Web service initialized successfully');
            return true;

        } catch (error) {
            console.error('❌ WhatsApp Web initialization failed:', error.message);
            throw error;
        }
    }

    setupEventHandlers() {
        // QR Code handler
        this.client.on('qr', async (qr) => {
            console.log('\n\n📱 ================================');
            console.log('      QR CODE GENERATED!');
            console.log('================================\n');
            
            // Display QR in terminal
            qrcodeTerminal.generate(qr, { small: true });
            
            console.log('\n📱 Scan this QR code with WhatsApp:');
            console.log('   1. Open WhatsApp on your phone');
            console.log('   2. Go to Settings → Linked Devices');
            console.log('   3. Tap "Link a Device"');
            console.log('   4. Scan the QR code above\n');
            
            // Save QR to file for frontend access
            try {
                const qrPath = path.join(this.publicDir, 'qr.png');
                await QRCode.toFile(qrPath, qr, {
                    width: 300,
                    margin: 2,
                    color: {
                        dark: '#000000',
                        light: '#FFFFFF'
                    }
                });
                console.log(`✅ QR code saved to: ${qrPath}`);
                console.log(`🔗 Frontend URL: http://localhost:3000/api/whatsapp/qr\n`);
            } catch (fileError) {
                console.error('❌ Failed to save QR code:', fileError.message);
            }
            
            // Store QR for API access
            this.currentQR = qr;
            this.qrCodeGenerated = true;
        });

        // Authentication success
        this.client.on('authenticated', () => {
            console.log('\n✅ ================================');
            console.log('   WHATSAPP AUTHENTICATED!');
            console.log('================================\n');
            this.isAuthenticated = true;
            this.currentQR = null;
        });

        // Client ready
        this.client.on('ready', () => {
            console.log('\n✅ ================================');
            console.log('   WHATSAPP CLIENT READY!');
            console.log('================================\n');
            this.isConnected = true;
            this.botInfo = {
                startTime: Date.now(),
                phoneNumber: this.getBotPhoneNumber(),
                name: this.client.info?.pushname || 'WhatsApp Bot'
            };
            console.log(`📱 Connected as: ${this.botInfo.name}`);
            console.log(`📞 Phone: ${this.botInfo.phoneNumber}`);
        });

        // Authentication failure
        this.client.on('auth_failure', (msg) => {
            console.error('❌ WhatsApp authentication failed:', msg);
            console.log('🔄 Clearing session data and restarting...');
            
            // Clear corrupted session
            const sessionPath = path.join(this.authDir, '.wwebjs_auth');
            if (fs.existsSync(sessionPath)) {
                fs.rmSync(sessionPath, { recursive: true, force: true });
                console.log('✅ Session data cleared. Please restart the bot.');
            }
        });

        // Disconnected
        this.client.on('disconnected', (reason) => {
            console.log('⚠️ WhatsApp client disconnected:', reason);
            this.isConnected = false;
            this.isAuthenticated = false;
            
            if (reason === 'LOGOUT') {
                console.log('🔄 Logged out. Will need to scan QR code again.');
            } else {
                console.log('🔄 Attempting to reconnect...');
                setTimeout(() => {
                    this.connect();
                }, 5000);
            }
        });

        // Messages
        this.client.on('message', (message) => {
            console.log('📨 Message received:', message.body?.substring(0, 50) || 'Media/Other');
            
            // Format message for the message handler
            const formattedMessage = {
                messages: [{
                    message: {
                        conversation: message.body,
                        extendedTextMessage: message.body ? { text: message.body } : undefined
                    },
                    key: {
                        remoteJid: message.from,
                        fromMe: message.fromMe,
                        id: message.id
                    },
                    messageTimestamp: message.timestamp,
                    pushName: message._data?.notifyName || 'Unknown'
                }],
                type: 'chat' // WhatsApp Web sends 'chat' type messages
            };
            
            // Emit the formatted message to the message handler
            if (this.messageHandler) {
                this.messageHandler(formattedMessage);
            }
        });
    }

    async connect() {
        try {
            console.log('🚀 Connecting to WhatsApp...');
            
            if (!this.client) {
                await this.initialize();
            } else {
                await this.client.initialize();
            }
            
        } catch (error) {
            console.error('❌ WhatsApp connection failed:', error.message);
            throw error;
        }
    }

    getBotPhoneNumber() {
        if (!this.client || !this.client.info) {
            return null;
        }
        return this.client.info.wid?.user || null;
    }

    async sendMessage(to, content) {
        try {
            if (!this.client || !this.isConnected) {
                throw new Error('WhatsApp not connected');
            }

            console.log(`Sending message to ${to}`);
            
            // Send message
            await this.client.sendMessage(to, content);
            console.log(`Message sent successfully to ${to}`);
            return true;
        } catch (error) {
            console.error('Failed to send message:', error.message);
            return false;
        }
    }

    async sendTextMessage(to, text) {
        return await this.sendMessage(to, text);
    }

    async sendImage(to, imagePath, caption = '') {
        try {
            console.log(`Sending image to ${to}`);

            if (!fs.existsSync(imagePath)) {
                throw new Error(`Image file not found: ${imagePath}`);
            }

            const media = MessageMedia.fromFilePath(imagePath);
            await this.client.sendMessage(to, media, { caption });

            console.log(`Image sent successfully to ${to}`);
            return true;

        } catch (error) {
            console.error('Error sending image:', error.message);
            return false;
        }
    }

    async sendDocument(to, filePath, filename, caption = '') {
        try {
            console.log(`Sending document to ${to}: ${filename}`);

            if (!fs.existsSync(filePath)) {
                throw new Error(`Document file not found: ${filePath}`);
            }

            const media = MessageMedia.fromFilePath(filePath);
            await this.client.sendMessage(to, media, { caption });

            console.log(`Document sent successfully to ${to}`);
            return true;

        } catch (error) {
            console.error('Error sending document:', error.message);
            return false;
        }
    }

    // Event handler registration
    onMessage(handler) {
        if (this.client) {
            // Store the handler for use in the message event
            this.messageHandler = handler;
        } else {
            throw new Error('Client not initialized. Call initialize() first.');
        }
    }

    // Utility methods
    isConnected() {
        return this.client && this.isConnected;
    }

    getBotInfo() {
        if (!this.client || !this.client.info) {
            return null;
        }

        return {
            phoneNumber: this.getBotPhoneNumber(),
            name: this.client.info.pushname || 'WhatsApp Bot',
            id: this.client.info.wid,
            startTime: this.botInfo?.startTime || Date.now(),
            connected: this.isConnected,
            authenticated: this.isAuthenticated
        };
    }

    getConnectionStatus() {
        return {
            connected: this.isConnected,
            authenticated: this.isAuthenticated,
            qrCodeGenerated: this.qrCodeGenerated,
            retries: this.connectionRetries,
            maxRetries: this.maxRetries,
            botInfo: this.getBotInfo()
        };
    }

    async forceReconnect() {
        try {
            console.log('🔄 Forcing WhatsApp reconnection...');
            
            if (this.client) {
                await this.client.destroy();
            }
            
            // Clear session data
            const sessionPath = path.join(this.authDir, '.wwebjs_auth');
            if (fs.existsSync(sessionPath)) {
                fs.rmSync(sessionPath, { recursive: true, force: true });
            }
            
            this.connectionRetries = 0;
            this.isConnected = false;
            this.isAuthenticated = false;
            this.qrCodeGenerated = false;
            
            // Reconnect
            await this.connect();
            
            return true;
        } catch (error) {
            console.error('❌ Force reconnect failed:', error.message);
            return false;
        }
    }

    async healthCheck() {
        try {
            if (!this.client) {
                return { status: 'disconnected', error: 'Client not initialized' };
            }

            if (!this.isConnected) {
                return { status: 'disconnected', error: 'Not connected' };
            }

            return {
                status: 'connected',
                botInfo: this.getBotInfo(),
                connected: this.isConnected,
                authenticated: this.isAuthenticated
            };

        } catch (error) {
            return {
                status: 'error',
                error: error.message
            };
        }
    }

    // Cleanup method
    async cleanup() {
        console.log('Cleaning up WhatsApp Web service...');

        if (this.client) {
            try {
                await this.client.destroy();
            } catch (error) {
                console.error('Error during client cleanup:', error.message);
            }
            this.client = null;
        }

        this.isConnected = false;
        this.isAuthenticated = false;
        this.qrCodeGenerated = false;
        this.botInfo = null;

        console.log('WhatsApp Web service cleanup completed');
    }
}

module.exports = WhatsAppWebService;
