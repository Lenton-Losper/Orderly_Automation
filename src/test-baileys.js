// Test script to check Baileys imports
console.log('Testing Baileys imports...');

try {
    const baileys = require('@whiskeysockets/baileys');
    console.log('✅ Baileys imported successfully');
    console.log('Available exports:', Object.keys(baileys));
    
    const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = baileys;
    console.log('makeWASocket:', typeof makeWASocket);
    console.log('useMultiFileAuthState:', typeof useMultiFileAuthState);
    console.log('DisconnectReason:', typeof DisconnectReason);
    
    if (!makeWASocket) {
        console.log('❌ makeWASocket is undefined');
    }
    if (!useMultiFileAuthState) {
        console.log('❌ useMultiFileAuthState is undefined');
    }
    if (!DisconnectReason) {
        console.log('❌ DisconnectReason is undefined');
    }
    
} catch (error) {
    console.error('❌ Error importing Baileys:', error.message);
}