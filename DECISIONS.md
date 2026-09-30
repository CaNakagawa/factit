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

---

## ADR-007 - Claim-centric analysis schema (2.0)

### Context

Schema 1.x asked the model for overlapping prose: a per-claim
explanation, missing information and implied conclusion, a free-text
explanation per flag, a rationale and a summary, plus framing prose.
The UI then derived highlights and a side-by-side view from three
overlapping fields. A 20-claim article produced ~4.7k output tokens,
and "SUPPORTED" / "Strengths" read as if Fact It had verified truth.

### Decision

Each claim is one canonical record: `support` (within-article
vocabulary), `evidence_type`, `evidence`, `gap`, `inference`, `issues`
(codes), `external_verification_required`. Flags become codes on the
claim; article-level issues reference claim ids. The assessment carries
`article_support`, a short rationale and forced
`verification_level` / `external_verification`. The UI
(ui/derive.js) computes buckets, counters, key findings, highlights,
side-by-side rows and evidence profiles from those records. Level 1
(banner), level 2 (summary) and level 3 (detailed tabs) are views of the
same data.

Vocabulary: every "supported" label says "within article";
`external_verification: NOT_PERFORMED` is explicit; "possible reader
inference" replaces "leads the reader to"; framing is reported as
observable characteristics.

### Consequences

- Output tokens roughly halve on the same article; input tokens are
  unchanged.
- Cached 1.x results are migrated on read (validator.migrateLegacy),
  marked with `meta.migrated_from`; nothing is invented, and the About
  tab offers Re-analyze.
- A future Evidence Engine can attach verification to claim ids
  without touching the UI's derivation layer.

### Alternatives

- Keep 1.x and trim caps: rejected; the duplication was structural.
- Provider JSON/structured-output modes: orthogonal; still possible
  later for models that emit invalid JSON.

---

## ADR-008 - Fact It V1 uses concern detection rather than verification absence as the primary warning model

### Context

Under schema 2.0 an ordinary cybersecurity report ("Microsoft released a
patch", "CVSS 10.0", "researcher X found it", "no customer action
required") produced a dozen "needs external verification" warnings and
an amber banner. The cause was structural: the prompt asked for
`external_verification_required` per claim, the UI bucketed
`ATTRIBUTED` claims as "needs verification", the banner summed them into
"N need review", and the article-support percentage penalised
attribution without shown evidence. Fact It not having checked a source
was being presented as a problem with the article.

### Decision

Fact It V1 answers "are there meaningful signals that this content may
mislead the reader?", not "has Fact It proven every statement?".

- NOT_EXTERNALLY_VERIFIED != SUSPICIOUS. External verification status is
  metadata (`assessment.external_verification: NOT_PERFORMED`), shown
  once. It never creates a concern, never colors anything, never counts.
- The overall status is derived from concerns only:
  NO_SIGNIFICANT_CONCERNS (none) / REVIEW_RECOMMENDED (moderate) /
  SIGNIFICANT_CONCERNS (any significant). The validator derives it; the
  model cannot set it.
- "No significant concerns" is a valid, complete result. Empty concern
  lists and `framing.detected: false` are normal. Framing without
  observable characteristics is downgraded to not detected.
- Claims describe their status within the article (ARTICLE_SUPPORTED,
  PARTIALLY_ARTICLE_SUPPORTED, ATTRIBUTED, ALLEGATION_REPORTED,
  UNSUPPORTED_WITHIN_ARTICLE, INTERNALLY_CONTRADICTED, UNCLEAR) plus
  `attribution` and `evidence_type` as observable source transparency;
  none of these is a concern by itself.
- Concerns carry a fixed severity (schema.js CONCERN_SEVERITY). An
  article reporting someone else's allegation with attribution is
  ALLEGATION_REPORTED, not an unsupported claim. MATERIAL_MISSING_CONTEXT
  applies only when the omission changes the reading of a central claim.
  Topic is not framing.
- The article-support percentage is removed as a user-facing signal;
  the status is the primary signal. No truth percentage is introduced.
- Source reputation is not used (future phase).

### Consequences

- An ordinary, internally consistent, attributed article shows green
  with zero concerns. Warnings appear only with a concrete reason.
- Output tokens drop further: ordinary claims are compact records and
  prose is spent only on concerns (about half again on a 12-claim
  article versus 2.0).
- Cached 2.0 and 1.x results migrate on read; their verification-absence
  codes are dropped, other issue codes map to concern codes, and the
  status is re-derived. About shows the migration note.
- A future Evidence Engine can fill `external_verification` per claim
  without changing the concern model.

---

## ADR-009 - Claim tags describe the article, never the truth of a claim

### Context

Inspecting a claim required reading several fields. A short tag per claim
makes the list scannable. The obvious vocabulary ("FACT", "TRUE") would
undo ADR-008: nothing is externally verified in V1, so a tag that reads
as a verdict would tell the reader the opposite of what the product can
honestly say.

### Decision

Each claim carries exactly one tag, derived in ui/derive.js from the
claim record (no extra model output, no extra tokens):

CONTRADICTION · SUSPICIOUS · NEEDS REVIEW · UNSOURCED · ALLEGATION ·
OPINION · UNCLEAR · DOCUMENTED · SOURCED · REPORTED

Every tag states something observable about the text: what the article
shows for the claim (DOCUMENTED, SOURCED, REPORTED, UNSOURCED), what
kind of statement it is (ALLEGATION, OPINION, UNCLEAR), or what concern
was found (CONTRADICTION, SUSPICIOUS, NEEDS REVIEW). There is no FACT or
VERIFIED tag, and a test asserts none is ever introduced.

Concerns outrank everything, so a tag can never disagree with the
claim's color; tag tones map to the existing buckets (alert -> concern,
caution -> caution, ok/neutral -> ok).

### Alternatives

- "FACT" for well-backed claims: rejected; it reads as a verification
  Fact It did not perform.
- Several tags per claim: rejected; the list stops being scannable and
  the tags start competing with the concern list.

---

## ADR-010 - Two-box contrast, derived from the existing claim record

### Context

Readers asked for the gap between what a passage makes them believe and
what it actually says. Schema 2.1 already carries `inference` (a
possible reader inference the text invites but does not establish),
`text`, `evidence` and `gap`.

### Decision

The contrast is a view, not new model output: left box = `inference`
when present, otherwise the claim as stated; right box = the literal
statement (when the left box holds the inference), what the article
shows, and what it does not show. Shown inside an expanded claim and in
the Evidence tab's side-by-side. No schema change, no prompt change, no
extra tokens.

Headers are "What it leads you to believe" and "What it actually says",
with a note that both are observations about the text, never claims
about the author's intent (ADR-008).

---

## ADR-011 - Interface language is a setting, with English as the fallback

### Context

The interface was English-only while the analysis text follows the
article's language. Users reading in Portuguese wanted the chrome in
Portuguese too.

### Decision

A small dictionary module (ui/i18n.js) keyed by the English source
string, with `t(source, vars)`; `uiLanguage` in settings is auto | en |
pt, where auto follows the browser. Untranslated strings fall back to
the English source, so a missing entry degrades instead of showing an
identifier.

chrome.i18n and `_locales/` are not used: they follow the browser's UI
language and cannot be overridden by a setting, which is what was asked
for.

The content script gets only the language from the background
(FACTIT_UI_PREFS); the rest of the settings, including the key, stay in
the privileged context (SECURITY.md).

Analysis text is never translated: it is the model's output in the
article's language.

