const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const pino = require('pino');

class WhatsAppBaileysService {
    constructor() {
        this.socket = null;
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

        console.log('✅ WhatsApp Baileys Service initialized');
        console.log(`📁 Auth directory: ${this.authDir}`);
        console.log(`📁 Public directory: ${this.publicDir}`);
    }

    async initialize() {
        try {
            console.log('🚀 Initializing WhatsApp Baileys connection...');

            // Initialize auth state
            const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
            console.log('✅ Auth state initialized');

            // Create WhatsApp socket with minimal configuration for debugging
            this.socket = makeWASocket({
                auth: state,
                printQRInTerminal: true,  // Try TRUE to force QR
                logger: pino({ level: 'debug' }),  // Enable debug logs
                browser: ['LLL Bot', 'Chrome', '1.0.0']
                // Remove all other options temporarily for debugging
            });

            console.log('✅ WhatsApp socket created');

            // Set up event handlers
            this.setupEventHandlers(saveCreds);

            console.log('✅ WhatsApp Baileys service initialized successfully');
            return true;

        } catch (error) {
            console.error('❌ WhatsApp Baileys initialization failed:', error.message);
            throw error;
        }
    }

    setupEventHandlers(saveCreds) {
        // CRITICAL: QR Code handler
        this.socket.ev.on('connection.update', async (update) => {
            // DEBUG: Log the entire update object
            console.log('\n🔍 DEBUG - Full connection update:');
            console.log(JSON.stringify(update, null, 2));
            console.log('---');
            
            const { connection, lastDisconnect, qr, isNewLogin, isOnline } = update;
            
            // Log each property
            console.log('Properties:', {
                hasConnection: !!connection,
                hasQR: !!qr,
                hasLastDisconnect: !!lastDisconnect,
                isNewLogin,
                isOnline
            });

            console.log('Connection update:', { connection, isNewLogin: update.isNewLogin });

            // Handle QR code generation
            if (qr) {
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
            }

            // Handle connection states
            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log('Connection closed:', {
                    statusCode: lastDisconnect?.error?.output?.statusCode,
                    shouldReconnect,
                    error: lastDisconnect?.error?.message || 'Connection Failure'
                });

                if (shouldReconnect && this.connectionRetries < this.maxRetries) {
                    this.connectionRetries++;
                    const delay = Math.min(6000 * Math.pow(2, this.connectionRetries - 1), 60000);
                    console.log(`Reconnecting in ${delay/1000} seconds... (Attempt ${this.connectionRetries}/${this.maxRetries})`);
                    
                    setTimeout(() => {
                        this.connect();
                    }, delay);
                } else if (this.connectionRetries >= this.maxRetries) {
                    console.log('Max reconnection attempts reached. Manual intervention required.');
                }
            } else if (connection === 'open') {
                console.log('\n✅ ================================');
                console.log('   WHATSAPP CONNECTED!');
                console.log('================================\n');
                this.isConnected = true;
                this.isAuthenticated = true;
                this.currentQR = null;
                this.connectionRetries = 0;
                this.botInfo = {
                    startTime: Date.now(),
                    phoneNumber: this.getBotPhoneNumber()
                };
            } else if (connection === 'connecting') {
                console.log('Connecting to WhatsApp...');
            }
        });

        // Handle authentication
        this.socket.ev.on('creds.update', saveCreds);

        // Handle messages
        this.socket.ev.on('messages.upsert', (m) => {
            console.log('📨 Message received:', m.messages[0]?.message?.conversation || 'Media/Other');
        });
    }

    async connect() {
        try {
            console.log('🚀 Initializing WhatsApp Baileys connection...');
            
            // Load auth state
            const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
            console.log('✅ Auth state initialized');
            
            // Check if already authenticated
            const hasCredentials = fs.existsSync(path.join(this.authDir, 'creds.json'));
            if (hasCredentials) {
                console.log('📱 Found existing credentials, attempting to connect...');
            } else {
                console.log('📱 No existing credentials, will generate QR code...');
            }
            
            // Create socket
            this.socket = makeWASocket({
                auth: state,
                browser: ['WhatsApp Bot', 'Chrome', '120.0.0'],
                logger: pino({ level: 'silent' }),
                printQRInTerminal: false,
                syncFullHistory: false,
                connectTimeoutMs: 60000,
                defaultQueryTimeoutMs: 60000,
                retryRequestDelayMs: 250,
                maxMsgRetryCount: 5,
                markOnlineOnConnect: true,
                shouldSyncHistoryMessage: () => false,
                shouldIgnoreJid: () => false,
                generateHighQualityLinkPreview: false
            });
            
            console.log('✅ WhatsApp socket created');
            
            // Set up event handlers
            this.setupEventHandlers(saveCreds);
            
            console.log('✅ WhatsApp Baileys service initialized successfully');
            
        } catch (error) {
            console.error('❌ WhatsApp connection failed:', error.message);
            throw error;
        }
    }

    getBotPhoneNumber() {
        if (!this.socket || !this.socket.user) {
            return null;
        }
        return this.socket.user.id.split(':')[0];
    }

    async sendMessage(to, content) {
        try {
            if (!this.socket || !this.isConnected) {
                throw new Error('WhatsApp not connected');
            }

            console.log(`Sending message to ${to}`);
            
            // Send message
            await this.socket.sendMessage(to, content);
            console.log(`Message sent successfully to ${to}`);
            return true;
        } catch (error) {
            console.error('Failed to send message:', error.message);
            return false;
        }
    }

    async sendTextMessage(to, text) {
        return await this.sendMessage(to, { text });
    }

    async sendImage(to, imagePath, caption = '') {
        try {
            console.log(`Sending image to ${to}`);

            if (!fs.existsSync(imagePath)) {
                throw new Error(`Image file not found: ${imagePath}`);
            }

            const imageBuffer = fs.readFileSync(imagePath);

            await this.socket.sendPresenceUpdate('composing', to);

            const message = {
                image: imageBuffer,
                caption: caption
            };

            await this.socket.sendMessage(to, message);
            await this.socket.sendPresenceUpdate('paused', to);

            console.log(`Image sent successfully to ${to}`);
            return true;

        } catch (error) {
            console.error('Error sending image:', error.message);
            return false;
        }
    }

    // Event handler registration
    onMessage(handler) {
        if (this.socket) {
            this.socket.ev.on('messages.upsert', handler);
        } else {
            throw new Error('Socket not initialized. Call initialize() first.');
        }
    }

    // Utility methods
    isConnected() {
        return this.socket && this.socket.user && this.isConnected;
    }

    getBotInfo() {
        if (!this.socket || !this.socket.user) {
            return null;
        }

        return {
            phoneNumber: this.getBotPhoneNumber(),
            name: this.socket.user.name || 'WhatsApp Bot',
            id: this.socket.user.id,
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
            
            if (this.socket) {
                await this.socket.end();
            }
            
            // Clear session data
            const sessionFiles = ['creds.json', 'session.json'];
            sessionFiles.forEach(file => {
                const filePath = path.join(this.authDir, file);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            });
            
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
            if (!this.socket) {
                return { status: 'disconnected', error: 'Socket not initialized' };
            }

            if (!this.socket.user) {
                return { status: 'disconnected', error: 'Not authenticated' };
            }

            // Try to send a presence update as a health check
            await this.socket.sendPresenceUpdate('available');

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
        console.log('Cleaning up WhatsApp Baileys service...');

        if (this.socket) {
            try {
                await this.socket.sendPresenceUpdate('unavailable');
                await this.socket.end();
            } catch (error) {
                console.error('Error during socket cleanup:', error.message);
            }
            this.socket = null;
        }

        this.isConnected = false;
        this.isAuthenticated = false;
        this.qrCodeGenerated = false;
        this.botInfo = null;

        console.log('WhatsApp Baileys service cleanup completed');
    }
}

module.exports = WhatsAppBaileysService;