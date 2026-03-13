export interface Email {
  id: string;
  email_account_id: string;
  message_id: string;
  thread_id: string;
  subject: string | null;
  from: string | null;
  to: string | null;
  snippet: string | null;
  body_text: string | null;
  body_html: string | null;
  received_at: Date;
  created_at: Date;
}

export interface EmailInsert {
  email_account_id: string;
  message_id: string;
  thread_id: string;
  subject?: string | null;
  from?: string | null;
  to?: string | null;
  snippet?: string | null;
  body_text?: string | null;
  body_html?: string | null;
  received_at: Date;
}
