import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { runScript } from "../applescript/runner.js";
import { mailboxResolver } from "../applescript/mailbox-resolver.js";
import type { AccountInfo, MailboxInfo } from "../types.js";

export function registerMailboxTools(server: McpServer): void {
  server.tool(
    "list_accounts",
    "List all email accounts configured in Mail.app.",
    {},
    async () => {
      try {
        const accounts = await runScript<AccountInfo[]>("list-accounts");
        return { content: [{ type: "text", text: JSON.stringify(accounts, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: String(error) }], isError: true };
      }
    },
  );

  server.tool(
    "list_mailboxes",
    "List all mailboxes/folders for one or all accounts.",
    {
      account: z.string().optional().describe("Restrict to this account (lists all accounts if omitted)."),
    },
    async ({ account }) => {
      try {
        const mailboxes = await runScript<MailboxInfo[]>("list-mailboxes", {
          account: account ?? "",
        });
        return { content: [{ type: "text", text: JSON.stringify(mailboxes, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: String(error) }], isError: true };
      }
    },
  );

  server.tool(
    "move_email",
    "Move an email to a different mailbox/folder within the same account.",
    {
      id: z.string().describe("Composite ID of the email to move."),
      target_mailbox: z.string().describe("Name of the destination mailbox/folder."),
    },
    async ({ id, target_mailbox }) => {
      try {
        const account = id.substring(0, id.indexOf("::"));
        const resolvedTarget = await mailboxResolver.resolve(account, target_mailbox);
        await runScript("move-email", { id, targetMailbox: resolvedTarget });
        return { content: [{ type: "text", text: "Email moved successfully." }] };
      } catch (error) {
        return { content: [{ type: "text", text: String(error) }], isError: true };
      }
    },
  );

  server.tool(
    "mark_email",
    "Mark an email as read or unread.",
    {
      id: z.string().describe("Composite ID of the email."),
      read: z.boolean().describe("true = mark as read, false = mark as unread."),
    },
    async ({ id, read }) => {
      try {
        await runScript("mark-email", { id, read });
        return { content: [{ type: "text", text: `Email marked as ${read ? "read" : "unread"}.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: String(error) }], isError: true };
      }
    },
  );

  server.tool(
    "delete_email",
    "Move an email to Trash.",
    {
      id: z.string().describe("Composite ID of the email to delete."),
    },
    async ({ id }) => {
      try {
        await runScript("delete-email", { id });
        return { content: [{ type: "text", text: "Email moved to Trash." }] };
      } catch (error) {
        return { content: [{ type: "text", text: String(error) }], isError: true };
      }
    },
  );

  server.tool(
    "archive_email",
    "Archive an email (moves to the Archive mailbox of the account).",
    {
      id: z.string().describe("Composite ID of the email to archive."),
    },
    async ({ id }) => {
      try {
        const account = id.substring(0, id.indexOf("::"));
        const archiveMailbox = await mailboxResolver.resolveStrict(account, "ARCHIVE");
        if (!archiveMailbox) {
          return {
            content: [{ type: "text", text: `Archive mailbox not found for account "${account}".` }],
            isError: true,
          };
        }
        await runScript("archive-email", { id, archiveMailbox });
        return { content: [{ type: "text", text: "Email archived." }] };
      } catch (error) {
        return { content: [{ type: "text", text: String(error) }], isError: true };
      }
    },
  );
}
