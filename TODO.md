# Fact It - Current Milestone

## CURRENT

V0.2 - Article Extraction

## Objective

Integrate reader-mode extraction so the extension can obtain the main
article content locally, without sending raw page HTML anywhere.

## Tasks

- [x] Evaluate and adopt Mozilla Readability (ADR-003)
- [x] Vendor Readability into extension/vendor/ (`npm run vendor`)
- [x] Implement content/extractor.js
      (url, domain, title, author, publication date, language,
      main text, article links, image metadata)
- [x] Wire extraction into the content script
      (runs on readerable pages; answers `FACTIT_EXTRACT`)
- [x] Unit tests with jsdom fixtures (article + non-article)
- [x] Browser smoke test covers extraction
- [x] Document verification and vendoring (docs/DEVELOPMENT.md)

## Acceptance Criteria

- [x] Extraction works on an article page without contacting an LLM.
- [x] Output is plain text plus validated http(s) URLs; no raw HTML.
- [x] Navigation, banners, recommendations and footer are excluded.
- [x] Non-article pages yield "no article" rather than garbage.
- [x] The page DOM is not modified.
- [x] No new permissions.

## Status

V0.2 complete on 2026-09-17.

Notes:

- Output shape mirrors the ArticleDocument `document` fields but is
  still raw: no whitespace/URL normalization, no length cap, no
  `schema_version`, no content hash. Those belong to V0.3.
- Extracted URLs keep their query strings; V0.3 URL normalization
  should decide what to strip.
- Links are capped at 50 and images at 20, taken only from inside the
  extracted article.

## NEXT

V0.3 - Content Normalization (see PLAN.md). Not started.

## DO NOT IMPLEMENT YET

- OpenAI
- Anthropic
- AI analysis
- Fact It bar
- Local cache
- Evidence Engine
- Community
- Authentication
- Database
- Reputation
