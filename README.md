[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/imlewc-metabase-server-badge.png)](https://mseep.ai/app/imlewc-metabase-server)

# metabase-server MCP Server

[![smithery badge](https://smithery.ai/badge/@imlewc/metabase-server)](https://smithery.ai/server/@imlewc/metabase-server)

A Model Context Protocol server for Metabase integration.

This is a TypeScript-based MCP server that implements integration with Metabase API. It allows AI assistants to interact with Metabase, providing access to:

- Dashboards, questions/cards, and databases as resources
- Tools for listing and executing Metabase queries
- Ability to view and interact with Metabase data

## Features

### Resources
- List and access Metabase resources via `metabase://` URIs
- Access dashboards, cards/questions, and databases
- JSON content type for structured data access

### Tools
- `list_dashboards` - List all dashboards in Metabase
- `list_cards` - List all questions/cards in Metabase
- `list_databases` - List all databases in Metabase
- `execute_card` - Execute a Metabase question/card and get results
- `get_dashboard_cards` - Get all cards in a dashboard
- `execute_query` - Execute a SQL query against a Metabase database

## Configuration

Before running the server, you need to set environment variables for authentication. The server supports two methods:

1.  **API Key (Preferred):**
    *   `METABASE_URL`: The URL of your Metabase instance (e.g., `https://your-metabase-instance.com`).
    *   `METABASE_API_KEY`: Your Metabase API key.

2.  **Username/Password (Fallback):**
    *   `METABASE_URL`: The URL of your Metabase instance.
    *   `METABASE_USERNAME`: Your Metabase username.
    *   `METABASE_PASSWORD`: Your Metabase password.

The server will first check for `METABASE_API_KEY`. If it's set, API key authentication will be used. If `METABASE_API_KEY` is not set, the server will fall back to using `METABASE_USERNAME` and `METABASE_PASSWORD`. You must provide credentials for at least one of these methods.

**Example setup:**

Using API Key:
```bash
# Required environment variables
export METABASE_URL=https://your-metabase-instance.com
export METABASE_API_KEY=your_metabase_api_key
```

Or, using Username/Password:
```bash
# Required environment variables
export METABASE_URL=https://your-metabase-instance.com
export METABASE_USERNAME=your_username
export METABASE_PASSWORD=your_password
```
You can set these environment variables in your shell profile or use a `.env` file with a package like `dotenv`.

### Configuration Generator

**⚡ Quick Method (Recommended - No interaction issues):**

```bash
npm run config:quick -- <mode> <metabase_url> <api_key>
```

Modes: `full`, `schema`, `nodata`

Example for no data access:
```bash
npm run config:quick -- nodata https://metabase.example.com your_api_key
```

See [QUICK_START.md](./QUICK_START.md) for detailed instructions.

**🎨 Interactive Methods (may have terminal compatibility issues):**

Standard version (fancy UI):
```bash
npm run config
```

Simple version (basic prompts):
```bash
npm run config:simple
```

The interactive wizards guide you through:

1. **Access Level Selection:**
   - **Full Access**: All tools enabled
   - **Schema Only**: Can view structure but not execute data queries (disables `execute_card`, `execute_query`)
   - **No Data Access**: Can only manage structure, no access to any data or metadata (disables all read/query operations)
   - **Custom**: Select specific tools to disable with an interactive checklist

2. **Authentication Setup**: Choose between API Key (recommended) or Username/Password

3. **Configuration Generation**: The tool will generate the JSON configuration and show you where to place it

The generator will output a ready-to-use configuration file that you can copy into your Claude Desktop config.

### Disabling Tools

You can disable specific tools to restrict what operations the MCP server can perform. This is useful for security or privacy reasons, such as preventing data access while still allowing schema inspection and card creation.

To disable tools, set the `METABASE_DISABLED_TOOLS` environment variable with a comma-separated list of tool names:

```bash
export METABASE_DISABLED_TOOLS=execute_card,execute_query
```

**Common use cases:**

- Disable `execute_card` and `execute_query` to prevent data access while allowing metadata operations
- Disable `delete_card`, `delete_dashboard` to prevent deletion operations
- Disable `create_user`, `update_user`, `disable_user` to prevent user management

**Available tools that can be disabled:**
- Data access: `execute_card`, `execute_query`, `get_dashboard_cards`
- Card operations: `create_card`, `update_card`, `delete_card`, `get_card`
- Dashboard operations: `create_dashboard`, `update_dashboard`, `delete_dashboard`, `get_dashboard`, `add_card_to_dashboard`, `remove_card_from_dashboard`, `update_dashboard_cards`, `add_dashboard_filter`
- Collection operations: `create_collection`, `update_collection`
- Permission operations: `create_permission_group`, `delete_permission_group`, `update_collection_permissions`, `add_user_to_group`, `remove_user_from_group`
- User operations: `create_user`, `update_user`, `disable_user`
- List operations: `list_dashboards`, `list_cards`, `list_databases`, `list_collections`, `list_permission_groups`, `list_users`, `get_user`, `get_collection_permissions`

When a disabled tool is called, the server will return an error message indicating that the tool is disabled.

## Installation

### Quick Installation (Recommended)

**macOS/Linux:**
```bash
git clone https://github.com/imlewc/metabase-server.git
cd metabase-server
./install.sh
```

**Windows (PowerShell as Administrator):**
```powershell
git clone https://github.com/imlewc/metabase-server.git
cd metabase-server
.\install.ps1
```

The installation script will:
1. ✅ Check Node.js and npm are installed
2. ✅ Install dependencies
3. ✅ Build the project
4. ✅ Install globally (makes `metabase-server` command available)
5. ✅ Show next steps for configuration

### Manual Installation

```bash
git clone https://github.com/imlewc/metabase-server.git
cd metabase-server
npm install
npm run build
npm link
```

## Development

Install dependencies:
```bash
npm install
```

Build the server:
```bash
npm run build
```

For development with auto-rebuild:
```bash
npm run watch
```

To use with Claude Desktop, add the server config:

On MacOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
On Windows: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "metabase-server": {
      "command": "metabase-server",
      "env": {
        "METABASE_URL": "https://your-metabase-instance.com",
        // Use API Key (preferred)
        "METABASE_API_KEY": "your_metabase_api_key",
        // Or Username/Password (if API Key is not set)
        // "METABASE_USERNAME": "your_username",
        // "METABASE_PASSWORD": "your_password"
        // Optional: Disable specific tools (comma-separated)
        "METABASE_DISABLED_TOOLS": "execute_card,execute_query"
      }
    }
  }
}
```

Note: You can also set these environment variables in your system instead of in the config file if you prefer.

### Installing via Smithery

To install metabase-server for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@imlewc/metabase-server):

```bash
npx -y @smithery/cli install @imlewc/metabase-server --client claude
```

### Debugging

Since MCP servers communicate over stdio, debugging can be challenging. We recommend using the [MCP Inspector](https://github.com/modelcontextprotocol/inspector), which is available as a package script:

```bash
npm run inspector
```

The Inspector will provide a URL to access debugging tools in your browser.

## Testing

After configuring the environment variables as described in the "Configuration" section, you can manually test the server's authentication. The MCP Inspector (`npm run inspector`) is a useful tool for sending requests to the server.

### 1. Testing with API Key Authentication

1.  Set the `METABASE_URL` and `METABASE_API_KEY` environment variables with your Metabase instance URL and a valid API key.
2.  Ensure `METABASE_USERNAME` and `METABASE_PASSWORD` are unset or leave them, as the API key should take precedence.
3.  Start the server: `npm run build && node build/index.js` (or use your chosen method for running the server, like via Claude Desktop config).
4.  Check the server logs. You should see a message indicating that it's using API key authentication (e.g., "Using Metabase API Key for authentication.").
5.  Using an MCP client or the MCP Inspector, try calling a tool, for example, `tools/call` with `{"name": "list_dashboards"}`.
6.  Verify that the tool call is successful and you receive the expected data.

### 2. Testing with Username/Password Authentication (Fallback)

1.  Ensure the `METABASE_API_KEY` environment variable is unset.
2.  Set `METABASE_URL`, `METABASE_USERNAME`, and `METABASE_PASSWORD` with valid credentials for your Metabase instance.
3.  Start the server.
4.  Check the server logs. You should see a message indicating that it's using username/password authentication (e.g., "Using Metabase username/password for authentication." followed by "Authenticating with Metabase using username/password...").
5.  Using an MCP client or the MCP Inspector, try calling the `list_dashboards` tool.
6.  Verify that the tool call is successful.

### 3. Testing Authentication Failures

*   **Invalid API Key:**
    1.  Set `METABASE_URL` and an invalid `METABASE_API_KEY`. Ensure `METABASE_USERNAME` and `METABASE_PASSWORD` variables are unset.
    2.  Start the server.
    3.  Attempt to call a tool (e.g., `list_dashboards`). The tool call should fail, and the server logs might indicate an authentication error from Metabase (e.g., "Metabase API error: Invalid X-API-Key").
*   **Invalid Username/Password:**
    1.  Ensure `METABASE_API_KEY` is unset. Set `METABASE_URL` and invalid `METABASE_USERNAME`/`METABASE_PASSWORD`.
    2.  Start the server.
    3.  Attempt to call a tool. The tool call should fail due to failed session authentication. The server logs might show "Authentication failed" or "Failed to authenticate with Metabase".
*   **Missing Credentials:**
    1.  Unset `METABASE_API_KEY`, `METABASE_USERNAME`, and `METABASE_PASSWORD`. Set only `METABASE_URL`.
    2.  Attempt to start the server.
    3.  The server should fail to start and log an error message stating that authentication credentials (either API key or username/password) are required (e.g., "Either (METABASE_URL and METABASE_API_KEY) or (METABASE_URL, METABASE_USERNAME, and METABASE_PASSWORD) environment variables are required").
