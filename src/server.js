// Last modified: 2025-01-27
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const pino = require('pino');
const { initializeFirebase, getDatabase, getFirebaseAdmin } = require('./config/database');
const { COLLECTIONS } = require('./config/constants');
const QRCode = require('qrcode');
const { makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

class APIServer {
    constructor() {
        this.app = express();
        this.port = process.env.API_PORT || 3001;
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

            // Middleware
            this.app.use(helmet());
            this.app.use(cors());
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
