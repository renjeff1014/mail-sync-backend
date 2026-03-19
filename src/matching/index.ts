/**
 * Email-to-job matching: score and rank emails against saved job applications.
 */

export {
  buildJobFeatures,
  buildEmailFeatures,
  scoreEmailJobMatch,
  rankEmailAgainstJobs,
  normalizeText,
  normalizeCompanyName,
  tokenize,
  extractDomain,
  extractRootDomain,
  safeArray,
  uniqueStrings,
  buildCompanyAliases,
  buildTitleAliases,
} from "./jobEmailMatcher";

export type {
  EmailMessage,
  JobResultStub,
  CompanyResultStub,
  JobForMatching,
  MatchHistory,
  MatchLabel,
  MatchResult,
  JobFeatures,
  EmailFeatures,
} from "./jobEmailMatcher";
