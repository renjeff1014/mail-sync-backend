-- Job Application Tracker - Initial schema
-- Run with: psql $DATABASE_URL -f migrations/001_initial.sql
-- Or use: npm run db:migrate

-- Users (linked to our app; can have multiple email accounts)
CREATE TABLE IF NOT EXISTS users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email             TEXT NOT NULL UNIQUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Email accounts (one per connected Google account)
CREATE TABLE IF NOT EXISTS email_accounts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email             TEXT NOT NULL,
  access_token      TEXT NOT NULL,
  refresh_token     TEXT,
  expiry_date       TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, email)
);

CREATE INDEX IF NOT EXISTS idx_email_accounts_user_id ON email_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_email_accounts_email ON email_accounts(email);

-- Synced emails from Gmail
CREATE TABLE IF NOT EXISTS emails (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_account_id  UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  message_id        TEXT NOT NULL,
  thread_id         TEXT NOT NULL,
  subject           TEXT,
  "from"            TEXT,
  "to"              TEXT,
  snippet           TEXT,
  body_text         TEXT,
  body_html         TEXT,
  received_at       TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(email_account_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_emails_account ON emails(email_account_id);
CREATE INDEX IF NOT EXISTS idx_emails_received_at ON emails(received_at);
CREATE INDEX IF NOT EXISTS idx_emails_message_id ON emails(message_id);

-- Calendar events (upcoming 60 days)
CREATE TABLE IF NOT EXISTS calendar_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_account_id  UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  event_id          TEXT NOT NULL,
  title             TEXT,
  start_time        TIMESTAMPTZ NOT NULL,
  end_time          TIMESTAMPTZ NOT NULL,
  organizer         TEXT,
  attendees         TEXT[],
  meeting_link      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(email_account_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_account ON calendar_events(email_account_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start ON calendar_events(start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_event_id ON calendar_events(event_id);

-- Optional: track last sync per account
ALTER TABLE email_accounts
  ADD COLUMN IF NOT EXISTS last_gmail_sync_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_calendar_sync_at TIMESTAMPTZ;
