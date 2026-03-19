/**
 * Email-to-Job matching module.
 * Given an email and a saved job (or list of jobs), computes a confidence score
 * that the email belongs to that job application. Supports optional match history.
 */

// ---------------------------------------------------------------------------
// Types (aligned with your job schema and email shape)
// ---------------------------------------------------------------------------

export type EmailMessage = {
  messageId: string;
  threadId?: string | null;
  fromEmail?: string | null;
  fromName?: string | null;
  toEmails?: string[];
  ccEmails?: string[];
  subject?: string | null;
  bodyText?: string | null;
  snippet?: string | null;
  receivedAt?: string | Date | null;
  urls?: string[];
};

/** Minimal job result shape we need for matching (subset of your full schema). */
export interface JobResultStub {
  jobId: string;
  jobTitle?: string | null;
  jobNlpTitle?: string | null;
  jobRecruiter?: string | null;
  jobRecruiterProfileUrl?: string | null;
  originalUrl?: string | null;
  applyLink?: string | null;
  publishTime?: string | null;
  socialConnections?: Array<{
    firstName?: string | null;
    fullName?: string | null;
    companyName?: string | null;
    jobTitle?: string | null;
    linkedinUrl?: string | null;
  }> | null;
}

export interface CompanyResultStub {
  companyId: string;
  companyName?: string | null;
  companyURL?: string | null;
}

/** Full job object as you store it (with jobResult + companyResult). */
export interface JobForMatching {
  impId: string;
  jobResult: JobResultStub;
  companyResult: CompanyResultStub;
}

export type MatchHistory = {
  knownJobThreadIds?: Record<string, string[]>;
  threadToJobId?: Record<string, string>;
  knownJobContactEmails?: Record<string, string[]>;
  knownJobContactNames?: Record<string, string[]>;
  appliedAtByJobId?: Record<string, string | Date>;
};

export type MatchLabel = "HIGH" | "MEDIUM" | "LOW" | "AMBIGUOUS";

export interface MatchResult {
  jobId: string;
  finalScore: number;
  label: MatchLabel;
  matched: boolean;
  reasons: string[];
  breakdown: {
    threadScore: number;
    participantScore: number;
    companyScore: number;
    titleScore: number;
    linkScore: number;
    timeScore: number;
    intentScore: number;
    boosts: number;
    penalties: number;
  };
  debug?: {
    matchedCompanyAliases: string[];
    matchedTitleAliases: string[];
    matchedDomains: string[];
    matchedUrls: string[];
    conflictingSignals: string[];
  };
}

/** Derived features from a job for matching. */
export interface JobFeatures {
  jobId: string;
  companyName: string;
  companyAliases: string[];
  companyDomains: string[];
  titleRaw: string;
  normalizedTitle: string;
  titleAliases: string[];
  recruiterNames: string[];
  recruiterEmails: string[];
  applyDomains: string[];
  atsDomains: string[];
  publishTime: string | null;
  applyLink: string | null;
  originalUrl: string | null;
}

/** Derived features from an email for matching. */
export interface EmailFeatures {
  senderEmail: string;
  senderDomain: string;
  senderName: string;
  normalizedSubject: string;
  normalizedBody: string;
  normalizedSnippet: string;
  mergedSearchableText: string;
  extractedUrls: string[];
  extractedDomains: string[];
  receivedAt: Date | null;
}

// ---------------------------------------------------------------------------
// Weights and thresholds (tunable)
// ---------------------------------------------------------------------------

const WEIGHTS = {
  thread: 0.3,
  participant: 0.22,
  company: 0.16,
  title: 0.18,
  link: 0.08,
  time: 0.04,
  intent: 0.02,
} as const;

const BOOST_THREAD_SAME_JOB = 0.2;
const BOOST_EXACT_LINK_IN_EMAIL = 0.15;
const BOOST_COMPANY_AND_TITLE_STRONG = 0.15;
const PENALTY_OTHER_COMPANY = 0.35;
const PENALTY_OTHER_ROLE = 0.2;
const PENALTY_THREAD_LINKED_DIFFERENT_JOB = 0.25;

const LABEL_HIGH = 0.9;
const LABEL_MEDIUM = 0.78;
const AMBIGUOUS_DELTA = 0.1;

// ---------------------------------------------------------------------------
// Normalization helpers (pure, testable)
// ---------------------------------------------------------------------------

/** Lowercase, trim, collapse whitespace to single space. */
export function normalizeText(s: string | null | undefined): string {
  if (s == null || s === "") return "";
  return String(s)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalize company name: lowercase, remove common suffixes for matching. */
export function normalizeCompanyName(s: string | null | undefined): string {
  const t = normalizeText(s);
  if (!t) return "";
  return t
    .replace(/\b(inc\.?|llc|l\.l\.c\.?|corp\.?|corporation|co\.?|ltd\.?|limited)\b\.?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Tokenize into words (letters/numbers), lowercase. */
export function tokenize(s: string | null | undefined): string[] {
  const t = normalizeText(s);
  if (!t) return [];
  return t.split(/\s+/).filter(Boolean);
}

/** Extract domain from email (part after @) or URL (hostname). */
export function extractDomain(input: string | null | undefined, isEmail = false): string {
  const s = (input ?? "").trim().toLowerCase();
  if (!s) return "";
  if (isEmail) {
    const at = s.indexOf("@");
    return at >= 0 ? s.slice(at + 1) : "";
  }
  try {
    const url = s.startsWith("http") ? s : `https://${s}`;
    const u = new URL(url);
    return u.hostname.toLowerCase();
  } catch {
    return "";
  }
}

/** Root domain: strip www and common subdomains for grouping. */
export function extractRootDomain(domain: string | null | undefined): string {
  const d = (domain ?? "").toLowerCase().trim();
  if (!d) return "";
  const withoutWww = d.replace(/^www\./, "");
  const parts = withoutWww.split(".");
  if (parts.length <= 2) return withoutWww;
  const knownSubdomains = ["mail", "careers", "jobs", "recruiter", "apply", "ats", "hr"];
  const first = parts[0];
  if (knownSubdomains.includes(first)) return parts.slice(1).join(".");
  return withoutWww;
}

export function safeArray<T>(x: T[] | null | undefined): T[] {
  return Array.isArray(x) ? x : [];
}

export function uniqueStrings(arr: (string | null | undefined)[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of arr) {
    const t = (s ?? "").trim().toLowerCase();
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Alias builders
// ---------------------------------------------------------------------------

const TITLE_ABBREV: Record<string, string[]> = {
  sr: ["senior", "sr", "sr."],
  senior: ["senior", "sr", "sr."],
  "sr.": ["senior", "sr", "sr."],
  jr: ["junior", "jr", "jr."],
  junior: ["junior", "jr", "jr."],
  staff: ["staff"],
  principal: ["principal", "principle"],
  lead: ["lead", "lead"],
  director: ["director"],
  manager: ["manager", "mgr"],
  mgr: ["manager", "mgr"],
  eng: ["engineer", "engineering", "eng"],
  engineer: ["engineer", "engineering", "eng"],
  dev: ["developer", "dev"],
  developer: ["developer", "dev"],
};

function expandTitleToken(token: string): string[] {
  const lower = token.toLowerCase();
  if (TITLE_ABBREV[lower]) return TITLE_ABBREV[lower];
  return [lower];
}

/** Build company aliases: normalized name + no-space variant. */
export function buildCompanyAliases(companyName: string | null | undefined): string[] {
  const normalized = normalizeCompanyName(companyName);
  if (!normalized) return [];
  const noSpace = normalized.replace(/\s+/g, "");
  return uniqueStrings([normalized, noSpace]);
}

/** Build title aliases from jobTitle and jobNlpTitle, with abbreviation expansion. */
export function buildTitleAliases(
  jobTitle: string | null | undefined,
  jobNlpTitle: string | null | undefined
): string[] {
  const raw = [jobTitle, jobNlpTitle].filter(Boolean) as string[];
  const tokensByTitle = raw.map((t) => tokenize(t));
  const aliases = new Set<string>();

  for (const tokens of tokensByTitle) {
    const normalized = tokens.join(" ");
    if (normalized) aliases.add(normalized);

    const expanded = tokens.map((tk) => expandTitleToken(tk));
    const first = expanded[0];
    if (first) {
      for (const v of first) aliases.add(v + " " + tokens.slice(1).join(" "));
    }
  }

  const fullNormalized = normalizeText(jobTitle || jobNlpTitle || "");
  if (fullNormalized) aliases.add(fullNormalized);
  const nlp = normalizeText(jobNlpTitle || jobTitle || "");
  if (nlp) aliases.add(nlp);

  return uniqueStrings(Array.from(aliases).filter(Boolean));
}

// ---------------------------------------------------------------------------
// Domain extraction from URL
// ---------------------------------------------------------------------------

function domainsFromUrl(url: string | null | undefined): { full: string; root: string }[] {
  const d = extractDomain(url, false);
  if (!d) return [];
  const root = extractRootDomain(d);
  return [{ full: d, root }];
}

// ---------------------------------------------------------------------------
// buildJobFeatures
// ---------------------------------------------------------------------------

export function buildJobFeatures(job: JobForMatching): JobFeatures {
  const jr = job.jobResult;
  const cr = job.companyResult;
  const companyName = normalizeCompanyName(cr.companyName) || "unknown";
  const companyAliases = buildCompanyAliases(cr.companyName);

  const applyLink = jr.applyLink ?? jr.originalUrl ?? null;
  const originalUrl = jr.originalUrl ?? jr.applyLink ?? null;
  const applyDomains = uniqueStrings([
    extractDomain(applyLink, false),
    extractDomain(originalUrl, false),
  ].filter(Boolean));
  const atsDomains = [...applyDomains];
  const companyUrl = cr.companyURL;
  const companyDomain = extractDomain(companyUrl, false);
  const companyDomains = uniqueStrings([
    companyDomain,
    extractRootDomain(companyDomain),
    ...applyDomains.map(extractRootDomain),
  ].filter(Boolean));

  const recruiterNames: string[] = [];
  if (jr.jobRecruiter) recruiterNames.push(normalizeText(jr.jobRecruiter));
  for (const s of safeArray(jr.socialConnections)) {
    const name = [s.fullName, s.firstName].find(Boolean);
    if (name) recruiterNames.push(normalizeText(name));
  }
  const recruiterEmails: string[] = [];

  const titleRaw = (jr.jobTitle || jr.jobNlpTitle || "").trim();
  const normalizedTitle = normalizeText(titleRaw);
  const titleAliases = buildTitleAliases(jr.jobTitle, jr.jobNlpTitle);

  return {
    jobId: jr.jobId,
    companyName,
    companyAliases,
    companyDomains,
    titleRaw,
    normalizedTitle,
    titleAliases,
    recruiterNames: uniqueStrings(recruiterNames),
    recruiterEmails: uniqueStrings(recruiterEmails),
    applyDomains,
    atsDomains,
    publishTime: jr.publishTime ?? null,
    applyLink,
    originalUrl,
  };
}

// ---------------------------------------------------------------------------
// buildEmailFeatures
// ---------------------------------------------------------------------------

export function buildEmailFeatures(email: EmailMessage): EmailFeatures {
  const fromEmail = (email.fromEmail ?? "").trim().toLowerCase();
  const senderDomain = extractDomain(fromEmail, true);
  const senderName = normalizeText(email.fromName);

  const subject = normalizeText(email.subject);
  const body = normalizeText(email.bodyText);
  const snippet = normalizeText(email.snippet);
  const mergedSearchableText = [subject, body, snippet].filter(Boolean).join(" ");

  const urls = safeArray(email.urls);
  const extractedDomains = uniqueStrings(urls.map((u) => extractDomain(u, false)));

  let receivedAt: Date | null = null;
  if (email.receivedAt != null) {
    receivedAt = typeof email.receivedAt === "string" ? new Date(email.receivedAt) : (email.receivedAt as Date);
  }

  return {
    senderEmail: fromEmail,
    senderDomain,
    senderName,
    normalizedSubject: subject,
    normalizedBody: body,
    normalizedSnippet: snippet,
    mergedSearchableText,
    extractedUrls: urls,
    extractedDomains,
    receivedAt,
  };
}

// ---------------------------------------------------------------------------
// Fuzzy text matching (token overlap / contains)
// ---------------------------------------------------------------------------

function tokenOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  let match = 0;
  for (const t of a) {
    if (setB.has(t)) match++;
  }
  return match / Math.max(a.length, b.length);
}

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Returns true if searchText contains the exact phrase (normalized). */
function containsPhrase(searchText: string, phrase: string): boolean {
  const n = normalizeText(phrase);
  const t = normalizeText(searchText);
  if (!n) return false;
  return t.includes(n);
}

/** Best alias match: 1 = exact phrase, 0.6+ = high token overlap, 0.3+ = partial. */
function bestAliasScore(searchText: string, aliases: string[]): number {
  if (!searchText || aliases.length === 0) return 0;
  const searchTokens = tokenize(searchText);
  let best = 0;
  for (const alias of aliases) {
    if (!alias) continue;
    if (containsPhrase(searchText, alias)) return 1;
    const aliasTokens = tokenize(alias);
    const overlap = tokenOverlap(searchTokens, aliasTokens);
    const j = jaccard(searchTokens, aliasTokens);
    const partial = aliasTokens.length <= searchTokens.length && overlap >= 0.5 ? 0.7 : overlap * 0.9;
    best = Math.max(best, overlap, j, partial);
  }
  return Math.min(1, best);
}

// ---------------------------------------------------------------------------
// Sub-score functions
// ---------------------------------------------------------------------------

function threadScore(
  threadId: string | null | undefined,
  jobId: string,
  history: MatchHistory | undefined
): { score: number; reason?: string } {
  if (!threadId || !history?.threadToJobId) return { score: 0 };
  const linkedJob = history.threadToJobId[threadId];
  if (linkedJob === jobId) return { score: 1, reason: "Thread already linked to this job" };
  if (linkedJob) {
    const sameCompany = history.knownJobThreadIds
      ? Object.keys(history.knownJobThreadIds).some(
          (j) => history.knownJobThreadIds![j].includes(threadId)
        )
      : false;
    if (sameCompany) return { score: 0.4, reason: "Thread linked to same company, different role" };
    return { score: 0 };
  }
  const knownForJob = history.knownJobThreadIds?.[jobId];
  if (knownForJob?.includes(threadId)) return { score: 1, reason: "Thread known for this job" };
  return { score: 0 };
}

function participantScore(
  emailFeat: EmailFeatures,
  jobFeat: JobFeatures,
  history: MatchHistory | undefined
): { score: number; reason?: string } {
  const knownEmails = history?.knownJobContactEmails?.[jobFeat.jobId] ?? [];
  const knownNames = history?.knownJobContactNames?.[jobFeat.jobId] ?? [];
  const senderEmail = emailFeat.senderEmail;
  const senderDomain = emailFeat.senderDomain;
  const senderName = emailFeat.senderName;

  if (senderEmail && knownEmails.some((e) => e.toLowerCase() === senderEmail))
    return { score: 1, reason: "Sender email matches known recruiter/contact" };
  if (senderDomain && jobFeat.companyDomains.some((d) => extractRootDomain(d) === extractRootDomain(senderDomain)))
    return { score: 0.9, reason: "Sender domain matches company domain" };
  if (senderDomain && (jobFeat.applyDomains.some((d) => extractRootDomain(d) === extractRootDomain(senderDomain)) ||
      jobFeat.atsDomains.some((d) => extractRootDomain(d) === extractRootDomain(senderDomain))))
    return { score: 0.75, reason: "Sender domain matches apply/ATS domain" };
  const allNames = [...jobFeat.recruiterNames, ...knownNames];
  if (senderName && allNames.length > 0) {
    const senderTokens = tokenize(senderName);
    for (const n of allNames) {
      const nameTokens = tokenize(n);
      if (jaccard(senderTokens, nameTokens) >= 0.5 || tokenOverlap(senderTokens, nameTokens) >= 0.6)
        return { score: 0.55, reason: "Sender name fuzzy-matches recruiter/contact" };
    }
  }
  return { score: 0 };
}

function companyScore(emailFeat: EmailFeatures, jobFeat: JobFeatures): {
  score: number;
  matched: string[];
} {
  const text = emailFeat.mergedSearchableText;
  const domains = [...emailFeat.extractedDomains, emailFeat.senderDomain];
  const urls = emailFeat.extractedUrls.join(" ");
  const searchSpace = [text, urls, domains.join(" ")].join(" ");
  const matched: string[] = [];
  for (const alias of jobFeat.companyAliases) {
    if (!alias) continue;
    if (containsPhrase(searchSpace, alias) || searchSpace.includes(alias)) {
      matched.push(alias);
    }
  }
  if (jobFeat.companyName && (containsPhrase(searchSpace, jobFeat.companyName) || searchSpace.includes(jobFeat.companyName)))
    matched.push(jobFeat.companyName);
  for (const d of jobFeat.companyDomains) {
    if (domains.some((ed) => ed === d || extractRootDomain(ed) === extractRootDomain(d)))
      matched.push(d);
  }
  const uniqueMatched = [...new Set(matched)];
  if (uniqueMatched.length === 0) return { score: 0, matched: [] };
  const exactPhrase = jobFeat.companyAliases.some((a) => containsPhrase(searchSpace, a)) ||
    containsPhrase(searchSpace, jobFeat.companyName);
  const score = exactPhrase ? 1 : (uniqueMatched.length > 0 ? 0.7 : 0);
  return { score: Math.min(1, score), matched: uniqueMatched };
}

function titleScore(emailFeat: EmailFeatures, jobFeat: JobFeatures): {
  score: number;
  matched: string[];
} {
  const text = emailFeat.mergedSearchableText;
  if (!jobFeat.normalizedTitle && jobFeat.titleAliases.length === 0) return { score: 0, matched: [] };
  const exactFull = containsPhrase(text, jobFeat.titleRaw) || containsPhrase(text, jobFeat.normalizedTitle);
  if (exactFull) return { score: 1, matched: [jobFeat.normalizedTitle] };
  const aliasScore = bestAliasScore(text, jobFeat.titleAliases);
  const matched: string[] = [];
  for (const alias of jobFeat.titleAliases) {
    if (containsPhrase(text, alias)) matched.push(alias);
  }
  const partial = jobFeat.titleAliases.some((a) => {
    const at = tokenize(a);
    const st = tokenize(text);
    return at.length >= 2 && tokenOverlap(at, st) >= 0.5;
  });
  const score = partial ? Math.max(aliasScore, 0.5) : aliasScore;
  return { score: Math.min(1, score), matched };
}

function linkScore(emailFeat: EmailFeatures, jobFeat: JobFeatures): {
  score: number;
  matchedUrls: string[];
  matchedDomains: string[];
} {
  const emailUrls = emailFeat.extractedUrls.map((u) => u.toLowerCase().trim());
  const emailDomains = emailFeat.extractedDomains.map((d) => d.toLowerCase());
  const applyLink = (jobFeat.applyLink ?? "").toLowerCase().trim();
  const originalUrl = (jobFeat.originalUrl ?? "").toLowerCase().trim();
  const matchedUrls: string[] = [];
  const matchedDomains: string[] = [];

  if (applyLink && emailUrls.some((u) => u === applyLink || u.replace(/\/$/, "") === applyLink.replace(/\/$/, ""))) {
    matchedUrls.push(applyLink);
    return { score: 1, matchedUrls, matchedDomains };
  }
  if (originalUrl && emailUrls.some((u) => u === originalUrl || u.replace(/\/$/, "") === originalUrl.replace(/\/$/, ""))) {
    matchedUrls.push(originalUrl);
    return { score: 1, matchedUrls, matchedDomains };
  }

  const applyDomain = extractDomain(applyLink, false);
  const originalDomain = extractDomain(originalUrl, false);
  const applyRoot = extractRootDomain(applyDomain);
  let score = 0;
  for (const u of emailUrls) {
    const d = extractDomain(u, false);
    const root = extractRootDomain(d);
    if (d === applyDomain || d === originalDomain) {
      matchedDomains.push(d);
      score = Math.max(score, 0.9);
    } else if (root === applyRoot) {
      matchedDomains.push(d);
      score = Math.max(score, 0.7);
    }
  }
  if (jobFeat.atsDomains.some((ats) => emailDomains.some((ed) => extractRootDomain(ed) === extractRootDomain(ats))))
    score = Math.max(score, 0.5);
  return { score: Math.min(1, score), matchedUrls, matchedDomains };
}

/** Time score: higher when email was received close to application time. */
function timeScore(
  emailFeat: EmailFeatures,
  jobFeat: JobFeatures,
  history: MatchHistory | undefined
): number {
  const refDate = history?.appliedAtByJobId?.[jobFeat.jobId] ?? jobFeat.publishTime;
  if (!refDate) return 0.5;
  const ref = typeof refDate === "string" ? new Date(refDate).getTime() : (refDate as Date).getTime();
  const emailTime = emailFeat.receivedAt?.getTime() ?? Date.now();
  const diffMs = Math.abs(emailTime - ref);
  const diffDays = diffMs / (24 * 60 * 60 * 1000);
  if (diffDays <= 7) return 1;
  if (diffDays <= 30) return 0.8;
  if (diffDays <= 90) return 0.6;
  return 0.4;
}

const INTENT_PHRASES = [
  "thank you for applying",
  "application received",
  "recruiter",
  "schedule",
  "interview",
  "hiring team",
  "unfortunately",
  "moving forward with other candidates",
  "offer",
  "next steps",
  "application status",
  "position you applied",
];

function intentScore(emailFeat: EmailFeatures): number {
  const text = emailFeat.mergedSearchableText;
  if (!text) return 0;
  let count = 0;
  for (const phrase of INTENT_PHRASES) {
    if (text.includes(phrase)) count++;
  }
  if (count >= 2) return 1;
  if (count >= 1) return 0.6;
  return 0;
}

// ---------------------------------------------------------------------------
// Boosts and penalties (simple heuristic: other company/role in text)
// ---------------------------------------------------------------------------

function detectOtherCompany(
  emailFeat: EmailFeatures,
  jobFeat: JobFeatures
): boolean {
  const text = emailFeat.mergedSearchableText;
  const tokens = tokenize(text);
  const companyTokens = new Set(tokenize(jobFeat.companyName));
  const companyAliasTokens = new Set(jobFeat.companyAliases.flatMap((a) => tokenize(a)));
  const ourTokens = new Set([...companyTokens, ...companyAliasTokens]);
  const stop = new Set(["the", "a", "at", "for", "to", "and", "or", "your", "you", "we", "our"]);
  const meaningful = tokens.filter((t) => t.length > 2 && !stop.has(t));
  const otherMentions = meaningful.filter((t) => !ourTokens.has(t));
  return otherMentions.length >= 3;
}

function detectOtherRole(
  emailFeat: EmailFeatures,
  jobFeat: JobFeatures
): boolean {
  const text = emailFeat.mergedSearchableText;
  const titleTokens = new Set(jobFeat.titleAliases.flatMap((a) => tokenize(a)));
  const tokens = tokenize(text);
  const roleWords = ["engineer", "manager", "analyst", "designer", "developer", "scientist", "director"];
  const roleMentions = tokens.filter((t) => roleWords.includes(t) && !titleTokens.has(t));
  return roleMentions.length >= 2;
}

// ---------------------------------------------------------------------------
// scoreEmailJobMatch
// ---------------------------------------------------------------------------

export function scoreEmailJobMatch(
  email: EmailMessage,
  job: JobForMatching,
  history?: MatchHistory | null
): MatchResult {
  const jobFeat = buildJobFeatures(job);
  const emailFeat = buildEmailFeatures(email);
  const hist = history ?? undefined;

  const threadRes = threadScore(email.threadId ?? null, jobFeat.jobId, hist);
  const participantRes = participantScore(emailFeat, jobFeat, hist);
  const companyRes = companyScore(emailFeat, jobFeat);
  const titleRes = titleScore(emailFeat, jobFeat);
  const linkRes = linkScore(emailFeat, jobFeat);
  const time = timeScore(emailFeat, jobFeat, hist);
  const intent = intentScore(emailFeat);

  let baseScore =
    WEIGHTS.thread * threadRes.score +
    WEIGHTS.participant * participantRes.score +
    WEIGHTS.company * companyRes.score +
    WEIGHTS.title * titleRes.score +
    WEIGHTS.link * linkRes.score +
    WEIGHTS.time * time +
    WEIGHTS.intent * intent;

  let boosts = 0;
  let penalties = 0;
  const reasons: string[] = [];
  const conflictingSignals: string[] = [];

  if (threadRes.score === 1 && (hist?.threadToJobId?.[email.threadId!] === jobFeat.jobId || hist?.knownJobThreadIds?.[jobFeat.jobId]?.includes(email.threadId!))) {
    boosts += BOOST_THREAD_SAME_JOB;
    reasons.push("Thread previously linked to same job");
  }
  const exactLinkInEmail = (jobFeat.applyLink && emailFeat.extractedUrls.some((u) => u.replace(/\/$/, "") === (jobFeat.applyLink ?? "").replace(/\/$/, ""))) ||
    (jobFeat.originalUrl && emailFeat.extractedUrls.some((u) => u.replace(/\/$/, "") === (jobFeat.originalUrl ?? "").replace(/\/$/, "")));
  if (exactLinkInEmail) {
    boosts += BOOST_EXACT_LINK_IN_EMAIL;
    reasons.push("Exact apply/original URL found in email");
  }
  if (companyRes.score >= 0.9 && titleRes.score >= 0.9) {
    boosts += BOOST_COMPANY_AND_TITLE_STRONG;
    reasons.push("Strong company and title match");
  }

  // Only apply other-company penalty when our company is not strongly present
  if (companyRes.score < 0.9 && detectOtherCompany(emailFeat, jobFeat)) {
    penalties += PENALTY_OTHER_COMPANY;
    conflictingSignals.push("Email strongly mentions another company");
  }
  // Only apply other-role penalty when our title is not strongly present
  if (titleRes.score < 0.9 && detectOtherRole(emailFeat, jobFeat)) {
    penalties += PENALTY_OTHER_ROLE;
    conflictingSignals.push("Email strongly mentions another role");
  }
  if (email.threadId && hist?.threadToJobId?.[email.threadId] && hist.threadToJobId[email.threadId] !== jobFeat.jobId) {
    penalties += PENALTY_THREAD_LINKED_DIFFERENT_JOB;
    conflictingSignals.push("Same thread already linked to a different job");
  }

  const finalScore = Math.max(0, Math.min(1, baseScore + boosts - penalties));

  if (threadRes.reason) reasons.push(threadRes.reason);
  if (participantRes.reason) reasons.push(participantRes.reason);
  if (companyRes.matched.length) reasons.push(`Company match: ${companyRes.matched.join(", ")}`);
  if (titleRes.matched.length) reasons.push(`Title match: ${titleRes.matched.join(", ")}`);
  if (linkRes.matchedUrls.length) reasons.push(`Link match: ${linkRes.matchedUrls.join(", ")}`);
  if (linkRes.matchedDomains.length) reasons.push(`Domain match: ${linkRes.matchedDomains.join(", ")}`);

  let label: MatchLabel = "LOW";
  if (finalScore >= LABEL_HIGH) label = "HIGH";
  else if (finalScore >= LABEL_MEDIUM) label = "MEDIUM";

  const matched = finalScore >= LABEL_MEDIUM;

  const breakdown = {
    threadScore: threadRes.score,
    participantScore: participantRes.score,
    companyScore: companyRes.score,
    titleScore: titleRes.score,
    linkScore: linkRes.score,
    timeScore: time,
    intentScore: intent,
    boosts,
    penalties,
  };

  const debug = {
    matchedCompanyAliases: companyRes.matched,
    matchedTitleAliases: titleRes.matched,
    matchedDomains: linkRes.matchedDomains,
    matchedUrls: linkRes.matchedUrls,
    conflictingSignals,
  };

  return {
    jobId: jobFeat.jobId,
    finalScore,
    label,
    matched,
    reasons,
    breakdown,
    debug,
  };
}

// ---------------------------------------------------------------------------
// rankEmailAgainstJobs
// ---------------------------------------------------------------------------

export function rankEmailAgainstJobs(
  email: EmailMessage,
  jobs: JobForMatching[],
  history?: MatchHistory | null
): Array<{ jobId: string; result: MatchResult }> {
  const withScores = jobs.map((job) => ({
    jobId: job.jobResult.jobId,
    result: scoreEmailJobMatch(email, job, history),
  }));
  withScores.sort((a, b) => b.result.finalScore - a.result.finalScore);

  const top1 = withScores[0];
  const top2 = withScores[1];
  if (top1 && top2 && top1.result.finalScore - top2.result.finalScore < AMBIGUOUS_DELTA) {
    top1.result.label = "AMBIGUOUS";
  }

  return withScores;
}
