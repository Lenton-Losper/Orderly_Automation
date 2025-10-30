//src/config/database.js
require('dotenv').config();
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Detect environment
const isDocker = process.env.IS_DOCKER === 'true' || 
                 process.env.NODE_ENV === 'docker' ||
                 fs.existsSync('/.dockerenv');

// Determine credential path
let serviceAccountPath;

if (isDocker) {
  // Docker path
  serviceAccountPath = '/app/firebase-credentials.json';
} else {
  // Local development path
  serviceAccountPath = path.join(__dirname, '../../lllfarming-firebase-adminsdk-fbsvc-c9ce466038.json');
}

// Log for debugging
console.log('🔍 Environment check:');
console.log('  IS_DOCKER env:', process.env.IS_DOCKER);
console.log('  NODE_ENV:', process.env.NODE_ENV);
console.log('  Detected Docker:', isDocker);
console.log('  Credential path:', serviceAccountPath);
console.log('  File exists:', fs.existsSync(serviceAccountPath));

// Load credentials
let serviceAccount;
try {
  const credentialsContent = fs.readFileSync(serviceAccountPath, 'utf8');
  serviceAccount = JSON.parse(credentialsContent);
  console.log('✅ Firebase credentials loaded successfully');
} catch (error) {
  console.error('❌ Failed to load Firebase credentials:', error.message);
  console.error('   Tried path:', serviceAccountPath);
  process.exit(1);
}

let db = null;

function initializeFirebase() {
    try {
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId: serviceAccount.project_id // Use project_id from service account file
            });
            console.log('✅ Firebase Admin SDK initialized successfully');
            console.log(`📱 Project ID: ${serviceAccount.project_id}`);
        }
        
        db = admin.firestore();
        console.log('✅ Firestore database connected');
        
        return db;
    } catch (error) {
        console.error('❌ Failed to initialize Firebase:', error.message);
        throw error;
    }
}

function getDatabase() {
    if (!db) {
        throw new Error('Database not initialized. Call initializeFirebase() first.');
    }
    return db;
}

function getFirebaseAdmin() {
    return admin;
}

module.exports = {
    initializeFirebase,
    getDatabase,
    getFirebaseAdmin
};