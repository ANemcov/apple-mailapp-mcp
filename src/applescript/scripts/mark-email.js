// JXA script: mark email as read or unread
// argv[0]: JSON { id: string, read: boolean }
// Returns: { success: true }
function run(argv) {
  const params = JSON.parse(argv[0] || "{}");
  const { id, read } = params;

  if (!id) throw new Error("id is required");
  if (typeof read !== "boolean") throw new Error("read (boolean) is required");

  const Mail = Application("Mail");

  try {
    const msg = findMessage(Mail, id);
    msg.readStatus = read;

    return JSON.stringify({ success: true });
  } catch (e) {
    throw new Error("mark-email failed: " + (e.message || e));
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
