// JXA script: search emails in Mail.app
// argv[0]: JSON { query: string, account?: string, mailbox?: string, limit?: number }
// Returns: EmailSummary[]
//
// mailbox may be a canonical type (INBOX, TRASH, …) or a real localized name.
// findMailboxes() resolves both via alias map + regex heuristic.

const ALIAS_MAP = {
  INBOX:   ["inbox", "входящие"],
  SENT:    ["sent", "sent messages", "отправленные"],
  TRASH:   ["trash", "deleted messages", "удаленные", "корзина"],
  DRAFTS:  ["drafts", "черновики"],
  JUNK:    ["junk", "spam", "нежелательная почта", "спам"],
  OUTBOX:  ["outbox", "исходящие"],
  ARCHIVE: ["archive", "архив", "вся почта", "all mail"],
};

const REGEX_MAP = {
  INBOX:   /inbox|входящие/i,
  SENT:    /^sent|отправленные/i,
  TRASH:   /trash|deleted|удален|корзина/i,
  DRAFTS:  /draft|черновик/i,
  JUNK:    /junk|spam|нежелательн|спам/i,
  OUTBOX:  /outbox|исходящие/i,
  ARCHIVE: /archive|архив|all[\s-]?mail|вся.почта/i,
};

// Returns all mailboxes of the account matching requestedName (canonical or real).
// If requestedName is empty, returns all mailboxes.
function findMailboxes(acct, requestedName) {
  const allMbs = acct.mailboxes();

  if (!requestedName) return allMbs;

  const lower = requestedName.toLowerCase();
  const upper = requestedName.toUpperCase();

  // Step 1: exact match
  const exact = allMbs.filter((mb) => {
    try { return mb.name().toLowerCase() === lower; } catch (_) { return false; }
  });
  if (exact.length > 0) return exact;

  // Step 2: canonical alias lookup
  const aliasNames = ALIAS_MAP[upper];
  if (aliasNames) {
    for (const alias of aliasNames) {
      const found = allMbs.filter((mb) => {
        try { return mb.name().toLowerCase() === alias; } catch (_) { return false; }
      });
      if (found.length > 0) return found;
    }
  }

  // Step 3: regex heuristic
  for (const [canonical, regex] of Object.entries(REGEX_MAP)) {
    if (regex.test(requestedName)) {
      const found = allMbs.filter((mb) => {
        try { return REGEX_MAP[canonical].test(mb.name()); } catch (_) { return false; }
      });
      if (found.length > 0) return found;
    }
  }

  return [];
}

function run(argv) {
  const params = JSON.parse(argv[0] || "{}");
  if (!params.query) throw new Error("query is required");

  const query = params.query;
  const filterAccount = params.account || "";
  const filterMailbox = params.mailbox || "";
  const limit = typeof params.limit === "number" ? params.limit : 20;

  const Mail = Application("Mail");

  try {
    const allAccounts = Mail.accounts();
    const accounts = filterAccount
      ? allAccounts.filter((a) => a.name() === filterAccount)
      : allAccounts;

    const result = [];

    for (const acct of accounts) {
      if (result.length >= limit) break;

      const acctName = acct.name();
      const mailboxes = findMailboxes(acct, filterMailbox);

      for (const mb of mailboxes) {
        if (result.length >= limit) break;

        const mbName = mb.name();
        let msgs;

        try {
          msgs = Mail.search(mb, { for: query });
        } catch (_) {
          const lq = query.toLowerCase();
          msgs = mb.messages().filter((m) => {
            try {
              return (
                (m.subject() || "").toLowerCase().includes(lq) ||
                (m.sender() || "").toLowerCase().includes(lq)
              );
            } catch (_) {
              return false;
            }
          });
        }

        for (const m of msgs) {
          if (result.length >= limit) break;

          let id, subject, sender, date, isRead;
          try {
            id      = `${acctName}::${mbName}::${m.messageId()}`;
            subject = m.subject() || "";
            sender  = m.sender() || "";
            date    = m.dateReceived().toISOString();
            isRead  = m.readStatus();
          } catch (_) {
            continue;
          }

          result.push({ id, subject, sender, date, isRead, mailbox: mbName, account: acctName });
        }
      }
    }

    return JSON.stringify(result);
  } catch (e) {
    throw new Error("search-emails failed: " + (e.message || e));
  }
}
