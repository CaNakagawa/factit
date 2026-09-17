# Fact It - Current Milestone

## CURRENT

V0.1 - Chrome Extension Shell

## Objective

Create the smallest valid Manifest V3 extension.

## Tasks

- [x] Create manifest.json
- [x] Create service worker
- [x] Create content script
- [x] Create settings page
- [x] Load extension manually in Chromium/Chrome
      (loaded unpacked in Chromium on 2026-09-17; also covered by
      `npm run test:smoke`)
- [x] Verify service worker
- [x] Verify content script
- [x] Document development installation (docs/DEVELOPMENT.md)

## Acceptance Criteria

- [x] Chrome accepts the extension without errors.
- [x] Content script executes on a normal webpage.
- [x] Settings page opens.
- [x] No unnecessary permissions are requested (`permissions: []`,
      no `host_permissions`; content script limited to http/https).

## Status

V0.1 complete on 2026-09-17.

Notes:

- `permissions` is empty. The only access granted is the content
  script match on `http://*/*` and `https://*/*`, documented in
  docs/DEVELOPMENT.md.
- `tests/unit/manifest.test.js` guards the permission set and
  referenced files. `tests/integration/smoke.mjs` loads the
  extension in headless Chromium.
- Branded Google Chrome 137+ ignores `--load-extension`; automated
  browser checks use Chromium.

## NEXT

V0.2 - Article Extraction (see PLAN.md). Not started.

## DO NOT IMPLEMENT YET

- OpenAI
- Anthropic
- AI analysis
- Readability
- Fact It bar
- Evidence Engine
- Community
- Authentication
- Database
- Reputation
