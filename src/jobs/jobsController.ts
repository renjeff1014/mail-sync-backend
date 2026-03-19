import type { Request, Response } from 'express';
import { getSessionUser } from '../auth/session';
import { listJobs as listJobsFromDb, findJobById } from '../db/repositories/jobRepository';
import { findCompanyById } from '../db/repositories/companyRepository';
import { findApplicationByUserAndJob } from '../db/repositories/applicationRepository';
import { findEmailAccountById } from '../db/repositories/emailAccountRepository';
import { findEmailsByAccountId } from '../db/repositories/emailRepository';
import { scoreEmailJobMatch, type JobForMatching, type EmailMessage, type MatchResult } from '../matching/jobEmailMatcher';
import { classifyRelevantEmailType } from '../email-classifier/classifier';
import type { ApplicationEmailType } from '../email-classifier/types';
import { APPLICATION_EMAIL_TYPES } from '../email-classifier/types';
import type { Email } from '../db/models/email';

/** Parse "Name <email>" or "email" into { fromEmail, fromName }. */
function parseFromHeader(from: string | null): { fromEmail: string; fromName: string } {
  if (!from || !from.trim()) return { fromEmail: '', fromName: '' };
  const match = from.match(/^(.+?)\s*<([^>]+)>$/);
  if (match) {
    return { fromEmail: match[2].trim().toLowerCase(), fromName: match[1].trim().replace(/^["']|["']$/g, '') };
  }
  if (from.includes('@')) return { fromEmail: from.trim().toLowerCase(), fromName: '' };
  return { fromEmail: '', fromName: from.trim() };
}

/** Build JobForMatching from DB job + company for the matcher. */
function toJobForMatching(
  job: Awaited<ReturnType<typeof findJobById>>,
  company: Awaited<ReturnType<typeof findCompanyById>>
): JobForMatching {
  if (!job) throw new Error('Job required');
  return {
    impId: job.id,
    jobResult: {
      jobId: job.id,
      jobTitle: job.job_title,
      jobNlpTitle: job.job_nlp_title,
      originalUrl: job.original_url,
      applyLink: job.apply_link,
      publishTime: job.publish_time ? String(job.publish_time) : null,
    },
    companyResult: {
      companyId: company?.id ?? '',
      companyName: company?.company_name ?? undefined,
      companyURL: company?.company_url ?? undefined,
    },
  };
}

/** Convert DB Email to EmailMessage for matcher. */
function toEmailMessage(row: Email): EmailMessage {
  const { fromEmail, fromName } = parseFromHeader(row.from);
  return {
    messageId: row.message_id,
    threadId: row.thread_id,
    fromEmail: fromEmail || undefined,
    fromName: fromName || undefined,
    subject: row.subject,
    bodyText: row.body_text,
    snippet: row.snippet,
    receivedAt: row.received_at,
    urls: [], // DB does not store extracted URLs; matcher can still use body/snippet/domain
  };
}

/**
 * GET /api/jobs - List jobs from DB with company (logo, name, title).
 */
export async function listJobs(_req: Request, res: Response): Promise<void> {
  const jobs = await listJobsFromDb();
  const withCompany = await Promise.all(
    jobs.map(async (job) => {
      const company = await findCompanyById(job.company_id);
      return {
        id: job.id,
        impId: job.id,
        jobResult: {
          jobId: job.id,
          jobTitle: job.job_title,
          jdLogo: job.jd_logo ?? undefined,
          jobSummary: job.job_summary ?? undefined,
        },
        companyResult: {
          companyId: company?.id,
          companyName: company?.company_name ?? '',
        },
      };
    })
  );
  res.json({ jobs: withCompany });
}

/**
 * GET /api/jobs/:jobId/application - Get application for current user for this job (for message/conversation view).
 */
export async function getApplication(req: Request, res: Response): Promise<void> {
  const user = getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const jobId = String(req.params.jobId);
  if (!jobId) {
    res.status(400).json({ error: 'jobId required' });
    return;
  }
  const job = await findJobById(jobId);
  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }
  const company = await findCompanyById(job.company_id);
  const application = await findApplicationByUserAndJob(user.id, jobId);
  res.json({
    job: {
      id: job.id,
      jobTitle: job.job_title,
      jobSummary: job.job_summary,
      jobSeniority: job.job_seniority,
      jobLocation: job.job_location,
      salaryDesc: job.salary_desc,
      employmentType: job.employment_type,
      jdLogo: job.jd_logo,
      applyLink: job.apply_link,
      originalUrl: job.original_url,
    },
    company: company
      ? {
          id: company.id,
          companyName: company.company_name,
          companyDesc: company.company_desc,
          companyLocation: company.company_location,
          companyUrl: company.company_url,
        }
      : null,
    application: application
      ? { id: application.id, jobId: application.job_id, logs: application.logs }
      : null,
  });
}

/** Minimum score to include an email as "related" to the job. */
const RELATED_EMAIL_MIN_SCORE = 0.1;

/** Max emails to scan per account (avoid slow response). */
const RELATED_EMAIL_SCAN_LIMIT = 500;

/**
 * GET /api/jobs/:jobId/related-emails - Find user's emails that match this job (jobEmailMatcher).
 * Returns emails sorted by match score, with match result and label for batching in the UI.
 */
export async function getRelatedEmails(req: Request, res: Response): Promise<void> {
  const user = getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const jobId = String(req.params.jobId);
  if (!jobId) {
    res.status(400).json({ error: 'jobId required' });
    return;
  }

  const account = await findEmailAccountById(user.emailAccountId);
  if (!account) {
    const emptyByType = APPLICATION_EMAIL_TYPES.reduce((acc, t) => ({ ...acc, [t]: [] }), {} as Record<ApplicationEmailType, unknown[]>);
    res.json({ relatedEmails: [], byLabel: { HIGH: [], MEDIUM: [], LOW: [], AMBIGUOUS: [] }, byType: emptyByType });
    return;
  }

  const job = await findJobById(jobId);
  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }
  const company = await findCompanyById(job.company_id);
  const jobForMatching = toJobForMatching(job, company);

  const emails = await findEmailsByAccountId(account.id, RELATED_EMAIL_SCAN_LIMIT, 0);
  const withScores: Array<{ email: Email; result: MatchResult }> = [];
  for (const emailRow of emails) {
    const msg = toEmailMessage(emailRow);
    const result = scoreEmailJobMatch(msg, jobForMatching);
    if (result.finalScore >= RELATED_EMAIL_MIN_SCORE) {
      withScores.push({ email: emailRow, result });
    }
  }
  withScores.sort((a, b) => b.result.finalScore - a.result.finalScore);

  const linkedJob = {
    company: company?.company_name ?? undefined,
    title: job.job_title ?? undefined,
  };

  const byLabel: Record<string, Array<{ id: string; from: string | null; subject: string | null; received_at: string; finalScore: number; label: string; reasons: string[]; emailType: ApplicationEmailType; statusSuggestion?: string }>> = {
    HIGH: [],
    MEDIUM: [],
    LOW: [],
    AMBIGUOUS: [],
  };
  const byType = APPLICATION_EMAIL_TYPES.reduce((acc, t) => ({ ...acc, [t]: [] as typeof byLabel.HIGH }), {} as Record<ApplicationEmailType, typeof byLabel.HIGH>);

  const relatedEmails = withScores.map(({ email: emailRow, result }) => {
    const msg = toEmailMessage(emailRow);
    const classifierMsg = {
      messageId: msg.messageId,
      threadId: msg.threadId ?? undefined,
      fromEmail: msg.fromEmail ?? undefined,
      fromName: msg.fromName ?? undefined,
      subject: msg.subject ?? undefined,
      bodyText: msg.bodyText ?? undefined,
      snippet: msg.snippet ?? undefined,
      receivedAt: msg.receivedAt ?? undefined,
      urls: msg.urls,
    };
    const classification = classifyRelevantEmailType(classifierMsg, { linkedJob });
    console.log('classifierMsg', classifierMsg);
    console.log('classification', classification);
    console.log('--------------------------------');
    const item = {
      id: emailRow.id,
      from: emailRow.from,
      subject: emailRow.subject,
      received_at: typeof emailRow.received_at === 'object' && 'toISOString' in emailRow.received_at
        ? (emailRow.received_at as Date).toISOString()
        : String(emailRow.received_at),
      finalScore: result.finalScore,
      label: result.label,
      reasons: result.reasons,
      emailType: classification.type,
      statusSuggestion: classification.statusSuggestion,
    };
    if (byLabel[result.label]) byLabel[result.label].push(item);
    if (byType[classification.type]) byType[classification.type].push(item);
    return item;
  });

  res.json({ relatedEmails, byLabel, byType });
}
