const { VALIDATION_CONFIG } = require('../config/constants');

class Validators {
    // Parse customer info from checkout (name|email|phone|address)
    parseCustomerInfo(input) {
        if (!input || typeof input !== 'string') {
            return null;
        }

        const parts = input.split('|').map(part => part.trim());
        
        if (parts.length !== VALIDATION_CONFIG.CUSTOMER_INFO_PARTS) {
            return null;
        }

        const [name, email, phone, address] = parts;

        // Validate each part
        if (!this.isValidName(name) ||
            !this.isValidEmail(email) ||
            !this.isValidPhone(phone) ||
            !this.isValidAddress(address)) {
            return null;
        }

        return {
            name: this.sanitizeName(name),
            email: this.sanitizeEmail(email),
            phone: this.sanitizePhone(phone),
            address: this.sanitizeAddress(address)
        };
    }

    // Parse registration info (name|email|phone|address|accountName)
    parseRegistrationInfo(input) {
        if (!input || typeof input !== 'string') {
            return null;
        }

        const parts = input.split('|').map(part => part.trim());
        
        if (parts.length !== VALIDATION_CONFIG.REGISTRATION_INFO_PARTS) {
            return null;
        }

        const [name, email, phone, address, accountName] = parts;

        // Validate each part
        if (!this.isValidName(name) ||
            !this.isValidEmail(email) ||
            !this.isValidPhone(phone) ||
            !this.isValidAddress(address) ||
            !this.isValidAccountName(accountName)) {
            return null;
        }

        return {
            name: this.sanitizeName(name),
            email: this.sanitizeEmail(email),
            phone: this.sanitizePhone(phone),
            address: this.sanitizeAddress(address),
            accountName: this.sanitizeAccountName(accountName)
        };
    }

    // Individual validation methods
    isValidName(name) {
        if (!name || typeof name !== 'string') return false;
        const trimmed = name.trim();
        return trimmed.length >= 2 && 
               trimmed.length <= 50 && 
               /^[a-zA-Z\s\-'\.]+$/.test(trimmed);
    }

    isValidEmail(email) {
        if (!email || typeof email !== 'string') return false;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email.trim()) && email.length <= 100;
    }

    isValidPhone(phone) {
        if (!phone || typeof phone !== 'string') return false;
        // Remove spaces, dashes, and parentheses for validation
        const cleaned = phone.replace(/[\s\-\(\)]/g, '');
        // Check for valid phone format (international or local)
        const phoneRegex = /^\+?[\d]{8,15}$/;
        return phoneRegex.test(cleaned);
    }

    isValidAddress(address) {
        if (!address || typeof address !== 'string') return false;
        const trimmed = address.trim();
        return trimmed.length >= 5 && 
               trimmed.length <= 200 && 
               /^[a-zA-Z0-9\s\-,\.#\/]+$/.test(trimmed);
    }

    isValidAccountName(accountName) {
        if (!accountName || typeof accountName !== 'string') return false;
        const trimmed = accountName.trim();
        // Account name: 3-20 characters, alphanumeric + underscore, no spaces
        return trimmed.length >= 3 && 
               trimmed.length <= 20 && 
               /^[a-zA-Z0-9_]+$/.test(trimmed) &&
               !/^[0-9]+$/.test(trimmed); // Not all numbers
    }

    isValidWhatsAppId(whatsappId) {
        if (!whatsappId || typeof whatsappId !== 'string') return false;
        return whatsappId.includes('@s.whatsapp.net') || whatsappId.includes('@c.us');
    }

    isValidBusinessId(businessId) {
        if (!businessId || typeof businessId !== 'string') return false;
        const trimmed = businessId.trim();
        return trimmed.length >= 1 && 
               trimmed.length <= 50 && 
               /^[a-zA-Z0-9_\-]+$/.test(trimmed);
    }

    // Message validation
    isValidMessage(message) {
        if (!message || typeof message !== 'string') return false;
        const trimmed = message.trim();
        return trimmed.length >= VALIDATION_CONFIG.MIN_MESSAGE_LENGTH && 
               trimmed.length <= VALIDATION_CONFIG.MAX_MESSAGE_LENGTH;
    }

    isValidCommand(command) {
        if (!command || typeof command !== 'string') return false;
        const trimmed = command.trim().toLowerCase();
        const validCommands = [
            'hi', 'hello', 'start', 'menu', 'main',
            'register', 'quick', 'catalog', 'catalogue',
            'cart', 'help', 'checkout', 'confirm',
            '1', '2', '3', '4', '5', '6', '7', '8', '9'
        ];
        return validCommands.includes(trimmed);
    }

    // Sanitization methods
    sanitizeName(name) {
        return name.trim()
                  .replace(/\s+/g, ' ') // Replace multiple spaces with single space
                  .replace(/[^a-zA-Z\s\-'\.]/g, '') // Remove invalid characters
                  .substring(0, 50); // Limit length
    }

    sanitizeEmail(email) {
        return email.trim().toLowerCase().substring(0, 100);
    }

    sanitizePhone(phone) {
        // Keep the original format but trim
        return phone.trim().substring(0, 20);
    }

    sanitizeAddress(address) {
        return address.trim()
                     .replace(/\s+/g, ' ') // Replace multiple spaces with single space
                     .substring(0, 200); // Limit length
    }

    sanitizeAccountName(accountName) {
        return accountName.trim()
                         .replace(/[^a-zA-Z0-9_]/g, '') // Remove invalid characters
                         .substring(0, 20) // Limit length
                         .toLowerCase(); // Convert to lowercase for consistency
    }

    sanitizeMessage(message) {
        if (!message || typeof message !== 'string') return '';
        return message.trim().substring(0, VALIDATION_CONFIG.MAX_MESSAGE_LENGTH);
    }

    // Product validation
    isValidProductId(productId) {
        if (!productId || typeof productId !== 'string') return false;
        return /^[a-zA-Z0-9_\-]+$/.test(productId) && productId.length <= 50;
    }

    isValidQuantity(quantity) {
        if (typeof quantity === 'string') {
            quantity = parseInt(quantity);
        }
        return Number.isInteger(quantity) && quantity > 0 && quantity <= 100;
    }

    isValidPrice(price) {
        if (typeof price === 'string') {
            price = parseFloat(price);
        }
        return typeof price === 'number' && 
               price >= 0 && 
               price <= 10000 && 
               !isNaN(price);
    }

    // Order validation
    isValidOrder(order) {
        if (!order || typeof order !== 'object') return false;
        
        return order.customerInfo &&
               this.isValidCustomerInfo(order.customerInfo) &&
               Array.isArray(order.items) &&
               order.items.length > 0 &&
               this.isValidPrice(order.total);
    }

    isValidCustomerInfo(customerInfo) {
        if (!customerInfo || typeof customerInfo !== 'object') return false;
        
        return this.isValidName(customerInfo.name) &&
               this.isValidEmail(customerInfo.email) &&
               this.isValidPhone(customerInfo.phone) &&
               this.isValidAddress(customerInfo.address);
    }

    // Discount code validation
    isValidDiscountCode(code) {
        if (!code || typeof code !== 'string') return false;
        const trimmed = code.trim().toUpperCase();
        return trimmed.length >= 3 && 
               trimmed.length <= 20 && 
               /^[A-Z0-9]+$/.test(trimmed);
    }

    // Batch validation methods
    validateRegistrationData(data) {
        const errors = [];
        
        if (!this.isValidName(data.name)) {
            errors.push('Invalid name: Must be 2-50 characters, letters only');
        }
        
        if (!this.isValidEmail(data.email)) {
            errors.push('Invalid email: Must be a valid email address');
        }
        
        if (!this.isValidPhone(data.phone)) {
            errors.push('Invalid phone: Must be 8-15 digits');
        }
        
        if (!this.isValidAddress(data.address)) {
            errors.push('Invalid address: Must be 5-200 characters');
        }
        
        if (!this.isValidAccountName(data.accountName)) {
            errors.push('Invalid account name: 3-20 characters, alphanumeric and underscore only');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    validateCustomerData(data) {
        const errors = [];
        
        if (!this.isValidName(data.name)) {
            errors.push('Invalid name');
        }
        
        if (!this.isValidEmail(data.email)) {
            errors.push('Invalid email');
        }
        
        if (!this.isValidPhone(data.phone)) {
            errors.push('Invalid phone');
        }
        
        if (!this.isValidAddress(data.address)) {
            errors.push('Invalid address');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // Format validation helpers
    getNameValidationMessage() {
        return "Name must be 2-50 characters, letters and spaces only";
    }

    getEmailValidationMessage() {
        return "Please enter a valid email address (example@domain.com)";
    }

    getPhoneValidationMessage() {
        return "Phone must be 8-15 digits (example: +264812345678)";
    }

    getAddressValidationMessage() {
        return "Address must be 5-200 characters";
    }

    getAccountNameValidationMessage() {
        return "Account name: 3-20 characters, letters/numbers/underscore only, no spaces";
    }

    // Helper methods for common validation patterns
    containsOnlyNumbers(str) {
        return /^[0-9]+$/.test(str);
    }

    containsOnlyLetters(str) {
        return /^[a-zA-Z\s]+$/.test(str);
    }

    containsSpecialCharacters(str) {
        return /[!@#$%^&*(),.?":{}|<>]/.test(str);
    }

    isValidLength(str, min, max) {
        if (!str || typeof str !== 'string') return false;
        const length = str.trim().length;
        return length >= min && length <= max;
    }

    // Namibian-specific validation (customize as needed)
    isValidNamibianPhone(phone) {
        if (!phone || typeof phone !== 'string') return false;
        const cleaned = phone.replace(/[\s\-\(\)]/g, '');
        // Namibian phone numbers: +264 followed by 8-9 digits
        return /^\+?264[0-9]{8,9}$/.test(cleaned) || /^0[0-9]{8,9}$/.test(cleaned);
    }

    isValidPostalCode(code) {
        if (!code || typeof code !== 'string') return false;
        // Basic postal code validation (adjust for your region)
        return /^[0-9]{4,6}$/.test(code.trim());
    }
}

module.exports = new Validators();