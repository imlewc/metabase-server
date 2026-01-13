# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Model Context Protocol (MCP) server that provides AI assistants with integration to Metabase. It's built with TypeScript and uses the `@modelcontextprotocol/sdk` to expose Metabase resources and tools.

## Build and Development Commands

**Build:**
```bash
npm run build
```
This compiles TypeScript to `build/`, sets executable permissions on `build/index.js`, and copies to `dist/`.

**Watch mode (auto-rebuild on changes):**
```bash
npm run watch
```

**Testing with MCP Inspector:**
```bash
npm run inspector
```
This is the primary way to test the MCP server. It provides a web UI to interact with the server's resources and tools.

**Run server directly:**
```bash
node build/index.js
```

**Generate Claude Desktop configuration:**
```bash
npm run config
```
This launches an interactive wizard to generate the Claude Desktop configuration with security presets.

## Authentication Configuration

The server supports two authentication methods:

1. **API Key (Preferred):**
   - `METABASE_URL`: Metabase instance URL
   - `METABASE_API_KEY`: API key for authentication

2. **Username/Password (Fallback):**
   - `METABASE_URL`: Metabase instance URL
   - `METABASE_USERNAME`: Username
   - `METABASE_PASSWORD`: Password

Authentication logic priority: API key is checked first. If not set, falls back to username/password. Session tokens are managed automatically for username/password auth.

## Disabled Tools Configuration

**Environment Variable:** `METABASE_DISABLED_TOOLS`

The server supports disabling specific tools via a comma-separated list in the `METABASE_DISABLED_TOOLS` environment variable. This is useful for security or privacy scenarios where you want to restrict certain operations.

**Implementation details:**
- Parsed at startup and stored in `this.disabledTools` as a `Set<string>`
- Tools are filtered in `ListToolsRequestSchema` handler before being returned to clients
- Additional validation in `CallToolRequestSchema` handler blocks execution of disabled tools
- Attempting to call a disabled tool returns an error with `isError: true`

**Common use case:**
Disable `execute_card` and `execute_query` to prevent data access while allowing schema inspection and card/dashboard management:
```bash
METABASE_DISABLED_TOOLS=execute_card,execute_query
```

### Configuration Generator (src/config-generator.ts)

An interactive CLI tool built with `inquirer` and `chalk` that helps users generate Claude Desktop configurations.

**Key features:**
- **Preset modes:**
  - Full Access: No tools disabled
  - Schema Only: Disables `execute_card`, `execute_query`
  - No Data Access: Disables all read/query operations (all `list_*`, `get_*`, `execute_*` tools)
  - Custom: Interactive checkbox to select specific tools to disable

- **Tool categorization:** Tools are organized by category (Data Access, Read Operations, Create Operations, etc.) for easier selection in custom mode

- **Cross-platform:** Automatically detects OS and shows the correct Claude Desktop config path:
  - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
  - Windows: `%APPDATA%/Claude/claude_desktop_config.json`
  - Linux: `~/.config/Claude/claude_desktop_config.json`

- **Output:** Generates a properly formatted JSON configuration that can be directly copied into Claude Desktop config

## Architecture

### Core Components

**MetabaseServer class** (src/index.ts): The main server implementation containing:
- `axiosInstance`: HTTP client configured with base URL and headers
- `sessionToken`: Stores session token for username/password auth (or "api_key_used" for API key auth)
- `server`: MCP Server instance from the SDK

### Authentication Flow

1. On initialization, if `METABASE_API_KEY` is set, it's added as an `X-API-Key` header to all requests
2. If using username/password, `getSessionToken()` authenticates and stores the session token
3. Session tokens are lazily fetched (only when needed for the first API call)
4. All subsequent requests use the stored authentication

### MCP Server Architecture

The server implements three main handler types:

1. **Resource Handlers:**
   - `ListResourcesRequestSchema`: Returns list of dashboards as resources
   - `ListResourceTemplatesRequestSchema`: Provides URI templates for dashboards, cards, and databases
   - `ReadResourceRequestSchema`: Fetches specific resources by URI (e.g., `metabase://dashboard/123`)

2. **Tool Handlers:**
   - `ListToolsRequestSchema`: Returns available tools and their schemas
   - `CallToolRequestSchema`: Executes tool operations (the main switch statement handling all tools)

3. **Tool Categories:**
   - **Query tools:** `list_dashboards`, `list_cards`, `list_databases`, `execute_card`, `execute_query`, `get_card`
   - **CRUD tools:** `create_card`, `update_card`, `delete_card`, `create_dashboard`, `update_dashboard`, `delete_dashboard`
   - **Dashboard composition:** `add_card_to_dashboard`, `remove_card_from_dashboard`, `update_dashboard_cards`, `add_dashboard_filter`
   - **Collections:** `list_collections`, `create_collection`, `update_collection`
   - **Permissions:** `list_permission_groups`, `create_permission_group`, `delete_permission_group`, `get_collection_permissions`, `update_collection_permissions`, `add_user_to_group`, `remove_user_from_group`
   - **User management:** `list_users`, `create_user`, `update_user`, `disable_user`, `get_user`

### Metabase API Version Compatibility

The code handles Metabase API changes (specifically post-0.47):
- `add_card_to_dashboard` and `remove_card_from_dashboard` use PUT with dashcards array instead of deprecated POST/DELETE endpoints
- New dashcards use negative IDs (e.g., `-1`) to signal creation

### Parameter Handling

Special handling for `execute_card` parameters:
- Raw parameters can be an array, object, or empty
- Single objects are wrapped in an array
- Empty objects are converted to empty array
- This matches Metabase API expectations

### Template Tags for SQL Queries

The `update_card` tool supports detailed template-tags configuration for native SQL queries with variables/filters:
- Each template-tag has: `id`, `name`, `display-name`, `type`, `dimension`, `widget-type`
- Used for dropdown filters, field filters, and query parameters
- Example: `{'semester': {id: 'uuid', name: 'semester', display-name: 'Semester', type: 'dimension', dimension: ['field', field_id, null], widget-type: 'category'}}`

### Dashboard Parameter Mappings

Dashboard filters connect to card variables through `parameter_mappings`:
- Each mapping has: `parameter_id` (dashboard filter), `card_id`, and `target` array
- Target format: `['variable', ['template-tag', 'variable_name']]`
- Managed through `update_dashboard_cards` and `add_dashboard_filter` tools

## Error Handling

Custom error types:
- `McpError`: Custom error class with error codes
- `ErrorCode` enum: `InternalError`, `InvalidRequest`, `InvalidParams`, `MethodNotFound`

Logging:
- Structured JSON logs to stderr
- `logInfo()` and `logError()` methods for consistent logging
- Includes timestamp, level, message, and contextual data

## Key Implementation Details

**Axios timeout:** Set to 30 seconds to prevent hanging requests

**Dashboard cards structure:**
- Metabase returns cards in `ordered_cards`, `dashcards`, or `cards` depending on version
- Code handles all three with fallback logic

**Soft vs Hard Delete:**
- Default is soft delete (archive) by setting `archived: true`
- Hard delete available via `hard_delete: true` flag

**Permission Updates:**
- Collection permissions require fetching the full graph, modifying it, and PUTting back
- Uses revision numbers for optimistic locking

## Common Patterns

When adding new tools:
1. Add tool definition to the array in `ListToolsRequestSchema` handler
2. Add case to switch statement in `CallToolRequestSchema` handler
3. Validate required parameters and throw `McpError` if missing
4. Use `this.axiosInstance` for API calls
5. Return content array with text response

When working with Metabase API:
- All API responses are returned as JSON strings via `JSON.stringify(data, null, 2)`
- Error responses check for `axios.isAxiosError` and extract `response.data.message`
- Session token is automatically included in headers for username/password auth
