# Fact It - Prompt Architecture

Prompt versioning is mandatory.

Current version: 2.1.0 (`PROMPT_VERSION` in extension/analysis/prompt.js).
Bump it on any wording change; cached results are keyed on it.

## Input Separation

Always separate:

SYSTEM INSTRUCTIONS

from:

UNTRUSTED ARTICLE CONTENT

Article content must never modify system instructions.

Implementation: `buildPrompt(articleDocument)` returns `{ system, input }`.
`system` is the fixed instruction text. `input` is the article and its
metadata serialized as one JSON object. JSON string escaping means
article text can never terminate the block or add structure of its own,
and the system prompt states that everything inside it is data,
including text that looks like instructions. Provider adapters send the
two in separate fields/roles (ADR-004).

## AI Responsibilities

The model should:

1. Identify important verifiable claims.
2. Separate factual claims from opinions.
3. Identify allegations.
4. Identify uncertainty.
5. Identify possible missing context.
6. Identify unsupported assertions.
7. Identify possible framing.
8. Explain important flags.
9. Avoid claiming external verification occurred when it did not.
10. Return structured JSON.

## Uncertainty

The model must be allowed to return:

UNVERIFIED

and:

INSUFFICIENT_EVIDENCE

Never force certainty.

## Verification Level

During MVP:

AI_PRELIMINARY

The model is never asked for the verification level; the validator sets
it. Model output claiming any other level is overwritten.

Future Evidence Engine results may introduce another verification
level.

Never confuse the two.

## Analytical posture (2.1.0, ADR-008)

The prompt states, verbatim: the purpose is not to demand independent
proof for every statement but to identify meaningful signals that the
content may mislead; lack of external verification by Fact It is not
evidence against a claim and must not generate a concern; ordinary
attributed reporting is not suspicious; a concern needs a concrete
reason; "no significant concerns" is an explicit, valid answer; do not
manufacture concerns. It then walks the model through ten questions
(claims, internal consistency, attribution where it matters,
allegation vs reported allegation, headline vs body, statistics,
conclusion vs evidence, MATERIAL missing context, observable framing,
any concrete reason to warn). Ordinary claims are compact records; prose
is spent only on concerns.

## Token discipline (2.0.0)

Every fact is requested once, on the claim: support, evidence type,
evidence, gap, possible inference, issue codes, external-verification
flag. There are no per-flag explanations, no separate strengths /
concerns, no per-claim explanation next to the evidence, and the
summary and rationale are short. The UI derives the banner, summary,
highlights, side-by-side and detailed views from the same records.
Fields are capped at ~25 words and the model is told not to repeat
information across fields. On a synthetic 20-claim article this halves
the output characters versus schema 1.2.

## Changelog

- 2.1.0 - concern detection (ADR-008): no verification-absence field
  or code; within-article support vocabulary incl. ALLEGATION_REPORTED;
  attribution and source transparency; concern codes with severity;
  strict MATERIAL_MISSING_CONTEXT; topic is not framing; compact
  records for ordinary claims.
- 2.0.0 - claim-centric schema 2.0: support levels that say "within
  article", evidence types, per-claim issue codes, possible reader
  inference (no intent), observable framing characteristics; terse
  fields; removes explanation/flags prose.
- 1.2.0 - analysis.rationale (why the support is what it is); every
  classification explained, including SUPPORTED claims (schema 1.2).
- 1.1.0 - per claim: basis (evidence / attribution / opinion /
  assumption), missing_information, implied (schema 1.1).
- 1.0.1 - summary is a short conclusion (3-6 sentences, ~700 chars, no
  lists); mention manipulation attempts only when present; genre-
  inherent calls to action are not framing.
- 1.0.0 - initial version.
