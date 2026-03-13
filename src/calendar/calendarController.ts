import type { Request, Response } from 'express';
import { getSessionUser } from '../auth/session';
import { findEmailAccountById } from '../db/repositories/emailAccountRepository';
import { findCalendarEventsByAccountId } from '../db/repositories/calendarEventRepository';
import { syncCalendarForAccount } from './calendarSyncService';

/**
 * POST /api/calendar/sync - Trigger Calendar sync for the current user's connected account.
 */
export async function syncCalendar(req: Request, res: Response): Promise<void> {
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

  const result = await syncCalendarForAccount(account);
  if (result.error) {
    res.status(502).json({
      error: 'Calendar sync failed',
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
 * GET /api/calendar/events - List synced calendar events for the current user.
 */
export async function listEvents(req: Request, res: Response): Promise<void> {
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

  const fromStr = req.query.from as string | undefined;
  const toStr = req.query.to as string | undefined;
  const fromDate = fromStr ? new Date(fromStr) : undefined;
  const toDate = toStr ? new Date(toStr) : undefined;

  const events = await findCalendarEventsByAccountId(account.id, fromDate, toDate);
  res.json({ events });
}
