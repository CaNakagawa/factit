# Changelog

## 1.3.0 - 2026-09-18

- Product direction (ADR-008): concern detection replaces verification
  absence as the warning model. "Needs external verification" is gone;
  external verification is metadata shown once. Status is derived from
  concerns only: No significant concerns / Review recommended /
  Significant concerns. No percentage score.
- Schema 2.1 / prompt 2.1.0: within-article support levels incl.
  ALLEGATION_REPORTED, attribution, source transparency, concern codes
  with severity, strict material-missing-context, topic is not
  framing, compact records for ordinary claims (about half the output
  tokens again on an ordinary article)
- UI: banner shows the status; summary shows status, counters (claims,
  significant concerns, observations, contradictions), key findings,
  source transparency, framing; claims are green unless they carry a
  concern
- Cached 2.0 / 1.x results migrate on read; verification codes dropped

## 1.2.0 - 2026-09-18

- Progressive disclosure: thin banner (article support %, N need
  review) -> Summary panel (score, confidence, AI PRELIMINARY notice,
  three counters, key findings, possible framing, actions) -> Detailed
  analysis tabs (Overview, Claims, Evidence, Framing, About)
- Schema 2.0 (claim-centric, ADR-007): within-article support levels,
  evidence types, per-claim issue codes, possible reader inference,
  observable framing characteristics; explicit
  external_verification: NOT_PERFORMED
- Prompt 2.0.0: each fact requested once; roughly half the output
  tokens on the same article
- Terminology: "Supported within article" everywhere; highlights are
  "Supported in article" vs "Needs review" (allegation / weak source /
  missing context / evidence gap / external verification required);
  "possible reader inference" replaces "leads the reader to"
- Cached 1.x results migrate on read and are marked; Re-analyze
  offered
- Token accounting, cost, provider/model/prompt metadata moved to the
  About tab

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
