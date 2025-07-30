const { SESSION_CONFIG } = require('../config/constants');

class SessionManager {
    constructor() {
        this.sessions = new Map();
        this.sessionStats = {
            created: 0,
            expired: 0,
            deleted: 0,
            messagesProcessed: 0
        };
        this.cleanupInterval = null;
        this.startCleanupInterval();
    }

    // Session lifecycle management
    setSession(sessionKey, session) {
        if (!sessionKey || !session) {
            console.error('❌ Invalid session key or session object');
            return false;
        }

        this.sessions.set(sessionKey, session);
        this.sessionStats.created++;
        
        console.log(`✅ Session created: ${sessionKey} (Total: ${this.sessions.size})`);
        return true;
    }

    getSession(sessionKey) {
        if (!sessionKey) {
            console.error('❌ Invalid session key');
            return null;
        }

        const session = this.sessions.get(sessionKey);
        
        if (session) {
            // Check if session is expired
            if (session.isExpired()) {
                console.log(`⏰ Session expired: ${sessionKey}`);
                this.deleteSession(sessionKey);
                return null;
            }
            
            // Update last activity
            session.updateLastActivity();
            this.sessionStats.messagesProcessed++;
        }

        return session;
    }

    deleteSession(sessionKey) {
        if (!sessionKey) {
            console.error('❌ Invalid session key');
            return false;
        }

        const deleted = this.sessions.delete(sessionKey);
        if (deleted) {
            this.sessionStats.deleted++;
            console.log(`🗑️ Session deleted: ${sessionKey} (Total: ${this.sessions.size})`);
        }
        
        return deleted;
    }

    hasSession(sessionKey) {
        return this.sessions.has(sessionKey);
    }

    // Session validation and cleanup
    isSessionValid(sessionKey) {
        const session = this.sessions.get(sessionKey);
        return session && !session.isExpired();
    }

    cleanupExpiredSessions() {
        const expiredSessions = [];
        const now = Date.now();
        
        this.sessions.forEach((session, key) => {
            if (session.isExpired()) {
                expiredSessions.push(key);
            }
        });
        
        expiredSessions.forEach(key => {
            this.sessions.delete(key);
            this.sessionStats.expired++;
        });
        
        if (expiredSessions.length > 0) {
            console.log(`🧹 Cleaned up ${expiredSessions.length} expired sessions (Total: ${this.sessions.size})`);
        }
        
        return expiredSessions.length;
    }

    startCleanupInterval() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredSessions();
        }, SESSION_CONFIG.CLEANUP_INTERVAL);
        
        console.log('🕒 Session cleanup interval started');
    }

    stopCleanupInterval() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
            console.log('⏹️ Session cleanup interval stopped');
        }
    }

    // Session statistics and monitoring
    getActiveSessionCount() {
        return this.sessions.size;
    }

    getSessionStats() {
        return {
            ...this.sessionStats,
            activeSessions: this.sessions.size,
            uptime: Date.now() - (this.sessionStats.startTime || Date.now())
        };
    }

    getProcessedMessageCount() {
        return this.sessionStats.messagesProcessed;
    }

    // Session querying
    getAllSessionKeys() {
        return Array.from(this.sessions.keys());
    }

    getSessionsByBusinessId(businessId) {
        const businessSessions = [];
        this.sessions.forEach((session, key) => {
            if (session.businessId === businessId) {
                businessSessions.push({ key, session });
            }
        });
        return businessSessions;
    }

    getSessionsByUserId(userId) {
        const userSessions = [];
        this.sessions.forEach((session, key) => {
            if (session.userId === userId) {
                userSessions.push({ key, session });
            }
        });
        return userSessions;
    }

    getExpiredSessions() {
        const expiredSessions = [];
        this.sessions.forEach((session, key) => {
            if (session.isExpired()) {
                expiredSessions.push({ key, session });
            }
        });
        return expiredSessions;
    }

    getIdleSessions(idleThreshold = SESSION_CONFIG.EXPIRY_TIME) {
        const idleSessions = [];
        const now = Date.now();
        
        this.sessions.forEach((session, key) => {
            if (now - session.lastActivity > idleThreshold) {
                idleSessions.push({ key, session });
            }
        });
        return idleSessions;
    }

    // Advanced session management
    extendSession(sessionKey, additionalTime = SESSION_CONFIG.EXPIRY_TIME) {
        const session = this.sessions.get(sessionKey);
        if (session) {
            session.createdAt = Date.now() - (SESSION_CONFIG.EXPIRY_TIME - additionalTime);
            session.updateLastActivity();
            console.log(`⏰ Session extended: ${sessionKey}`);
            return true;
        }
        return false;
    }

    refreshSession(sessionKey) {
        const session = this.sessions.get(sessionKey);
        if (session) {
            session.updateLastActivity();
            return true;
        }
        return false;
    }

    transferSession(oldKey, newKey) {
        const session = this.sessions.get(oldKey);
        if (session) {
            this.sessions.set(newKey, session);
            this.sessions.delete(oldKey);
            console.log(`🔄 Session transferred: ${oldKey} → ${newKey}`);
            return true;
        }
        return false;
    }

    // Session data operations
    updateSessionData(sessionKey, updates) {
        const session = this.sessions.get(sessionKey);
        if (session) {
            Object.assign(session, updates);
            session.updateLastActivity();
            return true;
        }
        return false;
    }

    getSessionData(sessionKey, field = null) {
        const session = this.sessions.get(sessionKey);
        if (session) {
            return field ? session[field] : session;
        }
        return null;
    }

    // Bulk operations
    clearAllSessions() {
        const count = this.sessions.size;
        this.sessions.clear();
        this.sessionStats.deleted += count;
        console.log(`🧹 Cleared all sessions: ${count} sessions removed`);
        return count;
    }

    clearSessionsByBusinessId(businessId) {
        let cleared = 0;
        const keysToDelete = [];
        
        this.sessions.forEach((session, key) => {
            if (session.businessId === businessId) {
                keysToDelete.push(key);
            }
        });
        
        keysToDelete.forEach(key => {
            this.sessions.delete(key);
            cleared++;
        });
        
        this.sessionStats.deleted += cleared;
        console.log(`🧹 Cleared ${cleared} sessions for business: ${businessId}`);
        return cleared;
    }

    clearIdleSessions(idleThreshold = SESSION_CONFIG.EXPIRY_TIME) {
        const idleSessions = this.getIdleSessions(idleThreshold);
        idleSessions.forEach(({ key }) => {
            this.sessions.delete(key);
            this.sessionStats.deleted++;
        });
        
        if (idleSessions.length > 0) {
            console.log(`🧹 Cleared ${idleSessions.length} idle sessions`);
        }
        
        return idleSessions.length;
    }

    // Memory management
    getMemoryUsage() {
        const usage = process.memoryUsage();
        return {
            heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
            heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
            external: Math.round(usage.external / 1024 / 1024), // MB
            sessionCount: this.sessions.size,
            avgSessionSize: this.sessions.size > 0 ? Math.round(usage.heapUsed / this.sessions.size / 1024) : 0 // KB per session
        };
    }

    optimizeMemory() {
        const memoryUsage = this.getMemoryUsage();
        let optimized = 0;
        
        // Clear expired sessions first
        optimized += this.cleanupExpiredSessions();
        
        // If memory usage is high, clear idle sessions
        if (memoryUsage.heapUsed > 100) { // 100MB threshold
            optimized += this.clearIdleSessions(SESSION_CONFIG.EXPIRY_TIME / 2); // Clear sessions idle for 15 minutes
        }
        
        // Force garbage collection if available
        if (global.gc) {
            global.gc();
            console.log('♻️ Garbage collection triggered');
        }
        
        if (optimized > 0) {
            console.log(`🔧 Memory optimized: removed ${optimized} sessions`);
        }
        
        return optimized;
    }

    // Monitoring and reporting
    generateReport() {
        const now = Date.now();
        const stats = this.getSessionStats();
        const memUsage = this.getMemoryUsage();
        
        const activeSessions = [];
        const businessCounts = new Map();
        const stepCounts = new Map();
        
        this.sessions.forEach((session, key) => {
            activeSessions.push({
                key,
                userId: session.userId,
                businessId: session.businessId,
                step: session.step,
                cartItems: session.cart?.length || 0,
                ageMinutes: Math.round((now - session.createdAt) / 60000),
                idleMinutes: Math.round((now - session.lastActivity) / 60000)
            });
            
            // Count by business
            const count = businessCounts.get(session.businessId) || 0;
            businessCounts.set(session.businessId, count + 1);
            
            // Count by step
            const stepCount = stepCounts.get(session.step) || 0;
            stepCounts.set(session.step, stepCount + 1);
        });
        
        return {
            timestamp: new Date().toISOString(),
            stats,
            memory: memUsage,
            activeSessions: activeSessions.length,
            sessions: activeSessions,
            businessDistribution: Object.fromEntries(businessCounts),
            stepDistribution: Object.fromEntries(stepCounts),
            averageSessionAge: activeSessions.length > 0 ? 
                Math.round(activeSessions.reduce((sum, s) => sum + s.ageMinutes, 0) / activeSessions.length) : 0,
            averageIdleTime: activeSessions.length > 0 ? 
                Math.round(activeSessions.reduce((sum, s) => sum + s.idleMinutes, 0) / activeSessions.length) : 0
        };
    }

    logStats() {
        const report = this.generateReport();
        
        console.log('📊 SESSION MANAGER STATS 📊');
        console.log(`Active Sessions: ${report.activeSessions}`);
        console.log(`Total Created: ${report.stats.created}`);
        console.log(`Total Expired: ${report.stats.expired}`);
        console.log(`Messages Processed: ${report.stats.messagesProcessed}`);
        console.log(`Memory Usage: ${report.memory.heapUsed}MB`);
        console.log(`Avg Session Age: ${report.averageSessionAge} minutes`);
        console.log(`Business Distribution:`, report.businessDistribution);
        console.log(`Step Distribution:`, report.stepDistribution);
    }

    // Event hooks for monitoring
    onSessionCreated(callback) {
        this.sessionCreatedCallback = callback;
    }

    onSessionExpired(callback) {
        this.sessionExpiredCallback = callback;
    }

    onSessionDeleted(callback) {
        this.sessionDeletedCallback = callback;
    }

    // Validation helpers
    validateSessionKey(sessionKey) {
        if (!sessionKey || typeof sessionKey !== 'string') {
            return { valid: false, error: 'Session key must be a non-empty string' };
        }
        
        if (sessionKey.length > 100) {
            return { valid: false, error: 'Session key too long' };
        }
        
        if (!/^[a-zA-Z0-9_@.-]+$/.test(sessionKey)) {
            return { valid: false, error: 'Session key contains invalid characters' };
        }
        
        return { valid: true };
    }

    validateSession(session) {
        if (!session || typeof session !== 'object') {
            return { valid: false, error: 'Session must be an object' };
        }
        
        if (!session.userId || !session.businessId) {
            return { valid: false, error: 'Session missing required fields (userId, businessId)' };
        }
        
        if (typeof session.createdAt !== 'number' || session.createdAt <= 0) {
            return { valid: false, error: 'Session has invalid createdAt timestamp' };
        }
        
        return { valid: true };
    }

    // Emergency operations
    emergencyCleanup() {
        console.log('🚨 EMERGENCY CLEANUP INITIATED 🚨');
        
        const beforeCount = this.sessions.size;
        const beforeMemory = this.getMemoryUsage().heapUsed;
        
        // Clear all expired sessions
        const expiredCleared = this.cleanupExpiredSessions();
        
        // Clear sessions older than 10 minutes
        const oldCleared = this.clearIdleSessions(10 * 60 * 1000);
        
        // Force garbage collection
        if (global.gc) {
            global.gc();
        }
        
        const afterCount = this.sessions.size;
        const afterMemory = this.getMemoryUsage().heapUsed;
        
        console.log(`🧹 Emergency cleanup complete:`);
        console.log(`   Sessions: ${beforeCount} → ${afterCount} (-${beforeCount - afterCount})`);
        console.log(`   Memory: ${beforeMemory}MB → ${afterMemory}MB (-${beforeMemory - afterMemory}MB)`);
        console.log(`   Expired cleared: ${expiredCleared}`);
        console.log(`   Old cleared: ${oldCleared}`);
        
        return {
            sessionsBefore: beforeCount,
            sessionsAfter: afterCount,
            memoryBefore: beforeMemory,
            memoryAfter: afterMemory,
            expiredCleared,
            oldCleared
        };
    }

    // Graceful shutdown
    shutdown() {
        console.log('🛑 Session Manager shutting down...');
        
        // Stop cleanup interval
        this.stopCleanupInterval();
        
        // Log final stats
        this.logStats();
        
        // Clear all sessions
        const clearedCount = this.clearAllSessions();
        
        console.log(`✅ Session Manager shutdown complete. Cleared ${clearedCount} sessions.`);
        
        return clearedCount;
    }

    // Initialize session stats tracking
    initialize() {
        this.sessionStats.startTime = Date.now();
        console.log('✅ Session Manager initialized');
    }
}

module.exports = new SessionManager();