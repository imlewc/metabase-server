# Configuration Generator Guide

The Metabase MCP Server includes an interactive configuration generator to help you set up Claude Desktop with the right security settings.

## Quick Start

```bash
npm run config
```

## What It Does

The configuration generator guides you through creating a Claude Desktop configuration file with appropriate security settings. It helps you control what data and operations Claude can access in your Metabase instance.

## Configuration Modes

### 1. Full Access
**All tools enabled** - Claude can read and modify everything in your Metabase instance.

- **Use case:** Development environments, personal Metabase instances, or when you trust Claude with full access
- **Disabled tools:** None

### 2. Schema Only
**Can view structure but not execute queries** - Claude can see your database structure, create and modify cards/dashboards, but cannot execute queries that return data.

- **Use case:** When you want Claude to help design dashboards and queries without seeing actual data
- **Disabled tools:**
  - `execute_card` - Cannot run saved questions/cards
  - `execute_query` - Cannot run SQL queries

### 3. No Data Access
**Can only manage structure** - Claude cannot read any data or metadata. It can only create, update, and delete cards, dashboards, and other Metabase objects.

- **Use case:** Production environments where you want to prevent Claude from seeing any sensitive information
- **Disabled tools:**
  - All data access tools: `execute_card`, `execute_query`
  - All read operations: `list_dashboards`, `list_cards`, `list_databases`, `list_collections`, `list_permission_groups`, `list_users`, `get_card`, `get_dashboard`, `get_dashboard_cards`, `get_user`, `get_collection_permissions`

### 4. Custom
**Select specific tools to disable** - An interactive checklist allows you to choose exactly which tools to disable.

- **Use case:** When you need fine-grained control over permissions
- **Interface:** Categorized checklist of all available tools

## Step-by-Step Walkthrough

1. **Choose Access Level**
   - Select from Full Access, Schema Only, No Data Access, or Custom
   - For Custom mode, you'll see a categorized checklist of tools

2. **Enter Metabase URL**
   - Provide your Metabase instance URL (must start with http:// or https://)

3. **Select Authentication Method**
   - API Key (recommended) - More secure, doesn't expire
   - Username/Password - Falls back to session tokens

4. **Enter Credentials**
   - For API Key: Enter your Metabase API key
   - For Username/Password: Enter both credentials

5. **Review Configuration**
   - The tool displays the generated JSON configuration
   - Shows the file path where it should be placed
   - Lists all disabled tools

6. **Save Configuration**
   - Option to save to a local file for reference
   - Copy and paste into Claude Desktop config file

## Example Output

```json
{
  "mcpServers": {
    "metabase-server": {
      "command": "metabase-server",
      "env": {
        "METABASE_URL": "https://your-metabase-instance.com",
        "METABASE_API_KEY": "your_api_key",
        "METABASE_DISABLED_TOOLS": "execute_card,execute_query"
      }
    }
  }
}
```

## Tool Categories

The custom mode organizes tools into these categories:

- **Data Access** - Tools that return raw data from queries
- **Read Operations** - Tools that return metadata and structure information
- **Create Operations** - Tools that create new objects
- **Update Operations** - Tools that modify existing objects
- **Delete Operations** - Tools that remove objects
- **Dashboard Composition** - Tools that add/remove cards from dashboards
- **Permission Management** - Tools that manage user permissions

## Security Recommendations

- **Development:** Use **Full Access** for convenience
- **Staging:** Use **Schema Only** to test without exposing real data
- **Production:** Use **No Data Access** to prevent any data leaks
- **Custom scenarios:** Use **Custom** mode to create specific permission sets

## Updating Configuration

To change your configuration later:

1. Run `npm run config` again
2. Generate a new configuration
3. Replace the old configuration in Claude Desktop config file
4. Restart Claude Desktop

## Troubleshooting

**"This tool requires an interactive terminal"**
- The configuration generator needs an interactive terminal (TTY)
- Cannot be run in non-interactive environments like CI/CD

**Configuration not taking effect**
- Make sure to restart Claude Desktop after updating the config file
- Verify the JSON syntax is correct
- Check that the file path matches your operating system

**Tools still accessible after disabling**
- Restart Claude Desktop to reload the configuration
- Verify the tool names in `METABASE_DISABLED_TOOLS` match exactly (case-sensitive)
