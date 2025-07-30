const fs = require('fs');
const path = require('path');
const helpers = require('../utils/helpers');

class Logger {
    constructor() {
        this.logLevels = {
            ERROR: 0,
            WARN: 1,
            INFO: 2,
            DEBUG: 3,
            TRACE: 4
        };
        
        this.config = {
            level: process.env.LOG_LEVEL || 'INFO',
            enableFileLogging: process.env.ENABLE_FILE_LOGGING !== 'false',
            enableConsoleLogging: process.env.ENABLE_CONSOLE_LOGGING !== 'false',
            logDirectory: process.env.LOG_DIRECTORY || './logs',
            maxFileSize: parseInt(process.env.MAX_LOG_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
            maxFiles: parseInt(process.env.MAX_LOG_FILES) || 5,
            includeTimestamp: true,
            includeLevel: true,
            includeMemoryUsage: false,
            colorOutput: process.env.NODE_ENV !== 'production'
        };
        
        this.colors = {
            ERROR: '\x1b[31m', // Red
            WARN: '\x1b[33m',  // Yellow
            INFO: '\x1b[36m',  // Cyan
            DEBUG: '\x1b[35m', // Magenta
            TRACE: '\x1b[37m', // White
            RESET: '\x1b[0m'
        };
        
        this.logBuffer = [];
        this.bufferSize = 100;
        this.flushInterval = null;
        
        this.stats = {
            messagesLogged: 0,
            errorsLogged: 0,
            warningsLogged: 0,
            startTime: Date.now()
        };
        
        this.initialize();
    }

    initialize() {
        // Create log directory if it doesn't exist
        if (this.config.enableFileLogging) {
            this.ensureLogDirectory();
        }
        
        // Start buffer flush interval
        this.startBufferFlush();
        
        console.log('📝 Logger initialized');
    }

    ensureLogDirectory() {
        if (!fs.existsSync(this.config.logDirectory)) {
            fs.mkdirSync(this.config.logDirectory, { recursive: true });
            console.log(`📁 Created log directory: ${this.config.logDirectory}`);
        }
    }

    // Main logging method
    log(level, message, meta = {}) {
        const levelValue = this.logLevels[level];
        const currentLevelValue = this.logLevels[this.config.level];
        
        // Check if we should log this level
        if (levelValue > currentLevelValue) {
            return;
        }
        
        const logEntry = this.createLogEntry(level, message, meta);
        
        // Console logging
        if (this.config.enableConsoleLogging) {
            this.logToConsole(logEntry);
        }
        
        // File logging (buffered)
        if (this.config.enableFileLogging) {
            this.addToBuffer(logEntry);
        }
        
        // Update stats
        this.updateStats(level);
    }

    createLogEntry(level, message, meta) {
        const timestamp = new Date().toISOString();
        const entry = {
            timestamp,
            level,
            message,
            meta: this.sanitizeMeta(meta),
            pid: process.pid
        };
        
        // Add memory usage if enabled
        if (this.config.includeMemoryUsage) {
            entry.memory = helpers.getMemoryUsage();
        }
        
        return entry;
    }

    sanitizeMeta(meta) {
        if (!meta || typeof meta !== 'object') return {};
        
        const sanitized = {};
        Object.keys(meta).forEach(key => {
            const value = meta[key];
            
            // Sanitize sensitive information
            if (this.isSensitiveKey(key)) {
                sanitized[key] = '[REDACTED]';
            } else if (typeof value === 'string' && value.length > 1000) {
                // Truncate very long strings
                sanitized[key] = value.substring(0, 1000) + '... [TRUNCATED]';
            } else if (typeof value === 'object') {
                // Recursively sanitize objects
                sanitized[key] = this.sanitizeMeta(value);
            } else {
                sanitized[key] = value;
            }
        });
        
        return sanitized;
    }

    isSensitiveKey(key) {
        const sensitiveKeys = [
            'password', 'token', 'secret', 'key', 'auth',
            'credential', 'private', 'confidential'
        ];
        
        return sensitiveKeys.some(sensitive => 
            key.toLowerCase().includes(sensitive)
        );
    }

    logToConsole(entry) {
        let output = '';
        
        // Add timestamp
        if (this.config.includeTimestamp) {
            output += `[${entry.timestamp}] `;
        }
        
        // Add level with color
        if (this.config.includeLevel) {
            if (this.config.colorOutput) {
                output += `${this.colors[entry.level]}${entry.level}${this.colors.RESET} `;
            } else {
                output += `${entry.level} `;
            }
        }
        
        // Add message
        output += entry.message;
        
        // Add meta if present
        if (Object.keys(entry.meta).length > 0) {
            output += ` ${JSON.stringify(entry.meta)}`;
        }
        
        console.log(output);
    }

    addToBuffer(entry) {
        this.logBuffer.push(entry);
        
        // Flush if buffer is full
        if (this.logBuffer.length >= this.bufferSize) {
            this.flushBuffer();
        }
    }

    flushBuffer() {
        if (this.logBuffer.length === 0) return;
        
        try {
            const logFile = this.getLogFilePath();
            const logEntries = this.logBuffer.map(entry => 
                JSON.stringify(entry) + '\n'
            ).join('');
            
            fs.appendFileSync(logFile, logEntries);
            this.logBuffer = [];
            
            // Check if log rotation is needed
            this.checkLogRotation(logFile);
        } catch (error) {
            console.error('❌ Failed to flush log buffer:', error.message);
        }
    }

    getLogFilePath() {
        const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        return path.join(this.config.logDirectory, `app-${date}.log`);
    }

    checkLogRotation(logFile) {
        try {
            const stats = fs.statSync(logFile);
            if (stats.size > this.config.maxFileSize) {
                this.rotateLogFile(logFile);
            }
        } catch (error) {
            // File doesn't exist or other error, ignore
        }
    }

    rotateLogFile(logFile) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const rotatedFile = logFile.replace('.log', `-${timestamp}.log`);
            
            fs.renameSync(logFile, rotatedFile);
            
            // Clean up old log files
            this.cleanupOldLogs();
            
            console.log(`🔄 Log file rotated: ${rotatedFile}`);
        } catch (error) {
            console.error('❌ Failed to rotate log file:', error.message);
        }
    }

    cleanupOldLogs() {
        try {
            const files = fs.readdirSync(this.config.logDirectory)
                .filter(file => file.endsWith('.log'))
                .map(file => ({
                    name: file,
                    path: path.join(this.config.logDirectory, file),
                    mtime: fs.statSync(path.join(this.config.logDirectory, file)).mtime
                }))
                .sort((a, b) => b.mtime - a.mtime);
            
            // Keep only the most recent files
            const filesToDelete = files.slice(this.config.maxFiles);
            filesToDelete.forEach(file => {
                fs.unlinkSync(file.path);
                console.log(`🗑️ Deleted old log file: ${file.name}`);
            });
        } catch (error) {
            console.error('❌ Failed to cleanup old logs:', error.message);
        }
    }

    startBufferFlush() {
        // Flush buffer every 5 seconds
        this.flushInterval = setInterval(() => {
            this.flushBuffer();
        }, 5000);
    }

    stopBufferFlush() {
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
            this.flushInterval = null;
        }
    }

    updateStats(level) {
        this.stats.messagesLogged++;
        
        if (level === 'ERROR') {
            this.stats.errorsLogged++;
        } else if (level === 'WARN') {
            this.stats.warningsLogged++;
        }
    }

    // Convenience methods for different log levels
    error(message, meta = {}) {
        this.log('ERROR', message, meta);
    }

    warn(message, meta = {}) {
        this.log('WARN', message, meta);
    }

    info(message, meta = {}) {
        this.log('INFO', message, meta);
    }

    debug(message, meta = {}) {
        this.log('DEBUG', message, meta);
    }

    trace(message, meta = {}) {
        this.log('TRACE', message, meta);
    }

    // Specialized logging methods
    logMessage(messageData, action = 'received') {
        this.info(`Message ${action}`, {
            userId: messageData.userId,
            businessId: messageData.businessId,
            messageLength: messageData.text?.length || 0,
            timestamp: messageData.msgTime,
            action
        });
    }

    logSession(sessionData, action = 'created') {
        this.info(`Session ${action}`, {
            userId: sessionData.userId,
            businessId: sessionData.businessId,
            step: sessionData.step,
            cartItems: sessionData.cart?.length || 0,
            action
        });
    }

    logOrder(orderData, action = 'created') {
        this.info(`Order ${action}`, {
            userId: orderData.customerInfo?.name || 'Unknown',
            businessId: orderData.businessId,
            total: orderData.total || 0,
            itemCount: orderData.items?.length || 0,
            action
        });
    }

    logError(error, context = '', meta = {}) {
        this.error(`${context}: ${error.message}`, {
            ...meta,
            stack: error.stack,
            errorType: error.constructor.name
        });
    }

    logPerformance(operation, duration, meta = {}) {
        this.debug(`Performance: ${operation}`, {
            ...meta,
            duration: `${duration}ms`,
            operation
        });
    }

    logSecurity(event, severity = 'medium', meta = {}) {
        const level = severity === 'high' ? 'ERROR' : 'WARN';
        this.log(level, `Security event: ${event}`, {
            ...meta,
            severity,
            securityEvent: true
        });
    }

    // Statistics and monitoring
    getStats() {
        const uptime = Date.now() - this.stats.startTime;
        return {
            ...this.stats,
            uptime: Math.round(uptime / 1000), // seconds
            bufferSize: this.logBuffer.length,
            logLevel: this.config.level,
            fileLogging: this.config.enableFileLogging,
            consoleLogging: this.config.enableConsoleLogging
        };
    }

    // Configuration methods
    setLogLevel(level) {
        if (this.logLevels.hasOwnProperty(level)) {
            this.config.level = level;
            this.info(`Log level changed to: ${level}`);
        } else {
            this.warn(`Invalid log level: ${level}`);
        }
    }

    enableFileLogging() {
        this.config.enableFileLogging = true;
        this.ensureLogDirectory();
        this.info('File logging enabled');
    }

    disableFileLogging() {
        this.config.enableFileLogging = false;
        this.flushBuffer(); // Flush remaining logs
        this.info('File logging disabled');
    }

    // Query logs (simple file-based search)
    async searchLogs(query, options = {}) {
        if (!this.config.enableFileLogging) {
            throw new Error('File logging is not enabled');
        }

        const {
            level = null,
            startDate = null,
            endDate = null,
            maxResults = 100
        } = options;

        try {
            const logFiles = fs.readdirSync(this.config.logDirectory)
                .filter(file => file.endsWith('.log'))
                .map(file => path.join(this.config.logDirectory, file));

            const results = [];
            
            for (const logFile of logFiles) {
                const content = fs.readFileSync(logFile, 'utf8');
                const lines = content.split('\n').filter(line => line.trim());
                
                for (const line of lines) {
                    try {
                        const entry = JSON.parse(line);
                        
                        // Apply filters
                        if (level && entry.level !== level) continue;
                        if (startDate && new Date(entry.timestamp) < new Date(startDate)) continue;
                        if (endDate && new Date(entry.timestamp) > new Date(endDate)) continue;
                        
                        // Search in message and meta
                        const searchText = `${entry.message} ${JSON.stringify(entry.meta)}`.toLowerCase();
                        if (searchText.includes(query.toLowerCase())) {
                            results.push(entry);
                            
                            if (results.length >= maxResults) {
                                return results;
                            }
                        }
                    } catch (error) {
                        // Skip invalid JSON lines
                        continue;
                    }
                }
            }
            
            return results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        } catch (error) {
            this.error('Failed to search logs', { error: error.message, query });
            throw error;
        }
    }

    // Graceful shutdown
    shutdown() {
        console.log('🛑 Logger shutting down...');
        
        // Stop buffer flush interval
        this.stopBufferFlush();
        
        // Flush remaining logs
        this.flushBuffer();
        
        // Log final stats
        const stats = this.getStats();
        console.log(`📊 Logger stats: ${JSON.stringify(stats)}`);
        
        console.log('✅ Logger shutdown complete');
    }
}

module.exports = new Logger();