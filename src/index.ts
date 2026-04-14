import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

const server = createServer();
const transport = new StdioServerTransport();

// Graceful shutdown — MCP clients (Claude Desktop, Claude Code) send SIGTERM on exit
process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));

// Prevent crashes from unhandled async errors — log and keep the process alive
process.on("unhandledRejection", (reason) => {
  process.stderr.write(`[apple-mail] Unhandled rejection: ${reason}\n`);
});

await server.connect(transport);
