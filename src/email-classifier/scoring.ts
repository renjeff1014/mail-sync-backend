/**
 * Deterministic scoring for each email type.
 * Weights and penalties are tunable constants.
 */

import type { ApplicationEmailType, EmailTypeFeatures, ThreadContext } from "./types";
import { getStrongPhrases, getMediumPhrases } from "./dictionaries";

// ---------------------------------------------------------------------------
// Weights (tunable)
// ---------------------------------------------------------------------------

const W_STRONG_PHRASE = 0.38;
const W_MEDIUM_PHRASE = 0.18;
const W_WEAK_PHRASE = 0.08;

const W_SCHEDULING_LINK = 0.42;
const W_CALENDAR_INVITE = 0.45;
const W_ASSESSMENT_LINK = 0.42;
const W_OFFER_ATTACHMENT = 0.45;

const W_RECRUITING_SENDER = 0.06;
const W_UNKNOWN_BASE = 0.02;

// ---------------------------------------------------------------------------
// Per-type base score from features
// ---------------------------------------------------------------------------

function scoreConfirmation(f: EmailTypeFeatures): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let s = 0;
  if (f.hasConfirmationPhrase) {
    s += W_STRONG_PHRASE;
    reasons.push("application confirmation phrase");
  }
  const hits = f.keywordHits.RECEIVED_APPLICATION_CONFIRMATION ?? [];
  if (hits.length > 0) s += Math.min(0.5, W_MEDIUM_PHRASE * hits.length);
  if (hits.length) reasons.push(`confirmation keywords: ${hits.slice(0, 3).join(", ")}`);
  return { score: s, reasons };
}

function scoreApplicationReply(f: EmailTypeFeatures): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let s = 0;
  const hits = f.keywordHits.RECEIVED_APPLICATION_REPLY ?? [];
  if (hits.length > 0) {
    s += Math.min(0.4, W_MEDIUM_PHRASE * hits.length);
    reasons.push(`reply keywords: ${hits.slice(0, 3).join(", ")}`);
  }
  if (f.mentionsApply && !f.hasConfirmationPhrase && !f.hasRejectionPhrase) {
    s += W_WEAK_PHRASE;
    reasons.push("mentions application");
  }
  return { score: s, reasons };
}

function scoreIntroRequest(f: EmailTypeFeatures): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let s = 0;
  if (f.hasIntroPhrase) {
    s += W_STRONG_PHRASE;
    reasons.push("intro request phrase");
  }
  const hits = f.keywordHits.RECEIVED_INTRO_REQUEST ?? [];
  if (hits.length > 0) s += Math.min(0.35, W_MEDIUM_PHRASE * hits.length);
  if (f.senderLooksRecruiting && (f.hasIntroPhrase || hits.length)) {
    s += W_RECRUITING_SENDER;
    reasons.push("recruiting sender + intro");
  }
  return { score: s, reasons };
}

function scoreSchedulingRequest(f: EmailTypeFeatures): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let s = 0;
  if (f.hasSchedulingLink) {
    s += W_SCHEDULING_LINK;
    reasons.push("scheduling link present");
  }
  if (f.hasSchedulingPhrase) {
    s += W_STRONG_PHRASE;
    reasons.push("scheduling phrase");
  }
  const hits = f.keywordHits.RECEIVED_SCHEDULING_REQUEST ?? [];
  if (hits.length > 0) s += Math.min(0.3, W_MEDIUM_PHRASE * hits.length);
  if (f.mentionsAvailability) {
    s += W_WEAK_PHRASE;
    reasons.push("mentions availability");
  }
  if (f.senderLooksRecruiting && (f.hasSchedulingLink || f.hasSchedulingPhrase)) {
    s += W_RECRUITING_SENDER;
  }
  return { score: s, reasons };
}

function scoreInterviewConfirmation(f: EmailTypeFeatures): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let s = 0;
  if (f.hasCalendarInvite) {
    s += W_CALENDAR_INVITE;
    reasons.push("calendar invite present");
  }
  if (f.hasMeetingUrl) {
    s += W_STRONG_PHRASE * 0.9;
    reasons.push("meeting URL present");
  }
  if (f.hasInterviewConfirmPhrase) {
    s += W_STRONG_PHRASE;
    reasons.push("interview confirmation phrase");
  }
  const hits = f.keywordHits.RECEIVED_INTERVIEW_CONFIRMATION ?? [];
  if (hits.length > 0) s += Math.min(0.3, W_MEDIUM_PHRASE * hits.length);
  if (f.hasDateTimeMention) {
    s += W_WEAK_PHRASE;
    reasons.push("date/time mention");
  }
  if (f.senderLooksRecruiting && (f.hasCalendarInvite || f.hasInterviewConfirmPhrase)) {
    s += W_RECRUITING_SENDER;
  }
  return { score: s, reasons };
}

function scoreAssessmentRequest(f: EmailTypeFeatures): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let s = 0;
  if (f.hasAssessmentLink) {
    s += W_ASSESSMENT_LINK;
    reasons.push("assessment link present");
  }
  if (f.hasAssessmentPhrase) {
    s += W_STRONG_PHRASE;
    reasons.push("assessment phrase");
  }
  const hits = f.keywordHits.RECEIVED_ASSESSMENT_REQUEST ?? [];
  if (hits.length > 0) s += Math.min(0.35, W_MEDIUM_PHRASE * hits.length);
  if (f.senderLooksRecruiting && (f.hasAssessmentLink || f.hasAssessmentPhrase)) {
    s += W_RECRUITING_SENDER;
  }
  return { score: s, reasons };
}

function scoreRejection(f: EmailTypeFeatures): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let s = 0;
  if (f.hasRejectionPhrase) {
    s += W_STRONG_PHRASE;
    reasons.push("rejection phrase");
  }
  const hits = f.keywordHits.RECEIVED_REJECTION ?? [];
  if (hits.length > 0) s += Math.min(0.45, W_MEDIUM_PHRASE * hits.length);
  if (f.mentionsDecision && hits.length) {
    s += W_WEAK_PHRASE;
    reasons.push("mentions decision");
  }
  return { score: s, reasons };
}

function scoreOffer(f: EmailTypeFeatures): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let s = 0;
  if (f.hasOfferAttachment) {
    s += W_OFFER_ATTACHMENT;
    reasons.push("offer attachment present");
  }
  if (f.hasOfferPhrase) {
    s += W_STRONG_PHRASE;
    reasons.push("offer phrase");
  }
  const hits = f.keywordHits.RECEIVED_OFFER ?? [];
  if (hits.length > 0) s += Math.min(0.35, W_MEDIUM_PHRASE * hits.length);
  if (f.mentionsCompensation) {
    s += W_WEAK_PHRASE;
    reasons.push("mentions compensation");
  }
  return { score: s, reasons };
}

function scoreFollowUp(f: EmailTypeFeatures): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let s = 0;
  if (f.hasFollowUpPhrase) {
    s += W_STRONG_PHRASE * 0.85;
    reasons.push("follow-up phrase");
  }
  const hits = f.keywordHits.RECEIVED_FOLLOW_UP ?? [];
  if (hits.length > 0) s += Math.min(0.3, W_MEDIUM_PHRASE * hits.length);
  if (f.senderLooksRecruiting && (f.hasFollowUpPhrase || hits.length)) {
    s += W_RECRUITING_SENDER;
  }
  return { score: s, reasons };
}

function scoreWithdrawal(f: EmailTypeFeatures): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let s = 0;
  if (f.hasWithdrawalPhrase) {
    s += W_STRONG_PHRASE;
    reasons.push("withdrawal phrase");
  }
  const hits = f.keywordHits.RECEIVED_WITHDRAWAL_CONFIRMATION ?? [];
  if (hits.length > 0) s += Math.min(0.35, W_MEDIUM_PHRASE * hits.length);
  if (f.mentionsWithdraw) {
    s += W_WEAK_PHRASE;
    reasons.push("mentions withdraw");
  }
  return { score: s, reasons };
}

export function scoreType(type: ApplicationEmailType, f: EmailTypeFeatures): { score: number; reasons: string[] } {
  switch (type) {
    case "RECEIVED_APPLICATION_CONFIRMATION":
      return scoreConfirmation(f);
    case "RECEIVED_APPLICATION_REPLY":
      return scoreApplicationReply(f);
    case "RECEIVED_INTRO_REQUEST":
      return scoreIntroRequest(f);
    case "RECEIVED_SCHEDULING_REQUEST":
      return scoreSchedulingRequest(f);
    case "RECEIVED_INTERVIEW_CONFIRMATION":
      return scoreInterviewConfirmation(f);
    case "RECEIVED_ASSESSMENT_REQUEST":
      return scoreAssessmentRequest(f);
    case "RECEIVED_REJECTION":
      return scoreRejection(f);
    case "RECEIVED_OFFER":
      return scoreOffer(f);
    case "RECEIVED_FOLLOW_UP":
      return scoreFollowUp(f);
    case "RECEIVED_WITHDRAWAL_CONFIRMATION":
      return scoreWithdrawal(f);
    case "UNKNOWN":
      return { score: W_UNKNOWN_BASE, reasons: [] };
    default:
      return { score: 0, reasons: [] };
  }
}

// ---------------------------------------------------------------------------
// Conflict penalties
// ---------------------------------------------------------------------------

const PENALTY_STRONG_REJECTION = 0.25;
const PENALTY_OFFER_VS_OTHERS = 0.25;
const PENALTY_CALENDAR_VS_SCHEDULING = 0.12;
const PENALTY_SCHEDULING_LINK_VS_INTERVIEW = 0.1;
const PENALTY_ASSESSMENT_VS_INTRO_REPLY = 0.15;

export function applyConflictPenalties(
  scores: Record<ApplicationEmailType, number>,
  f: EmailTypeFeatures
): Record<ApplicationEmailType, number> {
  const out = { ...scores };

  if (f.hasRejectionPhrase) {
    out.RECEIVED_SCHEDULING_REQUEST = Math.max(0, (out.RECEIVED_SCHEDULING_REQUEST ?? 0) - PENALTY_STRONG_REJECTION);
    out.RECEIVED_INTERVIEW_CONFIRMATION = Math.max(0, (out.RECEIVED_INTERVIEW_CONFIRMATION ?? 0) - PENALTY_STRONG_REJECTION);
    out.RECEIVED_OFFER = Math.max(0, (out.RECEIVED_OFFER ?? 0) - PENALTY_STRONG_REJECTION);
  }

  if (f.hasOfferPhrase || f.hasOfferAttachment) {
    out.RECEIVED_REJECTION = Math.max(0, (out.RECEIVED_REJECTION ?? 0) - PENALTY_OFFER_VS_OTHERS);
    out.RECEIVED_FOLLOW_UP = Math.max(0, (out.RECEIVED_FOLLOW_UP ?? 0) - PENALTY_OFFER_VS_OTHERS);
    out.RECEIVED_APPLICATION_REPLY = Math.max(0, (out.RECEIVED_APPLICATION_REPLY ?? 0) - PENALTY_OFFER_VS_OTHERS * 0.6);
  }

  if (f.hasCalendarInvite) {
    out.RECEIVED_SCHEDULING_REQUEST = Math.max(0, (out.RECEIVED_SCHEDULING_REQUEST ?? 0) - PENALTY_CALENDAR_VS_SCHEDULING);
  }

  if (f.hasSchedulingLink && !f.hasCalendarInvite) {
    out.RECEIVED_INTERVIEW_CONFIRMATION = Math.max(0, (out.RECEIVED_INTERVIEW_CONFIRMATION ?? 0) - PENALTY_SCHEDULING_LINK_VS_INTERVIEW);
  }

  if (f.hasAssessmentLink) {
    out.RECEIVED_INTRO_REQUEST = Math.max(0, (out.RECEIVED_INTRO_REQUEST ?? 0) - PENALTY_ASSESSMENT_VS_INTRO_REPLY);
    out.RECEIVED_APPLICATION_REPLY = Math.max(0, (out.RECEIVED_APPLICATION_REPLY ?? 0) - PENALTY_ASSESSMENT_VS_INTRO_REPLY);
  }

  return out;
}

// ---------------------------------------------------------------------------
// Thread context boosts
// ---------------------------------------------------------------------------

const BOOST_PREV_SCHEDULING_THEN_CONFIRM = 0.22;
const BOOST_PREV_INTRO_THEN_SCHEDULING = 0.18;
const PENALTY_PREV_REJECTION_OR_WITHDRAWAL = 0.2;

export function applyThreadContextBoosts(
  scores: Record<ApplicationEmailType, number>,
  f: EmailTypeFeatures,
  threadContext?: ThreadContext | null
): Record<ApplicationEmailType, number> {
  const out = { ...scores };
  const prev = threadContext?.previousTypes ?? [];
  if (prev.length === 0) return out;

  const last = prev[prev.length - 1];
  const hasConfirmedPhrase =
    /\b(confirmed|works for me|see you then|see you at|accepted)\b/i.test(f.mergedText) ||
    f.hasCalendarInvite;

  if (last === "RECEIVED_SCHEDULING_REQUEST" && hasConfirmedPhrase) {
    out.RECEIVED_INTERVIEW_CONFIRMATION = (out.RECEIVED_INTERVIEW_CONFIRMATION ?? 0) + BOOST_PREV_SCHEDULING_THEN_CONFIRM;
  }

  if (last === "RECEIVED_INTRO_REQUEST" && (f.mentionsAvailability || f.hasSchedulingLink)) {
    out.RECEIVED_SCHEDULING_REQUEST = (out.RECEIVED_SCHEDULING_REQUEST ?? 0) + BOOST_PREV_INTRO_THEN_SCHEDULING;
  }

  const prevRejectionOrWithdrawal = prev.some(
    (t) => t === "RECEIVED_REJECTION" || t === "RECEIVED_WITHDRAWAL_CONFIRMATION"
  );
  if (prevRejectionOrWithdrawal) {
    const activeTypes: ApplicationEmailType[] = [
      "RECEIVED_SCHEDULING_REQUEST",
      "RECEIVED_INTERVIEW_CONFIRMATION",
      "RECEIVED_OFFER",
      "RECEIVED_ASSESSMENT_REQUEST",
      "RECEIVED_INTRO_REQUEST",
    ];
    for (const t of activeTypes) {
      const strongEvidence =
        (t === "RECEIVED_OFFER" && (f.hasOfferPhrase || f.hasOfferAttachment)) ||
        (t === "RECEIVED_INTERVIEW_CONFIRMATION" && f.hasCalendarInvite) ||
        (t === "RECEIVED_ASSESSMENT_REQUEST" && f.hasAssessmentLink);
      if (!strongEvidence) {
        out[t] = Math.max(0, (out[t] ?? 0) - PENALTY_PREV_REJECTION_OR_WITHDRAWAL);
      }
    }
  }

  return out;
}
