# Fact It - AnalysisResult

Schema Version: 1.0

Produced by `analyzeArticle` (extension/analysis/engine.js) from the
model's JSON after validation (extension/analysis/validator.js).
Enumerations live in extension/analysis/schema.js.

```
{
  "schema_version": "1.0",
  "analysis": {
    "overall_factual_support": 0.0,
    "confidence": 0.0,
    "verification_level": "AI_PRELIMINARY"
  },
  "claims": [
    { "text": "", "type": "FACTUAL", "classification": "UNVERIFIED", "confidence": 0.0, "explanation": "" }
  ],
  "flags": [
    { "type": "MISSING_CONTEXT", "explanation": "" }
  ],
  "framing": {
    "detected": false,
    "type": null,
    "strength": null,
    "confidence": 0.0,
    "explanation": ""
  },
  "summary": "",
  "meta": {
    "provider": "", "model": "", "prompt_version": "1.0.0", "schema_version": "1.0",
    "analyzed_at": "<ISO 8601>", "content_hash": "<sha256>", "truncated_input": false,
    "finish": "stop", "usage": { "input_tokens": 0, "output_tokens": 0 } | null,
    "validation_issues": []
  }
}
```

## Trust boundary

Everything except `meta` originates from the model and is UNTRUSTED
until validated. The validator:

- forces `schema_version` and `analysis.verification_level`; the model
  cannot set them
- clamps every number to [0, 1]
- enforces every enumeration (case-insensitive match, otherwise the item
  is dropped and noted in `meta.validation_issues`)
- caps string lengths (claim text 300, explanations 600, summary 1200)
- caps `claims` and `flags` at 20 each
- drops unknown fields

`meta` is added by the engine, never by the model.

Strings are plain text. The UI must render them as text, never as HTML.

## Factual Support

`overall_factual_support` represents factual support only: how well the
article's factual claims are supported within the article.

It must NOT include:

- political neutrality
- ideological neutrality
- religious neutrality
- community reputation

## Verification level

`AI_PRELIMINARY` is the only value the extension can produce. A future
Evidence Engine would introduce a different value. The two must never
be confused; the UI must always show the preliminary status.

## Claims

`type`: `FACTUAL` | `ALLEGATION` (an accusation against a person or
organization). Opinions are not claims; an opinion presented as fact
becomes an `OPINION_PRESENTED_AS_FACT` flag.

`classification`:

SUPPORTED
MOSTLY_SUPPORTED
PARTIALLY_SUPPORTED
UNVERIFIED
DISPUTED
MISLEADING
MOSTLY_FALSE
FALSE
INSUFFICIENT_EVIDENCE

`UNVERIFIED` and `INSUFFICIENT_EVIDENCE` are normal outcomes, not
failures.

## Flags

MISSING_CONTEXT
UNSUPPORTED_ACCUSATION
OUTDATED_INFORMATION
STATISTICAL_MISREPRESENTATION
HEADLINE_CONTENT_MISMATCH
UNATTRIBUTED_CLAIM
WEAK_SOURCE
CONTRADICTORY_STATEMENTS
OPINION_PRESENTED_AS_FACT
SELECTIVE_EVIDENCE
UNKNOWN_SOURCE
EXTERNAL_VERIFICATION_REQUIRED

## Framing

Framing is independent from factuality. When `detected` is false,
`type` and `strength` are null.

Types:

POLITICAL
IDEOLOGICAL
RELIGIOUS
COMMERCIAL
ACTIVIST
CULTURAL
OTHER

Strength:

LOW
MODERATE
HIGH
