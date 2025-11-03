/**
 * Order Status Service
 * Helper functions for updating order status throughout the order lifecycle
 */

const firebaseService = require('./firebase');

class OrderStatusService {
    constructor() {
        this.db = null;
    }

    async initialize() {
        try {
            await firebaseService.initialize();
            this.db = firebaseService.db;
            console.log('✅ Order Status Service initialized');
        } catch (error) {
            console.error('❌ Order Status Service initialization failed:', error);
            throw error;
        }
    }

    /**
     * Update order status in Firebase
     * @param {string} businessId - Business phone number
     * @param {string} tenantId - Tenant ID
     * @param {string} orderId - Order ID
     * @param {string} newStatus - New status (confirmed, preparing, ready, delivered, cancelled)
     * @param {object} additionalData - Optional additional data to update
     * @returns {Promise<boolean>} Success status
     */
    async updateOrderStatus(businessId, tenantId, orderId, newStatus, additionalData = {}) {
        try {
            if (!this.db) {
                await this.initialize();
            }

            const validStatuses = ['confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];
            if (!validStatuses.includes(newStatus)) {
                console.error(`❌ Invalid order status: ${newStatus}`);
                return false;
            }

            const orderRef = this.db
                .collection('vendors')
                .doc(businessId)
                .collection('tenants')
                .doc(tenantId)
                .collection('orders')
                .doc(orderId);

            const updateData = {
                status: newStatus,
                updatedAt: new Date().toISOString(),
                ...additionalData
            };

            // Add status-specific timestamps
            if (newStatus === 'preparing') {
                updateData.preparingAt = new Date().toISOString();
            } else if (newStatus === 'ready') {
                updateData.readyAt = new Date().toISOString();
            } else if (newStatus === 'delivered') {
                updateData.deliveredAt = new Date().toISOString();
            } else if (newStatus === 'cancelled') {
                updateData.cancelledAt = new Date().toISOString();
            }

            await orderRef.update(updateData);
            console.log(`✅ Order ${orderId} status updated to: ${newStatus}`);
            return true;

        } catch (error) {
            console.error(`❌ Error updating order status for ${orderId}:`, error.message);
            return false;
        }
    }

    /**
     * Mark order as preparing
     */
    async markAsPreparing(businessId, tenantId, orderId, notes = '') {
        return await this.updateOrderStatus(
            businessId,
            tenantId,
            orderId,
            'preparing',
            { preparingNotes: notes }
        );
    }

    /**
     * Mark order as ready for pickup/delivery
     */
    async markAsReady(businessId, tenantId, orderId, notes = '') {
        return await this.updateOrderStatus(
            businessId,
            tenantId,
            orderId,
            'ready',
            { readyNotes: notes }
        );
    }

    /**
     * Mark order as delivered
     */
    async markAsDelivered(businessId, tenantId, orderId, deliveryNotes = '') {
        return await this.updateOrderStatus(
            businessId,
            tenantId,
            orderId,
            'delivered',
            { deliveryNotes }
        );
    }

    /**
     * Cancel order
     */
    async cancelOrder(businessId, tenantId, orderId, cancellationReason = '') {
        return await this.updateOrderStatus(
            businessId,
            tenantId,
            orderId,
            'cancelled',
            { cancellationReason }
        );
    }

    /**
     * Get order by ID
     */
    async getOrder(businessId, tenantId, orderId) {
        try {
            if (!this.db) {
                await this.initialize();
            }

            const orderRef = this.db
                .collection('vendors')
                .doc(businessId)
                .collection('tenants')
                .doc(tenantId)
                .collection('orders')
                .doc(orderId);

            const orderSnap = await orderRef.get();
            
            if (orderSnap.exists) {
                return {
                    id: orderSnap.id,
                    ...orderSnap.data()
                };
            }
            return null;
        } catch (error) {
            console.error(`❌ Error getting order ${orderId}:`, error.message);
            return null;
        }
    }

    /**
     * Get orders by status
     */
    async getOrdersByStatus(businessId, tenantId, status) {
        try {
            if (!this.db) {
                await this.initialize();
            }

            const ordersRef = this.db
                .collection('vendors')
                .doc(businessId)
                .collection('tenants')
                .doc(tenantId)
                .collection('orders')
                .where('status', '==', status)
                .orderBy('createdAt', 'desc');

            const ordersSnap = await ordersRef.get();
            const orders = [];

            ordersSnap.forEach(doc => {
                orders.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            return orders;
        } catch (error) {
            console.error(`❌ Error getting orders by status ${status}:`, error.message);
            return [];
        }
    }
}

// Singleton instance
const orderStatusService = new OrderStatusService();

module.exports = orderStatusService;
