# apple-mailapp-mcp

MCP server for Apple Mail on macOS. Gives AI assistants (Claude Desktop, Claude Code, and any MCP-compatible client) the ability to read, send, search, and manage emails in Mail.app — without browser automation or third-party APIs.

Communication with Mail.app happens via JXA (JavaScript for Automation) through the system `osascript` command. No external dependencies, no cloud services, no credentials to configure.

**Requires macOS with Mail.app configured.**

---

## Features

### Reading emails
| Tool | Description |
|---|---|
| `list_emails` | List emails from any mailbox (Inbox, Sent, Trash, custom folders, …) |
| `get_email` | Get the full content of an email — body, recipients, CC |
| `search_emails` | Search emails by subject, sender, or body text |

### Sending emails
| Tool | Description |
|---|---|
| `send_email` | Compose and send a new email from any configured account |
| `reply_email` | Reply to an email (single recipient or reply-all) |
| `forward_email` | Forward an email to new recipients |

### Mailbox management
| Tool | Description |
|---|---|
| `list_accounts` | List all accounts configured in Mail.app |
| `list_mailboxes` | List all folders/mailboxes for one or all accounts |
| `move_email` | Move an email to a different folder |
| `mark_email` | Mark an email as read or unread |
| `delete_email` | Move an email to Trash |
| `archive_email` | Move an email to the Archive folder |

### Localized folder names
Mail.app uses different folder names depending on account type and system language (e.g. `Inbox` / `Входящие`, `Trash` / `Корзина` / `Deleted Messages`). The server resolves canonical folder names (`INBOX`, `TRASH`, `SENT`, etc.) to the real localized names automatically for each account, with an in-process cache so the lookup happens only once per session.

### Multiple accounts
All tools accept an optional `account` parameter to target a specific Mail.app account. Read tools (`list_emails`, `search_emails`) work across all accounts when `account` is omitted.

---

## Requirements

- macOS (tested on macOS 13+)
- Apple Mail configured with at least one account
- Node.js 18+
- Accessibility permissions for `osascript` / Terminal (macOS will prompt on first run)

---

## Installation

### Option 1: Clone and build

```bash
git clone https://github.com/your-username/apple-mailapp-mcp
cd apple-mailapp-mcp
npm install
npm run build
```

Then register with your MCP client (see [Configuration](#configuration) below).

### Option 2: npx (no clone required)

If the package is published to npm:

```bash
npx apple-mailapp-mcp
```

---

## Configuration

### Claude Code

```bash
claude mcp add --scope user apple-mail node /absolute/path/to/apple-mailapp-mcp/dist/index.js
```

Verify the server is registered:
```bash
claude mcp list
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "apple-mail": {
      "command": "node",
      "args": ["/absolute/path/to/apple-mailapp-mcp/dist/index.js"]
    }
  }
}
```

Restart Claude Desktop after editing the config.

### Other MCP clients

The server uses stdio transport, which is the standard for local MCP servers. Any MCP client that supports stdio can run it:

```
command: node
args:    ["/absolute/path/to/dist/index.js"]
```

---

## Usage examples

Once connected, you can ask your AI assistant naturally:

- *"Show me unread emails in my inbox"*
- *"Find emails from john@example.com about the project"*
- *"Send an email to alice@example.com with subject 'Meeting tomorrow' and say I'll be 10 minutes late"*
- *"Move that email to the Archive folder"*
- *"Reply to the last email from Bob and say thanks"*

---

## Development

```bash
npm install       # install dependencies
npm run build     # compile TypeScript → dist/
npm start         # run the server (stdio)
npm run dev       # build + start
```

The project uses JXA scripts (`src/applescript/scripts/*.js`) for all Mail.app interactions. Each script is a standalone file executed via `osascript -l JavaScript`. TypeScript tool handlers in `src/tools/` call these scripts through `src/applescript/runner.ts`.

---

## License

MIT
