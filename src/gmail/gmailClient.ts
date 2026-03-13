import { google } from 'googleapis';
import type { EmailAccount } from '../db/models/emailAccount';
import { updateEmailAccount } from '../db/repositories/emailAccountRepository';
import { getGoogleAuthConfig } from '../auth/config';

const GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

/** Thrown when the account has no refresh token and the access token is expired or missing. */
export class NoRefreshTokenError extends Error {
  constructor() {
    super(
      'No refresh token. Please sign out and connect Gmail again (Connect Gmail / Sign in) to re-authorize.'
    );
    this.name = 'NoRefreshTokenError';
  }
}

/**
 * Get a Gmail API client authenticated with the given account's tokens.
 * Refreshes the access token if expired (when a refresh token exists) and persists new tokens to DB.
 */
export async function getGmailClient(account: EmailAccount): Promise<{
  gmail: ReturnType<typeof google.gmail>;
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
  const needsRefresh = expiry - now < 5 * 60 * 1000;

  if (needsRefresh) {
    if (!account.refresh_token || account.refresh_token.trim() === '') {
      throw new NoRefreshTokenError();
    }
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

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  return { gmail, account };
}
