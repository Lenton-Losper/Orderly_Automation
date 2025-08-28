// Required for WhatsApp Web compatibility
require('dotenv').config();
globalThis.crypto = require('crypto').webcrypto;

// Core imports
const { initializeFirebase } = require('./config/database');
const { OWNER_NUMBER } = require('./config/constants');

// Services
const businessManager = require('./services/businessManager');
// Import WhatsApp service correctly - it might be a default export or instance
const whatsappService = require('./services/whatsapp');

// Handlers and utilities
const MessageHandler = require('./handlers/messageHandler');
const sessionManager = require('./utils/sessionManager');

// Middleware - Import the instances, not classes
const rateLimiter = require('./middleware/rateLimiter');
const duplicateChecker = require('./middleware/duplicateChecker');  
const securityMonitor = require('./middleware/securityMonitor');
const logger = require('./middleware/logger');

class WhatsAppBot {
    constructor() {
        this.whatsappService = null;
        this.messageHandler = null;
        this.firebaseService = null;
        this.middleware = {
            rateLimiter: rateLimiter,
            duplicateChecker: duplicateChecker,
            securityMonitor: securityMonitor,
            logger: logger
        };
        this.isInitialized = false;
        this.startTime = Date.now();
        this.stats = {
            bot: {
                messagesProcessed: 0,
                sessionsCreated: 0,
                ordersCompleted: 0,
                errorsHandled: 0,
                uptime: 0,
                sessionsActive: 0,
                memoryUsage: {}
            },
            rateLimiter: {},
            security: {},
            duplicateChecker: {}
        };
    }

    async initialize() {
        try {
            console.log('🚀 WhatsApp Bot initializing...');

            // Step 1: Initialize Firebase database first
            await this.initializeDatabase();

            // Step 2: Initialize Firebase service (this must happen after database)
            await this.initializeFirebaseService();

            // Step 3: Initialize Business Manager (depends on Firebase service)
            await this.initializeBusinessManager();

            // Step 4: Initialize WhatsApp service
            await this.initializeWhatsApp();

            // Step 5: Initialize middleware (optional, many don't have initialize methods)
            await this.initializeMiddleware();

            // Step 6: Initialize session manager
            await this.initializeSessionManager();

            // Step 7: Set up message handling
            await this.setupMessageHandling();

            // Step 8: Set up monitoring
            await this.setupMonitoring();

            // Step 9: Set up graceful shutdown
            this.setupGracefulShutdown();

            this.isInitialized = true;
            console.log('✅ WhatsApp Bot successfully initialized');

            return true;
        } catch (error) {
            console.error('❌ Failed to initialize WhatsApp Bot:', error);
            throw new Error(`Bot initialization failed: ${error.message}`);
        }
    }

    async initializeDatabase() {
        try {
            console.log('🔌 Initializing Firebase database...');
            await initializeFirebase();
            console.log('✅ Firebase database connected');
        } catch (error) {
            console.error('❌ Database initialization failed:', error.message);
            throw new Error(`Database initialization failed: ${error.message}`);
        }
    }

    async initializeFirebaseService() {
        try {
            console.log('🔥 Initializing Firebase service...');
            
            // Import and initialize Firebase service AFTER database is ready
            this.firebaseService = require('./services/firebase');
            await this.firebaseService.initialize();
            
            console.log('✅ Firebase service initialized');
        } catch (error) {
            console.error('❌ Firebase service initialization failed:', error.message);
            // Don't throw error, just log it - Firebase service handles graceful degradation
            console.log('⚠️ Continuing without Firebase service - some features may be limited');
        }
    }

    async initializeBusinessManager() {
        try {
            console.log('🏢 Initializing Business Manager...');
            await businessManager.initialize();
            console.log('✅ Business Manager initialized');
        } catch (error) {
            console.error('❌ Business Manager initialization failed:', error.message);
            throw new Error(`Business Manager initialization failed: ${error.message}`);
        }
    }

    async initializeWhatsApp() {
        try {
            console.log('📱 Initializing WhatsApp service...');
            
            // Check if whatsappService is a class or an instance
            if (typeof whatsappService === 'function') {
                // It's a class, instantiate it
                this.whatsappService = new whatsappService();
            } else if (whatsappService && typeof whatsappService === 'object') {
                // It's already an instance
                this.whatsappService = whatsappService;
            } else {
                throw new Error('WhatsApp service import is not valid');
            }
            
            // Initialize the service
            if (typeof this.whatsappService.initialize === 'function') {
                await this.whatsappService.initialize();
            }
            
            console.log('✅ WhatsApp service initialized');
        } catch (error) {
            console.error('❌ WhatsApp service initialization failed:', error.message);
            throw new Error(`WhatsApp service initialization failed: ${error.message}`);
        }
    }

    async initializeMiddleware() {
        try {
            console.log('🛡️ Initializing middleware...');
            
            // Initialize middleware components if they have initialize methods
            if (this.middleware.rateLimiter && typeof this.middleware.rateLimiter.initialize === 'function') {
                await this.middleware.rateLimiter.initialize();
            }
            console.log('✅ Rate Limiter ready');

            if (this.middleware.duplicateChecker && typeof this.middleware.duplicateChecker.initialize === 'function') {
                await this.middleware.duplicateChecker.initialize();
            }
            console.log('✅ Duplicate Checker ready');

            if (this.middleware.securityMonitor && typeof this.middleware.securityMonitor.initialize === 'function') {
                await this.middleware.securityMonitor.initialize();
            }
            console.log('✅ Security Monitor ready');

            if (this.middleware.logger && typeof this.middleware.logger.initialize === 'function') {
                await this.middleware.logger.initialize();
            }
            console.log('✅ Logger ready');

        } catch (error) {
            console.error('❌ Middleware initialization failed:', error.message);
            // Don't throw error for middleware - continue without it
            console.log('⚠️ Continuing without some middleware - basic functionality will work');
        }
    }

    async initializeSessionManager() {
        try {
            console.log('🔧 Initializing Session Manager...');
            if (sessionManager && typeof sessionManager.initialize === 'function') {
                await sessionManager.initialize();
            }
            console.log('✅ Session Manager initialized');
        } catch (error) {
            console.error('❌ Session Manager initialization failed:', error.message);
            throw new Error(`Session Manager initialization failed: ${error.message}`);
        }
    }

    async setupMessageHandling() {
        try {
            console.log('📨 Setting up message handling...');
            
            this.messageHandler = new MessageHandler(this.whatsappService, this.middleware);
            
            // Set up WhatsApp message event handler
            if (this.whatsappService && typeof this.whatsappService.onMessage === 'function') {
                this.whatsappService.onMessage((messageData) => {
                    this.messageHandler.handleMessage(messageData);
                });
            }

            console.log('✅ Message handling configured');
        } catch (error) {
            console.error('❌ Message handling setup failed:', error.message);
            throw new Error(`Message handling setup failed: ${error.message}`);
        }
    }

    async setupMonitoring() {
        try {
            console.log('📊 Setting up monitoring...');
            
            // Start monitoring intervals
            this.startStatsCollection();
            this.startMemoryMonitoring();
            
            console.log('✅ Monitoring configured');
        } catch (error) {
            console.error('❌ Monitoring setup failed:', error.message);
            // Don't throw error for monitoring - continue without it
            console.log('⚠️ Continuing without monitoring - basic functionality will work');
        }
    }

    setupGracefulShutdown() {
        console.log('✅ Graceful shutdown configured');

        // Handle various shutdown signals
        process.on('SIGINT', () => this.shutdown('SIGINT'));
        process.on('SIGTERM', () => this.shutdown('SIGTERM'));
        process.on('uncaughtException', (error) => {
            console.error('💥 Uncaught Exception:', error);
            this.shutdown('uncaughtException');
        });
        process.on('unhandledRejection', (reason, promise) => {
            console.error('💥 Unhandled Rejection at:', promise, 'Reason:', reason);
            // Don't exit on unhandled rejection, just log it
        });
    }

    startStatsCollection() {
        // Collect and log statistics every 10 minutes
        setInterval(() => {
            this.collectStats();
            this.logStats();
        }, 600000); // 10 minutes
    }

    startMemoryMonitoring() {
        // Monitor memory usage every 5 minutes
        setInterval(() => {
            const memUsage = process.memoryUsage();
            const memUsageMB = {
                heapUsed: (memUsage.heapUsed / 1024 / 1024).toFixed(2),
                heapTotal: (memUsage.heapTotal / 1024 / 1024).toFixed(2),
                external: (memUsage.external / 1024 / 1024).toFixed(2),
                rss: (memUsage.rss / 1024 / 1024).toFixed(2)
            };

            // Log memory warning if usage is high
            if (memUsage.heapUsed > 200 * 1024 * 1024) { // 200MB
                console.log(`⚠️ High memory usage: ${memUsageMB.heapUsed}MB`);
                
                // Trigger cleanup if available
                if (sessionManager && typeof sessionManager.optimizeMemory === 'function') {
                    sessionManager.optimizeMemory();
                }
            }
        }, 300000); // 5 minutes
    }

    collectStats() {
        const now = Date.now();
        this.stats.bot.uptime = Math.floor((now - this.startTime) / 1000);
        this.stats.bot.sessionsActive = (sessionManager && typeof sessionManager.getActiveSessionCount === 'function') 
            ? sessionManager.getActiveSessionCount() : 0;
        
        const memUsage = process.memoryUsage();
        this.stats.bot.memoryUsage = {
            heapUsed: (memUsage.heapUsed / 1024 / 1024).toFixed(2),
            heapTotal: (memUsage.heapTotal / 1024 / 1024).toFixed(2),
            external: (memUsage.external / 1024 / 1024).toFixed(2),
            rss: (memUsage.rss / 1024 / 1024).toFixed(2)
        };

        // Collect middleware stats if available
        try {
            this.stats.rateLimiter = (this.middleware.rateLimiter && typeof this.middleware.rateLimiter.getStats === 'function') 
                ? this.middleware.rateLimiter.getStats() : {};
            this.stats.security = (this.middleware.securityMonitor && typeof this.middleware.securityMonitor.getStats === 'function') 
                ? this.middleware.securityMonitor.getStats() : {};
            this.stats.duplicateChecker = (this.middleware.duplicateChecker && typeof this.middleware.duplicateChecker.getStats === 'function') 
                ? this.middleware.duplicateChecker.getStats() : {};
        } catch (error) {
            // Ignore stats collection errors
        }
    }

    logStats() {
        console.log('\n📊 === BOT STATISTICS ===');
        console.log(`⏰ Uptime: ${Math.floor(this.stats.bot.uptime / 60)} minutes`);
        console.log(`📨 Messages Processed: ${this.stats.bot.messagesProcessed}`);
        console.log(`👥 Active Sessions: ${this.stats.bot.sessionsActive}`);
        console.log(`🛡️ Threats Detected: ${this.stats.security.threatsDetected || 0}`);
        console.log(`🚫 Messages Blocked: ${this.stats.security.messagesBlocked || 0}`);
        console.log(`💾 Memory Usage: ${this.stats.bot.memoryUsage.heapUsed}MB`);
        console.log('========================\n');
    }

    async shutdown(signal) {
        console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);

        try {
            // Log final statistics
            this.collectStats();
            this.logStats();

            // Shutdown components in reverse order
            console.log('🧹 Shutting down middleware...');

            // Shutdown middleware
            if (this.middleware.securityMonitor && typeof this.middleware.securityMonitor.shutdown === 'function') {
                await this.middleware.securityMonitor.shutdown();
            }
            if (this.middleware.duplicateChecker && typeof this.middleware.duplicateChecker.shutdown === 'function') {
                await this.middleware.duplicateChecker.shutdown();
            }
            if (this.middleware.rateLimiter && typeof this.middleware.rateLimiter.shutdown === 'function') {
                await this.middleware.rateLimiter.shutdown();
            }

            // Shutdown session manager
            console.log('🗑️ Shutting down session manager...');
            if (sessionManager && typeof sessionManager.shutdown === 'function') {
                await sessionManager.shutdown();
            }

            // Shutdown WhatsApp service
            console.log('📱 Shutting down WhatsApp service...');
            if (this.whatsappService && typeof this.whatsappService.shutdown === 'function') {
                await this.whatsappService.shutdown();
            }

            // Shutdown business manager
            console.log('🏢 Shutting down business manager...');
            if (businessManager && typeof businessManager.shutdown === 'function') {
                await businessManager.shutdown();
            }

            // Shutdown Firebase service
            console.log('🔥 Shutting down Firebase service...');
            if (this.firebaseService && typeof this.firebaseService.shutdown === 'function') {
                await this.firebaseService.shutdown();
            }

            // Shutdown logger last
            console.log('📝 Shutting down logger...');
            if (this.middleware.logger && typeof this.middleware.logger.shutdown === 'function') {
                await this.middleware.logger.shutdown();
            }

            console.log('✅ Bot shutdown completed successfully');
            
        } catch (error) {
            console.error('❌ Error during shutdown:', error);
        } finally {
            console.log('✅ Graceful shutdown complete');
            process.exit(0);
        }
    }

    // Health check method
    isHealthy() {
        return this.isInitialized && 
               this.whatsappService && 
               (typeof this.whatsappService.isConnected !== 'function' || this.whatsappService.isConnected()) && 
               this.firebaseService &&
               (typeof this.firebaseService.isServiceReady !== 'function' || this.firebaseService.isServiceReady()) &&
               businessManager &&
               (typeof businessManager.isHealthy !== 'function' || businessManager.isHealthy());
    }

    // Emergency stop
    emergencyStop() {
        console.log('🚨 EMERGENCY STOP TRIGGERED');
        if (this.middleware.rateLimiter && typeof this.middleware.rateLimiter.emergencyStop === 'function') {
            this.middleware.rateLimiter.emergencyStop();
        }
        if (this.middleware.securityMonitor && typeof this.middleware.securityMonitor.emergencyStop === 'function') {
            this.middleware.securityMonitor.emergencyStop();
        }
        if (sessionManager && typeof sessionManager.emergencyCleanup === 'function') {
            sessionManager.emergencyCleanup();
        }
    }
}

// Main bot startup function
async function startBot() {
    try {
        console.log('\n🎉 === WHATSAPP BOT STARTING ===');
        console.log('📱 Initializing all systems...\n');

        const bot = new WhatsAppBot();
        await bot.initialize();

        console.log('\n🎉 === WHATSAPP BOT STARTED SUCCESSFULLY ===');
        console.log('📱 Scan the QR code above to connect');
        console.log(`👑 Owner number: ${OWNER_NUMBER}`);
        console.log(`🕐 Started at: ${new Date().toLocaleString()}`);
        console.log('============================================\n');

        return bot;
    } catch (error) {
        console.error('💥 Critical error starting bot:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Start the bot
if (require.main === module) {
    startBot();
}

module.exports = { WhatsAppBot, startBot };