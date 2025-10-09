// Rasa REST client with graceful fallback
const axios = require('axios');

const DEFAULT_RESPONSE = { ok: false, reason: 'disabled', messages: [], latencyMs: null };

function getRasaConfig() {
    const baseUrl = process.env.RASA_BASE_URL || process.env.RASA_URL || null;
    const token = process.env.RASA_TOKEN || process.env.RASA_AUTH_TOKEN || null;
    return { baseUrl, token };
}

async function callRasaWebhook(baseUrl, userId, text, metadata) {
    const url = `${baseUrl.replace(/\/$/, '')}/webhooks/rest/webhook`;
    const headers = { 'Content-Type': 'application/json' };
    if (getRasaConfig().token) headers['Authorization'] = `Bearer ${getRasaConfig().token}`;
    const payload = { sender: userId, message: text, metadata };
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
    const { baseUrl } = getRasaConfig();
    if (!baseUrl) {
        console.log('RASA: No base URL configured, skipping Rasa processing');
        return { ...DEFAULT_RESPONSE };
    }
    
    try {
        console.log(`RASA: Processing message from ${userId}: "${text}"`);
        
        // Enhanced metadata for better context
        const enhancedMetadata = {
            ...metadata,
            timestamp: Date.now(),
            platform: 'whatsapp',
            userId: userId,
            sessionId: `${userId}_${Date.now()}`
        };
        
        // Prefer webhook which returns full messages
        const result = await callRasaWebhook(baseUrl, userId, text, enhancedMetadata);
        
        if (result.ok && result.messages && result.messages.length > 0) {
            console.log(`RASA: Successfully processed message, got ${result.messages.length} responses`);
            return result;
        } else {
            console.log('RASA: No responses from webhook, trying parse endpoint');
            // Fallback to model/parse for resilience
            return await callRasaParse(baseUrl, userId, text, enhancedMetadata);
        }
    } catch (err1) {
        console.log('RASA: Webhook failed, trying parse endpoint:', err1.message);
        // Fallback to model/parse for resilience
        try {
            return await callRasaParse(baseUrl, userId, text, metadata);
        } catch (err2) {
            const reason = err1?.response?.status ? `http_${err1.response.status}` : (err1.message || 'error');
            console.log(`RASA: Both endpoints failed: ${reason}`);
            return { ok: false, reason, messages: [] };
        }
    }
}

module.exports = { parseMessage };


