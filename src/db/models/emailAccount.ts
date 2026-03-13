export interface EmailAccount {
  id: string;
  user_id: string;
  email: string;
  access_token: string;
  refresh_token: string | null;
  expiry_date: Date;
  created_at: Date;
  updated_at: Date;
  last_gmail_sync_at?: Date | null;
  last_calendar_sync_at?: Date | null;
}

export interface EmailAccountInsert {
  user_id: string;
  email: string;
  access_token: string;
  refresh_token?: string | null;
  expiry_date: Date;
}

export interface EmailAccountUpdate {
  access_token?: string;
  refresh_token?: string | null;
  expiry_date?: Date;
  last_gmail_sync_at?: Date | null;
  last_calendar_sync_at?: Date | null;
  updated_at?: Date;
}
