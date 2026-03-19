import type { Request, Response } from 'express';
import { getSessionUser } from '../auth/session';
import { findEmailAccountById } from '../db/repositories/emailAccountRepository';
import {
  findEmailsByAccountId,
  countEmailsByAccountId,
  findEmailByIdForAccount,
} from '../db/repositories/emailRepository';
import { syncGmailForAccount } from './gmailSyncService';

/**
 * POST /api/gmail/sync - Trigger Gmail sync for the current user's connected account.
 */
export async function syncGmail(req: Request, res: Response): Promise<void> {
  const user = getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const account = await findEmailAccountById(user.emailAccountId);
  if (!account) {
    res.status(404).json({ error: 'Email account not found' });
    return;
  }

  const result = await syncGmailForAccount(account);
  if (result.error) {
    const needsReconnect =
      result.error.includes('No refresh token') || result.error.includes('NoRefreshTokenError');
    res
      .status(needsReconnect ? 400 : 502)
      .json({
        error: needsReconnect
          ? 'Reconnect Gmail: sign out and connect Gmail again to get a refresh token.'
          : 'Gmail sync failed',
        details: result.error,
      });
    return;
  }

  res.json({
    success: true,
    synced: result.synced,
  });
}

/**
 * GET /api/gmail/emails - List synced emails for the current user.
 */
export async function listEmails(req: Request, res: Response): Promise<void> {
  const user = getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const account = await findEmailAccountById(user.emailAccountId);
  if (!account) {
    res.status(404).json({ error: 'Email account not found' });
    return;
  }

  const limit = Math.min(parseInt(String(req.query.limit), 10) || 50, 50);
  const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
  const offset = (page - 1) * limit;

  const [emails, total] = await Promise.all([
    findEmailsByAccountId(account.id, limit, offset),
    countEmailsByAccountId(account.id),
  ]);

  res.json({ emails, total, page, limit });
}

/**
 * GET /api/gmail/emails/:emailId - Get a single email (with body) for the current user.
 */
export async function getEmail(req: Request, res: Response): Promise<void> {
  const user = getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const account = await findEmailAccountById(user.emailAccountId);
  if (!account) {
    res.status(404).json({ error: 'Email account not found' });
    return;
  }

  const emailId = String(req.params.emailId);
  if (!emailId) {
    res.status(400).json({ error: 'emailId required' });
    return;
  }

  const email = await findEmailByIdForAccount(emailId, account.id);
  if (!email) {
    res.status(404).json({ error: 'Email not found' });
    return;
  }

  res.json(email);
}

