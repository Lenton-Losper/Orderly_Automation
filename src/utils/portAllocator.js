const net = require('net');

/**
 * Calculate unique ports for a tenant based on their tenant ID
 * @param {string} tenantId - The tenant identifier
 * @returns {Object} Object with apiPort and websocketPort
 */
function calculateTenantPorts(tenantId) {
    // Extract numeric hash from tenant ID
    const hash = tenantId.replace(/[^0-9]/g, '') || Date.now().toString();
    const baseOffset = parseInt(hash.slice(-4)) % 1000; // Use last 4 digits, max 1000 tenants
    
    return {
        apiPort: 4000 + (baseOffset * 2),           // API: 4000, 4002, 4004...
        websocketPort: 4000 + (baseOffset * 2) + 1 // WS: 4001, 4003, 4005...
    };
}

/**
 * Check if a port is available
 * @param {number} port - Port to check
 * @returns {Promise<boolean>} True if port is available
 */
function isPortAvailable(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.listen(port, () => {
            server.close(() => resolve(true));
        });
        server.on('error', () => resolve(false));
    });
}

/**
 * Find next available port starting from base port
 * @param {number} basePort - Starting port number
 * @returns {Promise<number>} Available port number
 */
async function findAvailablePort(basePort) {
    let port = basePort;
    while (!(await isPortAvailable(port))) {
        port += 2; // Increment by 2 to maintain even/odd pairing
    }
    return port;
}

/**
 * Get available ports for a tenant with collision avoidance
 * @param {string} tenantId - The tenant identifier
 * @returns {Promise<Object>} Object with available apiPort and websocketPort
 */
async function getAvailableTenantPorts(tenantId) {
    const calculatedPorts = calculateTenantPorts(tenantId);
    
    // Check if calculated ports are available
    const apiAvailable = await isPortAvailable(calculatedPorts.apiPort);
    const wsAvailable = await isPortAvailable(calculatedPorts.websocketPort);
    
    if (apiAvailable && wsAvailable) {
        return calculatedPorts;
    }
    
    // If not available, find next available ports
    const apiPort = await findAvailablePort(calculatedPorts.apiPort);
    const websocketPort = await findAvailablePort(apiPort + 1);
    
    return {
        apiPort,
        websocketPort
    };
}

module.exports = { 
    calculateTenantPorts, 
    isPortAvailable, 
    findAvailablePort, 
    getAvailableTenantPorts 
};
