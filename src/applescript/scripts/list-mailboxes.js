// JXA script: list mailboxes in Mail.app
// argv[0]: JSON { account?: string }
// Returns: { name: string, account: string, unreadCount: number }[]
function run(argv) {
  const params = JSON.parse(argv[0] || "{}");
  const filterAccount = params.account || "";

  const Mail = Application("Mail");

  try {
    const allAccounts = Mail.accounts();
    const accounts = filterAccount
      ? allAccounts.filter((a) => a.name() === filterAccount)
      : allAccounts;

    const result = [];

    for (const acct of accounts) {
      const acctName = acct.name();
      const mailboxes = acct.mailboxes();

      for (const mb of mailboxes) {
        let unreadCount = 0;
        try {
          unreadCount = mb.unreadCount();
        } catch (_) {}

        result.push({
          name: mb.name(),
          account: acctName,
          unreadCount,
        });
      }
    }

    return JSON.stringify(result);
  } catch (e) {
    throw new Error("list-mailboxes failed: " + (e.message || e));
  }
}
