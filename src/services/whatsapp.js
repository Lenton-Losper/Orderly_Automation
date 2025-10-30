// Last modified: 2025-01-27
// File: src/services/whatsapp.js
// Enhanced WhatsApp Service with Dynamic Vendor Mapping Integration
// Handles WhatsApp connection, message sending, and bot-to-vendor mapping
// Integrates with dynamic Firebase vendor discovery system

// Import Baileys functions directly (not as default)
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const redis = require('redis');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const QRCode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const { getSocketConfig, getHealthCheckQuery } = require('../config/socket');
const { CONNECTION_CONFIG, CACHE_CONFIG, WHATSAPP_CONFIG } = require('../config/constants');
const { getDatabase, getFirebaseAdmin } = require('../config/database');

class WhatsAppService {
    constructor() {
        this.socket = null;
        this.connectionRetries = 0;
        this.maxRetries = parseInt(process.env.WHATSAPP_MAX_RETRIES) || CONNECTION_CONFIG?.MAX_RETRIES || 5;
        this.authTimeoutMs = parseInt(process.env.WHATSAPP_AUTH_TIMEOUT) || 60000; // 60 seconds
        this.qrMaxRetries = parseInt(process.env.WHATSAPP_QR_MAX_RETRIES) || 5;
        this.reconnectTimeout = null;
        this.connectionCheckInterval = null;
        this.botStartTime = null;
        this.eventHandlers = new Map();
        this.botInfo = null; // Store bot information for dynamic mapping
        this.vendorMappingAttempted = false; // Track if we've tried mapping this session
        this.redisPublisher = null;
        this.redisConnected = false;
        this.qrCodeGenerated = false;
        this.isAuthenticated = false;
        
        // Firebase will be initialized when needed
        
        // Resolve tenant-specific auth directory once
        const authFolder = process.env.WHATSAPP_SESSION_PATH || 
            (WHATSAPP_CONFIG && WHATSAPP_CONFIG.AUTH_FOLDER ? WHATSAPP_CONFIG.AUTH_FOLDER : 'auth');
        this.authDir = path.isAbsolute(authFolder) ? authFolder : path.join(process.cwd(), authFolder);
        
        // Create public directory for QR code storage
        this.publicDir = path.join(process.cwd(), 'public');
        if (!fs.existsSync(this.publicDir)) {
            fs.mkdirSync(this.publicDir, { recursive: true });
        }
        
        console.log('✅ WhatsApp service constructor initialized');
        console.log(`📁 Auth directory: ${this.authDir}`);
        console.log(`📁 Public directory: ${this.publicDir}`);
    }

    async initialize() {
        try {
            // Initialize Firebase database and FieldValue
            this.db = getDatabase();
            const admin = getFirebaseAdmin();
            this.FieldValue = admin.firestore.FieldValue;
            console.log('✅ Firebase database and FieldValue initialized in WhatsApp service');
            
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
                // Enhanced socket configuration with proper authentication settings
                const socketConfig = {
                    auth: state,
                    browser: ['WhatsApp Bot', 'Chrome', '120.0.0'],
                    syncFullHistory: false,
                    logger: pino({ level: 'silent' }),
                    printQRInTerminal: false, // We'll handle QR display ourselves
                    // Add timeout settings
                    connectTimeoutMs: this.authTimeoutMs,
                    defaultQueryTimeoutMs: 60000,
                    // Add retry settings
                    retryRequestDelayMs: 250,
                    maxMsgRetryCount: 5,
                    // Add user agent to avoid detection
                    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    // Add keep alive settings
                    keepAliveIntervalMs: 30000,
                    // Add connection settings
                    markOnlineOnConnect: true,
                    // Add message settings
                    shouldSyncHistoryMessage: () => false,
                    shouldIgnoreJid: () => false,
                    // Add authentication settings
                    generateHighQualityLinkPreview: false,
                    // Add connection retry settings
                    connectionOptions: {
                        timeout: this.authTimeoutMs,
                        retries: this.maxRetries
                    }
                };
                
                console.log('Creating WhatsApp socket with enhanced config...');
                this.socket = makeWASocket(socketConfig);
                console.log('Enhanced socket created successfully');
                
            } catch (socketError) {
                console.error('Enhanced socket failed, trying with minimal config...');
                console.error('Socket error:', socketError.message);
                
                // Fall back to minimal config
                const minimalConfig = {
                    auth: state,
                    browser: ['WhatsApp Bot', 'Chrome', '120.0.0'],
                    syncFullHistory: false,
                    logger: pino({ level: 'silent' }),
                    printQRInTerminal: false
                };
                
                console.log('Creating WhatsApp socket with minimal config...');
                this.socket = makeWASocket(minimalConfig);
                console.log('Minimal socket created successfully');
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
                const { vendorId, tenantId } = await this.getBotTenantInfo();
                await this.publishConnectionStatus('disconnected', lastDisconnect?.error?.message, vendorId, tenantId);
            } else if (connection === 'open') {
                await this.handleConnectionOpen();
                const { vendorId, tenantId } = await this.getBotTenantInfo();
                await this.publishConnectionStatus('connected', null, vendorId, tenantId);
            } else if (connection === 'connecting') {
                console.log('Connecting to WhatsApp...');
                const { vendorId, tenantId } = await this.getBotTenantInfo();
                await this.publishConnectionStatus('connecting', null, vendorId, tenantId);
            }
            
            // ENHANCED: Display QR code with dynamic mapping info
            if (qr) {
                this.qrCodeGenerated = true;
                console.log('\n📱 QR CODE TO SCAN:');
                console.log('='.repeat(50));
                
                // Display QR code in terminal
                try {
                    qrcodeTerminal.generate(qr, { small: true });
                } catch (qrError) {
                    console.log('QR Code (text):');
                    console.log(qr);
                }
                
                console.log('='.repeat(50));
                console.log('📱 SCAN THIS QR CODE WITH YOUR PHONE:');
                console.log('1. Open WhatsApp on your phone');
                console.log('2. Go to Settings → Linked Devices');
                console.log('3. Tap "Link a Device"');
                console.log('4. Scan the QR code above');
                console.log('='.repeat(50));
                console.log('🌐 OR VISIT THIS URL:');
                console.log(`http://localhost:3000/qr`);
                console.log('='.repeat(50));
                console.log('⏰ You have 60 seconds to scan the QR code');
                console.log('🔄 Bot will auto-retry if needed');
                console.log('='.repeat(50) + '\n');

                // Save QR code to file for web access
                try {
                    const qrImagePath = path.join(this.publicDir, 'qr.png');
                    await QRCode.toFile(qrImagePath, qr, { 
                        width: 300, 
                        margin: 2,
                        color: {
                            dark: '#000000',
                            light: '#FFFFFF'
                        }
                    });
                    console.log(`📁 QR code saved to: ${qrImagePath}`);
                } catch (fileError) {
                    console.error('❌ Error saving QR code to file:', fileError.message);
                }

                // Get the correct vendor and tenant IDs for this bot
                const { vendorId, tenantId } = await this.getBotTenantInfo();
                
                // Publish QR code over Redis for WebSocket broadcasting with correct tenant info
                await this.publishQrCode(qr, vendorId, tenantId);
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
                console.log('✅ Credentials updated successfully');
                this.isAuthenticated = true;
                this.qrCodeGenerated = false;
            }
        });

        // Authentication success handler
        this.socket.ev.on('auth_failure', (message) => {
            console.error('❌ WhatsApp authentication failed:', message);
            console.log('🔄 Clearing session data and restarting...');
            
            // Clear corrupted session
            this.clearCorruptedAuth().then(() => {
                console.log('✅ Session data cleared. Please restart the bot.');
            }).catch(err => {
                console.error('❌ Error clearing session:', err.message);
            });
        });

        // Disconnection handler
        this.socket.ev.on('disconnected', (reason) => {
            console.log('⚠️ WhatsApp client disconnected:', reason);
            console.log('Attempting to reconnect...');
            this.isAuthenticated = false;
        });

        // Ready handler
        this.socket.ev.on('ready', () => {
            console.log('✅ WhatsApp client is ready!');
            console.log('📱 Connected as:', this.socket.user?.name || 'Unknown');
            this.isAuthenticated = true;
            this.qrCodeGenerated = false;
        });
    }

    // NEW: Store QR code in Firestore for frontend polling
    async storeQRCodeInFirestore(qr, tenantId) {
        try {
            if (!qr || !tenantId) {
                console.log('⚠️ Missing QR code or tenant ID, skipping Firestore storage');
                return;
            }
            
            // Database and FieldValue are now initialized in constructor
            
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`;
            const qrData = {
                qrCode: qr,
                qrCodeUrl: qrUrl, // Fixed: use qrCodeUrl to match API response
                status: 'pending',
                lastUpdated: this.FieldValue.serverTimestamp(),
                timestamp: Date.now()
            };
            
            // Use merge: true to update existing document or create new one
            await this.db.collection('tenants').doc(tenantId).collection('botSession').doc('current').set(qrData, { merge: true });
            console.log(`📱 QR code updated in Firestore for tenant: ${tenantId} (timestamp: ${qrData.timestamp})`);
        } catch (error) {
            console.error('❌ Error storing QR code in Firestore:', error.message);
            console.error('❌ Error details:', error);
        }
    }

    // NEW: Store connection status in Firestore
    async storeConnectionStatusInFirestore(status, reason, tenantId) {
        try {
            if (!tenantId) {
                console.log('⚠️ Missing tenant ID, skipping connection status storage');
                return;
            }
            
            // Database and FieldValue are now initialized in constructor
            
            const statusData = {
                status: status,
                reason: reason || null,
                lastUpdated: this.FieldValue.serverTimestamp(),
                timestamp: Date.now()
            };
            
            // Use merge: true to update existing document or create new one
            await this.db.collection('tenants').doc(tenantId).collection('botSession').doc('current').set(statusData, { merge: true });
            console.log(`📡 Connection status updated in Firestore for tenant: ${tenantId} - ${status} (timestamp: ${statusData.timestamp})`);
        } catch (error) {
            console.error('❌ Error storing connection status in Firestore:', error.message);
            console.error('❌ Error details:', error);
        }
    }

    // Publish connection status via Redis -> WebSocket
    async publishConnectionStatus(status, reason, vendorId = null, tenantId = null) {
        try {
            if (!this.redisConnected || !this.redisPublisher) return;
            
            // Get vendor and tenant IDs - prioritize passed parameters, then bot info, then defaults
            const actualVendorId = vendorId || this.botInfo?.mappedBusinessId || process.env.TENANT_ID || 'default';
            const actualTenantId = tenantId || this.botInfo?.tenantId || process.env.TENANT_ID || 'default';
            
            const payload = {
                type: 'connection_status',
                vendorId: actualVendorId,
                tenantId: actualTenantId, // Include tenantId in connection status
                status, // connecting|connected|disconnected|failed
                reason,
                timestamp: new Date().toISOString()
            };
            
            // Publish to both vendor-specific and tenant-specific channels
            await this.redisPublisher.publish(`whatsapp:${actualVendorId}`, JSON.stringify(payload));
            await this.redisPublisher.publish(`tenant:${actualTenantId}`, JSON.stringify(payload));
            
            // NEW: Store connection status in Firestore
            await this.storeConnectionStatusInFirestore(status, reason, actualTenantId);
            
            console.log(`📡 Connection status published: ${status} for vendor: ${actualVendorId}, tenant: ${actualTenantId}`);
        } catch (err) {
            console.error('❌ Error publishing connection status:', err.message);
            // Best-effort, do not crash
        }
    }

    // Publish QR code via Redis -> WebSocket with tenant context
    async publishQrCode(qr, vendorId = null, tenantId = null) {
        try {
            if (!this.redisConnected || !this.redisPublisher || !qr) return;
            
            // Get vendor and tenant IDs - prioritize passed parameters, then bot info, then defaults
            const actualVendorId = vendorId || this.botInfo?.mappedBusinessId || process.env.TENANT_ID || 'default';
            const actualTenantId = tenantId || this.botInfo?.tenantId || process.env.TENANT_ID || 'default';
            
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`;
            const payload = {
                type: 'qr_code',
                vendorId: actualVendorId,
                tenantId: actualTenantId,
                qrCode: qr,
                qrUrl,
                timestamp: new Date().toISOString()
            };
            
            // Publish to both vendor-specific and tenant-specific channels
            await this.redisPublisher.publish(`whatsapp:${actualVendorId}`, JSON.stringify(payload));
            await this.redisPublisher.publish(`tenant:${actualTenantId}`, JSON.stringify(payload));
            
            // NEW: Store QR code in Firestore for frontend polling
            await this.storeQRCodeInFirestore(qr, actualTenantId);
            
            console.log(`📱 QR code published for vendor: ${actualVendorId}, tenant: ${actualTenantId}`);
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
        
        // Manually update connection status since the bot is working
        const { vendorId, tenantId } = await this.getBotTenantInfo();
        await this.publishConnectionStatus('connected', null, vendorId, tenantId);
    }

    // NEW: Extract bot information for vendor mapping
    extractBotInfo() {
        if (this.socket && this.socket.user) {
            this.botInfo = {
                phoneNumber: this.getBotPhoneNumber(),
                fullId: this.socket.user.id,
                name: this.socket.user.name || 'WhatsApp Bot',
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

    // NEW: Get bot tenant information for proper QR code publishing
    async getBotTenantInfo() {
        try {
            // First try to get from bot info if already mapped
            if (this.botInfo?.mappedBusinessId && this.botInfo?.mappedBusinessId !== 'default') {
                return {
                    vendorId: this.botInfo.mappedBusinessId,
                    tenantId: this.botInfo.tenantId || this.botInfo.mappedBusinessId
                };
            }

            // Try to get business mapping from bot phone number (only if bot is connected)
            const botPhoneNumber = this.getBotPhoneNumber();
            if (botPhoneNumber && botPhoneNumber !== 'unknown') {
                const businessManager = require('./businessManager');
                if (businessManager.isHealthy()) {
                    const businessId = await businessManager.getBusinessIdFromBot(botPhoneNumber);
                    if (businessId && businessId !== 'default') {
                        // Update bot info with the discovered business ID
                        this.botInfo = {
                            ...this.botInfo,
                            mappedBusinessId: businessId,
                            tenantId: businessId
                        };

                        return {
                            vendorId: businessId,
                            tenantId: businessId
                        };
                    }
                }
            }

            // For QR generation phase (bot not connected yet), try to get tenant from environment
            // or use a more intelligent fallback
            let vendorId = process.env.TENANT_ID || 'default';
            let tenantId = process.env.TENANT_ID || 'default';

            // If we have a specific tenant ID in environment, use it
            if (process.env.TENANT_ID && process.env.TENANT_ID !== 'default') {
                console.log(`TENANT INFO - Using environment tenant: ${tenantId}`);
                return { vendorId, tenantId };
            }

            // Use the existing tenant ID from Firebase
            console.log(`TENANT INFO - Using existing tenant: ${tenantId}`);
            console.log(`TENANT INFO - This will be updated once bot connects and phone number is available`);
            
            return { vendorId, tenantId };
        } catch (error) {
            console.error('Error getting bot tenant info:', error.message);
            return {
                vendorId: process.env.TENANT_ID || 'default',
                tenantId: process.env.TENANT_ID || 'default'
            };
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
            name: this.socket.user.name || 'WhatsApp Bot',
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

    // NEW: Initialize WhatsApp with retry logic and exponential backoff
    async initializeWhatsAppWithRetry(maxRetries = 3) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`🔄 WhatsApp connection attempt ${attempt}/${maxRetries}`);
                
                await this.initialize();
                
                // Wait for ready event with timeout
                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        reject(new Error('WhatsApp initialization timeout'));
                    }, this.authTimeoutMs);
                    
                    const readyHandler = () => {
                        clearTimeout(timeout);
                        this.socket.ev.off('ready', readyHandler);
                        this.socket.ev.off('auth_failure', authFailureHandler);
                        resolve();
                    };
                    
                    const authFailureHandler = (msg) => {
                        clearTimeout(timeout);
                        this.socket.ev.off('ready', readyHandler);
                        this.socket.ev.off('auth_failure', authFailureHandler);
                        reject(new Error(`Auth failure: ${msg}`));
                    };
                    
                    this.socket.ev.on('ready', readyHandler);
                    this.socket.ev.on('auth_failure', authFailureHandler);
                });
                
                console.log('✅ WhatsApp connected successfully!');
                return true;
                
            } catch (error) {
                console.error(`❌ Attempt ${attempt} failed:`, error.message);
                
                if (attempt < maxRetries) {
                    const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
                    console.log(`⏳ Waiting ${delay/1000}s before retry...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    
                    // Clear session before retry
                    await this.clearCorruptedAuth();
                } else {
                    console.error('❌ All connection attempts failed');
                    throw error;
                }
            }
        }
    }

    // NEW: Force reconnect method
    async forceReconnect() {
        try {
            console.log('🔄 Forcing WhatsApp reconnection...');
            
            // Destroy current client
            if (this.socket) {
                await this.socket.end();
                this.socket = null;
            }
            
            // Clear session
            await this.clearCorruptedAuth();
            
            // Reset flags
            this.isAuthenticated = false;
            this.qrCodeGenerated = false;
            this.connectionRetries = 0;
            
            // Reinitialize
            await this.initializeWhatsAppWithRetry(3);
            
            return true;
        } catch (error) {
            console.error('❌ Force reconnect failed:', error.message);
            return false;
        }
    }

    // NEW: Get connection status
    getConnectionStatus() {
        return {
            connected: this.isConnected(),
            authenticated: this.isAuthenticated,
            qrCodeGenerated: this.qrCodeGenerated,
            retries: this.connectionRetries,
            maxRetries: this.maxRetries,
            botInfo: this.getBotInfo()
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