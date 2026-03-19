import { query } from '../client';
import type { Application, ApplicationInsert, ApplicationLogEntry } from '../models/application';

const TABLE = 'applications';

export async function upsertApplication(data: ApplicationInsert): Promise<Application> {
  const logs = data.logs ?? [];
  const { rows } = await query<Application>(
    `INSERT INTO ${TABLE} (user_id, job_id, logs)
     VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (user_id, job_id) DO UPDATE SET logs = EXCLUDED.logs, updated_at = now()
     RETURNING id, user_id, job_id, logs, created_at, updated_at`,
    [data.user_id, data.job_id, JSON.stringify(logs)]
  );
  const row = rows[0]!;
  return { ...row, logs: (row.logs as ApplicationLogEntry[]) ?? [] };
}

export async function findApplicationByUserAndJob(
  userId: string,
  jobId: string
): Promise<Application | null> {
  const { rows } = await query<Application>(
    `SELECT id, user_id, job_id, logs, created_at, updated_at FROM ${TABLE} WHERE user_id = $1 AND job_id = $2`,
    [userId, jobId]
  );
  const row = rows[0];
  if (!row) return null;
  return { ...row, logs: (row.logs as ApplicationLogEntry[]) ?? [] };
}

export async function findApplicationById(id: string): Promise<Application | null> {
  const { rows } = await query<Application>(
    `SELECT id, user_id, job_id, logs, created_at, updated_at FROM ${TABLE} WHERE id = $1`,
    [id]
  );
  const row = rows[0];
  if (!row) return null;
  return { ...row, logs: (row.logs as ApplicationLogEntry[]) ?? [] };
}
