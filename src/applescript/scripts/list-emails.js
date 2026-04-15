// JXA script: list emails from a mailbox
// argv[0]: JSON { account?: string, mailbox?: string, limit?: number, unreadOnly?: boolean }
// Returns: EmailSummary[]
//
// mailbox may be a canonical type (INBOX, SENT, TRASH, …) or a real localized name.
// findMailbox() resolves both via alias map + regex heuristic.

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

function findMailbox(acct, requestedName) {
  const allMbs = acct.mailboxes();
  const lower = requestedName.toLowerCase();
  const upper = requestedName.toUpperCase();

  // Step 1: exact match (case-insensitive) against the requested name itself
  const exactMatch = allMbs.filter((mb) => {
    try { return mb.name().toLowerCase() === lower; } catch (_) { return false; }
  });
  if (exactMatch.length > 0) return exactMatch[0];

  // Step 2: if requested name is a canonical type key, look up its aliases
  const aliasNames = ALIAS_MAP[upper];
  if (aliasNames) {
    for (const alias of aliasNames) {
      const found = allMbs.filter((mb) => {
        try { return mb.name().toLowerCase() === alias; } catch (_) { return false; }
      });
      if (found.length > 0) return found[0];
    }
  }

  // Step 3: regex heuristic — check if requestedName matches a canonical pattern,
  // then search all mailboxes for a name matching that same canonical's regex
  for (const [canonical, regex] of Object.entries(REGEX_MAP)) {
    if (regex.test(requestedName)) {
      // requestedName itself describes this canonical type — find it in this account
      const found = allMbs.filter((mb) => {
        try { return REGEX_MAP[canonical].test(mb.name()); } catch (_) { return false; }
      });
      if (found.length > 0) return found[0];
    }
  }

  return null;
}

function run(argv) {
  const params = JSON.parse(argv[0] || "{}");
  const filterAccount = params.account || "";
  const mailboxName   = params.mailbox || "INBOX";
  const limit         = typeof params.limit === "number" ? params.limit : 20;
  const unreadOnly    = params.unreadOnly === true;

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
      let targetMb = null;

      try {
        targetMb = findMailbox(acct, mailboxName);
      } catch (_) {}

      if (!targetMb) continue;

      const mbName = targetMb.name();
      let msgs;
      try {
        msgs = unreadOnly
          ? targetMb.messages.whose({ readStatus: false })()
          : targetMb.messages();
      } catch (_) {
        try { msgs = targetMb.messages(); } catch (_2) { continue; }
      }

      for (const m of msgs) {
        if (result.length >= limit) break;

        let id, subject, sender, date, isRead;
        try {
          id      = `${acctName}::${mbName}::${m.messageId()}`;
          subject = m.subject() || "(no subject)";
          sender  = m.sender() || "";
          date    = m.dateReceived().toISOString();
          isRead  = m.readStatus();
        } catch (_) {
          continue;
        }

        result.push({ id, subject, sender, date, isRead, mailbox: mbName, account: acctName });
      }
    }

    return JSON.stringify(result);
  } catch (e) {
    throw new Error("list-emails failed: " + (e.message || e));
  }
}
