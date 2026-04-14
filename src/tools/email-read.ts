import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { runScript } from "../applescript/runner.js";
import type { EmailSummary, EmailDetail } from "../types.js";

export function registerEmailReadTools(server: McpServer): void {
  server.tool(
    "list_emails",
    "List emails from a mailbox. Returns subject, sender, date, read status, and composite ID for each message.",
    {
      account: z.string().optional().describe("Account name as shown in Mail.app. Lists all accounts if omitted."),
      mailbox: z.string().optional().describe("Mailbox/folder name (default: INBOX)."),
      limit: z.number().int().min(1).max(200).optional().describe("Max number of emails to return (default: 20)."),
      unread_only: z.boolean().optional().describe("Return only unread emails (default: false)."),
    },
    async ({ account, mailbox, limit, unread_only }) => {
      try {
        const emails = await runScript<EmailSummary[]>("list-emails", {
          account: account ?? "",
          mailbox: mailbox ?? "INBOX",
          limit: limit ?? 20,
          unreadOnly: unread_only ?? false,
        });
        return { content: [{ type: "text", text: JSON.stringify(emails, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: String(error) }], isError: true };
      }
    },
  );

  server.tool(
    "get_email",
    "Get the full content (body, recipients, CC) of a single email by its ID.",
    {
      id: z.string().describe("Composite email ID in format account::mailbox::messageId, as returned by list_emails or search_emails."),
    },
    async ({ id }) => {
      try {
        const email = await runScript<EmailDetail>("get-email", { id });
        return { content: [{ type: "text", text: JSON.stringify(email, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: String(error) }], isError: true };
      }
    },
  );

  server.tool(
    "search_emails",
    "Search emails by subject, sender, or body text across mailboxes.",
    {
      query: z.string().describe("Search string."),
      account: z.string().optional().describe("Restrict search to this account."),
      mailbox: z.string().optional().describe("Restrict search to this mailbox/folder."),
      limit: z.number().int().min(1).max(200).optional().describe("Max number of results (default: 20)."),
    },
    async ({ query, account, mailbox, limit }) => {
      try {
        const emails = await runScript<EmailSummary[]>("search-emails", {
          query,
          account: account ?? "",
          mailbox: mailbox ?? "",
          limit: limit ?? 20,
        });
        return { content: [{ type: "text", text: JSON.stringify(emails, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: String(error) }], isError: true };
      }
    },
  );
}
