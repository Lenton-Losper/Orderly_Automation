class Customer {
    constructor(data = {}) {
        this.id = data.id || null;
        this.name = data.name || '';
        this.email = data.email || '';
        this.phone = data.phone || '';
        this.address = data.address || '';
        this.whatsappId = data.whatsappId || '';
        this.businessId = data.businessId || 'default';
        this.score = data.score || 0;
        this.accountName = data.accountName || data.id || '';
        this.createdAt = data.createdAt || new Date().toISOString();
        this.lastOrderDate = data.lastOrderDate || null;
        this.totalOrders = data.totalOrders || 0;
        this.totalSpent = data.totalSpent || 0;
        this.isActive = data.isActive !== undefined ? data.isActive : true;
        this.preferences = data.preferences || {};
        this.metadata = data.metadata || {};
    }

    // Validation methods
    isValid() {
        return this.hasRequiredFields() && this.hasValidEmail() && this.hasValidPhone();
    }

    hasRequiredFields() {
        return !!(this.name && this.email && this.phone && this.address && this.whatsappId);
    }

    hasValidEmail() {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(this.email);
    }

    hasValidPhone() {
        // Basic phone validation - adjust regex as needed for your region
        const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
        return this.phone && phoneRegex.test(this.phone) && this.phone.length >= 10;
    }

    hasValidWhatsAppId() {
        return this.whatsappId && this.whatsappId.includes('@s.whatsapp.net');
    }

    // Data formatting methods
    getFormattedPhone() {
        // Remove spaces and special characters for consistent formatting
        return this.phone.replace(/[\s\-\(\)]/g, '');
    }

    getDisplayName() {
        return this.name || this.accountName || 'Customer';
    }

    getShortAddress() {
        if (!this.address) return '';
        return this.address.length > 50 ? this.address.substring(0, 50) + '...' : this.address;
    }

    // Customer stats and metrics
    getCustomerLevel() {
        if (this.score >= 50) return 'VIP';
        if (this.score >= 20) return 'Gold';
        if (this.score >= 10) return 'Silver';
        return 'Bronze';
    }

    getCustomerLevelEmoji() {
        const level = this.getCustomerLevel();
        const emojis = {
            'VIP': '💎',
            'Gold': '🥇',
            'Silver': '🥈',
            'Bronze': '🥉'
        };
        return emojis[level] || '👤';
    }

    isNewCustomer() {
        return this.totalOrders === 0 || this.score === 0;
    }

    isFrequentCustomer() {
        return this.totalOrders >= 5 || this.score >= 10;
    }

    isVIPCustomer() {
        return this.score >= 50 || this.totalSpent >= 1000;
    }

    // Customer activity methods
    getAccountAge() {
        if (!this.createdAt) return 0;
        return Date.now() - new Date(this.createdAt).getTime();
    }

    getAccountAgeDays() {
        return Math.floor(this.getAccountAge() / (1000 * 60 * 60 * 24));
    }

    getLastOrderAge() {
        if (!this.lastOrderDate) return null;
        return Date.now() - new Date(this.lastOrderDate).getTime();
    }

    getLastOrderAgeDays() {
        const age = this.getLastOrderAge();
        return age ? Math.floor(age / (1000 * 60 * 60 * 24)) : null;
    }

    isRecentCustomer() {
        const lastOrderDays = this.getLastOrderAgeDays();
        return lastOrderDays !== null && lastOrderDays <= 30;
    }

    // Data transformation methods
    toFirebaseData() {
        return {
            name: this.name,
            email: this.email,
            phone: this.phone,
            address: this.address,
            whatsappId: this.whatsappId,
            businessId: this.businessId,
            score: this.score,
            createdAt: this.createdAt,
            lastOrderDate: this.lastOrderDate,
            totalOrders: this.totalOrders,
            totalSpent: this.totalSpent,
            isActive: this.isActive,
            preferences: this.preferences,
            metadata: this.metadata
        };
    }

    toDisplayData() {
        return {
            id: this.id,
            name: this.getDisplayName(),
            email: this.email,
            phone: this.getFormattedPhone(),
            address: this.getShortAddress(),
            level: this.getCustomerLevel(),
            levelEmoji: this.getCustomerLevelEmoji(),
            score: this.score,
            totalOrders: this.totalOrders,
            totalSpent: this.totalSpent,
            accountAgeDays: this.getAccountAgeDays(),
            lastOrderDays: this.getLastOrderAgeDays(),
            isNew: this.isNewCustomer(),
            isFrequent: this.isFrequentCustomer(),
            isVIP: this.isVIPCustomer(),
            isRecent: this.isRecentCustomer()
        };
    }

    // Update methods
    updateScore(increment = 1) {
        this.score = Math.max(0, this.score + increment);
        console.log(`📈 Customer ${this.name} score updated: ${this.score}`);
    }

    recordOrder(orderValue = 0) {
        this.totalOrders++;
        this.totalSpent += orderValue;
        this.lastOrderDate = new Date().toISOString();
        this.updateScore(1);
        console.log(`📋 Order recorded for ${this.name}: N$${orderValue.toFixed(2)}`);
    }

    updateContactInfo(updates) {
        if (updates.name) this.name = updates.name;
        if (updates.email && this.isValidEmail(updates.email)) this.email = updates.email;
        if (updates.phone && this.isValidPhone(updates.phone)) this.phone = updates.phone;
        if (updates.address) this.address = updates.address;
        
        console.log(`📝 Contact info updated for ${this.name}`);
    }

    setPreference(key, value) {
        this.preferences[key] = value;
        console.log(`⚙️ Preference set for ${this.name}: ${key} = ${value}`);
    }

    getPreference(key, defaultValue = null) {
        return this.preferences[key] || defaultValue;
    }

    setMetadata(key, value) {
        this.metadata[key] = value;
    }

    getMetadata(key, defaultValue = null) {
        return this.metadata[key] || defaultValue;
    }

    // Welcome message generation
    getWelcomeMessage() {
        const emoji = this.getCustomerLevelEmoji();
        const level = this.getCustomerLevel();
        
        if (this.isNewCustomer()) {
            return `👋 Welcome to our store, ${this.name}!`;
        } else if (this.isVIPCustomer()) {
            return `${emoji} Welcome back, ${this.name}! Thank you for being a ${level} customer.`;
        } else {
            return `🎉 Welcome back, ${this.name}! You're a ${level} customer with ${this.score} points.`;
        }
    }

    // Static validation methods
    static isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    static isValidPhone(phone) {
        const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
        return phone && phoneRegex.test(phone) && phone.length >= 10;
    }

    static isValidName(name) {
        return name && name.trim().length >= 2;
    }

    static isValidAddress(address) {
        return address && address.trim().length >= 5;
    }

    // Factory methods
    static fromFirebaseData(id, data) {
        return new Customer({
            id,
            ...data
        });
    }

    static fromRegistrationData(registrationData, whatsappId, businessId = 'default') {
        return new Customer({
            name: registrationData.name,
            email: registrationData.email,
            phone: registrationData.phone,
            address: registrationData.address,
            accountName: registrationData.accountName,
            whatsappId,
            businessId,
            createdAt: new Date().toISOString()
        });
    }

    // Comparison methods
    equals(otherCustomer) {
        return this.whatsappId === otherCustomer.whatsappId && 
               this.businessId === otherCustomer.businessId;
    }

    // String representation
    toString() {
        return `Customer(${this.name}, ${this.email}, ${this.getCustomerLevel()})`;
    }
}

module.exports = Customer;