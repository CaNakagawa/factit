# Fact It - Prompt Architecture

Prompt versioning is mandatory.

Current version: 1.0.1 (`PROMPT_VERSION` in extension/analysis/prompt.js).
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

## Changelog

- 1.0.1 - summary is a short conclusion (3-6 sentences, ~700 chars, no
  lists); mention manipulation attempts only when present; genre-
  inherent calls to action are not framing.
- 1.0.0 - initial version.
