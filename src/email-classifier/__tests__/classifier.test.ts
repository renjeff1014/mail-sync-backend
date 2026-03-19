/**
 * Unit tests for email type classifier.
 * Run with: npx ts-node src/email-classifier/__tests__/classifier.test.ts
 */

import assert from "node:assert";
import {
  buildEmailTypeFeatures,
  classifyRelevantEmailType,
  mapEmailTypeToStatus,
  type EmailMessage,
  type LinkedJob,
  type ThreadContext,
} from "../classifier";

function email(overrides: Partial<EmailMessage>): EmailMessage {
  return { messageId: "msg_1", ...overrides };
}

// ---------------------------------------------------------------------------
// Application confirmation: "thank you for applying"
// ---------------------------------------------------------------------------
function testConfirmation() {
  const e = email({
    subject: "We received your application",
    bodyText: "Thank you for applying to Acme Corp. We have received your application and will review it shortly.",
    snippet: "Thank you for applying",
  });
  const r = classifyRelevantEmailType(e);
  assert.strictEqual(r.type, "RECEIVED_APPLICATION_CONFIRMATION");
  assert.ok(r.confidence >= 0.35);
  assert.ok(r.reasons.length > 0);
  assert.strictEqual(mapEmailTypeToStatus(r.type), "APPLIED");
  console.log("  confirmation: type =", r.type, "confidence =", r.confidence.toFixed(3));
}

// ---------------------------------------------------------------------------
// Scheduling: Calendly link + availability request
// ---------------------------------------------------------------------------
function testScheduling() {
  const e = email({
    subject: "Schedule your interview",
    bodyText: "Please pick a time that works for you. When are you available next week? Use the link below to schedule. https://calendly.com/recruiter/john",
    urls: ["https://calendly.com/recruiter/john"],
  });
  const r = classifyRelevantEmailType(e);
  assert.strictEqual(r.type, "RECEIVED_SCHEDULING_REQUEST");
  assert.ok(r.confidence >= 0.4);
  assert.strictEqual(mapEmailTypeToStatus(r.type), "SCHEDULING_IN_PROGRESS");
  console.log("  scheduling: type =", r.type, "confidence =", r.confidence.toFixed(3));
}

// ---------------------------------------------------------------------------
// Interview confirmation: calendar invite + date/time
// ---------------------------------------------------------------------------
function testInterviewConfirmation() {
  const e = email({
    subject: "Interview confirmed - Monday 10am",
    bodyText: "Your interview has been scheduled. See you on Monday at 10:00 am. Calendar invite attached.",
    calendarInvite: { startTime: new Date(), meetingUrl: "https://meet.google.com/abc-def", title: "Interview" },
  });
  const r = classifyRelevantEmailType(e);
  assert.strictEqual(r.type, "RECEIVED_INTERVIEW_CONFIRMATION");
  assert.ok(r.confidence >= 0.5);
  assert.strictEqual(mapEmailTypeToStatus(r.type), "INTERVIEW_SCHEDULED");
  console.log("  interview confirmation: type =", r.type, "confidence =", r.confidence.toFixed(3));
}

// ---------------------------------------------------------------------------
// Assessment: HackerRank or CodeSignal
// ---------------------------------------------------------------------------
function testAssessment() {
  const e = email({
    subject: "Next step: Technical Assessment",
    bodyText: "Please complete the coding assessment at the link below. We use HackerRank for our technical screen. Complete within 48 hours.",
    urls: ["https://www.hackerrank.com/test/xyz"],
  });
  const r = classifyRelevantEmailType(e);
  assert.strictEqual(r.type, "RECEIVED_ASSESSMENT_REQUEST");
  assert.ok(r.confidence >= 0.4);
  assert.strictEqual(mapEmailTypeToStatus(r.type), "ASSESSMENT_PENDING");
  console.log("  assessment: type =", r.type, "confidence =", r.confidence.toFixed(3));
}

// ---------------------------------------------------------------------------
// Rejection: "unfortunately" + "not moving forward"
// ---------------------------------------------------------------------------
function testRejection() {
  const e = email({
    subject: "Update on your application",
    bodyText: "Unfortunately we have decided to move forward with other candidates whose experience more closely matches our needs. We wish you the best in your search.",
    snippet: "Unfortunately ... not moving forward",
  });
  const r = classifyRelevantEmailType(e);
  assert.strictEqual(r.type, "RECEIVED_REJECTION");
  assert.ok(r.confidence >= 0.4);
  assert.strictEqual(mapEmailTypeToStatus(r.type), "REJECTED");
  console.log("  rejection: type =", r.type, "confidence =", r.confidence.toFixed(3));
}

// ---------------------------------------------------------------------------
// Offer: offer letter / compensation package
// ---------------------------------------------------------------------------
function testOffer() {
  const e = email({
    subject: "Offer of Employment - Acme Corp",
    bodyText: "We are pleased to extend an offer of employment. Attached is your offer letter and compensation package. Please sign by Friday.",
    attachments: [{ filename: "Offer_Letter.pdf", mimeType: "application/pdf" }],
  });
  const r = classifyRelevantEmailType(e);
  assert.strictEqual(r.type, "RECEIVED_OFFER");
  assert.ok(r.confidence >= 0.5);
  assert.strictEqual(mapEmailTypeToStatus(r.type), "OFFER_RECEIVED");
  console.log("  offer: type =", r.type, "confidence =", r.confidence.toFixed(3));
}

// ---------------------------------------------------------------------------
// Withdrawal confirmation
// ---------------------------------------------------------------------------
function testWithdrawalConfirmation() {
  const e = email({
    subject: "Withdrawal confirmation",
    bodyText: "We have processed your withdrawal from the process. Your application has been withdrawn. Thank you for your interest.",
  });
  const r = classifyRelevantEmailType(e);
  assert.strictEqual(r.type, "RECEIVED_WITHDRAWAL_CONFIRMATION");
  assert.ok(r.confidence >= 0.35);
  assert.strictEqual(mapEmailTypeToStatus(r.type), "WITHDRAWN");
  console.log("  withdrawal: type =", r.type, "confidence =", r.confidence.toFixed(3));
}

// ---------------------------------------------------------------------------
// Generic reply
// ---------------------------------------------------------------------------
function testGenericReply() {
  const e = email({
    subject: "Regarding your application",
    bodyText: "Hi, we wanted to follow up on your application. Our team is reviewing and we will get back to you soon.",
  });
  const r = classifyRelevantEmailType(e);
  assert.ok(
    r.type === "RECEIVED_APPLICATION_REPLY" || r.type === "RECEIVED_FOLLOW_UP" || r.type === "RECEIVED_APPLICATION_CONFIRMATION"
  );
  assert.ok(r.scores.RECEIVED_APPLICATION_REPLY !== undefined || r.scores.RECEIVED_FOLLOW_UP !== undefined);
  console.log("  generic reply: type =", r.type, "confidence =", r.confidence.toFixed(3));
}

// ---------------------------------------------------------------------------
// Ambiguous case
// ---------------------------------------------------------------------------
function testAmbiguous() {
  const e = email({
    subject: "Next steps",
    bodyText: "We would like to schedule a quick call to discuss your background. When are you available? Let me know.",
  });
  const r = classifyRelevantEmailType(e);
  assert.ok(r.type !== "UNKNOWN" || r.label === "LOW");
  assert.ok(r.scores[r.type] !== undefined);
  console.log("  ambiguous: type =", r.type, "label =", r.label, "confidence =", r.confidence.toFixed(3));
}

// ---------------------------------------------------------------------------
// Thread-based upgrade: "confirmed" after scheduling
// ---------------------------------------------------------------------------
function testThreadBasedUpgrade() {
  const e = email({
    subject: "Re: Interview time",
    bodyText: "Confirmed! Works for me. See you then on Monday at 10am.",
    calendarInvite: { startTime: new Date("2026-04-01T14:00:00Z"), title: "Interview" },
  });
  const threadContext: ThreadContext = { previousTypes: ["RECEIVED_SCHEDULING_REQUEST"] };
  const r = classifyRelevantEmailType(e, { threadContext });
  assert.strictEqual(r.type, "RECEIVED_INTERVIEW_CONFIRMATION");
  assert.ok(r.confidence >= 0.5);
  console.log("  thread upgrade: type =", r.type, "confidence =", r.confidence.toFixed(3));
}

// ---------------------------------------------------------------------------
// Unknown case
// ---------------------------------------------------------------------------
function testUnknown() {
  const e = email({
    subject: "Fwd: Newsletter",
    bodyText: "Check out our latest blog post and product updates. Unsubscribe here.",
  });
  const r = classifyRelevantEmailType(e);
  assert.strictEqual(r.type, "UNKNOWN");
  assert.ok(r.confidence < 0.35 || r.confidence === r.scores.UNKNOWN);
  assert.strictEqual(mapEmailTypeToStatus(r.type), undefined);
  console.log("  unknown: type =", r.type, "confidence =", r.confidence.toFixed(3));
}

// ---------------------------------------------------------------------------
// buildEmailTypeFeatures
// ---------------------------------------------------------------------------
function testBuildFeatures() {
  const e = email({
    fromEmail: "recruiting@acme.com",
    subject: "Interview",
    bodyText: "Thank you for applying. Schedule here: https://calendly.com/abc",
    urls: ["https://calendly.com/abc"],
  });
  const f = buildEmailTypeFeatures(e, { company: "Acme", title: "Engineer" });
  assert.ok(f.mergedText.length > 0);
  assert.strictEqual(f.senderDomain, "acme.com");
  assert.ok(f.hasSchedulingLink);
  assert.ok(f.senderLooksRecruiting || f.urlDomains.length > 0);
  console.log("  buildEmailTypeFeatures: ok");
}

// ---------------------------------------------------------------------------
// Status mapping
// ---------------------------------------------------------------------------
function testStatusMapping() {
  assert.strictEqual(mapEmailTypeToStatus("RECEIVED_APPLICATION_CONFIRMATION"), "APPLIED");
  assert.strictEqual(mapEmailTypeToStatus("RECEIVED_REJECTION"), "REJECTED");
  assert.strictEqual(mapEmailTypeToStatus("RECEIVED_OFFER"), "OFFER_RECEIVED");
  assert.strictEqual(mapEmailTypeToStatus("UNKNOWN"), undefined);
  console.log("  status mapping: ok");
}

// ---------------------------------------------------------------------------
// usedLlmFallback always false
// ---------------------------------------------------------------------------
function testNoLlmFallback() {
  const r = classifyRelevantEmailType(email({ bodyText: "Thank you for applying." }));
  assert.strictEqual(r.usedLlmFallback, false);
  console.log("  usedLlmFallback: always false");
}

// ---------------------------------------------------------------------------
// Run all
// ---------------------------------------------------------------------------
function run() {
  console.log("Email classifier tests");
  testBuildFeatures();
  testStatusMapping();
  testConfirmation();
  testScheduling();
  testInterviewConfirmation();
  testAssessment();
  testRejection();
  testOffer();
  testWithdrawalConfirmation();
  testGenericReply();
  testAmbiguous();
  testThreadBasedUpgrade();
  testUnknown();
  testNoLlmFallback();
  console.log("All tests passed.");
}

run();
