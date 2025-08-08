// File: src/utils/validator.js
// Enhanced Validators with Unicode Character Handling and WhatsApp Formatting Support
// Fixes phone validation issues with invisible Unicode characters from WhatsApp

const { VALIDATION_CONFIG } = require('../config/constants');

class Validators {
    // Enhanced phone cleaning function that removes all Unicode formatting
    cleanPhoneNumberForValidation(phone) {
        if (!phone) return '';
        
        console.log(`🔍 PHONE VALIDATION DEBUG - Input: "${phone}"`);
        console.log(`🔍 PHONE VALIDATION DEBUG - Input length: ${phone.length}`);
        console.log(`🔍 PHONE VALIDATION DEBUG - Input char codes:`, phone.split('').map(c => c.charCodeAt(0)));
        
        // Step 1: Remove all non-printable Unicode characters (including WhatsApp formatting)
        let cleaned = phone.replace(/[\u200B-\u200D\uFEFF\u202A-\u202E\u2066-\u2069\u061C]/g, '');
        console.log(`🔍 PHONE VALIDATION DEBUG - After Unicode removal: "${cleaned}"`);
        
        // Step 2: Remove all whitespace characters
        cleaned = cleaned.replace(/\s+/g, '');
        console.log(`🔍 PHONE VALIDATION DEBUG - After whitespace removal: "${cleaned}"`);
        
        // Step 3: Keep only digits, +, and common phone characters
        cleaned = cleaned.replace(/[^\d+\-()]/g, '');
        console.log(`🔍 PHONE VALIDATION DEBUG - After character filtering: "${cleaned}"`);
        
        // Step 4: Normalize to standard format
        cleaned = cleaned.replace(/[\-()]/g, ''); // Remove dashes and parentheses
        console.log(`🔍 PHONE VALIDATION DEBUG - Final cleaned: "${cleaned}"`);
        
        return cleaned;
    }

    // Enhanced Unicode text cleaning for all inputs
    cleanUnicodeText(text) {
        if (!text || typeof text !== 'string') return '';
        
        console.log(`🔍 UNICODE CLEAN DEBUG - Input: "${text}"`);
        console.log(`🔍 UNICODE CLEAN DEBUG - Input length: ${text.length}`);
        
        // Remove invisible Unicode characters commonly added by WhatsApp
        let cleaned = text.replace(/[\u200B-\u200D\uFEFF\u202A-\u202E\u2066-\u2069\u061C]/g, '');
        
        // Remove WhatsApp formatting (asterisks and other markdown)
        cleaned = cleaned.replace(/\*+/g, '');
        
        // Normalize whitespace
        cleaned = cleaned.replace(/\s+/g, ' ').trim();
        
        console.log(`🔍 UNICODE CLEAN DEBUG - Cleaned: "${cleaned}"`);
        return cleaned;
    }

    // Parse customer info from checkout (name|email|phone|address)
    parseCustomerInfo(input) {
        console.log('🔍 VALIDATOR DEBUG - parseCustomerInfo called with:', input);
        
        if (!input || typeof input !== 'string') {
            console.log('❌ VALIDATOR DEBUG - parseCustomerInfo: Invalid input type');
            return null;
        }

        // Enhanced Unicode cleaning
        const cleanInput = this.cleanUnicodeText(input);
        console.log('🔍 VALIDATOR DEBUG - Cleaned input:', cleanInput);

        const parts = cleanInput.split('|').map(part => part.trim());
        console.log('🔍 VALIDATOR DEBUG - parseCustomerInfo: Split into', parts.length, 'parts:', parts);
        
        const expectedParts = VALIDATION_CONFIG?.CUSTOMER_INFO_PARTS || 4;
        if (parts.length !== expectedParts) {
            console.log('❌ VALIDATOR DEBUG - parseCustomerInfo: Wrong number of parts, expected', expectedParts, 'got', parts.length);
            return null;
        }

        const [name, email, phone, address] = parts;

        // Validate each part
        if (!this.isValidName(name) ||
            !this.isValidEmail(email) ||
            !this.isValidPhone(phone) ||
            !this.isValidAddress(address)) {
            console.log('❌ VALIDATOR DEBUG - parseCustomerInfo: Validation failed for one or more fields');
            return null;
        }

        const result = {
            name: this.sanitizeName(name),
            email: this.sanitizeEmail(email),
            phone: this.sanitizePhone(phone),
            address: this.sanitizeAddress(address)
        };
        
        console.log('✅ VALIDATOR DEBUG - parseCustomerInfo: Success:', result);
        return result;
    }

    // Enhanced registration info parser with Unicode handling
    parseRegistrationInfo(input) {
        console.log('🔍 VALIDATOR DEBUG - parseRegistrationInfo called with:', input);
        console.log('🔍 VALIDATOR DEBUG - Input type:', typeof input);
        console.log('🔍 VALIDATOR DEBUG - Input length:', input?.length);
        
        if (!input || typeof input !== 'string') {
            console.log('❌ VALIDATOR DEBUG - parseRegistrationInfo: Invalid input type or null');
            return null;
        }

        // Enhanced Unicode cleaning
        const cleanInput = this.cleanUnicodeText(input);
        console.log('🔍 VALIDATOR DEBUG - Cleaned input:', cleanInput);

        const parts = cleanInput.split('|').map(part => part.trim());
        console.log('🔍 VALIDATOR DEBUG - parseRegistrationInfo: Split into', parts.length, 'parts:', parts);
        
        const expectedParts = VALIDATION_CONFIG?.REGISTRATION_INFO_PARTS || 5;
        console.log('🔍 VALIDATOR DEBUG - Expected parts:', expectedParts);
        
        if (parts.length !== expectedParts) {
            console.log('❌ VALIDATOR DEBUG - parseRegistrationInfo: Wrong number of parts, expected', expectedParts, 'got', parts.length);
            return null;
        }

        const [name, email, phone, address, accountName] = parts;
        console.log('🔍 VALIDATOR DEBUG - parseRegistrationInfo: Extracted fields:', {
            name: `"${name}"`,
            email: `"${email}"`,
            phone: `"${phone}"`,
            address: `"${address}"`,
            accountName: `"${accountName}"`
        });

        // Validate each part with detailed logging
        const nameValid = this.isValidName(name);
        const emailValid = this.isValidEmail(email);
        const phoneValid = this.isValidPhone(phone);
        const addressValid = this.isValidAddress(address);
        const accountNameValid = this.isValidAccountName(accountName);
        
        console.log('🔍 VALIDATOR DEBUG - parseRegistrationInfo: Field validation results:', {
            name: nameValid,
            email: emailValid,
            phone: phoneValid,
            address: addressValid,
            accountName: accountNameValid
        });

        if (!nameValid || !emailValid || !phoneValid || !addressValid || !accountNameValid) {
            console.log('❌ VALIDATOR DEBUG - parseRegistrationInfo: Validation failed for one or more fields');
            if (!nameValid) console.log('❌ VALIDATOR DEBUG - Invalid name:', name);
            if (!emailValid) console.log('❌ VALIDATOR DEBUG - Invalid email:', email);
            if (!phoneValid) console.log('❌ VALIDATOR DEBUG - Invalid phone:', phone);
            if (!addressValid) console.log('❌ VALIDATOR DEBUG - Invalid address:', address);
            if (!accountNameValid) console.log('❌ VALIDATOR DEBUG - Invalid accountName:', accountName);
            return null;
        }

        const result = {
            name: this.sanitizeName(name),
            email: this.sanitizeEmail(email),
            phone: this.sanitizePhone(phone),
            address: this.sanitizeAddress(address),
            accountName: this.sanitizeAccountName(accountName)
        };
        
        console.log('✅ VALIDATOR DEBUG - parseRegistrationInfo: Success:', result);
        return result;
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

    // Enhanced phone validation with Unicode handling
    isValidPhone(phone) {
        console.log(`🔍 PHONE VALIDATION - Validating: "${phone}"`);
        
        if (!phone || typeof phone !== 'string') {
            console.log(`❌ PHONE VALIDATION - Invalid input type or empty`);
            return false;
        }
        
        const cleaned = this.cleanPhoneNumberForValidation(phone);
        console.log(`🔍 PHONE VALIDATION - Cleaned phone: "${cleaned}"`);
        
        if (!cleaned) {
            console.log(`❌ PHONE VALIDATION - Empty phone number after cleaning`);
            return false;
        }
        
        // Check for valid Namibian and international phone patterns
        const patterns = [
            /^\+264\d{8,9}$/,     // +264812345678 or +264813141453
            /^264\d{8,9}$/,       // 264812345678
            /^0\d{8,9}$/,         // 0812345678
            /^\d{8,9}$/,          // 812345678
            /^\+\d{10,15}$/       // International format
        ];
        
        const isValid = patterns.some(pattern => {
            const match = pattern.test(cleaned);
            console.log(`🔍 PHONE VALIDATION - Pattern ${pattern} matches: ${match}`);
            return match;
        });
        
        console.log(`🔍 PHONE VALIDATION - Final result: ${isValid}`);
        return isValid;
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
        const minLength = VALIDATION_CONFIG?.MIN_MESSAGE_LENGTH || 1;
        const maxLength = VALIDATION_CONFIG?.MAX_MESSAGE_LENGTH || 1000;
        return trimmed.length >= minLength && trimmed.length <= maxLength;
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

    // Enhanced sanitization methods
    sanitizeName(name) {
        const cleaned = this.cleanUnicodeText(name);
        return cleaned.replace(/\s+/g, ' ') // Replace multiple spaces with single space
                     .replace(/[^a-zA-Z\s\-'\.]/g, '') // Remove invalid characters
                     .substring(0, 50); // Limit length
    }

    sanitizeEmail(email) {
        const cleaned = this.cleanUnicodeText(email);
        return cleaned.toLowerCase().substring(0, 100);
    }

    // Enhanced phone sanitization
    sanitizePhone(phone) {
        const cleaned = this.cleanPhoneNumberForValidation(phone);
        return cleaned.substring(0, 20);
    }

    sanitizeAddress(address) {
        const cleaned = this.cleanUnicodeText(address);
        return cleaned.replace(/\s+/g, ' ') // Replace multiple spaces with single space
                     .substring(0, 200); // Limit length
    }

    sanitizeAccountName(accountName) {
        const cleaned = this.cleanUnicodeText(accountName);
        return cleaned.replace(/[^a-zA-Z0-9_]/g, '') // Remove invalid characters
                     .substring(0, 20) // Limit length
                     .toLowerCase(); // Convert to lowercase for consistency
    }

    sanitizeMessage(message) {
        if (!message || typeof message !== 'string') return '';
        const cleaned = this.cleanUnicodeText(message);
        const maxLength = VALIDATION_CONFIG?.MAX_MESSAGE_LENGTH || 1000;
        return cleaned.substring(0, maxLength);
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
        console.log('🔍 VALIDATOR DEBUG - validateRegistrationData called with:', data);
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
        
        console.log('🔍 VALIDATOR DEBUG - validateRegistrationData result:', {
            isValid: errors.length === 0,
            errors
        });
        
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
        return "Phone must be 8-15 digits (example: +264812345678 or 264817375744)";
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

    // Enhanced Namibian-specific validation
    isValidNamibianPhone(phone) {
        console.log(`🔍 NAMIBIAN PHONE VALIDATION - Input: "${phone}"`);
        
        if (!phone || typeof phone !== 'string') return false;
        
        const cleaned = this.cleanPhoneNumberForValidation(phone);
        console.log(`🔍 NAMIBIAN PHONE VALIDATION - Cleaned: "${cleaned}"`);
        
        // Namibian phone number patterns
        const patterns = [
            /^\+264[0-9]{8,9}$/,  // +264812345678
            /^264[0-9]{8,9}$/,    // 264812345678
            /^0[0-9]{8,9}$/       // 0812345678
        ];
        
        const isValid = patterns.some(pattern => pattern.test(cleaned));
        console.log(`🔍 NAMIBIAN PHONE VALIDATION - Result: ${isValid}`);
        
        return isValid;
    }

    isValidPostalCode(code) {
        if (!code || typeof code !== 'string') return false;
        // Basic postal code validation (adjust for your region)
        return /^[0-9]{4,6}$/.test(code.trim());
    }

    // Debug helpers
    debugPhoneValidation(phone) {
        console.log('🔍 PHONE DEBUG - Starting validation for:', phone);
        console.log('🔍 PHONE DEBUG - Character codes:', phone.split('').map(c => `${c}(${c.charCodeAt(0)})`));
        
        const cleaned = this.cleanPhoneNumberForValidation(phone);
        console.log('🔍 PHONE DEBUG - After cleaning:', cleaned);
        
        const isValid = this.isValidPhone(phone);
        console.log('🔍 PHONE DEBUG - Validation result:', isValid);
        
        return { original: phone, cleaned, isValid };
    }

    debugRegistrationInput(input) {
        console.log('🔍 REGISTRATION DEBUG - Full analysis of input:');
        console.log('🔍 REGISTRATION DEBUG - Raw input:', input);
        console.log('🔍 REGISTRATION DEBUG - Input length:', input.length);
        console.log('🔍 REGISTRATION DEBUG - Character analysis:');
        
        for (let i = 0; i < input.length; i++) {
            const char = input[i];
            const code = char.charCodeAt(0);
            console.log(`  ${i}: "${char}" (${code}) ${code > 127 ? '← UNICODE' : ''}`);
        }
        
        const cleaned = this.cleanUnicodeText(input);
        console.log('🔍 REGISTRATION DEBUG - After cleaning:', cleaned);
        
        const parts = cleaned.split('|');
        console.log('🔍 REGISTRATION DEBUG - Split parts:', parts);
        
        if (parts.length >= 3) {
            console.log('🔍 REGISTRATION DEBUG - Phone part analysis:');
            this.debugPhoneValidation(parts[2]);
        }
        
        return this.parseRegistrationInfo(input);
    }
}

module.exports = new Validators();