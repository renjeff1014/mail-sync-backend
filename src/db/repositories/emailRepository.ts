import { query } from '../client';
import type { Email, EmailInsert } from '../models/email';

const TABLE = 'emails';

export async function createEmail(data: EmailInsert): Promise<Email> {
  const { rows } = await query<Email>(
    `INSERT INTO ${TABLE} (email_account_id, message_id, thread_id, subject, "from", "to", snippet, body_text, body_html, received_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (email_account_id, message_id) DO UPDATE SET
       thread_id = EXCLUDED.thread_id, subject = EXCLUDED.subject, "from" = EXCLUDED."from",
       "to" = EXCLUDED."to", snippet = EXCLUDED.snippet, body_text = EXCLUDED.body_text,
       body_html = EXCLUDED.body_html, received_at = EXCLUDED.received_at
     RETURNING id, email_account_id, message_id, thread_id, subject, "from", "to", snippet, body_text, body_html, received_at, created_at`,
    [
      data.email_account_id,
      data.message_id,
      data.thread_id,
      data.subject ?? null,
      data.from ?? null,
      data.to ?? null,
      data.snippet ?? null,
      data.body_text ?? null,
      data.body_html ?? null,
      data.received_at,
    ]
  );
  return rows[0]!;
}

export async function findEmailsByAccountId(
  emailAccountId: string,
  limit = 50,
  offset = 0
): Promise<Email[]> {
  const { rows } = await query<Email>(
    `SELECT id, email_account_id, message_id, thread_id, subject, "from", "to", snippet, body_text, body_html, received_at, created_at
     FROM ${TABLE} WHERE email_account_id = $1 ORDER BY received_at DESC LIMIT $2 OFFSET $3`,
    [emailAccountId, limit, offset]
  );
  return rows;
}

export async function countEmailsByAccountId(emailAccountId: string): Promise<number> {
  const { rows } = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${TABLE} WHERE email_account_id = $1`,
    [emailAccountId]
  );
  return parseInt(rows[0]?.count ?? '0', 10);
}

export async function findEmailByIdForAccount(
  emailId: string,
  emailAccountId: string
): Promise<Email | null> {
  const { rows } = await query<Email>(
    `SELECT id, email_account_id, message_id, thread_id, subject, "from", "to", snippet, body_text, body_html, received_at, created_at
     FROM ${TABLE}
     WHERE id = $1 AND email_account_id = $2
     LIMIT 1`,
    [emailId, emailAccountId]
  );
  return rows[0] ?? null;
}

