import 'dotenv/config';
import { getPool } from './client';
import { createCompany, findCompanyByName } from './repositories/companyRepository';
import { createJob, findJobByTitleAndCompany } from './repositories/jobRepository';
import { upsertApplication } from './repositories/applicationRepository';
import { demoJobs } from '../jobs/demoJobs';

async function seed() {
  const pool = getPool();

  // Ensure we have at least one user for demo application
  const { rows: userRows } = await pool.query<{ id: string }>(
    'SELECT id FROM users ORDER BY created_at ASC LIMIT 1'
  );
  const demoUserId = userRows[0]?.id;
  if (!demoUserId) {
    console.log('No user in DB; skipping application seed. Sign in once to create a user.');
  }

  for (const item of demoJobs) {
    const j = item.jobResult;
    const c = item.companyResult;

    let company = await findCompanyByName(c.companyName);
    if (!company) {
      company = await createCompany({
        company_name: c.companyName,
        company_size: c.companySize ?? null,
        company_desc: c.companyDesc ?? null,
        company_categories: c.companyCategories ?? null,
        company_location: c.companyLocation ?? null,
        company_url: c.companyURL ?? null,
      });
      console.log('Created company:', company.company_name);
    }

    let job = await findJobByTitleAndCompany(j.jobTitle, company.id);
    if (!job) {
      job = await createJob({
        job_title: j.jobTitle,
        job_nlp_title: j.jobNlpTitle ?? null,
        job_seniority: j.jobSeniority ?? null,
        job_location: j.jobLocation ?? null,
        is_remote: j.isRemote ?? false,
        work_model: j.workModel ?? null,
        publish_time: j.publishTime ?? null,
        publish_time_desc: j.publishTimeDesc ?? null,
        salary_desc: j.salaryDesc ?? null,
        min_salary: j.minSalary ?? null,
        max_salary: j.maxSalary ?? null,
        employment_type: j.employmentType ?? null,
        job_summary: j.jobSummary ?? null,
        original_url: j.originalUrl ?? null,
        apply_link: j.applyLink ?? null,
        is_company_site_link: j.isCompanySiteLink ?? true,
        jd_logo: j.jdLogo ?? null,
        company_id: company.id,
      });
      console.log('Created job:', job.job_title);
    }

    if (demoUserId) {
      await upsertApplication({
        user_id: demoUserId,
        job_id: job.id,
        logs: [],
      });
      console.log('Upserted application for user', demoUserId, 'job', job.id);
    }
  }

  await pool.end();
  console.log('Seed done.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
