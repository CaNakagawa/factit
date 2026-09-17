# Fact It - Current Milestone

## CURRENT

V0.9 - Security Hardening

## Objective

Adversarial pass over the PLAN.md list; fix what breaks; document the
threat model and its test coverage.

## Tasks

- [x] Transport: `redirect: "error"`, `credentials: "omit"`, response
      body capped at 2 MB (streamed), model name capped
- [x] Prompt envelope: every field coerced and bounded in buildPrompt
      (message-boundary defence)
- [x] Extraction: DOM node cap; noise widgets (aside, players, iframes,
      forms, related/teaser/newsletter/share/cookie/paywall/advert)
      removed from the clone - also fixes the heise.de noise follow-up
- [x] In-page UI: spoofed host replaced; bar re-asserted on toolbar
      click; limitation documented
- [x] tests/unit/security.test.js: 17 adversarial cases (webpage,
      injection, model output, transport, custom endpoint, key
      leakage incl. prefix-less keys, oversized input, XSS)
- [x] SECURITY.md: trust boundaries, PLAN.md item -> defence -> tests
      table, known limitations

## Acceptance Criteria (PLAN.md V0.9 list)

- [x] prompt injection
- [x] XSS
- [x] malformed LLM output
- [x] malicious webpage content
- [x] invalid providers
- [x] custom endpoint abuse
- [x] API key leakage
- [x] extraction failures
- [x] oversized articles
- [x] permission requirements

## Status

V0.9 complete on 2026-09-17. 109 unit tests, 23 smoke checks.

Notes:

- The noise selector is class-substring based ("related", "player",
  ...); it can occasionally drop legitimate content on unusual sites.
  It only affects the clone handed to Readability.
- No change to permissions.

## NEXT

V1.0 - MVP release (see PLAN.md). Not started.

## DO NOT IMPLEMENT YET

- Evidence Engine
- Community
- Authentication
- Database
- Reputation
