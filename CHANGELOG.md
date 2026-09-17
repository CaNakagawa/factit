# Changelog

## 1.1.0 - 2026-09-18

- Panel: one-line rationale under the factual support label ("well
  supported because..."); per-claim explanations now also cover
  supported claims (prompt 1.2.0, schema 1.2)
- Panel: token usage per request and estimated cost when prices are
  set; settings page gets price fields (pre-filled for Anthropic
  models), running usage totals and a reset
- Older cached results keep working (schema 1.0-1.2 accepted)

## 1.0.0 - 2026-09-18 - MVP

First usable release. Chromium extension, Manifest V3, BYOK.

- Local article extraction (Mozilla Readability, vendored) with noise
  removal; deterministic ArticleDocument with content hash (schema 1.0)
- Providers: OpenAI, Anthropic, OpenAI-compatible (DeepSeek, Gemini,
  Ollama, LM Studio, ...) behind one adapter interface; one automatic
  retry on transient errors; no redirects; capped responses
- Analysis engine: versioned prompt (1.1.0), strict AnalysisResult
  validation (schema 1.1), always AI_PRELIMINARY
- Fact It bar: factual support meter (blue -> red), confidence,
  claim/flag counts, preliminary label; inactive until Analyze
- Details panel: conclusion, Highlights (strengths vs concerns),
  side-by-side (what the article says vs what is missing / implied),
  claims, flags, framing, provenance
- Local cache by content hash with explicit Re-analyze
- Settings page: provider, key, model, base URL, test connection,
  cache management
- Security hardening pass with adversarial tests (see SECURITY.md)

Explicitly not included (later phases): Evidence Engine, community,
accounts, reputation, any Fact It backend.

## 0.1 - 0.9 - 2026-09-17

Development milestones V0.1 (extension shell) through V0.9 (security
hardening); see git history and DECISIONS.md (ADR-001 to ADR-006).
