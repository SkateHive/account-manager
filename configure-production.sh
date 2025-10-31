#!/bin/bash
# configure-production.sh - Helper script to set up production environment

echo "🔧 Configuring production environment..."

if [ ! -f ".env" ]; then
    echo "❌ .env file not found. Please create it first."
    exit 1
fi

echo "📋 Copying values from .env to .env.production..."

# Copy values from existing .env but set NODE_ENV to production
cp .env .env.production

# Update NODE_ENV to production
sed -i '' 's/NODE_ENV=.*/NODE_ENV=production/' .env.production

echo "✅ Production environment configured!"
echo "📝 Please review .env.production and make any necessary adjustments"
echo ""
echo "🚀 To deploy, run:"
echo "   ./deploy.sh"