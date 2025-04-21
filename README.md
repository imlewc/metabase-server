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

Before running the server, you need to set the following environment variables:

```bash
# Required environment variables
export METABASE_URL=https://your-metabase-instance.com
export METABASE_USERNAME=your_username
export METABASE_PASSWORD=your_password
```

You can set these environment variables in your shell profile or use a `.env` file with a package like `dotenv`.

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

## Installation

To use with Claude Desktop, add the server config:

On MacOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
On Windows: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "metabase-server": {
      "command": "/path/to/metabase-server/build/index.js",
      "env": {
        "METABASE_URL": "https://your-metabase-instance.com",
        "METABASE_USERNAME": "your_username",
        "METABASE_PASSWORD": "your_password"
      }
    }
  }
}
```

Note: You can also set these environment variables in your system instead of in the config file if you prefer.

### Installing at Simon

```JSON
    "metabase-server": {
      "command": "npx",
      "args": [
        "-y",
        "@simon/metabase-server"
      ],
      "env": {
        "METABASE_URL": "https://metabase.simondata.com",
        "METABASE_USERNAME": "YOUR_EMAIL",
        "METABASE_PASSWORD": "YOUR_PASSWORD"
      }
    }
```

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
