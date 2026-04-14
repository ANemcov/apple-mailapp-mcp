import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { runScript } from "../applescript/runner.js";

export function registerEmailSendTools(server: McpServer): void {
  server.tool(
    "send_email",
    "Compose and send a new email.",
    {
      to: z.array(z.string().email()).min(1).describe("Recipient email addresses."),
      subject: z.string().describe("Email subject."),
      body: z.string().describe("Email body (plain text)."),
      cc: z.array(z.string().email()).optional().describe("CC recipients."),
      bcc: z.array(z.string().email()).optional().describe("BCC recipients."),
      account: z.string().optional().describe("Send from this account (uses first account if omitted)."),
    },
    async ({ to, subject, body, cc, bcc, account }) => {
      try {
        await runScript("send-email", {
          to,
          subject,
          body,
          cc: cc ?? [],
          bcc: bcc ?? [],
          account: account ?? "",
        });
        return { content: [{ type: "text", text: "Email sent successfully." }] };
      } catch (error) {
        return { content: [{ type: "text", text: String(error) }], isError: true };
      }
    },
  );

  server.tool(
    "reply_email",
    "Reply to an existing email.",
    {
      id: z.string().describe("Composite ID of the email to reply to."),
      body: z.string().describe("Reply text."),
      reply_all: z.boolean().optional().describe("Reply to all recipients (default: false)."),
    },
    async ({ id, body, reply_all }) => {
      try {
        await runScript("reply-email", { id, body, replyAll: reply_all ?? false });
        return { content: [{ type: "text", text: "Reply sent successfully." }] };
      } catch (error) {
        return { content: [{ type: "text", text: String(error) }], isError: true };
      }
    },
  );

  server.tool(
    "forward_email",
    "Forward an email to one or more recipients.",
    {
      id: z.string().describe("Composite ID of the email to forward."),
      to: z.array(z.string().email()).min(1).describe("Forward-to email addresses."),
      body: z.string().optional().describe("Additional text to prepend before the original message."),
    },
    async ({ id, to, body }) => {
      try {
        await runScript("forward-email", { id, to, body: body ?? "" });
        return { content: [{ type: "text", text: "Email forwarded successfully." }] };
      } catch (error) {
        return { content: [{ type: "text", text: String(error) }], isError: true };
      }
    },
  );
}
