# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Language

All communication within this project is conducted in **Russian**, unless explicitly stated otherwise. Commit messages are written in **English only**.

## Project Overview

`apple-mailapp-mcp` — MCP-сервер на TypeScript/Node.js, который предоставляет AI-ассистентам инструменты для работы с Apple Mail на macOS. Взаимодействие с Mail.app — через AppleScript (`osascript`). Транспорт — stdio.

Полная спецификация: [`SPEC.md`](./SPEC.md).

## Stack

- **TypeScript** + Node.js (`"type": "module"`)
- **`@modelcontextprotocol/sdk`** — MCP SDK
- **JXA** (JavaScript for Automation) скрипты вызываются через `osascript -l JavaScript` (child_process) — используется вместо `.applescript` ради нативного `JSON.stringify` и передачи параметров через `argv`

## Development Commands

```bash
npm install          # установка зависимостей
npm run build        # компиляция TypeScript → dist/
npm start            # запуск сервера (stdio)
```

## Architecture

```
src/
├── index.ts                 # точка входа, запуск StdioServerTransport
├── server.ts                # создание McpServer, регистрация всех tools
├── types.ts                 # общие типы: Email, Mailbox, Account
├── tools/
│   ├── email-read.ts        # list_emails, get_email, search_emails
│   ├── email-send.ts        # send_email, reply_email, forward_email
│   └── mailbox.ts           # list_accounts, list_mailboxes, move_email,
│                            #   mark_email, delete_email, archive_email
└── applescript/
    ├── runner.ts            # запуск osascript, парсинг JSON, обработка ошибок
    └── scripts/             # JXA (.js) скрипты — по одному файлу на операцию
```

### Ключевые соглашения

- AppleScript-слой изолирован в `src/applescript/`. Tool-хендлеры не вызывают `osascript` напрямую — только через `runner.ts`.
- Каждый `.applescript`-скрипт возвращает данные через `return` в виде JSON-строки (сериализация вручную внутри скрипта).
- Ошибки AppleScript перехватываются в `runner.ts` и пробрасываются как `McpError`.
- Письма идентифицируются составным ID: `{account}::{mailbox}::{messageId}`.
- Все tool-параметры `account` — опциональные; операции чтения без `account` охватывают все аккаунты.

## Claude Desktop Integration

После `npm run build` добавить в `~/Library/Application Support/Claude/claude_desktop_config.json`:

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
