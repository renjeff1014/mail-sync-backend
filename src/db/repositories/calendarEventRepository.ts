import { query } from '../client';
import type { CalendarEvent, CalendarEventInsert } from '../models/calendarEvent';

const TABLE = 'calendar_events';

export async function upsertCalendarEvent(data: CalendarEventInsert): Promise<CalendarEvent> {
  const { rows } = await query<CalendarEvent>(
    `INSERT INTO ${TABLE} (email_account_id, event_id, title, start_time, end_time, organizer, attendees, meeting_link)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (email_account_id, event_id) DO UPDATE SET
       title = COALESCE(EXCLUDED.title, ${TABLE}.title),
       start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time,
       organizer = COALESCE(EXCLUDED.organizer, ${TABLE}.organizer),
       attendees = COALESCE(EXCLUDED.attendees, ${TABLE}.attendees),
       meeting_link = COALESCE(EXCLUDED.meeting_link, ${TABLE}.meeting_link),
       updated_at = now()
     RETURNING id, email_account_id, event_id, title, start_time, end_time, organizer, attendees, meeting_link, created_at, updated_at`,
    [
      data.email_account_id,
      data.event_id,
      data.title ?? null,
      data.start_time,
      data.end_time,
      data.organizer ?? null,
      data.attendees ?? null,
      data.meeting_link ?? null,
    ]
  );
  return rows[0]!;
}

export async function findCalendarEventsByAccountId(
  emailAccountId: string,
  fromDate?: Date,
  toDate?: Date
): Promise<CalendarEvent[]> {
  let sql = `SELECT id, email_account_id, event_id, title, start_time, end_time, organizer, attendees, meeting_link, created_at, updated_at
             FROM ${TABLE} WHERE email_account_id = $1`;
  const params: unknown[] = [emailAccountId];
  if (fromDate) {
    params.push(fromDate);
    sql += ` AND end_time >= $${params.length}`;
  }
  if (toDate) {
    params.push(toDate);
    sql += ` AND start_time <= $${params.length}`;
  }
  sql += ' ORDER BY start_time ASC';
  const { rows } = await query<CalendarEvent>(sql, params);
  return rows;
}

export async function deleteCalendarEventsOutsideRange(
  emailAccountId: string,
  fromDate: Date,
  toDate: Date
): Promise<void> {
  await query(
    `DELETE FROM ${TABLE} WHERE email_account_id = $1 AND (start_time < $2 OR end_time > $3)`,
    [emailAccountId, fromDate, toDate]
  );
}
