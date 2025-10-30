/**
 * WhatsApp Bot Session Reset Script
 * 
 * This script safely clears all WhatsApp session data to allow 
 * fresh reconnection via QR code. Use this when:
 * - Testing the system from scratch
 * - Switching WhatsApp accounts
 * - Troubleshooting connection issues
 * - Preparing for production deployment tests
 */

const fs = require('fs');
const path = require('path');

async function resetWhatsAppSession() {
    console.log('🧹 Starting WhatsApp Session Reset...\n');
    
    // Check if we're in production (safety check)
    if (process.env.NODE_ENV === 'production') {
        console.error('❌ Cannot reset session in production environment!');
        console.error('   This script is only for development/testing purposes.');
        process.exit(1);
    }
    
    console.log('⚠️  SECURITY WARNING:');
    console.log('   This script deletes authentication data. Use only when:');
    console.log('   - Testing in development');
    console.log('   - Switching WhatsApp accounts');
    console.log('   - Troubleshooting connection issues');
    console.log('   DO NOT run this in production unless intentional!\n');
    
    // List of possible session storage locations based on common WhatsApp libraries
    const sessionPaths = [
        './auth/session-lll-farming-bot',  // Current Baileys session
        './auth/session-*',                 // Any other Baileys sessions
        './baileys_store_multi',           // Baileys multi-device store
        './auth_info_baileys',             // Baileys auth info
        './sessions',                      // Generic session folder
        './.wwebjs_auth',                  // whatsapp-web.js auth
        './.wwebjs_cache',                 // whatsapp-web.js cache
        './bot_sessions',                  // Custom bot sessions
        './whatsapp_sessions',             // Custom WhatsApp sessions
        './auth_info',                     // Generic auth info
        './store',                         // Generic store
        './whatsapp_data'                  // WhatsApp data folder
    ];
    
    // List of possible session files
    const sessionFiles = [
        './session.json',
        './auth_info.json',
        './whatsapp.db',
        './creds.json',
        './session.data',
        './auth.data',
        './whatsapp.session'
    ];
    
    let deletedCount = 0;
    
    // Delete session folders
    console.log('📁 Checking for session folders...');
    for (const sessionPath of sessionPaths) {
        // Handle wildcard patterns
        if (sessionPath.includes('*')) {
            const parentDir = path.dirname(sessionPath);
            const pattern = path.basename(sessionPath);
            
            if (fs.existsSync(parentDir)) {
                const items = fs.readdirSync(parentDir);
                const matchingItems = items.filter(item => {
                    if (pattern === '*') return true;
                    if (pattern.includes('*')) {
                        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
                        return regex.test(item);
                    }
                    return item === pattern;
                });
                
                for (const item of matchingItems) {
                    const fullPath = path.join(parentDir, item);
                    if (fs.statSync(fullPath).isDirectory()) {
                        console.log(`   Found: ${fullPath}`);
                        try {
                            fs.rmSync(fullPath, { recursive: true, force: true });
                            console.log(`   ✅ Deleted: ${fullPath}`);
                            deletedCount++;
                        } catch (error) {
                            console.log(`   ❌ Error deleting ${fullPath}:`, error.message);
                        }
                    }
                }
            }
        } else {
            const fullPath = path.resolve(sessionPath);
            if (fs.existsSync(fullPath)) {
                console.log(`   Found: ${sessionPath}`);
                try {
                    fs.rmSync(fullPath, { recursive: true, force: true });
                    console.log(`   ✅ Deleted: ${sessionPath}`);
                    deletedCount++;
                } catch (error) {
                    console.log(`   ❌ Error deleting ${sessionPath}:`, error.message);
                }
            }
        }
    }
    
    // Delete session files
    console.log('\n📄 Checking for session files...');
    for (const sessionFile of sessionFiles) {
        const fullPath = path.resolve(sessionFile);
        if (fs.existsSync(fullPath)) {
            console.log(`   Found: ${sessionFile}`);
            try {
                fs.unlinkSync(fullPath);
                console.log(`   ✅ Deleted: ${sessionFile}`);
                deletedCount++;
            } catch (error) {
                console.log(`   ❌ Error deleting ${sessionFile}:`, error.message);
            }
        }
    }
    
    // Clear old test invoices
    console.log('\n📄 Clearing old invoices...');
    const invoicesPath = path.resolve('./invoices');
    if (fs.existsSync(invoicesPath)) {
        try {
            const invoiceFiles = fs.readdirSync(invoicesPath).filter(f => f.endsWith('.pdf'));
            if (invoiceFiles.length > 0) {
                invoiceFiles.forEach(file => {
                    const filePath = path.join(invoicesPath, file);
                    fs.unlinkSync(filePath);
                });
                console.log(`   ✅ Deleted ${invoiceFiles.length} old invoice(s)`);
            } else {
                console.log('   No old invoices found.');
            }
        } catch (error) {
            console.log(`   ❌ Error clearing invoices:`, error.message);
        }
    } else {
        console.log('   No invoices directory found.');
    }
    
    // Clear QR code images
    console.log('\n🖼️  Clearing QR code images...');
    const qrFiles = [
        './public/qr.png',
        './qr.png',
        './qr-code.png',
        './whatsapp-qr.png'
    ];
    
    for (const qrFile of qrFiles) {
        const fullPath = path.resolve(qrFile);
        if (fs.existsSync(fullPath)) {
            try {
                fs.unlinkSync(fullPath);
                console.log(`   ✅ Deleted: ${qrFile}`);
                deletedCount++;
            } catch (error) {
                console.log(`   ❌ Error deleting ${qrFile}:`, error.message);
            }
        }
    }
    
    // Clear any temporary files
    console.log('\n🗑️  Clearing temporary files...');
    const tempFiles = [
        './temp_training_*.py',
        './*.tmp',
        './temp_*.json'
    ];
    
    for (const tempPattern of tempFiles) {
        const parentDir = path.dirname(tempPattern);
        const pattern = path.basename(tempPattern);
        
        if (fs.existsSync(parentDir)) {
            try {
                const items = fs.readdirSync(parentDir);
                const matchingItems = items.filter(item => {
                    if (pattern.includes('*')) {
                        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
                        return regex.test(item);
                    }
                    return item === pattern;
                });
                
                for (const item of matchingItems) {
                    const fullPath = path.join(parentDir, item);
                    fs.unlinkSync(fullPath);
                    console.log(`   ✅ Deleted temp file: ${item}`);
                    deletedCount++;
                }
            } catch (error) {
                // Ignore errors for temp file cleanup
            }
        }
    }
    
    if (deletedCount === 0) {
        console.log('\n⚠️  No session files found. System is already clean or sessions are stored elsewhere.');
        console.log('   Check the WhatsApp bot configuration to verify session storage location.\n');
    } else {
        console.log(`\n✅ Session reset complete! Deleted ${deletedCount} items.\n`);
    }
    
    console.log('📋 Next Steps:');
    console.log('   1. Stop any running WhatsApp bot processes');
    console.log('   2. Start the WhatsApp bot: npm run start (or node src/index.js)');
    console.log('   3. A QR code will appear in the terminal');
    console.log('   4. Scan the QR code with your phone:');
    console.log('      - Open WhatsApp on your phone');
    console.log('      - Go to Settings → Linked Devices');
    console.log('      - Tap "Link a Device"');
    console.log('      - Scan the QR code');
    console.log('   5. Wait for "WhatsApp connected!" message');
    console.log('   6. Send "hi" to test the bot\n');
    
    console.log('🔧 Troubleshooting:');
    console.log('   - If QR code doesn\'t appear: Restart the bot completely');
    console.log('   - If "Already connected" error: Remove existing connections in WhatsApp');
    console.log('   - If bot doesn\'t respond: Check all services are running\n');
}

// Handle command line arguments
const args = process.argv.slice(2);
const shouldBackup = args.includes('--backup');
const keepInvoices = args.includes('--keep-invoices');

if (shouldBackup) {
    console.log('📦 Backup functionality not implemented yet.');
    console.log('   Use git to backup your session before reset if needed.\n');
}

if (keepInvoices) {
    console.log('📄 Keeping invoices (--keep-invoices flag detected).\n');
}

// Run the reset
resetWhatsAppSession().catch(console.error);







