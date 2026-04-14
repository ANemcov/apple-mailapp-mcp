// JXA script: create and send a new email
// argv[0]: JSON { to: string[], subject: string, body: string, cc?: string[], bcc?: string[], account?: string }
// Returns: { success: true }
function run(argv) {
  const params = JSON.parse(argv[0] || "{}");
  const { to, subject, body, cc = [], bcc = [], account = "" } = params;

  if (!to || to.length === 0) throw new Error("to is required");
  if (!subject) throw new Error("subject is required");
  if (body === undefined || body === null) throw new Error("body is required");

  const Mail = Application("Mail");

  try {
    // Determine sender account
    let senderAddress = "";
    if (account) {
      const accts = Mail.accounts().filter((a) => a.name() === account);
      if (accts.length > 0) {
        try {
          const addrs = accts[0].emailAddresses();
          senderAddress = Array.isArray(addrs) ? addrs[0] || "" : String(addrs);
        } catch (_) {}
      }
    }

    const msgProps = { subject, content: body, visible: false };
    if (senderAddress) msgProps.sender = senderAddress;

    const msg = Mail.OutgoingMessage(msgProps);
    Mail.outgoingMessages.push(msg);

    for (const addr of to) {
      msg.toRecipients.push(Mail.ToRecipient({ address: addr }));
    }
    for (const addr of cc) {
      msg.ccRecipients.push(Mail.CcRecipient({ address: addr }));
    }
    for (const addr of bcc) {
      msg.bccRecipients.push(Mail.BccRecipient({ address: addr }));
    }

    msg.send();

    return JSON.stringify({ success: true });
  } catch (e) {
    throw new Error("send-email failed: " + (e.message || e));
  }
}
