const crypto = require('crypto');

class DuplicateChecker {
    constructor() {
        this.processedMessages = new Map(); // messageHash -> processing info
        this.userMessages = new Map(); // userId -> recent message hashes
        this.businessMessages = new Map(); // businessId -> recent message hashes
        this.config = {
            // Time windows for duplicate detection
            exactDuplicateWindowMs: 30000, // 30 seconds for exact duplicates
            userDuplicateWindowMs: 60000, // 1 minute for user-specific duplicates
            businessDuplicateWindowMs: 300000, // 5 minutes for business-wide duplicates
            
            // Content similarity thresholds
            similarityThreshold: 0.8, // 80% similarity threshold
            minContentLength: 10, // minimum length to check similarity
            
            // Processing windows
            processingTimeoutMs: 10000, // 10 seconds max processing time
            
            // Storage limits
            maxProcessedMessages: 10000,
            maxUserMessages: 100,
            maxBusinessMessages: 1000
        };
        
        // Start cleanup
        this.startCleanup();
    }

    // Main duplicate check method
    checkDuplicate(messageData) {
        const messageHash = this.generateMessageHash(messageData);
        const userId = messageData.userId;
        const businessId = messageData.businessId;
        const timestamp = Date.now();

        // Check for exact duplicates (same message ID or hash)
        const exactDuplicate = this.checkExactDuplicate(messageData, messageHash, timestamp);
        if (exactDuplicate.isDuplicate) {
            return exactDuplicate;
        }

        // Check for content duplicates within user's recent messages
        const userDuplicate = this.checkUserDuplicate(userId, messageData, timestamp);
        if (userDuplicate.isDuplicate) {
            return userDuplicate;
        }

        // Check for similar content in business context
        const businessDuplicate = this.checkBusinessDuplicate(businessId, messageData, timestamp);
        if (businessDuplicate.isDuplicate) {
            return businessDuplicate;
        }

        // Message is unique - record it
        this.recordMessage(messageHash, userId, businessId, messageData, timestamp);

        return {
            isDuplicate: false,
            type: 'unique',
            hash: messageHash,
            confidence: 1.0
        };
    }

    // Check for exact duplicates (same message ID or identical content)
    checkExactDuplicate(messageData, messageHash, timestamp) {
        const msgId = messageData.msgId;
        
        // Check by message ID first (most reliable)
        if (msgId) {
            const existingByMsgId = Array.from(this.processedMessages.values())
                .find(msg => msg.originalMsgId === msgId);
            
            if (existingByMsgId) {
                return {
                    isDuplicate: true,
                    type: 'exact_message_id',
                    originalTimestamp: existingByMsgId.timestamp,
                    timeDiff: timestamp - existingByMsgId.timestamp,
                    confidence: 1.0,
                    reason: 'Same message ID already processed'
                };
            }
        }

        // Check by content hash
        const existingMessage = this.processedMessages.get(messageHash);
        if (existingMessage) {
            const timeDiff = timestamp - existingMessage.timestamp;
            
            // If within exact duplicate window, it's a duplicate
            if (timeDiff < this.config.exactDuplicateWindowMs) {
                return {
                    isDuplicate: true,
                    type: 'exact_content',
                    originalTimestamp: existingMessage.timestamp,
                    timeDiff,
                    confidence: 1.0,
                    reason: 'Identical content within time window'
                };
            }
        }

        return { isDuplicate: false };
    }

    // Check for duplicates within user's recent messages
    checkUserDuplicate(userId, messageData, timestamp) {
        const userHistory = this.userMessages.get(userId);
        if (!userHistory || userHistory.length === 0) {
            return { isDuplicate: false };
        }

        const text = messageData.text || '';
        const windowStart = timestamp - this.config.userDuplicateWindowMs;

        // Check recent messages from this user
        for (const entry of userHistory) {
            if (entry.timestamp < windowStart) continue;

            // Check exact text match
            if (entry.text === text && text.length > 0) {
                return {
                    isDuplicate: true,
                    type: 'user_exact_text',
                    originalTimestamp: entry.timestamp,
                    timeDiff: timestamp - entry.timestamp,
                    confidence: 1.0,
                    reason: 'User sent identical text recently'
                };
            }

            // Check content similarity for longer messages
            if (text.length >= this.config.minContentLength && entry.text.length >= this.config.minContentLength) {
                const similarity = this.calculateSimilarity(text, entry.text);
                
                if (similarity >= this.config.similarityThreshold) {
                    return {
                        isDuplicate: true,
                        type: 'user_similar_content',
                        originalTimestamp: entry.timestamp,
                        timeDiff: timestamp - entry.timestamp,
                        confidence: similarity,
                        reason: `Similar content (${Math.round(similarity * 100)}% match)`
                    };
                }
            }
        }

        return { isDuplicate: false };
    }

    // Check for duplicates within business context
    checkBusinessDuplicate(businessId, messageData, timestamp) {
        const businessHistory = this.businessMessages.get(businessId);
        if (!businessHistory || businessHistory.length === 0) {
            return { isDuplicate: false };
        }

        const text = messageData.text || '';
        const userId = messageData.userId;
        const windowStart = timestamp - this.config.businessDuplicateWindowMs;

        // Look for potential spam or coordinated messaging
        let identicalCount = 0;
        let similarCount = 0;

        for (const entry of businessHistory) {
            if (entry.timestamp < windowStart) continue;
            
            // Skip messages from the same user (handled in user duplicate check)
            if (entry.userId === userId) continue;

            // Count identical messages from different users
            if (entry.text === text && text.length > 0) {
                identicalCount++;
            }

            // Count similar messages for longer content
            if (text.length >= this.config.minContentLength && entry.text.length >= this.config.minContentLength) {
                const similarity = this.calculateSimilarity(text, entry.text);
                if (similarity >= this.config.similarityThreshold) {
                    similarCount++;
                }
            }
        }

        // Flag as duplicate if too many similar messages from different users
        if (identicalCount >= 3) {
            return {
                isDuplicate: true,
                type: 'business_spam_identical',
                confidence: 0.9,
                count: identicalCount,
                reason: `${identicalCount} identical messages from different users`
            };
        }

        if (similarCount >= 5) {
            return {
                isDuplicate: true,
                type: 'business_spam_similar',
                confidence: 0.8,
                count: similarCount,
                reason: `${similarCount} similar messages from different users`
            };
        }

        return { isDuplicate: false };
    }

    // Record a processed message
    recordMessage(messageHash, userId, businessId, messageData, timestamp) {
        const text = messageData.text || '';
        
        // Record in main processed messages
        this.processedMessages.set(messageHash, {
            timestamp,
            userId,
            businessId,
            originalMsgId: messageData.msgId,
            textLength: text.length,
            isProcessing: false
        });

        // Record in user history
        this.recordUserMessage(userId, text, timestamp);

        // Record in business history
        this.recordBusinessMessage(businessId, userId, text, timestamp);

        // Cleanup if we're storing too many messages
        this.enforceStorageLimits();
    }

    // Record message in user history
    recordUserMessage(userId, text, timestamp) {
        let userHistory = this.userMessages.get(userId) || [];
        
        userHistory.push({
            timestamp,
            text,
            hash: this.hashText(text)
        });

        // Keep only recent messages (limit storage)
        if (userHistory.length > this.config.maxUserMessages) {
            userHistory = userHistory.slice(-this.config.maxUserMessages);
        }

        this.userMessages.set(userId, userHistory);
    }

    // Record message in business history
    recordBusinessMessage(businessId, userId, text, timestamp) {
        let businessHistory = this.businessMessages.get(businessId) || [];
        
        businessHistory.push({
            timestamp,
            userId,
            text,
            hash: this.hashText(text)
        });

        // Keep only recent messages (limit storage)
        if (businessHistory.length > this.config.maxBusinessMessages) {
            businessHistory = businessHistory.slice(-this.config.maxBusinessMessages);
        }

        this.businessMessages.set(businessId, businessHistory);
    }

    // Generate unique hash for message
    generateMessageHash(messageData) {
        const content = [
            messageData.userId || '',
            messageData.businessId || '',
            messageData.text || '',
            messageData.msgTime || Date.now()
        ].join('|');

        return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
    }

    // Generate hash for text content only
    hashText(text) {
        if (!text) return '';
        return crypto.createHash('md5').update(text.toLowerCase().trim()).digest('hex').substring(0, 8);
    }

    // Calculate text similarity using Levenshtein distance
    calculateSimilarity(text1, text2) {
        if (!text1 || !text2) return 0;
        
        const str1 = text1.toLowerCase().trim();
        const str2 = text2.toLowerCase().trim();
        
        if (str1 === str2) return 1.0;
        
        const maxLength = Math.max(str1.length, str2.length);
        if (maxLength === 0) return 1.0;
        
        const distance = this.levenshteinDistance(str1, str2);
        return (maxLength - distance) / maxLength;
    }

    // Levenshtein distance algorithm
    levenshteinDistance(str1, str2) {
        const matrix = [];
        
        // Initialize matrix
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        // Fill matrix
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1, // substitution
                        matrix[i][j - 1] + 1,     // insertion
                        matrix[i - 1][j] + 1      // deletion
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    }

    // Mark message as currently being processed
    markAsProcessing(messageHash) {
        const message = this.processedMessages.get(messageHash);
        if (message) {
            message.isProcessing = true;
            message.processingStarted = Date.now();
        }
    }

    // Mark message processing as complete
    markProcessingComplete(messageHash) {
        const message = this.processedMessages.get(messageHash);
        if (message) {
            message.isProcessing = false;
            message.processingCompleted = Date.now();
        }
    }

    // Check if message is currently being processed
    isCurrentlyProcessing(messageHash) {
        const message = this.processedMessages.get(messageHash);
        if (!message || !message.isProcessing) return false;
        
        // Check for processing timeout
        const now = Date.now();
        if (now - message.processingStarted > this.config.processingTimeoutMs) {
            message.isProcessing = false;
            console.log(`⏰ Processing timeout for message: ${messageHash}`);
            return false;
        }
        
        return true;
    }

    // Cleanup expired data
    cleanup() {
        const now = Date.now();
        
        // Clean processed messages
        const expiredHashes = [];
        this.processedMessages.forEach((message, hash) => {
            const age = now - message.timestamp;
            if (age > this.config.businessDuplicateWindowMs * 2) {
                expiredHashes.push(hash);
            }
        });
        
        expiredHashes.forEach(hash => {
            this.processedMessages.delete(hash);
        });

        // Clean user message histories
        this.userMessages.forEach((history, userId) => {
            const validMessages = history.filter(msg => 
                now - msg.timestamp < this.config.userDuplicateWindowMs * 2
            );
            
            if (validMessages.length === 0) {
                this.userMessages.delete(userId);
            } else {
                this.userMessages.set(userId, validMessages);
            }
        });

        // Clean business message histories
        this.businessMessages.forEach((history, businessId) => {
            const validMessages = history.filter(msg => 
                now - msg.timestamp < this.config.businessDuplicateWindowMs * 2
            );
            
            if (validMessages.length === 0) {
                this.businessMessages.delete(businessId);
            } else {
                this.businessMessages.set(businessId, validMessages);
            }
        });

        if (expiredHashes.length > 0) {
            console.log(`🧹 Cleaned ${expiredHashes.length} expired message records`);
        }
    }

    // Enforce storage limits to prevent memory issues
    enforceStorageLimits() {
        // Limit processed messages
        if (this.processedMessages.size > this.config.maxProcessedMessages) {
            const entries = Array.from(this.processedMessages.entries());
            entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
            
            const toDelete = entries.slice(0, entries.length - this.config.maxProcessedMessages);
            toDelete.forEach(([hash]) => {
                this.processedMessages.delete(hash);
            });
            
            console.log(`🧹 Enforced storage limit: removed ${toDelete.length} old messages`);
        }
    }

    // Start cleanup interval
    startCleanup() {
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 5 * 60 * 1000); // Every 5 minutes
        
        console.log('🧹 Duplicate checker cleanup started');
    }

    // Stop cleanup interval
    stopCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
            console.log('🛑 Duplicate checker cleanup stopped');
        }
    }

    // Get statistics
    getStats() {
        const now = Date.now();
        
        // Count recent activity
        const recentWindow = 60000; // 1 minute
        const recentMessages = Array.from(this.processedMessages.values())
            .filter(msg => now - msg.timestamp < recentWindow);
        
        const userStats = new Map();
        const businessStats = new Map();
        
        recentMessages.forEach(msg => {
            userStats.set(msg.userId, (userStats.get(msg.userId) || 0) + 1);
            businessStats.set(msg.businessId, (businessStats.get(msg.businessId) || 0) + 1);
        });

        return {
            totalProcessedMessages: this.processedMessages.size,
            activeUsers: this.userMessages.size,
            activeBusinesses: this.businessMessages.size,
            recentMessages: recentMessages.length,
            topUsers: Array.from(userStats.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5),
            topBusinesses: Array.from(businessStats.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3),
            memoryUsage: {
                processedMessages: this.processedMessages.size,
                userHistories: Array.from(this.userMessages.values())
                    .reduce((sum, history) => sum + history.length, 0),
                businessHistories: Array.from(this.businessMessages.values())
                    .reduce((sum, history) => sum + history.length, 0)
            }
        };
    }

    // Advanced duplicate detection methods
    detectSpamPatterns(userId, timeWindow = 300000) { // 5 minutes
        const userHistory = this.userMessages.get(userId);
        if (!userHistory) return { isSpam: false };

        const now = Date.now();
        const recentMessages = userHistory.filter(msg => 
            now - msg.timestamp < timeWindow
        );

        if (recentMessages.length < 3) return { isSpam: false };

        // Check for identical messages
        const textCounts = new Map();
        recentMessages.forEach(msg => {
            const count = textCounts.get(msg.text) || 0;
            textCounts.set(msg.text, count + 1);
        });

        const maxRepeats = Math.max(...textCounts.values());
        if (maxRepeats >= 3) {
            return {
                isSpam: true,
                type: 'identical_repeats',
                count: maxRepeats,
                confidence: 0.9
            };
        }

        // Check for rapid-fire short messages
        const shortMessages = recentMessages.filter(msg => msg.text.length < 10);
        if (shortMessages.length >= 5) {
            return {
                isSpam: true,
                type: 'rapid_short_messages',
                count: shortMessages.length,
                confidence: 0.8
            };
        }

        // Check for pattern variations (e.g., "hello", "hello!", "hello?")
        const baseTexts = recentMessages.map(msg => 
            msg.text.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
        );
        const uniqueBases = new Set(baseTexts);
        
        if (baseTexts.length >= 4 && uniqueBases.size <= 2) {
            return {
                isSpam: true,
                type: 'pattern_variations',
                variations: baseTexts.length,
                unique: uniqueBases.size,
                confidence: 0.7
            };
        }

        return { isSpam: false };
    }

    // Check for coordinated spam across multiple users
    detectCoordinatedSpam(businessId, timeWindow = 600000) { // 10 minutes
        const businessHistory = this.businessMessages.get(businessId);
        if (!businessHistory) return { isCoordinated: false };

        const now = Date.now();
        const recentMessages = businessHistory.filter(msg => 
            now - msg.timestamp < timeWindow
        );

        if (recentMessages.length < 5) return { isCoordinated: false };

        // Group messages by content similarity
        const groups = [];
        recentMessages.forEach(msg => {
            let addedToGroup = false;
            
            for (const group of groups) {
                const similarity = this.calculateSimilarity(msg.text, group[0].text);
                if (similarity >= 0.7) {
                    group.push(msg);
                    addedToGroup = true;
                    break;
                }
            }
            
            if (!addedToGroup) {
                groups.push([msg]);
            }
        });

        // Check for suspicious patterns
        for (const group of groups) {
            if (group.length >= 3) {
                const uniqueUsers = new Set(group.map(msg => msg.userId));
                
                // Multiple users sending similar content
                if (uniqueUsers.size >= 2 && uniqueUsers.size === group.length) {
                    return {
                        isCoordinated: true,
                        type: 'multiple_users_similar_content',
                        userCount: uniqueUsers.size,
                        messageCount: group.length,
                        confidence: 0.8,
                        sampleText: group[0].text.substring(0, 50)
                    };
                }
            }
        }

        return { isCoordinated: false };
    }

    // Manual controls
    clearUserHistory(userId) {
        this.userMessages.delete(userId);
        
        // Remove user's messages from processed messages
        const toDelete = [];
        this.processedMessages.forEach((message, hash) => {
            if (message.userId === userId) {
                toDelete.push(hash);
            }
        });
        
        toDelete.forEach(hash => {
            this.processedMessages.delete(hash);
        });
        
        console.log(`🗑️ Cleared duplicate history for user: ${userId}`);
        return toDelete.length;
    }

    clearBusinessHistory(businessId) {
        this.businessMessages.delete(businessId);
        
        // Remove business messages from processed messages
        const toDelete = [];
        this.processedMessages.forEach((message, hash) => {
            if (message.businessId === businessId) {
                toDelete.push(hash);
            }
        });
        
        toDelete.forEach(hash => {
            this.processedMessages.delete(hash);
        });
        
        console.log(`🗑️ Cleared duplicate history for business: ${businessId}`);
        return toDelete.length;
    }

    // Check if message should be processed (not duplicate and not currently processing)
    shouldProcessMessage(messageData) {
        const duplicateCheck = this.checkDuplicate(messageData);
        
        if (duplicateCheck.isDuplicate) {
            console.log(`🚫 Duplicate detected: ${duplicateCheck.type} - ${duplicateCheck.reason}`);
            return {
                shouldProcess: false,
                reason: duplicateCheck
            };
        }

        const isProcessing = this.isCurrentlyProcessing(duplicateCheck.hash);
        if (isProcessing) {
            console.log(`⏳ Message currently being processed: ${duplicateCheck.hash}`);
            return {
                shouldProcess: false,
                reason: {
                    isDuplicate: true,
                    type: 'currently_processing',
                    reason: 'Message is currently being processed'
                }
            };
        }

        // Mark as processing
        this.markAsProcessing(duplicateCheck.hash);
        
        return {
            shouldProcess: true,
            hash: duplicateCheck.hash
        };
    }

    // Complete message processing
    completeProcessing(hash) {
        this.markProcessingComplete(hash);
    }

    // Get duplicate analysis for a specific message
    analyzeMessage(messageData) {
        const duplicateCheck = this.checkDuplicate(messageData);
        const spamCheck = this.detectSpamPatterns(messageData.userId);
        const coordinatedCheck = this.detectCoordinatedSpam(messageData.businessId);
        
        return {
            duplicate: duplicateCheck,
            spam: spamCheck,
            coordinated: coordinatedCheck,
            recommendations: this.getRecommendations(duplicateCheck, spamCheck, coordinatedCheck)
        };
    }

    // Get recommendations based on analysis
    getRecommendations(duplicate, spam, coordinated) {
        const recommendations = [];
        
        if (duplicate.isDuplicate) {
            recommendations.push({
                action: 'block',
                reason: `Duplicate message: ${duplicate.reason}`,
                priority: 'high'
            });
        }
        
        if (spam.isSpam) {
            recommendations.push({
                action: 'rate_limit',
                reason: `Spam pattern detected: ${spam.type}`,
                priority: 'medium'
            });
        }
        
        if (coordinated.isCoordinated) {
            recommendations.push({
                action: 'investigate',
                reason: `Coordinated activity: ${coordinated.type}`,
                priority: 'high'
            });
        }
        
        return recommendations;
    }

    // Graceful shutdown
    shutdown() {
        console.log('🛑 Duplicate checker shutting down...');
        
        this.stopCleanup();
        
        const stats = this.getStats();
        console.log(`📊 Final stats: ${JSON.stringify(stats, null, 2)}`);
        
        // Clear all data
        this.processedMessages.clear();
        this.userMessages.clear();
        this.businessMessages.clear();
        
        console.log('✅ Duplicate checker shutdown complete');
    }
}

module.exports = new DuplicateChecker();