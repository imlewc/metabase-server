/**
 * Response logger for Metabase MCP server
 * Saves full JSON responses for inspection and debugging
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RESPONSE_LOG_PATH = path.join(__dirname, '..', '.last-response.json');

interface LoggedResponse {
  timestamp: string;
  tool: string;
  request: any;
  response: any;
}

/**
 * Log full response to .last-response.json
 * This allows inspection of the complete JSON data while returning concise markdown
 */
export async function logResponse(
  toolName: string,
  requestParams: any,
  responseData: any
): Promise<void> {
  try {
    const logEntry: LoggedResponse = {
      timestamp: new Date().toISOString(),
      tool: toolName,
      request: requestParams || {},
      response: responseData
    };

    const jsonData = JSON.stringify(logEntry, null, 2);

    // Write asynchronously but don't await to avoid blocking the response
    fs.writeFile(RESPONSE_LOG_PATH, jsonData, 'utf8', (err) => {
      if (err) {
        console.error('Failed to write response log:', err);
      }
    });
  } catch (error) {
    // Log error but don't throw - response logging should never block the main operation
    console.error('Error in logResponse:', error);
  }
}
