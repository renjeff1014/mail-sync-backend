/**
 * Example usage of jobEmailMatcher.
 * Run with: npx ts-node src/matching/exampleUsage.ts
 */

import {
  scoreEmailJobMatch,
  rankEmailAgainstJobs,
  type EmailMessage,
  type JobForMatching,
  type MatchHistory,
} from "./jobEmailMatcher";

// Example: single email vs single job
const email: EmailMessage = {
  messageId: "msg_001",
  threadId: "thread_001",
  fromEmail: "recruiting@careers.example.com",
  fromName: "Jane Recruiter",
  subject: "Next steps – Senior Engineer at Example Corp",
  bodyText: "Thank you for applying to Example Corp for the Senior Engineer role. We'd like to schedule an interview.",
  snippet: "Thank you for applying to Example Corp",
  receivedAt: new Date(),
  urls: ["https://careers.example.com/jobs/123"],
};

const job: JobForMatching = {
  impId: "imp_001",
  jobResult: {
    jobId: "job_123",
    jobTitle: "Senior Engineer",
    jobNlpTitle: "Senior Engineer",
    applyLink: "https://careers.example.com/jobs/123",
    originalUrl: "https://careers.example.com/jobs/123",
    publishTime: "2026-02-20 10:00:00",
  },
  companyResult: {
    companyId: "co_001",
    companyName: "Example Corp",
    companyURL: "https://www.example.com",
  },
};

const result = scoreEmailJobMatch(email, job);
console.log("Single match result:", {
  jobId: result.jobId,
  finalScore: result.finalScore,
  label: result.label,
  matched: result.matched,
  reasons: result.reasons,
});
console.log("Breakdown:", result.breakdown);

// Example: rank one email against multiple jobs (e.g. all saved applications)
const jobs: JobForMatching[] = [job, { ...job, impId: "imp_002", jobResult: { ...job.jobResult, jobId: "job_456", jobTitle: "Staff Engineer" }, companyResult: job.companyResult }];
const history: MatchHistory = {
  threadToJobId: {},
  knownJobThreadIds: {},
  appliedAtByJobId: { job_123: "2026-02-25T12:00:00Z" },
};

const ranked = rankEmailAgainstJobs(email, jobs, history);
console.log("\nRanked results:");
ranked.forEach((r, i) => {
  console.log(`  ${i + 1}. ${r.jobId}: ${r.result.finalScore.toFixed(3)} (${r.result.label})`);
});
