// JXA script: list emails from a mailbox
// argv[0]: JSON { account?: string, mailbox?: string, limit?: number, unreadOnly?: boolean }
// Returns: EmailSummary[]

// Canonical mailbox aliases → possible localized names
const INBOX_NAMES  = ["INBOX", "Inbox", "Входящие"];
const SENT_NAMES   = ["Sent", "Sent Messages", "Отправленные"];
const TRASH_NAMES  = ["Trash", "Deleted Messages", "Удаленные"];
const DRAFTS_NAMES = ["Drafts", "Черновики"];
const JUNK_NAMES   = ["Junk", "Spam", "Нежелательная почта"];

const ALIAS_MAP = {
  INBOX:  INBOX_NAMES,
  SENT:   SENT_NAMES,
  TRASH:  TRASH_NAMES,
  DRAFTS: DRAFTS_NAMES,
  JUNK:   JUNK_NAMES,
};

function findMailbox(acct, requestedName) {
  // First try native inbox() accessor
  if (INBOX_NAMES.includes(requestedName)) {
    try { return acct.inbox(); } catch (_) {}
  }

  // Build candidate names list (alias expansion or literal)
  const candidates = ALIAS_MAP[requestedName.toUpperCase()] || [requestedName];

  const allMbs = acct.mailboxes();
  for (const name of candidates) {
    const found = allMbs.filter((mb) => mb.name() === name);
    if (found.length > 0) return found[0];
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
