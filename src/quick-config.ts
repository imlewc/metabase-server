#!/usr/bin/env node

import { writeFile } from 'fs/promises';
import { platform } from 'os';
import { homedir } from 'os';
import { join } from 'path';

const args = process.argv.slice(2);

function getConfigPath(): string {
  const os = platform();
  if (os === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  } else if (os === 'win32') {
    return join(process.env.APPDATA || '', 'Claude', 'claude_desktop_config.json');
  } else {
    return join(homedir(), '.config', 'Claude', 'claude_desktop_config.json');
  }
}

function generateConfig(mode: string, url: string, apiKey: string): string {
  const env: Record<string, string> = {
    METABASE_URL: url,
    METABASE_API_KEY: apiKey,
  };

  // Determine disabled tools based on mode
  if (mode === 'schema') {
    env.METABASE_DISABLED_TOOLS = 'execute_card,execute_query';
  } else if (mode === 'nodata') {
    env.METABASE_DISABLED_TOOLS =
      'execute_card,execute_query,' +
      'list_dashboards,list_cards,list_databases,' +
      'list_collections,list_permission_groups,list_users,' +
      'get_card,get_dashboard,get_dashboard_cards,' +
      'get_user,get_collection_permissions';
  }

  const config = {
    mcpServers: {
      'metabase-server': {
        command: 'metabase-server',
        env,
      },
    },
  };

  return JSON.stringify(config, null, 2);
}

function showHelp() {
  console.log(`
Metabase MCP Server - Quick Config Generator

Usage:
  npm run config:quick -- <mode> <metabase_url> <api_key>

Modes:
  full      - Full access (all tools enabled)
  schema    - Schema only (disables: execute_card, execute_query)
  nodata    - No data access (disables all read/query operations)

Example:
  npm run config:quick -- schema https://metabase.example.com mb_abc123xyz

Output:
  The configuration will be displayed on screen for you to copy.

Config file location:
  ${getConfigPath()}
`);
}

async function main() {
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    showHelp();
    process.exit(0);
  }

  if (args.length !== 3) {
    console.error('Error: Exactly 3 arguments required: <mode> <metabase_url> <api_key>');
    console.error('Run with --help for usage information');
    process.exit(1);
  }

  const [mode, url, apiKey] = args;

  if (!['full', 'schema', 'nodata'].includes(mode)) {
    console.error('Error: Mode must be one of: full, schema, nodata');
    process.exit(1);
  }

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    console.error('Error: URL must start with http:// or https://');
    process.exit(1);
  }

  const config = generateConfig(mode, url, apiKey);

  console.log('\n========================================');
  console.log('📋 Generated Configuration');
  console.log('========================================\n');
  console.log(config);
  console.log('\n========================================');
  console.log('📍 Config File Location');
  console.log('========================================');
  console.log(getConfigPath());
  console.log('\n========================================');
  console.log('🔧 Setup Instructions');
  console.log('========================================');
  console.log('1. Copy the configuration above');
  console.log('2. Paste it into your Claude Desktop config file');
  console.log('3. If you have other MCP servers, merge the "metabase-server" entry');
  console.log('4. Save and restart Claude Desktop');
  console.log('========================================\n');

  // Show what's disabled
  if (mode === 'schema') {
    console.log('⚠️  Mode: Schema Only');
    console.log('Disabled: execute_card, execute_query\n');
  } else if (mode === 'nodata') {
    console.log('⚠️  Mode: No Data Access');
    console.log('Disabled: All read and query operations\n');
  } else {
    console.log('✅ Mode: Full Access (no restrictions)\n');
  }

  // Offer to save
  const { default: inquirer } = await import('inquirer');
  const { save } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'save',
      message: 'Save to file?',
      default: false,
    },
  ]);

  if (save) {
    const { filename } = await inquirer.prompt([
      {
        type: 'input',
        name: 'filename',
        message: 'Filename:',
        default: 'metabase-mcp-config.json',
      },
    ]);
    await writeFile(filename, config, 'utf-8');
    console.log(`\n✅ Saved to ${filename}\n`);
  }
}

main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
