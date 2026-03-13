import { query } from '../client';
import type { User, UserInsert } from '../models/user';

const TABLE = 'users';

export async function findUserByEmail(email: string): Promise<User | null> {
  const { rows } = await query<User>(
    `SELECT id, email, created_at, updated_at FROM ${TABLE} WHERE email = $1`,
    [email]
  );
  return rows[0] ?? null;
}

export async function findUserById(id: string): Promise<User | null> {
  const { rows } = await query<User>(
    `SELECT id, email, created_at, updated_at FROM ${TABLE} WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function createUser(data: UserInsert): Promise<User> {
  const { rows } = await query<User>(
    `INSERT INTO ${TABLE} (email) VALUES ($1)
     RETURNING id, email, created_at, updated_at`,
    [data.email]
  );
  return rows[0]!;
}

export async function upsertUserByEmail(email: string): Promise<User> {
  const existing = await findUserByEmail(email);
  if (existing) return existing;
  return createUser({ email });
}
