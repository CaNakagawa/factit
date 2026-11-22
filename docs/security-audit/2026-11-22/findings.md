# Security audit — Fact It (factit browser extension)

Date: 2026-11-22 · Branch: `main` · Commit: `1d248f576d392bfd7b8f8c9e063db372ccc0690a`  
Method: `ai_sec.md` (8-phase evidence-based AppSec audit). Canonical source: `findings.json`.

## Executive summary

No new findings. SEC-SECRETS-001 from 2026-10-01 (API key readable from the content-script context through chrome.storage.local) is fixed: the service worker calls chrome.storage.local.setAccessLevel({accessLevel: 'TRUSTED_CONTEXTS'}) on every start, so content scripts can no longer read the store. The only new data sent to the page context is a boolean (hasApiKey). The full analysis result is no longer written to the page console. SEC-CHAIN-001 (informational: a custom OpenAI-compatible endpoint receives the article and key) is unchanged and remains a user-chosen design trade-off. npm audit shows 2 high advisories, both in transitive dev dependencies (jsdom/undici, source-map-js) that are not packaged into the extension.

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 0 |
| LOW | 0 |
| INFORMATIONAL | 0 |

Confirmed: 0 · Validation required: 0

## Architecture

```
WEB PAGE -> content script (isolated world: Readability extraction, top bar UI in shadow DOM)
  -> chrome.runtime message -> background service worker (settings, cache, usage)
  -> provider (Anthropic / OpenAI / Google / OpenAI-compatible base URL) with the user's API key
  -> structured JSON verdict -> validator -> content script panel
```

- Manifest V3 extension (Chrome >= 116), permissions: storage; content scripts on http/https pages
- API key in chrome.storage.local, read only in the service worker and extension pages
- Model output validated against a JSON schema before rendering

Trust boundaries:

- Web page content -> extractor -> model prompt (untrusted article text)
- Content script (page-adjacent) <-> service worker (holds the key)
- Model output -> panel rendering (untrusted)
- Extension -> user-chosen provider endpoint

## Attack surface

Unchanged structure since 2026-10-01. New in this period: a read-quality gate that skips thin pages before any provider call, a hasApiKey yes/no in FACTIT_UI_PREFS, prompt v2.2 classification rules, removal of full-result console logging.

- Messages from content scripts: FACTIT_UI_PREFS (language + hasApiKey boolean), analysis request (article document)
- Provider responses -> schema validator -> panel

## Findings

No findings. See the coverage report for what was reviewed.

## Security strengths

- **SEC-SECRETS-001 closed** — extension/background/service-worker.js:23 chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" }); manifest minimum_chrome_version 116 supports the API.
- **Key never crosses into the page world** — FACTIT_UI_PREFS returns { language, hasApiKey: boolean }; sender checked with isContentScript/isExtensionPage.
- **Less page-console exposure** — content-script.js: removed console.log of the full analysis result; summaries only.
- **No provider call on unread content** — readQuality() gate returns article_too_short before any request: no tokens spent, no verdict on text never read.
- **No new HTML sinks** — Added lines in ui/panel.js, ui/top-bar.js, options/* contain no innerHTML/insertAdjacentHTML/eval; rendering stays DOM/textContent based.

## Coverage report

| Area | Result | Detail |
|---|---|---|
| Discovery | Reviewed | 17 changed files since f69ddd8; manifest permissions unchanged (storage only). |
| A. Authentication | NOT APPLICABLE | No accounts; provider auth is the user's key. |
| B. Authorization | Reviewed (delta) | Message handlers keep sender checks; 1 handler changed (FACTIT_UI_PREFS), returns no secret. |
| C. Secrets | Reviewed | Key storage access level restricted; no keys in changed files or history since f69ddd8. |
| D. Injection | Reviewed (delta) | Article text reaches only the model prompt; no DOM/eval sinks added. |
| E. XSS | Reviewed (delta) | Changed UI files: no HTML-string sinks. |
| F. Browser security | Reviewed (delta) | MV3 default CSP for extension pages; no remote code. |
| G. Logging | Reviewed (delta) | Full result logging removed; article text never logged. |
| H. Dependencies | Reviewed | 0 production dependencies; dev: jsdom 30.1.0 -> undici (high), source-map-js (high), not shipped. Vendored Readability unchanged. |
| I. Deployment / config | Reviewed | Manifest version bump only. |
| J. Backup / recovery | NOT APPLICABLE | Local extension data only. |
| Phase 4 AI security | Reviewed (delta) | Prompt v2.2: article treated as content to assess; output schema-validated before display; no tools/agency. SEC-CHAIN-001 (custom endpoint) unchanged, informational. |

## Prioritized remediation

1. **P3** — Update jsdom (dev) to pull undici >= 8.12.2; run npm audit fix for source-map-js.
2. **P3** — Keep the setAccessLevel call covered by a unit test so a refactor of the worker cannot drop it silently.

## Scope and limitations

Follow-up to the 2026-10-01 audit (docs/security-audit/findings.json, commit f69ddd8, v1.4.0), which was never committed and is added unchanged in this pull request. Covered: the 19 commits and 17 extension/script files changed since f69ddd8 (v1.4.0 -> v1.6.1), re-verification of both 2026-10-01 items, and npm audit.

- Delta round; files unchanged since f69ddd8 were not re-read.
- No browser run in this round; Chrome storage access level behaviour taken from the API documentation.
