export interface Job {
  id: string;
  job_title: string;
  job_nlp_title: string | null;
  job_seniority: string | null;
  job_location: string | null;
  is_remote: boolean;
  work_model: string | null;
  publish_time: string | null;
  publish_time_desc: string | null;
  salary_desc: string | null;
  min_salary: number | null;
  max_salary: number | null;
  employment_type: string | null;
  job_summary: string | null;
  original_url: string | null;
  apply_link: string | null;
  is_company_site_link: boolean;
  jd_logo: string | null;
  company_id: string;
  created_at: Date;
  updated_at: Date;
}

export interface JobInsert {
  job_title: string;
  job_nlp_title?: string | null;
  job_seniority?: string | null;
  job_location?: string | null;
  is_remote?: boolean;
  work_model?: string | null;
  publish_time?: string | null;
  publish_time_desc?: string | null;
  salary_desc?: string | null;
  min_salary?: number | null;
  max_salary?: number | null;
  employment_type?: string | null;
  job_summary?: string | null;
  original_url?: string | null;
  apply_link?: string | null;
  is_company_site_link?: boolean;
  jd_logo?: string | null;
  company_id: string;
}
