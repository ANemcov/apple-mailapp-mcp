# Спецификация: apple-mailapp-mcp

## Контекст

MCP-сервер, позволяющий AI-ассистентам (Claude Desktop и другим MCP-клиентам) управлять Apple Mail через протокол MCP. Взаимодействие с Mail.app — через AppleScript (`osascript`). Сервер запускается локально, транспорт — stdio.

---

## Стек

| Параметр | Значение |
|---|---|
| Язык | TypeScript |
| Runtime | Node.js |
| MCP SDK | `@modelcontextprotocol/sdk` |
| Управление Mail | AppleScript через `osascript` |
| Транспорт | stdio |
| Тесты | нет (начальный этап) |

---

## Архитектурные решения

### AppleScript-слой

- Каждая операция — отдельный `.applescript`-файл в `src/applescript/scripts/`.
- `runner.ts` принимает имя скрипта + параметры, вызывает `osascript`, получает **JSON-строку** из stdout.
- Скрипты возвращают JSON через `return` (сериализация вручную внутри AppleScript).
- Ошибки AppleScript перехватываются в `runner.ts` → `McpError` с кодом `ToolExecutionError`.

### Идентификация писем

Составной ID: `{account}::{mailbox}::{messageId}`, где `messageId` — свойство `message id` объекта письма в AppleScript. Позволяет однозначно найти письмо при последующих обращениях.

### Множественные аккаунты

- Параметр `account` во всех tools — опциональный (имя аккаунта из Mail.app).
- `list_emails`, `search_emails` без `account` работают по всем аккаунтам.
- Мутирующие операции (move, delete, mark, archive) получают аккаунт из составного `id`.

---

## MCP Tools

### Чтение писем

#### `list_emails`

Список писем из ящика.

| Параметр | Тип | По умолч. | Описание |
|---|---|---|---|
| `account` | string? | все | Имя аккаунта в Mail.app |
| `mailbox` | string? | `"INBOX"` | Имя папки |
| `limit` | number? | 20 | Максимальное кол-во писем |
| `unread_only` | boolean? | false | Только непрочитанные |

Возвращает: `{ id, subject, sender, date, isRead, mailbox, account }[]`

---

#### `get_email`

Полное содержимое письма (plain text).

| Параметр | Тип | Описание |
|---|---|---|
| `id` | string | Составной ID письма |

Возвращает: `{ id, subject, sender, recipients, cc, date, body, mailbox, account }`

---

#### `search_emails`

Поиск по теме, отправителю, тексту.

| Параметр | Тип | По умолч. | Описание |
|---|---|---|---|
| `query` | string | — | Строка поиска |
| `account` | string? | все | Ограничить аккаунтом |
| `mailbox` | string? | все | Ограничить папкой |
| `limit` | number? | 20 | Максимальное кол-во результатов |

Возвращает: `{ id, subject, sender, date, isRead }[]`

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
| `target_mailbox` | string | Имя целевой папки |

---

#### `mark_email`

| Параметр | Тип | Описание |
|---|---|---|
| `id` | string | ID письма |
| `read` | boolean | `true` = прочитано, `false` = непрочитано |

---

#### `delete_email`

Перемещает письмо в Корзину.

| Параметр | Тип | Описание |
|---|---|---|
| `id` | string | ID письма |

---

#### `archive_email`

Перемещает письмо в системную папку Archive.

| Параметр | Тип | Описание |
|---|---|---|
| `id` | string | ID письма |

---

## Формат данных в AppleScript

Скрипты сериализуют результат вручную. Паттерн:

```applescript
-- одно письмо
set jsonStr to "{\"subject\": \"" & subject of m & "\", \"sender\": \"" & sender of m & "\"}"
return jsonStr

-- список
set jsonList to "["
repeat with i from 1 to count of msgs
  -- ... формируем объект
  if i < count of msgs then set jsonList to jsonList & ","
end repeat
return jsonList & "]"
```

**Важно:** в строках экранировать `"` и `\`. Переносы строк в теле письма заменять на `\n`.

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
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "latest"
  },
  "devDependencies": {
    "typescript": "^5",
    "@types/node": "^22"
  }
}
```

---

## Верификация

1. `npm run build` — компиляция без ошибок TypeScript
2. Запустить сервер вручную, проверить handshake через MCP Inspector или Claude Desktop
3. Вызвать `list_accounts` — убедиться что возвращаются аккаунты из Mail.app
4. Вызвать `list_emails` и `search_emails`
5. Отправить тестовое письмо через `send_email`
6. Выполнить `mark_email`, `move_email`, `archive_email` на тестовом письме
