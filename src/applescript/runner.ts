import { execFile } from "child_process";
import { fileURLToPath } from "url";
import path from "path";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// When compiled: dist/applescript/runner.js → scripts are at dist/applescript/scripts/
const SCRIPTS_DIR = path.join(__dirname, "scripts");

export async function runScript<T>(
  scriptName: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  const scriptPath = path.join(SCRIPTS_DIR, `${scriptName}.js`);
  const paramsJson = JSON.stringify(params);

  return new Promise((resolve, reject) => {
    execFile(
      "osascript",
      ["-l", "JavaScript", scriptPath, paramsJson],
      { timeout: 30_000, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          const message = stderr.trim() || error.message;
          reject(
            new McpError(
              ErrorCode.InternalError,
              `[${scriptName}] ${message}`,
            ),
          );
          return;
        }

        const output = stdout.trim();
        if (!output) {
          resolve(undefined as T);
          return;
        }

        try {
          resolve(JSON.parse(output) as T);
        } catch {
          reject(
            new McpError(
              ErrorCode.InternalError,
              `[${scriptName}] Invalid JSON output: ${output.slice(0, 300)}`,
            ),
          );
        }
      },
    );
  });
}
