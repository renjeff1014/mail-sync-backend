import { google } from 'googleapis';
import type { EmailAccount } from '../db/models/emailAccount';
import { updateEmailAccount } from '../db/repositories/emailAccountRepository';
import { getGoogleAuthConfig } from '../auth/config';

const CALENDAR_SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

/**
 * Get a Calendar API client authenticated with the given account's tokens.
 * Refreshes the access token if expired and persists new tokens to DB.
 */
export async function getCalendarClient(account: EmailAccount): Promise<{
  calendar: ReturnType<typeof google.calendar>;
  account: EmailAccount;
}> {
  const { clientID, clientSecret } = getGoogleAuthConfig();
  const oauth2Client = new google.auth.OAuth2(clientID, clientSecret);
  oauth2Client.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token ?? undefined,
    expiry_date: account.expiry_date.getTime(),
  });

  const now = Date.now();
  const expiry = account.expiry_date.getTime();
  if (!account.refresh_token || expiry - now < 5 * 60 * 1000) {
    const { credentials } = await oauth2Client.refreshAccessToken();
    const expiryDate = credentials.expiry_date
      ? new Date(credentials.expiry_date)
      : new Date(now + 60 * 60 * 1000);
    const updated = await updateEmailAccount(account.id, {
      access_token: credentials.access_token!,
      refresh_token: credentials.refresh_token ?? account.refresh_token,
      expiry_date: expiryDate,
    });
    if (updated) {
      account = updated;
    }
    oauth2Client.setCredentials(credentials);
  }

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  return { calendar, account };
}
