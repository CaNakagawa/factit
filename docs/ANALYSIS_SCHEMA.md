# Fact It - AnalysisResult

Schema Version: 2.0 (claim-centric; see DECISIONS.md ADR-007)

Produced by `analyzeArticle` (extension/analysis/engine.js) from the
model's JSON after validation (extension/analysis/validator.js).
Enumerations live in extension/analysis/schema.js. Every view in the UI
(banner, summary, highlights, side-by-side, detailed claims) is derived
from the same claim records by extension/ui/derive.js; nothing is
generated twice.

```
{
  "schema_version": "2.0",
  "assessment": {
    "article_support": 0.0,
    "confidence": 0.0,
    "rationale": "",
    "verification_level": "AI_PRELIMINARY",
    "external_verification": "NOT_PERFORMED"
  },
  "claims": [
    {
      "id": "c1",
      "text": "",
      "type": "FACTUAL",
      "support": "ATTRIBUTED",
      "confidence": 0.0,
      "evidence_type": "NAMED_SOURCE",
      "evidence": "",
      "gap": "",
      "inference": "",
      "issues": ["EXTERNAL_VERIFICATION_REQUIRED"],
      "external_verification_required": true
    }
  ],
  "issues": [
    { "type": "HEADLINE_CONTENT_MISMATCH", "note": "", "claim_ids": ["c1"] }
  ],
  "framing": {
    "detected": false,
    "type": null,
    "strength": null,
    "confidence": 0.0,
    "observations": []
  },
  "summary": "",
  "meta": {
    "provider": "", "model": "", "prompt_version": "2.0.0", "schema_version": "2.0",
    "analyzed_at": "<ISO 8601>", "content_hash": "<sha256>", "truncated_input": false,
    "finish": "stop", "usage": { "input_tokens": 0, "output_tokens": 0 } | null,
    "validation_issues": [], "migrated_from": null | "1.0" | "1.1" | "1.2"
  }
}
```

## Trust boundary

Everything except `meta` originates from the model and is UNTRUSTED
until validated. The validator:

- forces `schema_version`, `assessment.verification_level` and
  `assessment.external_verification`; the model cannot set them
- assigns claim ids itself (`c1..cN`) and resolves the model's own ids
  only to map `issues[].claim_ids`
- clamps every number to [0, 1], enforces every enumeration (case-
  insensitive; invalid items are dropped and noted in
  `meta.validation_issues`), caps strings and lists, drops unknown
  fields

`meta` is added by the engine, never by the model. Strings are plain
text; the UI renders them with `textContent`, never as HTML.

## Article support

`assessment.article_support` is how well the article supports its own
factual claims: attribution, evidence shown, internal consistency. It
is **not** a truth score and it must not reflect political, ideological
or religious neutrality, or the source's reputation. `rationale` (max
240 chars) says what does or does not back the claims.

## Verification level

`AI_PRELIMINARY` with `external_verification: NOT_PERFORMED` is the only
combination the extension can produce. A future Evidence Engine would
introduce other values; the UI states the current level once in the
summary and in the About tab.

## Claims

| Field | Values / limit | Meaning |
|---|---|---|
| `id` | `c1..c15` | Assigned by the validator. |
| `text` | ≤ 240 chars | The claim, quoted or closely paraphrased. |
| `type` | `FACTUAL`, `ALLEGATION` | Allegation = accusation against a person or organization. |
| `support` | `ARTICLE_SUPPORTED`, `PARTIALLY_ARTICLE_SUPPORTED`, `ATTRIBUTED`, `EVIDENCE_GAP`, `UNVERIFIED`, `INSUFFICIENT_EVIDENCE`, `CONTRADICTED_IN_ARTICLE`, `MISLEADING_PRESENTATION` | How well the article backs it. "Supported" always means within the article. `UNVERIFIED` and `INSUFFICIENT_EVIDENCE` are normal outcomes. |
| `confidence` | 0–1 | Model confidence in this record. |
| `evidence_type` | `PRIMARY_DOCUMENT`, `OFFICIAL_RECORD`, `NAMED_SOURCE`, `DIRECT_QUOTE`, `SECONDARY_SOURCE`, `ANONYMOUS_SOURCE`, `UNIDENTIFIED_REPORT`, `ARTICLE_ASSERTION`, `NO_EVIDENCE_SHOWN`, `UNKNOWN` | The kind of support the article **presents**. Describes the article, not the truth. |
| `evidence` | ≤ 160 chars | What the article presents for the claim. |
| `gap` | ≤ 160 chars | What would be needed to establish it. |
| `inference` | ≤ 160 chars | A *possible reader inference* the text invites but does not establish. A textual observation; never a claim about author intent or reader state. |
| `issues` | ≤ 4 codes | Issue codes that apply to this claim (see below). |
| `external_verification_required` | boolean | True when a reader should check outside the article; also set by the `EXTERNAL_VERIFICATION_REQUIRED` code. |

UI labels: Supported within article · Partially supported within article ·
Attributed to a source · Evidence not shown · Not verifiable from the
article · Insufficient evidence · Contradicted within article ·
Misleading presentation.

Derived buckets (ui/derive.js), by priority: **issue** (support in
EVIDENCE_GAP / INSUFFICIENT_EVIDENCE / CONTRADICTED_IN_ARTICLE /
MISLEADING_PRESENTATION, or any structural issue code) → **verify**
(ATTRIBUTED, UNVERIFIED, or external verification required) →
**supported** (ARTICLE_SUPPORTED, PARTIALLY_ARTICLE_SUPPORTED). The
banner's "N need review" is verify + issue.

## Issues

Codes: MISSING_CONTEXT, UNSUPPORTED_ACCUSATION, OUTDATED_INFORMATION,
STATISTICAL_MISREPRESENTATION, HEADLINE_CONTENT_MISMATCH,
UNATTRIBUTED_CLAIM, WEAK_SOURCE, CONTRADICTORY_STATEMENTS,
OPINION_PRESENTED_AS_FACT, SELECTIVE_EVIDENCE, UNKNOWN_SOURCE,
EXTERNAL_VERIFICATION_REQUIRED.

Claim-level issues live in `claims[].issues` (codes only; the claim's
own fields carry the substance). `issues[]` (max 10) is for problems
about the article as a whole, with a short `note` (≤ 160) and optional
`claim_ids`.

## Framing

Independent from article support and never affects it. When
`detected`, `observations` (max 4 × 100 chars) list observable textual
characteristics: source selection, ordering, emphasis, omitted
counterarguments, loaded terminology, prominence of one interpretation.
No inference about the author's or the publication's ideology.

Types: POLITICAL, IDEOLOGICAL, RELIGIOUS, COMMERCIAL, ACTIVIST, CULTURAL,
OTHER. Strength: LOW, MODERATE, HIGH.

## Summary

2–3 plain sentences, max 400 chars: what the article backs, what it
does not, what is most worth checking.

## Backward compatibility

Results stored under schema 1.0–1.2 are migrated on read
(`validator.migrateLegacy`): `classification` → `support`
(SUPPORTED/MOSTLY_SUPPORTED → ARTICLE_SUPPORTED, PARTIALLY_SUPPORTED →
PARTIALLY_ARTICLE_SUPPORTED, DISPUTED/FALSE/MOSTLY_FALSE →
CONTRADICTED_IN_ARTICLE, MISLEADING → MISLEADING_PRESENTATION),
`explanation` → `evidence`, `missing_information` → `gap`, `implied` →
`inference`, `basis` → `evidence_type` (OPINION → ARTICLE_ASSERTION,
ASSUMPTION → NO_EVIDENCE_SHOWN, otherwise UNKNOWN), `flags` →
article-level `issues`, framing `explanation` → one observation.
`meta.migrated_from` records the source version and the About tab
offers Re-analyze. Nothing is invented during migration.
