// JXA script: get full content of a single email
// argv[0]: JSON { id: string }  — composite id: "account::mailbox::messageId"
// Returns: EmailDetail
function run(argv) {
  const params = JSON.parse(argv[0] || "{}");
  if (!params.id) throw new Error("id is required");

  const Mail = Application("Mail");

  try {
    const msg = findMessage(Mail, params.id);
    const parts = parseCompositeId(params.id);

    const recipients = msg.toRecipients().map((r) => {
      try { return r.address(); } catch (_) { return ""; }
    }).filter(Boolean);

    const cc = msg.ccRecipients().map((r) => {
      try { return r.address(); } catch (_) { return ""; }
    }).filter(Boolean);

    return JSON.stringify({
      id: params.id,
      subject: msg.subject() || "",
      sender: msg.sender() || "",
      date: msg.dateReceived().toISOString(),
      isRead: msg.readStatus(),
      mailbox: parts.mailbox,
      account: parts.account,
      body: msg.content() || "",
      recipients,
      cc,
    });
  } catch (e) {
    throw new Error("get-email failed: " + (e.message || e));
  }
}

function parseCompositeId(id) {
  const firstSep = id.indexOf("::");
  const secondSep = id.indexOf("::", firstSep + 2);
  return {
    account: id.substring(0, firstSep),
    mailbox: id.substring(firstSep + 2, secondSep),
    messageId: id.substring(secondSep + 2),
  };
}

function findMessage(Mail, compositeId) {
  const { account, mailbox, messageId } = parseCompositeId(compositeId);

  const accts = Mail.accounts().filter((a) => a.name() === account);
  if (accts.length === 0) throw new Error(`Account not found: ${account}`);

  const mbs = accts[0].mailboxes().filter((mb) => mb.name() === mailbox);
  if (mbs.length === 0) throw new Error(`Mailbox not found: ${mailbox}`);

  let msgs;
  try {
    msgs = mbs[0].messages.whose({ messageId })();
  } catch (_) {
    msgs = mbs[0].messages().filter((m) => {
      try { return m.messageId() === messageId; } catch (_) { return false; }
    });
  }

  if (msgs.length === 0) throw new Error(`Message not found: ${messageId}`);
  return msgs[0];
}
