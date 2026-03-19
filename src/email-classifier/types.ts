/**
 * Email classifier types.
 * Classifies an email (known to be relevant to a job) into an application lifecycle type.
 */

export type ApplicationEmailType =
  | "RECEIVED_APPLICATION_CONFIRMATION"
  | "RECEIVED_APPLICATION_REPLY"
  | "RECEIVED_INTRO_REQUEST"
  | "RECEIVED_SCHEDULING_REQUEST"
  | "RECEIVED_INTERVIEW_CONFIRMATION"
  | "RECEIVED_ASSESSMENT_REQUEST"
  | "RECEIVED_REJECTION"
  | "RECEIVED_OFFER"
  | "RECEIVED_FOLLOW_UP"
  | "RECEIVED_WITHDRAWAL_CONFIRMATION"
  | "UNKNOWN";

export type EmailMessage = {
  messageId: string;
  threadId?: string;
  fromEmail?: string;
  fromName?: string;
  subject?: string;
  bodyText?: string;
  snippet?: string;
  receivedAt?: string | Date;
  urls?: string[];
  attachments?: { filename?: string; mimeType?: string }[];
  calendarInvite?: {
    startTime?: string | Date;
    meetingUrl?: string;
    title?: string;
  };
};

export type LinkedJob = {
  company?: string;
  title?: string;
};

export type ThreadContext = {
  previousTypes?: ApplicationEmailType[];
};

export type ConfidenceLabel = "HIGH" | "MEDIUM" | "LOW" | "AMBIGUOUS";

export type EmailTypeResult = {
  type: ApplicationEmailType;
  confidence: number;
  label: ConfidenceLabel;
  statusSuggestion?: string;
  usedLlmFallback: boolean;
  reasons: string[];
  scores: Record<ApplicationEmailType, number>;
};

/** Features extracted from an email for classification (explainable, deterministic). */
export type EmailTypeFeatures = {
  mergedText: string;
  subjectText: string;
  bodyText: string;
  snippetText: string;
  senderDomain: string;
  senderLooksRecruiting: boolean;
  senderMatchesLinkedCompany: boolean;
  urlDomains: string[];
  hasSchedulingLink: boolean;
  hasAssessmentLink: boolean;
  hasOfferAttachment: boolean;
  hasCalendarInvite: boolean;
  hasMeetingUrl: boolean;
  hasDateTimeMention: boolean;
  keywordHits: Partial<Record<ApplicationEmailType, string[]>>;
  hasConfirmationPhrase: boolean;
  hasIntroPhrase: boolean;
  hasSchedulingPhrase: boolean;
  hasInterviewConfirmPhrase: boolean;
  hasAssessmentPhrase: boolean;
  hasRejectionPhrase: boolean;
  hasOfferPhrase: boolean;
  hasFollowUpPhrase: boolean;
  hasWithdrawalPhrase: boolean;
  mentionsAvailability: boolean;
  mentionsInterview: boolean;
  mentionsApply: boolean;
  mentionsDecision: boolean;
  mentionsCompensation: boolean;
  mentionsWithdraw: boolean;
};

/** All application email types except UNKNOWN (for score maps). */
export const APPLICATION_EMAIL_TYPES: ApplicationEmailType[] = [
  "RECEIVED_APPLICATION_CONFIRMATION",
  "RECEIVED_APPLICATION_REPLY",
  "RECEIVED_INTRO_REQUEST",
  "RECEIVED_SCHEDULING_REQUEST",
  "RECEIVED_INTERVIEW_CONFIRMATION",
  "RECEIVED_ASSESSMENT_REQUEST",
  "RECEIVED_REJECTION",
  "RECEIVED_OFFER",
  "RECEIVED_FOLLOW_UP",
  "RECEIVED_WITHDRAWAL_CONFIRMATION",
  "UNKNOWN",
];
