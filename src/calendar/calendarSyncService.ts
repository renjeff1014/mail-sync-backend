import type { calendar_v3 } from 'googleapis';
import type { CalendarEventInsert } from '../db/models/calendarEvent';
import {
  upsertCalendarEvent,
  deleteCalendarEventsOutsideRange,
} from '../db/repositories/calendarEventRepository';
import { updateEmailAccount } from '../db/repositories/emailAccountRepository';
import type { EmailAccount } from '../db/models/emailAccount';
import { getCalendarClient } from './calendarClient';

const PRIMARY_CALENDAR_ID = 'primary';
const DAYS_AHEAD = 60;

function extractMeetingLink(event: calendar_v3.Schema$Event): string | null {
  const link = event.hangoutLink ?? event.conferenceData?.entryPoints?.[0]?.uri ?? null;
  return link ?? null;
}

function parseEvent(
  event: calendar_v3.Schema$Event,
  emailAccountId: string
): CalendarEventInsert | null {
  const eventId = event.id ?? null;
  if (!eventId) return null;

  const start = event.start?.dateTime ?? event.start?.date;
  const end = event.end?.dateTime ?? event.end?.date;
  if (!start || !end) return null;

  const startTime = new Date(start);
  const endTime = new Date(end);
  const title = event.summary ?? null;
  const organizer = event.organizer?.email ?? null;
  const attendees = (event.attendees ?? [])
    .map((a) => a.email)
    .filter((e): e is string => Boolean(e));
  const meeting_link = extractMeetingLink(event);

  return {
    email_account_id: emailAccountId,
    event_id: eventId,
    title,
    start_time: startTime,
    end_time: endTime,
    organizer,
    attendees: attendees.length ? attendees : null,
    meeting_link,
  };
}

/**
 * Sync upcoming 60 days of calendar events for the given account.
 */
export async function syncCalendarForAccount(account: EmailAccount): Promise<{
  synced: number;
  error?: string;
}> {
  try {
    const { calendar } = await getCalendarClient(account);

    const timeMin = new Date();
    const timeMax = new Date();
    timeMax.setDate(timeMax.getDate() + DAYS_AHEAD);

    const res = await calendar.events.list({
      calendarId: PRIMARY_CALENDAR_ID,
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    const items = res.data.items ?? [];
    let synced = 0;

    for (const event of items) {
      const parsed = parseEvent(event, account.id);
      if (!parsed) continue;
      await upsertCalendarEvent(parsed);
      synced++;
    }

    // Remove events outside the synced window so DB reflects "upcoming 60 days" only
    await deleteCalendarEventsOutsideRange(account.id, timeMin, timeMax);

    await updateEmailAccount(account.id, {
      last_calendar_sync_at: new Date(),
    });

    return { synced };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { synced: 0, error: message };
  }
}
