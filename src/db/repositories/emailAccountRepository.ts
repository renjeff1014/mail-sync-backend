import { query } from '../client';
import type {
  EmailAccount,
  EmailAccountInsert,
  EmailAccountUpdate,
} from '../models/emailAccount';

const TABLE = 'email_accounts';

export async function findEmailAccountById(id: string): Promise<EmailAccount | null> {
  const { rows } = await query<EmailAccount>(
    `SELECT id, user_id, email, access_token, refresh_token, expiry_date,
            created_at, updated_at, last_gmail_sync_at, last_calendar_sync_at
     FROM ${TABLE} WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function findEmailAccountByUserAndEmail(
  userId: string,
  email: string
): Promise<EmailAccount | null> {
  const { rows } = await query<EmailAccount>(
    `SELECT id, user_id, email, access_token, refresh_token, expiry_date,
            created_at, updated_at, last_gmail_sync_at, last_calendar_sync_at
     FROM ${TABLE} WHERE user_id = $1 AND email = $2`,
    [userId, email]
  );
  return rows[0] ?? null;
}

export async function findEmailAccountsByUserId(userId: string): Promise<EmailAccount[]> {
  const { rows } = await query<EmailAccount>(
    `SELECT id, user_id, email, access_token, refresh_token, expiry_date,
            created_at, updated_at, last_gmail_sync_at, last_calendar_sync_at
     FROM ${TABLE} WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  return rows;
}

export async function createEmailAccount(data: EmailAccountInsert): Promise<EmailAccount> {
  const { rows } = await query<EmailAccount>(
    `INSERT INTO ${TABLE} (user_id, email, access_token, refresh_token, expiry_date)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, user_id, email, access_token, refresh_token, expiry_date,
               created_at, updated_at, last_gmail_sync_at, last_calendar_sync_at`,
    [
      data.user_id,
      data.email,
      data.access_token,
      data.refresh_token ?? null,
      data.expiry_date,
    ]
  );
  return rows[0]!;
}

export async function updateEmailAccount(
  id: string,
  data: EmailAccountUpdate
): Promise<EmailAccount | null> {
  const updates: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (data.access_token !== undefined) {
    updates.push(`access_token = $${i++}`);
    values.push(data.access_token);
  }
  if (data.refresh_token !== undefined) {
    updates.push(`refresh_token = $${i++}`);
    values.push(data.refresh_token);
  }
  if (data.expiry_date !== undefined) {
    updates.push(`expiry_date = $${i++}`);
    values.push(data.expiry_date);
  }
  if (data.last_gmail_sync_at !== undefined) {
    updates.push(`last_gmail_sync_at = $${i++}`);
    values.push(data.last_gmail_sync_at);
  }
  if (data.last_calendar_sync_at !== undefined) {
    updates.push(`last_calendar_sync_at = $${i++}`);
    values.push(data.last_calendar_sync_at);
  }
  updates.push('updated_at = now()');
  values.push(id);
  const { rows } = await query<EmailAccount>(
    `UPDATE ${TABLE} SET ${updates.join(', ')} WHERE id = $${i}
     RETURNING id, user_id, email, access_token, refresh_token, expiry_date,
               created_at, updated_at, last_gmail_sync_at, last_calendar_sync_at`,
    values
  );
  return rows[0] ?? null;
}
