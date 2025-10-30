// Last modified: 2025-01-27
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const pino = require('pino');
const { initializeFirebase, getDatabase, getFirebaseAdmin } = require('./config/database');
const { COLLECTIONS } = require('./config/constants');
const QRCode = require('qrcode');
// Removed Baileys imports - now using whatsapp-web.js
const fs = require('fs');
const path = require('path');

class APIServer {
    constructor() {
        this.app = express();
        const { getServiceUrls } = require('./config/docker');
        const serviceUrls = getServiceUrls();
        this.port = process.env.API_PORT || serviceUrls.botTraining.port;
        this.db = null;
        this.admin = null;
        this.isInitialized = false;
        this.botSessions = new Map(); // Store bot sessions by tenantId
    }

    async initialize() {
        try {
            console.log('🚀 Initializing API Server...');

            // Initialize Firebase
            await initializeFirebase();
            this.db = getDatabase();
            this.admin = getFirebaseAdmin();

            // CORS configuration for Docker and local development
            const corsOptions = {
                origin: function (origin, callback) {
                    console.log('🔍 CORS Origin check:', origin);
                    
                    // Allow requests with no origin (mobile apps, curl, etc.)
                    if (!origin) {
                        console.log('✅ Allowing request with no origin');
                        return callback(null, true);
                    }
                    
                    // Allow localhost and Docker network origins
                    const allowedOrigins = [
                        'http://localhost:3000',  // Frontend (Next.js)
                        'http://localhost:3001',  // Bot Training API
                        'http://localhost:3002',  // Main Backend API
                        'http://localhost:8080',  // WebSocket
                        'http://backend:3000',
                        'http://bot-training:3001',
                        'http://frontend:3000', // If you have a frontend container
                        /^http:\/\/.*\.localhost:\d+$/, // Local development with subdomains
                    ];
                    
                    if (allowedOrigins.some(allowed => 
                        typeof allowed === 'string' ? allowed === origin : allowed.test(origin)
                    )) {
                        console.log('✅ Origin allowed:', origin);
                        return callback(null, true);
                    }
                    
                    // In development, allow all origins
                    if (process.env.NODE_ENV !== 'production') {
                        console.log('✅ Development mode - allowing all origins:', origin);
                        return callback(null, true);
                    }
                    
                    console.log('❌ Origin not allowed:', origin);
                    callback(new Error('Not allowed by CORS'));
                },
                credentials: true,
                methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
                allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
                optionsSuccessStatus: 200 // Some legacy browsers (IE11, various SmartTVs) choke on 204
            };
            
            // Apply CORS middleware BEFORE helmet
            this.app.use(cors(corsOptions));
            
            // Middleware
            this.app.use(helmet());
            this.app.use(express.json({ limit: '10mb' }));
            this.app.use(express.urlencoded({ extended: true }));

            // Routes
            this.setupRoutes();

            // Error handling middleware
            this.app.use(this.errorHandler);

            this.isInitialized = true;
            console.log('✅ API Server initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize API Server:', error);
            throw error;
        }
    }

    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ 
                status: 'healthy', 
                timestamp: new Date().toISOString(),
                initialized: this.isInitialized
            });
        });

        // User tenant routes
        const userTenantRoutes = require('./routes/userTenant');
        this.app.use('/api/user', userTenantRoutes);

        // Bot training routes
        const trainingRoutes = require('./routes/training');
        this.app.use('/api/bot/training', trainingRoutes);

        // Vendor signup endpoint
        this.app.post('/auth/signup', async (req, res) => {
            try {
                const { email, password, businessName } = req.body;

                // Validate input
                if (!email || !password || !businessName) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing required fields: email, password, businessName'
                    });
                }

                // Validate email format
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid email format'
                    });
                }

                // Validate password strength
                if (password.length < 6) {
                    return res.status(400).json({
                        success: false,
                        error: 'Password must be at least 6 characters long'
                    });
                }

                console.log(`📝 Processing signup for: ${email}, Business: ${businessName}`);

                // Step 1: Create Firebase Auth user
                const userRecord = await this.createFirebaseUser(email, password, businessName);
                const uid = userRecord.uid;

                // Step 2: Generate tenant ID
                const tenantId = this.generateTenantId();

                // Step 3: Create tenant document
                await this.createTenantDocument(tenantId, uid, businessName);

                // Step 4: Add user to tenant members
                await this.addUserToTenant(tenantId, uid, 'admin');

                // Step 5: Generate WhatsApp bot QR code
                const qrCodeData = await this.generateBotQRCode(tenantId);

                // Step 6: Save bot session to Firestore
                await this.saveBotSession(tenantId, qrCodeData);

                console.log(`✅ Signup completed for tenant: ${tenantId}, user: ${uid}`);

                res.status(201).json({
                    success: true,
                    tenantId,
                    uid,
                    qrCodeUrl: qrCodeData.qrCodeUrl,
                    message: 'Vendor account created successfully. Scan the QR code to connect WhatsApp bot.'
                });

            } catch (error) {
                console.error('❌ Signup error:', error);
                
                // Handle specific Firebase Auth errors
                if (error.code === 'auth/email-already-exists') {
                    return res.status(409).json({
                        success: false,
                        error: 'Email already exists'
                    });
                }

                res.status(500).json({
                    success: false,
                    error: 'Internal server error during signup',
                    details: process.env.NODE_ENV === 'development' ? error.message : undefined
                });
            }
        });

        // Create tenant endpoint for frontend
        this.app.post('/api/tenant/create', async (req, res) => {
            try {
                const { userId, phoneId, email, businessName } = req.body;

                // Validate input
                if (!userId) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing required field: userId'
                    });
                }

                console.log(`📝 Creating tenant for user: ${userId}`);
                console.log(`📱 Phone: ${phoneId || 'not provided'}`);
                console.log(`📧 Email: ${email || 'not provided'}`);

                // Generate tenant ID
                const tenantId = this.generateTenantId();

                // Create tenant document
                const tenantData = {
                    id: tenantId,
                    ownerId: userId,
                    phone: phoneId || '',
                    email: email || '',
                    businessName: businessName || `Business ${phoneId || userId}`,
                    address: '',
                    createdAt: this.admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: this.admin.firestore.FieldValue.serverTimestamp(),
                    isActive: true,
                    setupComplete: false,
                    status: 'active',
                    settings: {
                        allowPublicOrders: true,
                        requireCustomerRegistration: true,
                        autoGenerateInvoices: true
                    }
                };

                console.log(`💾 Saving tenant to Firestore: ${tenantId}`);
                console.log(`📋 Tenant data:`, tenantData);

                // Save to Firestore
                const tenantRef = this.db.collection('tenants').doc(tenantId);
                await tenantRef.set(tenantData);

                console.log(`✅ Tenant document saved to Firestore`);

                // Verify it was actually saved
                const verifyDoc = await tenantRef.get();
                
                if (!verifyDoc.exists()) {
                    console.error('❌ Tenant verification failed - document not found after save!');
                    throw new Error('Tenant creation failed: document not found after save');
                }

                console.log(`✅ Tenant verified in Firestore`);
                console.log(`✅ Default tenant created successfully: ${tenantId}`);

                // Add user to tenant members
                await this.addUserToTenant(tenantId, userId, 'admin');

                res.status(201).json({
                    success: true,
                    tenant: {
                        id: tenantId,
                        ...tenantData
                    },
                    message: 'Tenant created successfully'
                });

            } catch (error) {
                console.error('❌ Error creating tenant:', error);
                console.error('Error details:', {
                    message: error.message,
                    code: error.code,
                    stack: error.stack
                });
                
                res.status(500).json({
                    success: false,
                    error: 'Failed to create tenant',
                    details: process.env.NODE_ENV === 'development' ? error.message : undefined
                });
            }
        });

        // Get tenant by user ID endpoint
        this.app.get('/api/tenant/user/:userId', async (req, res) => {
            try {
                const { userId } = req.params;
                
                console.log(`🔍 Looking up tenant for user: ${userId}`);
                
                // Query tenants by ownerId
                const tenantsQuery = this.db.collection('tenants')
                    .where('ownerId', '==', userId)
                    .limit(1);
                
                const tenantsSnapshot = await tenantsQuery.get();
                
                if (tenantsSnapshot.empty) {
                    console.log(`❌ No tenant found for user: ${userId}`);
                    return res.status(404).json({
                        success: false,
                        error: 'No tenant found for this user'
                    });
                }
                
                const tenantDoc = tenantsSnapshot.docs[0];
                const tenantData = tenantDoc.data();
                
                console.log(`✅ Found tenant: ${tenantDoc.id}`);
                
                res.json({
                    success: true,
                    tenant: {
                        id: tenantDoc.id,
                        ...tenantData
                    }
                });
                
            } catch (error) {
                console.error('❌ Error looking up tenant:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to lookup tenant'
                });
            }
        });

        // Analytics endpoint for frontend
        this.app.get('/api/analytics', async (req, res) => {
            try {
                const { phoneId, tenantId, start, end, months } = req.query;
                
                console.log(`📊 Analytics request: phoneId=${phoneId}, tenantId=${tenantId}`);
                
                // For now, return mock analytics data
                const mockAnalytics = {
                    success: true,
                    phoneId: phoneId,
                    tenantId: tenantId,
                    period: {
                        start: start || '2025-05-01',
                        end: end || '2025-10-31',
                        months: parseInt(months) || 6
                    },
                    metrics: {
                        totalMessages: 0,
                        totalOrders: 0,
                        totalRevenue: 0,
                        activeCustomers: 0,
                        responseTime: 0
                    },
                    charts: {
                        messagesOverTime: [],
                        ordersOverTime: [],
                        revenueOverTime: []
                    },
                    message: 'Analytics endpoint - returning mock data for now'
                };
                
                res.json(mockAnalytics);
                
            } catch (error) {
                console.error('❌ Analytics error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to fetch analytics data',
                    details: process.env.NODE_ENV === 'development' ? error.message : undefined
                });
            }
        });

        // Get tenant info
        this.app.get('/tenant/:tenantId', async (req, res) => {
            try {
                const { tenantId } = req.params;
                
                const tenantDoc = await this.db.collection('tenants').doc(tenantId).get();
                
                if (!tenantDoc.exists) {
                    return res.status(404).json({
                        success: false,
                        error: 'Tenant not found'
                    });
                }

                const tenantData = tenantDoc.data();
                
                // Get bot session info
                const botSessionDoc = await this.db.collection('tenants')
                    .doc(tenantId)
                    .collection('botSession')
                    .doc('main')
                    .get();

                const response = {
                    success: true,
                    tenantId,
                    businessName: tenantData.businessName,
                    ownerId: tenantData.ownerId,
                    createdAt: tenantData.createdAt,
                    botStatus: botSessionDoc.exists ? botSessionDoc.data().status : 'not_initialized'
                };

                if (botSessionDoc.exists) {
                    const botData = botSessionDoc.data();
                    response.qrCodeUrl = botData.qrCodeUrl;
                    response.lastUpdated = botData.lastUpdated;
                }

                res.json(response);
            } catch (error) {
                console.error('❌ Get tenant error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to retrieve tenant information'
                });
            }
        });

        // Get bot QR code for tenant
        this.app.get('/tenant/:tenantId/qr', async (req, res) => {
            try {
                const { tenantId } = req.params;
                
                // Try to get the current QR code from the new structure
                const botSessionDoc = await this.db.collection('tenants')
                    .doc(tenantId)
                    .collection('botSession')
                    .doc('current')
                    .get();

                if (!botSessionDoc.exists) {
                    // Fallback to old structure
                    const fallbackDoc = await this.db.collection('tenants')
                        .doc(tenantId)
                        .collection('botSession')
                        .doc('main')
                        .get();
                    
                    if (!fallbackDoc.exists) {
                        return res.status(404).json({
                            success: false,
                            error: 'Bot session not found for this tenant'
                        });
                    }
                    
                    const fallbackData = fallbackDoc.data();
                    return res.json({
                        success: true,
                        tenantId,
                        qrCode: fallbackData.qrCode,
                        qrCodeUrl: fallbackData.qrCodeUrl,
                        status: fallbackData.status || 'pending',
                        lastUpdated: fallbackData.lastUpdated,
                        timestamp: fallbackData.timestamp
                    });
                }

                const botData = botSessionDoc.data();
                
                res.json({
                    success: true,
                    tenantId,
                    qrCode: botData.qrCode,
                    qrCodeUrl: botData.qrCodeUrl,
                    status: botData.status || 'pending',
                    lastUpdated: botData.lastUpdated,
                    timestamp: botData.timestamp
                });
            } catch (error) {
                console.error('❌ Get QR code error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to retrieve QR code'
                });
            }
        });

        // NEW: WhatsApp QR code endpoints
        this.app.get('/api/whatsapp/qr', (req, res) => {
            try {
                const qrPath = path.join(__dirname, '../public/qr.png');
                
                if (fs.existsSync(qrPath)) {
                    res.sendFile(qrPath);
                } else {
                    res.status(404).json({ 
                        error: 'QR code not available. Is the bot initializing?' 
                    });
                }
            } catch (error) {
                console.error('❌ QR code endpoint error:', error);
                res.status(500).json({ error: 'Failed to serve QR code' });
            }
        });

        // Get WhatsApp connection status
        this.app.get('/api/whatsapp/status', async (req, res) => {
            try {
                // Use WhatsApp service instance passed from main bot
                const whatsappService = this.whatsappService;
                
                console.log('DEBUG - WhatsApp service type:', typeof whatsappService);
                console.log('DEBUG - WhatsApp service methods:', whatsappService ? Object.getOwnPropertyNames(Object.getPrototypeOf(whatsappService)) : 'null');
                
                if (!whatsappService) {
                    return res.json({
                        success: false,
                        connected: false,
                        authenticated: false,
                        error: 'WhatsApp service not available',
                        timestamp: new Date().toISOString()
                    });
                }
                
                if (typeof whatsappService.getConnectionStatus !== 'function') {
                    return res.json({
                        success: false,
                        connected: false,
                        authenticated: false,
                        error: 'WhatsApp service getConnectionStatus method not available',
                        timestamp: new Date().toISOString()
                    });
                }
                
                const status = whatsappService.getConnectionStatus();
                
                res.json({
                    success: true,
                    connected: status.connected,
                    authenticated: status.authenticated,
                    qrCodeGenerated: status.qrCodeGenerated,
                    retries: status.retries,
                    maxRetries: status.maxRetries,
                    botInfo: status.botInfo,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('❌ WhatsApp status error:', error);
                res.json({
                    success: false,
                    connected: false,
                    authenticated: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Force WhatsApp reconnect endpoint
        this.app.post('/api/whatsapp/reconnect', async (req, res) => {
            try {
                console.log('🔄 Forcing WhatsApp reconnection...');
                
                // Import WhatsApp service
                const whatsappService = require('./services/whatsappWeb');
                
                const success = await whatsappService.forceReconnect();
                
                if (success) {
                    res.json({ 
                        success: true, 
                        message: 'Reconnection initiated successfully' 
                    });
                } else {
                    res.status(500).json({ 
                        success: false, 
                        error: 'Reconnection failed' 
                    });
                }
            } catch (error) {
                console.error('❌ Force reconnect error:', error);
                res.status(500).json({ 
                    success: false, 
                    error: error.message 
                });
            }
        });

        // Get WhatsApp bot info
        this.app.get('/api/whatsapp/info', async (req, res) => {
            try {
                // Import WhatsApp service
                const whatsappService = require('./services/whatsappWeb');
                
                const botInfo = whatsappService.getBotInfo();
                const vendorMappingStatus = whatsappService.getVendorMappingStatus();
                
                res.json({
                    success: true,
                    botInfo: botInfo,
                    vendorMapping: vendorMappingStatus,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('❌ WhatsApp info error:', error);
                res.status(500).json({ 
                    success: false, 
                    error: error.message 
                });
            }
        });
    }

    async createFirebaseUser(email, password, businessName) {
        try {
            console.log(`🔥 Creating Firebase Auth user for: ${email}`);
            
            const userRecord = await this.admin.auth().createUser({
                email: email,
                password: password,
                displayName: businessName,
                emailVerified: false
            });

            console.log(`✅ Firebase Auth user created: ${userRecord.uid}`);
            return userRecord;
        } catch (error) {
            console.error('❌ Firebase Auth user creation failed:', error);
            throw error;
        }
    }

    generateTenantId() {
        // Generate a unique tenant ID
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        return `tenant_${timestamp}_${random}`;
    }

    async createTenantDocument(tenantId, ownerId, businessName) {
        try {
            console.log(`📄 Creating tenant document: ${tenantId}`);
            
            const tenantData = {
                ownerId,
                businessName,
                createdAt: this.admin.firestore.FieldValue.serverTimestamp(),
                status: 'active',
                settings: {
                    allowPublicOrders: true,
                    requireCustomerRegistration: true,
                    autoGenerateInvoices: true
                }
            };

            await this.db.collection('tenants').doc(tenantId).set(tenantData);
            console.log(`✅ Tenant document created: ${tenantId}`);
        } catch (error) {
            console.error('❌ Tenant document creation failed:', error);
            throw error;
        }
    }

    async addUserToTenant(tenantId, uid, role) {
        try {
            console.log(`👤 Adding user ${uid} to tenant ${tenantId} with role: ${role}`);
            
            const memberData = {
                uid,
                role,
                addedAt: this.admin.firestore.FieldValue.serverTimestamp(),
                permissions: this.getRolePermissions(role)
            };

            await this.db.collection('tenants')
                .doc(tenantId)
                .collection('members')
                .doc(uid)
                .set(memberData);

            console.log(`✅ User added to tenant: ${uid} -> ${tenantId}`);
        } catch (error) {
            console.error('❌ Failed to add user to tenant:', error);
            throw error;
        }
    }

    getRolePermissions(role) {
        const permissions = {
            admin: ['read', 'write', 'delete', 'manage_users', 'manage_products', 'manage_orders'],
            manager: ['read', 'write', 'manage_products', 'manage_orders'],
            staff: ['read', 'write', 'manage_orders'],
            viewer: ['read']
        };
        return permissions[role] || permissions.viewer;
    }

    async generateBotQRCode(tenantId) {
        try {
            console.log(`🤖 Generating WhatsApp bot QR code for tenant: ${tenantId}`);
            
            // Create auth folder for this tenant
            const authFolder = path.join(__dirname, '..', 'tenants', tenantId, 'auth');
            if (!fs.existsSync(authFolder)) {
                fs.mkdirSync(authFolder, { recursive: true });
            }

            // Initialize Baileys with multi-file auth state
            const { state, saveCreds } = await useMultiFileAuthState(authFolder);

            // Create WhatsApp socket
            const sock = makeWASocket({
                auth: state,
                printQRInTerminal: false, // We'll handle QR display ourselves
                browser: ['LLL Farm Bot', 'Chrome', '120.0.0'],
                logger: pino({ level: 'silent' })
            });

            // Store the socket for this tenant
            this.botSessions.set(tenantId, { sock, saveCreds });

            // Handle connection updates
            sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;
                
                if (qr) {
                    console.log(`📱 QR code generated for tenant: ${tenantId}`);
                    // QR code is available, we'll handle it in the main flow
                }
                
                if (connection === 'close') {
                    const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
                    console.log(`🔌 Connection closed for tenant ${tenantId}, should reconnect: ${shouldReconnect}`);
                    
                    if (shouldReconnect) {
                        // Reconnect logic could go here
                    }
                } else if (connection === 'open') {
                    console.log(`✅ WhatsApp connected for tenant: ${tenantId}`);
                    // Update bot session status
                    await this.updateBotSessionStatus(tenantId, 'connected');
                }
            });

            // Wait for QR code to be generated
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('QR code generation timeout'));
                }, 30000); // 30 second timeout

                sock.ev.on('connection.update', async (update) => {
                    if (update.qr) {
                        clearTimeout(timeout);
                        try {
                            // Generate QR code as base64 image
                            const qrCodeUrl = await QRCode.toDataURL(update.qr);
                            
                            resolve({
                                qrCode: qrCodeUrl,
                                qrCodeUrl: qrCodeUrl,
                                status: 'pending',
                                lastUpdated: new Date().toISOString()
                            });
                        } catch (qrError) {
                            clearTimeout(timeout);
                            reject(qrError);
                        }
                    }
                });
            });

        } catch (error) {
            console.error('❌ Bot QR code generation failed:', error);
            throw error;
        }
    }

    async saveBotSession(tenantId, qrCodeData) {
        try {
            console.log(`💾 Saving bot session for tenant: ${tenantId}`);
            
            const botSessionData = {
                ...qrCodeData,
                tenantId,
                createdAt: this.admin.firestore.FieldValue.serverTimestamp(),
                lastUpdated: this.admin.firestore.FieldValue.serverTimestamp()
            };

            await this.db.collection('tenants')
                .doc(tenantId)
                .collection('botSession')
                .doc('main')
                .set(botSessionData);

            console.log(`✅ Bot session saved for tenant: ${tenantId}`);
        } catch (error) {
            console.error('❌ Failed to save bot session:', error);
            throw error;
        }
    }

    async updateBotSessionStatus(tenantId, status) {
        try {
            await this.db.collection('tenants')
                .doc(tenantId)
                .collection('botSession')
                .doc('main')
                .update({
                    status,
                    lastUpdated: this.admin.firestore.FieldValue.serverTimestamp()
                });
        } catch (error) {
            console.error('❌ Failed to update bot session status:', error);
        }
    }

    errorHandler(error, req, res, next) {
        console.error('🚨 API Error:', error);
        
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
        });
    }

    async start() {
        try {
            await this.initialize();
            
            // Use environment variable for port with fallback
            const port = parseInt(process.env.API_PORT) || this.port;
            
            this.app.listen(port, () => {
                console.log(`✅ API Server started successfully on port ${port}`);
                console.log(`📋 Available endpoints:`);
                console.log(`   POST /auth/signup - Vendor registration`);
                console.log(`   GET  /tenant/:tenantId - Get tenant info`);
                console.log(`   GET  /tenant/:tenantId/qr - Get bot QR code`);
                console.log(`   GET  /health - Health check`);
            });
        } catch (error) {
            console.error(`❌ Failed to start API server on port ${this.port}:`, error);
            throw error;
        }
    }

    async shutdown() {
        try {
            console.log('🛑 Shutting down API Server...');
            
            // Close all bot sessions
            for (const [tenantId, session] of this.botSessions) {
                try {
                    if (session.sock) {
                        await session.sock.logout();
                    }
                } catch (error) {
                    console.error(`Error closing bot session for tenant ${tenantId}:`, error);
                }
            }
            
            this.botSessions.clear();
            console.log('✅ API Server shutdown complete');
        } catch (error) {
            console.error('❌ Error during API Server shutdown:', error);
        }
    }
}

module.exports = APIServer;

// Start the server if this file is run directly
if (require.main === module) {
    const server = new APIServer();
    server.start().catch(error => {
        console.error('Failed to start server:', error);
        process.exit(1);
    });
}
