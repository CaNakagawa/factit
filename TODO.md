# Fact It - Current Milestone

## CURRENT

V0.3 - Content Normalization

## Objective

Convert the raw extraction into a deterministic, size-bounded
ArticleDocument with a content hash.

## Tasks

- [x] utils/hash.js - SHA-256 via WebCrypto
- [x] content/normalize.js - extraction -> ArticleDocument
      (whitespace, invisible characters, URLs, metadata, links,
      images, length cap, content hash)
- [x] Content script builds the ArticleDocument; `FACTIT_EXTRACT`
      returns it
- [x] Finalize docs/ARTICLE_SCHEMA.md (adds `content_hash`,
      `truncated`)
- [x] Unit tests for every normalization rule + fixture end to end
- [x] Smoke test evaluates the ArticleDocument inside Chromium

## Acceptance Criteria

- [x] Output conforms to docs/ARTICLE_SCHEMA.md.
- [x] Same content yields the same hash regardless of URL, tracking
      parameters or metadata (verified identical in Chromium and Node).
- [x] Content is plain text, bounded (40,000 chars), free of control,
      zero-width and bidi-control characters.
- [x] URLs are http(s) only, without fragments, credentials or
      tracking parameters.
- [x] No new permissions.

## Status

V0.3 complete on 2026-09-17.

Notes:

- `published_at` is ISO 8601 or null; unparseable dates become null.
- `language` is canonical BCP-47 or null.
- Truncation cuts on a line boundary and sets `truncated: true`; the
  hash covers only what is kept.
- `author` is the byline as published and may be a publisher name.

## NEXT

V0.4 - Provider Layer (see PLAN.md). Not started.

## DO NOT IMPLEMENT YET

- AI analysis prompt
- Fact It bar
- Expanded panel
- Local cache
- Evidence Engine
- Community
- Authentication
- Database
- Reputation
