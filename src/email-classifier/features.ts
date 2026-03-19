/**
 * Feature extraction for email type classification.
 * Normalizes text, extracts domains, and builds the feature object.
 */

import type { ApplicationEmailType, EmailMessage, EmailTypeFeatures, LinkedJob } from "./types";
import {
  SCHEDULING_DOMAINS,
  ASSESSMENT_DOMAINS,
  MEETING_DOMAINS,
  RECRUITING_DOMAIN_PATTERNS,
  AVAILABILITY_PHRASES,
  INTERVIEW_PHRASES,
  APPLY_PHRASES,
  DECISION_PHRASES,
  COMPENSATION_PHRASES,
  WITHDRAW_PHRASES,
  DATE_TIME_PATTERNS,
  getStrongPhrases,
  getMediumPhrases,
} from "./dictionaries";
import { APPLICATION_EMAIL_TYPES } from "./types";

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/** Lowercase, collapse whitespace to single space, trim. Preserve URLs as-is when extracting separately. */
export function normalizeText(s: string | null | undefined): string {
  if (s == null || s === "") return "";
  return String(s)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract hostname from URL string. */
export function extractUrlDomain(url: string | null | undefined): string {
  const t = (url ?? "").trim().toLowerCase();
  if (!t) return "";
  try {
    const u = t.startsWith("http") ? t : `https://${t}`;
    return new URL(u).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/** Extract domain from email (part after @). */
export function extractSenderDomain(fromEmail: string | null | undefined): string {
  const s = (fromEmail ?? "").trim().toLowerCase();
  if (!s) return "";
  const at = s.indexOf("@");
  return at >= 0 ? s.slice(at + 1) : "";
}

/** Check if domain string matches any of the patterns (substring or includes). */
function domainMatchesPatterns(domain: string, patterns: string[]): boolean {
  const d = domain.toLowerCase();
  return patterns.some((p) => d.includes(p) || p.includes(d));
}

/** Check if text contains any of the phrases (after normalizing text). */
function textContainsAny(text: string, phrases: string[]): string[] {
  const normalized = normalizeText(text);
  if (!normalized) return [];
  const hits: string[] = [];
  for (const phrase of phrases) {
    const p = normalizeText(phrase);
    if (p && normalized.includes(p)) {
      console.log('phrase', phrase);
      hits.push(phrase);
    }
  }
  return hits;
}

/** Check if text has date/time mention. */
function detectDateTimeMention(text: string): boolean {
  const t = normalizeText(text);
  if (!t) return false;
  return (
    DATE_TIME_PATTERNS.weekdays.test(t) ||
    DATE_TIME_PATTERNS.months.test(t) ||
    DATE_TIME_PATTERNS.time.test(t) ||
    DATE_TIME_PATTERNS.isoDate.test(t) ||
    DATE_TIME_PATTERNS.shortDate.test(t)
  );
}

/** Check if linked job company appears in domain or text (simple substring). */
function senderMatchesCompany(domain: string, company: string | null | undefined): boolean {
  const c = normalizeText(company).replace(/\s+/g, "");
  if (!c || !domain) return false;
  return domain.includes(c) || c.length >= 3 && domain.includes(c.slice(0, 5));
}

// ---------------------------------------------------------------------------
// Build features
// ---------------------------------------------------------------------------

export function buildEmailTypeFeatures(
  email: EmailMessage,
  linkedJob?: LinkedJob | null
): EmailTypeFeatures {
  const subjectText = normalizeText(email.subject);
  const bodyText = normalizeText(email.bodyText);
  const snippetText = normalizeText(email.snippet);
  const mergedText = [subjectText, bodyText, snippetText].filter(Boolean).join(" ");

  const senderDomain = extractSenderDomain(email.fromEmail);
  const senderLooksRecruiting = RECRUITING_DOMAIN_PATTERNS.some(
    (p) => senderDomain.includes(p) || senderDomain.includes(p.replace(".", ""))
  );
  const companyForMatch = linkedJob?.company;
  const senderMatchesLinkedCompany = senderMatchesCompany(senderDomain, companyForMatch);

  const urls = email.urls ?? [];
  const urlDomains = urls.map(extractUrlDomain).filter(Boolean);
  const allDomains = [senderDomain, ...urlDomains].filter(Boolean);
  const hasSchedulingLink = allDomains.some((d) => domainMatchesPatterns(d, SCHEDULING_DOMAINS));
  const hasAssessmentLink = allDomains.some((d) => domainMatchesPatterns(d, ASSESSMENT_DOMAINS));
  const hasMeetingUrl =
    allDomains.some((d) => domainMatchesPatterns(d, MEETING_DOMAINS)) ||
    !!email.calendarInvite?.meetingUrl;

  const hasCalendarInvite = !!(
    email.calendarInvite?.startTime ||
    email.calendarInvite?.meetingUrl ||
    email.calendarInvite?.title
  );
  const hasOfferAttachment = (email.attachments ?? []).some((a) => {
    const name = (a.filename ?? "").toLowerCase();
    const mime = (a.mimeType ?? "").toLowerCase();
    return (
      name.includes("offer") ||
      name.includes("compensation") ||
      name.includes("employment") ||
      mime.includes("pdf") && (name.includes("letter") || name.includes("offer"))
    );
  });

  const hasDateTimeMention = detectDateTimeMention(mergedText);

  const keywordHits: Partial<Record<ApplicationEmailType, string[]>> = {};
  for (const type of APPLICATION_EMAIL_TYPES) {
    if (type === "UNKNOWN") continue;
    const strong = textContainsAny(mergedText, getStrongPhrases(type));
    const medium = textContainsAny(mergedText, getMediumPhrases(type));
    const all = [...new Set([...strong, ...medium])];
    if (all.length) keywordHits[type] = all;
  }

  const hasConfirmationPhrase = textContainsAny(mergedText, getStrongPhrases("RECEIVED_APPLICATION_CONFIRMATION")).length > 0;
  const hasIntroPhrase =
    textContainsAny(mergedText, getStrongPhrases("RECEIVED_INTRO_REQUEST")).length > 0 ||
    textContainsAny(mergedText, getMediumPhrases("RECEIVED_INTRO_REQUEST")).length > 0;
  const hasSchedulingPhrase =
    textContainsAny(mergedText, getStrongPhrases("RECEIVED_SCHEDULING_REQUEST")).length > 0 ||
    textContainsAny(mergedText, getMediumPhrases("RECEIVED_SCHEDULING_REQUEST")).length > 0;
  const hasInterviewConfirmPhrase =
    textContainsAny(mergedText, getStrongPhrases("RECEIVED_INTERVIEW_CONFIRMATION")).length > 0 ||
    textContainsAny(mergedText, getMediumPhrases("RECEIVED_INTERVIEW_CONFIRMATION")).length > 0;
  const hasAssessmentPhrase =
    textContainsAny(mergedText, getStrongPhrases("RECEIVED_ASSESSMENT_REQUEST")).length > 0 ||
    textContainsAny(mergedText, getMediumPhrases("RECEIVED_ASSESSMENT_REQUEST")).length > 0;
  const hasRejectionPhrase =
    textContainsAny(mergedText, getStrongPhrases("RECEIVED_REJECTION")).length > 0 ||
    textContainsAny(mergedText, getMediumPhrases("RECEIVED_REJECTION")).length > 0;
  const hasOfferPhrase =
    textContainsAny(mergedText, getStrongPhrases("RECEIVED_OFFER")).length > 0 ||
    textContainsAny(mergedText, getMediumPhrases("RECEIVED_OFFER")).length > 0;
  const hasFollowUpPhrase =
    textContainsAny(mergedText, getStrongPhrases("RECEIVED_FOLLOW_UP")).length > 0 ||
    textContainsAny(mergedText, getMediumPhrases("RECEIVED_FOLLOW_UP")).length > 0;
  const hasWithdrawalPhrase =
    textContainsAny(mergedText, getStrongPhrases("RECEIVED_WITHDRAWAL_CONFIRMATION")).length > 0 ||
    textContainsAny(mergedText, getMediumPhrases("RECEIVED_WITHDRAWAL_CONFIRMATION")).length > 0;

  const mentionsAvailability = textContainsAny(mergedText, AVAILABILITY_PHRASES).length > 0;
  const mentionsInterview = textContainsAny(mergedText, INTERVIEW_PHRASES).length > 0;
  const mentionsApply = textContainsAny(mergedText, APPLY_PHRASES).length > 0;
  const mentionsDecision = textContainsAny(mergedText, DECISION_PHRASES).length > 0;
  const mentionsCompensation = textContainsAny(mergedText, COMPENSATION_PHRASES).length > 0;
  const mentionsWithdraw = textContainsAny(mergedText, WITHDRAW_PHRASES).length > 0;

  return {
    mergedText,
    subjectText,
    bodyText,
    snippetText,
    senderDomain,
    senderLooksRecruiting,
    senderMatchesLinkedCompany,
    urlDomains,
    hasSchedulingLink,
    hasAssessmentLink,
    hasOfferAttachment,
    hasCalendarInvite,
    hasMeetingUrl,
    hasDateTimeMention,
    keywordHits,
    hasConfirmationPhrase,
    hasIntroPhrase,
    hasSchedulingPhrase,
    hasInterviewConfirmPhrase,
    hasAssessmentPhrase,
    hasRejectionPhrase,
    hasOfferPhrase,
    hasFollowUpPhrase,
    hasWithdrawalPhrase,
    mentionsAvailability,
    mentionsInterview,
    mentionsApply,
    mentionsDecision,
    mentionsCompensation,
    mentionsWithdraw,
  };
}
