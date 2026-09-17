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
