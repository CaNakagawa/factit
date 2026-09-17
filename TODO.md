# Fact It - Current Milestone

## CURRENT

V0.5 - AI Analysis Engine

## Objective

Turn an ArticleDocument into a validated, preliminary AnalysisResult
through the configured provider, with a versioned prompt and strict
handling of malformed or hostile model output.

## Tasks

- [x] analysis/schema.js - enums, limits, output shape (single source
      for prompt and validator)
- [x] analysis/prompt.js - PROMPT_VERSION 1.0.0; system instructions
      separate from the article, which travels as a JSON data envelope
- [x] analysis/validator.js - tolerant JSON extraction, strict
      validation, forced schema_version / verification_level
- [x] analysis/engine.js - analyzeArticle(); AnalysisError kinds
      invalid_output / truncated_output / refused; `meta` block
- [x] Background: FACTIT_ANALYZE from content scripts only; article
      shape re-checked; toolbar `action` triggers FACTIT_RUN (ADR-006)
- [x] Content script: FACTIT_RUN -> extract -> analyze -> log result
- [x] docs/ANALYSIS_SCHEMA.md and docs/PROMPT.md finalized
- [x] 16 unit tests (prompt, parsing, validation, engine, hostile
      output, message shape check)
- [x] Smoke test: full round trip through the real worker with a fake
      provider; extension pages refused for FACTIT_ANALYZE

## Acceptance Criteria

- [x] Structured JSON output conforming to docs/ANALYSIS_SCHEMA.md.
- [x] Schema validation: enums enforced, numbers clamped, strings and
      lists capped, unknown fields dropped.
- [x] Malformed output handling: fences/prose tolerated; non-JSON,
      truncated and refused outputs produce distinct errors.
- [x] Every result is AI_PRELIMINARY regardless of model output.
- [x] Prompt injection resistance: article is data inside a JSON
      envelope; system prompt says so; instructions in the article
      cannot change the envelope or the verification level.
- [x] Provider-independent: works with any adapter's complete().
- [x] No new permissions (`action` is not a permission).

## Status

V0.5 complete on 2026-09-17.

Notes:

- Max output budget for analysis is 8192 tokens; `finish: "length"`
  with unparseable JSON yields `truncated_output`.
- No provider JSON mode is used (keeps adapters uniform); tolerant
  parsing + validation covers it. Can be revisited if a provider
  produces frequent invalid_output.
- No retry on transient provider errors yet.
- Results are only logged to the page console; the bar (V0.6) and
  panel (V0.7) render them.
- Live run 2026-09-17 (heise.de security article, DeepSeek
  `deepseek-flash` via openai-compatible): valid JSON first try,
  no validation issues, German output, 9 claims / 6 flags, framing
  OTHER/LOW with factual support unaffected, 2.2k output tokens.
- Prompt tweak for 1.0.1: only mention manipulation attempts when
  present (model currently states their absence).

## NEXT

V0.6 - Fact It Bar (see PLAN.md). Not started.

## DO NOT IMPLEMENT YET

- Expanded panel
- Local cache
- Evidence Engine
- Community
- Authentication
- Database
- Reputation
