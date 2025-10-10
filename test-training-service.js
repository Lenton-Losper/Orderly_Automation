#!/usr/bin/env node

/**
 * Test script for Training Data Service
 * Tests the Firebase service and API endpoints
 */

require('dotenv').config();
const { initializeFirebase } = require('./src/config/database');
const TrainingDataService = require('./src/services/trainingDataService');

async function testTrainingService() {
    console.log('🧪 Testing Training Data Service...\n');

    try {
        // Initialize Firebase first
        await initializeFirebase();
        console.log('✅ Firebase initialized successfully');

        // Initialize service
        const service = new TrainingDataService();
        await service.initialize();
        console.log('✅ Service initialized successfully\n');

        // Test data
        const testTenantId = 'tenant_test_123';
        const testBusinessId = '264813141453';
        const testUser = 'test@example.com';

        console.log('📝 Testing Intent Management...');
        
        // Test creating an intent
        const intent = await service.getOrCreateIntent(
            testTenantId,
            'test_intent',
            'Test Intent',
            'This is a test intent',
            'Test response'
        );
        console.log('✅ Created intent:', intent.intentName);

        // Test getting intents
        const intents = await service.getIntents(testTenantId);
        console.log('✅ Retrieved intents:', intents.length);

        console.log('\n📝 Testing Training Examples...');

        // Test adding training example
        const example = await service.addTrainingExample({
            tenantId: testTenantId,
            businessId: testBusinessId,
            intent: 'test_intent',
            exampleText: 'This is a test example',
            createdBy: testUser
        });
        console.log('✅ Added training example:', example.id);

        // Test getting examples
        const examples = await service.getTrainingExamples(testTenantId);
        console.log('✅ Retrieved examples:', examples.length);

        // Test getting examples by intent
        const intentExamples = await service.getExamplesByIntent(testTenantId, 'test_intent');
        console.log('✅ Retrieved examples by intent:', intentExamples.count);

        console.log('\n📝 Testing Training Jobs...');

        // Test creating training job
        const job = await service.createTrainingJob(testTenantId, 1);
        console.log('✅ Created training job:', job.id);

        // Test getting latest job
        const latestJob = await service.getLatestTrainingJob(testTenantId);
        console.log('✅ Retrieved latest job:', latestJob?.id);

        // Test getting untrained count
        const untrainedCount = await service.getUntrainedExamplesCount(testTenantId);
        console.log('✅ Untrained examples count:', untrainedCount);

        console.log('\n📝 Testing Default Intents...');

        // Test getting default intents
        const defaultIntents = service.getDefaultIntents();
        console.log('✅ Default intents count:', defaultIntents.length);

        console.log('\n🎉 All tests passed successfully!');

    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    testTrainingService()
        .then(() => {
            console.log('\n✅ Testing completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Testing failed:', error);
            process.exit(1);
        });
}

module.exports = { testTrainingService };
