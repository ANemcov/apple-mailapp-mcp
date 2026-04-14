import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerEmailReadTools } from "./tools/email-read.js";
import { registerEmailSendTools } from "./tools/email-send.js";
import { registerMailboxTools } from "./tools/mailbox.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "apple-mailapp-mcp",
    version: "1.0.0",
  });

  registerEmailReadTools(server);
  registerEmailSendTools(server);
  registerMailboxTools(server);

  return server;
}
