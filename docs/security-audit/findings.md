# Fact It — Security Audit Findings

> Canonical source of truth: `docs/security-audit/findings.json`.
> This file and the audit PDF are generated from it. No finding is introduced
> during report generation.

| | |
|---|---|
| Project | Fact It 1.4.0 |
| Branch / commit | `main` / `f69ddd8` (`f69ddd8693e30cd7d326e0e3a32ab281a6dc3983`) |
| Commit date | 2026-09-30T20:24:57+02:00 |
| Audit date | 2026-10-01T09:28:10+02:00 |
| Working tree | clean |
| Report language | pt-BR |

## Executive summary

**Confirmed vulnerabilities: 0.**
**Items requiring validation: 2.** Both are
recorded with status VALIDATION REQUIRED and are explicitly **not** counted as
confirmed vulnerabilities.

The audited artifact is a Manifest V3 browser extension with no server, no
database, no accounts, no tools and no build step. Its attack surface is
correspondingly small and unusually well defended: one centralised network
egress, strict sender-identity checks on all 12 message handlers, no HTML sink anywhere in the
extension, credential redaction on every error surface, integrity-pinned
dependencies, a vendored extraction library that is byte-identical to its
upstream release, and an adversarial test suite (151 tests, all passing) that
treats both the webpage and the model as untrusted.

The two VALIDATION REQUIRED items are (1) the provider API key is reachable
from the content-script execution context through `chrome.storage.local`,
because Chrome exposes the `storage` API to content scripts, and (2) a
custom OpenAI-compatible base URL may be any remote https host, which then
receives the key and the article. Neither is reachable by a remote attacker;
the second is the documented feature of the custom-endpoint provider.

## Detected architecture

- **Languages / stack:** JavaScript (ES2022, browser + Node for tests), HTML, CSS, Bash (repository setup helpers, not shipped)
- **Frontend:** In-page UI injected by content scripts (closed Shadow DOM); extension options page in vanilla JS (ES module). No framework, no bundler, no build step.
- **Backend:** None. No server, no database, no queue, no worker fleet.
- **Platform:** Chrome/Chromium Manifest V3 extension, minimum_chrome_version 116
- **Data stores:** chrome.storage.local only (settings, analysis cache, usage totals) (ORM: None)
- **Authentication:** None (no accounts). BYOK provider API key typed by the user on the options page.
- **Authorization:** Sender-identity checks on every internal message (sender.id === chrome.runtime.id) plus per-handler context gates (isExtensionPage / isContentScript)
- **Tenancy:** Single user, single browser profile. No tenants, workspaces or organizations.
- **External services:** OpenAI Chat Completions API, Anthropic Messages API, user-configured OpenAI-compatible endpoint
- **AI components:** Single LLM text-completion call for article analysis. No tools, function calling, MCP, RAG, vector store, agents or long-term memory.
- **Containers / IaC / CI-CD:** None present in the repository
- **Secret management:** User-supplied API key in chrome.storage.local; not encrypted (documented in SECURITY.md / ADR-005)
- **Dependencies:** 0 runtime; dev: @mozilla/readability@0.6.0, jsdom@30.1.0; 0 vulnerabilities (info/low/moderate/high/critical = 0)

### Flow

```
PAGE (untrusted DOM) -> content script: Readability on a clone -> normalize -> ArticleDocument (schema 1.0 + SHA-256) -> chrome.runtime message -> background service worker -> provider adapter -> LLM provider (HTTPS) -> untrusted JSON -> bounded read -> parseModelJson -> validateAnalysis (enum/clamp/cap, status derived) -> chrome.storage.local cache + reply -> content script -> in-page UI (textContent in a closed Shadow DOM)
```

### Trust boundaries

- webpage (untrusted) -> content-script isolated world: DOM, text, metadata, links; extraction on a clone; no HTML crosses
- content script -> background: message payloads re-checked by articleDocumentProblem and per-handler sender gates
- background -> provider: the only network egress; carries the API key; redirect:error, credentials:omit, 60 s timeout
- provider -> background: untrusted body, capped at 2 MB, JSON-parsed defensively, key-redacted error text
- chrome.storage.local -> background/options: re-validated on every read
- validated result -> UI: text nodes only, closed Shadow DOM; page cannot read or script it

## Findings

## SEC-SECRETS-001 — API key is reachable from the content-script context through chrome.storage.local

Status: VALIDATION REQUIRED
Severity: LOW
Confidence: MEDIUM
Category: Secrets and credentials / trust-boundary minimisation
Counted as a confirmed vulnerability: no

Affected component: Content-script execution context and the settings store
File: extension/manifest.json, extension/storage/settings.js, extension/content/content-script.js
Lines: 
  - `extension/manifest.json`: 26-46 (content_scripts on http://*/* and https://*/*), 51-53 (permissions: ["storage"])
  - `extension/storage/settings.js`: 57-63 (createSettingsStore reads chrome.storage.local)
  - `extension/content/content-script.js`: 1-14 (comment stating content scripts must never receive API keys)
Function/Route: manifest content_scripts + createSettingsStore().get()

Evidence:

```js
manifest.json grants the extension-wide `storage` permission and injects content scripts into every http/https page:

  "permissions": [ "storage" ]
  "content_scripts": [{ "matches": ["http://*/*", "https://*/*"], ... }]

The settings store keeps the provider credential in that same, extension-wide area:

  const STORAGE_KEY = "settings";
  apiKey: str(src.apiKey),
  async get() { const stored = await area.get(STORAGE_KEY); return sanitizeSettings(...); }

Chrome exposes the chrome.storage API to content scripts whenever the extension holds the `storage` permission. The extension correctly never *sends* the key over the message channel (FACTIT_UI_PREFS returns only `{ language }`, verified at service-worker.js L151-156), but the credential remains reachable from the content-script execution context itself, which is the context that processes hostile page content and loads third-party code (extension/vendor/Readability.js).
```

Attack path:

```
UNTRUSTED WEBPAGE CONTENT
-> vendored Readability / content-script code executes attacker-influenced input inside the isolated world
-> MISSING/BROKEN CONTROL: no per-context access control on chrome.storage.local for content scripts; the credential is stored where the least-trusted extension context can read it
-> chrome.storage.local.get("settings").apiKey
-> exfiltration to the page or to the network
-> IMPACT: disclosure of the user's provider API key (billing/abuse on the user's account)
```

Preconditions:
- JavaScript execution inside the content script's isolated world (a memory-safety or logic bug in the content-script code or in a component loaded into it such as the vendored Readability). No such primitive was found in this repository.
- The user has saved an API key.

Exploitability:

This is recorded as VALIDATION REQUIRED and is NOT counted as a confirmed vulnerability. No code-execution primitive in the content-script world was identified, and Chrome's isolated world prevents the page from calling chrome.storage directly. The condition is nonetheless real and verifiable at runtime: the credential is stored in an area that a lower-trust context can read. It was not executed in a browser during this audit (see limitations), so the runtime reachability rests on documented platform behaviour plus the manifest permissions.

Impact:

If the precondition is ever met, full provider API key disclosure, plus the article text that the script already handles. No account takeover of Fact It itself (there are no accounts).

Why the issue is (or is not) exploitable:

Impact depends entirely on obtaining the precondition. Without it, the page cannot reach chrome.storage and cannot read the closed Shadow DOM. The finding is therefore a trust-boundary/defence-in-depth gap rather than an exploitable defect.

Recommended remediation:
- Record this explicitly in SECURITY.md's known-limitations section so the boundary statement ('content scripts must never receive API keys') matches the platform reality.
- Keep the content-script world minimal and treat every library loaded into it (currently vendored Readability) as security-relevant; re-vendor only from integrity-verified packages (already done).
- Evaluate storing the credential in a context that content scripts cannot read by default. chrome.storage.session is not exposed to content scripts unless setAccessLevel('TRUSTED_AND_UNTRUSTED_CONTEXTS') is called; using it for the key, with the background worker re-hydrating it, would remove the content-script reachability at the cost of re-entry after browser restart (the tradeoff ADR-005 rejected - revisit it with this new information rather than silently).
- Add a regression test that asserts content-script sources never import storage modules or reference chrome.storage.

Verification criteria:
- A documented decision exists in SECURITY.md / DECISIONS.md that states where the key is stored and whether content scripts can read it.
- If the session-storage option is adopted: from a content-script isolated world, chrome.storage.local.get('settings') returns no apiKey and chrome.storage.session.get('settings') either returns nothing or throws, while the background worker can still complete an analysis.
- If the risk is accepted instead: the acceptance is written down with the compensating controls.
- A test fails if any file under extension/content/ gains a chrome.storage reference or imports storage/.

---

## SEC-CHAIN-001 — Custom OpenAI-compatible endpoint may be any remote https host, which then receives the API key and the article

Status: VALIDATION REQUIRED
Severity: INFORMATIONAL
Confidence: HIGH
Category: SSRF / third-party trust (custom endpoint)
Counted as a confirmed vulnerability: no

Affected component: providers/openai-compatible.js (validateBaseUrl, buildRequest)
File: extension/providers/openai-compatible.js
Lines: 
  - `extension/providers/openai-compatible.js`: 17-39 (validateBaseUrl), 52-59 (configure), 61-76 (buildRequest attaches Authorization: Bearer)
Function/Route: validateBaseUrl() / openaiCompatibleProvider.buildRequest()

Evidence:

```js
  const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
  if (url.protocol === "http:" && !loopback) throw configError("Plain http is only allowed for localhost...");
  if (url.username || url.password) throw configError("The base URL must not contain credentials.");
  if (url.search || url.hash) throw configError("The base URL must not contain a query string or fragment.");

  buildRequest(config, req) {
    const headers = {};
    if (config.apiKey) headers.authorization = `Bearer ${config.apiKey}`;
    return { url: `${config.baseUrl}/chat/completions`, ... };
  }

Probing the validator confirms it rejects non-http(s) schemes, credentials, query/fragment and plain http to non-loopback hosts, while accepting any https host - including private and link-local ranges (for example https://169.254.169.254/latest was accepted). The key is then attached to that request. This behaviour is the intended feature and is disclosed in SECURITY.md ('A configured custom endpoint receives the key and the article; the user is responsible for trusting that server').
```

Attack path:

```
LOCAL USER (or a user socially engineered into pasting a hostile base URL)
-> options page writes settings.baseUrl via chrome.storage.local
-> validateBaseUrl (protocol / loopback / credentials / query / fragment checks pass)
-> MISSING/BROKEN CONTROL: no allow-list or explicit confirmation for non-loopback remote hosts
-> POST ${baseUrl}/chat/completions with 'Authorization: Bearer <key>' and the article JSON
-> IMPACT: the configured server receives the user's API key and the article being read
```

Preconditions:
- The user deliberately configures a remote/https OpenAI-compatible base URL, or is persuaded to.
- An API key is set (optional for this provider).

Exploitability:

Not reachable by a webpage or by a remote attacker. The content script cannot write settings and cannot trigger provider calls: every privileged handler is gated (service-worker.js L126-192) and the repository's smoke test asserts that a content script calling FACTIT_TEST_PROVIDER is ignored and that an extension page calling FACTIT_ANALYZE is ignored. Exploitation requires the local user's own configuration action. Recorded for completeness of the custom-endpoint review, not as a defect.

Impact:

Disclosure of the API key and of the analysed article to the configured endpoint; the impact is bounded by the provider's key permissions and by the spend limit the user is advised to set.

Why the issue is (or is not) exploitable:

It is not exploitable without local user action. The residual risk is a trust decision, not a code flaw. The strong parts of the control (https except loopback, no credentials/query/fragment, redirect:error, credentials:omit, 2 MB cap) were verified in the source.

Recommended remediation:
- Optionally refuse or require an explicit confirmation for remote https hosts that resolve to private, loopback or link-local ranges (169.254.0.0/16, 10/8, 172.16/12, 192.168/16, fc00::/7), since a legitimate remote Chat Completions server is rarely in those ranges.
- Keep and surface the existing warning at the point of entry of the base URL, not only in SECURITY.md.
- No change is required if the accepted-risk decision is recorded; the current documentation already discloses it.

Verification criteria:
- A decision (fix or accept) is recorded in DECISIONS.md.
- If an allow-list is added: tests assert that http:// and https:// URLs pointing at private/link-local ranges are rejected or require confirmation, while http://localhost, http://127.0.0.1 and https://<public host> still work.
- The settings page continues to warn before a non-loopback endpoint can be saved.


## Coverage report

### Authorization

- Background message handlers reviewed: 10/10
- Content-script message handlers reviewed: 2/2
- Handlers enforcing `sender.id === chrome.runtime.id`: 12
- Confirmed authorization defects: 0

- FACTIT_PING (service-worker.js L131-133): any sender with sender.id === chrome.runtime.id; returns only {type, version}. Intentionally unauthenticated beyond sender identity. No privilege.
- FACTIT_TEST_PROVIDER (L135-140): isExtensionPage only; spends tokens. Correct.
- FACTIT_ANALYZE (L142-147): isContentScript only; spends tokens. Correct.
- FACTIT_UI_PREFS (L151-156): isContentScript or isExtensionPage; returns only {language}. Correct - the key never leaves the privileged context.
- FACTIT_LOOKUP (L158-163): isContentScript only; cache read keyed by a 64-hex hash; no token spend. Correct.
- FACTIT_CACHE_STATS (L165-168): isExtensionPage only. Correct.
- FACTIT_CACHE_CLEAR (L170-173): isExtensionPage only. Correct.
- FACTIT_USAGE_STATS (L175-178): isExtensionPage only. Correct.
- FACTIT_USAGE_RESET (L180-183): isExtensionPage only. Correct.
- FACTIT_OPEN_SETTINGS (L185-188): isContentScript only. Correct.
- FACTIT_EXTRACT (content-script.js L163-166): sender.id check. Correct.
- FACTIT_TOGGLE (content-script.js L167-170): sender.id check. Correct.

Gate design: 
- **isExtensionPage (service-worker.js L53-62)**: requires sender.id === runtime.id, sender.url under the extension origin and sender.origin absent-or-matching. A content script always reports the http(s) page URL, so it can never pass.
- **isContentScript (service-worker.js L66-75)**: requires sender.id === runtime.id, a tab, a tab id and an http(s) sender.url. Extension pages cannot pass.
- **frontend_privilege_gates**: None exist and none are relied upon. The options page performs no privileged action that the background does not re-check; there is no isAdmin/role/canEdit/canDelete pattern anywhere in the codebase.

### Secrets

- Sources reviewed: all tracked source files; configuration; package.json/package-lock.json; documentation; full Git history (all revisions, added-file diffs); working-tree artifacts (dist/*.zip)
- Real credentials found: 0

- No .env files, no private keys, no cloud credentials, no service-account files, no OAuth secrets, no webhook secrets, no JWT signing secrets.
- The only key-like strings are obvious test fixtures: 'sk-smoke-test-key-0000' (tests/integration/smoke.mjs L255, L280) and 'sk-abcdefghijklmnop' (tests/unit/providers.test.js L208).
- dist/ and node_modules/ are untracked (.gitignore), and git ls-files confirms no build output is committed.
- No insecure ${SECRET:-default} pattern exists; there is no server startup path.
- Redaction (providers/common.js redact) removes the exact key plus sk-/key-/token- and Bearer patterns from every provider error surface. Verified by targeted execution: exact, URL-encoded and sk--prefixed echoes are redacted; a case-mutated echo of a prefix-less key is not (residual, informational - the error text is only shown to the local user who already owns the key).

### Input validation and injection

- **raw_sql**: None - no database and no query builder.
- **shell_execution**: None in the extension. Build scripts use execFileSync with fixed argument arrays (scripts/package.mjs L18, L26).
- **path_traversal**: None - filenames are constants. scripts/make-icons.mjs derives an icon size from the request query with Number(...) and falls back to 128, so no string injection into the served HTML.
- **unsafe_deserialization**: JSON.parse only, of size-capped bodies; no eval, no new Function, no dynamic import of untrusted input.
- **template_injection**: None - no template engine.
- **ssrf**: One egress point. Two hardcoded https endpoints; the third is the user-configured base URL validated by validateBaseUrl (see SEC-CHAIN-001). Not reachable from page content.
- **open_redirect**: None - no redirect handling; fetch uses redirect:'error'.
- **header_injection**: The model name and provider strings are placed in JSON bodies, not headers; header values come from settings and are rejected by fetch if malformed. No user-controlled value reaches a header beyond the API key.
- **xxe_xml**: No XML parsing.
- **prototype_pollution**: Verified by execution: parseModelJson + validateAnalysis + migrateLegacy + migrate20 + sanitizeSettings with __proto__/constructor payloads leave Object.prototype untouched and produce no own __proto__ key.
- **oversized_input**: Content capped at 40,000 chars and refused above that (engine.js articleDocumentProblem); prompt envelope re-bounds every field; provider response capped at 2 MB; 60 s abort timeout; DOM node cap of 60,000 before cloning.
- **redos**: Timed hostile inputs against Intl.getCanonicalLocales and Date.parse (1-5 MB strings): all under 20 ms. No catastrophic backtracking found.

### XSS / output handling

- HTML sinks found: 0

- No innerHTML, outerHTML, insertAdjacentHTML, document.write, createContextualFragment, srcdoc, eval, new Function or dangerouslySetInnerHTML anywhere in extension/ excluding vendor/.
- Every dynamic value in ui/top-bar.js and ui/panel.js goes through a local el() helper that assigns textContent, or through document.createTextNode; the i18n interpolator t() returns a plain string that is only ever assigned to textContent.
- The bar and panel live in a closed Shadow DOM (top-bar.js L103-107), so page CSS cannot restyle and page scripts cannot read the analysis.
- Model-derived strings are additionally schema-bounded before rendering (validator.js: enum enforcement, clamping, per-field caps).
- The README/development task link uses rel="noopener noreferrer" (options.html L28).
- Rendering sinks reviewed: renderSummary, renderDetail, renderOverviewTab, renderClaimsTab, renderEvidenceTab, renderFramingTab, renderAboutTab, renderClaim, twoBoxesEl, tagChip, legend, closeButton, and top-bar setIdle/setLoading/setNoArticle/setResult/setError. All 17 apply text-node rendering.

### Browser security

- **authentication_model**: No cookies and no browser-automatically-attached credentials are used, so CSRF is NOT APPLICABLE. chrome.storage is not sent automatically by the browser.
- **cors**: Extension fetch uses credentials:'omit' and no cookies; no Access-Control headers are set by the extension.
- **csp**: No content_security_policy override; the Manifest V3 default (script-src 'self'; object-src 'self') applies to the options page. tests/unit/manifest.test.js asserts the options page uses no inline scripts or inline event handlers.
- **web_accessible_resources**: None declared, so no extension resource is reachable from web pages.
- **externally_connectable**: Not declared, so no external web page can message the extension.
- **clickjacking**: Extension pages are not web-accessible and Chrome blocks framing them. The in-page bar can be covered or imitated by the page, which SECURITY.md documents as an inherent limitation; the toolbar button re-asserts the real bar.
- **cookies_samesite_secure_httponly**: Not applicable - the extension sets no cookies.
- **hsts_tls**: NOT VERIFIABLE from the repository - TLS for api.openai.com / api.anthropic.com and any custom endpoint is terminated outside the extension.

### Logging

- Credential logging occurrences: 0

- No console statement anywhere in extension/ references settings or the API key.
- Content-script logging is limited to a fixed article summary (title/author/date/language/char counts/hash), the analysis result object, and error messages. Article body text is never logged.
- Errors crossing back to the content script are normalised by errorDetail() (service-worker.js L77-80): only ProviderError/AnalysisError are serialised, everything else becomes a generic message.
- Security-relevant events for an account-based system (login failures, privilege changes) do not exist here because there are no accounts or roles. The token-spending events are logged: 'analysis requested', 'analysis (…, cached) status=…', 'cached analysis found'.

### Supply chain

- **lockfile**: package-lock.json (lockfileVersion 3), all 38 resolved URLs on registry.npmjs.org, all with sha512 integrity
- **npm_audit**: 0 vulnerabilities
- **git_or_url_dependencies**: 0
- **install_scripts**: None defined in package.json; dependencies are test-only and never shipped in extension/
- **vendored_code**: extension/vendor/Readability.js and Readability-readerable.js are byte-identical to @mozilla/readability@0.6.0 (verified with diff: zero differing lines). tests/unit/vendor.test.js enforces this in CI-equivalent form.
- **base_images**: None - no container images
- **ci_cd_actions**: None - no .github/ or other CI configuration present
- **update_path**: scripts/vendor-readability.mjs copies from the pinned node_modules package and refuses drift via tests

### Deployment and configuration

No Dockerfile, docker-compose, Kubernetes manifests, Helm charts, Terraform, Ansible, reverse-proxy configuration or CI/CD pipeline exists in the repository. There is no debug-mode flag, no management interface, no privileged container and no environment separation to review. The extension runs only in the user's browser profile.

Manifest hardening reviewed:

- permissions: ["storage"] only; no host_permissions, no optional_permissions, no tabs, no activeTab, no scripting
- content_scripts restricted to http://*/* and https://*/* (not <all_urls>), so file:// and other schemes are excluded
- no web_accessible_resources, no externally_connectable
- minimum_chrome_version: 116; manifest_version 3

### Backup and recovery

**NOT VERIFIABLE FROM REPOSITORY** — No backup, snapshot, export or restore mechanism is defined in code, IaC, automation or operational documentation. The only persisted state is a disposable analysis cache and usage counters in chrome.storage.local, plus the settings; loss of the browser profile loses at most the cache and requires re-entering the key. This is not recorded as a vulnerability.

### AI security

Flow: `MODEL (provider) <- SYSTEM PROMPT + USER TURN (article as a JSON data envelope) ; MODEL -> response text -> parseModelJson -> validateAnalysis -> AnalysisResult -> UI text. There is no retrieval, memory, tool, MCP or agent stage.`

- **prompt injection**: The article is transmitted as a JSON-stringified object inside the user turn, never concatenated into the system prompt; JSON escaping prevents the article from terminating the envelope or introducing structure. The system prompt explicitly classifies everything in the user message as data and instructs the model not to follow embedded instructions. Residual: an article can still attempt to steer the analysis outcome (this is inherent to analysing adversarial text). Impact is bounded because model output cannot trigger any privileged action - it is schema-validated and rendered as inert text. The product labels every result 'AI preliminary'. No confirmed vulnerability.
- **sensitive information disclosure**: No secrets are placed in prompts. The system prompt is public source, treated as public, not as a security boundary. Article text, title, author, date, language, up to 20 http(s) links and the page URL are sent to the user's chosen provider - disclosed in PRIVACY.md and on the settings page. Single-user extension: no cross-user or cross-tenant context exists.
- **improper output handling**: Model output is treated as untrusted end to end: balanced-brace JSON extraction, strict validation, per-field caps, enum enforcement, forced schema_version / verification_level / external_verification, and status recomputed by deriveStatus rather than taken from the model. Output reaches only text nodes. No shell, SQL, filesystem, code, URL or API sink is reachable from model output.
- **excessive agency**: NOT APPLICABLE - the model has no tools, no function calling, no filesystem, no network and no decision authority. It returns text only.
- **tool mcp security**: NOT APPLICABLE - no tools, no MCP servers or clients, no tool descriptions or metadata.
- **rag memory security**: NOT APPLICABLE - no vector store, no retrieval, no embeddings, no long-term memory. The only persistence is a local analysis cache keyed by the SHA-256 of the article text, re-validated on every read.
- **resource abuse**: No automatic provider call: analysis runs only on an explicit 'Analyze' click (ADR-006, enforced by the absence of automatic runAnalysis calls and asserted by the smoke test). One bounded retry on transient statuses; max_tokens 8192; 60 s timeout; 2 MB response cap; 40,000-char article cap; 200-entry LRU cache; cumulative usage counters with a reset. No recursive or unbounded loop exists. Denial-of-wallet requires repeated user clicks.
- **ai supply chain**: One model provider per request, chosen by the user; no model weights, adapters or plugins are shipped or downloaded. No third-party agent framework.

## Security strengths

- **Single, centralised network egress** — Every provider request flows through providers/common.js send(); the only fetch call in the extension (L59). Two adapters use hardcoded https endpoints; the third uses a validated user URL.
- **Credential handling discipline** — The key is read only by the background worker and the options page. FACTIT_UI_PREFS returns only { language } (service-worker.js L151-156); the options page never writes the stored key back into the form and shows a boolean 'hasStoredKey' instead (options.js L104-112).
- **Error-surface redaction** — providers/common.js redact() strips the exact key plus sk-/key-/token- and Bearer patterns and caps messages at 200 chars; verified by execution against exact, URL-encoded and prefixed echoes.
- **Redirect and cookie containment** — send() uses redirect:'error' and credentials:'omit' (common.js L64-68), so a hostile endpoint cannot bounce the credential to a third origin or harvest cookies.
- **Least-privilege manifest** — permissions: ["storage"] only; no host_permissions, no web_accessible_resources, no externally_connectable; content scripts limited to http/https. Enforced by tests/unit/manifest.test.js.
- **Strict messaging authorization** — All 12 message handlers check sender.id === chrome.runtime.id and 11 additionally require the correct context (isExtensionPage / isContentScript). The browser sets sender.url/origin, so a web page cannot forge them.
- **Untrusted input bounded at every hop** — DOM node cap before cloning (extractor.js L99), 40,000-char content cap (normalize.js L53-57), prompt re-coercion of every field (prompt.js L61-77), 2 MB response cap (common.js L19, L125-150), 60 s timeout, 8192 max tokens.
- **Model output never trusted for control decisions** — validator.js forces schema_version, verification_level and external_verification, derives status from concerns only (deriveStatus L233-238), clamps confidence, enforces enums and caps every string; prototype-pollution attempts are inert.
- **Injection-proof rendering** — No HTML sink exists in extension/ outside vendor/. All model-derived text is assigned through textContent/createTextNode, inside a closed Shadow DOM (top-bar.js L103-107, panel.js L114-119).
- **Integrity-pinned supply chain and vendored code** — 38/38 packages resolved from registry.npmjs.org with sha512 integrity; npm audit reports 0 vulnerabilities; the vendored Readability is byte-identical to the pinned package and a test fails on drift.
- **Adversarial test coverage as executable security documentation** — tests/unit/security.test.js contains 13 adversarial tests mapped to the SECURITY.md threat table; the full suite is 151 tests, all green (npm test).
- **Transparent BYOK threat model** — SECURITY.md, PRIVACY.md, ADR-005 and the settings page state that chrome.storage.local is unencrypted, that a custom endpoint receives the key and article, and that the in-page UI can be spoofed.

## Audit limitations

- This audit is of the repository at commit f69ddd8 (main), working tree clean. No live deployment was assessed.
- No live browser execution was possible in the audit environment: the available Chromium build is snap-confined and fails to start, and the available Google Chrome (154) ignores --load-extension, so npm run test:smoke and the ad-hoc content-script storage probe could not be executed. Runtime claims that rest on browser behaviour (notably SEC-SECRETS-001 and the Chrome semantics of chrome.storage for content scripts) are therefore based on the manifest, the source and documented platform behaviour, and are marked VALIDATION REQUIRED.
- The 151-test unit suite was executed successfully in Node (jsdom), including the adversarial security tests and the byte-for-byte vendor comparison.
- Provider-side and network-side controls (TLS configuration, HSTS, provider rate limiting and abuse protection) are outside the repository and were not assessed.
- No penetration test, fuzzing campaign or reverse engineering of the browser runtime was performed.
- Absence of a backup/recovery mechanism in the repository is reported as NOT VERIFIABLE, not as a vulnerability.
- Findings in findings.json are frozen before report generation; the report introduces no additional findings.
