/**
 * Utility helper functions for the WhatsApp bot
 */

/**
 * Process customer information from text input
 * @param {OrderSession} session - The order session
 * @param {string} info - Customer info string in format: name|email|phone|address
 * @returns {boolean} - Success status
 */
function processCustomerInfo(session, info) {
    const parts = info.split('|');
    if (parts.length === 4) {
        session.customerInfo = {
            name: parts[0].trim(),
            email: parts[1].trim(),
            phone: parts[2].trim(),
            address: parts[3].trim()
        };
        return true;
    }
    return false;
}

/**
 * Process registration information from text input
 * @param {string} info - Registration info string in format: name|email|phone|address|accountName
 * @returns {Object|null} - Parsed registration data or null if invalid
 */
function processRegistrationInfo(info) {
    const parts = info.split('|');
    if (parts.length === 5) {
        return {
            name: parts[0].trim(),
            email: parts[1].trim(),
            phone: parts[2].trim(),
            address: parts[3].trim(),
            accountName: parts[4].trim()
        };
    }
    return null;
}

/**
 * Generate registration form template
 * @returns {string} - Registration form message
 */
function generateRegistrationForm() {
    return `Please provide your details in this format:\n\n` +
           `*name|email|phone|address|accountName*\n\n` +
           `Example:\n` +
           `John Doe|john@email.com|264811234567|123 Main St, Windhoek|john_doe\n\n` +
           `⚠️ Account name must be unique and cannot be changed later.`;
}

/**
 * Validate email format
 * @param {string} email - Email address to validate
 * @returns {boolean} - True if valid email format
 */
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validate phone number format (Namibian)
 * @param {string} phone - Phone number to validate
 * @returns {boolean} - True if valid phone format
 */
function validatePhone(phone) {
    // Namibian phone numbers: +264 or 264 followed by 8-9 digits
    const phoneRegex = /^(\+?264|264)?[0-9]{8,9}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
}

/**
 * Format currency amount
 * @param {number} amount - Amount to format
 * @returns {string} - Formatted currency string
 */
function formatCurrency(amount) {
    return `N$${amount.toFixed(2)}`;
}

/**
 * Generate order number
 * @returns {string} - Unique order number
 */
function generateOrderNumber() {
    return `LLL-${Date.now()}`;
}

/**
 * Get current date string
 * @returns {string} - Current date in local format
 */
function getCurrentDate() {
    return new Date().toLocaleDateString();
}

/**
 * Check if text is a valid menu number
 * @param {string} text - Input text
 * @returns {boolean} - True if valid menu number (1-9)
 */
function isValidMenuNumber(text) {
    return /^[1-9]$/.test(text);
}

/**
 * Parse menu number from text
 * @param {string} text - Input text
 * @returns {number} - Parsed number or -1 if invalid
 */
function parseMenuNumber(text) {
    if (isValidMenuNumber(text)) {
        return parseInt(text);
    }
    return -1;
}

/**
 * Check if text is a greeting
 * @param {string} text - Input text (should be lowercase)
 * @returns {boolean} - True if text is a greeting
 */
function isGreeting(text) {
    const greetings = ['hi', 'hello', 'start', 'hey', 'good morning', 'good afternoon', 'good evening'];
    return greetings.includes(text);
}

/**
 * Check if text is a command
 * @param {string} text - Input text (should be lowercase)
 * @returns {boolean} - True if text is a recognized command
 */
function isCommand(text) {
    const commands = [
        'catalog', 'catalogue', 'cart', 'help', 'register', 'checkout', 
        'confirm', 'quick', 'menu', 'start', 'yes', 'no'
    ];
    return commands.includes(text);
}

/**
 * Extract discount code from text
 * @param {string} text - Input text
 * @returns {string|null} - Discount code or null if not found
 */
function extractDiscountCode(text) {
    if (text.startsWith('discount ')) {
        const code = text.split(' ')[1];
        return code ? code.toUpperCase() : null;
    }
    return null;
}

/**
 * Sanitize text input
 * @param {string} text - Input text
 * @returns {string} - Sanitized text
 */
function sanitizeText(text) {
    return text.trim().toLowerCase();
}

/**
 * Calculate time difference in minutes
 * @param {number} timestamp1 - First timestamp
 * @param {number} timestamp2 - Second timestamp  
 * @returns {number} - Difference in minutes
 */
function getTimeDifferenceInMinutes(timestamp1, timestamp2) {
    return Math.abs(timestamp1 - timestamp2) / (1000 * 60);
}

/**
 * Check if date is today
 * @param {Date} date - Date to check
 * @returns {boolean} - True if date is today
 */
function isToday(date) {
    const today = new Date();
    return date.toDateString() === today.toDateString();
}

/**
 * Generate spacing for alignment
 * @param {number} length - Length of spacing needed
 * @returns {string} - String of spaces
 */
function generateSpacing(length) {
    return ' '.repeat(Math.max(0, length));
}

/**
 * Truncate text to specified length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} - Truncated text
 */
function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}

/**
 * Capitalize first letter of each word
 * @param {string} text - Text to capitalize
 * @returns {string} - Capitalized text
 */
function capitalizeWords(text) {
    return text.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

/**
 * Generate unique session ID
 * @returns {string} - Unique session ID
 */
function generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Sleep function for delays
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} - Promise that resolves after delay
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Deep clone an object
 * @param {Object} obj - Object to clone
 * @returns {Object} - Cloned object
 */
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Check if object is empty
 * @param {Object} obj - Object to check
 * @returns {boolean} - True if object is empty
 */
function isEmpty(obj) {
    return Object.keys(obj).length === 0;
}

/**
 * Generate random string
 * @param {number} length - Length of string
 * @returns {string} - Random string
 */
function generateRandomString(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

module.exports = {
    processCustomerInfo,
    processRegistrationInfo,
    generateRegistrationForm,
    validateEmail,
    validatePhone,
    formatCurrency,
    generateOrderNumber,
    getCurrentDate,
    isValidMenuNumber,
    parseMenuNumber,
    isGreeting,
    isCommand,
    extractDiscountCode,
    sanitizeText,
    getTimeDifferenceInMinutes,
    isToday,
    generateSpacing,
    truncateText,
    capitalizeWords,
    generateSessionId,
    sleep,
    deepClone,
    isEmpty,
    generateRandomString
};