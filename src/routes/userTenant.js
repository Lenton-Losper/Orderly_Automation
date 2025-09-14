const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');

/**
 * Get the correct tenant ID for the current user
 * This endpoint should be called by the frontend to get the user's tenant
 */
router.get('/my-tenant', async (req, res) => {
    try {
        // Get the user ID from the request (this should be set by your auth middleware)
        const userId = req.user?.uid || req.headers['x-user-id'];
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'User not authenticated'
            });
        }

        console.log(`🔍 Getting tenant for user: ${userId}`);

        // Query Firebase to find the tenant for this user
        const db = admin.firestore();
        
        // Look for tenants where ownerId matches the current user
        const tenantsQuery = await db.collection('tenants')
            .where('ownerId', '==', userId)
            .where('isDefault', '==', true)
            .limit(1)
            .get();

        if (tenantsQuery.empty) {
            // If no default tenant found, get any tenant for this user
            const anyTenantQuery = await db.collection('tenants')
                .where('ownerId', '==', userId)
                .limit(1)
                .get();

            if (anyTenantQuery.empty) {
                return res.status(404).json({
                    success: false,
                    error: 'No tenant found for this user'
                });
            }

            const tenant = anyTenantQuery.docs[0];
            const tenantData = tenant.data();
            
            console.log(`✅ Found tenant for user ${userId}: ${tenant.id}`);
            
            return res.json({
                success: true,
                tenantId: tenant.id,
                tenantData: {
                    name: tenantData.name,
                    phoneId: tenantData.phoneId,
                    isDefault: tenantData.isDefault || false,
                    createdAt: tenantData.createdAt
                }
            });
        }

        const tenant = tenantsQuery.docs[0];
        const tenantData = tenant.data();
        
        console.log(`✅ Found default tenant for user ${userId}: ${tenant.id}`);
        
        res.json({
            success: true,
            tenantId: tenant.id,
            tenantData: {
                name: tenantData.name,
                phoneId: tenantData.phoneId,
                isDefault: tenantData.isDefault || false,
                createdAt: tenantData.createdAt
            }
        });

    } catch (error) {
        console.error('❌ Error getting user tenant:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get user tenant'
        });
    }
});

/**
 * Get tenant by phone number (for debugging)
 */
router.get('/by-phone/:phoneNumber', async (req, res) => {
    try {
        const { phoneNumber } = req.params;
        
        console.log(`🔍 Looking for tenant with phone: ${phoneNumber}`);

        const db = admin.firestore();
        
        // Look for tenants with this phone number
        const tenantsQuery = await db.collection('tenants')
            .where('phoneId', '==', phoneNumber)
            .get();

        if (tenantsQuery.empty) {
            return res.status(404).json({
                success: false,
                error: `No tenant found with phone number: ${phoneNumber}`
            });
        }

        const tenants = [];
        tenantsQuery.forEach(doc => {
            const data = doc.data();
            tenants.push({
                tenantId: doc.id,
                name: data.name,
                phoneId: data.phoneId,
                isDefault: data.isDefault || false,
                ownerId: data.ownerId,
                createdAt: data.createdAt
            });
        });

        console.log(`✅ Found ${tenants.length} tenant(s) with phone ${phoneNumber}`);

        res.json({
            success: true,
            phoneNumber,
            tenants,
            recommended: tenants.find(t => t.isDefault) || tenants[0]
        });

    } catch (error) {
        console.error('❌ Error getting tenant by phone:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get tenant by phone'
        });
    }
});

module.exports = router;

