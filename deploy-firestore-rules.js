const admin = require('firebase-admin');
const serviceAccount = require('./lllfarming-firebase-adminsdk-fbsvc-c9ce466038.json');
const fs = require('fs');

// Initialize Firebase Admin
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

async function deployFirestoreRules() {
    try {
        console.log('🚀 Deploying Firestore rules...');
        
        // Read the rules file
        const rulesContent = fs.readFileSync('./firestore.rules', 'utf8');
        console.log('✅ Rules file read successfully');
        
        // Note: Firebase Admin SDK doesn't have a direct method to deploy rules
        // You need to use Firebase CLI or REST API
        console.log('\n📋 To deploy these rules, run one of these commands:');
        console.log('\n1. Using Firebase CLI:');
        console.log('   firebase deploy --only firestore:rules');
        console.log('\n2. Or manually copy the rules to Firebase Console:');
        console.log('   - Go to Firebase Console > Firestore Database > Rules');
        console.log('   - Replace the existing rules with the content from firestore.rules');
        
        console.log('\n📄 Rules content:');
        console.log('=' .repeat(50));
        console.log(rulesContent);
        console.log('=' .repeat(50));
        
        console.log('\n✅ Rules are ready for deployment!');
        
    } catch (error) {
        console.error('❌ Error preparing rules deployment:', error.message);
        process.exit(1);
    }
}

// Run the deployment preparation
deployFirestoreRules()
    .then(() => {
        console.log('\n🎉 Deployment preparation completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Deployment preparation failed:', error);
        process.exit(1);
    });
