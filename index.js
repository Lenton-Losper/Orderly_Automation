require('dotenv').config();
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase
const serviceAccount = require('./lllfarming-firebase-adminsdk-fbsvc-c9ce466038.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();
const ordersCollection = db.collection('orders');

// Function to log order to Firestore
async function logOrderToFirebase(name, order, msgId) {
    try {
        const existing = await ordersCollection.doc(msgId).get();
        if (existing.exists) {
            console.log('Message already processed.');
            return false;
        }

        await ordersCollection.doc(msgId).set({
            name,
            order,
            timestamp: new Date().toISOString()
        });

        console.log('✅ Order logged to Firebase');
        return true;
    } catch (error) {
        console.error('❌ Firebase logging error:', error);
        return false;
    }
}

async function startBot() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('auth');
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            markOnlineOnConnect: false
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error instanceof Boom) &&
                    lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut;

                console.log('🔌 Connection closed. Reconnecting:', shouldReconnect);
                if (shouldReconnect) {
                    setTimeout(startBot, 5000);
                }
            } else if (connection === 'open') {
                console.log('✅ Bot connected to WhatsApp');
            }
        });

        sock.ev.on('messages.upsert', async ({ messages }) => {
            const msg = messages[0];
            if (!msg.message) return;

            // Ignore own messages
            if (msg.key.fromMe) return;

            // Ignore group messages
            if (msg.key.remoteJid.endsWith('@g.us')) return;

            // Check timestamp: only process messages from today
            const messageTimestamp = msg.messageTimestamp?.low || msg.messageTimestamp;
            const msgDate = new Date(messageTimestamp * 1000).toDateString();
            const today = new Date().toDateString();
            if (msgDate !== today) {
                console.log('⏳ Ignoring old message');
                return;
            }

            const sender = msg.pushName || 'Anonymous';
            const messageText =
                msg.message.conversation ||
                msg.message.extendedTextMessage?.text ||
                '';

            if (!messageText.trim()) return;

            const msgId = msg.key.id;

            const wasLogged = await logOrderToFirebase(sender, messageText, msgId);

            if (wasLogged) {
                await sock.sendMessage(msg.key.remoteJid, {
                    text: `✅ Thanks ${sender}, your order has been received and logged!`
                });
            }
        });

    } catch (err) {
        console.error('💥 Fatal bot error:', err);
        setTimeout(startBot, 10000);
    }
}

startBot().catch(console.error);
