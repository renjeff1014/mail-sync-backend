/**
 * Email type classifier: deterministic classification of job-application-related emails.
 */

export {
  buildEmailTypeFeatures,
  classifyRelevantEmailType,
  mapEmailTypeToStatus,
} from "./classifier";
export type {
  ApplicationEmailType,
  EmailMessage,
  LinkedJob,
  ThreadContext,
  EmailTypeResult,
  EmailTypeFeatures,
  ConfidenceLabel,
} from "./types";
export { APPLICATION_EMAIL_TYPES } from "./types";
