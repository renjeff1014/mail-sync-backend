import { query } from '../client';
import type { Job, JobInsert } from '../models/job';

const TABLE = 'jobs';

const COLS =
  'id, job_title, job_nlp_title, job_seniority, job_location, is_remote, work_model, publish_time, publish_time_desc, salary_desc, min_salary, max_salary, employment_type, job_summary, original_url, apply_link, is_company_site_link, jd_logo, company_id, created_at, updated_at';

export async function createJob(data: JobInsert): Promise<Job> {
  const { rows } = await query<Job>(
    `INSERT INTO ${TABLE} (job_title, job_nlp_title, job_seniority, job_location, is_remote, work_model, publish_time, publish_time_desc, salary_desc, min_salary, max_salary, employment_type, job_summary, original_url, apply_link, is_company_site_link, jd_logo, company_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
     RETURNING ${COLS}`,
    [
      data.job_title,
      data.job_nlp_title ?? null,
      data.job_seniority ?? null,
      data.job_location ?? null,
      data.is_remote ?? false,
      data.work_model ?? null,
      data.publish_time ?? null,
      data.publish_time_desc ?? null,
      data.salary_desc ?? null,
      data.min_salary ?? null,
      data.max_salary ?? null,
      data.employment_type ?? null,
      data.job_summary ?? null,
      data.original_url ?? null,
      data.apply_link ?? null,
      data.is_company_site_link ?? true,
      data.jd_logo ?? null,
      data.company_id,
    ]
  );
  return rows[0]!;
}

export async function findJobById(id: string): Promise<Job | null> {
  const { rows } = await query<Job>(`SELECT ${COLS} FROM ${TABLE} WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function listJobs(): Promise<Job[]> {
  const { rows } = await query<Job>(`SELECT ${COLS} FROM ${TABLE} ORDER BY created_at DESC`);
  return rows;
}

export async function findJobByTitleAndCompany(
  jobTitle: string,
  companyId: string
): Promise<Job | null> {
  const { rows } = await query<Job>(`SELECT ${COLS} FROM ${TABLE} WHERE job_title = $1 AND company_id = $2`, [
    jobTitle,
    companyId,
  ]);
  return rows[0] ?? null;
}
