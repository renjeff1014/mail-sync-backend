# Job Application Tracker – Backend

Backend for the AI-powered Job Application Tracker. Handles Google OAuth, Gmail sync, and Google Calendar sync.

## Tech stack

- **Node.js** + **TypeScript**
- **Express** – HTTP API
- **PostgreSQL** – Users, email accounts, emails, calendar events
- **Redis** (BullMQ) – Prepared for queue (optional for sync jobs)
- **Google APIs** – Gmail API, Google Calendar API
- **Passport** + **passport-google-oauth20** – Google OAuth

## Project structure

```
backend/
├── package.json
├── tsconfig.json
├── .env.example
├── src/
│   ├── index.ts              # Entry point
│   ├── app.ts                # Express app, middleware, route mounting
│   ├── types/
│   │   └── passport.d.ts     # Express.User for session
│   ├── auth/
│   │   ├── config.ts         # Google OAuth scopes and config
│   │   ├── passport.ts       # Passport Google strategy, serialize/deserialize
│   │   ├── authService.ts    # Upsert user and email account after OAuth
│   │   ├── session.ts        # Session helpers (get/set/clear user)
│   │   ├── requireAuth.ts    # Middleware: require authenticated user
│   │   ├── authController.ts # getMe, logout
│   │   └── authRoutes.ts     # /api/auth/*
│   ├── gmail/
│   │   ├── gmailClient.ts    # OAuth client + token refresh for Gmail API
│   │   ├── gmailSyncService.ts # Fetch last 100 emails, parse, store
│   │   ├── gmailController.ts  # syncGmail, listEmails
│   │   └── gmailRoutes.ts      # /api/gmail/*
│   ├── calendar/
│   │   ├── calendarClient.ts    # OAuth client + token refresh for Calendar API
│   │   ├── calendarSyncService.ts # Fetch 60 days events, store
│   │   ├── calendarController.ts # syncCalendar, listEvents
│   │   └── calendarRoutes.ts    # /api/calendar/*
│   ├── db/
│   │   ├── client.ts         # pg Pool and query helper
│   │   ├── migrate.ts        # Run 001_initial.sql
│   │   ├── migrations/
│   │   │   └── 001_initial.sql # users, email_accounts, emails, calendar_events
│   │   ├── models/           # TypeScript interfaces
│   │   │   ├── user.ts
│   │   │   ├── emailAccount.ts
│   │   │   ├── email.ts
│   │   │   ├── calendarEvent.ts
│   │   │   └── index.ts
│   │   └── repositories/     # DB access
│   │       ├── userRepository.ts
│   │       ├── emailAccountRepository.ts
│   │       ├── emailRepository.ts
│   │       ├── calendarEventRepository.ts
│   │       └── index.ts
│   └── routes/
│       └── index.ts          # Re-exports auth, gmail, calendar routes
```

## Setup

1. **Copy env and configure**

   ```bash
   cp .env.example .env
   ```

   Set:

   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` (Google Cloud Console OAuth 2.0)
   - `SESSION_SECRET` (e.g. `openssl rand -base64 32`)
   - `DATABASE_URL` (PostgreSQL connection string)
   - `REDIS_URL` (optional, for BullMQ later)

2. **Database**

   ```bash
   npm run db:migrate
   ```

   Or run `src/db/migrations/001_initial.sql` manually with `psql`.

3. **Install and run**

   ```bash
   npm install
   npm run dev
   ```

   Server runs at `http://localhost:3000` (or `PORT` from `.env`).

## API overview

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/auth/google` | Start Google OAuth |
| GET | `/api/auth/google/callback` | OAuth callback (redirects after login) |
| GET | `/api/auth/me` | Current user (requires auth) |
| POST | `/api/auth/logout` | Clear session |
| POST | `/api/gmail/sync` | Trigger Gmail sync (last 100 emails) |
| GET | `/api/gmail/emails` | List synced emails |
| POST | `/api/calendar/sync` | Trigger Calendar sync (next 60 days) |
| GET | `/api/calendar/events` | List synced events (optional `?from=&to=`) |
| GET | `/health` | Health check |

## Google OAuth scopes

- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/calendar.readonly`
- `https://www.googleapis.com/auth/userinfo.email`

## Database schema (summary)

- **users** – `id`, `email`, `created_at`, `updated_at`
- **email_accounts** – `id`, `user_id`, `email`, `access_token`, `refresh_token`, `expiry_date`, `last_gmail_sync_at`, `last_calendar_sync_at`
- **emails** – `id`, `email_account_id`, `message_id`, `thread_id`, `subject`, `from`, `to`, `snippet`, `body_text`, `body_html`, `received_at`
- **calendar_events** – `id`, `email_account_id`, `event_id`, `title`, `start_time`, `end_time`, `organizer`, `attendees`, `meeting_link`
