#!/usr/bin/env node

/**
 * Test Email Service Configuration
 * Run this on your server to diagnose email issues
 */

require('dotenv').config();

async function testEmailService() {
    console.log('🧪 Testing Email Service Configuration...\n');

    // 1. Check environment variables
    console.log('1️⃣ Checking Environment Variables:');
    const requiredVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
    let allVarsPresent = true;

    requiredVars.forEach(varName => {
        const value = process.env[varName];
        if (value) {
            // Mask password
            const displayValue = varName === 'SMTP_PASS' ? '***' + value.slice(-4) : value;
            console.log(`   ✅ ${varName}: ${displayValue}`);
        } else {
            console.log(`   ❌ ${varName}: NOT SET`);
            allVarsPresent = false;
        }
    });

    if (!allVarsPresent) {
        console.log('\n⚠️  Missing required environment variables!');
        console.log('   Add these to your .env file on the server:');
        console.log('   SMTP_HOST=smtp.gmail.com');
        console.log('   SMTP_PORT=587');
        console.log('   SMTP_USER=your-email@gmail.com');
        console.log('   SMTP_PASS=your-app-password\n');
        return;
    }

    // 2. Test email service initialization
    console.log('\n2️⃣ Testing Email Service Initialization:');
    try {
        const EmailService = require('./src/services/emailService');
        const emailService = new EmailService();
        
        const initialized = await emailService.initialize();
        
        if (initialized) {
            console.log('   ✅ Email service initialized successfully');
        } else {
            console.log('   ❌ Email service failed to initialize');
            console.log('   Check the logs above for details');
            return;
        }

        // 3. Test SMTP connection
        console.log('\n3️⃣ Testing SMTP Connection:');
        if (emailService.transporter) {
            try {
                await emailService.transporter.verify();
                console.log('   ✅ SMTP connection verified');
            } catch (verifyError) {
                console.log('   ❌ SMTP connection failed:', verifyError.message);
                if (verifyError.message.includes('Invalid login')) {
                    console.log('   💡 Tip: Check your SMTP_USER and SMTP_PASS');
                    console.log('   💡 For Gmail, use an App Password, not your regular password');
                }
                return;
            }
        }

        // 4. Test getting business email from Firebase
        console.log('\n4️⃣ Testing Business Email Retrieval:');
        try {
            const businessId = '264813141453';
            const tenantId = process.env.TENANT_ID || 'tenant_1757833139935_2h9n7r7ed';
            
            console.log(`   Checking for business: ${businessId}, tenant: ${tenantId}`);
            const businessEmail = await emailService.getBusinessEmail(businessId, tenantId);
            
            if (businessEmail) {
                console.log(`   ✅ Business email found: ${businessEmail}`);
            } else {
                console.log(`   ⚠️  No business email found in Firebase`);
                console.log(`   💡 Make sure the tenant document has an 'email' field`);
                console.log(`   💡 Path: tenants/${tenantId}/email`);
                return;
            }

            // 5. Test sending a test email
            console.log('\n5️⃣ Sending Test Email:');
            console.log(`   Sending test email to: ${businessEmail}`);
            
            const testResult = await emailService.sendInvoiceEmail({
                businessEmail,
                orderId: 'TEST-ORDER-123',
                customerName: 'Test Customer',
                total: 100,
                pdfPath: null, // No PDF for test
                businessName: 'Test Business',
                items: [
                    { name: 'Test Product', quantity: 1, price: 100 }
                ]
            });

            if (testResult.success) {
                console.log('   ✅ Test email sent successfully!');
                console.log(`   📧 Message ID: ${testResult.messageId}`);
                console.log(`   📧 Check ${businessEmail} inbox (and spam folder)`);
            } else {
                console.log('   ❌ Test email failed:', testResult.error);
            }

        } catch (emailError) {
            console.log('   ❌ Error:', emailError.message);
            console.log('   Stack:', emailError.stack);
        }

    } catch (error) {
        console.error('❌ Error testing email service:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Run the test
testEmailService().then(() => {
    console.log('\n✅ Email service test completed');
    process.exit(0);
}).catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
});

