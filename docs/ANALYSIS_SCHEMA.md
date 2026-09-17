# Fact It - AnalysisResult

Schema Version: 1.0

Conceptual result:

{
  "schema_version": "1.0",

  "analysis": {
    "overall_factual_support": 0.0,
    "confidence": 0.0,
    "verification_level": "AI_PRELIMINARY"
  },

  "claims": [],

  "flags": [],

  "framing": {
    "detected": false,
    "type": null,
    "strength": null,
    "confidence": 0.0,
    "explanation": ""
  },

  "summary": ""
}

## Factual Support

overall_factual_support represents factual support only.

It must NOT include:

- political neutrality
- ideological neutrality
- religious neutrality
- community reputation

## Claim Classifications

SUPPORTED
MOSTLY_SUPPORTED
PARTIALLY_SUPPORTED
UNVERIFIED
DISPUTED
MISLEADING
MOSTLY_FALSE
FALSE
INSUFFICIENT_EVIDENCE

## Flags

Possible values:

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

Framing is independent from factuality.

Potential types:

POLITICAL
IDEOLOGICAL
RELIGIOUS
COMMERCIAL
ACTIVIST
CULTURAL
OTHER

Possible strength:

LOW
MODERATE
HIGH
