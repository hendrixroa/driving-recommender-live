#!/bin/bash

# Setup script for Amplify Gen 2 secrets
# This script sets the required secrets for the Voice Route Planner

echo "Setting up Amplify secrets..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "Error: .env file not found. Please create one from .env.example"
    exit 1
fi

# Load environment variables from .env
source .env

# Set Google Client ID secret
echo "Setting GOOGLE_CLIENT_ID secret..."
echo "$GOOGLE_CLIENT_ID" | npx ampx sandbox secret set GOOGLE_CLIENT_ID

# Set Google Client Secret secret
echo "Setting GOOGLE_CLIENT_SECRET secret..."
echo "$GOOGLE_CLIENT_SECRET" | npx ampx sandbox secret set GOOGLE_CLIENT_SECRET

echo ""
echo "✅ Secrets setup complete!"
echo ""
echo "Secrets set:"
echo "  - GOOGLE_CLIENT_ID"
echo "  - GOOGLE_CLIENT_SECRET"
echo ""
echo "You can now run: npm run amplify:sandbox"
