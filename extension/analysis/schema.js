// Fact It - AnalysisResult schema 2.1 (concern detection).
//
// Enumerations and limits from docs/ANALYSIS_SCHEMA.md. Used by the prompt
// (to describe the expected output) and by the validator (to enforce it).
//
// Direction (ADR-008): Fact It looks for concrete signals that content may
// mislead the reader. The absence of external verification by Fact It is
// metadata, never a concern. "No significant concerns" is a valid, complete
// result. Every fact about a claim is generated once, on the claim
// (ADR-007); the UI derives all views from those records.

export const ANALYSIS_SCHEMA_VERSION = "2.1";
// Older results the cache may still hold; the validator migrates them.
export const ACCEPTED_SCHEMA_VERSIONS = Object.freeze(["1.0", "1.1", "1.2", "2.0", "2.1"]);

// The only verification level the extension can produce. A future Evidence
// Engine would introduce another value; the validator always forces this
// one regardless of model output.
export const VERIFICATION_LEVEL = "AI_PRELIMINARY";
// Likewise forced: nothing in V1 performs external verification. This is
// metadata about Fact It, not a statement about the article.
export const EXTERNAL_VERIFICATION = "NOT_PERFORMED";

// Overall status, derived by the validator from the concerns found. Never a
// truth verdict: it is the strength of warning signals detected.
export const STATUSES = Object.freeze([
  "NO_SIGNIFICANT_CONCERNS",
  "REVIEW_RECOMMENDED",
  "SIGNIFICANT_CONCERNS",
]);

export const CLAIM_TYPES = Object.freeze([
  "FACTUAL", // a statement of fact the article makes or reports
  "ALLEGATION", // an accusation; see `support` for whether the article asserts it or reports it
  "OPINION", // a judgment; only listed when presented as if it were fact
]);

// Status of the claim WITHIN THE ARTICLE. Says nothing about the world.
export const SUPPORT_LEVELS = Object.freeze([
  "ARTICLE_SUPPORTED", // the article shows evidence for it (document, data, quote)
  "PARTIALLY_ARTICLE_SUPPORTED", // some of it is shown, some is not
  "ATTRIBUTED", // clearly attributed to a named source; ordinary reporting
  "ALLEGATION_REPORTED", // the article reports that someone else alleges it, with attribution
  "UNSUPPORTED_WITHIN_ARTICLE", // asserted as fact with nothing shown and no attribution
  "INTERNALLY_CONTRADICTED", // other parts of the article contradict it
  "UNCLEAR", // cannot be judged from the text
]);

// How the claim is attributed in the article (source transparency).
export const ATTRIBUTIONS = Object.freeze(["CLEAR", "UNCLEAR", "NONE"]);

// What kind of support the article PRESENTS. Describes the article, not
// the truth.
export const EVIDENCE_TYPES = Object.freeze([
  "PRIMARY_DOCUMENT",
  "OFFICIAL_RECORD",
  "NAMED_SOURCE",
  "DIRECT_QUOTE",
  "SECONDARY_SOURCE",
  "ANONYMOUS_SOURCE",
  "UNIDENTIFIED_REPORT",
  "ARTICLE_ASSERTION",
  "NO_EVIDENCE_SHOWN",
  "UNKNOWN",
]);

// Concern codes with their severity. A concern exists only when the content
// gives a concrete reason. Severity drives the overall status.
export const CONCERN_SEVERITY = Object.freeze({
  // Significant: the content conflicts with itself or with what it presents.
  HEADLINE_CONTRADICTS_BODY: "SIGNIFICANT",
  INTERNAL_CONTRADICTION: "SIGNIFICANT",
  NUMERICAL_INCONSISTENCY: "SIGNIFICANT",
  UNSUPPORTED_SERIOUS_ALLEGATION: "SIGNIFICANT", // serious accusation presented as established fact, no attribution
  SOURCE_CLAIM_MISMATCH: "SIGNIFICANT", // the cited source, as described, does not support the attributed claim
  CONCLUSION_CONFLICTS_WITH_EVIDENCE: "SIGNIFICANT",
  INVALID_CITATION: "SIGNIFICANT", // citation detectably wrong from the available content
  // Moderate: concrete reasons for caution.
  HEADLINE_OVERSTATEMENT: "MODERATE",
  AMBIGUOUS_ATTRIBUTION: "MODERATE", // attribution matters here and is unclear
  MISLEADING_STATISTIC: "MODERATE",
  MATERIAL_MISSING_CONTEXT: "MODERATE", // omission that changes the reading of the central claim
  OPINION_PRESENTED_AS_FACT: "MODERATE",
  SELECTIVE_EVIDENCE: "MODERATE",
  EXTRAORDINARY_CLAIM_UNSUPPORTED: "MODERATE",
  OUTDATED_INFORMATION: "MODERATE",
  MISLEADING_FRAMING: "MODERATE",
});
export const CONCERN_TYPES = Object.freeze(Object.keys(CONCERN_SEVERITY));

// Concern codes whose presence counts as a contradiction in the counters.
export const CONTRADICTION_CONCERNS = Object.freeze([
  "HEADLINE_CONTRADICTS_BODY",
  "INTERNAL_CONTRADICTION",
  "NUMERICAL_INCONSISTENCY",
  "CONCLUSION_CONFLICTS_WITH_EVIDENCE",
]);

export const FRAMING_TYPES = Object.freeze([
  "POLITICAL",
  "IDEOLOGICAL",
  "RELIGIOUS",
  "COMMERCIAL",
  "ACTIVIST",
  "CULTURAL",
  "OTHER",
]);

export const FRAMING_STRENGTHS = Object.freeze(["LOW", "MODERATE", "HIGH"]);

export const LIMITS = Object.freeze({
  MAX_CLAIMS: 15,
  MAX_CONCERNS: 10,
  MAX_CONCERNS_PER_CLAIM: 3,
  MAX_CLAIM_TEXT_CHARS: 240,
  MAX_FIELD_CHARS: 160, // evidence, gap, inference, concern note
  MAX_RATIONALE_CHARS: 240,
  MAX_SUMMARY_CHARS: 400,
  MAX_FRAMING_OBSERVATIONS: 4,
  MAX_OBSERVATION_CHARS: 100,
});

// Human-readable shape handed to the model. Kept in one place so the
// prompt and the validator cannot drift apart. Deliberately compact.
export const OUTPUT_SHAPE = `{
  "assessment": {
    "confidence": <0.0-1.0: your confidence in this analysis>,
    "rationale": "<1-2 sentences, max ${LIMITS.MAX_RATIONALE_CHARS} chars: why there are, or are not, concerns>"
  },
  "source_transparency": {
    "named_sources": <boolean: important claims are attributed to named people, organizations or documents>,
    "primary_references": <boolean: the article links or cites primary material such as advisories, filings, studies, official statements>,
    "direct_quotes": <boolean>
  },
  "claims": [
    {
      "id": "c1",
      "text": "<the claim, quoted or closely paraphrased, max ${LIMITS.MAX_CLAIM_TEXT_CHARS} chars>",
      "type": "${CLAIM_TYPES.join('" | "')}",
      "support": "${SUPPORT_LEVELS.join('" | "')}",
      "attribution": "${ATTRIBUTIONS.join('" | "')}",
      "evidence_type": "${EVIDENCE_TYPES.join('" | "')}",
      "evidence": "<what the article presents for it, a few words for ordinary claims, max ${LIMITS.MAX_FIELD_CHARS} chars; \\"\\" if nothing>",
      "concerns": ["<zero or more of: ${CONCERN_TYPES.join(", ")}>"],
      "gap": "<ONLY when there is a concern: what is missing or inconsistent, max ${LIMITS.MAX_FIELD_CHARS} chars; otherwise \\"\\">",
      "inference": "<ONLY when there is a concern: a possible reader inference the text invites but does not establish, max ${LIMITS.MAX_FIELD_CHARS} chars; otherwise \\"\\">"
    }
  ],
  "concerns": [
    { "type": "<one of the concern codes>", "note": "<concrete reason, max ${LIMITS.MAX_FIELD_CHARS} chars>", "claim_ids": ["c1"] }
  ],
  "framing": {
    "detected": <boolean: only with observable characteristics; topic alone is not framing>,
    "type": "${FRAMING_TYPES.join('" | "')}" | null,
    "strength": "${FRAMING_STRENGTHS.join('" | "')}" | null,
    "confidence": <0.0-1.0>,
    "observations": ["<observable textual characteristic, max ${LIMITS.MAX_OBSERVATION_CHARS} chars each, up to ${LIMITS.MAX_FRAMING_OBSERVATIONS}>"]
  },
  "summary": "<2-3 plain sentences, max ${LIMITS.MAX_SUMMARY_CHARS} chars: what, if anything, a reader should be aware of>"
}`;
