const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// Colors for console output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

const log = {
    success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
    error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
    warning: (msg) => console.log(`${colors.yellow}⚠️ ${msg}${colors.reset}`),
    info: (msg) => console.log(`${colors.blue}📋 ${msg}${colors.reset}`),
    progress: (msg) => console.log(`${colors.cyan}🔄 ${msg}${colors.reset}`),
    header: (msg) => console.log(`${colors.bold}${colors.cyan}${msg}${colors.reset}`),
    separator: () => console.log(`${colors.cyan}═══════════════════════════════════════${colors.reset}`)
};

class BotTrainingTester {
    constructor() {
        this.baseUrl = 'http://localhost:3001';
        this.tenantId = '7dx8fLr4OdAPsSDAoTRl';
        this.testExamples = [];
        this.trainingJobId = null;
        this.startTime = Date.now();
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async checkPort(port) {
        try {
            const { exec } = require('child_process');
            const { promisify } = require('util');
            const execAsync = promisify(exec);
            
            const result = await execAsync(`netstat -ano | findstr :${port}`);
            return result.stdout.trim().length > 0;
        } catch (error) {
            return false;
        }
    }

    async testApiConnection(url, timeout = 5000) {
        try {
            const response = await axios.get(url, { timeout });
            return { success: true, data: response.data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async phase1_EnvironmentCheck() {
        log.header('📋 Phase 1: Environment Check');
        
        // Check port 3001
        const port3001InUse = await this.checkPort(3001);
        if (port3001InUse) {
            log.success('Port 3001: Bot Training API appears to be running');
        } else {
            log.warning('Port 3001: Available (Bot Training API not running)');
        }

        // Test Bot Training API health
        const healthCheck = await this.testApiConnection(`${this.baseUrl}/health`);
        if (healthCheck.success) {
            log.success('Bot Training API: Connected and healthy');
        } else {
            log.error(`Bot Training API: ${healthCheck.error}`);
            return false;
        }

        // Check model directory
        try {
            const modelDir = `./rasa-models/${this.tenantId}`;
            await fs.access(modelDir);
            log.success(`Model directory: Exists (${modelDir})`);
        } catch (error) {
            log.warning(`Model directory: Missing (${modelDir}) - will be created during training`);
        }

        return true;
    }

    async phase2_AddTrainingExamples() {
        log.header('📋 Phase 2: Adding Training Examples');
        
        const examples = [
            {
                tenantId: this.tenantId,
                businessId: this.tenantId,
                intent: "greet",
                exampleText: "Hey there friend",
                entities: [],
                source: "manual",
                createdBy: "test-automation@example.com"
            },
            {
                tenantId: this.tenantId,
                businessId: this.tenantId,
                intent: "bye",
                exampleText: "Talk to you later",
                entities: [],
                source: "manual",
                createdBy: "test-automation@example.com"
            },
            {
                tenantId: this.tenantId,
                businessId: this.tenantId,
                intent: "product_inquiry",
                exampleText: "What deals do you have today?",
                entities: [],
                source: "manual",
                createdBy: "test-automation@example.com"
            },
            {
                tenantId: this.tenantId,
                businessId: this.tenantId,
                intent: "greet",
                exampleText: "Good morning!",
                entities: [],
                source: "manual",
                createdBy: "test-automation@example.com"
            },
            {
                tenantId: this.tenantId,
                businessId: this.tenantId,
                intent: "greet",
                exampleText: "Hello there",
                entities: [],
                source: "manual",
                createdBy: "test-automation@example.com"
            },
            {
                tenantId: this.tenantId,
                businessId: this.tenantId,
                intent: "bye",
                exampleText: "See you soon",
                entities: [],
                source: "manual",
                createdBy: "test-automation@example.com"
            },
            {
                tenantId: this.tenantId,
                businessId: this.tenantId,
                intent: "bye",
                exampleText: "Goodbye",
                entities: [],
                source: "manual",
                createdBy: "test-automation@example.com"
            },
            {
                tenantId: this.tenantId,
                businessId: this.tenantId,
                intent: "product_inquiry",
                exampleText: "What products are available?",
                entities: [],
                source: "manual",
                createdBy: "test-automation@example.com"
            },
            {
                tenantId: this.tenantId,
                businessId: this.tenantId,
                intent: "product_inquiry",
                exampleText: "Tell me about your services",
                entities: [],
                source: "manual",
                createdBy: "test-automation@example.com"
            },
            {
                tenantId: this.tenantId,
                businessId: this.tenantId,
                intent: "product_inquiry",
                exampleText: "What can you help me with?",
                entities: [],
                source: "manual",
                createdBy: "test-automation@example.com"
            }
        ];

        for (let i = 0; i < examples.length; i++) {
            try {
                const response = await axios.post(`${this.baseUrl}/api/bot/training/examples`, examples[i]);
                if (response.data.success) {
                    this.testExamples.push(response.data.example);
                    log.success(`Example ${i + 1} created: ${response.data.example.id}`);
                } else {
                    log.error(`Example ${i + 1} failed: ${response.data.error}`);
                }
            } catch (error) {
                log.error(`Example ${i + 1} error: ${error.message}`);
            }
        }

        return this.testExamples.length > 0;
    }

    async phase3_VerifyExamplesSaved() {
        log.header('📋 Phase 3: Verifying Examples Saved');
        
        try {
            const response = await axios.get(`${this.baseUrl}/api/bot/training/examples?tenantId=${this.tenantId}&status=all`);
            const examples = response.data.examples;
            const untrainedCount = examples.filter(ex => ex.status === 'approved').length;
            
            log.success(`Total examples: ${examples.length}`);
            log.success(`Untrained examples: ${untrainedCount}`);
            
            // Verify our test examples are there
            const testExampleIds = this.testExamples.map(ex => ex.id);
            const foundExamples = examples.filter(ex => testExampleIds.includes(ex.id));
            
            if (foundExamples.length === this.testExamples.length) {
                log.success(`All ${this.testExamples.length} test examples found in database`);
            } else {
                log.warning(`Only ${foundExamples.length}/${this.testExamples.length} test examples found`);
            }
            
            return true;
        } catch (error) {
            log.error(`Failed to verify examples: ${error.message}`);
            return false;
        }
    }

    async phase4_StartTraining() {
        log.header('📋 Phase 4: Starting Training');
        
        try {
            log.progress(`Initiating training for tenant ${this.tenantId}`);
            const response = await axios.post(`${this.baseUrl}/api/bot/training/train`, {
                tenantId: this.tenantId
            });
            
            if (response.data.success) {
                this.trainingJobId = response.data.jobId;
                log.success(`Training job created: ${this.trainingJobId}`);
                log.info(`Status: ${response.data.status}`);
                log.info(`Untrained count: ${response.data.untrainedCount}`);
                log.info(`Total examples: ${response.data.totalExamples}`);
                return true;
            } else {
                log.error(`Training start failed: ${response.data.error}`);
                return false;
            }
        } catch (error) {
            log.error(`Training start error: ${error.message}`);
            return false;
        }
    }

    async phase5_MonitorTrainingProgress() {
        log.header('📋 Phase 5: Monitoring Training Progress');
        
        if (!this.trainingJobId) {
            log.error('No training job ID available for monitoring');
            return false;
        }

        const maxWaitTime = 120000; // 2 minutes
        const pollInterval = 3000; // 3 seconds
        const startTime = Date.now();
        
        log.progress(`Monitoring job ${this.trainingJobId}...`);
        
        while (Date.now() - startTime < maxWaitTime) {
            try {
                const response = await axios.get(`${this.baseUrl}/api/bot/training/status/${this.trainingJobId}?tenantId=${this.tenantId}`);
                const job = response.data.job;
                const elapsed = Math.round((Date.now() - startTime) / 1000);
                
                if (job.status === 'completed') {
                    log.success(`[${elapsed}s] Training completed!`);
                    log.info(`Final status: ${job.status}`);
                    if (job.progress) log.info(`Final progress: ${job.progress}%`);
                    return true;
                } else if (job.status === 'failed') {
                    log.error(`[${elapsed}s] Training failed: ${job.error || 'Unknown error'}`);
                    return false;
                } else {
                    const progress = job.progress ? ` | Progress: ${job.progress}%` : '';
                    log.progress(`[${elapsed}s] Status: ${job.status}${progress}`);
                }
                
                await this.delay(pollInterval);
            } catch (error) {
                log.error(`Error monitoring training: ${error.message}`);
                await this.delay(pollInterval);
            }
        }
        
        log.error('Training monitoring timed out after 2 minutes');
        return false;
    }

    async phase6_VerifyTrainingResults() {
        log.header('📋 Phase 6: Verifying Training Results');
        
        try {
            // Get final job status
            const response = await axios.get(`${this.baseUrl}/api/bot/training/status/${this.trainingJobId}?tenantId=${this.tenantId}`);
            const job = response.data.job;
            
            log.info('Training job details:');
            log.info(`  - Job ID: ${job.id}`);
            log.info(`  - Status: ${job.status}`);
            log.info(`  - Started: ${job.startedAt}`);
            log.info(`  - Completed: ${job.completedAt}`);
            log.info(`  - Examples trained: ${job.trainingDataCount}`);
            log.info(`  - Accuracy: ${job.accuracy || 'N/A'}`);
            log.info(`  - Model path: ${job.modelPath || 'N/A'}`);
            
            // Check if model file exists
            if (job.modelPath) {
                try {
                    await fs.access(job.modelPath);
                    const stats = await fs.stat(job.modelPath);
                    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
                    log.success(`Model file created: ${path.basename(job.modelPath)} (${sizeMB} MB)`);
                } catch (error) {
                    log.warning(`Model file not found: ${job.modelPath}`);
                }
            }
            
            // Verify examples are marked as trained
            const examplesResponse = await axios.get(`${this.baseUrl}/api/bot/training/examples?tenantId=${this.tenantId}&status=all`);
            const examples = examplesResponse.data.examples;
            const trainedCount = examples.filter(ex => ex.status === 'trained').length;
            
            log.success(`Examples marked as trained: ${trainedCount}`);
            
            return job.status === 'completed';
        } catch (error) {
            log.error(`Error verifying results: ${error.message}`);
            return false;
        }
    }

    async phase7_SummaryReport() {
        log.header('📋 Phase 7: Test Summary');
        log.separator();
        
        const totalDuration = Math.round((Date.now() - this.startTime) / 1000);
        
        log.info(`Total test duration: ${totalDuration} seconds`);
        log.info(`Test examples created: ${this.testExamples.length}`);
        log.info(`Training job ID: ${this.trainingJobId || 'N/A'}`);
        
        if (this.trainingJobId) {
            log.success('Bot training system is fully operational!');
            log.info('');
            log.info('Next steps:');
            log.info('→ Test from frontend UI');
            log.info('→ Verify model can be loaded for predictions');
            log.info('→ Test with additional training examples');
        } else {
            log.error('Bot training system test failed');
        }
        
        log.separator();
    }

    async runFullTest() {
        log.header('🚀 BOT TRAINING SYSTEM TEST');
        log.separator();
        
        try {
            // Phase 1: Environment Check
            const envOk = await this.phase1_EnvironmentCheck();
            if (!envOk) {
                log.error('Environment check failed. Cannot proceed with testing.');
                return;
            }
            
            log.info('');
            
            // Phase 2: Add Training Examples
            const examplesOk = await this.phase2_AddTrainingExamples();
            if (!examplesOk) {
                log.error('Failed to add training examples. Cannot proceed with testing.');
                return;
            }
            
            log.info('');
            
            // Phase 3: Verify Examples Saved
            const verifyOk = await this.phase3_VerifyExamplesSaved();
            if (!verifyOk) {
                log.error('Failed to verify examples. Cannot proceed with testing.');
                return;
            }
            
            log.info('');
            
            // Phase 4: Start Training
            const trainingStarted = await this.phase4_StartTraining();
            if (!trainingStarted) {
                log.error('Failed to start training. Cannot proceed with testing.');
                return;
            }
            
            log.info('');
            
            // Phase 5: Monitor Training Progress
            const trainingCompleted = await this.phase5_MonitorTrainingProgress();
            if (!trainingCompleted) {
                log.error('Training did not complete successfully.');
                return;
            }
            
            log.info('');
            
            // Phase 6: Verify Training Results
            const resultsOk = await this.phase6_VerifyTrainingResults();
            if (!resultsOk) {
                log.error('Training results verification failed.');
                return;
            }
            
            log.info('');
            
            // Phase 7: Summary Report
            await this.phase7_SummaryReport();
            
        } catch (error) {
            log.error(`Test suite error: ${error.message}`);
            console.error(error);
        }
    }
}

// Run the test
async function main() {
    const tester = new BotTrainingTester();
    await tester.runFullTest();
}

main().catch(console.error);
