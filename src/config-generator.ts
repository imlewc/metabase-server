#!/usr/bin/env node

import inquirer from 'inquirer';
import chalk from 'chalk';
import { platform } from 'os';
import { homedir } from 'os';
import { join } from 'path';

// Define all available tools categorized
const TOOL_CATEGORIES = {
  'Data Access (returns raw data)': [
    'execute_card',
    'execute_query',
  ],
  'Read Operations (metadata only)': [
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
  'Create Operations': [
    'create_card',
    'create_dashboard',
    'create_collection',
    'create_permission_group',
    'create_user',
  ],
  'Update Operations': [
    'update_card',
    'update_dashboard',
    'update_collection',
    'update_user',
    'update_collection_permissions',
    'update_dashboard_cards',
    'add_dashboard_filter',
  ],
  'Delete Operations': [
    'delete_card',
    'delete_dashboard',
    'delete_permission_group',
    'disable_user',
  ],
  'Dashboard Composition': [
    'add_card_to_dashboard',
    'remove_card_from_dashboard',
  ],
  'Permission Management': [
    'add_user_to_group',
    'remove_user_from_group',
  ],
};

// Flatten all tools
const ALL_TOOLS = Object.values(TOOL_CATEGORIES).flat();

// Preset configurations
const PRESETS = {
  full: {
    name: 'Full Access',
    description: 'All tools enabled - Claude can read and modify everything',
    disabled: [],
  },
  schemaOnly: {
    name: 'Schema Access Only',
    description: 'Can view structure but not execute queries that return data',
    disabled: ['execute_card', 'execute_query'],
  },
  noData: {
    name: 'No Data Access',
    description: 'Can only manage structure - no access to any data or metadata',
    disabled: [
      // Data access
      'execute_card',
      'execute_query',
      // All read operations that return metadata/data
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

async function promptForConfig(): Promise<Config> {
  console.log(chalk.bold.cyan('\n🔧 Metabase MCP Server Configuration Generator\n'));

  // Step 1: Access level
  const { accessLevel } = await inquirer.prompt([
    {
      type: 'list',
      name: 'accessLevel',
      message: 'Choose an access level preset:',
      choices: [
        {
          name: `${chalk.green('Full Access')} - ${chalk.gray('All tools enabled')}`,
          value: 'full',
        },
        {
          name: `${chalk.yellow('Schema Only')} - ${chalk.gray('No data queries (execute_card, execute_query disabled)')}`,
          value: 'schemaOnly',
        },
        {
          name: `${chalk.red('No Data Access')} - ${chalk.gray('Only structure management (all read/query operations disabled)')}`,
          value: 'noData',
        },
        {
          name: `${chalk.blue('Custom')} - ${chalk.gray('Choose specific tools to disable')}`,
          value: 'custom',
        },
      ],
    },
  ]);

  let disabledTools: string[] = [];

  if (accessLevel === 'custom') {
    // Show categorized tools for selection
    console.log(chalk.bold('\nSelect tools to DISABLE (press space to toggle, enter when done):\n'));

    const toolChoices = [];
    for (const [category, tools] of Object.entries(TOOL_CATEGORIES)) {
      toolChoices.push(new inquirer.Separator(chalk.bold.cyan(`\n${category}`)));
      tools.forEach(tool => {
        toolChoices.push({
          name: `  ${tool}`,
          value: tool,
        });
      });
    }

    const { selectedDisabled } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedDisabled',
        message: 'Tools to disable:',
        choices: toolChoices,
        pageSize: 20,
      },
    ]);

    disabledTools = selectedDisabled;
  } else {
    disabledTools = PRESETS[accessLevel as keyof typeof PRESETS].disabled;
  }

  // Step 2: Metabase URL
  const { metabaseUrl } = await inquirer.prompt([
    {
      type: 'input',
      name: 'metabaseUrl',
      message: 'Metabase instance URL:',
      default: 'https://your-metabase-instance.com',
      validate: (input: string) => {
        if (!input.startsWith('http://') && !input.startsWith('https://')) {
          return 'URL must start with http:// or https://';
        }
        return true;
      },
    },
  ]);

  // Step 3: Authentication method
  const { authMethod } = await inquirer.prompt([
    {
      type: 'list',
      name: 'authMethod',
      message: 'Authentication method:',
      choices: [
        {
          name: `${chalk.green('API Key')} - ${chalk.gray('(Recommended)')}`,
          value: 'apikey',
        },
        {
          name: 'Username/Password',
          value: 'password',
        },
      ],
    },
  ]);

  let apiKey: string | undefined;
  let username: string | undefined;
  let password: string | undefined;

  if (authMethod === 'apikey') {
    const { key } = await inquirer.prompt([
      {
        type: 'password',
        name: 'key',
        message: 'Metabase API Key:',
        mask: '*',
      },
    ]);
    apiKey = key;
  } else {
    const credentials = await inquirer.prompt([
      {
        type: 'input',
        name: 'username',
        message: 'Metabase username:',
      },
      {
        type: 'password',
        name: 'password',
        message: 'Metabase password:',
        mask: '*',
      },
    ]);
    username = credentials.username;
    password = credentials.password;
  }

  return {
    metabaseUrl,
    authMethod,
    apiKey,
    username,
    password,
    disabledTools,
  };
}

async function main() {
  try {
    const config = await promptForConfig();

    console.log(chalk.bold.cyan('\n📋 Generated Configuration:\n'));

    const jsonConfig = generateConfig(config);
    console.log(chalk.gray(jsonConfig));

    console.log(chalk.bold.cyan('\n📍 Configuration File Location:\n'));
    console.log(chalk.yellow(getConfigPath()));

    console.log(chalk.bold.cyan('\n🔧 Setup Instructions:\n'));
    console.log('1. Copy the configuration above');
    console.log('2. Open (or create) the configuration file at the path shown above');
    console.log('3. Paste the configuration into the file');
    console.log('4. If you already have other MCP servers, merge the "metabase-server" entry');
    console.log('   into your existing "mcpServers" object');
    console.log('5. Save the file');
    console.log('6. Restart Claude Desktop');

    if (config.disabledTools.length > 0) {
      console.log(chalk.bold.yellow('\n⚠️  Disabled Tools:\n'));
      config.disabledTools.forEach(tool => {
        console.log(chalk.gray(`  - ${tool}`));
      });
    } else {
      console.log(chalk.bold.green('\n✅ All tools enabled (full access)\n'));
    }

    const { saveToFile } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'saveToFile',
        message: 'Would you like to save this configuration to a file?',
        default: false,
      },
    ]);

    if (saveToFile) {
      const { writeFile } = await import('fs/promises');
      const { filename } = await inquirer.prompt([
        {
          type: 'input',
          name: 'filename',
          message: 'Filename to save:',
          default: 'claude_desktop_config.json',
        },
      ]);

      await writeFile(filename, jsonConfig, 'utf-8');
      console.log(chalk.green(`\n✅ Configuration saved to ${filename}\n`));
    } else {
      console.log(chalk.bold.cyan('\n📋 Copy this configuration:\n'));
      console.log(chalk.bold.cyan('========================================\n'));
      console.log(chalk.gray(jsonConfig));
      console.log(chalk.bold.cyan('\n========================================\n'));
    }

    console.log(chalk.bold.cyan('\n✨ Configuration complete!\n'));
  } catch (error) {
    if ((error as any).isTtyError) {
      console.error(chalk.red('\nError: This tool requires an interactive terminal.\n'));
    } else {
      console.error(chalk.red('\nAn error occurred:'), error);
    }
    process.exit(1);
  }
}

main();
