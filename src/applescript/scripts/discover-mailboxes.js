// JXA script: scan all mailboxes for an account and assign canonical types
// argv[0]: JSON { account: string }
// Returns: { name: string, canonical: string | null }[]

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

function resolveCanonical(name) {
  const lower = name.toLowerCase();

  // Step 1: exact match in alias map (case-insensitive)
  for (const [canonical, aliases] of Object.entries(ALIAS_MAP)) {
    if (aliases.includes(lower)) return canonical;
  }

  // Step 2: regex heuristic fallback
  for (const [canonical, regex] of Object.entries(REGEX_MAP)) {
    if (regex.test(name)) return canonical;
  }

  return null;
}

function run(argv) {
  const params = JSON.parse(argv[0] || "{}");
  if (!params.account) throw new Error("account is required");

  const Mail = Application("Mail");

  try {
    const accts = Mail.accounts().filter((a) => a.name() === params.account);
    if (accts.length === 0) throw new Error(`Account not found: ${params.account}`);

    const mailboxes = accts[0].mailboxes();
    const result = [];

    for (const mb of mailboxes) {
      let name;
      try { name = mb.name(); } catch (_) { continue; }
      result.push({ name, canonical: resolveCanonical(name) });
    }

    return JSON.stringify(result);
  } catch (e) {
    throw new Error("discover-mailboxes failed: " + (e.message || e));
  }
}
