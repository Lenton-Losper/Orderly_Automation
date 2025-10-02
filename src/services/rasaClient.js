// Rasa REST client with graceful fallback
const axios = require('axios');

const DEFAULT_RESPONSE = { ok: false, reason: 'disabled', messages: [], latencyMs: null };

function getRasaConfig() {
    const baseUrl = process.env.RASA_URL || process.env.RASA_BASE_URL || null;
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
        return { ...DEFAULT_RESPONSE };
    }
    try {
        // Prefer webhook which returns full messages
        return await callRasaWebhook(baseUrl, userId, text, metadata);
    } catch (err1) {
        // Fallback to model/parse for resilience
        try {
            return await callRasaParse(baseUrl, userId, text, metadata);
        } catch (err2) {
            const reason = err1?.response?.status ? `http_${err1.response.status}` : (err1.message || 'error');
            return { ok: false, reason, messages: [] };
        }
    }
}

module.exports = { parseMessage };


