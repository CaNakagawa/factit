# Fact It - Current Milestone

## CURRENT

V0.8 - Local Cache

## Objective

Never pay twice for the same article: cache validated analyses by
content hash and offer an explicit Re-analyze.

## Tasks

- [x] storage/cache.js - entries `analysis:<hash>` + LRU index, max
      200; stored results re-validated on read; article text never
      stored
- [x] Background: FACTIT_LOOKUP (content scripts), FACTIT_ANALYZE
      honours the cache unless `force`, stores every result;
      FACTIT_CACHE_STATS / FACTIT_CACHE_CLEAR (extension pages)
- [x] Content script: cache lookup on load (no tokens); bar shows
      `from cache`; panel shows `shown from local cache` and
      **Re-analyze (uses tokens)**
- [x] Settings page: cache count + Clear analysis cache
- [x] PRIVACY.md and docs/DEVELOPMENT.md updated
- [x] 9 new unit tests (cache hit/miss/corrupt/tamper/LRU/clear; bar
      and panel cached states); smoke test: reload -> cached result
      with zero calls, Re-analyze -> one call, settings clears cache

## Acceptance Criteria

- [x] Cache holds content hash, analysis, provider, model, prompt
      version, schema version, timestamp.
- [x] Revisiting an unchanged article costs no tokens.
- [x] Re-analyze is explicit and the only way to re-run.
- [x] Stored data cannot escalate the verification level or inject
      markup (re-validated on read; UI renders text only).
- [x] No new permissions (`storage` already granted).

## Status

V0.8 complete on 2026-09-17.

Notes:

- Cache key is the content hash only; a different model does not
  invalidate an entry (the panel shows which model produced it).
- No TTL; LRU cap of 200 entries (~2 MB worst case in storage.local).
- A schema_version bump makes all existing entries misses.

## Follow-ups noted (not in this milestone)

- Extraction quality: on heise.de Readability kept a related-article
  teaser and audio-player labels; the model flagged them as foreign
  fragments. Consider a post-filter for aside/player widgets or
  Readability options (V0.9 hardening).

## NEXT

V0.9 - Security Hardening (see PLAN.md). Not started.

## DO NOT IMPLEMENT YET

- Evidence Engine
- Community
- Authentication
- Database
- Reputation
