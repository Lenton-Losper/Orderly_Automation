// Rasa REST client with graceful fallback
const axios = require('axios');
const { getServiceUrls } = require('../config/docker');
const MultiTenantRasaServer = require('./multiTenantRasaServer');

const DEFAULT_RESPONSE = { ok: false, reason: 'disabled', messages: [], latencyMs: null };

// Initialize multi-tenant Rasa server
const multiTenantRasaServer = new MultiTenantRasaServer();

function getRasaConfig() {
    const serviceUrls = getServiceUrls();
    const baseUrl = process.env.RASA_BASE_URL || process.env.RASA_URL || serviceUrls.rasa.baseUrl;
    const token = process.env.RASA_TOKEN || process.env.RASA_AUTH_TOKEN || null;
    return { baseUrl, token };
}

async function callRasaWebhook(baseUrl, userId, text, metadata) {
    const url = `${baseUrl.replace(/\/$/, '')}/webhooks/rest/webhook`;
    const headers = { 'Content-Type': 'application/json' };
    if (getRasaConfig().token) headers['Authorization'] = `Bearer ${getRasaConfig().token}`;
    
    // Include tenant information in the payload for model selection
    const payload = { 
        sender: userId, 
        message: text, 
        metadata: {
            ...metadata,
            tenant_id: metadata.tenantId || metadata.tenant_id,
            model_path: metadata.modelPath || null
        }
    };
    
    const start = Date.now();
    const { data } = await axios.post(url, payload, { headers, timeout: 7000 });
    const latencyMs = Date.now() - start;
    const messages = (Array.isArray(data) ? data : []).map((m) => {
        if (m.text) return { text: m.text };
        if (m.image) return { image: { url: m.image } };
        if (m.custom) return { custom: m.custom };
        return null;
    }).filter(Boolean);
    return { ok: true, messages, latencyMs };
}

async function callRasaParse(baseUrl, userId, text, metadata) {
    const url = `${baseUrl.replace(/\/$/, '')}/model/parse`;
    const headers = { 'Content-Type': 'application/json' };
    if (getRasaConfig().token) headers['Authorization'] = `Bearer ${getRasaConfig().token}`;
    const start = Date.now();
    const { data } = await axios.post(url, { text, message_id: userId, metadata }, { headers, timeout: 5000 });
    const latencyMs = Date.now() - start;
    // Minimal echo of intent if needed
    const textOut = data?.text || data?.intent?.name || null;
    const messages = textOut ? [{ text: textOut }] : [];
    return { ok: true, messages, latencyMs };
}

async function parseMessage(userId, text, metadata = {}) {
    try {
        console.log(`RASA: Processing message from ${userId}: "${text}"`);
        
        // Extract tenant information from metadata
        const tenantId = metadata.tenantId || metadata.tenant_id || 'default';
        
        console.log(`RASA: Using tenant: ${tenantId}`);
        
        // Use multi-tenant Rasa server
        const result = await multiTenantRasaServer.processMessage(tenantId, userId, text, metadata);
        
        if (result.ok && result.messages && result.messages.length > 0) {
            console.log(`RASA: Successfully processed message, got ${result.messages.length} responses`);
            return result;
        } else {
            console.log('RASA: No responses from multi-tenant server');
            return { ...DEFAULT_RESPONSE };
        }
    } catch (error) {
        console.error('RASA: Error processing message:', error);
        return { ok: false, reason: error.message, messages: [] };
    }
}

module.exports = { parseMessage };


