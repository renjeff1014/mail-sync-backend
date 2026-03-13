export interface CalendarEvent {
  id: string;
  email_account_id: string;
  event_id: string;
  title: string | null;
  start_time: Date;
  end_time: Date;
  organizer: string | null;
  attendees: string[] | null;
  meeting_link: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CalendarEventInsert {
  email_account_id: string;
  event_id: string;
  title?: string | null;
  start_time: Date;
  end_time: Date;
  organizer?: string | null;
  attendees?: string[] | null;
  meeting_link?: string | null;
}

export interface CalendarEventUpdate {
  title?: string | null;
  start_time?: Date;
  end_time?: Date;
  organizer?: string | null;
  attendees?: string[] | null;
  meeting_link?: string | null;
  updated_at?: Date;
}
