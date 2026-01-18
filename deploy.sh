#!/bin/bash
set -e

echo "🐳 Deploying Skatehive Account Manager with Docker + Tailscale"

# Configuration
CONTAINER_NAME="skatehive-account-manager"
IMAGE_NAME="skatehive-account-manager"
HOST_PORT="3001"
CONTAINER_PORT="3000"

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    echo "❌ .env.production file not found!"
    echo "📝 Please create .env.production based on .env.production.example"
    echo "   cp .env.production.example .env.production"
    echo "   # Edit .env.production with your actual values"
    exit 1
fi

echo "🔍 Checking environment..."
source .env.production

# Validate required environment variables
if [ -z "$HIVE_CREATOR" ] || [ -z "$HIVE_CREATOR_ACTIVE_WIF" ] || [ -z "$SIGNER_TOKEN" ]; then
    echo "❌ Missing required environment variables in .env.production"
    echo "   Required: HIVE_CREATOR, HIVE_CREATOR_ACTIVE_WIF, SIGNER_TOKEN"
    exit 1
fi

echo "🛑 Stopping existing container if running..."
docker stop $CONTAINER_NAME 2>/dev/null || true
docker rm $CONTAINER_NAME 2>/dev/null || true

echo "🏗️  Building Docker image..."
docker build -t $IMAGE_NAME .

echo "🚀 Starting container..."
docker run -d \
  --name $CONTAINER_NAME \
  --restart unless-stopped \
  -p $HOST_PORT:$CONTAINER_PORT \
  --env-file .env.production \
  $IMAGE_NAME

echo "⏳ Waiting for service to start..."
sleep 10

echo "🔍 Testing service health..."
if curl -f http://localhost:$HOST_PORT/healthz > /dev/null 2>&1; then
    echo "✅ Service is healthy on port $HOST_PORT"
else
    echo "❌ Service health check failed"
    echo "📋 Container logs:"
    docker logs $CONTAINER_NAME --tail 20
    exit 1
fi

echo "🌐 Enabling Tailscale Funnel..."
if /Applications/Tailscale.app/Contents/MacOS/Tailscale funnel $HOST_PORT on; then
    echo "✅ Tailscale Funnel enabled successfully"
    echo ""
    echo "🎉 Deployment Complete!"
    echo "📍 Local URL:     http://localhost:$HOST_PORT"
    echo "🌍 Public URL:    https://minivlad.tail83ea3e.ts.net"
    echo "🔍 Health Check:  curl https://minivlad.tail83ea3e.ts.net/healthz"
    echo ""
    echo "📊 Container Status:"
    docker ps --filter name=$CONTAINER_NAME --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
else
    echo "⚠️  Tailscale Funnel setup failed, but container is running"
    echo "   You can manually enable it with:"
    echo "   /Applications/Tailscale.app/Contents/MacOS/Tailscale funnel $HOST_PORT on"
fi