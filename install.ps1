# Metabase MCP Server - Installation Script (Windows)

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "🚀 Metabase MCP Server Installation" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Error: Node.js is not installed" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/"
    exit 1
}

$nodeVersion = node --version
Write-Host "✅ Node.js detected: $nodeVersion" -ForegroundColor Green

# Check if npm is installed
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Error: npm is not installed" -ForegroundColor Red
    exit 1
}

$npmVersion = npm --version
Write-Host "✅ npm detected: $npmVersion" -ForegroundColor Green
Write-Host ""

# Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Build the project
Write-Host "🔨 Building the project..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Link globally
Write-Host "🔗 Installing globally..." -ForegroundColor Yellow
npm link
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Global installation failed" -ForegroundColor Red
    Write-Host "Try running PowerShell as Administrator" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# Verify installation
if (Get-Command metabase-server -ErrorAction SilentlyContinue) {
    Write-Host "✅ Installation successful!" -ForegroundColor Green
    Write-Host ""
    Write-Host "=========================================" -ForegroundColor Cyan
    Write-Host "📋 Next Steps" -ForegroundColor Cyan
    Write-Host "=========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. Generate your configuration:"
    Write-Host "   cd $PWD"
    Write-Host "   npm run config:quick -- nodata https://YOUR_METABASE_URL YOUR_API_KEY"
    Write-Host ""
    Write-Host "2. Copy the generated JSON to your Claude Desktop config:"
    $configPath = Join-Path $env:APPDATA "Claude\claude_desktop_config.json"
    Write-Host "   $configPath"
    Write-Host ""
    Write-Host "3. Restart Claude Desktop"
    Write-Host ""
    Write-Host "=========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "For more information, see:"
    Write-Host "  - QUICK_START.md for configuration"
    Write-Host "  - README.md for detailed documentation"
    Write-Host ""
} else {
    Write-Host "❌ Installation failed - metabase-server command not found" -ForegroundColor Red
    exit 1
}
