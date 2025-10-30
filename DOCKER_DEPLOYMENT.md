# 🐳 Docker Deployment Guide - LLL Farming WhatsApp Bot

## 📋 Table of Contents
- [Overview](#overview)
- [Quick Start](#quick-start)
- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Development Deployment](#development-deployment)
- [Production Deployment](#production-deployment)
- [Multi-Tenant Deployment](#multi-tenant-deployment)
- [Service Architecture](#service-architecture)
- [Troubleshooting](#troubleshooting)
- [Migration Guide](#migration-guide)

## 🎯 Overview

This guide covers the complete Docker deployment of the LLL Farming WhatsApp Bot system, including:

- **Main Backend**: Node.js WhatsApp bot (port 3000)
- **Bot Training API**: Rasa model training service (port 3001)
- **Rasa Server**: NLP processing engine (port 5005)
- **Rasa Actions**: Custom business logic (port 5055)
- **Redis**: Caching and pub/sub messaging (port 6379)
- **MongoDB**: Optional data storage (port 27017)

## 🚀 Quick Start

### Development Environment
```bash
# Start development environment with hot-reload
./start-docker-dev.sh

# Or manually
docker-compose -f docker-compose.dev.yml up --build
```

### Production Environment
```bash
# Start production environment
./start-docker-prod.sh

# Or manually
docker-compose -f docker-compose.full.yml up --build -d
```

## 📋 Prerequisites

### Required Software
- **Docker**: Version 20.10 or higher
- **Docker Compose**: Version 2.0 or higher
- **Git**: For cloning the repository

### Required Files
- `lllfarming-firebase-adminsdk-fbsvc-c9ce466038.json` - Firebase service account credentials
- `env.example` - Environment variables template

### System Requirements
- **RAM**: Minimum 4GB, Recommended 8GB
- **Storage**: Minimum 10GB free space
- **CPU**: 2+ cores recommended
- **Network**: Internet connection for Docker images and Firebase

## 🔧 Environment Setup

### 1. Clone Repository
```bash
git clone <your-repo-url>
cd LLLFarming_Automation
```

### 2. Configure Environment Variables
```bash
# Copy environment template
cp env.example .env

# Edit environment variables
nano .env
```

### 3. Verify Firebase Credentials
```bash
# Ensure Firebase credentials file exists
ls -la lllfarming-firebase-adminsdk-fbsvc-c9ce466038.json
```

### 4. Create Required Directories
```bash
mkdir -p logs tenants rasa-models
```

## 🛠️ Development Deployment

### Features
- ✅ Hot-reload for code changes
- ✅ Volume mounts for live editing
- ✅ Development tools (Redis Commander, Mongo Express)
- ✅ Debug logging enabled
- ✅ Source code accessible from host

### Start Development Environment
```bash
# Using startup script (recommended)
./start-docker-dev.sh

# Or manually
docker-compose -f docker-compose.dev.yml up --build
```

### Development URLs
- **Backend API**: http://localhost:3000
- **Bot Training API**: http://localhost:3001
- **Rasa Server**: http://localhost:5005
- **Rasa Actions**: http://localhost:5055
- **Redis Commander**: http://localhost:8081
- **Mongo Express**: http://localhost:8082 (admin/admin)

### Development Commands
```bash
# View logs
docker-compose -f docker-compose.dev.yml logs -f [service]

# Restart specific service
docker-compose -f docker-compose.dev.yml restart [service]

# Rebuild and restart
docker-compose -f docker-compose.dev.yml up --build [service]

# Stop all services
docker-compose -f docker-compose.dev.yml down
```

## 🏭 Production Deployment

### Features
- ✅ Optimized for performance
- ✅ Security hardening
- ✅ Health checks enabled
- ✅ Non-root users
- ✅ Read-only credential mounts
- ✅ Production logging

### Start Production Environment
```bash
# Using startup script (recommended)
./start-docker-prod.sh

# Or manually
docker-compose -f docker-compose.full.yml up --build -d
```

### Production URLs
- **Backend API**: http://localhost:3000
- **Bot Training API**: http://localhost:3001
- **Rasa Server**: http://localhost:5005
- **Rasa Actions**: http://localhost:5055

### Production Commands
```bash
# View logs
docker-compose -f docker-compose.full.yml logs -f [service]

# Check service status
docker-compose -f docker-compose.full.yml ps

# Health check
curl http://localhost:3000/health

# Update services
docker-compose -f docker-compose.full.yml pull
docker-compose -f docker-compose.full.yml up -d

# Stop all services
docker-compose -f docker-compose.full.yml down
```

## 🏢 Multi-Tenant Deployment

### Single Backend with Tenant Routing (Recommended)
```bash
# Start single backend instance
docker-compose -f docker-compose.full.yml up -d

# Create tenants
node create-tenant.js tenant_123 264813141453 "Business Name"

# All tenants share the same backend instance
# Data isolation handled by Firebase collections
```

### Multiple Backend Instances (Advanced)
```bash
# Start multiple backend containers for different tenants
docker-compose -f docker-compose.full.yml up -d backend
docker-compose -f docker-compose.full.yml up -d backend --scale backend=3

# Configure each instance with different TENANT_ID
```

### Tenant Management
```bash
# List all tenants
node manage-tenants.js list

# Show tenant details
node manage-tenants.js show tenant_123

# Update tenant configuration
node update-tenant.js tenant_123 businessName "New Business Name"

# Delete tenant
node manage-tenants.js delete tenant_123
```

## 🏗️ Service Architecture

### Container Structure
```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Network                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Backend   │  │ Bot Training│  │    Rasa     │        │
│  │   :3000     │  │    :3001    │  │    :5005    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │Rasa Actions │  │    Redis    │  │   MongoDB   │        │
│  │   :5055     │  │   :6379     │  │   :27017    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

### Service Dependencies
```
Backend → Redis, MongoDB, Rasa
Bot Training → Backend, Redis, MongoDB
Rasa Actions → Rasa, Backend
Rasa → Redis
```

### Data Flow
```
WhatsApp → Backend → Rasa → Rasa Actions → Backend → WhatsApp
                ↓
            Redis (pub/sub) → WebSocket → Frontend
                ↓
            Firebase (persistence)
```

## 🔍 Troubleshooting

### Common Issues

#### 1. Services Not Starting
```bash
# Check Docker status
docker info

# Check container logs
docker-compose -f docker-compose.full.yml logs [service]

# Check service health
docker-compose -f docker-compose.full.yml ps
```

#### 2. Firebase Connection Issues
```bash
# Verify credentials file
ls -la lllfarming-firebase-adminsdk-fbsvc-c9ce466038.json

# Check Firebase permissions
docker-compose -f docker-compose.full.yml exec backend node -e "
const admin = require('firebase-admin');
admin.initializeApp({
  credential: admin.credential.cert('/app/firebase-credentials.json')
});
console.log('Firebase connected successfully');
"
```

#### 3. Rasa Connection Issues
```bash
# Test Rasa server
curl http://localhost:5005/status

# Test Rasa actions
curl http://localhost:5055/health

# Check Rasa logs
docker-compose -f docker-compose.full.yml logs rasa
docker-compose -f docker-compose.full.yml logs rasa-actions
```

#### 4. WebSocket Connection Issues
```bash
# Check Redis connection
docker-compose -f docker-compose.full.yml exec redis redis-cli ping

# Check WebSocket server
curl http://localhost:8080

# Check WebSocket logs
docker-compose -f docker-compose.full.yml logs backend | grep WebSocket
```

#### 5. Port Conflicts
```bash
# Check port usage
netstat -tulpn | grep :3000
netstat -tulpn | grep :5005

# Stop conflicting services
sudo lsof -ti:3000 | xargs kill -9
```

### Debug Commands
```bash
# Enter container shell
docker-compose -f docker-compose.full.yml exec backend sh
docker-compose -f docker-compose.full.yml exec rasa bash

# Check environment variables
docker-compose -f docker-compose.full.yml exec backend env

# Check file permissions
docker-compose -f docker-compose.full.yml exec backend ls -la /app/

# Monitor resource usage
docker stats
```

### Performance Optimization
```bash
# Increase Docker memory limit
# Edit Docker Desktop settings: Resources → Memory → 8GB+

# Optimize container resources
docker-compose -f docker-compose.full.yml up -d --scale backend=2

# Monitor performance
docker-compose -f docker-compose.full.yml exec backend top
```

## 📦 Migration Guide

### From Local Development to Docker

#### 1. Backup Current Setup
```bash
# Backup current data
cp -r tenants/ tenants-backup/
cp -r logs/ logs-backup/
cp -r rasa-models/ rasa-models-backup/
```

#### 2. Stop Local Services
```bash
# Stop PM2 processes
pm2 stop all
pm2 delete all

# Stop local Rasa
pkill -f rasa

# Stop local Redis/MongoDB
sudo systemctl stop redis
sudo systemctl stop mongodb
```

#### 3. Start Docker Environment
```bash
# Start development environment
./start-docker-dev.sh

# Verify all services are running
docker-compose -f docker-compose.dev.yml ps
```

#### 4. Test Migration
```bash
# Test WhatsApp bot
# Send a test message to verify functionality

# Test API endpoints
curl http://localhost:3000/health
curl http://localhost:3001/health

# Test Rasa integration
curl -X POST http://localhost:5005/webhooks/rest/webhook \
  -H "Content-Type: application/json" \
  -d '{"sender": "test", "message": "hello"}'
```

### From Development to Production

#### 1. Prepare Production Environment
```bash
# Set production environment
export NODE_ENV=production

# Update environment variables
cp env.example .env
# Edit .env with production values
```

#### 2. Deploy Production
```bash
# Start production environment
./start-docker-prod.sh

# Verify deployment
curl http://localhost:3000/health
```

#### 3. Configure Reverse Proxy (Optional)
```nginx
# Nginx configuration example
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    location /api/training {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 📚 Additional Resources

### Documentation
- [Docker Compose Reference](https://docs.docker.com/compose/)
- [Rasa Documentation](https://rasa.com/docs/)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)

### Support
- Check logs: `docker-compose -f docker-compose.full.yml logs -f`
- Health checks: `curl http://localhost:3000/health`
- Service status: `docker-compose -f docker-compose.full.yml ps`

### Maintenance
```bash
# Update all images
docker-compose -f docker-compose.full.yml pull

# Clean up unused images
docker system prune -a

# Backup volumes
docker run --rm -v lllfarming_redis-data:/data -v $(pwd):/backup alpine tar czf /backup/redis-backup.tar.gz -C /data .
```

---

## 🎉 Success!

Your LLL Farming WhatsApp Bot is now fully containerized and ready for deployment! 

**Next Steps:**
1. Test the development environment
2. Configure your production environment
3. Set up monitoring and logging
4. Deploy to your preferred cloud platform

For additional support, check the troubleshooting section or review the service logs.







