const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const P = require('pino'); // Added proper logger
const creds = require('./creds.json');

// Spreadsheet config
const SHEET_ID = '1c9JReDZUrkWQtd9Yn-r_bhLLxH7gWYVpHyBStIWqEAw';

// Use pino logger (required by Baileys)
const logger = P({ level: 'info' });

async function logOrderToSheet(name, order) {
    try {
        const doc = new GoogleSpreadsheet(SHEET_ID);
        await doc.useServiceAccountAuth(creds);
        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0];
        await sheet.addRow({
            Name: name,
            Order: order,
            Time: new Date().toLocaleString()
        });
        console.log('✅ Order logged to sheet');
    } catch (error) {
        console.error('❌ Error logging to sheet:', error);
    }
}

async function startBot() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('auth');

        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            logger,
            markOnlineOnConnect: false
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error instanceof Boom) &&
                    lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut;

                console.log('Connection closed. Reconnecting:', shouldReconnect);
                if (shouldReconnect) {
                    setTimeout(startBot, 5000);
                }
            } else if (connection === 'open') {
                console.log('✅ Bot connected successfully!');
            }
        });

        sock.ev.on('messages.upsert', async ({ messages }) => {
            try {
                const msg = messages[0];
                if (!msg.message) return;

                // Ignore group messages
                if (msg.key.remoteJid.endsWith('@g.us')) return;

                const sender = msg.pushName || 'Anonymous';
                const messageText = msg.message.conversation ||
                    msg.message.extendedTextMessage?.text || '';

                if (messageText) {
                    console.log(`📩 ${sender}: ${messageText}`);
                    await logOrderToSheet(sender, messageText);
                    await sock.sendMessage(msg.key.remoteJid, {
                        text: `✅ Thanks ${sender}, your order has been received and logged!`
                    });
                }
            } catch (err) {
                console.error('❌ Error handling message:', err);
            }
        });

    } catch (err) {
        console.error('❌ Bot startup error:', err);
        setTimeout(startBot, 10000);
    }
}

// Start bot
startBot().catch(err => console.error('❌ Fatal startup error:', err));
