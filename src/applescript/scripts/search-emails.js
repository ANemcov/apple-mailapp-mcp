// JXA script: search emails in Mail.app
// argv[0]: JSON { query: string, account?: string, mailbox?: string, limit?: number }
// Returns: EmailSummary[]
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
      let mailboxes = acct.mailboxes();

      if (filterMailbox) {
        mailboxes = mailboxes.filter((mb) => mb.name() === filterMailbox);
      }

      for (const mb of mailboxes) {
        if (result.length >= limit) break;

        const mbName = mb.name();
        let msgs;

        // Use Mail's built-in search when possible
        try {
          msgs = Mail.search(mb, { for: query });
        } catch (_) {
          // Fall back to manual filter on subject + sender
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
            id = `${acctName}::${mbName}::${m.messageId()}`;
            subject = m.subject() || "";
            sender = m.sender() || "";
            date = m.dateReceived().toISOString();
            isRead = m.readStatus();
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
