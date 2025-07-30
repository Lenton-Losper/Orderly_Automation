// Required for WhatsApp Web compatibility
require('dotenv').config();
globalThis.crypto = require('crypto').webcrypto;

// Core imports
const { initializeFirebase } = require('./config/database');
const { OWNER_NUMBER } = require('./config/constants');

// Services
const whatsappService = require('./services/whatsapp');
const businessManager = require('./services/businessManager');

// Handlers
const MessageHandler = require('./handlers/messageHandler');

// Utils
const sessionManager = require('./utils/sessionManager');
const helpers = require('./utils/helpers');

// Middleware
const rateLimiter = require('./middleware/rateLimiter');
const duplicateChecker = require('./middleware/duplicateChecker');
const logger = require('./middleware/logger');
const securityMonitor = require('./middleware/securityMonitor');

class WhatsAppBot {
    constructor() {
        this.isInitialized = false;
        this.isShuttingDown = false;
        this.messageHandler = null;
        this.startTime = Date.now();
        this.stats = {
            messagesProcessed: 0,
            sessionsCreated: 0,
            ordersCompleted: 0,
            errorsHandled: 0
        };
    }

    async initialize() {
        try {
            logger.info('🚀 WhatsApp Bot initializing...');
            
            // Initialize Firebase database
            await this.initializeDatabase();
            
            // Initialize business manager
            await this.initializeBusinessManager();
            
            // Initialize WhatsApp service
            await this.initializeWhatsApp();
            
            // Initialize middleware
            this.initializeMiddleware();
            
            // Initialize session manager
            this.initializeSessionManager();
            
            // Setup message handling
            this.setupMessageHandling();
            
            // Setup monitoring
            this.setupMonitoring();
            
            // Setup graceful shutdown
            this.setupGracefulShutdown();
            
            this.isInitialized = true;
            logger.info('✅ WhatsApp Bot successfully initialized');
            
            return true;
        } catch (error) {
            logger.error('❌ Failed to initialize WhatsApp Bot', { error: error.message, stack: error.stack });
            throw error;
        }
    }

    async initializeDatabase() {
        try {
            logger.info('🔌 Initializing Firebase database...');
            await initializeFirebase();
            logger.info('✅ Firebase database connected');
        } catch (error) {
            logger.error('❌ Database initialization failed', { error: error.message });
            throw new Error(`Database initialization failed: ${error.message}`);
        }
    }

    async initializeBusinessManager() {
        try {
            logger.info('🏢 Initializing Business Manager...');
            await businessManager.initialize();
            logger.info('✅ Business Manager initialized');
        } catch (error) {
            logger.error('❌ Business Manager initialization failed', { error: error.message });
            throw new Error(`Business Manager initialization failed: ${error.message}`);
        }
    }

    async initializeWhatsApp() {
        try {
            logger.info('📱 Initializing WhatsApp service...');
            await whatsappService.initialize();
            logger.info('✅ WhatsApp service initialized');
        } catch (error) {
            logger.error('❌ WhatsApp service initialization failed', { error: error.message });
            throw new Error(`WhatsApp service initialization failed: ${error.message}`);
        }
    }

    initializeMiddleware() {
        logger.info('🛡️ Initializing middleware...');
        
        // All middleware components are already initialized via their constructors
        // Just log their readiness
        logger.info('✅ Rate Limiter ready');
        logger.info('✅ Duplicate Checker ready');
        logger.info('✅ Security Monitor ready');
        logger.info('✅ Logger ready');
    }

    initializeSessionManager() {
        logger.info('🔧 Initializing Session Manager...');
        sessionManager.initialize();
        logger.info('✅ Session Manager initialized');
    }

    setupMessageHandling() {
        logger.info('📨 Setting up message handling...');
        
        this.messageHandler = new MessageHandler(whatsappService, businessManager);
        this.messageHandler.initialize();
        
        logger.info('✅ Message handling configured');
    }

    setupMonitoring() {
        logger.info('📊 Setting up monitoring...');
        
        // Log stats every 10 minutes
        this.statsInterval = setInterval(() => {
            this.logStats();
        }, 10 * 60 * 1000);
        
        // Memory monitoring every 5 minutes
        this.memoryInterval = setInterval(() => {
            this.checkMemoryUsage();
        }, 5 * 60 * 1000);
        
        logger.info('✅ Monitoring configured');
    }

    setupGracefulShutdown() {
        const cleanup = async () => {
            if (this.isShuttingDown) return;
            await this.shutdown();
        };
        
        // Handle graceful shutdown
        helpers.gracefulShutdown([cleanup]);
        
        logger.info('✅ Graceful shutdown configured');
    }

    // Main message processing pipeline
    async processMessage(messageData) {
        const timer = helpers.createTimer();
        let processingResult = null;
        
        try {
            // Step 1: Security check
            const securityCheck = securityMonitor.checkSecurity(messageData);
            if (!securityCheck.allowed) {
                logger.warn('🚫 Message blocked by security monitor', {
                    userId: messageData.userId,
                    reason: securityCheck.reason,
                    severity: securityCheck.severity
                });
                return { blocked: true, reason: securityCheck.reason };
            }
            
            // Step 2: Rate limiting
            const rateLimitCheck = rateLimiter.checkRateLimit(
                messageData.userId, 
                messageData.businessId, 
                messageData
            );
            if (!rateLimitCheck.allowed) {
                logger.warn('🚫 Message blocked by rate limiter', {
                    userId: messageData.userId,
                    reason: rateLimitCheck.reason
                });
                
                // Send rate limit message to user
                if (rateLimitCheck.message) {
                    await whatsappService.sendTextMessage(messageData.userId, rateLimitCheck.message);
                }
                return { blocked: true, reason: rateLimitCheck.reason };
            }
            
            // Step 3: Duplicate check
            const duplicateCheck = duplicateChecker.shouldProcessMessage(messageData);
            if (!duplicateCheck.shouldProcess) {
                logger.info('🚫 Duplicate message detected', {
                    userId: messageData.userId,
                    type: duplicateCheck.reason.type
                });
                return { blocked: true, reason: 'duplicate' };
            }
            
            // Step 4: Process the message (handled by MessageHandler)
            // Note: The actual processing is handled in MessageHandler.handleMessage
            // This method is called from the WhatsApp event handler
            
            this.stats.messagesProcessed++;
            
            // Mark duplicate processing as complete
            if (duplicateCheck.hash) {
                duplicateChecker.completeProcessing(duplicateCheck.hash);
            }
            
            const duration = timer.end();
            logger.logPerformance('message_processing', duration, {
                userId: messageData.userId,
                businessId: messageData.businessId
            });
            
            return { success: true, duration };
            
        } catch (error) {
            this.stats.errorsHandled++;
            logger.logError(error, 'Message processing error', {
                userId: messageData.userId,
                businessId: messageData.businessId
            });
            
            // Mark duplicate processing as complete even on error
            if (processingResult && processingResult.hash) {
                duplicateChecker.completeProcessing(processingResult.hash);
            }
            
            return { error: true, message: error.message };
        }
    }

    // Statistics and monitoring
    logStats() {
        const uptime = Date.now() - this.startTime;
        const botStats = {
            ...this.stats,
            uptime: Math.round(uptime / 1000),
            sessionsActive: sessionManager.getActiveSessionCount(),
            memoryUsage: helpers.getMemoryUsage()
        };
        
        const rateLimiterStats = rateLimiter.getStats();
        const securityStats = securityMonitor.getStats();
        const duplicateStats = duplicateChecker.getStats();
        
        logger.info('📊 Bot Statistics', {
            bot: botStats,
            rateLimiter: rateLimiterStats,
            security: securityStats,
            duplicateChecker: duplicateStats
        });
        
        // Log to console for visibility
        console.log('\n📊 === BOT STATISTICS ===');
        console.log(`⏰ Uptime: ${Math.round(uptime / 1000 / 60)} minutes`);
        console.log(`📨 Messages Processed: ${this.stats.messagesProcessed}`);
        console.log(`👥 Active Sessions: ${sessionManager.getActiveSessionCount()}`);
        console.log(`🛡️ Threats Detected: ${securityStats.threatsDetected}`);
        console.log(`🚫 Messages Blocked: ${rateLimiterStats.globalRequests || 0}`);
        console.log(`💾 Memory Usage: ${botStats.memoryUsage.heapUsed}MB`);
        console.log('========================\n');
    }

    checkMemoryUsage() {
        const memoryUsage = helpers.getMemoryUsage();
        
        if (memoryUsage.heapUsed > 500) { // 500MB threshold
            logger.warn('⚠️ High memory usage detected', { memoryUsage });
            
            // Trigger cleanup
            sessionManager.optimizeMemory();
            
            // Force garbage collection if available
            if (global.gc) {
                global.gc();
                logger.info('♻️ Garbage collection triggered');
            }
        }
        
        if (memoryUsage.heapUsed > 1000) { // 1GB critical threshold
            logger.error('🚨 Critical memory usage - initiating emergency cleanup', { memoryUsage });
            sessionManager.emergencyCleanup();
        }
    }

    // Health check endpoint (for monitoring systems)
    getHealthStatus() {
        return {
            status: this.isInitialized && !this.isShuttingDown ? 'healthy' : 'unhealthy',
            uptime: Date.now() - this.startTime,
            whatsappConnected: whatsappService.isConnected(),
            stats: this.stats,
            memory: helpers.getMemoryUsage(),
            timestamp: new Date().toISOString()
        };
    }

    // Manual controls
    async emergencyStop() {
        logger.error('🚨 EMERGENCY STOP INITIATED');
        
        // Stop processing new messages
        rateLimiter.emergencyStop();
        
        // Clear all sessions
        sessionManager.emergencyCleanup();
        
        logger.error('🛑 Emergency stop completed');
    }

    async restart() {
        logger.info('🔄 Bot restart initiated');
        
        try {
            await this.shutdown();
            await this.initialize();
            logger.info('✅ Bot restart completed');
        } catch (error) {
            logger.error('❌ Bot restart failed', { error: error.message });
            throw error;
        }
    }

    // Graceful shutdown
    async shutdown() {
        if (this.isShuttingDown) {
            logger.warn('⚠️ Shutdown already in progress');
            return;
        }
        
        this.isShuttingDown = true;
        logger.info('🛑 Bot shutdown initiated...');
        
        try {
            // Stop monitoring intervals
            if (this.statsInterval) {
                clearInterval(this.statsInterval);
                this.statsInterval = null;
            }
            
            if (this.memoryInterval) {
                clearInterval(this.memoryInterval);
                this.memoryInterval = null;
            }
            
            // Log final stats
            this.logStats();
            
            // Shutdown components in reverse order
            logger.info('🧹 Shutting down middleware...');
            securityMonitor.shutdown();
            duplicateChecker.shutdown();
            rateLimiter.shutdown();
            
            logger.info('🗑️ Shutting down session manager...');
            sessionManager.shutdown();
            
            logger.info('📱 Shutting down WhatsApp service...');
            whatsappService.cleanup();
            
            logger.info('📝 Shutting down logger...');
            logger.shutdown();
            
            console.log('✅ Bot shutdown completed successfully');
            
        } catch (error) {
            console.error('❌ Error during shutdown:', error.message);
        }
    }
}

// Create and start the bot
const bot = new WhatsAppBot();

async function startBot() {
    try {
        await bot.initialize();
        
        // Bot is now running
        console.log('\n🎉 === WHATSAPP BOT STARTED SUCCESSFULLY ===');
        console.log(`📱 Scan the QR code above to connect`);
        console.log(`👑 Owner number: ${OWNER_NUMBER}`);
        console.log(`🕐 Started at: ${new Date().toLocaleString()}`);
        console.log('============================================\n');
        
    } catch (error) {
        console.error('💥 Critical error starting bot:', error.message);
        console.error('Stack trace:', error.stack);
        
        // Attempt graceful shutdown even on startup failure
        try {
            await bot.shutdown();
        } catch (shutdownError) {
            console.error('❌ Additional error during emergency shutdown:', shutdownError.message);
        }
        
        process.exit(1);
    }
}

// Handle uncaught exceptions and rejections
process.on('uncaughtException', async (error) => {
    console.error('💥 Uncaught Exception:', error.message);
    console.error('Stack trace:', error.stack);
    
    try {
        await bot.shutdown();
    } catch (shutdownError) {
        console.error('❌ Error during emergency shutdown:', shutdownError.message);
    }
    
    process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise);
    console.error('Reason:', reason);
    
    try {
        await bot.shutdown();
    } catch (shutdownError) {
        console.error('❌ Error during emergency shutdown:', shutdownError.message);
    }
    
    process.exit(1);
});

// Export for testing or external use
module.exports = {
    WhatsAppBot,
    bot,
    startBot
};

// Start the bot if this file is run directly
if (require.main === module) {
    startBot().catch(error => {
        console.error('💥 Fatal error in main:', error.message);
        process.exit(1);
    });
}