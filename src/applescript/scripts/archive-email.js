// JXA script: archive an email (move to Archive mailbox)
// argv[0]: JSON { id: string }
// Returns: { success: true }
function run(argv) {
  const params = JSON.parse(argv[0] || "{}");
  if (!params.id) throw new Error("id is required");

  const Mail = Application("Mail");

  try {
    const { account } = parseCompositeId(params.id);
    const msg = findMessage(Mail, params.id);

    const accts = Mail.accounts().filter((a) => a.name() === account);
    if (accts.length === 0) throw new Error(`Account not found: ${account}`);

    // Find Archive mailbox — name varies by provider (Archive, [Gmail]/All Mail, etc.)
    const archiveNames = ["Archive", "All Mail", "[Gmail]/All Mail", "Archived"];
    let archiveMb = null;

    const allMbs = accts[0].mailboxes();
    for (const name of archiveNames) {
      const found = allMbs.filter((mb) => mb.name() === name);
      if (found.length > 0) {
        archiveMb = found[0];
        break;
      }
    }

    if (!archiveMb) {
      throw new Error(
        `Archive mailbox not found for account "${account}". ` +
        `Available mailboxes: ${allMbs.map((mb) => mb.name()).join(", ")}`
      );
    }

    Mail.move(msg, { to: archiveMb });

    return JSON.stringify({ success: true });
  } catch (e) {
    throw new Error("archive-email failed: " + (e.message || e));
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
