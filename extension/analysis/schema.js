// Fact It - AnalysisResult schema 2.0 (claim-centric).
//
// Enumerations and limits from docs/ANALYSIS_SCHEMA.md. Used by the prompt
// (to describe the expected output) and by the validator (to enforce it).
//
// Design: every fact about a claim is generated ONCE, on the claim. The UI
// derives the banner, the summary, highlights, the side-by-side view and
// the detailed inspection from the same objects (ADR-007).

export const ANALYSIS_SCHEMA_VERSION = "2.0";
// Older results the cache may still hold; the validator migrates them.
export const ACCEPTED_SCHEMA_VERSIONS = Object.freeze(["1.0", "1.1", "1.2", "2.0"]);

// The only verification level the extension can produce. A future Evidence
// Engine would introduce another value; the validator always forces this
// one regardless of model output.
export const VERIFICATION_LEVEL = "AI_PRELIMINARY";
// Likewise forced: nothing in V1 performs external verification.
export const EXTERNAL_VERIFICATION = "NOT_PERFORMED";

export const CLAIM_TYPES = Object.freeze(["FACTUAL", "ALLEGATION"]);

// How well the ARTICLE supports the claim. Never a statement about the
// world: "supported" means supported within the article.
export const SUPPORT_LEVELS = Object.freeze([
  "ARTICLE_SUPPORTED", // evidence presented in the article backs it
  "PARTIALLY_ARTICLE_SUPPORTED", // some of it is backed, some is not
  "ATTRIBUTED", // attributed to a source; no evidence shown
  "EVIDENCE_GAP", // asserted; the article shows nothing for it
  "UNVERIFIED", // cannot be judged from the article at all
  "INSUFFICIENT_EVIDENCE", // the article gives too little to go on
  "CONTRADICTED_IN_ARTICLE", // other parts of the article contradict it
  "MISLEADING_PRESENTATION", // the article's own data/quotes do not support the way it is stated
]);

// What kind of support the article PRESENTS for the claim. Describes the
// article, not the truth.
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

// Issue codes. Attached to claims (claims[].issues) or, when they concern
// the article as a whole, listed in issues[] with claim_ids references.
export const ISSUE_TYPES = Object.freeze([
  "MISSING_CONTEXT",
  "UNSUPPORTED_ACCUSATION",
  "OUTDATED_INFORMATION",
  "STATISTICAL_MISREPRESENTATION",
  "HEADLINE_CONTENT_MISMATCH",
  "UNATTRIBUTED_CLAIM",
  "WEAK_SOURCE",
  "CONTRADICTORY_STATEMENTS",
  "OPINION_PRESENTED_AS_FACT",
  "SELECTIVE_EVIDENCE",
  "UNKNOWN_SOURCE",
  "EXTERNAL_VERIFICATION_REQUIRED",
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
  MAX_ISSUES: 10,
  MAX_ISSUES_PER_CLAIM: 4,
  MAX_CLAIM_TEXT_CHARS: 240,
  MAX_FIELD_CHARS: 160, // evidence, gap, inference, issue note
  MAX_RATIONALE_CHARS: 240,
  MAX_SUMMARY_CHARS: 400,
  MAX_FRAMING_OBSERVATIONS: 4,
  MAX_OBSERVATION_CHARS: 100,
});

// Human-readable shape handed to the model. Kept in one place so the
// prompt and the validator cannot drift apart. Deliberately compact.
export const OUTPUT_SHAPE = `{
  "assessment": {
    "article_support": <0.0-1.0: how well the article supports its own factual claims>,
    "confidence": <0.0-1.0: your confidence in this assessment>,
    "rationale": "<1-2 sentences, max ${LIMITS.MAX_RATIONALE_CHARS} chars: what in the article does or does not back the claims>"
  },
  "claims": [
    {
      "id": "c1",
      "text": "<the claim, quoted or closely paraphrased, max ${LIMITS.MAX_CLAIM_TEXT_CHARS} chars>",
      "type": "${CLAIM_TYPES.join('" | "')}",
      "support": "${SUPPORT_LEVELS.join('" | "')}",
      "confidence": <0.0-1.0>,
      "evidence_type": "${EVIDENCE_TYPES.join('" | "')}",
      "evidence": "<what the article presents for it, max ${LIMITS.MAX_FIELD_CHARS} chars; \\"\\" if nothing>",
      "gap": "<what would be needed to establish it, max ${LIMITS.MAX_FIELD_CHARS} chars; \\"\\" if nothing>",
      "inference": "<possible reader inference the text invites but does not establish, max ${LIMITS.MAX_FIELD_CHARS} chars; \\"\\" if none>",
      "issues": ["<zero or more of: ${ISSUE_TYPES.join(", ")}>"],
      "external_verification_required": <boolean>
    }
  ],
  "issues": [
    { "type": "<one of the issue codes>", "note": "<max ${LIMITS.MAX_FIELD_CHARS} chars>", "claim_ids": ["c1"] }
  ],
  "framing": {
    "detected": <boolean>,
    "type": "${FRAMING_TYPES.join('" | "')}" | null,
    "strength": "${FRAMING_STRENGTHS.join('" | "')}" | null,
    "confidence": <0.0-1.0>,
    "observations": ["<observable textual characteristic, max ${LIMITS.MAX_OBSERVATION_CHARS} chars each, up to ${LIMITS.MAX_FRAMING_OBSERVATIONS}>"]
  },
  "summary": "<2-3 plain sentences for a reader in a hurry, max ${LIMITS.MAX_SUMMARY_CHARS} chars>"
}`;
