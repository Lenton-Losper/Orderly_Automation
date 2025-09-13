# Multi-Tenant WhatsApp Bot Management

## Overview

This system provides complete tenant lifecycle management for the WhatsApp bot, eliminating hardcoded configurations and manual phone number specification.

## Quick Start

### 1. Create a Tenant
```bash
node create-tenant.js <tenantId> <businessPhone> [businessName] [businessEmail]
```

**Example:**
```bash
node create-tenant.js tenant_1757499607349_xul4pq02s 264817375744 "Bob's Farm" "bob@farm.com"
```

### 2. Start a Tenant
```bash
pm2 start start-tenant.js --name <tenantName> -- <tenantId>
```

**Example:**
```bash
pm2 start start-tenant.js --name tenant-bob -- tenant_1757499607349_xul4pq02s
```

### 3. Manage Tenants
```bash
# List all tenants
node manage-tenants.js list

# Show tenant details
node manage-tenants.js show <tenantId>

# Update tenant
node update-tenant.js <tenantId> <field> <value>

# Delete tenant
node manage-tenants.js delete <tenantId>
```

## Commands Reference

### Tenant Creation
- **File:** `create-tenant.js`
- **Purpose:** Create new tenant with persistent configuration
- **Usage:** `node create-tenant.js <tenantId> <businessPhone> [businessName] [businessEmail]`
- **Features:**
  - Automatic port allocation
  - Persistent configuration storage
  - Duplicate tenant prevention

### Tenant Startup
- **File:** `start-tenant.js`
- **Purpose:** Start tenant bot with loaded configuration
- **Usage:** `pm2 start start-tenant.js --name <name> -- <tenantId>`
- **Features:**
  - Loads configuration from persistent storage
  - Sets environment variables automatically
  - No manual phone number specification needed

### Tenant Management
- **File:** `manage-tenants.js`
- **Purpose:** List, show, and delete tenants
- **Commands:**
  - `list` - List all configured tenants
  - `show <tenantId>` - Show detailed tenant configuration
  - `delete <tenantId>` - Delete tenant and all data

### Tenant Updates
- **File:** `update-tenant.js`
- **Purpose:** Update tenant configuration
- **Usage:** `node update-tenant.js <tenantId> <field> <value>`
- **Fields:**
  - `businessPhone` - WhatsApp business phone number
  - `businessName` - Business display name
  - `businessEmail` - Business email address
  - `businessAddress` - Business address
  - `isActive` - Enable/disable tenant (true/false)

## Configuration Storage

Tenant configurations are stored in:
```
/root/Orderly_Automation/tenants/
├── <tenantId>/
│   ├── tenant-config.json    # Persistent configuration
│   ├── auth/                 # WhatsApp auth data
│   ├── logs/                 # Tenant-specific logs
│   └── invoices/             # Generated invoices
```

## Port Allocation

- **API Ports:** 4000+ (even numbers)
- **WebSocket Ports:** 4001+ (odd numbers)
- **Automatic collision avoidance**
- **Persistent port assignment per tenant**

## Error Handling

### Common Issues

1. **Tenant not found:**
   ```
   ❌ Tenant configuration not found for: tenant_123
   💡 Create the tenant first: node create-tenant.js tenant_123 <phone>
   ```

2. **Missing parameters:**
   ```
   ❌ Missing required parameters
   Usage: node create-tenant.js <tenantId> <businessPhone> [businessName]
   ```

3. **Duplicate tenant:**
   ```
   ⚠️ Tenant tenant_123 already exists. Use update-tenant.js to modify.
   ```

## Best Practices

### 1. Naming Conventions
- Use descriptive tenant IDs: `tenant_1757499607349_xul4pq02s`
- Use business names: `bobs_farm_tenant`
- Avoid special characters and spaces

### 2. Phone Number Format
- Use international format: `264817375744`
- Include country code
- No spaces or special characters

### 3. PM2 Management
- Use descriptive PM2 names: `tenant-bob`, `tenant-farm1`
- Monitor logs: `pm2 logs <tenantName>`
- Check status: `pm2 list`

### 4. Configuration Updates
- Update configurations before restarting tenants
- Test changes in development first
- Keep backups of important configurations

## Troubleshooting

### Tenant Won't Start
1. Check if tenant exists: `node manage-tenants.js show <tenantId>`
2. Verify configuration: Check `tenant-config.json`
3. Check PM2 logs: `pm2 logs <tenantName>`
4. Verify ports: `netstat -tulpn | grep :400`

### Wrong Phone Number
1. Update tenant: `node update-tenant.js <tenantId> businessPhone <newPhone>`
2. Restart tenant: `pm2 restart <tenantName>`

### Port Conflicts
1. Check allocated ports: `node manage-tenants.js show <tenantId>`
2. Verify port availability: `netstat -tulpn | grep :<port>`
3. Recreate tenant if needed: Delete and recreate

## Migration from Old System

### Before (Manual Configuration)
```bash
# Old way - manual phone specification
pm2 start start-tenant.js --name tenant-bob -- tenant_123 264817375744
```

### After (Persistent Configuration)
```bash
# New way - create once, start simply
node create-tenant.js tenant_123 264817375744 "Business Name"
pm2 start start-tenant.js --name tenant-bob -- tenant_123
```

## System Benefits

### ✅ Eliminated Issues
- No more "Usage: node start-tenant.js" errors
- No more hardcoded phone numbers
- No more manual argument specification
- No more configuration drift

### ✅ Added Features
- Persistent tenant configuration storage
- Automatic port allocation and management
- Complete tenant lifecycle management
- Clear error messages and troubleshooting
- Scalable multi-tenant architecture

### ✅ Improved Workflow
- Create tenant once with all configuration
- Start tenant with single parameter
- Update configuration without restart
- Delete tenant completely
- List and manage all tenants

This system transforms the WhatsApp bot from a manual, error-prone configuration model to a robust, automated tenant management system.
