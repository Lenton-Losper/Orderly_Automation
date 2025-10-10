#!/usr/bin/env node

/**
 * Test script for Bot Training Pipeline Service
 * Tests the complete training pipeline from data collection to model deployment
 */

require('dotenv').config();
const { initializeFirebase } = require('./src/config/database');
const BotTrainingService = require('./src/services/botTrainingService');
const TrainingDataService = require('./src/services/trainingDataService');

async function testTrainingPipeline() {
    console.log('🤖 Testing Bot Training Pipeline Service...\n');

    try {
        // Initialize Firebase first
        await initializeFirebase();
        console.log('✅ Firebase initialized successfully');

        // Initialize services
        const trainingDataService = new TrainingDataService();
        await trainingDataService.initialize();
        console.log('✅ Training Data Service initialized');

        const botTrainingService = new BotTrainingService();
        await botTrainingService.initialize();
        console.log('✅ Bot Training Service initialized\n');

        // Test data
        const testTenantId = 'tenant_pipeline_test_123';
        const testBusinessId = '264813141453';
        const testUser = 'pipeline@test.com';

        console.log('📝 Setting up test data...');

        // Initialize default intents
        await trainingDataService.initializeDefaultIntents(testTenantId, testBusinessId, testUser);
        console.log('✅ Default intents initialized');

        // Add additional training examples
        const additionalExamples = [
            { intent: 'greet', examples: ['good evening', 'hello there', 'hiya'] },
            { intent: 'view_catalog', examples: ['show me your items', 'what products do you have', 'display your catalog'] },
            { intent: 'product_inquiry', examples: ['tell me about chicken prices', 'how much for eggs', 'what is the cost'] },
            { intent: 'place_order', examples: ['I want to buy', 'can I purchase', 'add to my order'] },
            { intent: 'help', examples: ['I need assistance', 'can you help me', 'support please'] }
        ];

        for (const { intent, examples } of additionalExamples) {
            await trainingDataService.addBulkTrainingExamples(
                testTenantId, 
                testBusinessId, 
                intent, 
                examples, 
                testUser
            );
            console.log(`✅ Added ${examples.length} examples for intent: ${intent}`);
        }

        console.log('\n📊 Training data summary:');
        const allExamples = await trainingDataService.getTrainingExamples(testTenantId, 'approved');
        const intents = await trainingDataService.getIntents(testTenantId);
        
        console.log(`   Total examples: ${allExamples.length}`);
        console.log(`   Total intents: ${intents.length}`);
        console.log(`   Intents: ${intents.map(i => i.intentName).join(', ')}`);

        console.log('\n🤖 Starting training pipeline...');
        
        // Test the complete training pipeline
        const result = await botTrainingService.trainBotForTenant(testTenantId);
        
        console.log('\n🎉 Training pipeline completed successfully!');
        console.log('Results:', {
            jobId: result.jobId,
            modelPath: result.modelPath,
            accuracy: `${(result.accuracy * 100).toFixed(2)}%`,
            deployed: result.deployed,
            trainedExamples: result.trainedExamples,
            totalExamples: result.totalExamples,
            intents: result.intents
        });

        console.log('\n📈 Testing training status...');
        const status = await botTrainingService.getTrainingStatus(testTenantId);
        console.log('Status:', {
            isTraining: status.isTraining,
            lastTrained: status.lastTrained,
            modelDeployed: status.modelDeployed,
            untrainedCount: status.untrainedCount,
            totalExamples: status.totalExamples
        });

        console.log('\n🧹 Testing cleanup...');
        await botTrainingService.cleanupOldFiles(testTenantId, 0); // Clean all files for testing
        console.log('✅ Cleanup completed');

        console.log('\n🎉 All pipeline tests passed successfully!');

    } catch (error) {
        console.error('❌ Pipeline test failed:', error);
        process.exit(1);
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    testTrainingPipeline()
        .then(() => {
            console.log('\n✅ Pipeline testing completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Pipeline testing failed:', error);
            process.exit(1);
        });
}

module.exports = { testTrainingPipeline };


