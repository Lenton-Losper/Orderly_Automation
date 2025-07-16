class CustomerService {
    constructor(firebaseService) {
        this.firebaseService = firebaseService;
    }

    async checkExistingCustomer(userId) {
        return await this.firebaseService.checkExistingCustomer(userId);
    }

    async registerCustomer(customerData, userId) {
        const validatedData = this.validateCustomerData(customerData);
        if (!validatedData.isValid) {
            return { success: false, message: validatedData.message };
        }

        return await this.firebaseService.saveCustomer(customerData, userId);
    }

    validateCustomerData(customerData) {
        const requiredFields = ['name', 'email', 'phone', 'address', 'accountName'];
        
        for (const field of requiredFields) {
            if (!customerData[field] || customerData[field].trim() === '') {
                return { isValid: false, message: `${field} is required` };
            }
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(customerData.email)) {
            return { isValid: false, message: 'Invalid email format' };
        }

        // Phone validation (basic)
        const phoneRegex = /^[\d\s\-\+\(\)]+$/;
        if (!phoneRegex.test(customerData.phone)) {
            return { isValid: false, message: 'Invalid phone number format' };
        }

        // Account name validation
        if (customerData.accountName.length < 3) {
            return { isValid: false, message: 'Account name must be at least 3 characters' };
        }

        return { isValid: true };
    }

    parseRegistrationInfo(inputText) {
        const parts = inputText.split('|');
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

    parseCustomerInfo(inputText) {
        const parts = inputText.split('|');
        if (parts.length === 4) {
            return {
                name: parts[0].trim(),
                email: parts[1].trim(),
                phone: parts[2].trim(),
                address: parts[3].trim()
            };
        }
        return null;
    }

    async incrementScore(accountName) {
        if (!accountName) {
            console.warn('⚠️ No account name provided for score increment');
            return false;
        }
        
        return await this.firebaseService.incrementCustomerScore(accountName);
    }

    async getCustomerById(customerId) {
        return await this.firebaseService.getCustomerById(customerId);
    }

    async updateCustomer(customerId, updateData) {
        return await this.firebaseService.updateCustomer(customerId, updateData);
    }

    generateRegistrationForm() {
        return `Please provide your information in this format:\n\n` +
               `*name|email|phone|address|accountName*\n\n` +
               `Example:\n` +
               `John Smith|john@email.com|+264 81 123 4567|123 Main St, Windhoek|johnsmith123\n\n` +
               `📋 *Requirements:*\n` +
               `• All fields are required\n` +
               `• Use a valid email address\n` +
               `• Account name must be unique\n` +
               `• Separate each field with "|" (pipe symbol)`;
    }

    formatCustomerInfo(customerInfo) {
        return `👤 *Customer Information*\n\n` +
               `Name: ${customerInfo.name}\n` +
               `Email: ${customerInfo.email}\n` +
               `Phone: ${customerInfo.phone}\n` +
               `Address: ${customerInfo.address}`;
    }

    generateWelcomeMessage(customerInfo, accountName) {
        return `🎉 Welcome back, *${customerInfo.name}*!\n\n` +
               `Your account: *${accountName}*\n` +
               `Account Score: ${customerInfo.score || 0} orders\n\n`;
    }

    generateRegistrationSuccessMessage(customerInfo, accountName) {
        return `✅ Account *${accountName}* created successfully!\n\n` +
               `Welcome to LLL Farm, *${customerInfo.name}*!\n` +
               `Your account is now active and ready to use.\n\n`;
    }
}

module.exports = CustomerService;