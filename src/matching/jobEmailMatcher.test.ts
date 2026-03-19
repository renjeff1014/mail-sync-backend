/**
 * Unit tests for jobEmailMatcher.
 * Run with: npx ts-node src/matching/jobEmailMatcher.test.ts
 */

import assert from "node:assert";
import {
  buildJobFeatures,
  buildEmailFeatures,
  scoreEmailJobMatch,
  rankEmailAgainstJobs,
  normalizeText,
  normalizeCompanyName,
  tokenize,
  extractDomain,
  extractRootDomain,
  buildCompanyAliases,
  buildTitleAliases,
  type EmailMessage,
  type JobForMatching,
  type MatchHistory,
} from "./jobEmailMatcher";

// ---------------------------------------------------------------------------
// Helpers: build minimal job/email for tests
// ---------------------------------------------------------------------------

function job(overrides: Partial<JobForMatching["jobResult"] & JobForMatching["companyResult"]> & { jobId: string }): JobForMatching {
  return {
    impId: "imp_1",
    jobResult: {
      jobId: overrides.jobId ?? "job_1",
      jobTitle: overrides.jobTitle ?? null,
      jobNlpTitle: overrides.jobNlpTitle ?? null,
      applyLink: overrides.applyLink ?? null,
      originalUrl: overrides.originalUrl ?? null,
      publishTime: overrides.publishTime ?? null,
      jobRecruiter: overrides.jobRecruiter ?? null,
      socialConnections: overrides.socialConnections ?? null,
    },
    companyResult: {
      companyId: overrides.companyId ?? "co_1",
      companyName: overrides.companyName ?? null,
      companyURL: overrides.companyURL ?? null,
    },
  };
}

function email(overrides: Partial<EmailMessage>): EmailMessage {
  return {
    messageId: "msg_1",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Normalization tests
// ---------------------------------------------------------------------------

function testNormalization() {
  assert.strictEqual(normalizeText("  Hello   World  "), "hello world");
  assert.strictEqual(normalizeCompanyName("General Mills Inc."), "general mills");
  assert.deepStrictEqual(tokenize("Sr. Data Scientist"), ["sr.", "data", "scientist"]);
  assert.strictEqual(extractDomain("user@careers.generalmills.com", true), "careers.generalmills.com");
  assert.strictEqual(extractDomain("https://careers.generalmills.com/jobs/123"), "careers.generalmills.com");
  assert.strictEqual(extractRootDomain("www.careers.generalmills.com"), "generalmills.com");
  assert.deepStrictEqual(buildCompanyAliases("General Mills"), ["general mills", "generalmills"]);
  const titleAliases = buildTitleAliases("Sr. Data Scientist - Agentic AI", "Senior Data Scientist - Agentic AI");
  assert.ok(titleAliases.length >= 2);
  assert.ok(titleAliases.some((a) => a.includes("senior") || a.includes("sr")));
  console.log("  normalization: ok");
}

// ---------------------------------------------------------------------------
// Test 1: Strong match
// - Sender from careers.generalmills.com
// - Subject contains exact title
// - Body says thank you for applying to General Mills
// - Includes careers.generalmills.com link
// ---------------------------------------------------------------------------

function testStrongMatch() {
  const j = job({
    jobId: "gm_ds_1",
    jobTitle: "Senior Data Scientist",
    jobNlpTitle: "Senior Data Scientist",
    companyName: "General Mills",
    companyURL: "https://www.generalmills.com",
    applyLink: "https://careers.generalmills.com/job/senior-data-scientist",
    originalUrl: "https://careers.generalmills.com/job/senior-data-scientist",
    publishTime: "2026-02-01 12:00:00",
  });

  const e = email({
    fromEmail: "recruiting@careers.generalmills.com",
    subject: "Your application for Senior Data Scientist at General Mills",
    bodyText: "Thank you for applying to General Mills. We have received your application for the Senior Data Scientist role.",
    snippet: "Thank you for applying to General Mills.",
    urls: ["https://careers.generalmills.com/job/senior-data-scientist", "https://careers.generalmills.com/dashboard"],
    receivedAt: "2026-03-01T10:00:00Z",
  });

  const result = scoreEmailJobMatch(e, j);
  assert.ok(result.finalScore >= 0.85, `expected high score, got ${result.finalScore}`);
  assert.ok(result.label === "HIGH" || result.label === "MEDIUM", `expected HIGH or MEDIUM, got ${result.label}`);
  assert.ok(result.matched, "expected matched true");
  assert.ok(result.reasons.length > 0, "expected reasons");
  assert.ok((result.breakdown.companyScore + result.breakdown.titleScore + result.breakdown.participantScore) > 0);
  console.log("  strong match: score =", result.finalScore.toFixed(3), "label =", result.label);
}

// ---------------------------------------------------------------------------
// Test 2: Medium match
// - Sender from recruiter.generalmills.com
// - Subject "Regarding your application"
// - No exact title but company mentioned
// ---------------------------------------------------------------------------

function testMediumMatch() {
  const j = job({
    jobId: "gm_eng_1",
    jobTitle: "Senior Full-Stack Engineer",
    companyName: "General Mills",
    companyURL: "https://www.generalmills.com",
    applyLink: "https://careers.generalmills.com/job/senior-full-stack-engineer",
    publishTime: "2026-02-15 12:00:00",
  });

  const e = email({
    fromEmail: "hr@recruiter.generalmills.com",
    subject: "Regarding your application",
    bodyText: "Hi, we wanted to follow up on your application at General Mills. Our hiring team is reviewing candidates.",
    snippet: "Regarding your application at General Mills",
    receivedAt: "2026-03-10T14:00:00Z",
  });

  const result = scoreEmailJobMatch(e, j);
  assert.ok(result.finalScore >= 0.3 && result.finalScore < 0.95, `expected medium range, got ${result.finalScore}`);
  assert.ok(result.breakdown.companyScore > 0, "company should match");
  assert.ok(result.breakdown.participantScore > 0, "participant (domain) should match");
  console.log("  medium match: score =", result.finalScore.toFixed(3), "label =", result.label);
}

// ---------------------------------------------------------------------------
// Test 3: Weak / non-match
// - Sender from anothercompany.com
// - Body references another company and another role
// ---------------------------------------------------------------------------

function testWeakNonMatch() {
  const j = job({
    jobId: "gm_1",
    jobTitle: "Senior Data Scientist",
    companyName: "General Mills",
    applyLink: "https://careers.generalmills.com/job/123",
    publishTime: "2026-02-01 12:00:00",
  });

  const e = email({
    fromEmail: "recruiter@acme.com",
    subject: "Your application at Acme Corp",
    bodyText: "Thank you for applying to Acme Corp for the Product Manager role. We will get back to you soon.",
    snippet: "Acme Corp Product Manager application",
    receivedAt: "2026-03-01T10:00:00Z",
  });

  const result = scoreEmailJobMatch(e, j);
  assert.ok(result.finalScore < 0.5, `expected low score, got ${result.finalScore}`);
  assert.strictEqual(result.label, "LOW");
  assert.ok(!result.matched, "expected matched false");
  console.log("  weak/non-match: score =", result.finalScore.toFixed(3), "label =", result.label);
}

// ---------------------------------------------------------------------------
// Test 4: Ambiguous match (two jobs same company, similar titles; email only says "Regarding your application at General Mills")
// ---------------------------------------------------------------------------

function testAmbiguousMatch() {
  const job1 = job({
    jobId: "gm_ds",
    jobTitle: "Senior Data Scientist",
    companyName: "General Mills",
    applyLink: "https://careers.generalmills.com/job/ds",
    publishTime: "2026-02-01 12:00:00",
  });
  const job2 = job({
    jobId: "gm_ml",
    jobTitle: "Senior ML Engineer",
    companyName: "General Mills",
    applyLink: "https://careers.generalmills.com/job/ml",
    publishTime: "2026-02-05 12:00:00",
  });

  const e = email({
    fromEmail: "hr@careers.generalmills.com",
    subject: "Regarding your application at General Mills",
    bodyText: "We have received your application at General Mills. Our team will review and be in touch.",
    snippet: "Regarding your application at General Mills",
    receivedAt: "2026-03-05T10:00:00Z",
  });

  const ranked = rankEmailAgainstJobs(e, [job1, job2]);
  assert.strictEqual(ranked.length, 2);
  const top = ranked[0];
  const second = ranked[1];
  assert.ok(top.result.finalScore >= second.result.finalScore);
  if (top.result.finalScore - second.result.finalScore < 0.1) {
    assert.strictEqual(top.result.label, "AMBIGUOUS");
  }
  console.log("  ambiguous: top score =", top.result.finalScore.toFixed(3), "second =", second.result.finalScore.toFixed(3), "label =", top.result.label);
}

// ---------------------------------------------------------------------------
// History: thread linked to same job => high threadScore and boost
// ---------------------------------------------------------------------------

function testHistoryThreadLinked() {
  const j = job({
    jobId: "job_abc",
    jobTitle: "Software Engineer",
    companyName: "Tech Co",
    applyLink: "https://techco.com/careers/123",
    publishTime: "2026-02-01 12:00:00",
  });

  const e = email({
    threadId: "thread_xyz",
    fromEmail: "recruiting@techco.com",
    subject: "Next steps - Software Engineer",
    bodyText: "Thank you for applying to Tech Co for the Software Engineer role.",
    receivedAt: "2026-03-01T10:00:00Z",
  });

  const history: MatchHistory = {
    threadToJobId: { thread_xyz: "job_abc" },
    knownJobThreadIds: { job_abc: ["thread_xyz"] },
  };

  const result = scoreEmailJobMatch(e, j, history);
  assert.strictEqual(result.breakdown.threadScore, 1);
  assert.ok(result.breakdown.boosts >= 0.2, "expected thread boost");
  assert.ok(result.finalScore >= 0.5);
  console.log("  history thread linked: score =", result.finalScore.toFixed(3));
}

// ---------------------------------------------------------------------------
// buildJobFeatures / buildEmailFeatures
// ---------------------------------------------------------------------------

function testFeatureBuilders() {
  const j = job({
    jobId: "j1",
    jobTitle: "Sr. Engineer",
    companyName: "Acme Inc.",
    companyURL: "https://acme.com",
    applyLink: "https://jobs.acme.com/apply/1",
  });
  const jf = buildJobFeatures(j);
  assert.strictEqual(jf.jobId, "j1");
  assert.ok(jf.companyAliases.length >= 1);
  assert.ok(jf.titleAliases.length >= 1);
  assert.ok(jf.applyDomains.length >= 1);

  const e = email({
    fromEmail: "a@b.com",
    subject: "Hello",
    bodyText: "World",
    urls: ["https://example.com/x"],
  });
  const ef = buildEmailFeatures(e);
  assert.strictEqual(ef.senderDomain, "b.com");
  assert.strictEqual(ef.extractedDomains.length, 1);
  assert.ok(ef.mergedSearchableText.includes("hello"));
  console.log("  feature builders: ok");
}

// ---------------------------------------------------------------------------
// Run all
// ---------------------------------------------------------------------------

function run() {
  console.log("jobEmailMatcher tests");
  testNormalization();
  testFeatureBuilders();
  testStrongMatch();
  testMediumMatch();
  testWeakNonMatch();
  testAmbiguousMatch();
  testHistoryThreadLinked();
  console.log("All tests passed.");
}

run();
