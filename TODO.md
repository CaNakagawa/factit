# Fact It - Current Milestone

## CURRENT

V1.0 - MVP release

## Objective

Release the first usable Fact It extension.

## Tasks

- [x] Icons 16/32/48/128 (`npm run icons`, committed PNGs)
- [x] Manifest: version 1.0.0, icons, action icon, store-length
      description, minimum_chrome_version 116
- [x] `npm run package` -> dist/factit-1.0.0.zip (runs unit tests
      first; refuses version mismatch)
- [x] README rewritten for end users (install, providers, costs,
      reading the result, privacy, development)
- [x] LICENSE (MIT), CHANGELOG.md, docs/RELEASE.md checklist
- [x] Manifest test: icons exist, description <= 132 chars, versions
      in sync

## Acceptance Criteria

- [x] A user can install the zip, configure a provider, analyze an
      article and read the result without reading the source.
- [x] Explicitly excluded from V1: Community, Evidence Engine, user
      accounts, reputation, Trust & Abuse backend, any Fact It
      backend.

## Status

V1.0.0 packaged on 2026-09-18. 116 unit tests, 23 smoke checks.

Remaining manual step (docs/RELEASE.md step 6/8): a final pass in a
real browser with a real key on the packaged zip, then tag v1.0.0.

## After V1.0

### 1.3.0 (2026-09-18) - concern detection (ADR-008)

- External verification is metadata, never a concern; status derived
  from concerns; no percentage; "no significant concerns" valid.
- Schema 2.1 / prompt 2.1.0; 2.0 and 1.x cache entries migrate.
- Regression cases 1-7 in tests/unit/concerns.test.js; 141 unit tests,
  26 smoke checks.
- Not yet re-run on the live cybersecurity article (needs a key);
  expected result: green, 0 concerns, verification NOT_PERFORMED.

### 1.2.0 (2026-09-18) - progressive disclosure and schema 2.0

- Banner: `Article support: 72% · 5 need review · Details`; framing
  never in the indicator.
- Summary panel (level 2) then Detailed analysis tabs (level 3);
  token/cost/provider metadata under About.
- Schema 2.0 claim-centric (ADR-007): within-article support levels,
  evidence types, issue codes, possible reader inference, observable
  framing; prompt 2.0.0 requests each fact once (~half the output
  tokens on a synthetic 20-claim article).
- 1.x cache entries migrate on read; About shows the note and offers
  Re-analyze.
- Tests: 131 unit (schema, migration, derive, panel views, XSS across
  every view), 26 smoke checks (Details -> Summary -> Detailed ->
  Claims with real clicks).

### 1.1.0 (2026-09-18, user requests)

- analysis.rationale + explanations for supported claims
  (prompt 1.2.0 / schema 1.2)
- Token usage and estimated cost per request in the panel; price
  settings (Anthropic pre-filled), running totals with reset on the
  settings page

Not scheduled. Candidates, in no order:

- UI language following the browser locale (strings are English)
- Optional "analyze automatically" setting, safe now that the cache
  exists
- Anthropic / OpenAI structured-output modes for fewer invalid_output
  cases on weaker models
- Retry-with-repair when the model returns near-valid JSON
- Phase 2: Evidence Engine (PLAN.md V2)

## DO NOT IMPLEMENT (V1 scope)

- Evidence Engine
- Community
- Authentication
- Database
- Reputation
