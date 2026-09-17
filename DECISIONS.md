# Fact It - Architecture Decision Records

Important architectural decisions belong here.

## ADR-001 - BYOK

### Context

Centralized AI inference introduces:

- infrastructure cost
- API cost
- credential management
- privacy complexity

### Decision

Fact It MVP uses BYOK.

Bring Your Own Key.

### Benefits

- minimal infrastructure
- minimal project AI costs
- provider flexibility
- user control

### Tradeoffs

- configuration required
- model behavior differs
- analysis may differ between providers

Future official/community analysis may require standardized models.

---

## ADR-002 - Separate Factuality and Framing

### Context

Biased or framed content can still contain accurate factual
information.

### Decision

Fact It will never use detected framing directly to reduce factual
support.

### Consequence

The UI and schemas maintain separate dimensions for:

- factual support
- possible framing

---

## ADR-003 - Mozilla Readability, vendored, no build step

### Context

V0.2 needs reader-mode extraction. PLAN.md names Mozilla Readability
as the first candidate. Content scripts cannot be ES modules, and the
project has no bundler.

### Decision

Use Mozilla Readability (Apache-2.0) unchanged. Ship it as classic
scripts committed under `extension/vendor/`, copied from the pinned
npm devDependency by `npm run vendor`. A unit test fails if the copy
drifts from `node_modules`.

The extractor takes Readability by injection so it is unit-testable in
Node with jsdom, without a browser or an LLM.

### Alternatives

- Custom extraction engine: rejected; the skill says not to unless
  necessary, and Readability handles the common cases.
- Bundler (esbuild/rollup) with npm import: rejected for now; adds a
  build step for a single dependency. Can be revisited if the
  extension gains more dependencies.

### Tradeoffs

- ~94 KB of third-party code in the repository.
- Upgrades are manual (bump version, run vendor script).
- Extraction quality is bounded by Readability; pages it cannot parse
  yield "no article", which is a valid result.

---

## ADR-004 - Provider interface is a text-completion primitive

### Context

ARCHITECTURE.md describes the provider concept as
`analyze(document, configuration) -> AnalysisResult`. Implementing that
literally would put prompt construction and output validation inside
every adapter, so adding a provider would mean re-implementing the
analysis engine.

### Decision

Adapters implement one low-level operation:

    complete({ system, input, maxTokens }) -> { text, model, provider, finish, usage }

`system` carries Fact It's instructions; `input` carries the untrusted
article. Adapters must pass them to the model as separate fields/roles.
Prompt versioning, schema validation and result normalization live in
`analysis/` (V0.5) and are provider-independent.

Adapters are plain objects (`configure`, `buildRequest`,
`parseResponse`) registered in `providers/provider.js`; the shared HTTP
round trip, timeout, status-to-error mapping and credential redaction
live once in `providers/common.js`. `fetch` is injected so adapters are
tested without network.

Provider calls happen only in the background worker. The settings page
asks the worker to test a connection; content scripts are refused.

### Alternatives

- `analyze()` per adapter: rejected (duplicated analysis logic).
- Official SDKs: rejected for V1; no bundler, three providers, and the
  OpenAI-compatible target needs raw HTTP anyway.

### Tradeoffs

- Provider-specific features (JSON mode, thinking controls) need an
  explicit field in the request shape when V0.5 wants them.
- Raw HTTP means Fact It owns error mapping and retries.

---

## ADR-005 - API keys in chrome.storage.local

### Context

BYOK needs the key available across browser sessions. Extensions have no
OS-keychain access.

### Decision

Store settings including the API key in `chrome.storage.local`
(`storage` permission). The settings page states plainly that this
storage is not encrypted and recommends a spend-limited key. The key is
read only by the background worker and the settings page; it is never
sent to content scripts, never logged, and redacted from provider error
messages.

### Alternatives

- `chrome.storage.session`: cleared on browser exit; re-entering the key
  every session makes the extension impractical.
- Encrypting with a user passphrase: adds a prompt on every analysis;
  can be revisited if users ask for it.

---

## ADR-006 - Analysis runs on demand, not on page load

### Context

With extraction, normalization and providers in place, something has to
trigger sending an article to the model. Running automatically on every
readerable page would send content to a third party and spend the
user's API budget without an explicit request, on pages the user may
only skim.

### Decision

Analysis starts only when the user clicks **Analyze** in the Fact It
bar. The toolbar button (`action`) never analyzes: it shows the bar or
toggles the details panel, so an accidental click cannot spend tokens
(amended 2026-09-17 after a live run re-analyzed on a second toolbar
click). Nothing is sent to a provider on page load. A page that already
has a result is not re-analyzed unless the user explicitly asks
(Re-analyze, V0.8).

### Consequences

- PRIVACY.md's "users should always know which provider receives their
  content" holds by construction: content leaves the browser only on a
  deliberate click.
- The Fact It bar (V0.6) must have an idle state ("not analyzed yet")
  in addition to result states.
- An opt-in "analyze automatically" setting can be added later without
  changing the pipeline; the local cache (V0.8) would make it cheap for
  revisited pages.

### Alternatives

- Automatic on load: rejected for cost and privacy.
- Trigger from the settings page: awkward; the settings tab steals focus
  from the article.

