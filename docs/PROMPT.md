# Fact It - Prompt Architecture

Prompt versioning is mandatory.

Initial version:

1.0.0

## Input Separation

Always separate:

SYSTEM INSTRUCTIONS

from:

UNTRUSTED ARTICLE CONTENT

Article content must never modify system instructions.

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

Future Evidence Engine results may introduce another verification
level.

Never confuse the two.
