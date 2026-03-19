/**
 * Email type classifier: deterministic, rule-based classification.
 * Given an email (known to be relevant to a job), returns the application lifecycle type.
 */

import type {
  ApplicationEmailType,
  ConfidenceLabel,
  EmailMessage,
  EmailTypeResult,
  LinkedJob,
  ThreadContext,
} from "./types";
import { APPLICATION_EMAIL_TYPES } from "./types";
import { buildEmailTypeFeatures } from "./features";
import { scoreType, applyConflictPenalties, applyThreadContextBoosts } from "./scoring";
import { mapEmailTypeToStatus } from "./status";

// ---------------------------------------------------------------------------
// Confidence thresholds
// ---------------------------------------------------------------------------

const CONFIDENCE_HIGH_MIN = 0.9;
const CONFIDENCE_HIGH_GAP = 0.12;
const CONFIDENCE_MEDIUM_MIN = 0.78;
const AMBIGUOUS_GAP = 0.08;
const UNKNOWN_TOP_THRESHOLD = 0.35;

/** Precedence when scores are close (higher index = higher precedence). */
const PRECEDENCE_ORDER: ApplicationEmailType[] = [
  "UNKNOWN",
  "RECEIVED_APPLICATION_REPLY",
  "RECEIVED_FOLLOW_UP",
  "RECEIVED_APPLICATION_CONFIRMATION",
  "RECEIVED_INTRO_REQUEST",
  "RECEIVED_SCHEDULING_REQUEST",
  "RECEIVED_INTERVIEW_CONFIRMATION",
  "RECEIVED_ASSESSMENT_REQUEST",
  "RECEIVED_WITHDRAWAL_CONFIRMATION",
  "RECEIVED_REJECTION",
  "RECEIVED_OFFER",
];

function precedenceRank(type: ApplicationEmailType): number {
  const i = PRECEDENCE_ORDER.indexOf(type);
  return i >= 0 ? i : 0;
}

/** Clamp all scores to [0, 1]. */
function clampScores(scores: Record<ApplicationEmailType, number>): Record<ApplicationEmailType, number> {
  const out = {} as Record<ApplicationEmailType, number>;
  for (const t of APPLICATION_EMAIL_TYPES) {
    out[t] = Math.max(0, Math.min(1, scores[t] ?? 0));
  }
  return out;
}

/** Build full score map for all types from features (before penalties/boosts). */
function computeRawScores(
  f: ReturnType<typeof buildEmailTypeFeatures>
): { scores: Record<ApplicationEmailType, number>; reasonMap: Partial<Record<ApplicationEmailType, string[]>> } {
  const scores = {} as Record<ApplicationEmailType, number>;
  const reasonMap: Partial<Record<ApplicationEmailType, string[]>> = {};
  for (const type of APPLICATION_EMAIL_TYPES) {
    const { score, reasons } = scoreType(type, f);
    scores[type] = score;
    if (reasons.length) reasonMap[type] = reasons;
  }
  return { scores, reasonMap };
}

/** Assign confidence label from top score and gap. */
function assignLabel(
  topScore: number,
  secondScore: number,
  topType: ApplicationEmailType
): ConfidenceLabel {
  const gap = topScore - secondScore;
  if (topType === "UNKNOWN") return "LOW";
  if (topScore >= CONFIDENCE_HIGH_MIN && gap >= CONFIDENCE_HIGH_GAP) return "HIGH";
  if (gap < AMBIGUOUS_GAP && topScore >= 0.2) return "AMBIGUOUS";
  if (topScore >= CONFIDENCE_MEDIUM_MIN) return "MEDIUM";
  return "LOW";
}

/** Resolve tie using precedence: return type with higher precedence. */
function resolveByPrecedence(
  type1: ApplicationEmailType,
  score1: number,
  type2: ApplicationEmailType,
  score2: number
): ApplicationEmailType {
  if (Math.abs(score1 - score2) >= 1e-6) return score1 >= score2 ? type1 : type2;
  return precedenceRank(type1) >= precedenceRank(type2) ? type1 : type2;
}

/**
 * Classify an email (known to be relevant to a job) into one of the application email types.
 */
export function classifyRelevantEmailType(
  email: EmailMessage,
  options?: { threadContext?: ThreadContext; linkedJob?: LinkedJob } | null
): EmailTypeResult {
  const linkedJob = options?.linkedJob;
  const threadContext = options?.threadContext;

  const f = buildEmailTypeFeatures(email, linkedJob);
  let { scores, reasonMap } = computeRawScores(f);
  scores = applyConflictPenalties(scores, f);
  scores = applyThreadContextBoosts(scores, f, threadContext);
  scores = clampScores(scores);

  const typesByScore = [...APPLICATION_EMAIL_TYPES].sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0));
  let topType = typesByScore[0]!;
  let secondType = typesByScore[1]!;
  let topScore = scores[topType] ?? 0;
  let secondScore = scores[secondType] ?? 0;

  topType = resolveByPrecedence(topType, topScore, secondType, secondScore);
  if (topType !== typesByScore[0]) {
    topScore = scores[topType] ?? 0;
    secondType = typesByScore[0] === topType ? typesByScore[1]! : typesByScore[0]!;
    secondScore = scores[secondType] ?? 0;
  }

  const unknownBase = 0.02;
  if (topScore < UNKNOWN_TOP_THRESHOLD) {
    topType = "UNKNOWN";
    topScore = scores.UNKNOWN ?? unknownBase;
  }

  const label = assignLabel(topScore, secondScore, topType);
  const reasons = reasonMap[topType] ?? [];
  if (topType !== "UNKNOWN" && reasons.length === 0 && topScore > 0) {
    reasons.push("score from phrase/link/sender signals");
  }
  if (topType === "UNKNOWN") {
    reasons.push("no strong type signals; score below threshold");
  }

  const statusSuggestion = mapEmailTypeToStatus(topType);

  const finalScores = { ...scores } as Record<ApplicationEmailType, number>;
  if (finalScores.UNKNOWN === undefined) finalScores.UNKNOWN = unknownBase;

  return {
    type: topType,
    confidence: topScore,
    label,
    statusSuggestion,
    usedLlmFallback: false,
    reasons,
    scores: finalScores,
  };
}

export { buildEmailTypeFeatures } from "./features";
export { mapEmailTypeToStatus } from "./status";
export type { EmailMessage, LinkedJob, ThreadContext, ApplicationEmailType, EmailTypeResult, EmailTypeFeatures } from "./types";
