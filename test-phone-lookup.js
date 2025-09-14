// Simple test to demonstrate phone number lookup concept
// This shows how we can search for existing tenants by phone number

const phoneNumber = "264817375744";

console.log("🔍 Phone Number Lookup Test");
console.log("============================");
console.log(`Phone Number: ${phoneNumber}`);
console.log("");

// Based on the Firebase console you showed me, here are the tenants that exist:
const existingTenants = [
    {
        id: "tenant_1757795389583_tr1yiscf8",
        name: "My Business",
        phoneId: "264817375744",
        ownerId: "quV77xP1NjcKhsZI2ZKjs9RBHpQ2",
        isDefault: true,
        createdAt: 1757795389583
    },
    {
        id: "yLKACA3wVssv0bxrxapR", 
        name: "llosperoffrgtricial@gmail.com",
        phoneId: "264817375744",
        ownerId: "some_owner_id",
        isDefault: false,
        createdAt: 1757795389000
    },
    {
        id: "zbCkimoijJjMvJp6MLJC",
        name: "llosperoffrgtricial@gmail.com", 
        phoneId: "264817375744",
        ownerId: "some_owner_id",
        isDefault: false,
        createdAt: 1757795388000
    }
];

console.log("📋 Existing Tenants Found:");
console.log("==========================");

existingTenants.forEach((tenant, index) => {
    console.log(`${index + 1}. Tenant ID: ${tenant.id}`);
    console.log(`   Business Name: ${tenant.name}`);
    console.log(`   Phone ID: ${tenant.phoneId}`);
    console.log(`   Owner ID: ${tenant.ownerId}`);
    console.log(`   Is Default: ${tenant.isDefault}`);
    console.log(`   Created: ${new Date(tenant.createdAt).toISOString()}`);
    console.log("   ---");
});

// Find the best tenant to use
console.log("\n🎯 Tenant Selection Logic:");
console.log("==========================");

// Priority 1: Find tenant with isDefault: true
const defaultTenant = existingTenants.find(tenant => tenant.isDefault === true);
if (defaultTenant) {
    console.log(`✅ Found default tenant: ${defaultTenant.id}`);
    console.log(`   This should be used for the bot instance`);
} else {
    console.log("❌ No default tenant found");
}

// Priority 2: Find most recent tenant
const sortedTenants = existingTenants.sort((a, b) => b.createdAt - a.createdAt);
console.log(`\n📅 Most recent tenant: ${sortedTenants[0].id}`);
console.log(`   Created: ${new Date(sortedTenants[0].createdAt).toISOString()}`);

console.log("\n💡 Recommendation:");
console.log("==================");
if (defaultTenant) {
    console.log(`Use tenant: ${defaultTenant.id}`);
    console.log(`Reason: This is the default tenant for this phone number`);
} else {
    console.log(`Use tenant: ${sortedTenants[0].id}`);
    console.log(`Reason: This is the most recently created tenant`);
}

console.log("\n🚀 Next Steps:");
console.log("==============");
const recommendedTenant = defaultTenant || sortedTenants[0];
console.log(`1. Stop any existing bot instances: pm2 delete all`);
console.log(`2. Start bot for tenant: pm2 start start-tenant.js --name "bot-${phoneNumber}" -- ${recommendedTenant.id}`);
console.log(`3. View logs: pm2 logs bot-${phoneNumber}`);
console.log(`4. The QR code will be stored at: /tenants/${recommendedTenant.id}/botSession/current`);


