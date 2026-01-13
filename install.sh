#!/bin/bash

# Metabase MCP Server - Installation Script

set -e

echo ""
echo "========================================="
echo "🚀 Metabase MCP Server Installation"
echo "========================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version)
echo "✅ Node.js detected: $NODE_VERSION"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm is not installed"
    exit 1
fi

NPM_VERSION=$(npm --version)
echo "✅ npm detected: $NPM_VERSION"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install
echo ""

# Build the project
echo "🔨 Building the project..."
npm run build
echo ""

# Link globally
echo "🔗 Installing globally (may require sudo password)..."
npm link
echo ""

# Verify installation
if command -v metabase-server &> /dev/null; then
    echo "✅ Installation successful!"
    echo ""
    echo "========================================="
    echo "📋 Next Steps"
    echo "========================================="
    echo ""
    echo "1. Generate your configuration:"
    echo "   cd $(pwd)"
    echo "   npm run config:quick -- nodata https://YOUR_METABASE_URL YOUR_API_KEY"
    echo ""
    echo "2. Copy the generated JSON to your Claude Desktop config:"

    if [[ "$OSTYPE" == "darwin"* ]]; then
        CONFIG_PATH="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
        CONFIG_PATH="$APPDATA/Claude/claude_desktop_config.json"
    else
        CONFIG_PATH="$HOME/.config/Claude/claude_desktop_config.json"
    fi

    echo "   $CONFIG_PATH"
    echo ""
    echo "3. Restart Claude Desktop"
    echo ""
    echo "========================================="
    echo ""
    echo "For more information, see:"
    echo "  - QUICK_START.md for configuration"
    echo "  - README.md for detailed documentation"
    echo ""
else
    echo "❌ Installation failed - metabase-server command not found"
    exit 1
fi
