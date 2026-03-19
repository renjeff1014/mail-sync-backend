/**
 * Map email type to suggested application status.
 */

import type { ApplicationEmailType } from "./types";

const MAP: Record<Exclude<ApplicationEmailType, "UNKNOWN">, string> = {
  RECEIVED_APPLICATION_CONFIRMATION: "APPLIED",
  RECEIVED_APPLICATION_REPLY: "IN_PROGRESS",
  RECEIVED_INTRO_REQUEST: "INTRO_REQUESTED",
  RECEIVED_SCHEDULING_REQUEST: "SCHEDULING_IN_PROGRESS",
  RECEIVED_INTERVIEW_CONFIRMATION: "INTERVIEW_SCHEDULED",
  RECEIVED_ASSESSMENT_REQUEST: "ASSESSMENT_PENDING",
  RECEIVED_REJECTION: "REJECTED",
  RECEIVED_OFFER: "OFFER_RECEIVED",
  RECEIVED_FOLLOW_UP: "FOLLOW_UP",
  RECEIVED_WITHDRAWAL_CONFIRMATION: "WITHDRAWN",
};

export function mapEmailTypeToStatus(type: ApplicationEmailType): string | undefined {
  if (type === "UNKNOWN") return undefined;
  return MAP[type];
}
