/**
 * Training API Routes
 * Handles all bot training related endpoints
 */

const express = require('express');
const TrainingDataService = require('../services/trainingDataService');
const BotTrainingService = require('../services/botTrainingService');

const router = express.Router();

// Initialize services
let trainingDataService = null;
let botTrainingService = null;

// Initialize services on first request
const initializeServices = async () => {
    if (!trainingDataService) {
        trainingDataService = new TrainingDataService();
        await trainingDataService.initialize();
    }
    if (!botTrainingService) {
        botTrainingService = new BotTrainingService();
        await botTrainingService.initialize();
    }
    return { trainingDataService, botTrainingService };
};

// Middleware to verify tenant access
const verifyTenantAccess = (req, res, next) => {
    const requestedTenantId = req.query.tenantId || req.body.tenantId;
    
    // For now, we'll allow all requests - in production, verify against user session
    // TODO: Implement proper authentication middleware
    if (!requestedTenantId) {
        return res.status(400).json({ 
            success: false, 
            error: 'tenantId is required' 
        });
    }
    
    req.tenantId = requestedTenantId;
    next();
};

// ========================================
// TRAINING EXAMPLES ENDPOINTS
// ========================================

/**
 * POST /api/bot/training/examples
 * Add a new training example
 */
router.post('/examples', verifyTenantAccess, async (req, res) => {
    try {
        const { trainingDataService } = await initializeServices();
        const { tenantId, businessId, intent, exampleText, entities, createdBy, source } = req.body;

        if (!businessId || !intent || !exampleText || !createdBy) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: businessId, intent, exampleText, createdBy'
            });
        }

        const example = await trainingDataService.addTrainingExample({
            tenantId,
            businessId,
            intent,
            exampleText,
            entities,
            createdBy,
            source
        });

        res.status(201).json({
            success: true,
            example
        });
    } catch (error) {
        console.error('API: Error adding training example:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to add training example'
        });
    }
});

/**
 * GET /api/bot/training/examples
 * Get all training examples for a tenant
 */
router.get('/examples', verifyTenantAccess, async (req, res) => {
    try {
        const { trainingDataService } = await initializeServices();
        const { tenantId } = req.query;
        const { status = 'approved', limit = 100 } = req.query;

        console.log(`API: GET examples request for tenant ${tenantId}, status: ${status}, limit: ${limit}`);

        const examples = await trainingDataService.getTrainingExamples(tenantId, status, parseInt(limit));

        console.log(`API: Found ${examples.length} examples for tenant ${tenantId}`);
        res.json({
            success: true,
            examples,
            count: examples.length,
            tenantId
        });
    } catch (error) {
        console.error('API: Error getting training examples:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get training examples',
            code: 'INTERNAL_ERROR'
        });
    }
});

/**
 * GET /api/bot/training/examples/:intentName
 * Get examples for a specific intent
 */
router.get('/examples/:intentName', verifyTenantAccess, async (req, res) => {
    try {
        const { trainingDataService } = await initializeServices();
        const { tenantId } = req.query;
        const { intentName } = req.params;
        const { status = 'approved' } = req.query;

        const result = await trainingDataService.getExamplesByIntent(tenantId, intentName, status);

        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('API: Error getting examples by intent:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get examples by intent'
        });
    }
});

/**
 * DELETE /api/bot/training/examples/:exampleId
 * Delete a training example
 */
router.delete('/examples/:exampleId', verifyTenantAccess, async (req, res) => {
    try {
        const { trainingDataService } = await initializeServices();
        const { exampleId } = req.params;
        const { tenantId } = req.query;

        console.log(`API: DELETE request for example ${exampleId}, tenant ${tenantId}`);

        await trainingDataService.deleteTrainingExample(exampleId, tenantId);

        console.log(`API: Successfully deleted example ${exampleId}`);
        res.json({
            success: true,
            message: 'Training example deleted successfully'
        });
    } catch (error) {
        console.error('API: Error deleting training example:', error);
        
        // Return 404 for non-existent documents, 500 for other errors
        if (error.message === 'Training example not found') {
            res.status(404).json({
                success: false,
                error: 'Training example not found',
                code: 'EXAMPLE_NOT_FOUND'
            });
        } else if (error.message === 'Access denied: Example does not belong to this tenant') {
            res.status(403).json({
                success: false,
                error: 'Access denied: Example does not belong to this tenant',
                code: 'ACCESS_DENIED'
            });
        } else {
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to delete training example',
                code: 'INTERNAL_ERROR'
            });
        }
    }
});

/**
 * POST /api/bot/training/examples/bulk
 * Add multiple training examples at once
 */
router.post('/examples/bulk', verifyTenantAccess, async (req, res) => {
    try {
        const { trainingDataService } = await initializeServices();
        const { tenantId, businessId, intent, examples, createdBy } = req.body;

        if (!businessId || !intent || !Array.isArray(examples) || !createdBy) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: businessId, intent, examples (array), createdBy'
            });
        }

        const result = await trainingDataService.addBulkTrainingExamples(tenantId, businessId, intent, examples, createdBy);

        res.status(201).json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('API: Error adding bulk training examples:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to add bulk training examples'
        });
    }
});

/**
 * GET /api/bot/training/examples/count/untrained
 * Get count of untrained examples
 */
router.get('/examples/count/untrained', verifyTenantAccess, async (req, res) => {
    try {
        const { trainingDataService } = await initializeServices();
        const { tenantId } = req.query;

        const count = await trainingDataService.getUntrainedExamplesCount(tenantId);

        res.json({
            success: true,
            count,
            tenantId
        });
    } catch (error) {
        console.error('API: Error getting untrained count:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get untrained count'
        });
    }
});

// ========================================
// INTENT MANAGEMENT ENDPOINTS
// ========================================

/**
 * GET /api/bot/intents
 * Get all intents for a tenant
 */
router.get('/intents', verifyTenantAccess, async (req, res) => {
    try {
        const { trainingDataService } = await initializeServices();
        const { tenantId } = req.query;
        const { activeOnly = true } = req.query;

        const intents = await trainingDataService.getIntents(tenantId, activeOnly === 'true');

        res.json({
            success: true,
            intents,
            count: intents.length,
            tenantId
        });
    } catch (error) {
        console.error('API: Error getting intents:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get intents'
        });
    }
});

/**
 * POST /api/bot/intents
 * Create a new intent
 */
router.post('/intents', verifyTenantAccess, async (req, res) => {
    try {
        const { trainingDataService } = await initializeServices();
        const { tenantId, intentName, displayName, description, responseTemplate } = req.body;

        if (!intentName) {
            return res.status(400).json({
                success: false,
                error: 'Missing required field: intentName'
            });
        }

        const intent = await trainingDataService.getOrCreateIntent(
            tenantId, 
            intentName, 
            displayName, 
            description, 
            responseTemplate
        );

        res.status(201).json({
            success: true,
            intent
        });
    } catch (error) {
        console.error('API: Error creating intent:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create intent'
        });
    }
});

/**
 * GET /api/bot/intents/default
 * Get default intents to initialize new businesses
 */
router.get('/intents/default', async (req, res) => {
    try {
        const { trainingDataService } = await initializeServices();
        const defaultIntents = trainingDataService.getDefaultIntents();

        res.json({
            success: true,
            intents: defaultIntents,
            count: defaultIntents.length
        });
    } catch (error) {
        console.error('API: Error getting default intents:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get default intents'
        });
    }
});

/**
 * POST /api/bot/intents/initialize
 * Initialize default intents for a new tenant
 */
router.post('/intents/initialize', verifyTenantAccess, async (req, res) => {
    try {
        const { trainingDataService } = await initializeServices();
        const { tenantId, businessId, createdBy } = req.body;

        if (!businessId || !createdBy) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: businessId, createdBy'
            });
        }

        const result = await trainingDataService.initializeDefaultIntents(tenantId, businessId, createdBy);

        res.status(201).json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('API: Error initializing default intents:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to initialize default intents'
        });
    }
});

// ========================================
// TRAINING JOB ENDPOINTS
// ========================================

/**
 * POST /api/bot/training/train
 * Trigger bot training pipeline
 */
router.post('/train', verifyTenantAccess, async (req, res) => {
    try {
        const { trainingDataService, botTrainingService } = await initializeServices();
        const { tenantId } = req.body;

        // Get count of untrained examples
        const untrainedCount = await trainingDataService.getUntrainedExamplesCount(tenantId);
        
        if (untrainedCount === 0) {
            return res.status(400).json({
                success: false,
                error: 'No untrained examples found. Add some training examples first.'
            });
        }

        // Get total training data count
        const allExamples = await trainingDataService.getTrainingExamples(tenantId, 'approved');
        
        if (allExamples.length < 10) {
            return res.status(400).json({
                success: false,
                error: `Insufficient training data: ${allExamples.length} examples. Need at least 10 examples.`
            });
        }

        // Create training job first to get job ID
        const job = await trainingDataService.createTrainingJob(tenantId, allExamples.length);
        console.log(`📋 Created training job: ${job.id}`);

        // Start training pipeline in background with job ID
        botTrainingService.trainBotForTenant(tenantId, job.id)
            .then(result => {
                console.log(`🎉 Training completed for tenant ${tenantId}, job ${job.id}:`, result);
            })
            .catch(error => {
                console.error(`❌ Training failed for tenant ${tenantId}, job ${job.id}:`, error);
            });

        res.status(201).json({
            success: true,
            message: 'Training pipeline started successfully',
            jobId: job.id,
            untrainedCount,
            totalExamples: allExamples.length,
            status: 'training_started'
        });
    } catch (error) {
        console.error('API: Error starting training pipeline:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to start training pipeline'
        });
    }
});

/**
 * GET /api/bot/training/status/:jobId
 * Get individual training job status
 */
router.get('/status/:jobId', verifyTenantAccess, async (req, res) => {
    try {
        const { trainingDataService } = await initializeServices();
        const { jobId } = req.params;
        const { tenantId } = req.query;

        console.log(`API: GET job status request for job ${jobId}, tenant ${tenantId}`);

        const job = await trainingDataService.getTrainingJobById(jobId, tenantId);

        if (!job) {
            return res.status(404).json({
                success: false,
                error: 'Training job not found',
                code: 'JOB_NOT_FOUND'
            });
        }

        // Calculate progress percentage if job is running
        let progress = null;
        if (job.status === 'running' || job.status === 'training') {
            // Estimate progress based on time elapsed (this is a simple estimation)
            const now = new Date();
            const startedAt = job.startedAt ? job.startedAt.toDate() : now;
            const elapsed = now - startedAt;
            const estimatedDuration = 5 * 60 * 1000; // 5 minutes estimated duration
            progress = Math.min(Math.round((elapsed / estimatedDuration) * 100), 95);
        } else if (job.status === 'completed') {
            progress = 100;
        }

        const response = {
            success: true,
            job: {
                id: job.id,
                status: job.status,
                progress: progress,
                startedAt: job.startedAt ? job.startedAt.toDate().toISOString() : null,
                completedAt: job.completedAt ? job.completedAt.toDate().toISOString() : null,
                error: job.errorMessage || null,
                accuracy: job.accuracy || null,
                modelPath: job.modelPath || null,
                trainingDataCount: job.trainingDataCount || 0,
                deployed: job.deployed || false,
                createdAt: job.createdAt ? job.createdAt.toDate().toISOString() : null,
                updatedAt: job.updatedAt ? job.updatedAt.toDate().toISOString() : null
            }
        };

        console.log(`API: Found training job ${jobId} with status: ${job.status}`);
        res.json(response);
    } catch (error) {
        console.error('API: Error getting job status:', error);
        
        if (error.message === 'Access denied: Job does not belong to this tenant') {
            res.status(403).json({
                success: false,
                error: 'Access denied: Job does not belong to this tenant',
                code: 'ACCESS_DENIED'
            });
        } else {
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to get job status',
                code: 'INTERNAL_ERROR'
            });
        }
    }
});

/**
 * GET /api/bot/training/status
 * Get current training status
 */
router.get('/status', verifyTenantAccess, async (req, res) => {
    try {
        const { trainingDataService, botTrainingService } = await initializeServices();
        const { tenantId } = req.query;

        // Get comprehensive training status
        const status = await botTrainingService.getTrainingStatus(tenantId);

        res.json({
            success: true,
            ...status
        });
    } catch (error) {
        console.error('API: Error getting training status:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get training status'
        });
    }
});

/**
 * GET /api/bot/training/history
 * Get training history
 */
router.get('/history', verifyTenantAccess, async (req, res) => {
    try {
        const { trainingDataService } = await initializeServices();
        const { tenantId } = req.query;
        const { limit = 10 } = req.query;

        const jobs = await trainingDataService.getTrainingHistory(tenantId, parseInt(limit));

        res.json({
            success: true,
            jobs,
            count: jobs.length,
            tenantId
        });
    } catch (error) {
        console.error('API: Error getting training history:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get training history'
        });
    }
});

/**
 * GET /api/bot/training/jobs/:tenantId
 * Get training jobs for a tenant (alternative to /history)
 */
router.get('/jobs/:tenantId', verifyTenantAccess, async (req, res) => {
    try {
        const { trainingDataService } = await initializeServices();
        const { tenantId } = req.params;
        const { limit = 20 } = req.query;

        console.log(`📋 Fetching training jobs for tenant: ${tenantId}`);

        const jobs = await trainingDataService.getTrainingHistory(tenantId, parseInt(limit));

        console.log(`✅ Found ${jobs.length} training jobs for tenant ${tenantId}`);

        res.json({
            success: true,
            jobs,
            count: jobs.length,
            tenantId
        });
    } catch (error) {
        console.error('API: Error getting training jobs:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get training jobs'
        });
    }
});

/**
 * PUT /api/bot/training/jobs/:jobId
 * Update training job status
 */
router.put('/jobs/:jobId', verifyTenantAccess, async (req, res) => {
    try {
        const { trainingDataService } = await initializeServices();
        const { jobId } = req.params;
        const updates = req.body;

        await trainingDataService.updateTrainingJob(jobId, updates);

        res.json({
            success: true,
            message: 'Training job updated successfully'
        });
    } catch (error) {
        console.error('API: Error updating training job:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to update training job'
        });
    }
});

/**
 * GET /api/bot/training/pipeline/status
 * Get detailed training pipeline status
 */
router.get('/pipeline/status', verifyTenantAccess, async (req, res) => {
    try {
        const { botTrainingService } = await initializeServices();
        const { tenantId } = req.query;

        const status = await botTrainingService.getTrainingStatus(tenantId);

        res.json({
            success: true,
            pipeline: {
                tenantId,
                isTraining: status.isTraining,
                lastTrained: status.lastTrained,
                modelDeployed: status.modelDeployed,
                accuracy: status.latestJob?.accuracy,
                modelPath: status.latestJob?.modelPath
            },
            data: {
                totalExamples: status.totalExamples,
                untrainedCount: status.untrainedCount
            },
            job: status.latestJob
        });
    } catch (error) {
        console.error('API: Error getting pipeline status:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get pipeline status'
        });
    }
});

/**
 * POST /api/bot/training/pipeline/cleanup
 * Clean up old training files
 */
router.post('/pipeline/cleanup', verifyTenantAccess, async (req, res) => {
    try {
        const { botTrainingService } = await initializeServices();
        const { tenantId } = req.body;
        const { keepDays = 7 } = req.body;

        await botTrainingService.cleanupOldFiles(tenantId, keepDays);

        res.json({
            success: true,
            message: `Cleaned up old training files for tenant ${tenantId}`,
            keepDays
        });
    } catch (error) {
        console.error('API: Error cleaning up files:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to cleanup old files'
        });
    }
});

// ========================================
// UTILITY ENDPOINTS
// ========================================

/**
 * GET /api/bot/training/stats
 * Get training statistics for a tenant
 */
router.get('/stats', verifyTenantAccess, async (req, res) => {
    try {
        const { trainingDataService } = await initializeServices();
        const { tenantId } = req.query;

        // Get various counts
        const [approvedExamples, trainedExamples, intents, latestJob] = await Promise.all([
            trainingDataService.getTrainingExamples(tenantId, 'approved'),
            trainingDataService.getTrainingExamples(tenantId, 'trained'),
            trainingDataService.getIntents(tenantId),
            trainingDataService.getLatestTrainingJob(tenantId)
        ]);

        const stats = {
            totalExamples: approvedExamples.length + trainedExamples.length,
            approvedExamples: approvedExamples.length,
            trainedExamples: trainedExamples.length,
            totalIntents: intents.length,
            latestTrainingJob: latestJob,
            lastTrainedAt: trainedExamples.length > 0 ? 
                trainedExamples[0].trainedAt : null
        };

        res.json({
            success: true,
            stats,
            tenantId
        });
    } catch (error) {
        console.error('API: Error getting training stats:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get training stats'
        });
    }
});

module.exports = router;
