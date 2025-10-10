// Crypto polyfill for Node.js v18 compatibility
if (typeof globalThis.crypto === 'undefined') {
    const { webcrypto } = require('crypto');
    globalThis.crypto = webcrypto;
}

// Continue with the rest of your application
require('./src/server.js');

