import { convert as htmlToText } from 'html-to-text';
import type { gmail_v1 } from 'googleapis';
import type { EmailInsert } from '../db/models/email';
import { createEmail } from '../db/repositories/emailRepository';
import {
  updateEmailAccount,
  findEmailAccountsByUserId,
} from '../db/repositories/emailAccountRepository';
import type { EmailAccount } from '../db/models/emailAccount';
import { getGmailClient } from './gmailClient';

const MAX_RESULTS = 100;

/** Result of parsing Gmail message headers (Subject, From, To, Date). */
export interface ParsedHeaders {
  subject: string | null;
  from: string | null;
  to: string | null;
  dateStr: string | null;
}

/** Result of extracting body content from a Gmail message (plain text and optional HTML). */
export interface MessageBodyResult {
  body_text: string | null;
  body_html: string | null;
}

/**
 * Converts HTML email content to plain text for storage and search.
 * Uses html-to-text to strip tags, preserve links as text, and normalize whitespace.
 */
function convertHtmlToPlainText(html: string): string {
  return htmlToText(html, {
    wordwrap: 0,
    preserveNewlines: true,
    selectors: [{ selector: 'a', options: { hideLinkHrefIfSameAsText: true } }],
  }).trim();
}

/**
 * Parses Gmail message headers and returns subject, from, to, and date.
 * Header names are matched case-insensitively per RFC 2822.
 */
export function parseHeaders(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined
): ParsedHeaders {
  const get = (name: string): string | null => {
    if (!headers) return null;
    const h = headers.find((x) => x.name?.toLowerCase() === name.toLowerCase());
    return (h?.value ?? null) || null;
  };
  return {
    subject: get('Subject'),
    from: get('From'),
    to: get('To'),
    dateStr: get('Date'),
  };
}

/**
 * Recursively finds a MIME part with the given type and decodes its base64 body.
 * Used for multipart messages where body can be in a nested part.
 */
function getBodyPart(
  parts: gmail_v1.Schema$MessagePart[] | undefined,
  mimeType: 'text/plain' | 'text/html'
): string | null {
  if (!parts) return null;
  for (const part of parts) {
    if (part.mimeType === mimeType && part.body?.data) {
      return Buffer.from(part.body.data, 'base64').toString('utf-8');
    }
    const nested = getBodyPart(part.parts as gmail_v1.Schema$MessagePart[], mimeType);
    if (nested) return nested;
  }
  return null;
}

/**
 * Extracts the message body from a Gmail message (payload and parts).
 * Prefers plain text; if only HTML is present, converts it to plain text.
 * Returns both body_text (for storage/search) and body_html (for display).
 */
export function getMessageBody(msg: gmail_v1.Schema$Message): MessageBodyResult {
  const payload = msg.payload;
  const parts = payload?.parts as gmail_v1.Schema$MessagePart[] | undefined;
  let body_text: string | null = null;
  let body_html: string | null = null;

  // Single-part message: body is directly on payload.body
  if (payload?.body?.data) {
    const decoded = Buffer.from(payload.body.data, 'base64').toString('utf-8');
    if (payload.mimeType === 'text/html') {
      body_html = decoded;
      body_text = convertHtmlToPlainText(decoded);
    } else {
      body_text = decoded;
    }
    return { body_text, body_html };
  }

  // Multipart: look for text/plain and text/html in parts
  body_text = getBodyPart(parts, 'text/plain');
  body_html = getBodyPart(parts, 'text/html');
  if (body_html != null && body_text == null) {
    body_text = convertHtmlToPlainText(body_html);
  }
  return { body_text, body_html };
}

/**
 * Builds an EmailInsert from a Gmail API message object.
 * Uses parseHeaders() and getMessageBody(); caller must set email_account_id.
 */
function parseMessage(msg: gmail_v1.Schema$Message): EmailInsert | null {
  const id = msg.id ?? null;
  const threadId = msg.threadId ?? '';
  if (!id || !threadId) return null;

  const payload = msg.payload;
  const { subject, from, to, dateStr } = parseHeaders(payload?.headers);

  let received_at: Date;
  try {
    received_at = dateStr ? new Date(dateStr) : new Date();
  } catch {
    received_at = new Date();
  }

  const snippet = msg.snippet ?? null;
  const { body_text, body_html } = getMessageBody(msg);

  return {
    email_account_id: '', // filled by caller
    message_id: id,
    thread_id: threadId,
    subject,
    from,
    to,
    snippet,
    body_text,
    body_html,
    received_at,
  };
}

/**
 * Syncs the most recent emails for a user by:
 * 1. Loading all email accounts for the user (OAuth tokens from DB).
 * 2. For each account, calling gmail.users.messages.list then gmail.users.messages.get.
 * 3. Extracting message id, thread id, subject, from, to, body (plain text), snippet, timestamp.
 * 4. Saving/upserting into the emails table and updating last_gmail_sync_at.
 * Returns total synced count and any error from the first failing account.
 */
export async function syncRecentEmails(userId: string): Promise<{
  synced: number;
  error?: string;
}> {
  const accounts = await findEmailAccountsByUserId(userId);
  if (accounts.length === 0) {
    return { synced: 0, error: 'No email account found for user' };
  }

  let totalSynced = 0;
  for (const account of accounts) {
    const result = await syncGmailForAccount(account);
    totalSynced += result.synced;
    if (result.error) {
      return { synced: totalSynced, error: result.error };
    }
  }
  return { synced: totalSynced };
}

/**
 * Syncs the latest emails for a single account using stored OAuth tokens.
 * Uses gmail.users.messages.list (max MAX_RESULTS) then gmail.users.messages.get (format: full)
 * for each message, parses and saves to the emails table.
 */
export async function syncGmailForAccount(account: EmailAccount): Promise<{
  synced: number;
  error?: string;
}> {
  try {
    // Authenticate with stored tokens; gmailClient refreshes if expired
    const { gmail } = await getGmailClient(account);

    const listRes = await gmail.users.messages.list({
      userId: 'me',
      maxResults: MAX_RESULTS,
    });

    const messageIds = (listRes.data.messages ?? []).map((m) => m.id!).filter(Boolean);
    let synced = 0;

    for (const messageId of messageIds) {
      const msgRes = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });
      const parsed = parseMessage(msgRes.data);
      if (!parsed) continue;
      parsed.email_account_id = account.id;
      await createEmail(parsed);
      synced++;
    }

    await updateEmailAccount(account.id, {
      last_gmail_sync_at: new Date(),
    });

    return { synced };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { synced: 0, error: message };
  }
}
