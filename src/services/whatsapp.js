// File: src/services/whatsapp.js
// Enhanced WhatsApp Service with Dynamic Vendor Mapping Integration
// Handles WhatsApp connection, message sending, and bot-to-vendor mapping
// Integrates with dynamic Firebase vendor discovery system

// Import Baileys functions directly (not as default)
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const redis = require('redis');
const { Boom } = require('@hapi/boom');
const { getSocketConfig, getHealthCheckQuery } = require('../config/socket');
const { CONNECTION_CONFIG, CACHE_CONFIG, WHATSAPP_CONFIG } = require('../config/constants');

class WhatsAppService {
    constructor() {
        this.socket = null;
        this.connectionRetries = 0;
        this.maxRetries = CONNECTION_CONFIG.MAX_RETRIES;
        this.reconnectTimeout = null;
        this.connectionCheckInterval = null;
        this.botStartTime = null;
        this.eventHandlers = new Map();
        this.botInfo = null; // Store bot information for dynamic mapping
        this.vendorMappingAttempted = false; // Track if we've tried mapping this session
        this.redisPublisher = null;
        this.redisConnected = false;
        
        // Resolve tenant-specific auth directory once
        const path = require('path');
        const authFolder = WHATSAPP_CONFIG && WHATSAPP_CONFIG.AUTH_FOLDER ? WHATSAPP_CONFIG.AUTH_FOLDER : 'auth';
        this.authDir = path.isAbsolute(authFolder) ? authFolder : path.join(process.cwd(), authFolder);
        
        // Validate imports are available
        if (!makeWASocket || typeof makeWASocket !== 'function') {
            throw new Error('makeWASocket function not available from Baileys');
        }
        if (!useMultiFileAuthState || typeof useMultiFileAuthState !== 'function') {
            throw new Error('useMultiFileAuthState function not available from Baileys');
        }
        if (!DisconnectReason || typeof DisconnectReason !== 'object') {
            throw new Error('DisconnectReason object not available from Baileys');
        }
        
        console.log('All Baileys imports validated successfully');
    }

    async initialize() {
        try {
            console.log('Initializing WhatsApp connection with dynamic vendor mapping...');
            
            // Initialize Redis publisher for WebSocket event fan-out
            try {
                const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
                this.redisPublisher = redis.createClient({ url: redisUrl });
                await this.redisPublisher.connect();
                this.redisConnected = true;
                // Emit initial connecting status
                await this.publishConnectionStatus('connecting');
            } catch (redisError) {
                console.error('Failed to initialize Redis publisher:', redisError.message);
            }

            // Initialize auth state with better error handling
            let state, saveCreds;
            try {
                // Ensure auth directory exists
                const fs = require('fs');
                if (!fs.existsSync(this.authDir)) {
                    fs.mkdirSync(this.authDir, { recursive: true });
                    console.log(`Created auth directory: ${this.authDir}`);
                }
                
                const authResult = await useMultiFileAuthState(this.authDir);
                state = authResult.state;
                saveCreds = authResult.saveCreds;
                
                console.log('Auth state initialized successfully');
            } catch (authError) {
                console.error('Auth state error:', authError.message);
                console.log('Clearing corrupted auth and retrying...');
                
                // Try to clear and recreate auth
                await this.clearCorruptedAuth();
                
                // Retry auth state creation
                const authResult = await useMultiFileAuthState(this.authDir);
                state = authResult.state;
                saveCreds = authResult.saveCreds;
                
                console.log('Auth state recreated successfully');
            }

            // Create socket with minimal configuration first
            console.log('Testing minimal socket configuration...');
            
            try {
                // Try minimal config first (removed deprecated printQRInTerminal)
                const minimalConfig = {
                    auth: state,
                    browser: ['LLL Farm Bot', 'Chrome', '120.0.0'],
                    syncFullHistory: false
                };
                
                console.log('Creating WhatsApp socket with minimal config...');
                this.socket = makeWASocket(minimalConfig);
                console.log('Minimal socket created successfully');
                
            } catch (minimalError) {
                console.error('Minimal socket failed, trying with full config...');
                console.error('Minimal error:', minimalError.message);
                
                // Fall back to full config
                const socketConfig = {
                    auth: state,
                    ...getSocketConfig()
                };
                
                console.log('Creating WhatsApp socket with full config...');
                console.log('Full config keys:', Object.keys(socketConfig));
                
                this.socket = makeWASocket(socketConfig);
            }
            
            if (!this.socket) {
                throw new Error('makeWASocket returned null/undefined');
            }
            
            console.log('WhatsApp socket created successfully');
            console.log('Socket properties:', Object.keys(this.socket));
            this.botStartTime = Date.now();

            // Setup event handlers
            this.setupEventHandlers(saveCreds);

            console.log(`WhatsApp service initialized at: ${new Date(this.botStartTime).toLocaleString()}`);
            
            return this.socket;
        } catch (error) {
            console.error('Failed to initialize WhatsApp service:', error.message);
            throw error;
        }
    }

    setupEventHandlers(saveCreds) {
        // Credentials update handler
        this.socket.ev.on('creds.update', saveCreds);
        
        // Low-level debug: log all upsert events for diagnostics
        this.socket.ev.on('messages.upsert', ({ messages, type }) => {
            try {
                const first = messages && messages[0];
                const keys = first && first.message ? Object.keys(first.message) : [];
                const from = first && first.key ? first.key.remoteJid : 'unknown';
                console.log(`WA DEBUG - upsert: type=${type}, from=${from}, keys=${JSON.stringify(keys)}`);
            } catch (_) {}
        });
        
        // Reattach any registered external upsert handler on a fresh socket
        const externalUpsertHandler = this.eventHandlers && this.eventHandlers.get('messages.upsert.external');
        if (externalUpsertHandler) {
            this.socket.ev.on('messages.upsert', externalUpsertHandler);
        }
        
        // Connection update handler with enhanced bot info extraction
        this.socket.ev.on('connection.update', async ({ connection, lastDisconnect, qr, isNewLogin }) => {
            console.log('Connection update:', { connection, isNewLogin });
            
            if (connection === 'close') {
                await this.handleConnectionClose(lastDisconnect);
                await this.publishConnectionStatus('disconnected', lastDisconnect?.error?.message);
            } else if (connection === 'open') {
                await this.handleConnectionOpen();
                await this.publishConnectionStatus('connected');
            } else if (connection === 'connecting') {
                console.log('Connecting to WhatsApp...');
                await this.publishConnectionStatus('connecting');
            }
            
            // ENHANCED: Display QR code with dynamic mapping info
            if (qr) {
                console.log('\nQR CODE TO SCAN:');
                console.log('='.repeat(50));
                console.log(qr);
                console.log('='.repeat(50));
                console.log('OPTION 1: Copy the text above and paste into WhatsApp Web');
                console.log('OPTION 2: Visit this URL to see QR code:');
                console.log(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`);
                console.log('OPTION 3: Open WhatsApp > Settings > Linked Devices > Link a Device');
                console.log('='.repeat(50));
                console.log('Once connected, bot will auto-discover vendor mapping...');
                console.log('='.repeat(50) + '\n');

                // Publish QR code over Redis for WebSocket broadcasting
                await this.publishQrCode(qr);
            }
        });

        // Call handler
        this.socket.ev.on('CB:call', (node) => {
            console.log('Incoming call detected, rejecting...');
            this.socket.rejectCall(node.content[0].attrs['call-id'], node.attrs.from);
        });

        // Credentials handler
        this.socket.ev.on('creds.update', ({ creds }) => {
            if (creds) {
                console.log('Credentials updated');
            }
        });
    }

    // Publish connection status via Redis -> WebSocket
    async publishConnectionStatus(status, reason) {
        try {
            if (!this.redisConnected || !this.redisPublisher) return;
            const vendorId = process.env.TENANT_ID || this.botInfo?.mappedBusinessId || 'default';
            const tenantId = process.env.TENANT_ID || 'default';
            const payload = {
                type: 'connection_status',
                vendorId,
                tenantId, // Include tenantId in connection status
                status, // connecting|connected|disconnected|failed
                reason,
                timestamp: new Date().toISOString()
            };
            
            // Publish to both vendor-specific and tenant-specific channels
            await this.redisPublisher.publish(`whatsapp:${vendorId}`, JSON.stringify(payload));
            await this.redisPublisher.publish(`tenant:${tenantId}`, JSON.stringify(payload));
            
            console.log(`📡 Connection status published: ${status} for vendor: ${vendorId}, tenant: ${tenantId}`);
        } catch (err) {
            console.error('❌ Error publishing connection status:', err.message);
            // Best-effort, do not crash
        }
    }

    // Publish QR code via Redis -> WebSocket with tenant context
    async publishQrCode(qr) {
        try {
            if (!this.redisConnected || !this.redisPublisher || !qr) return;
            const vendorId = process.env.TENANT_ID || this.botInfo?.mappedBusinessId || 'default';
            const tenantId = process.env.TENANT_ID || 'default';
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`;
            const payload = {
                type: 'qr_code',
                vendorId,
                tenantId, // Include tenantId in QR code payload
                qrCode: qr,
                qrUrl,
                timestamp: new Date().toISOString()
            };
            
            // Publish to both vendor-specific and tenant-specific channels
            await this.redisPublisher.publish(`whatsapp:${vendorId}`, JSON.stringify(payload));
            await this.redisPublisher.publish(`tenant:${tenantId}`, JSON.stringify(payload));
            
            console.log(`📱 QR code published for vendor: ${vendorId}, tenant: ${tenantId}`);
        } catch (err) {
            console.error('❌ Error publishing QR code:', err.message);
            // Best-effort, do not crash
        }
    }

    async handleConnectionClose(lastDisconnect) {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        
        console.log('Connection closed:', {
            statusCode,
            shouldReconnect,
            error: lastDisconnect?.error?.message
        });
        
        // Clear health check
        if (this.connectionCheckInterval) {
            clearInterval(this.connectionCheckInterval);
            this.connectionCheckInterval = null;
        }
        
        // Reset vendor mapping flag for next connection
        this.vendorMappingAttempted = false;
        this.botInfo = null;
        
        if (shouldReconnect) {
            this.connectionRetries++;
            
            if (this.connectionRetries < this.maxRetries) {
                // Provide sane fallbacks if constants are missing
                const RECONNECT_BASE_DELAY = CONNECTION_CONFIG.RECONNECT_BASE_DELAY || CONNECTION_CONFIG.RETRY_DELAY || 3000;
                const MAX_RECONNECT_DELAY = CONNECTION_CONFIG.MAX_RECONNECT_DELAY || 60000;
                
                const baseDelay = Math.min(
                    RECONNECT_BASE_DELAY * Math.pow(2, this.connectionRetries), 
                    MAX_RECONNECT_DELAY
                );
                const jitter = Math.random() * 2000;
                const delay = baseDelay + jitter;
                
                console.log(`Reconnecting in ${Math.round(delay/1000)} seconds... (Attempt ${this.connectionRetries}/${this.maxRetries})`);
                
                clearTimeout(this.reconnectTimeout);
                this.reconnectTimeout = setTimeout(() => {
                    this.initialize();
                }, delay);
            } else {
                console.error('Max reconnection attempts reached. Waiting 5 minutes before retry...');
                
                const FATAL_ERROR_RETRY_DELAY = CONNECTION_CONFIG.FATAL_ERROR_RETRY_DELAY || 300000; // 5 minutes
                setTimeout(() => {
                    this.connectionRetries = 0;
                    this.initialize();
                }, FATAL_ERROR_RETRY_DELAY);
            }
        } else {
            console.log('Bot logged out. Manual intervention required.');
            await this.publishConnectionStatus('failed', lastDisconnect?.error?.message || 'logged out');
        }
    }

    // ENHANCED: Connection open handler with dynamic vendor mapping
    async handleConnectionOpen() {
        console.log('Bot connected to WhatsApp successfully!');
        this.connectionRetries = 0;
        
        try {
            await this.socket.sendPresenceUpdate('available');
            console.log('Presence set to available');
        } catch (err) {
            console.log('Could not set presence:', err.message);
        }

        // Ensure pre-keys are uploaded to minimize decryption errors
        try {
            if (typeof this.socket.uploadPreKeysToServerIfRequired === 'function') {
                await this.socket.uploadPreKeysToServerIfRequired();
                console.log('Pre-keys uploaded (if required)');
            }
        } catch (preKeyErr) {
            console.log('Pre-key upload skipped/failed:', preKeyErr.message);
        }
 
        // Extract and store bot information
        this.extractBotInfo();

        // Attempt dynamic vendor mapping
        await this.attemptVendorMapping();

        // Start connection health check
        this.startHealthCheck();
    }

    // NEW: Extract bot information for vendor mapping
    extractBotInfo() {
        if (this.socket && this.socket.user) {
            this.botInfo = {
                phoneNumber: this.getBotPhoneNumber(),
                fullId: this.socket.user.id,
                name: this.socket.user.name || 'LLL Farm Bot',
                startTime: this.botStartTime,
                uptime: this.botStartTime ? Date.now() - this.botStartTime : 0
            };
            
            console.log('Bot Information Extracted:');
            console.log(`   Phone Number: ${this.botInfo.phoneNumber}`);
            console.log(`   Full ID: ${this.botInfo.fullId}`);
            console.log(`   Name: ${this.botInfo.name}`);
            console.log(`   Connected At: ${new Date(this.botInfo.startTime).toLocaleString()}`);
        }
    }

    // NEW: Attempt dynamic vendor mapping when bot connects
    async attemptVendorMapping() {
        if (this.vendorMappingAttempted || !this.botInfo) {
            return;
        }

        try {
            console.log('VENDOR MAPPING - Attempting dynamic vendor discovery...');
            this.vendorMappingAttempted = true;

            // Import business manager for dynamic mapping
            const businessManager = require('./businessManager');
            
            if (!businessManager.isHealthy()) {
                console.log('Business Manager not ready, will retry mapping on first message');
                this.vendorMappingAttempted = false;
                return;
            }

            // Attempt to get business ID using dynamic discovery
            const businessId = await businessManager.getBusinessIdFromBot(this.botInfo.fullId);
            
            if (businessId && businessId !== 'default') {
                console.log(`VENDOR MAPPING SUCCESS - Bot mapped to business: ${businessId}`);
                
                // Get vendor profile to show mapping details
                const businessData = await businessManager.getBusinessData(businessId);
                console.log(`Vendor Details:`);
                console.log(`   Business Name: ${businessData.businessName}`);
                console.log(`   Email: ${businessData.businessEmail}`);
                console.log(`   Phone: ${businessData.businessPhone}`);
                
                // Store successful mapping info
                this.botInfo.mappedBusinessId = businessId;
                this.botInfo.businessName = businessData.businessName;
                
            } else {
                console.log('VENDOR MAPPING - Using default business (mapping may have failed)');
                console.log('Check if vendor profile exists with bot phone number');
                
                // Show troubleshooting info
                await this.showVendorMappingTroubleshooting(businessManager);
            }
            
        } catch (error) {
            console.error('Error in vendor mapping attempt:', error);
            this.vendorMappingAttempted = false; // Allow retry
        }
    }

    // NEW: Show troubleshooting information for vendor mapping
    async showVendorMappingTroubleshooting(businessManager) {
        try {
            console.log('\nVENDOR MAPPING TROUBLESHOOTING:');
            console.log('='.repeat(50));
            
            // Show bot info
            console.log(`Bot Phone Number: ${this.botInfo.phoneNumber}`);
            console.log(`Bot Full ID: ${this.botInfo.fullId}`);
            
            // Show business manager stats
            const stats = businessManager.getBusinessStats();
            console.log(`Current Mappings:`);
            console.log(`   Bot Mappings: ${stats.botMappings}`);
            console.log(`   Customer Mappings: ${stats.totalBusinesses}`);
            console.log(`   Firebase Cache: ${stats.firebaseVendorCache.vendorsInCache} vendors`);
            
            // Show available vendors (first 5)
            console.log('\nDiscovering available vendors...');
            const vendors = await businessManager.debugAvailableVendors();
            
            if (vendors.length > 0) {
                console.log('Available Vendors (showing first 5):');
                vendors.slice(0, 5).forEach((vendor, index) => {
                    console.log(`   ${index + 1}. ${vendor.id}`);
                    console.log(`      Name: ${vendor.name}`);
                    console.log(`      Phone: ${vendor.phone}`);
                    console.log(`      Has Profile: ${vendor.hasProfile}`);
                });
                
                if (vendors.length > 5) {
                    console.log(`   ... and ${vendors.length - 5} more vendors`);
                }
            }
            
            console.log('\nSOLUTIONS:');
            console.log('1. Ensure vendor profile exists with phone:', this.botInfo.phoneNumber);
            console.log('2. Check Firebase permissions for reading vendor profiles');
            console.log('3. Use forceAutoMapping() method to retry mapping');
            console.log('4. Create manual mapping if needed');
            console.log('='.repeat(50) + '\n');
            
        } catch (error) {
            console.error('Error showing troubleshooting info:', error);
        }
    }

    startHealthCheck() {
        const intervalMs = CONNECTION_CONFIG.HEALTH_CHECK_INTERVAL || CONNECTION_CONFIG.PING_INTERVAL || 30000;
        this.connectionCheckInterval = setInterval(async () => {
            try {
                const query = getHealthCheckQuery(this.socket);
                await this.socket.query(query);
            } catch (err) {
                console.log('Connection ping failed:', err.message);
            }
        }, intervalMs);
    }

    async clearCorruptedAuth() {
        try {
            const fs = require('fs');
            const authDir = this.authDir;
            
            if (fs.existsSync(authDir)) {
                console.log('Clearing corrupted auth state...');
                
                // Remove all files in auth directory
                const files = fs.readdirSync(authDir);
                for (const file of files) {
                    const path = require('path');
                    const filePath = path.join(authDir, file);
                    try {
                        if (fs.statSync(filePath).isDirectory()) {
                            fs.rmSync(filePath, { recursive: true, force: true });
                        } else {
                            fs.unlinkSync(filePath);
                        }
                    } catch (fileError) {
                        console.warn(`Could not delete ${filePath}:`, fileError.message);
                    }
                }
                
                console.log('Auth directory cleared');
            } else {
                console.log('Auth directory does not exist, creating...');
                fs.mkdirSync(authDir, { recursive: true });
            }
        } catch (error) {
            console.error('Error clearing auth directory:', error.message);
            // Don't throw error, just log it
        }
    }

    // ENHANCED: Message sending methods with PDF support and better logging
    async sendMessage(to, content) {
        try {
            if (!this.socket) {
                throw new Error('WhatsApp socket not initialized');
            }
            
            console.log(`Sending message to ${to} (Bot: ${this.botInfo?.businessName || 'Unknown Business'})`);
            
            // Add typing indicator for better UX
            await this.socket.sendPresenceUpdate('composing', to);
            await new Promise(resolve => setTimeout(resolve, 1000));
            await this.socket.sendPresenceUpdate('paused', to);
            
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

    // ENHANCED: Send PDF document method with business context
    async sendDocument(userId, filepath, filename, caption = '') {
        try {
            console.log(`Sending PDF document to ${userId}: ${filename}`);
            console.log(`Business Context: ${this.botInfo?.businessName || 'Unknown'}`);
            
            const fs = require('fs');
            
            // Check if file exists
            if (!fs.existsSync(filepath)) {
                throw new Error(`File not found: ${filepath}`);
            }

            // Check socket availability
            if (!this.socket) {
                throw new Error('WhatsApp socket not initialized');
            }

            // Read file as buffer
            const fileBuffer = fs.readFileSync(filepath);
            
            // Add uploading indicator
            await this.socket.sendPresenceUpdate('composing', userId);
            
            // Send document message
            const message = {
                document: fileBuffer,
                fileName: filename,
                mimetype: 'application/pdf',
                caption
            };
            
            await this.socket.sendMessage(userId, message);
            console.log(`PDF sent successfully to ${userId}`);
            return true;
        } catch (error) {
            console.error('Failed to send PDF document:', error.message);
            return false;
        }
    }

    // ENHANCED: Send image method with business branding
    async sendImage(userId, imagePath, caption = '') {
        try {
            console.log(`Sending image to ${userId}`);
            console.log(`Business Context: ${this.botInfo?.businessName || 'Unknown'}`);
            
            const fs = require('fs');
            
            if (!fs.existsSync(imagePath)) {
                throw new Error(`Image file not found: ${imagePath}`);
            }

            if (!this.socket) {
                throw new Error('WhatsApp socket not initialized');
            }

            const imageBuffer = fs.readFileSync(imagePath);
            
            await this.socket.sendPresenceUpdate('composing', userId);
            
            const enhancedCaption = caption ? 
                `${caption}\n\nFrom: ${this.botInfo?.businessName || 'LLL Farm'}` : 
                `From: ${this.botInfo?.businessName || 'LLL Farm'}`;
            
            const message = {
                image: imageBuffer,
                caption: enhancedCaption
            };

            await this.socket.sendMessage(userId, message);
            await this.socket.sendPresenceUpdate('paused', userId);
            
            console.log(`Image sent successfully to ${userId}`);
            return true;
            
        } catch (error) {
            console.error('Error sending image:', error.message);
            return false;
        }
    }

    // ENHANCED: Send order confirmation with PDF invoice and business info
    async sendOrderConfirmationWithPDF(userId, textMessage, pdfPath, pdfFilename) {
        try {
            console.log(`Sending order confirmation with PDF to ${userId}`);
            console.log(`Business: ${this.botInfo?.businessName || 'Unknown'}`);
            
            // Enhance text message with business info
            const enhancedMessage = `${textMessage}\n\n${this.botInfo?.businessName || 'LLL Farm'}`;
            
            // Send text confirmation first
            const textSent = await this.sendTextMessage(userId, enhancedMessage);
            if (!textSent) {
                throw new Error('Failed to send text confirmation');
            }
            
            // Wait a moment then send PDF
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const pdfSent = await this.sendDocument(
                userId, 
                pdfPath, 
                pdfFilename, 
                `Your invoice from ${this.botInfo?.businessName || 'LLL Farm'}`
            );
            
            if (!pdfSent) {
                // Fallback - send error message
                await this.sendTextMessage(userId, 
                    `Sorry, there was an issue generating your invoice PDF. Please contact ${this.botInfo?.businessName || 'us'} for a copy.`);
                return false;
            }
            
            console.log(`Order confirmation with PDF sent successfully to ${userId}`);
            return true;
            
        } catch (error) {
            console.error('Error sending order confirmation with PDF:', error.message);
            
            // Try to send at least an error message
            try {
                await this.sendTextMessage(userId, 
                    `There was an issue processing your order confirmation. Please contact ${this.botInfo?.businessName || 'support'}.`);
            } catch (fallbackError) {
                console.error('Failed to send fallback error message:', fallbackError.message);
            }
            
            return false;
        }
    }

    // ENHANCED: Send typing indicator with business context
    async sendTyping(userId, duration = 3000) {
        try {
            if (!this.socket) return false;
            
            console.log(`Showing typing indicator to ${userId} (${this.botInfo?.businessName || 'Unknown Business'})`);
            
            await this.socket.sendPresenceUpdate('composing', userId);
            
            setTimeout(async () => {
                try {
                    await this.socket.sendPresenceUpdate('paused', userId);
                } catch (err) {
                    console.log('Could not clear typing indicator:', err.message);
                }
            }, duration);
            
            return true;
        } catch (error) {
            console.error('Error sending typing indicator:', error.message);
            return false;
        }
    }

    // Event handler registration
    onMessage(handler) {
        if (this.socket) {
            // Store handler so it can be reattached after reconnections
            if (!this.eventHandlers) {
                this.eventHandlers = new Map();
            }
            this.eventHandlers.set('messages.upsert.external', handler);
            this.socket.ev.on('messages.upsert', handler);
        } else {
            throw new Error('Socket not initialized. Call initialize() first.');
        }
    }

    // ENHANCED: Utility methods with vendor mapping context
    isConnected() {
        return this.socket && this.socket.user;
    }

    getBotStartTime() {
        return this.botStartTime;
    }

    getSocket() {
        return this.socket;
    }

    getBotPhoneNumber() {
        try {
            if (this.socket && this.socket.user) {
                // socket.user.id is like '123456789:1@s.whatsapp.net'
                const fullId = this.socket.user.id;
                const withoutDomain = fullId.split('@')[0];
                const numberOnly = withoutDomain.split(':')[0];
                return numberOnly;
            }
        } catch (error) {
            console.error('Error extracting bot phone number:', error.message);
        }
        return 'unknown';
    }

    // ENHANCED: Get comprehensive bot info including vendor mapping
    getBotInfo() {
        if (!this.socket || !this.socket.user) {
            return null;
        }
        
        return {
            phoneNumber: this.getBotPhoneNumber(),
            name: this.socket.user.name || 'LLL Farm Bot',
            id: this.socket.user.id,
            startTime: this.botStartTime,
            uptime: this.botStartTime ? Date.now() - this.botStartTime : 0,
            mappedBusinessId: this.botInfo?.mappedBusinessId || 'default',
            businessName: this.botInfo?.businessName || 'Unknown',
            vendorMappingAttempted: this.vendorMappingAttempted,
            vendorMappingSuccess: !!(this.botInfo?.mappedBusinessId && this.botInfo?.mappedBusinessId !== 'default')
        };
    }

    // ENHANCED: Health check with vendor mapping status
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
            
            const botInfo = this.getBotInfo();
            
            return { 
                status: 'connected', 
                botInfo: botInfo,
                uptime: this.botStartTime ? Date.now() - this.botStartTime : 0,
                vendorMapping: {
                    attempted: this.vendorMappingAttempted,
                    successful: botInfo?.vendorMappingSuccess || false,
                    businessId: botInfo?.mappedBusinessId || 'default',
                    businessName: botInfo?.businessName || 'Unknown'
                }
            };
            
        } catch (error) {
            return { 
                status: 'error', 
                error: error.message 
            };
        }
    }

    // NEW: Force vendor re-mapping
    async forceVendorRemapping() {
        console.log('FORCE REMAPPING - Forcing vendor re-discovery...');
        
        this.vendorMappingAttempted = false;
        this.botInfo = null;
        
        // Re-extract bot info
        this.extractBotInfo();
        
        // Attempt mapping again
        await this.attemptVendorMapping();
        
        return this.getBotInfo();
    }

    // NEW: Get vendor mapping status
    getVendorMappingStatus() {
        return {
            attempted: this.vendorMappingAttempted,
            successful: !!(this.botInfo?.mappedBusinessId && this.botInfo?.mappedBusinessId !== 'default'),
            businessId: this.botInfo?.mappedBusinessId || 'default',
            businessName: this.botInfo?.businessName || 'Unknown',
            botPhoneNumber: this.getBotPhoneNumber(),
            canRetryMapping: !this.vendorMappingAttempted || this.botInfo?.mappedBusinessId === 'default'
        };
    }

    // Cleanup method
    cleanup() {
        console.log('Cleaning up WhatsApp service...');
        
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        
        if (this.connectionCheckInterval) {
            clearInterval(this.connectionCheckInterval);
            this.connectionCheckInterval = null;
        }
        
        if (this.socket) {
            this.socket.end();
            this.socket = null;
        }
        
        // Clear bot info
        this.botInfo = null;
        this.vendorMappingAttempted = false;
        
        console.log('WhatsApp service cleanup completed');
    }

    // Shutdown method
    async shutdown() {
        try {
            if (this.connectionCheckInterval) {
                clearInterval(this.connectionCheckInterval);
                this.connectionCheckInterval = null;
            }

            if (this.reconnectTimeout) {
                clearTimeout(this.reconnectTimeout);
                this.reconnectTimeout = null;
            }

            if (this.socket) {
                await this.socket.sendPresenceUpdate('unavailable');
                await this.socket.end(new Boom('Shutdown initiated'));
                this.socket = null;
            }

            if (this.redisPublisher) {
                try { await this.redisPublisher.quit(); } catch (_) {}
                this.redisPublisher = null;
                this.redisConnected = false;
            }
        } catch (error) {
            console.error('Error during WhatsApp service shutdown:', error.message);
        }
    }
}

module.exports = new WhatsAppService();