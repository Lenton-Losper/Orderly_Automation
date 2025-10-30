// Docker-specific configuration for service discovery and environment management
const path = require('path');

/**
 * Detect if running in Docker container
 */
function isDockerEnvironment() {
    return process.env.NODE_ENV === 'production' || 
           process.env.DOCKER_ENV === 'true' ||
           require('fs').existsSync('/.dockerenv');
}

/**
 * Get service URLs based on environment
 */
function getServiceUrls() {
    const isDocker = isDockerEnvironment();
    
    return {
        // Rasa services
        rasa: {
            baseUrl: process.env.RASA_URL || (isDocker ? 'http://rasa:5005' : 'http://localhost:5005'),
            actionServerUrl: process.env.RASA_ACTION_SERVER_URL || (isDocker ? 'http://rasa-actions:5055' : 'http://localhost:5055')
        },
        
        // Database services
        redis: {
            url: process.env.REDIS_URL || (isDocker ? 'redis://redis:6379' : 'redis://localhost:6379')
        },
        
        mongodb: {
            url: process.env.MONGODB_URL || (isDocker ? 'mongodb://mongodb:27017' : 'mongodb://localhost:27017')
        },
        
        // Backend services
        backend: {
            url: process.env.BACKEND_URL || (isDocker ? 'http://backend:3000' : 'http://localhost:3000'),
            port: parseInt(process.env.PORT) || 3000
        },
        
        botTraining: {
            url: process.env.BOT_TRAINING_URL || (isDocker ? 'http://bot-training:3001' : 'http://localhost:3001'),
            port: parseInt(process.env.API_PORT) || 3001
        },
        
        // WebSocket configuration
        websocket: {
            port: parseInt(process.env.WEBSOCKET_PORT) || 8080
        }
    };
}

/**
 * Get Firebase credentials path
 */
function getFirebaseCredentialsPath() {
    const envPath = process.env.FIREBASE_CREDENTIALS_PATH;
    if (envPath) {
        return envPath;
    }
    
    // Default paths based on environment
    if (isDockerEnvironment()) {
        return '/app/firebase-credentials.json';
    }
    
    // Local development path
    return path.join(process.cwd(), 'lllfarming-firebase-adminsdk-fbsvc-c9ce466038.json');
}

/**
 * Get tenant configuration for Docker
 */
function getTenantConfig() {
    return {
        // Base directories
        tenantsDir: process.env.TENANTS_DIR || '/app/tenants',
        logsDir: process.env.LOGS_DIR || '/app/logs',
        modelsDir: process.env.MODELS_DIR || '/app/rasa-models',
        
        // Port allocation
        basePort: parseInt(process.env.BASE_PORT) || 3000,
        websocketBasePort: parseInt(process.env.WEBSOCKET_BASE_PORT) || 8080
    };
}

/**
 * Get environment-specific configuration
 */
function getDockerConfig() {
    const isDocker = isDockerEnvironment();
    
    return {
        isDocker,
        environment: process.env.NODE_ENV || 'development',
        serviceUrls: getServiceUrls(),
        firebaseCredentialsPath: getFirebaseCredentialsPath(),
        tenantConfig: getTenantConfig(),
        
        // Health check configuration
        healthCheck: {
            enabled: process.env.HEALTH_CHECK_ENABLED !== 'false',
            interval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000,
            timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT) || 5000
        },
        
        // Logging configuration
        logging: {
            level: process.env.LOG_LEVEL || (isDocker ? 'info' : 'debug'),
            format: process.env.LOG_FORMAT || (isDocker ? 'json' : 'pretty')
        }
    };
}

/**
 * Validate Docker configuration
 */
function validateDockerConfig() {
    const config = getDockerConfig();
    const errors = [];
    
    // Check required environment variables
    if (!config.serviceUrls.rasa.baseUrl) {
        errors.push('RASA_URL is required');
    }
    
    if (!config.serviceUrls.redis.url) {
        errors.push('REDIS_URL is required');
    }
    
    // Check Firebase credentials
    const fs = require('fs');
    if (!fs.existsSync(config.firebaseCredentialsPath)) {
        errors.push(`Firebase credentials not found at: ${config.firebaseCredentialsPath}`);
    }
    
    if (errors.length > 0) {
        throw new Error(`Docker configuration validation failed:\n${errors.join('\n')}`);
    }
    
    return config;
}

module.exports = {
    isDockerEnvironment,
    getServiceUrls,
    getFirebaseCredentialsPath,
    getTenantConfig,
    getDockerConfig,
    validateDockerConfig
};


