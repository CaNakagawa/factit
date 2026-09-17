// Fact It - AnalysisResult schema (V0.5).
//
// Enumerations and limits from docs/ANALYSIS_SCHEMA.md. Used by the prompt
// (to describe the expected output) and by the validator (to enforce it).

export const ANALYSIS_SCHEMA_VERSION = "1.0";

// The only verification level the extension can produce. Future evidence
// engine results would introduce a different value; the validator always
// forces this one regardless of model output.
export const VERIFICATION_LEVEL = "AI_PRELIMINARY";

export const CLAIM_TYPES = Object.freeze(["FACTUAL", "ALLEGATION"]);

export const CLAIM_CLASSIFICATIONS = Object.freeze([
  "SUPPORTED",
  "MOSTLY_SUPPORTED",
  "PARTIALLY_SUPPORTED",
  "UNVERIFIED",
  "DISPUTED",
  "MISLEADING",
  "MOSTLY_FALSE",
  "FALSE",
  "INSUFFICIENT_EVIDENCE",
]);

export const FLAG_TYPES = Object.freeze([
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
  MAX_CLAIMS: 20,
  MAX_FLAGS: 20,
  MAX_CLAIM_TEXT_CHARS: 300,
  MAX_EXPLANATION_CHARS: 600,
  MAX_SUMMARY_CHARS: 1200,
});

// Human-readable shape handed to the model. Kept in one place so the
// prompt and the validator cannot drift apart.
export const OUTPUT_SHAPE = `{
  "analysis": {
    "overall_factual_support": <number 0.0-1.0>,
    "confidence": <number 0.0-1.0>
  },
  "claims": [
    {
      "text": "<the claim, quoted or closely paraphrased, max ${LIMITS.MAX_CLAIM_TEXT_CHARS} chars>",
      "type": "${CLAIM_TYPES.join('" | "')}",
      "classification": "${CLAIM_CLASSIFICATIONS.join('" | "')}",
      "confidence": <number 0.0-1.0>,
      "explanation": "<why, max ${LIMITS.MAX_EXPLANATION_CHARS} chars>"
    }
  ],
  "flags": [
    {
      "type": "${FLAG_TYPES.join('" | "')}",
      "explanation": "<what and where, max ${LIMITS.MAX_EXPLANATION_CHARS} chars>"
    }
  ],
  "framing": {
    "detected": <boolean>,
    "type": "${FRAMING_TYPES.join('" | "')}" | null,
    "strength": "${FRAMING_STRENGTHS.join('" | "')}" | null,
    "confidence": <number 0.0-1.0>,
    "explanation": "<max ${LIMITS.MAX_EXPLANATION_CHARS} chars, empty string if none>"
  },
  "summary": "<neutral overview of what deserves scrutiny, max ${LIMITS.MAX_SUMMARY_CHARS} chars>"
}`;
