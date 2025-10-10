/**
 * Training Data Service
 * Handles all bot training data operations including examples, intents, and training jobs
 * 
 * Collections:
 * - bot_training_examples: Training examples for each tenant
 * - bot_intents: Intent definitions for each tenant
 * - bot_training_jobs: Training job history and status
 */

const { getDatabase, getFirebaseAdmin } = require('../config/database');
const { FieldValue } = require('firebase-admin/firestore');

class TrainingDataService {
    constructor() {
        this.db = null;
        this.admin = null;
        this.isInitialized = false;
    }

    /**
     * Initialize the service with Firebase connection
     */
    async initialize() {
        try {
            if (this.isInitialized) {
                console.log('TrainingDataService already initialized');
                return true;
            }

            console.log('Initializing TrainingDataService...');
            
            this.db = getDatabase();
            this.admin = getFirebaseAdmin();
            
            if (!this.db) {
                throw new Error('Firebase database not initialized');
            }

            this.isInitialized = true;
            console.log('✅ TrainingDataService initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize TrainingDataService:', error);
            throw error;
        }
    }

    // ========================================
    // TRAINING EXAMPLES MANAGEMENT
    // ========================================

    /**
     * Add a new training example
     * @param {Object} data - Training example data
     * @param {string} data.tenantId - Tenant ID
     * @param {string} data.businessId - Business ID
     * @param {string} data.intent - Intent name (e.g., "view_catalog")
     * @param {string} data.exampleText - Example text (e.g., "show me your products")
     * @param {Array} data.entities - Optional entities array
     * @param {string} data.createdBy - User email who created this
     * @param {string} data.source - Source: "manual" | "auto_suggested" | "conversation"
     * @returns {Promise<Object>} Created example with ID
     */
    async addTrainingExample({
        tenantId,
        businessId,
        intent,
        exampleText,
        entities = [],
        createdBy,
        source = 'manual'
    }) {
        try {
            console.log(`TRAINING: Adding example for tenant ${tenantId}, intent: ${intent}`);
            
            if (!tenantId || !businessId || !intent || !exampleText || !createdBy) {
                throw new Error('Missing required fields: tenantId, businessId, intent, exampleText, createdBy');
            }

            // Sanitize and validate input
            const sanitizedText = exampleText.trim();
            if (sanitizedText.length === 0) {
                throw new Error('Example text cannot be empty');
            }

            if (sanitizedText.length > 500) {
                throw new Error('Example text too long (max 500 characters)');
            }

            const exampleData = {
                tenantId,
                businessId,
                intent: intent.toLowerCase().trim(),
                exampleText: sanitizedText,
                entities: Array.isArray(entities) ? entities : [],
                source,
                status: 'approved', // Default to approved for manual entries
                createdBy,
                createdAt: FieldValue.serverTimestamp(),
                trainedAt: null
            };

            const docRef = await this.db.collection('bot_training_examples').add(exampleData);
            
            console.log(`TRAINING: Created example ${docRef.id} for tenant ${tenantId}`);
            
            // Update intent example count
            await this.incrementIntentCount(tenantId, intent);

            return {
                id: docRef.id,
                ...exampleData,
                createdAt: new Date() // Convert timestamp for response
            };
        } catch (error) {
            console.error('TRAINING: Error adding training example:', error);
            throw error;
        }
    }

    /**
     * Get all training examples for a tenant
     * @param {string} tenantId - Tenant ID
     * @param {string} status - Filter by status: 'approved' | 'pending' | 'trained' | 'all'
     * @param {number} limit - Maximum number of results
     * @returns {Promise<Array>} Array of training examples
     */
    async getTrainingExamples(tenantId, status = 'approved', limit = 100) {
        try {
            console.log(`TRAINING: Getting examples for tenant ${tenantId}, status: ${status}`);
            
            if (!tenantId) {
                throw new Error('tenantId is required');
            }

            let query = this.db.collection('bot_training_examples')
                .where('tenantId', '==', tenantId);

            if (limit) {
                query = query.limit(limit);
            }

            // Note: Removed status filter and orderBy to avoid composite index requirement
            // We'll filter by status in JavaScript after fetching

            const snapshot = await query.get();
            const examples = [];

            snapshot.forEach(doc => {
                const data = doc.data();
                // Filter by status in JavaScript to avoid composite index requirement
                if (status === 'all' || data.status === status) {
                    examples.push({
                        id: doc.id,
                        ...data
                    });
                }
            });

            console.log(`TRAINING: Found ${examples.length} examples for tenant ${tenantId}`);
            return examples;
        } catch (error) {
            console.error('TRAINING: Error getting training examples:', error);
            throw error;
        }
    }

    /**
     * Get examples for a specific intent
     * @param {string} tenantId - Tenant ID
     * @param {string} intentName - Intent name
     * @param {string} status - Filter by status
     * @returns {Promise<Object>} Examples and count
     */
    async getExamplesByIntent(tenantId, intentName, status = 'approved') {
        try {
            console.log(`TRAINING: Getting examples for intent ${intentName} in tenant ${tenantId}`);
            
            if (!tenantId || !intentName) {
                throw new Error('tenantId and intentName are required');
            }

            let query = this.db.collection('bot_training_examples')
                .where('tenantId', '==', tenantId)
                .where('intent', '==', intentName.toLowerCase().trim())
                .orderBy('createdAt', 'desc');

            if (status !== 'all') {
                query = query.where('status', '==', status);
            }

            const snapshot = await query.get();
            const examples = [];

            snapshot.forEach(doc => {
                examples.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            console.log(`TRAINING: Found ${examples.length} examples for intent ${intentName}`);
            
            return {
                examples,
                count: examples.length,
                intent: intentName
            };
        } catch (error) {
            console.error('TRAINING: Error getting examples by intent:', error);
            throw error;
        }
    }

    /**
     * Delete a training example
     * @param {string} exampleId - Example document ID
     * @param {string} tenantId - Tenant ID for security validation
     * @returns {Promise<boolean>} Success status
     */
    async deleteTrainingExample(exampleId, tenantId) {
        try {
            console.log(`TRAINING: Deleting example ${exampleId} for tenant ${tenantId}`);
            
            if (!exampleId || !tenantId) {
                throw new Error('exampleId and tenantId are required');
            }

            // First verify the example belongs to the tenant
            const docRef = this.db.collection('bot_training_examples').doc(exampleId);
            const doc = await docRef.get();

            if (!doc.exists) {
                throw new Error('Training example not found');
            }

            const data = doc.data();
            if (data.tenantId !== tenantId) {
                throw new Error('Access denied: Example does not belong to this tenant');
            }

            // Delete the example
            await docRef.delete();
            
            console.log(`TRAINING: Deleted example ${exampleId}`);
            
            // Decrement intent count
            await this.decrementIntentCount(tenantId, data.intent);

            return true;
        } catch (error) {
            console.error('TRAINING: Error deleting training example:', error);
            throw error;
        }
    }

    /**
     * Get count of untrained examples
     * @param {string} tenantId - Tenant ID
     * @returns {Promise<number>} Count of untrained examples
     */
    async getUntrainedExamplesCount(tenantId) {
        try {
            console.log(`TRAINING: Getting untrained count for tenant ${tenantId}`);
            
            if (!tenantId) {
                throw new Error('tenantId is required');
            }

            const snapshot = await this.db.collection('bot_training_examples')
                .where('tenantId', '==', tenantId)
                .where('status', '==', 'approved')
                .where('trainedAt', '==', null)
                .get();

            const count = snapshot.size;
            console.log(`TRAINING: Found ${count} untrained examples for tenant ${tenantId}`);
            
            return count;
        } catch (error) {
            console.error('TRAINING: Error getting untrained examples count:', error);
            throw error;
        }
    }

    /**
     * Add multiple training examples at once
     * @param {string} tenantId - Tenant ID
     * @param {string} businessId - Business ID
     * @param {string} intent - Intent name
     * @param {Array<string>} examples - Array of example texts
     * @param {string} createdBy - User email
     * @returns {Promise<Object>} Result with count of added examples
     */
    async addBulkTrainingExamples(tenantId, businessId, intent, examples, createdBy) {
        try {
            console.log(`TRAINING: Adding ${examples.length} bulk examples for tenant ${tenantId}, intent: ${intent}`);
            
            if (!Array.isArray(examples) || examples.length === 0) {
                throw new Error('Examples array is required and cannot be empty');
            }

            const batch = this.db.batch();
            let addedCount = 0;

            for (const exampleText of examples) {
                if (typeof exampleText === 'string' && exampleText.trim().length > 0) {
                    const docRef = this.db.collection('bot_training_examples').doc();
                    const exampleData = {
                        tenantId,
                        businessId,
                        intent: intent.toLowerCase().trim(),
                        exampleText: exampleText.trim(),
                        entities: [],
                        source: 'manual',
                        status: 'approved',
                        createdBy,
                        createdAt: FieldValue.serverTimestamp(),
                        trainedAt: null
                    };

                    batch.set(docRef, exampleData);
                    addedCount++;
                }
            }

            if (addedCount > 0) {
                await batch.commit();
                
                // Update intent example count
                await this.incrementIntentCount(tenantId, intent, addedCount);
                
                console.log(`TRAINING: Added ${addedCount} bulk examples for tenant ${tenantId}`);
            }

            return {
                success: true,
                count: addedCount,
                intent,
                tenantId
            };
        } catch (error) {
            console.error('TRAINING: Error adding bulk training examples:', error);
            throw error;
        }
    }

    // ========================================
    // INTENT MANAGEMENT
    // ========================================

    /**
     * Create or get an intent
     * @param {string} tenantId - Tenant ID
     * @param {string} intentName - Intent name (e.g., "view_catalog")
     * @param {string} displayName - Human-readable name (e.g., "View Products")
     * @param {string} description - Intent description
     * @param {string} responseTemplate - Default response template
     * @returns {Promise<Object>} Intent object
     */
    async getOrCreateIntent(tenantId, intentName, displayName, description, responseTemplate = '') {
        try {
            console.log(`TRAINING: Getting/creating intent ${intentName} for tenant ${tenantId}`);
            
            if (!tenantId || !intentName) {
                throw new Error('tenantId and intentName are required');
            }

            const normalizedIntentName = intentName.toLowerCase().trim();
            
            // Check if intent already exists
            const existingQuery = await this.db.collection('bot_intents')
                .where('tenantId', '==', tenantId)
                .where('intentName', '==', normalizedIntentName)
                .limit(1)
                .get();

            if (!existingQuery.empty) {
                const existingDoc = existingQuery.docs[0];
                console.log(`TRAINING: Found existing intent ${intentName} for tenant ${tenantId}`);
                return {
                    id: existingDoc.id,
                    ...existingDoc.data()
                };
            }

            // Create new intent
            const intentData = {
                tenantId,
                intentName: normalizedIntentName,
                displayName: displayName || normalizedIntentName,
                description: description || `Intent for ${normalizedIntentName}`,
                responseTemplate: responseTemplate || `Response for ${normalizedIntentName}`,
                isActive: true,
                exampleCount: 0,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp()
            };

            const docRef = await this.db.collection('bot_intents').add(intentData);
            
            console.log(`TRAINING: Created new intent ${intentName} for tenant ${tenantId}`);
            
            return {
                id: docRef.id,
                ...intentData,
                createdAt: new Date(),
                updatedAt: new Date()
            };
        } catch (error) {
            console.error('TRAINING: Error getting/creating intent:', error);
            throw error;
        }
    }

    /**
     * Get all intents for a tenant
     * @param {string} tenantId - Tenant ID
     * @param {boolean} activeOnly - Only return active intents
     * @returns {Promise<Array>} Array of intents
     */
    async getIntents(tenantId, activeOnly = true) {
        try {
            console.log(`TRAINING: Getting intents for tenant ${tenantId}, activeOnly: ${activeOnly}`);
            
            if (!tenantId) {
                throw new Error('tenantId is required');
            }

            let query = this.db.collection('bot_intents')
                .where('tenantId', '==', tenantId);

            if (activeOnly) {
                query = query.where('isActive', '==', true);
            }

            // Note: Removed orderBy to avoid composite index requirement
            // Results will be in document creation order

            const snapshot = await query.get();
            const intents = [];

            snapshot.forEach(doc => {
                intents.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            console.log(`TRAINING: Found ${intents.length} intents for tenant ${tenantId}`);
            return intents;
        } catch (error) {
            console.error('TRAINING: Error getting intents:', error);
            throw error;
        }
    }

    /**
     * Update intent example count
     * @param {string} tenantId - Tenant ID
     * @param {string} intentName - Intent name
     * @param {number} increment - Amount to increment (default: 1)
     * @returns {Promise<boolean>} Success status
     */
    async incrementIntentCount(tenantId, intentName, increment = 1) {
        try {
            console.log(`TRAINING: Incrementing count for intent ${intentName} by ${increment}`);
            
            if (!tenantId || !intentName) {
                throw new Error('tenantId and intentName are required');
            }

            const normalizedIntentName = intentName.toLowerCase().trim();
            
            const query = await this.db.collection('bot_intents')
                .where('tenantId', '==', tenantId)
                .where('intentName', '==', normalizedIntentName)
                .limit(1)
                .get();

            if (!query.empty) {
                const doc = query.docs[0];
                await doc.ref.update({
                    exampleCount: FieldValue.increment(increment),
                    updatedAt: FieldValue.serverTimestamp()
                });
                
                console.log(`TRAINING: Updated intent count for ${intentName}`);
            } else {
                console.log(`TRAINING: Intent ${intentName} not found, skipping count update`);
            }

            return true;
        } catch (error) {
            console.error('TRAINING: Error incrementing intent count:', error);
            throw error;
        }
    }

    /**
     * Decrement intent example count
     * @param {string} tenantId - Tenant ID
     * @param {string} intentName - Intent name
     * @param {number} decrement - Amount to decrement (default: 1)
     * @returns {Promise<boolean>} Success status
     */
    async decrementIntentCount(tenantId, intentName, decrement = 1) {
        try {
            console.log(`TRAINING: Decrementing count for intent ${intentName} by ${decrement}`);
            
            if (!tenantId || !intentName) {
                throw new Error('tenantId and intentName are required');
            }

            const normalizedIntentName = intentName.toLowerCase().trim();
            
            const query = await this.db.collection('bot_intents')
                .where('tenantId', '==', tenantId)
                .where('intentName', '==', normalizedIntentName)
                .limit(1)
                .get();

            if (!query.empty) {
                const doc = query.docs[0];
                const currentCount = doc.data().exampleCount || 0;
                const newCount = Math.max(0, currentCount - decrement);
                
                await doc.ref.update({
                    exampleCount: newCount,
                    updatedAt: FieldValue.serverTimestamp()
                });
                
                console.log(`TRAINING: Updated intent count for ${intentName} to ${newCount}`);
            }

            return true;
        } catch (error) {
            console.error('TRAINING: Error decrementing intent count:', error);
            throw error;
        }
    }

    /**
     * Get default intents that all businesses start with
     * @returns {Array} Array of default intent definitions
     */
    getDefaultIntents() {
        return [
            {
                intentName: 'greet',
                displayName: 'Greeting',
                description: 'Customer says hello or greets the bot',
                responseTemplate: 'Hello! How can I help you today?',
                examples: [
                    'hello',
                    'hi',
                    'hey',
                    'good morning',
                    'good afternoon',
                    'hi there'
                ]
            },
            {
                intentName: 'view_catalog',
                displayName: 'View Products',
                description: 'Customer wants to see products or menu',
                responseTemplate: 'Here are our products:',
                examples: [
                    'show me products',
                    'what do you have',
                    'show catalog',
                    'menu please',
                    'what can I buy'
                ]
            },
            {
                intentName: 'product_inquiry',
                displayName: 'Ask About Product',
                description: 'Customer asking about a specific product',
                responseTemplate: 'Let me help you with that product.',
                examples: [
                    'do you have chicken',
                    'how much is eggs',
                    'tell me about product',
                    'what is the price'
                ]
            },
            {
                intentName: 'place_order',
                displayName: 'Place Order',
                description: 'Customer wants to make a purchase',
                responseTemplate: 'Great! Let me help you place your order.',
                examples: [
                    'I want to order',
                    'can I buy',
                    'I need 5 chickens',
                    'place order'
                ]
            },
            {
                intentName: 'help',
                displayName: 'Help',
                description: 'Customer needs assistance',
                responseTemplate: 'I\'m here to help! What do you need?',
                examples: [
                    'help',
                    'I need help',
                    'how does this work',
                    'what can you do'
                ]
            }
        ];
    }

    // ========================================
    // TRAINING JOB MANAGEMENT
    // ========================================

    /**
     * Create a new training job
     * @param {string} tenantId - Tenant ID
     * @param {number} trainingDataCount - Number of training examples
     * @returns {Promise<Object>} Created training job
     */
    async createTrainingJob(tenantId, trainingDataCount = 0) {
        try {
            console.log(`TRAINING: Creating training job for tenant ${tenantId}`);
            
            if (!tenantId) {
                throw new Error('tenantId is required');
            }

            const jobData = {
                tenantId,
                status: 'queued',
                trainingDataCount,
                modelPath: null,
                accuracy: null,
                startedAt: null,
                completedAt: null,
                errorMessage: null,
                deployed: false,
                createdAt: FieldValue.serverTimestamp()
            };

            const docRef = await this.db.collection('bot_training_jobs').add(jobData);
            
            console.log(`TRAINING: Created training job ${docRef.id} for tenant ${tenantId}`);
            
            return {
                id: docRef.id,
                ...jobData,
                createdAt: new Date()
            };
        } catch (error) {
            console.error('TRAINING: Error creating training job:', error);
            throw error;
        }
    }

    /**
     * Update training job status
     * @param {string} jobId - Training job ID
     * @param {Object} updates - Updates to apply
     * @returns {Promise<boolean>} Success status
     */
    async updateTrainingJob(jobId, updates) {
        try {
            console.log(`TRAINING: Updating training job ${jobId}`);
            
            if (!jobId) {
                throw new Error('jobId is required');
            }

            const allowedUpdates = [
                'status', 'trainingDataCount', 'modelPath', 'accuracy',
                'startedAt', 'completedAt', 'errorMessage', 'deployed'
            ];

            const filteredUpdates = {};
            Object.keys(updates).forEach(key => {
                if (allowedUpdates.includes(key)) {
                    filteredUpdates[key] = updates[key];
                }
            });

            filteredUpdates.updatedAt = FieldValue.serverTimestamp();

            await this.db.collection('bot_training_jobs').doc(jobId).update(filteredUpdates);
            
            console.log(`TRAINING: Updated training job ${jobId}`);
            return true;
        } catch (error) {
            console.error('TRAINING: Error updating training job:', error);
            throw error;
        }
    }

    /**
     * Get latest training job for a tenant
     * @param {string} tenantId - Tenant ID
     * @returns {Promise<Object|null>} Latest training job or null
     */
    async getLatestTrainingJob(tenantId) {
        try {
            console.log(`TRAINING: Getting latest training job for tenant ${tenantId}`);
            
            if (!tenantId) {
                throw new Error('tenantId is required');
            }

            const snapshot = await this.db.collection('bot_training_jobs')
                .where('tenantId', '==', tenantId)
                .get();

            if (snapshot.empty) {
                console.log(`TRAINING: No training jobs found for tenant ${tenantId}`);
                return null;
            }

            // Sort by createdAt in JavaScript to avoid composite index requirement
            const jobs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Sort by createdAt descending and get the latest
            const latestJob = jobs.sort((a, b) => {
                const aTime = a.createdAt?.toDate?.() || new Date(a.createdAt);
                const bTime = b.createdAt?.toDate?.() || new Date(b.createdAt);
                return bTime - aTime;
            })[0];

            console.log(`TRAINING: Found latest training job ${latestJob.id} for tenant ${tenantId}`);
            
            return latestJob;
        } catch (error) {
            console.error('TRAINING: Error getting latest training job:', error);
            throw error;
        }
    }

    /**
     * Get training history for a tenant
     * @param {string} tenantId - Tenant ID
     * @param {number} limit - Maximum number of jobs to return
     * @returns {Promise<Array>} Array of training jobs
     */
    async getTrainingHistory(tenantId, limit = 10) {
        try {
            console.log(`TRAINING: Getting training history for tenant ${tenantId}`);
            
            if (!tenantId) {
                throw new Error('tenantId is required');
            }

            const snapshot = await this.db.collection('bot_training_jobs')
                .where('tenantId', '==', tenantId)
                .get();

            const jobs = [];
            snapshot.forEach(doc => {
                jobs.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            // Sort by createdAt descending and limit results in JavaScript
            const sortedJobs = jobs.sort((a, b) => {
                const aTime = a.createdAt?.toDate?.() || new Date(a.createdAt);
                const bTime = b.createdAt?.toDate?.() || new Date(b.createdAt);
                return bTime - aTime;
            }).slice(0, limit);

            console.log(`TRAINING: Found ${sortedJobs.length} training jobs for tenant ${tenantId}`);
            return sortedJobs;
        } catch (error) {
            console.error('TRAINING: Error getting training history:', error);
            throw error;
        }
    }

    /**
     * Mark all approved examples as trained
     * @param {string} tenantId - Tenant ID
     * @returns {Promise<number>} Number of examples marked as trained
     */
    async markExamplesAsTrained(tenantId) {
        try {
            console.log(`TRAINING: Marking examples as trained for tenant ${tenantId}`);
            
            if (!tenantId) {
                throw new Error('tenantId is required');
            }

            const snapshot = await this.db.collection('bot_training_examples')
                .where('tenantId', '==', tenantId)
                .where('status', '==', 'approved')
                .where('trainedAt', '==', null)
                .get();

            const batch = this.db.batch();
            let count = 0;

            snapshot.forEach(doc => {
                batch.update(doc.ref, {
                    status: 'trained',
                    trainedAt: FieldValue.serverTimestamp()
                });
                count++;
            });

            if (count > 0) {
                await batch.commit();
                console.log(`TRAINING: Marked ${count} examples as trained for tenant ${tenantId}`);
            }

            return count;
        } catch (error) {
            console.error('TRAINING: Error marking examples as trained:', error);
            throw error;
        }
    }

    /**
     * Initialize default intents for a new tenant
     * @param {string} tenantId - Tenant ID
     * @param {string} businessId - Business ID
     * @param {string} createdBy - User email
     * @returns {Promise<Object>} Result with counts
     */
    async initializeDefaultIntents(tenantId, businessId, createdBy) {
        try {
            console.log(`TRAINING: Initializing default intents for tenant ${tenantId}`);
            
            if (!tenantId || !businessId || !createdBy) {
                throw new Error('tenantId, businessId, and createdBy are required');
            }

            const defaultIntents = this.getDefaultIntents();
            const batch = this.db.batch();
            let intentCount = 0;
            let exampleCount = 0;

            // Create intents
            for (const intent of defaultIntents) {
                const intentRef = this.db.collection('bot_intents').doc();
                const intentData = {
                    tenantId,
                    intentName: intent.intentName,
                    displayName: intent.displayName,
                    description: intent.description,
                    responseTemplate: intent.responseTemplate,
                    isActive: true,
                    exampleCount: intent.examples.length,
                    createdAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp()
                };
                batch.set(intentRef, intentData);
                intentCount++;

                // Create training examples for this intent
                for (const exampleText of intent.examples) {
                    const exampleRef = this.db.collection('bot_training_examples').doc();
                    const exampleData = {
                        tenantId,
                        businessId,
                        intent: intent.intentName,
                        exampleText,
                        entities: [],
                        source: 'default',
                        status: 'approved',
                        createdBy,
                        createdAt: FieldValue.serverTimestamp(),
                        trainedAt: null
                    };
                    batch.set(exampleRef, exampleData);
                    exampleCount++;
                }
            }

            await batch.commit();
            
            console.log(`TRAINING: Initialized ${intentCount} intents and ${exampleCount} examples for tenant ${tenantId}`);
            
            return {
                success: true,
                intentCount,
                exampleCount,
                tenantId
            };
        } catch (error) {
            console.error('TRAINING: Error initializing default intents:', error);
            throw error;
        }
    }
}

module.exports = TrainingDataService;
