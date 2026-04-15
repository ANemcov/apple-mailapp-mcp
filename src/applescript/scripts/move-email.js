// JXA script: move an email to another mailbox
// argv[0]: JSON { id: string, targetMailbox: string }
//   targetMailbox — real mailbox name (pre-resolved by TypeScript MailboxResolver when possible)
// Returns: { success: true }
function run(argv) {
  const params = JSON.parse(argv[0] || "{}");
  const { id, targetMailbox } = params;

  if (!id) throw new Error("id is required");
  if (!targetMailbox) throw new Error("targetMailbox is required");

  const Mail = Application("Mail");

  try {
    const { account } = parseCompositeId(id);
    const msg = findMessage(Mail, id);

    const accts = Mail.accounts().filter((a) => a.name() === account);
    if (accts.length === 0) throw new Error(`Account not found: ${account}`);

    // Direct match first (TypeScript should have pre-resolved the name)
    let mbs = accts[0].mailboxes().filter((mb) => mb.name() === targetMailbox);

    if (mbs.length === 0) {
      throw new Error(
        `Target mailbox "${targetMailbox}" not found in account "${account}". ` +
        `Available: ${accts[0].mailboxes().map((mb) => mb.name()).join(", ")}`
      );
    }

    Mail.move(msg, { to: mbs[0] });
    return JSON.stringify({ success: true });
  } catch (e) {
    throw new Error("move-email failed: " + (e.message || e));
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
