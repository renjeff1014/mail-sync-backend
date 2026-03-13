import type { EmailAccountInsert } from '../db/models/emailAccount';
import type { User } from '../db/models/user';
import {
  createEmailAccount,
  findEmailAccountByUserAndEmail,
  updateEmailAccount,
} from '../db/repositories/emailAccountRepository';
import { upsertUserByEmail } from '../db/repositories/userRepository';

export interface OAuthTokens {
  access_token: string;
  refresh_token?: string | null;
  expiry_date: Date;
}

export interface OAuthUserProfile {
  email: string;
  access_token: string;
  refresh_token?: string | null;
  expiry_date: Date;
}

/**
 * After successful Google OAuth: ensure user exists, then create or update email account with tokens.
 */
export async function upsertUserAndEmailAccount(profile: OAuthUserProfile): Promise<{
  user: User;
  emailAccountId: string;
}> {
  const user = await upsertUserByEmail(profile.email);

  const existing = await findEmailAccountByUserAndEmail(user.id, profile.email);
  const expiryDate = profile.expiry_date instanceof Date
    ? profile.expiry_date
    : new Date(profile.expiry_date);

  if (existing) {
    await updateEmailAccount(existing.id, {
      access_token: profile.access_token,
      refresh_token: profile.refresh_token ?? existing.refresh_token,
      expiry_date: expiryDate,
    });
    return { user, emailAccountId: existing.id };
  }

  const insert: EmailAccountInsert = {
    user_id: user.id,
    email: profile.email,
    access_token: profile.access_token,
    refresh_token: profile.refresh_token ?? null,
    expiry_date: expiryDate,
  };
  const created = await createEmailAccount(insert);
  return { user, emailAccountId: created.id };
}
