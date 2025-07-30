const { WHATSAPP_CONFIG, CONNECTION_CONFIG } = require('./constants');

// WhatsApp socket configuration
function getSocketConfig() {
    return {
        printQRInTerminal: true,
        markOnlineOnConnect: WHATSAPP_CONFIG.MARK_ONLINE_ON_CONNECT,
        defaultQueryTimeoutMs: CONNECTION_CONFIG.QUERY_TIMEOUT,
        connectTimeoutMs: CONNECTION_CONFIG.CONNECTION_TIMEOUT,
        browser: WHATSAPP_CONFIG.BROWSER,
        syncFullHistory: WHATSAPP_CONFIG.SYNC_FULL_HISTORY,
        generateHighQualityLinkPreview: WHATSAPP_CONFIG.GENERATE_HIGH_QUALITY_LINK_PREVIEW,
        shouldSyncHistoryMessage: msg => false,
        shouldIgnoreJid: jid => false,
        logger: undefined, // Disable detailed logging
        version: WHATSAPP_CONFIG.VERSION,
        retryRequestDelayMs: CONNECTION_CONFIG.RETRY_REQUEST_DELAY,
        maxMsgRetryCount: CONNECTION_CONFIG.MAX_MSG_RETRY_COUNT,
        
        // WebSocket options
        options: {
            keepAliveIntervalMs: CONNECTION_CONFIG.KEEP_ALIVE_INTERVAL,
            agent: undefined
        }
    };
}

// Connection health check query
function getHealthCheckQuery(sock) {
    return {
        tag: 'iq',
        attrs: {
            to: '@s.whatsapp.net',
            type: 'get',
            xmlns: 'w:p',
            id: sock.generateMessageTag()
        }
    };
}

module.exports = {
    getSocketConfig,
    getHealthCheckQuery
};