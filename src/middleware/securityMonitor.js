const logger = require('./logger');
const helpers = require('../utils/helpers');

class SecurityMonitor {
    constructor() {
        this.threats = new Map(); // userId -> threat info
        this.ipAddresses = new Map(); // userId -> IP tracking
        this.patterns = new Map(); // Suspicious pattern tracking
        this.blockedUsers = new Set(); // Temporarily blocked users
        this.whitelist = new Set(); // Trusted users
        
        this.config = {
            // Threat detection thresholds
            maxMessagesPerMinute: 30,
            maxIdenticalMessages: 5,
            maxCommandsPerMinute: 10,
            
            // Content analysis
            maxMessageLength: 1000,
            suspiciousKeywords: [
                'hack', 'exploit', 'vulnerability', 'bypass',
                'injection', 'script', 'malware', 'virus'
            ],
            
            // Behavioral patterns
            rapidFireThreshold: 10, // messages in 30 seconds
            commandFloodThreshold: 5, // commands in 10 seconds
            
            // Time windows
            shortWindow: 30000, // 30 seconds
            mediumWindow: 300000, // 5 minutes
            longWindow: 3600000, // 1 hour
            
            // Block durations
            minBlockDuration: 60000, // 1 minute
            maxBlockDuration: 3600000, // 1 hour
            
            // Security levels
            alertThreshold: 3, // number of violations before alert
            blockThreshold: 5, // number of violations before block
        };
        
        this.stats = {
            threatsDetected: 0,
            usersBlocked: 0,
            messagesBlocked: 0,
            alertsSent: 0,
            startTime: Date.now()
        };
        
        this.initialize();
    }

    initialize() {
        // Start monitoring intervals
        this.startThreatCleanup();
        logger.info('🔒 Security Monitor initialized');
    }

    // Main security check method
    checkSecurity(messageData) {
        const userId = messageData.userId;
        const now = Date.now();
        
        // Skip whitelisted users
        if (this.whitelist.has(userId)) {
            return { allowed: true, reason: 'whitelisted' };
        }
        
        // Check if user is currently blocked
        if (this.blockedUsers.has(userId)) {
            this.stats.messagesBlocked++;
            return {
                allowed: false,
                reason: 'user_blocked',
                severity: 'high'
            };
        }
        
        const checks = {
            rateLimit: this.checkRateLimit(userId, now),
            contentAnalysis: this.analyzeContent(messageData),
            behaviorAnalysis: this.analyzeBehavior(userId, messageData, now),
            patternDetection: this.detectSuspiciousPatterns(userId, messageData, now)
        };
        
        // Evaluate overall threat level
        const threat = this.evaluateThreatLevel(userId, checks, now);
        
        // Take action based on threat level
        return this.handleThreat(userId, threat, messageData);
    }

    // Rate limiting check
    checkRateLimit(userId, timestamp) {
        const userThreat = this.threats.get(userId) || this.createUserThreat(userId);
        
        // Clean old messages
        userThreat.messages = userThreat.messages.filter(msg => 
            timestamp - msg.timestamp < this.config.mediumWindow
        );
        
        // Add current message
        userThreat.messages.push({ timestamp });
        
        // Check rate limits
        const recentMessages = userThreat.messages.filter(msg => 
            timestamp - msg.timestamp < 60000 // Last minute
        );
        
        const rapidMessages = userThreat.messages.filter(msg => 
            timestamp - msg.timestamp < this.config.shortWindow
        );
        
        if (recentMessages.length > this.config.maxMessagesPerMinute) {
            return {
                violation: true,
                type: 'rate_limit_exceeded',
                severity: 'medium',
                details: `${recentMessages.length} messages in last minute`
            };
        }
        
        if (rapidMessages.length > this.config.rapidFireThreshold) {
            return {
                violation: true,
                type: 'rapid_fire_messaging',
                severity: 'high',
                details: `${rapidMessages.length} messages in 30 seconds`
            };
        }
        
        return { violation: false };
    }

    // Content analysis for suspicious patterns
    analyzeContent(messageData) {
        const text = (messageData.text || '').toLowerCase();
        const violations = [];
        
        // Check message length
        if (text.length > this.config.maxMessageLength) {
            violations.push({
                type: 'message_too_long',
                severity: 'low',
                details: `Message length: ${text.length} chars`
            });
        }
        
        // Check for suspicious keywords
        const foundKeywords = this.config.suspiciousKeywords.filter(keyword => 
            text.includes(keyword)
        );
        
        if (foundKeywords.length > 0) {
            violations.push({
                type: 'suspicious_keywords',
                severity: 'medium',
                details: `Keywords found: ${foundKeywords.join(', ')}`
            });
        }
        
        // Check for potential injection attempts
        const injectionPatterns = [
            /[<>]/g, // HTML/XML tags
            /javascript:/gi,
            /eval\s*\(/gi,
            /script\s*>/gi,
            /on\w+\s*=/gi // Event handlers
        ];
        
        for (const pattern of injectionPatterns) {
            if (pattern.test(text)) {
                violations.push({
                    type: 'potential_injection',
                    severity: 'high',
                    details: `Pattern matched: ${pattern.source}`
                });
                break;
            }
        }
        
        // Check for unusual character patterns
        const nonPrintableCount = (text.match(/[\x00-\x1F\x7F-\x9F]/g) || []).length;
        if (nonPrintableCount > 5) {
            violations.push({
                type: 'unusual_characters',
                severity: 'medium',
                details: `Non-printable characters: ${nonPrintableCount}`
            });
        }
        
        return {
            violation: violations.length > 0,
            violations,
            riskScore: this.calculateContentRisk(violations)
        };
    }

    // Behavioral pattern analysis
    analyzeBehavior(userId, messageData, timestamp) {
        const userThreat = this.threats.get(userId) || this.createUserThreat(userId);
        const text = messageData.text || '';
        
        // Track message content for pattern detection
        userThreat.contentHistory = userThreat.contentHistory || [];
        userThreat.contentHistory.push({
            text,
            timestamp,
            length: text.length
        });
        
        // Keep only recent history
        userThreat.contentHistory = userThreat.contentHistory.filter(entry => 
            timestamp - entry.timestamp < this.config.longWindow
        );
        
        const violations = [];
        
        // Check for identical message flooding
        const identicalCount = userThreat.contentHistory.filter(entry => 
            entry.text === text && timestamp - entry.timestamp < this.config.mediumWindow
        ).length;
        
        if (identicalCount > this.config.maxIdenticalMessages) {
            violations.push({
                type: 'message_flooding',
                severity: 'high',
                details: `${identicalCount} identical messages`
            });
        }
        
        // Check for command flooding
        const isCommand = this.isCommand(text);
        if (isCommand) {
            userThreat.commands = userThreat.commands || [];
            userThreat.commands.push(timestamp);
            
            const recentCommands = userThreat.commands.filter(cmd => 
                timestamp - cmd < this.config.shortWindow
            );
            
            if (recentCommands.length > this.config.commandFloodThreshold) {
                violations.push({
                    type: 'command_flooding',
                    severity: 'medium',
                    details: `${recentCommands.length} commands in 30 seconds`
                });
            }
        }
        
        // Check for unusual timing patterns
        if (userThreat.contentHistory.length >= 5) {
            const intervals = [];
            for (let i = 1; i < userThreat.contentHistory.length; i++) {
                const interval = userThreat.contentHistory[i].timestamp - userThreat.contentHistory[i-1].timestamp;
                intervals.push(interval);
            }
            
            // Check for bot-like consistent timing
            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
            
            if (variance < 1000 && avgInterval < 5000) { // Very consistent timing under 5 seconds
                violations.push({
                    type: 'bot_like_timing',
                    severity: 'medium',
                    details: `Consistent ${avgInterval}ms intervals`
                });
            }
        }
        
        return {
            violation: violations.length > 0,
            violations,
            riskScore: this.calculateBehaviorRisk(violations)
        };
    }

    // Detect suspicious patterns across multiple users
    detectSuspiciousPatterns(userId, messageData, timestamp) {
        const text = messageData.text || '';
        const businessId = messageData.businessId;
        const violations = [];
        
        // Track patterns by business
        const patternKey = `${businessId}_${this.hashText(text)}`;
        const pattern = this.patterns.get(patternKey) || {
            text,
            users: new Set(),
            timestamps: [],
            businessId
        };
        
        pattern.users.add(userId);
        pattern.timestamps.push(timestamp);
        
        // Clean old timestamps
        pattern.timestamps = pattern.timestamps.filter(ts => 
            timestamp - ts < this.config.longWindow
        );
        
        this.patterns.set(patternKey, pattern);
        
        // Check for coordinated activity
        if (pattern.users.size >= 3 && pattern.timestamps.length >= 5) {
            const recentCount = pattern.timestamps.filter(ts => 
                timestamp - ts < this.config.mediumWindow
            ).length;
            
            if (recentCount >= 3) {
                violations.push({
                    type: 'coordinated_activity',
                    severity: 'high',
                    details: `${pattern.users.size} users, ${recentCount} recent messages`
                });
            }
        }
        
        return {
            violation: violations.length > 0,
            violations,
            riskScore: this.calculatePatternRisk(violations)
        };
    }

    // Evaluate overall threat level
    evaluateThreatLevel(userId, checks, timestamp) {
        let totalRisk = 0;
        const violations = [];
        
        // Combine all violations
        Object.values(checks).forEach(check => {
            if (check.violation) {
                if (check.violations) {
                    violations.push(...check.violations);
                } else {
                    violations.push(check);
                }
                totalRisk += check.riskScore || 1;
            }
        });
        
        // Update user threat record
        const userThreat = this.threats.get(userId) || this.createUserThreat(userId);
        userThreat.violations.push(...violations);
        userThreat.lastActivity = timestamp;
        userThreat.riskScore = Math.min(totalRisk + (userThreat.riskScore * 0.8), 100); // Decay previous risk
        
        // Determine threat level
        let level = 'low';
        if (totalRisk >= 10) level = 'critical';
        else if (totalRisk >= 7) level = 'high';
        else if (totalRisk >= 4) level = 'medium';
        
        return {
            level,
            riskScore: totalRisk,
            violations,
            userRiskScore: userThreat.riskScore
        };
    }

    // Handle threats based on level
    handleThreat(userId, threat, messageData) {
        const userThreat = this.threats.get(userId);
        
        if (threat.level === 'low' || threat.violations.length === 0) {
            return { allowed: true, threat };
        }
        
        // Count recent violations
        const recentViolations = userThreat.violations.filter(v => 
            Date.now() - v.timestamp < this.config.mediumWindow
        ).length;
        
        // Log security event
        logger.logSecurity(`Threat detected: ${threat.level}`, threat.level, {
            userId,
            businessId: messageData.businessId,
            violations: threat.violations.map(v => v.type),
            riskScore: threat.riskScore
        });
        
        this.stats.threatsDetected++;
        
        // Take action based on threat level and violation count
        if (threat.level === 'critical' || recentViolations >= this.config.blockThreshold) {
            return this.blockUser(userId, threat, 'automatic_block');
        }
        
        if (threat.level === 'high' || recentViolations >= this.config.alertThreshold) {
            this.sendAlert(userId, threat, messageData);
        }
        
        // Allow message but flag it
        return {
            allowed: true,
            flagged: true,
            threat,
            reason: `Flagged: ${threat.level} threat level`
        };
    }

    // Block user temporarily
    blockUser(userId, threat, reason) {
        const duration = Math.min(
            this.config.minBlockDuration * Math.pow(2, threat.riskScore / 10),
            this.config.maxBlockDuration
        );
        
        this.blockedUsers.add(userId);
        
        // Auto-unblock after duration
        setTimeout(() => {
            this.blockedUsers.delete(userId);
            logger.info(`User automatically unblocked: ${userId}`);
        }, duration);
        
        logger.logSecurity(`User blocked: ${reason}`, 'high', {
            userId,
            duration: Math.round(duration / 1000),
            threat: threat.level,
            riskScore: threat.riskScore
        });
        
        this.stats.usersBlocked++;
        this.stats.messagesBlocked++;
        
        return {
            allowed: false,
            blocked: true,
            reason: 'security_threat_detected',
            threat,
            blockDuration: duration
        };
    }

    // Send security alert
    sendAlert(userId, threat, messageData) {
        logger.logSecurity(`Security alert: ${threat.level} threat`, threat.level, {
            userId,
            businessId: messageData.businessId,
            messageText: messageData.text?.substring(0, 100),
            violations: threat.violations,
            riskScore: threat.riskScore
        });
        
        this.stats.alertsSent++;
        
        // Here you could integrate with external alerting systems
        // e.g., send email, Slack notification, etc.
    }

    // Utility methods
    createUserThreat(userId) {
        const userThreat = {
            userId,
            createdAt: Date.now(),
            lastActivity: Date.now(),
            violations: [],
            messages: [],
            riskScore: 0
        };
        
        this.threats.set(userId, userThreat);
        return userThreat;
    }

    isCommand(text) {
        const commands = [
            'start', 'menu', 'help', 'cart', 'checkout', 'confirm',
            'register', 'catalog', 'quick', 'discount'
        ];
        
        const firstWord = text.toLowerCase().trim().split(' ')[0];
        return commands.includes(firstWord) || /^[1-9]$/.test(firstWord);
    }

    hashText(text) {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString();
    }

    calculateContentRisk(violations) {
        return violations.reduce((risk, violation) => {
            const severityWeights = { low: 1, medium: 3, high: 5 };
            return risk + (severityWeights[violation.severity] || 1);
        }, 0);
    }

    calculateBehaviorRisk(violations) {
        return violations.reduce((risk, violation) => {
            const severityWeights = { low: 2, medium: 4, high: 6 };
            return risk + (severityWeights[violation.severity] || 2);
        }, 0);
    }

    calculatePatternRisk(violations) {
        return violations.reduce((risk, violation) => {
            const severityWeights = { low: 1, medium: 2, high: 4 };
            return risk + (severityWeights[violation.severity] || 1);
        }, 0);
    }

    // Cleanup expired data
    cleanupThreats() {
        const now = Date.now();
        const expiredUsers = [];
        
        this.threats.forEach((threat, userId) => {
            // Remove old violations
            threat.violations = threat.violations.filter(v => 
                now - (v.timestamp || threat.lastActivity) < this.config.longWindow
            );
            
            // Remove old messages
            if (threat.messages) {
                threat.messages = threat.messages.filter(msg => 
                    now - msg.timestamp < this.config.longWindow
                );
            }
            
            // Decay risk score over time
            const timeSinceActivity = now - threat.lastActivity;
            if (timeSinceActivity > this.config.mediumWindow) {
                threat.riskScore = Math.max(0, threat.riskScore * 0.9);
            }
            
            // Remove inactive threats
            if (timeSinceActivity > this.config.longWindow && threat.riskScore < 1) {
                expiredUsers.push(userId);
            }
        });
        
        expiredUsers.forEach(userId => {
            this.threats.delete(userId);
        });
        
        // Cleanup patterns
        const expiredPatterns = [];
        this.patterns.forEach((pattern, key) => {
            pattern.timestamps = pattern.timestamps.filter(ts => 
                now - ts < this.config.longWindow
            );
            
            if (pattern.timestamps.length === 0) {
                expiredPatterns.push(key);
            }
        });
        
        expiredPatterns.forEach(key => {
            this.patterns.delete(key);
        });
    }

    startThreatCleanup() {
        this.cleanupInterval = setInterval(() => {
            this.cleanupThreats();
        }, 5 * 60 * 1000); // Every 5 minutes
    }

    stopThreatCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }

    // Manual controls
    whitelistUser(userId) {
        this.whitelist.add(userId);
        this.blockedUsers.delete(userId);
        this.threats.delete(userId);
        logger.info(`User whitelisted: ${userId}`);
    }

    unwhitelistUser(userId) {
        this.whitelist.delete(userId);
        logger.info(`User removed from whitelist: ${userId}`);
    }

    manualBlock(userId, reason = 'manual', duration = this.config.minBlockDuration) {
        this.blockedUsers.add(userId);
        
        setTimeout(() => {
            this.blockedUsers.delete(userId);
            logger.info(`Manually blocked user unblocked: ${userId}`);
        }, duration);
        
        logger.logSecurity(`User manually blocked: ${reason}`, 'high', { userId, duration });
    }

    unblockUser(userId) {
        const wasBlocked = this.blockedUsers.delete(userId);
        if (wasBlocked) {
            logger.info(`User manually unblocked: ${userId}`);
        }
        return wasBlocked;
    }

    // Statistics and reporting
    getStats() {
        return {
            ...this.stats,
            activeThreats: this.threats.size,
            blockedUsers: this.blockedUsers.size,
            whitelistedUsers: this.whitelist.size,
            suspiciousPatterns: this.patterns.size,
            uptime: Date.now() - this.stats.startTime
        };
    }

    getThreatReport() {
        const report = {
            timestamp: new Date().toISOString(),
            stats: this.getStats(),
            topThreats: [],
            recentBlocks: [],
            patterns: []
        };
        
        // Top threats by risk score
        const threats = Array.from(this.threats.entries())
            .sort((a, b) => b[1].riskScore - a[1].riskScore)
            .slice(0, 10);
        
        report.topThreats = threats.map(([userId, threat]) => ({
            userId,
            riskScore: threat.riskScore,
            violationCount: threat.violations.length,
            lastActivity: new Date(threat.lastActivity).toISOString()
        }));
        
        // Recent blocks
        report.recentBlocks = Array.from(this.blockedUsers).map(userId => ({
            userId,
            blockedAt: new Date().toISOString() // This is approximate
        }));
        
        // Suspicious patterns
        const patterns = Array.from(this.patterns.entries())
            .filter(([key, pattern]) => pattern.users.size >= 2)
            .slice(0, 5);
        
        report.patterns = patterns.map(([key, pattern]) => ({
            text: pattern.text.substring(0, 50),
            userCount: pattern.users.size,
            messageCount: pattern.timestamps.length,
            businessId: pattern.businessId
        }));
        
        return report;
    }

    // Graceful shutdown
    shutdown() {
        logger.info('🛑 Security Monitor shutting down...');
        
        this.stopThreatCleanup();
        
        const stats = this.getStats();
        logger.info(`📊 Security stats: ${JSON.stringify(stats)}`);
        
        // Clear all data
        this.threats.clear();
        this.patterns.clear();
        this.blockedUsers.clear();
        this.whitelist.clear();
        
        logger.info('✅ Security Monitor shutdown complete');
    }
}

module.exports = new SecurityMonitor();