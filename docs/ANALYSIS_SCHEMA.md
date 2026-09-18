# Fact It - AnalysisResult

Schema Version: 2.1 (claim-centric, concern detection; see DECISIONS.md ADR-007 and ADR-008)

Produced by `analyzeArticle` (extension/analysis/engine.js) from the
model's JSON after validation (extension/analysis/validator.js).
Enumerations live in extension/analysis/schema.js. Every view in the UI
(banner, summary, highlights, side-by-side, detailed claims) is derived
from the same claim records by extension/ui/derive.js; nothing is
generated twice.

```
{
  "schema_version": "2.1",
  "assessment": {
    "status": "NO_SIGNIFICANT_CONCERNS",
    "confidence": 0.0,
    "rationale": "",
    "verification_level": "AI_PRELIMINARY",
    "external_verification": "NOT_PERFORMED"
  },
  "source_transparency": { "named_sources": true, "primary_references": true, "direct_quotes": false },
  "claims": [
    {
      "id": "c1",
      "text": "",
      "type": "FACTUAL",
      "support": "ATTRIBUTED",
      "attribution": "CLEAR",
      "evidence_type": "NAMED_SOURCE",
      "evidence": "",
      "concerns": [],
      "gap": "",
      "inference": ""
    }
  ],
  "concerns": [
    { "type": "HEADLINE_OVERSTATEMENT", "severity": "MODERATE", "note": "", "claim_ids": ["c1"] }
  ],
  "framing": { "detected": false, "type": null, "strength": null, "confidence": 0.0, "observations": [] },
  "summary": "",
  "meta": {
    "provider": "", "model": "", "prompt_version": "2.1.0", "schema_version": "2.1",
    "analyzed_at": "<ISO 8601>", "content_hash": "<sha256>", "truncated_input": false,
    "finish": "stop", "usage": { "input_tokens": 0, "output_tokens": 0 } | null,
    "validation_issues": [], "migrated_from": null | "1.0" | "1.1" | "1.2" | "2.0"
  }
}
```

## Trust boundary

Everything except `meta` originates from the model and is UNTRUSTED
until validated. The validator:

- forces `schema_version`, `assessment.verification_level` and
  `assessment.external_verification`; the model cannot set them
- derives `assessment.status` from the concerns found; the model
  cannot set it
- downgrades `framing.detected` to false when no observation is given
- assigns claim ids itself (`c1..cN`) and resolves the model's own ids
  only to map `issues[].claim_ids`
- clamps every number to [0, 1], enforces every enumeration (case-
  insensitive; invalid items are dropped and noted in
  `meta.validation_issues`), caps strings and lists, drops unknown
  fields

`meta` is added by the engine, never by the model. Strings are plain
text; the UI renders them with `textContent`, never as HTML.

## Status (ADR-008)

`assessment.status` is the strength of warning signals detected, never
a truth verdict:

| Status | When |
|---|---|
| `NO_SIGNIFICANT_CONCERNS` | no concern code anywhere. A successful, complete result. |
| `REVIEW_RECOMMENDED` | at least one MODERATE concern, no SIGNIFICANT one |
| `SIGNIFICANT_CONCERNS` | at least one SIGNIFICANT concern |

`rationale` (max 240) says why there are, or are not, concerns.

## Verification level

`AI_PRELIMINARY` with `external_verification: NOT_PERFORMED` is the only
combination the extension can produce. It is metadata about Fact It. It
is never a concern, never changes the status, never counts anywhere,
and is shown once in the summary and in About.

## Claims

| Field | Values / limit | Meaning |
|---|---|---|
| `id` | `c1..c15` | Assigned by the validator. |
| `text` | ≤ 240 chars | The claim, quoted or closely paraphrased. |
| `type` | `FACTUAL`, `ALLEGATION`, `OPINION` | Opinion only when presented as if it were fact. |
| `support` | `ARTICLE_SUPPORTED`, `PARTIALLY_ARTICLE_SUPPORTED`, `ATTRIBUTED`, `ALLEGATION_REPORTED`, `UNSUPPORTED_WITHIN_ARTICLE`, `INTERNALLY_CONTRADICTED`, `UNCLEAR` | Status within the article. `ATTRIBUTED` is ordinary reporting; `ALLEGATION_REPORTED` is the article accurately reporting that someone else alleges something. Neither is a concern. |
| `attribution` | `CLEAR`, `UNCLEAR`, `NONE` | Whether the source is named. Observable; not reputation. |
| `evidence_type` | `PRIMARY_DOCUMENT`, `OFFICIAL_RECORD`, `NAMED_SOURCE`, `DIRECT_QUOTE`, `SECONDARY_SOURCE`, `ANONYMOUS_SOURCE`, `UNIDENTIFIED_REPORT`, `ARTICLE_ASSERTION`, `NO_EVIDENCE_SHOWN`, `UNKNOWN` | The kind of support the article **presents**. |
| `evidence` | ≤ 160 chars | A few words for ordinary claims. |
| `concerns` | ≤ 3 codes | Concern codes that apply to this claim. Empty for ordinary claims. |
| `gap` | ≤ 160 chars | Only with a concern: what is missing or inconsistent. |
| `inference` | ≤ 160 chars | Only with a concern: a *possible reader inference* the text invites but does not establish. Never intent. |

UI labels: Supported within article · Partially supported within article ·
Attributed reporting · Allegation reported, attributed · Unsupported
within article · Contradicted within article · Unclear from the article.

Derived buckets (ui/derive.js): **concern** (any SIGNIFICANT concern
or INTERNALLY_CONTRADICTED), **caution** (any MODERATE concern or
UNSUPPORTED_WITHIN_ARTICLE), **ok** (everything else, including
ATTRIBUTED, ALLEGATION_REPORTED and UNCLEAR). Only concerns color a
claim.

## Concerns

| Code | Severity |
|---|---|
| HEADLINE_CONTRADICTS_BODY, INTERNAL_CONTRADICTION, NUMERICAL_INCONSISTENCY, UNSUPPORTED_SERIOUS_ALLEGATION, SOURCE_CLAIM_MISMATCH, CONCLUSION_CONFLICTS_WITH_EVIDENCE, INVALID_CITATION | SIGNIFICANT |
| HEADLINE_OVERSTATEMENT, AMBIGUOUS_ATTRIBUTION, MISLEADING_STATISTIC, MATERIAL_MISSING_CONTEXT, OPINION_PRESENTED_AS_FACT, SELECTIVE_EVIDENCE, EXTRAORDINARY_CLAIM_UNSUPPORTED, OUTDATED_INFORMATION, MISLEADING_FRAMING | MODERATE |

Claim-level concerns live in `claims[].concerns` (codes only; the
claim's `gap` / `inference` carry the substance). `concerns[]` (max 10)
is for problems about the article as a whole, with a `note` (≤ 160)
and `claim_ids`. Severity is fixed per code. A concern exists only when
the content gives a concrete reason; empty lists are normal.

## Source transparency

`source_transparency` (booleans: named sources for important claims,
primary references, direct quotes) plus the ArticleDocument's author
and date are observable characteristics of the text. They never verify
a source and never rate a publication.

## Framing

Independent from the status and never affects it. `detected` requires
at least one observation (observable textual characteristic: source
selection, ordering, emphasis, omitted counter-information, loaded
terminology). The subject being political, commercial, religious or
controversial is not framing. Types: POLITICAL, IDEOLOGICAL, RELIGIOUS,
COMMERCIAL, ACTIVIST, CULTURAL, OTHER. Strength: LOW, MODERATE, HIGH.

## Summary

2–3 plain sentences, max 400 chars: what, if anything, a reader should
be aware of.

## Backward compatibility

Results stored under earlier schemas are migrated on read:

- **2.0 → 2.1** (`validator.migrate20`): `support` EVIDENCE_GAP /
  INSUFFICIENT_EVIDENCE → UNSUPPORTED_WITHIN_ARTICLE, UNVERIFIED /
  MISLEADING_PRESENTATION → UNCLEAR, CONTRADICTED_IN_ARTICLE →
  INTERNALLY_CONTRADICTED; `issues` codes → concern codes
  (MISSING_CONTEXT → MATERIAL_MISSING_CONTEXT, UNSUPPORTED_ACCUSATION →
  UNSUPPORTED_SERIOUS_ALLEGATION, STATISTICAL_MISREPRESENTATION →
  MISLEADING_STATISTIC, HEADLINE_CONTENT_MISMATCH →
  HEADLINE_OVERSTATEMENT, UNATTRIBUTED_CLAIM / WEAK_SOURCE /
  UNKNOWN_SOURCE → AMBIGUOUS_ATTRIBUTION, CONTRADICTORY_STATEMENTS →
  INTERNAL_CONTRADICTION); `external_verification_required` and the
  EXTERNAL_VERIFICATION_REQUIRED code are dropped (they were never
  concerns); `attribution` inferred from the evidence type; the status
  is re-derived; `article_support` is discarded.
- **1.x → 2.1** (`validator.migrateLegacy`): classification → support,
  explanation → evidence, missing_information → gap, implied →
  inference, basis → evidence_type / attribution, flags → concerns,
  framing explanation → one observation.

`meta.migrated_from` records the source version and About offers
Re-analyze. Nothing is invented during migration.
