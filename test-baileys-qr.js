const { makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');

async function test() {
    console.log('🧪 Testing Baileys QR Generation\n');
    console.log('Starting in 3 seconds...\n');
    
    await new Promise(r => setTimeout(r, 3000));
    
    const { state, saveCreds } = await useMultiFileAuthState('./auth');
    
    console.log('Creating socket...\n');
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'info' })
    });

    sock.ev.on('connection.update', (update) => {
        console.log('\n📡 CONNECTION UPDATE:');
        console.log(JSON.stringify(update, null, 2));
        
        if (update.qr) {
            console.log('\n✅ QR CODE RECEIVED!\n');
            qrcode.generate(update.qr, { small: true });
        }
        
        if (update.connection === 'open') {
            console.log('\n✅ CONNECTED SUCCESSFULLY!\n');
        }
    });
    
    sock.ev.on('creds.update', saveCreds);
    
    console.log('✅ Socket created, waiting for events...\n');
}

test().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});



