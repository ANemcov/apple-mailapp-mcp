# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Language

All communication within this project is conducted in **Russian**, unless explicitly stated otherwise. Commit messages are written in **English only**.

## Project Overview

`apple-mailapp-mcp` — MCP-сервер на TypeScript/Node.js, который предоставляет AI-ассистентам инструменты для работы с Apple Mail на macOS. Взаимодействие с Mail.app — через JXA (`osascript -l JavaScript`). Транспорт — stdio.

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

- JXA-слой изолирован в `src/applescript/`. Tool-хендлеры не вызывают `osascript` напрямую — только через `runner.ts`.
- Каждый JXA-скрипт возвращает данные через `return JSON.stringify(...)`. Параметры принимаются через `argv[0]` как JSON-строка.
- Ошибки JXA перехватываются в `runner.ts` и пробрасываются как `McpError`.
- Письма идентифицируются составным ID: `{account}::{mailbox}::{messageId}`.
- Все tool-параметры `account` — опциональные; операции чтения без `account` охватывают все аккаунты.
- Определение папок — через `mailbox-resolver.ts`: alias map (EN/RU) + regex fallback + in-memory кеш per account.

## Git Flow

Репозиторий использует git-flow. Ветки: `main` (production), `develop` (integration).

Конфигурация: fast-forward merges (без merge-коммитов), ветки после merge удаляются.

```bash
git flow feature start <name>   # новая фича от develop
git flow feature finish <name>  # fast-forward в develop, ветка удаляется

git flow release start <version>   # релиз от develop (например: 0.1.0)
git flow release finish <version>  # merge в main + тег vX.Y.Z, затем в develop

git flow hotfix start <name>    # хотфикс от main
git flow hotfix finish <name>   # merge в main + develop
```

После `finish` вручную запускать push:
```bash
git push origin develop
git push origin main      # после release/hotfix
git push origin --tags    # после release/hotfix
```

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
