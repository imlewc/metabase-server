#!/usr/bin/env node

// 为老版本 Node.js 添加 AbortController polyfill
import AbortController from 'abort-controller';
global.AbortController = global.AbortController || AbortController;

/**
 * Metabase MCP 服务器
 * 实现与 Metabase API 的交互，提供以下功能：
 * - 获取仪表板列表
 * - 获取问题列表
 * - 获取数据库列表
 * - 执行问题查询
 * - 获取仪表板详情
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  CallToolRequestSchema,
  ListResourcesResult,
  ReadResourceResult,
  ResourceSchema,
  ToolSchema
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import axios, { AxiosInstance } from "axios";

// 自定义错误枚举
enum ErrorCode {
  InternalError = "internal_error",
  InvalidRequest = "invalid_request",
  InvalidParams = "invalid_params",
  MethodNotFound = "method_not_found"
}

// 自定义错误类
class McpError extends Error {
  code: ErrorCode;
  
  constructor(code: ErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "McpError";
  }
}

// 从环境变量获取 Metabase 配置
const METABASE_URL = process.env.METABASE_URL;
const METABASE_USERNAME = process.env.METABASE_USERNAME;
const METABASE_PASSWORD = process.env.METABASE_PASSWORD;
const METABASE_API_KEY = process.env.METABASE_API_KEY;
const METABASE_DISABLED_TOOLS = process.env.METABASE_DISABLED_TOOLS
  ? process.env.METABASE_DISABLED_TOOLS.split(',').map(t => t.trim())
  : [];

if (!METABASE_URL || (!METABASE_API_KEY && (!METABASE_USERNAME || !METABASE_PASSWORD))) {
  throw new Error(
    "Either (METABASE_URL and METABASE_API_KEY) or (METABASE_URL, METABASE_USERNAME, and METABASE_PASSWORD) environment variables are required"
  );
}

// 创建自定义 Schema 对象，使用 z.object
const ListResourceTemplatesRequestSchema = z.object({
  method: z.literal("resources/list_templates")
});

const ListToolsRequestSchema = z.object({
  method: z.literal("tools/list")
});

class MetabaseServer {
  private server: Server;
  private axiosInstance: AxiosInstance;
  private sessionToken: string | null = null;
  private disabledTools: Set<string>;

  constructor() {
    this.disabledTools = new Set(METABASE_DISABLED_TOOLS);
    this.server = new Server(
      {
        name: "metabase-server",
        version: "0.1.0",
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    this.axiosInstance = axios.create({
      baseURL: METABASE_URL,
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 30000, // 30 second timeout to prevent hanging
    });

    if (METABASE_API_KEY) {
      this.logInfo('Using Metabase API Key for authentication.');
      this.axiosInstance.defaults.headers.common['X-API-Key'] = METABASE_API_KEY;
      this.sessionToken = "api_key_used"; // Indicate API key is in use
    } else if (METABASE_USERNAME && METABASE_PASSWORD) {
      this.logInfo('Using Metabase username/password for authentication.');
      // Existing session token logic will apply
    } else {
      // This case should ideally be caught by the initial environment variable check
      // but as a safeguard:
      this.logError('Metabase authentication credentials not configured properly.', {});
      throw new Error("Metabase authentication credentials not provided or incomplete.");
    }

    this.setupResourceHandlers();
    this.setupToolHandlers();

    // Log disabled tools if any
    if (this.disabledTools.size > 0) {
      this.logInfo('Disabled tools:', { disabledTools: Array.from(this.disabledTools) });
    }

    // Enhanced error handling with logging
    this.server.onerror = (error: Error) => {
      this.logError('Server Error', error);
    };

    process.on('SIGINT', async () => {
      this.logInfo('Shutting down server...');
      await this.server.close();
      process.exit(0);
    });
  }

  /**
   * Check if a tool is disabled
   */
  private isToolDisabled(toolName: string): boolean {
    return this.disabledTools.has(toolName);
  }

  // Add logging utilities
  private logInfo(message: string, data?: unknown) {
    const logMessage = {
      timestamp: new Date().toISOString(),
      level: 'info',
      message,
      data
    };
    console.error(JSON.stringify(logMessage));
    // MCP SDK changed, can't directly access session
    try {
      // Use current session if available
      console.error(`INFO: ${message}`);
    } catch (e) {
      // Ignore if session not available
    }
  }

  private logError(message: string, error: unknown) {
    const errorObj = error as Error;
    const apiError = error as { response?: { data?: { message?: string } }, message?: string };
    
    const logMessage = {
      timestamp: new Date().toISOString(),
      level: 'error',
      message,
      error: errorObj.message || 'Unknown error',
      stack: errorObj.stack
    };
    console.error(JSON.stringify(logMessage));
    // MCP SDK changed, can't directly access session
    try {
      console.error(`ERROR: ${message} - ${errorObj.message || 'Unknown error'}`);
    } catch (e) {
      // Ignore if session not available
    }
  }

  /**
   * 获取 Metabase 会话令牌
   */
  private async getSessionToken(): Promise<string> {
    if (this.sessionToken) { // Handles both API key ("api_key_used") and actual session tokens
      return this.sessionToken;
    }

    // This part should only be reached if using username/password and sessionToken is null
    this.logInfo('Authenticating with Metabase using username/password...');
    try {
      const response = await this.axiosInstance.post('/api/session', {
        username: METABASE_USERNAME,
        password: METABASE_PASSWORD,
      });

      this.sessionToken = response.data.id;
      
      // 设置默认请求头
      this.axiosInstance.defaults.headers.common['X-Metabase-Session'] = this.sessionToken;
      
      this.logInfo('Successfully authenticated with Metabase');
      return this.sessionToken as string;
    } catch (error) {
      this.logError('Authentication failed', error);
      throw new McpError(
        ErrorCode.InternalError,
        'Failed to authenticate with Metabase'
      );
    }
  }

  /**
   * 设置资源处理程序
   */
  private setupResourceHandlers() {
    this.server.setRequestHandler(ListResourcesRequestSchema, async (request) => {
      this.logInfo('Listing resources...', { requestStructure: JSON.stringify(request) });
      if (!METABASE_API_KEY) {
        await this.getSessionToken();
      }

      try {
        // 获取仪表板列表
        const dashboardsResponse = await this.axiosInstance.get('/api/dashboard');
        
        this.logInfo('Successfully listed resources', { count: dashboardsResponse.data.length });
        // 将仪表板作为资源返回
        return {
          resources: dashboardsResponse.data.map((dashboard: any) => ({
            uri: `metabase://dashboard/${dashboard.id}`,
            mimeType: "application/json",
            name: dashboard.name,
            description: `Metabase dashboard: ${dashboard.name}`
          }))
        };
      } catch (error) {
        this.logError('Failed to list resources', error);
        throw new McpError(
          ErrorCode.InternalError,
          'Failed to list Metabase resources'
        );
      }
    });

    // 资源模板
    this.server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
      return {
        resourceTemplates: [
          {
            uriTemplate: 'metabase://dashboard/{id}',
            name: 'Dashboard by ID',
            mimeType: 'application/json',
            description: 'Get a Metabase dashboard by its ID',
          },
          {
            uriTemplate: 'metabase://card/{id}',
            name: 'Card by ID',
            mimeType: 'application/json',
            description: 'Get a Metabase question/card by its ID',
          },
          {
            uriTemplate: 'metabase://database/{id}',
            name: 'Database by ID',
            mimeType: 'application/json',
            description: 'Get a Metabase database by its ID',
          },
        ],
      };
    });

    // 读取资源
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      this.logInfo('Reading resource...', { requestStructure: JSON.stringify(request) });
      if (!METABASE_API_KEY) {
        await this.getSessionToken();
      }

      const uri = request.params?.uri;
      let match;

      try {
        // 处理仪表板资源
        if ((match = uri.match(/^metabase:\/\/dashboard\/(\d+)$/))) {
          const dashboardId = match[1];
          const response = await this.axiosInstance.get(`/api/dashboard/${dashboardId}`);
          
          return {
            contents: [{
              uri: request.params?.uri,
              mimeType: "application/json",
              text: JSON.stringify(response.data, null, 2)
            }]
          };
        }
        
        // 处理问题/卡片资源
        else if ((match = uri.match(/^metabase:\/\/card\/(\d+)$/))) {
          const cardId = match[1];
          const response = await this.axiosInstance.get(`/api/card/${cardId}`);
          
          return {
            contents: [{
              uri: request.params?.uri,
              mimeType: "application/json",
              text: JSON.stringify(response.data, null, 2)
            }]
          };
        }
        
        // 处理数据库资源
        else if ((match = uri.match(/^metabase:\/\/database\/(\d+)$/))) {
          const databaseId = match[1];
          const response = await this.axiosInstance.get(`/api/database/${databaseId}`);
          
          return {
            contents: [{
              uri: request.params?.uri,
              mimeType: "application/json",
              text: JSON.stringify(response.data, null, 2)
            }]
          };
        }
        
        else {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Invalid URI format: ${uri}`
          );
        }
      } catch (error) {
        if (axios.isAxiosError(error)) {
          throw new McpError(
            ErrorCode.InternalError,
            `Metabase API error: ${error.response?.data?.message || error.message}`
          );
        }
        throw error;
      }
    });
  }

  /**
   * 设置工具处理程序
   */
  private setupToolHandlers() {
    // No session token needed for listing tools, as it's static data
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const allTools = [
          {
            name: "list_dashboards",
            description: "List all dashboards in Metabase",
            inputSchema: {
              type: "object",
              properties: {}
            }
          },
          {
            name: "list_cards",
            description: "List all questions/cards in Metabase",
            inputSchema: {
              type: "object",
              properties: {
                f: {
                  type: "string",
                  description: "Optional filter function, possible values: archived, table, database, using_model, bookmarked, using_segment, all, mine"
                }
              }
            }
          },
          {
            name: "list_databases",
            description: "List all databases in Metabase",
            inputSchema: {
              type: "object",
              properties: {}
            }
          },
          {
            name: "get_card",
            description: "Get a single Metabase question/card by ID with full details including dataset_query with template-tags configuration for variables/filters. Use this to inspect a card before updating it.",
            inputSchema: {
              type: "object",
              properties: {
                card_id: {
                  type: "number",
                  description: "ID of the card/question to retrieve"
                }
              },
              required: ["card_id"]
            }
          },
          {
            name: "execute_card",
            description: "Execute a Metabase question/card and get results",
            inputSchema: {
              type: "object",
              properties: {
                card_id: {
                  type: "number",
                  description: "ID of the card/question to execute"
                },
                parameters: {
                  description: "Optional parameters for the query. Metabase expects an array; a single object will be wrapped.",
                  oneOf: [
                    { type: "array", items: { type: "object" } },
                    { type: "object" }
                  ]
                }
              },
              required: ["card_id"]
            }
          },
          {
            name: "get_dashboard_cards",
            description: "Get all cards in a dashboard",
            inputSchema: {
              type: "object",
              properties: {
                dashboard_id: {
                  type: "number",
                  description: "ID of the dashboard"
                }
              },
              required: ["dashboard_id"]
            }
          },
          {
            name: "execute_query",
            description: "Execute a SQL query against a Metabase database",
            inputSchema: {
              type: "object",
              properties: {
                database_id: {
                  type: "number",
                  description: "ID of the database to query"
                },
                query: {
                  type: "string",
                  description: "SQL query to execute"
                },
                native_parameters: {
                  type: "array",
                  description: "Optional parameters for the query",
                  items: {
                    type: "object"
                  }
                }
              },
              required: ["database_id", "query"]
            }
          },
          {
            name: "create_card",
            description: "Create a new Metabase question (card).",
            inputSchema: {
              type: "object",
              properties: {
                name: { type: "string", description: "Name of the card" },
                dataset_query: { type: "object", description: "The query for the card (e.g., MBQL or native query)" },
                display: { type: "string", description: "Display type (e.g., 'table', 'line', 'bar')" },
                visualization_settings: { type: "object", description: "Settings for the visualization" },
                collection_id: { type: "number", description: "Optional ID of the collection to save the card in" },
                description: { type: "string", description: "Optional description for the card" }
              },
              required: ["name", "dataset_query", "display", "visualization_settings"]
            }
          },
          {
            name: "update_card",
            description: "Update an existing Metabase question (card). For native SQL queries with template variables (like dropdown filters), use dataset_query.native.template-tags to configure each variable. Each template-tag can have: name, display-name, type (text/number/dimension), dimension (for field filters), widget-type (category, string/=, number/=, etc.), and default value.",
            inputSchema: {
              type: "object",
              properties: {
                card_id: { type: "number", description: "ID of the card to update" },
                name: { type: "string", description: "New name for the card" },
                dataset_query: {
                  type: "object",
                  description: "Query configuration. For native SQL: {type: 'native', database: <id>, native: {query: 'SELECT...', template-tags: {...}}}. Template-tags example: {'semester': {id: 'uuid', name: 'semester', display-name: 'Semester', type: 'dimension', dimension: ['field', <field_id>, null], widget-type: 'category'}}",
                  properties: {
                    type: { type: "string", description: "'native' for SQL queries, 'query' for MBQL" },
                    database: { type: "number", description: "Database ID" },
                    native: {
                      type: "object",
                      description: "Native SQL query configuration",
                      properties: {
                        query: { type: "string", description: "SQL query with {{variable}} placeholders" },
                        "template-tags": {
                          type: "object",
                          description: "Variable configurations keyed by variable name. Each has: id, name, display-name, type (text/number/dimension), dimension (for field filters as ['field', field_id, null]), widget-type (category/string/=/number/=)"
                        }
                      }
                    }
                  }
                },
                display: { type: "string", description: "New display type" },
                visualization_settings: { type: "object", description: "New visualization settings" },
                collection_id: { type: "number", description: "New collection ID" },
                description: { type: "string", description: "New description" },
                archived: { type: "boolean", description: "Set to true to archive the card" },
                type: { type: "string", description: "Card type: 'question' or 'model'" }
              },
              required: ["card_id"]
            }
          },
          {
            name: "delete_card",
            description: "Delete a Metabase question (card).",
            inputSchema: {
              type: "object",
              properties: {
                card_id: { type: "number", description: "ID of the card to delete" },
                hard_delete: { type: "boolean", description: "Set to true for hard delete, false (default) for archive", default: false }
              },
              required: ["card_id"]
            }
          },
          {
            name: "create_dashboard",
            description: "Create a new Metabase dashboard.",
            inputSchema: {
              type: "object",
              properties: {
                name: { type: "string", description: "Name of the dashboard" },
                description: { type: "string", description: "Optional description for the dashboard" },
                parameters: { type: "array", description: "Optional parameters for the dashboard", items: { type: "object" } },
                collection_id: { type: "number", description: "Optional ID of the collection to save the dashboard in" }
              },
              required: ["name"]
            }
          },
          {
            name: "update_dashboard",
            description: "Update an existing Metabase dashboard.",
            inputSchema: {
              type: "object",
              properties: {
                dashboard_id: { type: "number", description: "ID of the dashboard to update" },
                name: { type: "string", description: "New name for the dashboard" },
                description: { type: "string", description: "New description for the dashboard" },
                parameters: { type: "array", description: "New parameters for the dashboard", items: { type: "object" } },
                collection_id: { type: "number", description: "New collection ID" },
                archived: { type: "boolean", description: "Set to true to archive the dashboard" }
              },
              required: ["dashboard_id"]
            }
          },
          {
            name: "delete_dashboard",
            description: "Delete a Metabase dashboard.",
            inputSchema: {
              type: "object",
              properties: {
                dashboard_id: { type: "number", description: "ID of the dashboard to delete" },
                hard_delete: { type: "boolean", description: "Set to true for hard delete, false (default) for archive", default: false }
              },
              required: ["dashboard_id"]
            }
          },
          {
            name: "add_card_to_dashboard",
            description: "Add a card/question to a dashboard.",
            inputSchema: {
              type: "object",
              properties: {
                dashboard_id: { type: "number", description: "ID of the dashboard" },
                card_id: { type: "number", description: "ID of the card to add" },
                size_x: { type: "number", description: "Width of the card (default: 4)", default: 4 },
                size_y: { type: "number", description: "Height of the card (default: 3)", default: 3 },
                row: { type: "number", description: "Row position (default: 0)", default: 0 },
                col: { type: "number", description: "Column position (default: 0)", default: 0 }
              },
              required: ["dashboard_id", "card_id"]
            }
          },
          {
            name: "list_collections",
            description: "List all collections in Metabase.",
            inputSchema: {
              type: "object",
              properties: {
                namespace: { type: "string", description: "Optional namespace filter" }
              }
            }
          },
          {
            name: "create_collection",
            description: "Create a new collection in Metabase.",
            inputSchema: {
              type: "object",
              properties: {
                name: { type: "string", description: "Name of the collection" },
                description: { type: "string", description: "Optional description" },
                color: { type: "string", description: "Optional color (hex code like #509EE3)" },
                parent_id: { type: "number", description: "Optional parent collection ID for nesting" }
              },
              required: ["name"]
            }
          },
          {
            name: "update_collection",
            description: "Update a collection in Metabase.",
            inputSchema: {
              type: "object",
              properties: {
                collection_id: { type: "number", description: "ID of the collection to update" },
                name: { type: "string", description: "New name for the collection" },
                description: { type: "string", description: "New description" },
                color: { type: "string", description: "New color (hex code)" },
                archived: { type: "boolean", description: "Set to true to archive" }
              },
              required: ["collection_id"]
            }
          },
          {
            name: "list_permission_groups",
            description: "List all permission groups in Metabase.",
            inputSchema: {
              type: "object",
              properties: {}
            }
          },
          {
            name: "create_permission_group",
            description: "Create a new permission group in Metabase.",
            inputSchema: {
              type: "object",
              properties: {
                name: { type: "string", description: "Name of the permission group" }
              },
              required: ["name"]
            }
          },
          {
            name: "delete_permission_group",
            description: "Delete a permission group in Metabase.",
            inputSchema: {
              type: "object",
              properties: {
                group_id: { type: "number", description: "ID of the group to delete" }
              },
              required: ["group_id"]
            }
          },
          {
            name: "get_collection_permissions",
            description: "Get the collection permissions graph showing which groups have access to which collections.",
            inputSchema: {
              type: "object",
              properties: {}
            }
          },
          {
            name: "update_collection_permissions",
            description: "Update collection permissions for a group. Sets the permission level for a group on a collection.",
            inputSchema: {
              type: "object",
              properties: {
                group_id: { type: "number", description: "ID of the permission group" },
                collection_id: { type: "number", description: "ID of the collection (use 'root' for root collection)" },
                permission: { type: "string", description: "Permission level: 'read', 'write', or 'none'" }
              },
              required: ["group_id", "collection_id", "permission"]
            }
          },
          {
            name: "add_user_to_group",
            description: "Add a user to a permission group.",
            inputSchema: {
              type: "object",
              properties: {
                group_id: { type: "number", description: "ID of the permission group" },
                user_id: { type: "number", description: "ID of the user to add" }
              },
              required: ["group_id", "user_id"]
            }
          },
          {
            name: "list_users",
            description: "List all users in Metabase.",
            inputSchema: {
              type: "object",
              properties: {}
            }
          },
          {
            name: "create_user",
            description: "Create a new user in Metabase.",
            inputSchema: {
              type: "object",
              properties: {
                first_name: { type: "string", description: "User's first name" },
                last_name: { type: "string", description: "User's last name" },
                email: { type: "string", description: "User's email address (used as login)" },
                password: { type: "string", description: "User's password (optional - if not provided, user will need to reset)" },
                group_ids: { type: "array", items: { type: "number" }, description: "Optional array of permission group IDs to add the user to" }
              },
              required: ["first_name", "last_name", "email"]
            }
          },
          {
            name: "update_user",
            description: "Update an existing user in Metabase.",
            inputSchema: {
              type: "object",
              properties: {
                user_id: { type: "number", description: "ID of the user to update" },
                first_name: { type: "string", description: "New first name" },
                last_name: { type: "string", description: "New last name" },
                email: { type: "string", description: "New email address" },
                is_superuser: { type: "boolean", description: "Whether the user should be an admin" },
                login_attributes: { type: "object", description: "Custom login attributes for the user" }
              },
              required: ["user_id"]
            }
          },
          {
            name: "disable_user",
            description: "Disable (deactivate) a user in Metabase. This prevents them from logging in but preserves their data.",
            inputSchema: {
              type: "object",
              properties: {
                user_id: { type: "number", description: "ID of the user to disable" }
              },
              required: ["user_id"]
            }
          },
          {
            name: "remove_user_from_group",
            description: "Remove a user from a permission group.",
            inputSchema: {
              type: "object",
              properties: {
                membership_id: { type: "number", description: "ID of the membership to remove (get this from the user's group_ids or list_permission_groups)" }
              },
              required: ["membership_id"]
            }
          },
          {
            name: "get_user",
            description: "Get details about a specific user including their group memberships.",
            inputSchema: {
              type: "object",
              properties: {
                user_id: { type: "number", description: "ID of the user to retrieve" }
              },
              required: ["user_id"]
            }
          },
          {
            name: "get_dashboard",
            description: "Get full dashboard details including cards and parameters.",
            inputSchema: {
              type: "object",
              properties: {
                dashboard_id: { type: "number", description: "ID of the dashboard" }
              },
              required: ["dashboard_id"]
            }
          },
          {
            name: "update_dashboard_cards",
            description: "Update dashboard cards including their parameter mappings. Use this to connect dashboard filters to card variables.",
            inputSchema: {
              type: "object",
              properties: {
                dashboard_id: { type: "number", description: "ID of the dashboard" },
                cards: {
                  type: "array",
                  description: "Array of card configurations with parameter_mappings",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "number", description: "Dashcard ID (not card_id)" },
                      card_id: { type: "number", description: "Card/Question ID" },
                      row: { type: "number", description: "Row position" },
                      col: { type: "number", description: "Column position" },
                      size_x: { type: "number", description: "Width" },
                      size_y: { type: "number", description: "Height" },
                      parameter_mappings: {
                        type: "array",
                        description: "Parameter mappings connecting dashboard filters to card variables",
                        items: {
                          type: "object",
                          properties: {
                            parameter_id: { type: "string", description: "Dashboard parameter ID" },
                            card_id: { type: "number", description: "Card ID" },
                            target: { type: "array", description: "Target specification, e.g. ['variable', ['template-tag', 'semester']]" }
                          }
                        }
                      }
                    }
                  }
                }
              },
              required: ["dashboard_id", "cards"]
            }
          },
          {
            name: "remove_card_from_dashboard",
            description: "Remove a card from a dashboard.",
            inputSchema: {
              type: "object",
              properties: {
                dashboard_id: { type: "number", description: "ID of the dashboard" },
                dashcard_id: { type: "number", description: "ID of the dashcard (not the card_id)" }
              },
              required: ["dashboard_id", "dashcard_id"]
            }
          },
          {
            name: "add_dashboard_filter",
            description: "Add or update a filter parameter on a dashboard.",
            inputSchema: {
              type: "object",
              properties: {
                dashboard_id: { type: "number", description: "ID of the dashboard" },
                parameters: {
                  type: "array",
                  description: "Array of dashboard parameters/filters",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string", description: "Unique parameter ID" },
                      name: { type: "string", description: "Display name for the filter" },
                      slug: { type: "string", description: "URL slug for the parameter" },
                      type: { type: "string", description: "Parameter type, e.g. 'number/=', 'string/=', 'category'" },
                      values_source_type: { type: "string", description: "Source for dropdown values: 'static-list', 'card', or null" },
                      values_source_config: {
                        type: "object",
                        description: "Configuration for value source. For 'card': {card_id, value_field, label_field}. For 'static-list': {values: [[value, label], ...]}"
                      }
                    }
                  }
                }
              },
              required: ["dashboard_id", "parameters"]
            }
          }
        ];

      // Filter out disabled tools
      const enabledTools = allTools.filter(tool => !this.isToolDisabled(tool.name));

      return {
        tools: enabledTools
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      this.logInfo('Calling tool...', { requestStructure: JSON.stringify(request) });

      // Check if tool is disabled
      const toolName = request.params?.name;
      if (toolName && this.isToolDisabled(toolName)) {
        this.logInfo('Attempted to call disabled tool', { toolName });
        return {
          content: [{
            type: "text",
            text: `Tool "${toolName}" is disabled. This tool has been disabled via METABASE_DISABLED_TOOLS configuration.`
          }],
          isError: true
        };
      }

      if (!METABASE_API_KEY) {
        await this.getSessionToken();
      }

      try {
        switch (request.params?.name) {
          case "list_dashboards": {
            const response = await this.axiosInstance.get('/api/dashboard');
            return {
              content: [{
                type: "text",
                text: JSON.stringify(response.data, null, 2)
              }]
            };
          }

          case "list_cards": {
            const f = request.params?.arguments?.f || "all";
            const response = await this.axiosInstance.get(`/api/card?f=${f}`);
            return {
              content: [{
                type: "text",
                text: JSON.stringify(response.data, null, 2)
              }]
            };
          }

          case "list_databases": {
            const response = await this.axiosInstance.get('/api/database');
            return {
              content: [{
                type: "text",
                text: JSON.stringify(response.data, null, 2)
              }]
            };
          }

          case "get_card": {
            const cardId = request.params?.arguments?.card_id;
            if (!cardId) {
              throw new McpError(
                ErrorCode.InvalidParams,
                "Card ID is required"
              );
            }
            const response = await this.axiosInstance.get(`/api/card/${cardId}`);
            return {
              content: [{
                type: "text",
                text: JSON.stringify(response.data, null, 2)
              }]
            };
          }

          case "execute_card": {
            const cardId = request.params?.arguments?.card_id;
            if (!cardId) {
              throw new McpError(
                ErrorCode.InvalidParams,
                "Card ID is required"
              );
            }

            const rawParameters = request.params?.arguments?.parameters;
            const parameters = Array.isArray(rawParameters)
              ? rawParameters
              : rawParameters && typeof rawParameters === "object" && Object.keys(rawParameters).length === 0
                ? []
                : rawParameters
                  ? [rawParameters]
                  : [];
            const response = await this.axiosInstance.post(`/api/card/${cardId}/query`, { parameters });
            
            return {
              content: [{
                type: "text",
                text: JSON.stringify(response.data, null, 2)
              }]
            };
          }

          case "get_dashboard_cards": {
            const dashboardId = request.params?.arguments?.dashboard_id;
            if (!dashboardId) {
              throw new McpError(
                ErrorCode.InvalidParams,
                "Dashboard ID is required"
              );
            }

            const response = await this.axiosInstance.get(`/api/dashboard/${dashboardId}`);
            const dashcards =
              response.data?.ordered_cards ??
              response.data?.dashcards ??
              response.data?.cards ??
              [];

            return {
              content: [{
                type: "text",
                text: JSON.stringify(dashcards, null, 2)
              }]
            };
          }
          
          case "execute_query": {
            const databaseId = request.params?.arguments?.database_id;
            const query = request.params?.arguments?.query;
            const nativeParameters = request.params?.arguments?.native_parameters || [];
            
            if (!databaseId) {
              throw new McpError(
                ErrorCode.InvalidParams,
                "Database ID is required"
              );
            }
            
            if (!query) {
              throw new McpError(
                ErrorCode.InvalidParams,
                "SQL query is required"
              );
            }
            
            // 构建查询请求体
            const queryData = {
              type: "native",
              native: {
                query: query,
                template_tags: {}
              },
              parameters: nativeParameters,
              database: databaseId
            };
            
            const response = await this.axiosInstance.post('/api/dataset', queryData);
            
            return {
              content: [{
                type: "text",
                text: JSON.stringify(response.data, null, 2)
              }]
            };
          }

          case "create_card": {
            const { name, dataset_query, display, visualization_settings, collection_id, description } = request.params?.arguments || {};
            if (!name || !dataset_query || !display || !visualization_settings) {
              throw new McpError(
                ErrorCode.InvalidParams,
                "Missing required fields for create_card: name, dataset_query, display, visualization_settings"
              );
            }
            const createCardBody: any = {
              name,
              dataset_query,
              display,
              visualization_settings,
            };
            if (collection_id !== undefined) createCardBody.collection_id = collection_id;
            if (description !== undefined) createCardBody.description = description;

            const response = await this.axiosInstance.post('/api/card', createCardBody);
            return {
              content: [{
                type: "text",
                text: JSON.stringify(response.data, null, 2)
              }]
            };
          }

          case "update_card": {
            const { card_id, ...updateFields } = request.params?.arguments || {};
            if (!card_id) {
              throw new McpError(
                ErrorCode.InvalidParams,
                "Card ID is required for update_card"
              );
            }
            if (Object.keys(updateFields).length === 0) {
              throw new McpError(
                ErrorCode.InvalidParams,
                "No fields provided for update_card"
              );
            }
            const response = await this.axiosInstance.put(`/api/card/${card_id}`, updateFields);
            return {
              content: [{
                type: "text",
                text: JSON.stringify(response.data, null, 2)
              }]
            };
          }

          case "delete_card": {
            const { card_id, hard_delete = false } = request.params?.arguments || {};
            if (!card_id) {
              throw new McpError(
                ErrorCode.InvalidParams,
                "Card ID is required for delete_card"
              );
            }

            if (hard_delete) {
              await this.axiosInstance.delete(`/api/card/${card_id}`);
              return {
                content: [{
                  type: "text",
                  text: `Card ${card_id} permanently deleted.`
                }]
              };
            } else {
              // Soft delete (archive)
              const response = await this.axiosInstance.put(`/api/card/${card_id}`, { archived: true });
              return {
                content: [{
                  type: "text",
                  // Metabase might return the updated card object or just a success status.
                  // If response.data is available and meaningful, include it. Otherwise, a generic success message.
                  text: response.data ? `Card ${card_id} archived. Details: ${JSON.stringify(response.data, null, 2)}` : `Card ${card_id} archived.`
                }]
              };
            }
          }

          case "create_dashboard": {
            const { name, description, parameters, collection_id } = request.params?.arguments || {};
            if (!name) {
              throw new McpError(
                ErrorCode.InvalidParams,
                "Missing required field for create_dashboard: name"
              );
            }
            const createDashboardBody: any = { name };
            if (description !== undefined) createDashboardBody.description = description;
            if (parameters !== undefined) createDashboardBody.parameters = parameters;
            if (collection_id !== undefined) createDashboardBody.collection_id = collection_id;

            const response = await this.axiosInstance.post('/api/dashboard', createDashboardBody);
            return {
              content: [{
                type: "text",
                text: JSON.stringify(response.data, null, 2)
              }]
            };
          }

          case "update_dashboard": {
            const { dashboard_id, ...updateFields } = request.params?.arguments || {};
            if (!dashboard_id) {
              throw new McpError(
                ErrorCode.InvalidParams,
                "Dashboard ID is required for update_dashboard"
              );
            }
            if (Object.keys(updateFields).length === 0) {
              throw new McpError(
                ErrorCode.InvalidParams,
                "No fields provided for update_dashboard"
              );
            }
            const response = await this.axiosInstance.put(`/api/dashboard/${dashboard_id}`, updateFields);
            return {
              content: [{
                type: "text",
                text: JSON.stringify(response.data, null, 2)
              }]
            };
          }

          case "delete_dashboard": {
            const { dashboard_id, hard_delete = false } = request.params?.arguments || {};
            if (!dashboard_id) {
              throw new McpError(
                ErrorCode.InvalidParams,
                "Dashboard ID is required for delete_dashboard"
              );
            }

            if (hard_delete) {
              await this.axiosInstance.delete(`/api/dashboard/${dashboard_id}`);
              return {
                content: [{
                  type: "text",
                  text: `Dashboard ${dashboard_id} permanently deleted.`
                }]
              };
            } else {
              // Soft delete (archive)
              const response = await this.axiosInstance.put(`/api/dashboard/${dashboard_id}`, { archived: true });
               return {
                content: [{
                  type: "text",
                  text: response.data ? `Dashboard ${dashboard_id} archived. Details: ${JSON.stringify(response.data, null, 2)}` : `Dashboard ${dashboard_id} archived.`
                }]
              };
            }
          }

          case "add_card_to_dashboard": {
            const { dashboard_id, card_id, size_x = 4, size_y = 3, row = 0, col = 0 } = request.params?.arguments || {};
            if (!dashboard_id || !card_id) {
              throw new McpError(
                ErrorCode.InvalidParams,
                "Both dashboard_id and card_id are required"
              );
            }
            // Since Metabase 0.47+, POST /dashboard/:id/cards was removed.
            // Must use PUT /dashboard/:id with dashcards array. Negative ID = new card.
            // First get existing dashboard to preserve existing cards
            const dashboardResponse = await this.axiosInstance.get(`/api/dashboard/${dashboard_id}`);
            const existingDashcards = dashboardResponse.data.dashcards || [];

            // Add new card with negative ID (signals creation)
            const newDashcard = {
              id: -1,
              card_id: card_id,
              size_x,
              size_y,
              row,
              col,
              parameter_mappings: []
            };

            const response = await this.axiosInstance.put(`/api/dashboard/${dashboard_id}`, {
              dashcards: [...existingDashcards, newDashcard]
            });
            return {
              content: [{
                type: "text",
                text: JSON.stringify(response.data, null, 2)
              }]
            };
          }

          case "list_collections": {
            const namespace = request.params?.arguments?.namespace;
            const url = namespace ? `/api/collection?namespace=${namespace}` : '/api/collection';
            const response = await this.axiosInstance.get(url);
            return {
              content: [{
                type: "text",
                text: JSON.stringify(response.data, null, 2)
              }]
            };
          }

          case "create_collection": {
            const { name, description, color, parent_id } = request.params?.arguments || {};
            if (!name) {
              throw new McpError(
                ErrorCode.InvalidParams,
                "Collection name is required"
              );
            }
            const collectionData: any = { name };
            if (description) collectionData.description = description;
            if (color) collectionData.color = color;
            if (parent_id) collectionData.parent_id = parent_id;

            const response = await this.axiosInstance.post('/api/collection', collectionData);
            return {
              content: [{
                type: "text",
                text: JSON.stringify(response.data, null, 2)
              }]
            };
          }

          case "update_collection": {
            const { collection_id, ...updateFields } = request.params?.arguments || {};
            if (!collection_id) {
              throw new McpError(
                ErrorCode.InvalidParams,
                "Collection ID is required"
              );
            }
            const response = await this.axiosInstance.put(`/api/collection/${collection_id}`, updateFields);
            return {
              content: [{
                type: "text",
                text: JSON.stringify(response.data, null, 2)
              }]
            };
          }

          case "list_permission_groups": {
            this.logInfo('Fetching permission groups...');
            const response = await this.axiosInstance.get('/api/permissions/group');
            this.logInfo('Permission groups response', { status: response.status, data: response.data });
            return {
              content: [{
                type: "text",
                text: JSON.stringify(response.data || [], null, 2)
              }]
            };
          }

          case "create_permission_group": {
            const { name } = request.params?.arguments || {};
            if (!name) {
              throw new McpError(
                ErrorCode.InvalidParams,
                "Group name is required"
              );
            }
            const response = await this.axiosInstance.post('/api/permissions/group', { name });
            return {
              content: [{
                type: "text",
                text: JSON.stringify(response.data, null, 2)
              }]
            };
          }

          case "delete_permission_group": {
            const { group_id } = request.params?.arguments || {};
            if (!group_id) {
              throw new McpError(
                ErrorCode.InvalidParams,
                "Group ID is required"
              );
            }
            await this.axiosInstance.delete(`/api/permissions/group/${group_id}`);
            return {
              content: [{
                type: "text",
                text: `Permission group ${group_id} deleted successfully.`
              }]
            };
          }

          case "get_collection_permissions": {
            const response = await this.axiosInstance.get('/api/collection/graph');
            return {
              content: [{
                type: "text",
                text: JSON.stringify(response.data, null, 2)
              }]
            };
          }

          case "update_collection_permissions": {
            const { group_id, collection_id, permission } = request.params?.arguments || {};
            if (!group_id || collection_id === undefined || !permission) {
              throw new McpError(
                ErrorCode.InvalidParams,
                "group_id, collection_id, and permission are all required"
              );
            }
            // First get current graph
            const graphResponse = await this.axiosInstance.get('/api/collection/graph');
            const graph = graphResponse.data as { groups: Record<string, Record<string, string>>, revision: number };

            // Update the specific permission
            const collKey = collection_id === 0 ? 'root' : String(collection_id);
            const groupKey = String(group_id);
            if (!graph.groups[groupKey]) {
              graph.groups[groupKey] = {};
            }
            graph.groups[groupKey][collKey] = permission as string;

            // PUT the updated graph
            const response = await this.axiosInstance.put('/api/collection/graph', graph);
            return {
              content: [{
                type: "text",
                text: JSON.stringify(response.data, null, 2)
              }]
            };
          }

          case "add_user_to_group": {
            const { group_id, user_id } = request.params?.arguments || {};
            if (!group_id || !user_id) {
              throw new McpError(
                ErrorCode.InvalidParams,
                "Both group_id and user_id are required"
              );
            }
            const response = await this.axiosInstance.post('/api/permissions/membership', {
              group_id,
              user_id
            });
            return {
              content: [{
                type: "text",
                text: JSON.stringify(response.data, null, 2)
              }]
            };
          }

          case "list_users": {
            const response = await this.axiosInstance.get('/api/user');
            return {
              content: [{
                type: "text",
                text: JSON.stringify(response.data, null, 2)
              }]
            };
          }

          case "create_user": {
            const { first_name, last_name, email, password, group_ids } = request.params?.arguments || {};
            if (!first_name || !last_name || !email) {
              throw new McpError(
                ErrorCode.InvalidParams,
                "first_name, last_name, and email are required"
              );
            }
            const userData: any = { first_name, last_name, email };
            if (password) userData.password = password;
            if (group_ids) userData.group_ids = group_ids;

            const response = await this.axiosInstance.post('/api/user', userData);
            return {
              content: [{
                type: "text",
                text: JSON.stringify(response.data, null, 2)
              }]
            };
          }

          case "update_user": {
            const { user_id, ...updateFields } = request.params?.arguments || {};
            if (!user_id) {
              throw new McpError(
                ErrorCode.InvalidParams,
                "user_id is required"
              );
            }
            if (Object.keys(updateFields).length === 0) {
              throw new McpError(
                ErrorCode.InvalidParams,
                "No fields provided for update"
              );
            }
            const response = await this.axiosInstance.put(`/api/user/${user_id}`, updateFields);
            return {
              content: [{
                type: "text",
                text: JSON.stringify(response.data, null, 2)
              }]
            };
          }

          case "disable_user": {
            const { user_id } = request.params?.arguments || {};
            if (!user_id) {
              throw new McpError(
                ErrorCode.InvalidParams,
                "user_id is required"
              );
            }
            // Metabase uses DELETE on /api/user/:id to deactivate (not permanently delete)
            await this.axiosInstance.delete(`/api/user/${user_id}`);
            return {
              content: [{
                type: "text",
                text: `User ${user_id} has been disabled/deactivated.`
              }]
            };
          }

          case "remove_user_from_group": {
            const { membership_id } = request.params?.arguments || {};
            if (!membership_id) {
              throw new McpError(
                ErrorCode.InvalidParams,
                "membership_id is required"
              );
            }
            await this.axiosInstance.delete(`/api/permissions/membership/${membership_id}`);
            return {
              content: [{
                type: "text",
                text: `Membership ${membership_id} removed successfully.`
              }]
            };
          }

          case "get_user": {
            const { user_id } = request.params?.arguments || {};
            if (!user_id) {
              throw new McpError(
                ErrorCode.InvalidParams,
                "user_id is required"
              );
            }
            const response = await this.axiosInstance.get(`/api/user/${user_id}`);
            return {
              content: [{
                type: "text",
                text: JSON.stringify(response.data, null, 2)
              }]
            };
          }

          case "get_dashboard": {
            const { dashboard_id } = request.params?.arguments || {};
            if (!dashboard_id) {
              throw new McpError(
                ErrorCode.InvalidParams,
                "Dashboard ID is required"
              );
            }
            const response = await this.axiosInstance.get(`/api/dashboard/${dashboard_id}`);
            return {
              content: [{
                type: "text",
                text: JSON.stringify(response.data, null, 2)
              }]
            };
          }

          case "update_dashboard_cards": {
            const { dashboard_id, cards } = request.params?.arguments || {};
            if (!dashboard_id) {
              throw new McpError(
                ErrorCode.InvalidParams,
                "Dashboard ID is required"
              );
            }
            if (!cards || !Array.isArray(cards)) {
              throw new McpError(
                ErrorCode.InvalidParams,
                "Cards array is required"
              );
            }
            const response = await this.axiosInstance.put(`/api/dashboard/${dashboard_id}`, {
              dashcards: cards
            });
            return {
              content: [{
                type: "text",
                text: JSON.stringify(response.data, null, 2)
              }]
            };
          }

          case "remove_card_from_dashboard": {
            const { dashboard_id, dashcard_id } = request.params?.arguments || {};
            if (!dashboard_id || !dashcard_id) {
              throw new McpError(
                ErrorCode.InvalidParams,
                "Both dashboard_id and dashcard_id are required"
              );
            }
            // Since Metabase 0.47+, DELETE endpoint was removed.
            // Must use PUT with dashcards array, omitting the card to delete.
            const dashboardResponse = await this.axiosInstance.get(`/api/dashboard/${dashboard_id}`);
            const existingDashcards = dashboardResponse.data.dashcards || [];
            const filteredDashcards = existingDashcards.filter((dc: any) => dc.id !== dashcard_id);

            if (filteredDashcards.length === existingDashcards.length) {
              return {
                content: [{
                  type: "text",
                  text: `Dashcard ${dashcard_id} not found on dashboard ${dashboard_id}`
                }],
                isError: true
              };
            }

            await this.axiosInstance.put(`/api/dashboard/${dashboard_id}`, {
              dashcards: filteredDashcards
            });
            return {
              content: [{
                type: "text",
                text: `Dashcard ${dashcard_id} removed from dashboard ${dashboard_id}`
              }]
            };
          }

          case "add_dashboard_filter": {
            const { dashboard_id, parameters } = request.params?.arguments || {};
            if (!dashboard_id) {
              throw new McpError(
                ErrorCode.InvalidParams,
                "Dashboard ID is required"
              );
            }
            if (!parameters || !Array.isArray(parameters)) {
              throw new McpError(
                ErrorCode.InvalidParams,
                "Parameters array is required"
              );
            }
            const response = await this.axiosInstance.put(`/api/dashboard/${dashboard_id}`, {
              parameters
            });
            return {
              content: [{
                type: "text",
                text: JSON.stringify(response.data, null, 2)
              }]
            };
          }

          default:
            return {
              content: [
                {
                  type: "text",
                  text: `Unknown tool: ${request.params?.name}`
                }
              ],
              isError: true
            };
        }
      } catch (error) {
        if (axios.isAxiosError(error)) {
          return {
            content: [{
              type: "text",
              text: `Metabase API error: ${error.response?.data?.message || error.message}`
            }],
            isError: true
          };
        }
        throw error;
      }
    });
  }

  async run() {
    try {
      this.logInfo('Starting Metabase MCP server...');
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      this.logInfo('Metabase MCP server running on stdio');
    } catch (error) {
      this.logError('Failed to start server', error);
      throw error;
    }
  }
}

// Add global error handlers
process.on('uncaughtException', (error: Error) => {
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'fatal',
    message: 'Uncaught Exception',
    error: error.message,
    stack: error.stack
  }));
  process.exit(1);
});

process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  const errorMessage = reason instanceof Error ? reason.message : String(reason);
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'fatal',
    message: 'Unhandled Rejection',
    error: errorMessage
  }));
});

const server = new MetabaseServer();
server.run().catch(console.error);
