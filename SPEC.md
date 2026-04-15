# Спецификация: apple-mailapp-mcp

## Контекст

MCP-сервер, позволяющий AI-ассистентам (Claude Desktop и другим MCP-клиентам) управлять Apple Mail через протокол MCP. Взаимодействие с Mail.app — через JXA (`osascript -l JavaScript`). Сервер запускается локально, транспорт — stdio.

---

## Стек

| Параметр | Значение |
|---|---|
| Язык | TypeScript |
| Runtime | Node.js |
| MCP SDK | `@modelcontextprotocol/sdk` |
| Управление Mail | JXA (JavaScript for Automation) через `osascript -l JavaScript` |
| Транспорт | stdio |
| Тесты | нет (начальный этап) |

---

## Структура проекта

```
src/
├── index.ts                        # точка входа, запуск StdioServerTransport
├── server.ts                       # создание McpServer, регистрация всех tools
├── types.ts                        # общие типы: EmailSummary, EmailDetail, MailboxInfo, AccountInfo
├── tools/
│   ├── email-read.ts               # list_emails, get_email, search_emails
│   ├── email-send.ts               # send_email, reply_email, forward_email
│   └── mailbox.ts                  # list_accounts, list_mailboxes, move_email,
│                                   #   mark_email, delete_email, archive_email
└── applescript/
    ├── runner.ts                   # запуск osascript, парсинг JSON, обработка ошибок
    ├── mailbox-resolver.ts         # резолвинг канонических имён папок → реальные имена
    └── scripts/                    # JXA (.js) скрипты — по одному файлу на операцию
        ├── discover-mailboxes.js   # сканирует все папки аккаунта, возвращает {name, canonical}[]
        ├── list-emails.js
        ├── get-email.js
        ├── search-emails.js
        ├── send-email.js
        ├── reply-email.js
        ├── forward-email.js
        ├── list-accounts.js
        ├── list-mailboxes.js
        ├── move-email.js
        ├── mark-email.js
        ├── delete-email.js
        └── archive-email.js
```

---

## Архитектурные решения

### JXA-слой

- Каждая операция — отдельный `.js`-файл (JXA) в `src/applescript/scripts/`.
- `runner.ts` вызывает `execFile('osascript', ['-l', 'JavaScript', scriptPath, paramsJson])`, получает **JSON-строку** из stdout.
- JXA-скрипты используют нативный `JSON.stringify` / `JSON.parse` — ручная сериализация не нужна.
- Параметры передаются через `argv[0]` как JSON-строка; результат возвращается через `return JSON.stringify(...)`.
- Ошибки JXA перехватываются в `runner.ts` → `McpError(ErrorCode.InternalError, ...)`.

### Идентификация писем

Составной ID: `{account}::{mailbox}::{messageId}`, где `messageId` — свойство `message id` объекта письма в JXA. Позволяет однозначно найти письмо при последующих обращениях.

### Множественные аккаунты

- Параметр `account` во всех tools — опциональный (имя аккаунта из Mail.app).
- `list_emails`, `search_emails` без `account` работают по всем аккаунтам.
- Мутирующие операции (move, delete, mark, archive) получают аккаунт из составного `id`.

### Определение имён папок (mailbox resolver)

Apple Mail использует локализованные имена системных папок, зависящие от типа аккаунта и языка интерфейса. Нативные JXA-аксессоры (`acct.inbox()`, `sentMailbox()` и др.) ненадёжны и не работают на Exchange/IMAP аккаунтах.

**Реальные примеры имён папок (из пользовательской системы):**

| Канонический тип | iCloud | Exchange | Yandex/IMAP | Google |
|---|---|---|---|---|
| INBOX | `INBOX` | `Входящие` | `INBOX` | `INBOX` |
| SENT | `Sent Messages` | `Отправленные` | `Sent` | `Отправленные` |
| TRASH | `Deleted Messages` | `Удаленные` | `Trash` | `Корзина` |
| DRAFTS | `Drafts` | `Черновики` | `Drafts` | `Черновики` |
| JUNK | `Junk` | `Нежелательная почта` | `Spam` | `Спам` |
| OUTBOX | — | `Исходящие` | `Outbox` | — |
| ARCHIVE | `Archive` | `Архив` | `Archive` | `Вся почта` |

**Архитектура резолвера (`mailbox-resolver.ts`):**

Singleton-класс `MailboxResolver` с in-memory кешем `Map<account, Map<canonical, realName>>`.

Метод `resolve(account: string, canonical: string): Promise<string>`:
1. Проверить кеш. Если есть — вернуть.
2. Если кеш пуст для аккаунта — вызвать `discover-mailboxes.js`, который:
   - Перебирает все папки аккаунта
   - Для каждой папки определяет canonical тип через двухуровневый матчинг:
     1. **Точное совпадение** (case-insensitive) по alias-map:
        ```
        INBOX:   ["INBOX", "Inbox", "Входящие"]
        SENT:    ["Sent", "Sent Messages", "Отправленные"]
        TRASH:   ["Trash", "Deleted Messages", "Удаленные", "Корзина"]
        DRAFTS:  ["Drafts", "Черновики"]
        JUNK:    ["Junk", "Spam", "Нежелательная почта", "Спам"]
        OUTBOX:  ["Outbox", "Исходящие"]
        ARCHIVE: ["Archive", "Архив", "Вся почта", "All Mail"]
        ```
     2. **Regex-эвристика** как fallback:
        ```
        INBOX:   /inbox|входящие/i
        SENT:    /^sent|отправленные/i
        TRASH:   /trash|deleted|удален|корзина/i
        DRAFTS:  /draft|черновик/i
        JUNK:    /junk|spam|нежелательн|спам/i
        OUTBOX:  /outbox|исходящие/i
        ARCHIVE: /archive|архив|all.?mail/i
        ```
   - Возвращает `{ name: string, canonical: string | null }[]`
3. Заполнить кеш и вернуть результат.
4. Если canonical не найден — вернуть входную строку без изменений (прямой pass-through).

**Использование в tools:**

- `list_emails`, `search_emails`: если `mailbox` — канонический тип (`INBOX`, `TRASH` и т.д.) или строка без `::`, резолвер возвращает реальное имя перед передачей в JXA-скрипт.
- `archive_email`: резолвер определяет реальное имя папки Archive для данного аккаунта.
- `move_email`: `target_mailbox` от пользователя может быть как каноническим именем, так и реальным — резолвер пробует оба варианта.

**Кеш** живёт в памяти Node.js-процесса (один stdio-сеанс). При рестарте сервера сканирование повторяется.

---

## MCP Tools

### Чтение писем

#### `list_emails`

Список писем из ящика.

| Параметр | Тип | По умолч. | Описание |
|---|---|---|---|
| `account` | string? | все | Имя аккаунта в Mail.app |
| `mailbox` | string? | `"INBOX"` | Имя папки или канонический тип |
| `limit` | number? | 20 | Максимальное кол-во писем |
| `unread_only` | boolean? | false | Только непрочитанные |

Возвращает: `{ id, subject, sender, date, isRead, mailbox, account }[]`

---

#### `get_email`

Полное содержимое письма (plain text).

| Параметр | Тип | Описание |
|---|---|---|
| `id` | string | Составной ID письма |

Возвращает: `{ id, subject, sender, recipients, cc, date, body, isRead, mailbox, account }`

---

#### `search_emails`

Поиск по теме, отправителю, тексту.

| Параметр | Тип | По умолч. | Описание |
|---|---|---|---|
| `query` | string | — | Строка поиска |
| `account` | string? | все | Ограничить аккаунтом |
| `mailbox` | string? | все | Имя папки или канонический тип |
| `limit` | number? | 20 | Максимальное кол-во результатов |

Возвращает: `{ id, subject, sender, date, isRead, mailbox, account }[]`

---

### Отправка писем

#### `send_email`

| Параметр | Тип | Описание |
|---|---|---|
| `to` | string[] | Получатели |
| `subject` | string | Тема |
| `body` | string | Тело (plain text) |
| `cc` | string[]? | Копия |
| `bcc` | string[]? | Скрытая копия |
| `account` | string? | От какого аккаунта (первый, если не указан) |

---

#### `reply_email`

| Параметр | Тип | По умолч. | Описание |
|---|---|---|---|
| `id` | string | — | ID письма для ответа |
| `body` | string | — | Текст ответа |
| `reply_all` | boolean? | false | Ответить всем |

---

#### `forward_email`

| Параметр | Тип | Описание |
|---|---|---|
| `id` | string | ID письма |
| `to` | string[] | Получатели |
| `body` | string? | Дополнительный текст |

---

### Управление ящиками

#### `list_accounts`

Без параметров. Возвращает: `{ name, email }[]`

---

#### `list_mailboxes`

| Параметр | Тип | По умолч. | Описание |
|---|---|---|---|
| `account` | string? | все | Ограничить аккаунтом |

Возвращает: `{ name, account, unreadCount }[]`

---

#### `move_email`

| Параметр | Тип | Описание |
|---|---|---|
| `id` | string | ID письма |
| `target_mailbox` | string | Имя целевой папки (реальное или канонический тип) |

---

#### `mark_email`

| Параметр | Тип | Описание |
|---|---|---|
| `id` | string | ID письма |
| `read` | boolean | `true` = прочитано, `false` = непрочитано |

---

#### `delete_email`

Перемещает письмо в Корзину (используется `Mail.delete(msg)`).

| Параметр | Тип | Описание |
|---|---|---|
| `id` | string | ID письма |

---

#### `archive_email`

Перемещает письмо в папку Archive (резолвится через `MailboxResolver` для каждого аккаунта).

| Параметр | Тип | Описание |
|---|---|---|
| `id` | string | ID письма |

---

## Конфигурация сборки

**`tsconfig.json`**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true
  }
}
```

**`package.json`** (ключевые поля)
```json
{
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc && cp src/applescript/scripts/*.js dist/applescript/scripts/",
    "start": "node dist/index.js",
    "dev": "npm run build && npm start"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.10.2",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/node": "^22.0.0"
  }
}
```

---

## Интеграция с Claude Desktop

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

---

## Верификация

1. `npm run build` — компиляция без ошибок TypeScript
2. Вызвать `list_accounts` — убедиться что возвращаются аккаунты из Mail.app
3. Вызвать `list_emails` с `mailbox: "INBOX"` для каждого аккаунта — убедиться что резолвер находит реальное имя
4. Вызвать `list_emails` с `mailbox: "TRASH"` — убедиться что работает для аккаунтов с разными именами корзины
5. Вызвать `search_emails` с `query` и ограничением по `mailbox`
6. Отправить тестовое письмо через `send_email`
7. Выполнить `mark_email`, `move_email`, `archive_email` на тестовом письме
