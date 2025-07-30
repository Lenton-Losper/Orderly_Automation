const { RATE_LIMIT_CONFIG } = require('../config/constants');
const helpers = require('../utils/helpers');

class RateLimiter {
    constructor() {
        this.userRequests = new Map(); // userId -> request history
        this.businessRequests = new Map(); // businessId -> request history
        this.globalRequests = []; // global request history
        this.blockedUsers = new Map(); // userId -> block info
        this.suspiciousActivity = new Map(); // userId -> suspicious patterns
        this.config = {
            // Per user limits
            userWindowMs: 60000, // 1 minute
            userMaxRequests: 20, // 20 messages per minute
            userBurstLimit: 5, // max 5 messages in 10 seconds
            userBurstWindowMs: 10000,
            
            // Per business limits
            businessWindowMs: 60000, // 1 minute
            businessMaxRequests: 100, // 100 messages per business per minute
            
            // Global limits
            globalWindowMs: 60000, // 1 minute
            globalMaxRequests: 500, // 500 total messages per minute
            
            // Blocking thresholds
            blockThreshold: 3, // violations before blocking
            blockDurationMs: 300000, // 5 minutes block
            
            // Suspicious activity thresholds
            rapidFireThreshold: 10, // 10 messages in 30 seconds
            rapidFireWindowMs: 30000,
            identicalMessageThreshold: 5, // 5 identical messages
            longMessageThreshold: 500, // messages over 500 chars
        };
        
        // Start cleanup interval
        this.startCleanup();
    }

    // Main rate limiting check
    checkRateLimit(userId, businessId, messageData = {}) {
        const now = Date.now();
        const checks = {
            user: this.checkUserRateLimit(userId, now, messageData),
            business: this.checkBusinessRateLimit(businessId, now),
            global: this.checkGlobalRateLimit(now),
            suspicious: this.checkSuspiciousActivity(userId, messageData, now)
        };

        // If any check fails, determine the most restrictive response
        if (!checks.user.allowed || !checks.business.allowed || !checks.global.allowed || !checks.suspicious.allowed) {
            return this.getRestrictiveResponse(checks, userId, businessId);
        }

        // All checks passed - record the request
        this.recordRequest(userId, businessId, messageData, now);
        
        return {
            allowed: true,
            reason: 'allowed',
            resetTime: null,
            remaining: Math.min(checks.user.remaining, checks.business.remaining, checks.global.remaining)
        };
    }

    // User-specific rate limiting
    checkUserRateLimit(userId, now, messageData) {
        // Check if user is blocked
        const blockInfo = this.blockedUsers.get(userId);
        if (blockInfo && now < blockInfo.expiresAt) {
            return {
                allowed: false,
                reason: 'user_blocked',
                resetTime: blockInfo.expiresAt,
                remaining: 0,
                violations: blockInfo.violations
            };
        }

        // Clean expired block
        if (blockInfo && now >= blockInfo.expiresAt) {
            this.blockedUsers.delete(userId);
        }

        const userHistory = this.userRequests.get(userId) || [];
        const windowStart = now - this.config.userWindowMs;
        const burstWindowStart = now - this.config.userBurstWindowMs;

        // Filter recent requests
        const recentRequests = userHistory.filter(req => req.timestamp > windowStart);
        const burstRequests = recentRequests.filter(req => req.timestamp > burstWindowStart);

        // Check main rate limit
        if (recentRequests.length >= this.config.userMaxRequests) {
            this.recordViolation(userId, 'rate_limit_exceeded');
            return {
                allowed: false,
                reason: 'user_rate_limit',
                resetTime: recentRequests[0].timestamp + this.config.userWindowMs,
                remaining: 0
            };
        }

        // Check burst limit
        if (burstRequests.length >= this.config.userBurstLimit) {
            this.recordViolation(userId, 'burst_limit_exceeded');
            return {
                allowed: false,
                reason: 'user_burst_limit',
                resetTime: burstRequests[0].timestamp + this.config.userBurstWindowMs,
                remaining: 0
            };
        }

        return {
            allowed: true,
            remaining: this.config.userMaxRequests - recentRequests.length,
            burstRemaining: this.config.userBurstLimit - burstRequests.length
        };
    }

    // Business-specific rate limiting
    checkBusinessRateLimit(businessId, now) {
        const businessHistory = this.businessRequests.get(businessId) || [];
        const windowStart = now - this.config.businessWindowMs;
        const recentRequests = businessHistory.filter(req => req.timestamp > windowStart);

        if (recentRequests.length >= this.config.businessMaxRequests) {
            return {
                allowed: false,
                reason: 'business_rate_limit',
                resetTime: recentRequests[0].timestamp + this.config.businessWindowMs,
                remaining: 0
            };
        }

        return {
            allowed: true,
            remaining: this.config.businessMaxRequests - recentRequests.length
        };
    }

    // Global rate limiting
    checkGlobalRateLimit(now) {
        const windowStart = now - this.config.globalWindowMs;
        const recentRequests = this.globalRequests.filter(req => req.timestamp > windowStart);

        if (recentRequests.length >= this.config.globalMaxRequests) {
            return {
                allowed: false,
                reason: 'global_rate_limit',
                resetTime: recentRequests[0].timestamp + this.config.globalWindowMs,
                remaining: 0
            };
        }

        return {
            allowed: true,
            remaining: this.config.globalMaxRequests - recentRequests.length
        };
    }

    // Suspicious activity detection
    checkSuspiciousActivity(userId, messageData, now) {
        const activity = this.suspiciousActivity.get(userId) || {
            rapidFire: [],
            identicalMessages: new Map(),
            longMessages: 0,
            violations: 0
        };

        const text = messageData.text || '';
        const rapidFireWindowStart = now - this.config.rapidFireWindowMs;

        // Check rapid fire messaging
        activity.rapidFire = activity.rapidFire.filter(timestamp => timestamp > rapidFireWindowStart);
        activity.rapidFire.push(now);

        if (activity.rapidFire.length > this.config.rapidFireThreshold) {
            this.recordViolation(userId, 'rapid_fire_messaging');
            return {
                allowed: false,
                reason: 'rapid_fire',
                resetTime: activity.rapidFire[0] + this.config.rapidFireWindowMs
            };
        }

        // Check identical messages
        if (text) {
            const messageHash = this.hashMessage(text);
            const identicalCount = activity.identicalMessages.get(messageHash) || 0;
            activity.identicalMessages.set(messageHash, identicalCount + 1);

            if (identicalCount >= this.config.identicalMessageThreshold) {
                this.recordViolation(userId, 'identical_messages');
                return {
                    allowed: false,
                    reason: 'identical_messages',
                    resetTime: now + this.config.userWindowMs
                };
            }
        }

        // Check message length (potential spam)
        if (text.length > this.config.longMessageThreshold) {
            activity.longMessages++;
            if (activity.longMessages > 3) {
                this.recordViolation(userId, 'long_messages');
                return {
                    allowed: false,
                    reason: 'suspicious_content',
                    resetTime: now + this.config.userWindowMs
                };
            }
        }

        // Update activity tracking
        this.suspiciousActivity.set(userId, activity);

        return { allowed: true };
    }

    // Record a successful request
    recordRequest(userId, businessId, messageData, timestamp) {
        const requestInfo = {
            timestamp,
            messageLength: messageData.text?.length || 0,
            messageHash: messageData.text ? this.hashMessage(messageData.text) : null
        };

        // Record user request
        const userHistory = this.userRequests.get(userId) || [];
        userHistory.push(requestInfo);
        this.userRequests.set(userId, userHistory);

        // Record business request
        const businessHistory = this.businessRequests.get(businessId) || [];
        businessHistory.push({ timestamp, userId });
        this.businessRequests.set(businessId, businessHistory);

        // Record global request
        this.globalRequests.push({ timestamp, userId, businessId });
    }

    // Record rate limit violation
    recordViolation(userId, violationType) {
        const violations = this.getViolations(userId);
        violations.push({
            type: violationType,
            timestamp: Date.now()
        });

        // Check if user should be blocked
        const recentViolations = violations.filter(v => 
            Date.now() - v.timestamp < this.config.userWindowMs
        );

        if (recentViolations.length >= this.config.blockThreshold) {
            this.blockUser(userId, recentViolations);
        }

        console.log(`⚠️ Rate limit violation: ${userId} - ${violationType}`);
    }

    // Block a user temporarily
    blockUser(userId, violations) {
        const blockInfo = {
            blockedAt: Date.now(),
            expiresAt: Date.now() + this.config.blockDurationMs,
            violations: violations.length,
            reason: violations.map(v => v.type).join(', ')
        };

        this.blockedUsers.set(userId, blockInfo);
        
        console.log(`🚫 User blocked: ${userId} for ${this.config.blockDurationMs/1000}s - Reason: ${blockInfo.reason}`);
    }

    // Get violation history for a user
    getViolations(userId) {
        const activity = this.suspiciousActivity.get(userId) || { violations: [] };
        if (!activity.violations) activity.violations = [];
        return activity.violations;
    }

    // Get the most restrictive response from multiple checks
    getRestrictiveResponse(checks, userId, businessId) {
        // Priority: blocked > rate limits > suspicious activity
        if (!checks.user.allowed && checks.user.reason === 'user_blocked') {
            return checks.user;
        }

        if (!checks.global.allowed) {
            return {
                ...checks.global,
                message: 'System temporarily busy. Please try again later.'
            };
        }

        if (!checks.business.allowed) {
            return {
                ...checks.business,
                message: 'Too many requests for this business. Please wait a moment.'
            };
        }

        if (!checks.user.allowed) {
            return {
                ...checks.user,
                message: this.getUserLimitMessage(checks.user.reason)
            };
        }

        if (!checks.suspicious.allowed) {
            return {
                ...checks.suspicious,
                message: 'Unusual activity detected. Please slow down.'
            };
        }

        return {
            allowed: false,
            reason: 'unknown',
            message: 'Request blocked. Please try again later.'
        };
    }

    // Get user-friendly message for rate limit
    getUserLimitMessage(reason) {
        const messages = {
            user_rate_limit: 'You\'re sending messages too quickly. Please wait a moment.',
            user_burst_limit: 'Please slow down and wait a few seconds before sending another message.',
            rapid_fire: 'Please take a moment between messages.',
            identical_messages: 'Please avoid sending the same message repeatedly.',
            suspicious_content: 'Message flagged for review. Please try a different message.'
        };
        
        return messages[reason] || 'Please wait before sending another message.';
    }

    // Utility methods
    hashMessage(text) {
        // Simple hash for identifying identical messages
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString();
    }

    // Cleanup expired data
    cleanup() {
        const now = Date.now();
        
        // Clean user requests
        this.userRequests.forEach((history, userId) => {
            const validRequests = history.filter(req => 
                now - req.timestamp < this.config.userWindowMs * 2
            );
            if (validRequests.length === 0) {
                this.userRequests.delete(userId);
            } else {
                this.userRequests.set(userId, validRequests);
            }
        });

        // Clean business requests
        this.businessRequests.forEach((history, businessId) => {
            const validRequests = history.filter(req => 
                now - req.timestamp < this.config.businessWindowMs * 2
            );
            if (validRequests.length === 0) {
                this.businessRequests.delete(businessId);
            } else {
                this.businessRequests.set(businessId, validRequests);
            }
        });

        // Clean global requests
        this.globalRequests = this.globalRequests.filter(req => 
            now - req.timestamp < this.config.globalWindowMs * 2
        );

        // Clean expired blocks
        this.blockedUsers.forEach((blockInfo, userId) => {
            if (now >= blockInfo.expiresAt) {
                this.blockedUsers.delete(userId);
                console.log(`✅ User unblocked: ${userId}`);
            }
        });

        // Clean suspicious activity
        this.suspiciousActivity.forEach((activity, userId) => {
            // Clean old rapid fire records
            if (activity.rapidFire) {
                activity.rapidFire = activity.rapidFire.filter(timestamp => 
                    now - timestamp < this.config.rapidFireWindowMs * 2
                );
            }
            
            // Clean old identical message records
            if (activity.identicalMessages) {
                const cutoff = now - this.config.userWindowMs * 2;
                activity.identicalMessages.clear(); // Reset periodically
            }
            
            // Reset long message counter periodically
            if (activity.longMessageReset && now - activity.longMessageReset > this.config.userWindowMs) {
                activity.longMessages = 0;
                activity.longMessageReset = now;
            } else if (!activity.longMessageReset) {
                activity.longMessageReset = now;
            }
        });
    }

    startCleanup() {
        // Run cleanup every 5 minutes
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 5 * 60 * 1000);
        
        console.log('🧹 Rate limiter cleanup started');
    }

    stopCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
            console.log('🛑 Rate limiter cleanup stopped');
        }
    }

    // Statistics and monitoring
    getStats() {
        const now = Date.now();
        
        return {
            activeUsers: this.userRequests.size,
            activeBusinesses: this.businessRequests.size,
            globalRequests: this.globalRequests.length,
            blockedUsers: this.blockedUsers.size,
            suspiciousUsers: this.suspiciousActivity.size,
            recentBlocks: Array.from(this.blockedUsers.entries()).filter(([_, info]) => 
                now - info.blockedAt < 60000 // blocks in last minute
            ).length
        };
    }

    // Manual controls
    unblockUser(userId) {
        const wasBlocked = this.blockedUsers.delete(userId);
        if (wasBlocked) {
            console.log(`✅ Manually unblocked user: ${userId}`);
        }
        return wasBlocked;
    }

    clearUserHistory(userId) {
        this.userRequests.delete(userId);
        this.suspiciousActivity.delete(userId);
        this.unblockUser(userId);
        console.log(`🗑️ Cleared history for user: ${userId}`);
    }

    // Emergency controls
    emergencyStop() {
        // Block all new requests temporarily
        this.emergencyMode = true;
        console.log('🚨 EMERGENCY MODE ACTIVATED - All requests blocked');
        
        // Auto-disable after 5 minutes
        setTimeout(() => {
            this.emergencyMode = false;
            console.log('✅ Emergency mode deactivated');
        }, 5 * 60 * 1000);
    }

    isEmergencyMode() {
        return this.emergencyMode || false;
    }

    // Graceful shutdown
    shutdown() {
        console.log('🛑 Rate limiter shutting down...');
        this.stopCleanup();
        
        const stats = this.getStats();
        console.log(`📊 Final stats: ${JSON.stringify(stats)}`);
        
        // Clear all data
        this.userRequests.clear();
        this.businessRequests.clear();
        this.globalRequests = [];
        this.blockedUsers.clear();
        this.suspiciousActivity.clear();
        
        console.log('✅ Rate limiter shutdown complete');
    }
}

module.exports = new RateLimiter();