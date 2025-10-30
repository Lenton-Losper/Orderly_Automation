const { makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');

async function test() {
    console.log('🧪 Testing with Modified Browser Signature\n');
    console.log('Using Windows Edge signature to avoid detection...\n');
    
    const { state, saveCreds } = await useMultiFileAuthState('./auth');
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        // Try different browser signatures to avoid detection
        browser: ['Windows', 'Edge', '120.0.0'],
        // Alternative signatures to try:
        // browser: ['Mac OS', 'Safari', '16.0'],
        // browser: ['iPhone OS', 'Mobile Safari', '16.0'],
        
        // Add these to look more legitimate
        syncFullHistory: false,
        markOnlineOnConnect: true,
        fireInitQueries: false,
        emitOwnEvents: false,
        getMessage: async () => undefined,
    });

    sock.ev.on('connection.update', (update) => {
        console.log('\n📡 UPDATE:', JSON.stringify(update, null, 2));
        
        if (update.qr) {
            console.log('\n✅ QR RECEIVED!\n');
            qrcode.generate(update.qr, { small: true });
        }
        
        if (update.connection === 'open') {
            console.log('\n✅ CONNECTED SUCCESSFULLY!\n');
        }
    });
    
    sock.ev.on('creds.update', saveCreds);
    
    console.log('✅ Socket created with modified signature, waiting for events...\n');
}

test().catch(console.error);




















