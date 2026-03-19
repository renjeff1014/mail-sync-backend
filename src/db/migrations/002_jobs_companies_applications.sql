-- Companies, Jobs, and Applications
-- Run after 001_initial.sql

-- Companies
CREATE TABLE IF NOT EXISTS companies (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name      TEXT NOT NULL,
  company_size      TEXT,
  company_desc      TEXT,
  company_categories TEXT,
  company_location  TEXT,
  company_url       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Jobs (reference company)
CREATE TABLE IF NOT EXISTS jobs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_title             TEXT NOT NULL,
  job_nlp_title         TEXT,
  job_seniority         TEXT,
  job_location          TEXT,
  is_remote              BOOLEAN NOT NULL DEFAULT false,
  work_model             TEXT,
  publish_time           TEXT,
  publish_time_desc      TEXT,
  salary_desc            TEXT,
  min_salary             NUMERIC,
  max_salary             NUMERIC,
  employment_type        TEXT,
  job_summary            TEXT,
  original_url           TEXT,
  apply_link             TEXT,
  is_company_site_link   BOOLEAN DEFAULT true,
  jd_logo                TEXT,
  company_id             UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jobs_company_id ON jobs(company_id);

-- Applications (user's application per job, with conversation logs)
CREATE TABLE IF NOT EXISTS applications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id      UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  logs        JSONB NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_job_id ON applications(job_id);
