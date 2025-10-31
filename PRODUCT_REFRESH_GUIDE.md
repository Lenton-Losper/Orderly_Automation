# Product Refresh Guide

## 🔄 Automatic Product Refresh

Your bot **already has real-time product refresh** built in! Here's how it works:

### Real-Time Updates (Active)
- ✅ **Firestore Listeners**: The bot subscribes to real-time changes in Firebase
- ✅ **Automatic Updates**: When you add/edit/delete products in the frontend, the bot automatically updates its product list
- ✅ **No Manual Refresh Needed**: Products sync within seconds of being added in Firebase

### How It Works:
1. When the bot starts, it subscribes to: `vendors/{businessId}/products` or `vendors/{businessId}/tenants/{tenantId}/products`
2. Any changes (add/edit/delete) trigger an automatic update
3. The bot's product cache is updated immediately
4. New customers will see the updated product list right away

### Cache Settings:
- **Cache Duration**: 5 minutes (for performance)
- **Real-time Override**: Firestore listeners bypass cache for immediate updates
- **Manual Clear**: Available via API if needed

## 🧪 Testing Product Refresh

### Test Scenario:
1. **Add a new product** in your frontend/Firebase
2. **Wait 5-10 seconds** (for Firestore sync)
3. **Ask the bot**: "Show me products" or "PRODUCTS"
4. **Verify**: New product should appear immediately

### Manual Cache Clear (if needed):
```bash
# The bot will auto-refresh, but you can also restart it:
pm2 restart all

# Or clear cache via API (if you implement an endpoint)
```

## 🔍 Monitoring Product Updates

Check logs for product updates:
```bash
# Watch for product refresh logs
pm2 logs | grep -i "product\|refresh\|updated"

# Look for these messages:
# "🔄 Live products updated for business..."
# "SCALABLE: Subscribed to products for vendor..."
```

## ⚙️ Configuration

### Cache Timeout (Optional)
If you want to adjust cache duration, edit `src/services/productService.js`:
```javascript
this.cacheTimeout = 5 * 60 * 1000; // Change this value (in milliseconds)
```

### Real-Time Subscription Path
The bot automatically uses:
- **Multi-tenant**: `vendors/{businessId}/tenants/{tenantId}/products`
- **Legacy**: `vendors/{businessId}/products` (fallback)

## 🐛 Troubleshooting

### Products not updating?
1. **Check Firestore path**: Ensure products are saved to the correct path
2. **Check logs**: Look for "SCALABLE: Subscribed to products..." message
3. **Verify subscription**: Products must be under `vendors/{businessId}/products`
4. **Restart bot**: `pm2 restart all` (forces re-subscription)

### Product cache issues?
1. **Clear cache**: Restart bot (`pm2 restart all`)
2. **Check timeout**: Verify cache timeout in productService.js
3. **Monitor logs**: Check for cache-related messages

## 📊 Product Path Structure

Your Firebase structure should be:
```
vendors/
  └── {businessId}/
      └── tenants/
          └── {tenantId}/
              └── products/
                  └── {productId}/
                      ├── name: "Product Name"
                      ├── price: 34.00
                      ├── isActive: true
                      ├── isAvailable: true
                      └── ...
```

Or legacy structure:
```
vendors/
  └── {businessId}/
      └── products/
          └── {productId}/
              └── ...
```

## ✅ Success Indicators

You'll know product refresh is working when:
- ✅ New products appear in bot responses immediately
- ✅ Logs show "🔄 Live products updated..."
- ✅ No manual refresh needed after adding products
- ✅ Product count updates automatically

