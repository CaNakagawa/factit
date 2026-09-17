# Fact It - Current Milestone

## CURRENT

V0.4 - Provider Layer

## Objective

Common AI provider interface with OpenAI, Anthropic and
OpenAI-compatible adapters, configured through the settings page.

## Tasks

- [x] providers/provider.js - registry, `createProvider`, common
      `complete()` interface (ADR-004)
- [x] providers/common.js - ProviderError kinds, HTTP round trip with
      timeout, status mapping, credential redaction
- [x] providers/openai.js, anthropic.js, openai-compatible.js
- [x] storage/settings.js - sanitized settings in storage.local
      (ADR-005; `storage` permission documented)
- [x] Settings page: provider, key, model, base URL, Save, Remove key,
      Test connection; BYOK storage limitation stated
- [x] Background worker handles `FACTIT_TEST_PROVIDER` from extension
      pages only
- [x] Unit tests: request shapes, parsing, error mapping, redaction,
      base URL validation, settings store
- [x] Smoke test: fake OpenAI-compatible server reached from the real
      background worker; content script refused

## Acceptance Criteria

- [x] All three adapters expose the same interface and are tested
      without network.
- [x] A new provider can be added by writing one adapter file and
      registering it; nothing else changes.
- [x] API keys never reach content scripts, are never logged, and are
      redacted from error messages.
- [x] Custom endpoints: https required except loopback; no credentials,
      query or fragment in the base URL.
- [x] Only the `storage` permission was added, with a documented reason.

## Status

V0.4 complete on 2026-09-17.

Notes:

- Default models: OpenAI `gpt-4o-mini`, Anthropic `claude-opus-5`;
  both editable. OpenAI-compatible requires an explicit model.
- No host_permissions needed: content-script match patterns already
  grant host access for background fetches (verified in smoke test).
- Real-provider verification: DeepSeek (`https://api.deepseek.com/v1`,
  `deepseek-chat`) confirmed working through the OpenAI-compatible
  adapter on 2026-09-17. The smoke test uses a fake local endpoint.

## NEXT

V0.5 - AI Analysis Engine (see PLAN.md). Not started.

## DO NOT IMPLEMENT YET

- Fact It bar
- Expanded panel
- Local cache
- Evidence Engine
- Community
- Authentication
- Database
- Reputation
