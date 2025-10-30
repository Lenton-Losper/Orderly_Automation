// Port configuration for local bot to avoid conflicts with Docker
module.exports = {
    // Local bot ports (different from Docker)
    LOCAL_BOT_PORT: 3002,      // Docker backend uses 3000
    LOCAL_API_PORT: 3003,      // Docker bot-training uses 3001
    LOCAL_WEBSOCKET_PORT: 8080, // Different from Docker WebSocket
    
    // Docker ports (for reference)
    DOCKER_BACKEND_PORT: 3000,
    DOCKER_BOT_TRAINING_PORT: 3001,
    DOCKER_RASA_PORT: 5005,
    DOCKER_RASA_ACTIONS_PORT: 5055,
    DOCKER_REDIS_PORT: 6379,
    DOCKER_MONGODB_PORT: 27017
};




















