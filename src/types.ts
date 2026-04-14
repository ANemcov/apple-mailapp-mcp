export interface EmailSummary {
  id: string;
  subject: string;
  sender: string;
  date: string;
  isRead: boolean;
  mailbox: string;
  account: string;
}

export interface EmailDetail extends EmailSummary {
  body: string;
  recipients: string[];
  cc: string[];
}

export interface MailboxInfo {
  name: string;
  account: string;
  unreadCount: number;
}

export interface AccountInfo {
  name: string;
  email: string;
}
