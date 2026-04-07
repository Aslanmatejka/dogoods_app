@echo off
echo Setting up Supabase MCP Server...

REM Check if Node.js is installed
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Error: Node.js is not installed. Please install Node.js 18+ first.
    exit /b 1
)

echo Node.js version:
node -v

REM Check for environment variables
if "%VITE_SUPABASE_URL%"=="" (
    if "%SUPABASE_URL%"=="" (
        echo Warning: VITE_SUPABASE_URL not set. MCP server will need this to run.
        echo Set it in your .env.local file or shell environment.
    )
)

if "%VITE_SUPABASE_ANON_KEY%"=="" (
    if "%SUPABASE_ANON_KEY%"=="" (
        echo Warning: VITE_SUPABASE_ANON_KEY not set. MCP server will need this to run.
        echo Set it in your .env.local file or shell environment.
    )
)

REM Navigate to mcp-server directory
cd mcp-server
if %ERRORLEVEL% NEQ 0 (
    echo Error: mcp-server directory not found
    exit /b 1
)

REM Install dependencies
echo Installing MCP server dependencies...
call npm install

if %ERRORLEVEL% EQU 0 (
    echo MCP server dependencies installed successfully!
) else (
    echo Failed to install dependencies
    exit /b 1
)

echo.
echo Setup complete!
echo.
echo Next steps:
echo 1. Ensure your environment variables are set in .env.local:
echo    - VITE_SUPABASE_URL
echo    - VITE_SUPABASE_ANON_KEY
echo.
echo 2. Restart VS Code to activate the MCP server
echo.
echo 3. Test the server by running:
echo    cd mcp-server ^&^& npm start
echo.
echo 4. In GitHub Copilot Chat, try asking:
echo    'Show me the latest food listings from the database'

cd ..
