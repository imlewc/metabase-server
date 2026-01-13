#!/usr/bin/env node

import * as readline from 'readline';
import { platform } from 'os';
import { homedir } from 'os';
import { join } from 'path';
import { writeFile } from 'fs/promises';

// Define all available tools categorized
const PRESETS = {
  '1': {
    name: 'Full Access',
    description: 'All tools enabled - Claude can read and modify everything',
    disabled: [],
  },
  '2': {
    name: 'Schema Only',
    description: 'Can view structure but not execute queries that return data',
    disabled: ['execute_card', 'execute_query'],
  },
  '3': {
    name: 'No Data Access',
    description: 'Can only manage structure - no access to any data or metadata',
    disabled: [
      'execute_card',
      'execute_query',
      'list_dashboards',
      'list_cards',
      'list_databases',
      'list_collections',
      'list_permission_groups',
      'list_users',
      'get_card',
      'get_dashboard',
      'get_dashboard_cards',
      'get_user',
      'get_collection_permissions',
    ],
  },
};

interface Config {
  metabaseUrl: string;
  authMethod: 'apikey' | 'password';
  apiKey?: string;
  username?: string;
  password?: string;
  disabledTools: string[];
}

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

function generateConfig(config: Config): string {
  const env: Record<string, string> = {
    METABASE_URL: config.metabaseUrl,
  };

  if (config.authMethod === 'apikey' && config.apiKey) {
    env.METABASE_API_KEY = config.apiKey;
  } else if (config.authMethod === 'password' && config.username && config.password) {
    env.METABASE_USERNAME = config.username;
    env.METABASE_PASSWORD = config.password;
  }

  if (config.disabledTools.length > 0) {
    env.METABASE_DISABLED_TOOLS = config.disabledTools.join(',');
  }

  const mcpConfig = {
    mcpServers: {
      'metabase-server': {
        command: 'metabase-server',
        env,
      },
    },
  };

  return JSON.stringify(mcpConfig, null, 2);
}

function question(rl: readline.Interface, query: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(query, (answer: string) => {
      resolve(answer.trim());
    });
  });
}

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('\n========================================');
  console.log('🔧 Metabase MCP Server Configuration Generator');
  console.log('========================================\n');

  // Step 1: Access level
  console.log('Choose an access level preset:\n');
  console.log('1. Full Access - All tools enabled');
  console.log('2. Schema Only - No data queries (execute_card, execute_query disabled)');
  console.log('3. No Data Access - Only structure management (all read/query operations disabled)');
  console.log();

  const accessChoice = await question(rl, 'Enter choice (1-3): ');
  const preset = PRESETS[accessChoice as keyof typeof PRESETS];

  if (!preset) {
    console.log('Invalid choice. Please run again and choose 1, 2, or 3.');
    rl.close();
    process.exit(1);
  }

  console.log(`\n✓ Selected: ${preset.name}`);
  console.log(`  ${preset.description}\n`);

  // Step 2: Metabase URL
  const metabaseUrl = await question(rl, 'Metabase instance URL (e.g., https://your-metabase-instance.com): ');

  if (!metabaseUrl.startsWith('http://') && !metabaseUrl.startsWith('https://')) {
    console.log('\nError: URL must start with http:// or https://');
    rl.close();
    process.exit(1);
  }

  // Step 3: Authentication method
  console.log('\nAuthentication method:');
  console.log('1. API Key (Recommended)');
  console.log('2. Username/Password');
  const authChoice = await question(rl, 'Enter choice (1-2): ');

  let apiKey: string | undefined;
  let username: string | undefined;
  let password: string | undefined;

  if (authChoice === '1') {
    apiKey = await question(rl, '\nMetabase API Key: ');
  } else if (authChoice === '2') {
    username = await question(rl, '\nMetabase username: ');
    password = await question(rl, 'Metabase password: ');
  } else {
    console.log('Invalid choice. Please run again and choose 1 or 2.');
    rl.close();
    process.exit(1);
  }

  const config: Config = {
    metabaseUrl,
    authMethod: authChoice === '1' ? 'apikey' : 'password',
    apiKey,
    username,
    password,
    disabledTools: preset.disabled,
  };

  const jsonConfig = generateConfig(config);

  console.log('\n========================================');
  console.log('📋 Generated Configuration:');
  console.log('========================================\n');
  console.log(jsonConfig);

  console.log('\n========================================');
  console.log('📍 Configuration File Location:');
  console.log('========================================\n');
  console.log(getConfigPath());

  console.log('\n========================================');
  console.log('🔧 Setup Instructions:');
  console.log('========================================\n');
  console.log('1. Copy the configuration above');
  console.log('2. Open (or create) the configuration file at the path shown above');
  console.log('3. Paste the configuration into the file');
  console.log('4. If you already have other MCP servers, merge the "metabase-server" entry');
  console.log('   into your existing "mcpServers" object');
  console.log('5. Save the file');
  console.log('6. Restart Claude Desktop');

  if (config.disabledTools.length > 0) {
    console.log('\n⚠️  Disabled Tools:');
    config.disabledTools.forEach(tool => {
      console.log(`  - ${tool}`);
    });
  } else {
    console.log('\n✅ All tools enabled (full access)');
  }

  const saveChoice = await question(rl, '\nSave configuration to a file? (y/n): ');

  if (saveChoice.toLowerCase() === 'y' || saveChoice.toLowerCase() === 'yes') {
    const filename = await question(rl, 'Filename (default: metabase-mcp-config.json): ') || 'metabase-mcp-config.json';
    await writeFile(filename, jsonConfig, 'utf-8');
    console.log(`\n✅ Configuration saved to ${filename}\n`);
  } else {
    console.log('\n========================================');
    console.log('📋 Copy this configuration:');
    console.log('========================================\n');
    console.log(jsonConfig);
    console.log('\n========================================\n');
  }

  console.log('\n✨ Configuration complete!\n');
  rl.close();
}

main().catch(error => {
  console.error('\nAn error occurred:', error);
  process.exit(1);
});
