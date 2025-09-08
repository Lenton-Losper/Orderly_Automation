const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Deploying Firestore security rules...');

try {
    // Check if Firebase CLI is installed
    try {
        execSync('firebase --version', { stdio: 'pipe' });
    } catch (error) {
        console.error('❌ Firebase CLI not found. Please install it first:');
        console.error('npm install -g firebase-tools');
        console.error('firebase login');
        process.exit(1);
    }

    // Check if firebase.json exists
    const firebaseJsonPath = path.join(__dirname, 'firebase.json');
    if (!fs.existsSync(firebaseJsonPath)) {
        console.log('📝 Creating firebase.json...');
        const firebaseConfig = {
            "firestore": {
                "rules": "firestore.rules",
                "indexes": "firestore.indexes.json"
            }
        };
        fs.writeFileSync(firebaseJsonPath, JSON.stringify(firebaseConfig, null, 2));
    }

    // Deploy rules
    console.log('📤 Deploying Firestore rules...');
    execSync('firebase deploy --only firestore:rules', { stdio: 'inherit' });
    
    console.log('✅ Firestore rules deployed successfully!');
    console.log('🔒 Your Firestore database is now secured with tenant-based access control.');
    
} catch (error) {
    console.error('❌ Failed to deploy Firestore rules:', error.message);
    process.exit(1);
}
