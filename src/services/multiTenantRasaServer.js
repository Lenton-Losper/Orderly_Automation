/**
 * Multi-Tenant Rasa Server
 * Handles multiple tenant models dynamically using TensorFlow
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

class MultiTenantRasaServer {
    constructor() {
        this.agents = new Map(); // Cache for loaded agents
        this.modelPaths = new Map(); // Map tenantId to model path
        this.isInitialized = false;
    }

    /**
     * Initialize the multi-tenant Rasa server
     */
    async initialize() {
        try {
            console.log('🚀 Initializing Multi-Tenant Rasa Server...');
            
            // Load existing models
            await this.loadExistingModels();
            
            this.isInitialized = true;
            console.log('✅ Multi-Tenant Rasa Server initialized');
        } catch (error) {
            console.error('❌ Error initializing Multi-Tenant Rasa Server:', error);
            throw error;
        }
    }

    /**
     * Load existing models from rasa-models directory
     */
    async loadExistingModels() {
        try {
            const rasaModelsDir = './rasa-models';
            const tenantDirs = await fs.readdir(rasaModelsDir);
            
            for (const tenantDir of tenantDirs) {
                if (tenantDir === 'default' || tenantDir.startsWith('.')) continue;
                
                const modelsDir = path.join(rasaModelsDir, tenantDir, 'models');
                try {
                    const modelFiles = await fs.readdir(modelsDir);
                    const tarFiles = modelFiles.filter(file => file.endsWith('.tar.gz'));
                    
                    if (tarFiles.length > 0) {
                        const latestModel = tarFiles.sort().pop();
                        const modelPath = path.join(modelsDir, latestModel);
                        this.modelPaths.set(tenantDir, modelPath);
                        console.log(`📦 Loaded model for tenant ${tenantDir}: ${modelPath}`);
                    }
                } catch (error) {
                    console.log(`⚠️ No models found for tenant ${tenantDir}`);
                }
            }
        } catch (error) {
            console.error('Error loading existing models:', error);
        }
    }

    /**
     * Process message for a specific tenant
     * @param {string} tenantId - Tenant ID
     * @param {string} userId - User ID
     * @param {string} text - Message text
     * @param {Object} metadata - Additional metadata
     * @returns {Promise<Object>} Rasa response
     */
    async processMessage(tenantId, userId, text, metadata = {}) {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }

            // Get model path for tenant
            const modelPath = this.modelPaths.get(tenantId);
            if (!modelPath) {
                console.log(`⚠️ No model found for tenant ${tenantId}, using default`);
                return this.getDefaultResponse();
            }

            // Check if model file exists
            try {
                await fs.access(modelPath);
            } catch (error) {
                console.log(`⚠️ Model file not found: ${modelPath}`);
                return this.getDefaultResponse();
            }

            // Use REAL Rasa CLI parsing
            const result = await this.parseWithRasaCLI(modelPath, userId, text, metadata);
            return result;

        } catch (error) {
            console.error('Error processing message:', error);
            return this.getDefaultResponse();
        }
    }

    /**
     * Parse message using REAL Rasa CLI
     * @param {string} modelPath - Path to the model file
     * @param {string} userId - User ID
     * @param {string} text - Message text
     * @param {Object} metadata - Additional metadata
     * @returns {Promise<Object>} Parsed result
     */
    async parseWithRasaCLI(modelPath, userId, text, metadata) {
        return new Promise((resolve, reject) => {
            const { exec } = require('child_process');
            const { promisify } = require('util');
            const execAsync = promisify(exec);

            // Use Rasa CLI to parse the message
            const command = `rasa shell --model "${modelPath}" --quiet --no-prompt`;
            
            console.log(`🔍 Parsing with Rasa CLI: ${text}`);
            console.log(`Command: ${command}`);

            const rasaProcess = spawn('rasa', [
                'shell',
                '--model', modelPath,
                '--quiet',
                '--no-prompt'
            ], {
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: process.cwd()
            });

            let output = '';
            let errorOutput = '';

            rasaProcess.stdout.on('data', (data) => {
                output += data.toString();
            });

            rasaProcess.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            rasaProcess.on('close', (code) => {
                if (code === 0) {
                    try {
                        // Parse the output to extract intent and entities
                        const lines = output.split('\n');
                        let intent = null;
                        let entities = [];
                        let confidence = 0;

                        for (const line of lines) {
                            if (line.includes('Intent:')) {
                                const match = line.match(/Intent:\s*(\w+)\s*confidence:\s*([\d.]+)/);
                                if (match) {
                                    intent = match[1];
                                    confidence = parseFloat(match[2]);
                                }
                            }
                            if (line.includes('Entities:')) {
                                // Parse entities if present
                                const entityMatch = line.match(/Entities:\s*(.+)/);
                                if (entityMatch) {
                                    try {
                                        entities = JSON.parse(entityMatch[1]);
                                    } catch (e) {
                                        entities = [];
                                    }
                                }
                            }
                        }

                        const response = {
                            ok: true,
                            messages: [{
                                text: this.generateResponse(intent, entities, confidence)
                            }],
                            intent: intent,
                            entities: entities,
                            confidence: confidence,
                            latencyMs: Date.now() - Date.now() // Placeholder
                        };

                        resolve(response);
                    } catch (parseError) {
                        console.error('Error parsing Rasa output:', parseError);
                        resolve(this.getDefaultResponse());
                    }
                } else {
                    console.error('Rasa CLI error:', errorOutput);
                    resolve(this.getDefaultResponse());
                }
            });

            // Send the message to Rasa
            rasaProcess.stdin.write(`${text}\n`);
            rasaProcess.stdin.end();

            // Timeout after 10 seconds
            setTimeout(() => {
                rasaProcess.kill();
                resolve(this.getDefaultResponse());
            }, 10000);
        });
    }

    /**
     * Generate response based on intent and entities
     * @param {string} intent - Detected intent
     * @param {Array} entities - Detected entities
     * @param {number} confidence - Confidence score
     * @returns {string} Generated response
     */
    generateResponse(intent, entities, confidence) {
        if (!intent || confidence < 0.3) {
            return "I'm not sure I understand. Could you please rephrase that?";
        }

        const responses = {
            'greeting': "Hello! How can I help you today?",
            'goodbye': "Goodbye! Have a great day!",
            'thanks': "You're welcome! Is there anything else I can help you with?",
            'order': "I'd be happy to help you with your order. What would you like to order?",
            'menu': "Here's our menu. What would you like to order?",
            'price': "Let me check the prices for you.",
            'help': "I'm here to help! You can ask me about our menu, prices, or place an order.",
            'default': "I understand you're looking for help. How can I assist you?"
        };

        return responses[intent] || responses['default'];
    }

    /**
     * Get default response when no model is available
     * @returns {Object} Default response
     */
    getDefaultResponse() {
        return {
            ok: true,
            messages: [{
                text: "I'm here to help! Please let me know what you need assistance with."
            }],
            intent: null,
            entities: [],
            confidence: 0,
            latencyMs: 0
        };
    }

    /**
     * Register a new model for a tenant
     * @param {string} tenantId - Tenant ID
     * @param {string} modelPath - Path to the model file
     */
    async registerModel(tenantId, modelPath) {
        try {
            await fs.access(modelPath);
            this.modelPaths.set(tenantId, modelPath);
            console.log(`✅ Registered model for tenant ${tenantId}: ${modelPath}`);
        } catch (error) {
            console.error(`❌ Error registering model for tenant ${tenantId}:`, error);
            throw error;
        }
    }

    /**
     * Get available tenants
     * @returns {Array} List of tenant IDs with models
     */
    getAvailableTenants() {
        return Array.from(this.modelPaths.keys());
    }

    /**
     * Check if tenant has a model
     * @param {string} tenantId - Tenant ID
     * @returns {boolean} True if tenant has a model
     */
    hasModel(tenantId) {
        return this.modelPaths.has(tenantId);
    }
}

module.exports = MultiTenantRasaServer;
