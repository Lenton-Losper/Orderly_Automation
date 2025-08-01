//src/config/database.js
require('dotenv').config();
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
const serviceAccount = require('../../lllfarming-firebase-adminsdk-fbsvc-c9ce466038.json');

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