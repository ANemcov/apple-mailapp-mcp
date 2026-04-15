import { runScript } from "./runner.js";

interface MailboxEntry {
  name: string;
  canonical: string | null;
}

// Canonical names that the resolver understands as input
const CANONICAL_TYPES = new Set([
  "INBOX", "SENT", "TRASH", "DRAFTS", "JUNK", "OUTBOX", "ARCHIVE",
]);

class MailboxResolver {
  // cache: account → Map<canonical, realName>
  private cache = new Map<string, Map<string, string>>();

  /**
   * Resolve a mailbox name for a given account.
   *
   * Input may be:
   *  - A canonical type ("INBOX", "TRASH", …) → returns the real localized name
   *  - A real name ("Входящие", "INBOX") → if it matches a canonical, resolves it;
   *    otherwise returns as-is (pass-through for explicitly specified real names)
   */
  async resolve(account: string, mailbox: string): Promise<string> {
    const canonical = mailbox.toUpperCase();

    // If not a known canonical type, return as-is (user passed a real name directly)
    if (!CANONICAL_TYPES.has(canonical)) {
      return mailbox;
    }

    const accountCache = await this.getAccountCache(account);
    return accountCache.get(canonical) ?? mailbox;
  }

  /**
   * Resolve a canonical type to a real name, or return null if not found.
   * Used when we strictly need a known system folder (e.g. archive_email).
   */
  async resolveStrict(account: string, canonical: string): Promise<string | null> {
    const key = canonical.toUpperCase();
    if (!CANONICAL_TYPES.has(key)) return null;

    const accountCache = await this.getAccountCache(account);
    return accountCache.get(key) ?? null;
  }

  /** Invalidate the cache for an account (call if mailboxes may have changed). */
  invalidate(account: string): void {
    this.cache.delete(account);
  }

  private async getAccountCache(account: string): Promise<Map<string, string>> {
    if (this.cache.has(account)) {
      return this.cache.get(account)!;
    }

    const entries = await runScript<MailboxEntry[]>("discover-mailboxes", { account });
    const map = new Map<string, string>();

    for (const entry of entries) {
      if (entry.canonical) {
        // First match wins — preserve order from Mail.app
        if (!map.has(entry.canonical)) {
          map.set(entry.canonical, entry.name);
        }
      }
    }

    this.cache.set(account, map);
    return map;
  }
}

// Singleton shared across all tool handlers within one process lifetime
export const mailboxResolver = new MailboxResolver();
