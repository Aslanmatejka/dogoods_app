#!/bin/bash

echo "🚀 Setting up Supabase MCP Server..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Check for environment variables
if [ -z "$VITE_SUPABASE_URL" ] && [ -z "$SUPABASE_URL" ]; then
    echo "⚠️  Warning: VITE_SUPABASE_URL not set. MCP server will need this to run."
    echo "   Set it in your .env.local file or shell environment."
fi

if [ -z "$VITE_SUPABASE_ANON_KEY" ] && [ -z "$SUPABASE_ANON_KEY" ]; then
    echo "⚠️  Warning: VITE_SUPABASE_ANON_KEY not set. MCP server will need this to run."
    echo "   Set it in your .env.local file or shell environment."
fi

# Navigate to mcp-server directory
cd mcp-server || exit 1

# Install dependencies
echo "📦 Installing MCP server dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ MCP server dependencies installed successfully!"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Ensure your environment variables are set in .env.local:"
echo "   - VITE_SUPABASE_URL"
echo "   - VITE_SUPABASE_ANON_KEY"
echo ""
echo "2. Restart VS Code to activate the MCP server"
echo ""
echo "3. Test the server by running:"
echo "   cd mcp-server && npm start"
echo ""
echo "4. In GitHub Copilot Chat, try asking:"
echo "   'Show me the latest food listings from the database'"
