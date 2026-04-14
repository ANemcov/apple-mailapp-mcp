// JXA script: list all accounts configured in Mail.app
// Returns: { name: string, email: string }[]
function run() {
  const Mail = Application("Mail");

  try {
    const accounts = Mail.accounts();
    const result = accounts.map((acct) => {
      let email = "";
      try {
        const addrs = acct.emailAddresses();
        email = Array.isArray(addrs) ? addrs[0] || "" : String(addrs);
      } catch (_) {}

      return { name: acct.name(), email };
    });

    return JSON.stringify(result);
  } catch (e) {
    throw new Error("list-accounts failed: " + (e.message || e));
  }
}
