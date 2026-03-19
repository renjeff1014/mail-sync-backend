/**
 * Explainable phrase and domain dictionaries for email type classification.
 * All strings are used in normalized (lowercase) form; matching is case-insensitive after normalize.
 */

import type { ApplicationEmailType } from "./types";

/** Strong phrases: high weight (~0.30–0.45). */
export const PHRASES_APPLICATION_CONFIRMATION_STRONG = [
  "thank you for applying",
  "we have received your application",
  "your application has been received",
  "application received",
  "we received your application",
  "successfully submitted your application",
  "application submitted successfully",
  "confirmation of your application",
];

export const PHRASES_APPLICATION_REPLY_STRONG: string[] = [];

export const PHRASES_APPLICATION_REPLY_MEDIUM = [
  "regarding your application",
  "regarding your interest",
  "following up on your application",
  "in response to your application",
  "re your application",
  "about your application",
  "reply to your application",
];

export const PHRASES_INTRO_REQUEST_STRONG = [
  "would like to connect",
  "would like to schedule a call",
  "would like to learn more about you",
  "interested in learning more",
  "would love to chat",
  "quick intro call",
  "brief call to discuss",
  "schedule a quick call",
  "introductory call",
  "get to know you",
];

export const PHRASES_INTRO_REQUEST_MEDIUM = [
  "reach out",
  "touch base",
  "connect with you",
  "chat about",
  "discuss the role",
  "discuss your background",
  "next steps in the process",
];

export const PHRASES_SCHEDULING_STRONG = [
  "schedule a time",
  "schedule an interview",
  "pick a time",
  "choose a time",
  "when are you available",
  "what times work for you",
  "availability for",
  "find a time",
  "book a time",
  "scheduling link",
  "click below to schedule",
  "select a time that works",
  "calendar link",
];

export const PHRASES_SCHEDULING_MEDIUM = [
  "available to meet",
  "available for a call",
  "next week",
  "this week",
  "let me know your availability",
  "your availability",
  "convenient time",
  "time that works",
];

export const PHRASES_INTERVIEW_CONFIRMATION_STRONG = [
  "interview scheduled",
  "interview is scheduled",
  "confirmed for",
  "confirmed on",
  "see you at",
  "see you on",
  "looking forward to meeting you",
  "meeting is confirmed",
  "calendar invite",
  "calendar invitation",
  "invitation for",
  "you have been scheduled",
  "we have scheduled",
  "your interview has been scheduled",
  "confirmed your interview",
  "interview confirmation",
  "meeting confirmed",
  "works for me",
  "see you then",
];

export const PHRASES_INTERVIEW_CONFIRMATION_MEDIUM = [
  "confirming our",
  "confirmation for",
  "reminder:",
  "reminder -",
  "upcoming interview",
  "upcoming call",
  "your upcoming",
  "as a reminder",
];

export const PHRASES_ASSESSMENT_STRONG = [
  "technical assessment",
  "coding assessment",
  "online assessment",
  "assessment link",
  "complete the assessment",
  "take the assessment",
  "assessment to complete",
  "hackerrank",
  "codesignal",
  "codility",
  "karat",
  "coding challenge",
  "technical challenge",
  "complete the following",
  "timed assessment",
  "assessment deadline",
];

export const PHRASES_ASSESSMENT_MEDIUM = [
  "next step is",
  "next step in the process",
  "online test",
  "technical test",
  "skills assessment",
  "complete this",
  "submit your",
];

export const PHRASES_REJECTION_STRONG = [
  "unfortunately",
  "not moving forward",
  "moving forward with other candidates",
  "other candidates whose experience",
  "we have decided to pursue",
  "not selected to move forward",
  "not chosen to move forward",
  "will not be moving forward",
  "not advancing",
  "not proceeding",
  "position has been filled",
  "filled the position",
  "we regret to inform",
  "regret to inform you",
  "wish you the best",
  "best of luck in your",
  "unable to offer",
  "not a fit at this time",
];

export const PHRASES_REJECTION_MEDIUM = [
  "decided to go in a different direction",
  "different direction",
  "not the right fit",
  "pursuing other candidates",
  "other applicants",
  "at this stage",
  // "thank you for your interest",
  "at this time we",
  "thank you for applying",
  "we appreciate your interest",
];

export const PHRASES_OFFER_STRONG = [
  "offer letter",
  "we are pleased to offer",
  "pleased to extend an offer",
  "extend an offer",
  "offer of employment",
  "employment offer",
  "job offer",
  "compensation package",
  "offer package",
  "attached is your offer",
  "please find attached your offer",
  "congratulations",
  "we would like to offer you",
  "starting salary",
  "base salary",
  "total compensation",
  "benefits package",
  "offer details",
  "accept this offer",
  "sign the offer",
];

export const PHRASES_OFFER_MEDIUM = [
  "next steps regarding your offer",
  "offer is attached",
  "formal offer",
  "written offer",
  "offer document",
  "joining our team",
  "welcome to the team",
  "excited to have you",
];

export const PHRASES_FOLLOW_UP_STRONG = [
  "checking in",
  "following up",
  "follow up",
  "touch base",
  "circle back",
  "wanted to follow up",
  "quick follow up",
  "just following up",
  "reaching out again",
  "wanted to see",
  "wanted to check",
  "any update",
  "get an update",
  "status update",
];

export const PHRASES_FOLLOW_UP_MEDIUM = [
  "haven't heard back",
  "when you have a chance",
  "at your convenience",
  "when you get a chance",
  "let me know",
  "please let us know",
  "looking forward to hearing",
];

export const PHRASES_WITHDRAWAL_STRONG = [
  "withdraw my application",
  "withdrawing my application",
  "withdraw from the process",
  "no longer pursuing",
  "no longer interested",
  "removing myself from consideration",
  "withdraw from consideration",
  "withdrawal of my application",
  "confirming withdrawal",
  "withdrawal confirmation",
  "we have processed your withdrawal",
  "your withdrawal has been",
  "application has been withdrawn",
];

export const PHRASES_WITHDRAWAL_MEDIUM = [
  "decided to withdraw",
  "would like to withdraw",
  "taking myself out",
  "pursuing other opportunities",
  "accepted another position",
  "accepted an offer elsewhere",
];

/** Domain (hostname) patterns for scheduling tools. */
export const SCHEDULING_DOMAINS = [
  "calendly.com",
  "goodtime.io",
  "acuityscheduling.com",
  "microsoft.com/bookings",
  "bookings.",
  "cal.com",
  "doodle.com",
  "when2meet",
  "scheduling.",
  "appointlet",
  "youcanbook.me",
  "hubspot.com/meetings",
  "outlook.office365.com/book",
];

/** Domain patterns for assessment/coding platforms. */
export const ASSESSMENT_DOMAINS = [
  "hackerrank.com",
  "codesignal.com",
  "codility.com",
  "karat.com",
  "testgorilla",
  "criteria.com",
  "toggl.com/hire",
  "codility.",
  "hackerrank.",
  "codesignal.",
  "karat.",
  "greenhouse.io",
  "lever.co",
  "workable.com",
  "assessment",
  "coding test",
];

/** Domain patterns for meeting/video. */
export const MEETING_DOMAINS = [
  "zoom.us",
  "zoom.com",
  "meet.google.com",
  "teams.microsoft.com",
  "webex.com",
  "gotomeeting",
  "whereby.com",
  "bluejeans",
  "ringcentral",
  "chime.aws",
  "meet.",
  "zoom.",
  "teams.",
  "webex.",
];

/** Sender domains that often indicate recruiting/HR. */
export const RECRUITING_DOMAIN_PATTERNS = [
  "recruiting",
  "recruitment",
  "talent",
  "careers",
  "jobs.",
  "hr.",
  "humanresources",
  "hiring",
  "greenhouse",
  "lever.co",
  "workday",
  "icims",
  "jobvite",
  "smartrecruiters",
  "applicant",
];

/** Phrases that suggest availability. */
export const AVAILABILITY_PHRASES = [
  "when are you available",
  "your availability",
  "available this week",
  "available next week",
  "what times work",
  "free for",
  "open for",
  "any availability",
  "let me know when",
  "availability for",
];

/** Phrases that suggest interview. */
export const INTERVIEW_PHRASES = [
  "interview",
  "call with",
  "meeting with",
  "conversation with",
  "discuss the role",
  "discuss your experience",
  "video call",
  "phone screen",
  "onsite",
  "on-site",
  "final round",
  "panel interview",
];

/** Phrases that suggest application/apply. */
export const APPLY_PHRASES = [
  "applied",
  "application",
  "applying",
  "apply for",
  "submitted",
  "submission",
];

/** Phrases that suggest decision. */
export const DECISION_PHRASES = [
  "decision",
  "decided",
  "moving forward",
  "next step",
  "next steps",
  "outcome",
  "result",
];

/** Phrases that suggest compensation. */
export const COMPENSATION_PHRASES = [
  "salary",
  "compensation",
  "pay",
  "benefits",
  "offer",
  "bonus",
  "equity",
  "stock",
];

/** Phrases that suggest withdrawal. */
export const WITHDRAW_PHRASES = [
  "withdraw",
  "withdrawal",
  "no longer",
  "pursuing other",
  "remove myself",
  "pull my application",
];

/** Date/time regex building blocks (for detection). */
export const DATE_TIME_PATTERNS = {
  weekdays:
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/i,
  months:
    /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\b/i,
  time: /\b(\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)|(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm))/i,
  isoDate: /\b\d{4}-\d{2}-\d{2}\b/,
  shortDate: /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/,
};

/** Map type -> strong phrase arrays (for scoring). */
export function getStrongPhrases(type: ApplicationEmailType): string[] {
  switch (type) {
    case "RECEIVED_APPLICATION_CONFIRMATION":
      return PHRASES_APPLICATION_CONFIRMATION_STRONG;
    case "RECEIVED_INTRO_REQUEST":
      return PHRASES_INTRO_REQUEST_STRONG;
    case "RECEIVED_SCHEDULING_REQUEST":
      return PHRASES_SCHEDULING_STRONG;
    case "RECEIVED_INTERVIEW_CONFIRMATION":
      return PHRASES_INTERVIEW_CONFIRMATION_STRONG;
    case "RECEIVED_ASSESSMENT_REQUEST":
      return PHRASES_ASSESSMENT_STRONG;
    case "RECEIVED_REJECTION":
      return PHRASES_REJECTION_STRONG;
    case "RECEIVED_OFFER":
      return PHRASES_OFFER_STRONG;
    case "RECEIVED_FOLLOW_UP":
      return PHRASES_FOLLOW_UP_STRONG;
    case "RECEIVED_WITHDRAWAL_CONFIRMATION":
      return PHRASES_WITHDRAWAL_STRONG;
    case "RECEIVED_APPLICATION_REPLY":
      return PHRASES_APPLICATION_REPLY_STRONG;
    default:
      return [];
  }
}

/** Map type -> medium phrase arrays. */
export function getMediumPhrases(type: ApplicationEmailType): string[] {
  switch (type) {
    case "RECEIVED_APPLICATION_REPLY":
      return PHRASES_APPLICATION_REPLY_MEDIUM;
    case "RECEIVED_INTRO_REQUEST":
      return PHRASES_INTRO_REQUEST_MEDIUM;
    case "RECEIVED_SCHEDULING_REQUEST":
      return PHRASES_SCHEDULING_MEDIUM;
    case "RECEIVED_INTERVIEW_CONFIRMATION":
      return PHRASES_INTERVIEW_CONFIRMATION_MEDIUM;
    case "RECEIVED_ASSESSMENT_REQUEST":
      return PHRASES_ASSESSMENT_MEDIUM;
    case "RECEIVED_REJECTION":
      return PHRASES_REJECTION_MEDIUM;
    case "RECEIVED_OFFER":
      return PHRASES_OFFER_MEDIUM;
    case "RECEIVED_FOLLOW_UP":
      return PHRASES_FOLLOW_UP_MEDIUM;
    case "RECEIVED_WITHDRAWAL_CONFIRMATION":
      return PHRASES_WITHDRAWAL_MEDIUM;
    default:
      return [];
  }
}
