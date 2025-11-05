/**
 * Response formatters for Metabase MCP server
 * Converts verbose JSON responses to concise markdown
 */

interface Database {
  id: number;
  name: string;
  engine: string;
  initial_sync_status?: string;
  is_sample?: boolean;
  is_audit?: boolean;
}

interface Dashboard {
  id: number;
  name: string;
  collection_id?: number;
  view_count?: number;
  last_viewed_at?: string;
  created_at?: string;
  updated_at?: string;
  archived?: boolean;
}

interface Card {
  id: number;
  name: string;
  collection_id?: number;
  display?: string;
  query_type?: string;
  updated_at?: string;
  archived?: boolean;
  collection?: { name?: string };
  "last-edit-info"?: { timestamp?: string };
}

interface QueryResult {
  data?: {
    rows: any[][];
    cols: Array<{ name: string; display_name: string; base_type: string }>;
  };
  status?: string;
  row_count?: number;
  running_time?: number;
  database_id?: number;
  error?: string;
  error_type?: string;
}

/**
 * Format databases list as a markdown table
 */
export function formatDatabases(data: { data?: Database[]; total?: number } | Database[]): string {
  const databases = Array.isArray(data) ? data : (data.data || []);
  const total = Array.isArray(data) ? databases.length : (data.total || databases.length);

  if (databases.length === 0) {
    return "No databases found.";
  }

  let output = `# Metabase Databases (${total} total)\n\n`;
  output += "| ID | Name | Engine | Status |\n";
  output += "|---|---|---|---|\n";

  databases.forEach((db: Database) => {
    const status = db.initial_sync_status || 'unknown';
    const flags = [];
    if (db.is_sample) flags.push('sample');
    if (db.is_audit) flags.push('audit');
    const statusStr = flags.length > 0 ? `${status} (${flags.join(', ')})` : status;

    output += `| ${db.id} | ${db.name} | ${db.engine} | ${statusStr} |\n`;
  });

  return output;
}

/**
 * Format dashboards list as a markdown table
 */
export function formatDashboards(dashboards: Dashboard[]): string {
  if (!Array.isArray(dashboards) || dashboards.length === 0) {
    return "No dashboards found.";
  }

  let output = `# Metabase Dashboards (${dashboards.length} total)\n\n`;
  output += "| ID | Name | Collection | Views | Last Viewed | Archived |\n";
  output += "|---|---|---|---|---|---|\n";

  dashboards.forEach((dash: Dashboard) => {
    const collectionId = dash.collection_id || 'root';
    const views = dash.view_count || 0;
    const lastViewed = dash.last_viewed_at
      ? new Date(dash.last_viewed_at).toISOString().split('T')[0]
      : 'never';
    const archived = dash.archived ? '✓' : '';

    output += `| ${dash.id} | ${dash.name} | ${collectionId} | ${views} | ${lastViewed} | ${archived} |\n`;
  });

  return output;
}

/**
 * Format cards/questions list as a markdown table
 */
export function formatCards(cards: Card[]): string {
  if (!Array.isArray(cards) || cards.length === 0) {
    return "No cards found.";
  }

  let output = `# Metabase Cards/Questions (${cards.length} total)\n\n`;
  output += "| ID | Name | Collection | Type | Last Edited | Archived |\n";
  output += "|---|---|---|---|---|---|\n";

  cards.forEach((card: Card) => {
    const collectionId = card.collection_id || 'root';
    const type = card.display || card.query_type || 'unknown';
    const lastEdit = card["last-edit-info"]?.timestamp || card.updated_at;
    const lastEditStr = lastEdit
      ? new Date(lastEdit).toISOString().split('T')[0]
      : 'unknown';
    const archived = card.archived ? '✓' : '';

    output += `| ${card.id} | ${card.name} | ${collectionId} | ${type} | ${lastEditStr} | ${archived} |\n`;
  });

  return output;
}

/**
 * Format query execution results
 */
export function formatQueryResult(result: QueryResult, maxRows: number = 50): string {
  let output = "# Query Execution Result\n\n";

  // Add status information
  output += "## Status\n\n";
  output += `- **Status**: ${result.status || 'unknown'}\n`;
  output += `- **Rows**: ${result.row_count || 0}\n`;
  output += `- **Execution Time**: ${result.running_time || 0}ms\n`;
  output += `- **Database ID**: ${result.database_id || 'unknown'}\n\n`;

  // Handle errors
  if (result.error || result.error_type) {
    output += "## Error\n\n";
    output += `**Type**: ${result.error_type || 'unknown'}\n\n`;
    output += `**Message**: ${result.error || 'No error message'}\n`;
    return output;
  }

  // Handle successful results
  if (!result.data || !result.data.rows || result.data.rows.length === 0) {
    output += "## Data\n\nNo rows returned.\n";
    return output;
  }

  const { rows, cols } = result.data;
  const displayRows = rows.slice(0, maxRows);
  const truncated = rows.length > maxRows;

  output += "## Data\n\n";

  // Create column headers
  const headers = cols.map(col => col.display_name || col.name);
  output += "| " + headers.join(" | ") + " |\n";
  output += "|" + headers.map(() => "---").join("|") + "|\n";

  // Add data rows
  displayRows.forEach((row: any[]) => {
    const formattedRow = row.map(cell => {
      if (cell === null || cell === undefined) return 'null';
      if (typeof cell === 'object') return JSON.stringify(cell);
      return String(cell);
    });
    output += "| " + formattedRow.join(" | ") + " |\n";
  });

  if (truncated) {
    output += `\n*Showing first ${maxRows} of ${rows.length} rows*\n`;
  }

  // Add column types
  output += "\n## Column Types\n\n";
  cols.forEach(col => {
    output += `- **${col.display_name || col.name}**: ${col.base_type}\n`;
  });

  return output;
}

/**
 * Format dashboard cards list
 */
export function formatDashboardCards(cards: any[]): string {
  if (!Array.isArray(cards) || cards.length === 0) {
    return "No cards found in this dashboard.";
  }

  let output = `# Dashboard Cards (${cards.length} total)\n\n`;
  output += "| Card ID | Name | Visualization | Size |\n";
  output += "|---|---|---|---|\n";

  cards.forEach((dashCard: any) => {
    const card = dashCard.card || {};
    const cardId = card.id || 'unknown';
    const cardName = card.name || 'Untitled';
    const vizType = dashCard.visualization_settings?.["card.title"]
      ? 'custom'
      : (card.display || 'table');
    const size = `${dashCard.size_x || 4}×${dashCard.size_y || 4}`;

    output += `| ${cardId} | ${cardName} | ${vizType} | ${size} |\n`;
  });

  return output;
}

/**
 * Format card execution result
 */
export function formatCardResult(result: QueryResult, maxRows: number = 50): string {
  // Card execution results have the same structure as query results
  return formatQueryResult(result, maxRows);
}

/**
 * Format generic object response (fallback for CRUD operations)
 */
export function formatGenericResponse(operation: string, data: any): string {
  let output = `# ${operation} Result\n\n`;

  if (typeof data === 'string') {
    output += data;
  } else if (data && typeof data === 'object') {
    output += "## Summary\n\n";

    // Extract key fields
    if (data.id) output += `- **ID**: ${data.id}\n`;
    if (data.name) output += `- **Name**: ${data.name}\n`;
    if (data.created_at) output += `- **Created**: ${new Date(data.created_at).toISOString()}\n`;
    if (data.updated_at) output += `- **Updated**: ${new Date(data.updated_at).toISOString()}\n`;

    output += "\n*Full JSON response saved to `.mcp-servers/metabase/.last-response.json`*\n";
  } else {
    output += "Operation completed successfully.\n";
  }

  return output;
}
