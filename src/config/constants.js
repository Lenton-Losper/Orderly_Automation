// Application constants and configuration

// Owner configuration - Replace with your WhatsApp number to ignore
const OWNER_NUMBER = process.env.OWNER_NUMBER || '264812345678@s.whatsapp.net';

// Connection settings
const CONNECTION_CONFIG = {
    MAX_RETRIES: 5,
    RETRY_DELAY: 3000,
    PING_INTERVAL: 30000,
    HEALTH_CHECK_INTERVAL: 60000
};

// WhatsApp configuration
const WHATSAPP_CONFIG = {
    MARK_ONLINE_ON_CONNECT: true,
    BROWSER: ['LLL Farm Bot', 'Chrome', '120.0.0'],
    QR_TERMINAL: true,
    AUTH_FOLDER: './auth'
};

// Business configuration
const DEFAULT_BUSINESS = 'default';

// Firebase collections
const COLLECTIONS = {
    VENDORS: 'vendors',
    BUSINESS_MAPPINGS: 'whatsapp_business_mapping',
    ORDERS: 'orders',
    CUSTOMERS: 'customers',
    PRODUCTS: 'products'
};

// Session configuration
const SESSION_CONFIG = {
    CLEANUP_INTERVAL: 300000, // 5 minutes
    SESSION_TIMEOUT: 1800000, // 30 minutes
    MAX_SESSIONS_PER_USER: 3,
    EMERGENCY_CLEANUP_THRESHOLD: 1000
};

// Pricing configuration
const PRICING_CONFIG = {
    TAX_RATE: 0.15, // 15% VAT in Namibia
    DELIVERY_FEE: 25.00, // N$ 25 delivery fee
    FREE_DELIVERY_THRESHOLD: 200.00, // Free delivery over N$ 200
    CURRENCY: 'N$',
    CURRENCY_SYMBOL: 'N$'
};

// Discount codes
const DISCOUNT_CODES = {
    'FIRST10': { type: 'percentage', value: 0.10, description: '10% off first order' },
    'SAVE20': { type: 'fixed', value: 20, description: 'N$20 off any order' },
    'BULK50': { type: 'percentage', value: 0.05, description: '5% off orders over N$500' }
};

// Cache configuration
const CACHE_CONFIG = {
    BUSINESS_DATA_TTL: 600000, // 10 minutes
    PRODUCT_DATA_TTL: 300000, // 5 minutes
    CUSTOMER_DATA_TTL: 180000, // 3 minutes
    MAX_CACHE_SIZE: 1000
};

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
    MESSAGES_PER_MINUTE: 10,
    BURST_LIMIT: 3,
    COOLDOWN_MINUTES: 5,
    BLOCK_DURATION: 300000, // 5 minutes
    WARNING_THRESHOLD: 8,
    MAX_VIOLATIONS: 3
};

// Validation configuration
const VALIDATION_CONFIG = {
    MIN_NAME_LENGTH: 2,
    MAX_NAME_LENGTH: 50,
    PHONE_REGEX: /^264\d{9}$/, // Namibian phone numbers
    EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    MIN_ADDRESS_LENGTH: 10,
    MAX_MESSAGE_LENGTH: 1000
};

// Logging configuration
const LOGGING_CONFIG = {
    LEVEL: process.env.LOG_LEVEL || 'INFO',
    FILE_LOGGING: true,
    CONSOLE_LOGGING: true,
    MAX_LOG_SIZE: 10 * 1024 * 1024, // 10MB
    MAX_LOG_FILES: 5,
    LOG_ROTATION: true
};

// Monitoring configuration
const MONITORING_CONFIG = {
    STATS_INTERVAL: 600000, // 10 minutes
    MEMORY_CHECK_INTERVAL: 300000, // 5 minutes
    MEMORY_WARNING_THRESHOLD: 100 * 1024 * 1024, // 100MB
    MEMORY_CRITICAL_THRESHOLD: 200 * 1024 * 1024, // 200MB
    CLEANUP_ON_HIGH_MEMORY: true
};

// Security configuration
const SECURITY_CONFIG = {
    THREAT_DETECTION: true,
    CONTENT_ANALYSIS: true,
    BEHAVIORAL_ANALYSIS: true,
    RISK_SCORE_THRESHOLD: 50,
    AUTO_BLOCK_THRESHOLD: 80,
    WHITELIST_BYPASS: true,
    ALERT_THRESHOLDS: {
        RATE_LIMIT: 5,
        CONTENT_VIOLATION: 3,
        BEHAVIOR_VIOLATION: 3
    }
};

// Error configuration
const ERROR_CONFIG = {
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000,
    EXPONENTIAL_BACKOFF: true,
    CIRCUIT_BREAKER: true,
    FALLBACK_RESPONSES: true
};

// Export all configurations
module.exports = {
    OWNER_NUMBER,
    CONNECTION_CONFIG,
    WHATSAPP_CONFIG,
    DEFAULT_BUSINESS,
    COLLECTIONS,
    SESSION_CONFIG,
    PRICING_CONFIG,
    DISCOUNT_CODES,
    CACHE_CONFIG,
    RATE_LIMIT_CONFIG,
    VALIDATION_CONFIG,
    LOGGING_CONFIG,
    MONITORING_CONFIG,
    SECURITY_CONFIG,
    ERROR_CONFIG
};