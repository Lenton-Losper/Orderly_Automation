const { RATE_LIMIT_CONFIG } = require('../config/constants');

class Helpers {
    // Date and time utilities
    formatTimestamp(timestamp) {
        return new Date(timestamp).toLocaleString('en-NA', {
            timeZone: 'Africa/Windhoek',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    getCurrentTimestamp() {
        return new Date().toISOString();
    }

    getLocalTime() {
        return new Date().toLocaleString('en-NA', {
            timeZone: 'Africa/Windhoek'
        });
    }

    getTimeAgo(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
        if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        return `${seconds} second${seconds > 1 ? 's' : ''} ago`;
    }

    isToday(timestamp) {
        const date = new Date(timestamp);
        const today = new Date();
        return date.toDateString() === today.toDateString();
    }

    isThisWeek(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return date >= weekAgo;
    }

    // String utilities
    capitalizeFirst(str) {
        if (!str || typeof str !== 'string') return '';
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }

    capitalizeWords(str) {
        if (!str || typeof str !== 'string') return '';
        return str.split(' ')
                  .map(word => this.capitalizeFirst(word))
                  .join(' ');
    }

    truncateText(text, maxLength = 50, suffix = '...') {
        if (!text || typeof text !== 'string') return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - suffix.length) + suffix;
    }

    removeEmojis(text) {
        if (!text || typeof text !== 'string') return '';
        return text.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
    }

    sanitizeForLog(text) {
        if (!text || typeof text !== 'string') return '';
        return text.replace(/[^\w\s@.-]/g, '')
                  .trim()
                  .substring(0, 100);
    }

    // Number utilities
    formatCurrency(amount, currency = 'N$') {
        if (typeof amount !== 'number') return `${currency}0.00`;
        return `${currency}${amount.toFixed(2)}`;
    }

    formatNumber(num) {
        if (typeof num !== 'number') return '0';
        return num.toLocaleString();
    }

    parseNumber(str) {
        if (typeof str === 'number') return str;
        if (typeof str !== 'string') return 0;
        const parsed = parseFloat(str.replace(/[^0-9.-]/g, ''));
        return isNaN(parsed) ? 0 : parsed;
    }

    roundToTwo(num) {
        return Math.round((num + Number.EPSILON) * 100) / 100;
    }

    // Array utilities
    chunk(array, size) {
        if (!Array.isArray(array) || size <= 0) return [];
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    shuffle(array) {
        if (!Array.isArray(array)) return [];
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    removeDuplicates(array, key = null) {
        if (!Array.isArray(array)) return [];
        if (key) {
            const seen = new Set();
            return array.filter(item => {
                const keyValue = item[key];
                if (seen.has(keyValue)) return false;
                seen.add(keyValue);
                return true;
            });
        }
        return [...new Set(array)];
    }

    // Object utilities
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => this.deepClone(item));
        if (typeof obj === 'object') {
            const cloned = {};
            Object.keys(obj).forEach(key => {
                cloned[key] = this.deepClone(obj[key]);
            });
            return cloned;
        }
    }

    isEmpty(obj) {
        if (obj == null) return true;
        if (Array.isArray(obj) || typeof obj === 'string') return obj.length === 0;
        if (typeof obj === 'object') return Object.keys(obj).length === 0;
        return false;
    }

    pick(obj, keys) {
        if (!obj || typeof obj !== 'object') return {};
        const picked = {};
        keys.forEach(key => {
            if (key in obj) picked[key] = obj[key];
        });
        return picked;
    }

    omit(obj, keys) {
        if (!obj || typeof obj !== 'object') return {};
        const omitted = { ...obj };
        keys.forEach(key => delete omitted[key]);
        return omitted;
    }

    // Rate limiting utilities
    createRateLimiter(maxRequests = 10, windowMs = 60000) {
        const requests = new Map();
        
        return (identifier) => {
            const now = Date.now();
            const windowStart = now - windowMs;
            
            // Clean old requests
            requests.forEach((timestamps, id) => {
                const validTimestamps = timestamps.filter(t => t > windowStart);
                if (validTimestamps.length === 0) {
                    requests.delete(id);
                } else {
                    requests.set(id, validTimestamps);
                }
            });
            
            // Check current identifier
            const userRequests = requests.get(identifier) || [];
            if (userRequests.length >= maxRequests) {
                return { allowed: false, resetTime: userRequests[0] + windowMs };
            }
            
            // Add current request
            userRequests.push(now);
            requests.set(identifier, userRequests);
            
            return { allowed: true, remaining: maxRequests - userRequests.length };
        };
    }

    // Delay utilities
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await fn();
            } catch (error) {
                if (i === maxRetries - 1) throw error;
                
                const delay = baseDelay * Math.pow(2, i);
                console.log(`⏳ Retry ${i + 1}/${maxRetries} in ${delay}ms...`);
                await this.delay(delay);
            }
        }
    }

    // Validation utilities
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    isValidPhone(phone) {
        const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
        return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 8;
    }

    isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    // Memory monitoring
    getMemoryUsage() {
        const usage = process.memoryUsage();
        return {
            heapUsed: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100, // MB
            heapTotal: Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100, // MB
            external: Math.round(usage.external / 1024 / 1024 * 100) / 100, // MB
            rss: Math.round(usage.rss / 1024 / 1024 * 100) / 100 // MB
        };
    }

    isMemoryHigh(threshold = RATE_LIMIT_CONFIG.MAX_MEMORY_USAGE) {
        const usage = process.memoryUsage();
        return usage.heapUsed > threshold;
    }

    // Error handling utilities
    safeExecute(fn, fallback = null) {
        try {
            return fn();
        } catch (error) {
            console.error('❌ Safe execute error:', error.message);
            return fallback;
        }
    }

    async safeExecuteAsync(fn, fallback = null) {
        try {
            return await fn();
        } catch (error) {
            console.error('❌ Safe execute async error:', error.message);
            return fallback;
        }
    }

    logError(error, context = '') {
        const timestamp = this.getCurrentTimestamp();
        const memory = this.getMemoryUsage();
        
        console.error(`❌ ERROR [${timestamp}] ${context}`);
        console.error(`   Message: ${error.message}`);
        console.error(`   Stack: ${error.stack}`);
        console.error(`   Memory: ${memory.heapUsed}MB`);
    }

    // Environment utilities
    isDevelopment() {
        return process.env.NODE_ENV === 'development';
    }

    isProduction() {
        return process.env.NODE_ENV === 'production';
    }

    getEnvironment() {
        return process.env.NODE_ENV || 'development';
    }

    // Performance monitoring
    createTimer() {
        const start = process.hrtime.bigint();
        return {
            end: () => {
                const end = process.hrtime.bigint();
                return Number(end - start) / 1000000; // Convert to milliseconds
            }
        };
    }

    benchmark(fn, iterations = 1000) {
        const timer = this.createTimer();
        for (let i = 0; i < iterations; i++) {
            fn();
        }
        const totalTime = timer.end();
        return {
            totalTime,
            averageTime: totalTime / iterations,
            iterations
        };
    }

    // Cleanup utilities
    gracefulShutdown(cleanupFunctions = []) {
        const shutdown = (signal) => {
            console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
            
            Promise.all(cleanupFunctions.map(fn => {
                try {
                    return Promise.resolve(fn());
                } catch (error) {
                    console.error('❌ Cleanup error:', error.message);
                    return Promise.resolve();
                }
            })).then(() => {
                console.log('✅ Graceful shutdown complete');
                process.exit(0);
            }).catch((error) => {
                console.error('❌ Shutdown error:', error.message);
                process.exit(1);
            });
        };
        
        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGQUIT', () => shutdown('SIGQUIT'));
    }

    // Random utilities
    generateId(length = 8) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    randomChoice(array) {
        if (!Array.isArray(array) || array.length === 0) return null;
        return array[Math.floor(Math.random() * array.length)];
    }

    randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
}

module.exports = new Helpers();