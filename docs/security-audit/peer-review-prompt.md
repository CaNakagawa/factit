# Peer-Review Prompt — Fact It Security Audit

> **How to use this file:** send everything below the horizontal rule to another
> LLM as a single message. The recipient has **no repository access** and no
> memory of the audit, so the prompt is self-contained. If the recipient can be
> given files, attach `docs/security-audit/findings.json` as well; it is the
> canonical record this prompt summarises.

---

# Independent review of a completed security audit

You are an **independent security reviewer**. Another analysis produced the audit
below. Your job is to **adversarially verify it**, not to agree with it.

## Your task

Assess the audit on its own terms and answer, with reasons:

1. **Is each finding correctly classified?** For every finding, say whether you
   agree with its status (`CONFIRMED` / `VALIDATION REQUIRED`) and its severity,
   or whether it is overstated or understated. Reclassify if warranted.
2. **Did the audit miss anything?** Propose additional candidate vulnerabilities
   only if you can state a concrete source → transformation → missing control →
   sink → impact path from the evidence given. If you cannot, say explicitly
   that you found none. **"No additional findings" is a valid and expected
   answer** — do not manufacture issues to seem thorough.
3. **Are any of the audit's coverage or "strength" claims wrong?** Point out any
   claim that is not actually supported by the evidence shown.
4. **What could not be verified from this material**, and what artifact would be
   needed to verify it?

## Rules you must follow (the audit was held to these)

- Report a vulnerability only with **concrete evidence** from the material below.
- Distinguish **CONFIRMED** (evidence sufficient) from **VALIDATION REQUIRED**
  (exploitability depends on runtime/infrastructure not shown) from
  **NOT APPLICABLE** and **NOT VERIFIABLE**. Never treat absence of evidence as
  evidence of a vulnerability.
- Severity must reflect actual exploitability, required privileges, user
  interaction, network exposure and preconditions — not theoretical impact.
- Do not treat front-end/browser controls as server-side controls, and do not
  assume an ORM, a framework or a sandbox removes a class of bug.
- Do not report configuration preferences as vulnerabilities.

---

# 1. Subject under audit

**Fact It** — an open-source Chromium **Manifest V3 browser extension** that
performs preliminary AI-assisted analysis of the article a user is reading.

- **Revision:** `main` @ `f69ddd8693e30cd7d326e0e3a32ab281a6dc3983`, version
  1.4.0, working tree clean.
- **Stack:** vanilla JavaScript (ES2022), HTML, CSS. **No framework, no bundler,
  no build step, no server, no database, no accounts, no tenants.**
- **Product model:** BYOK (*bring your own key*). The article text goes from the
  user's browser directly to the AI provider the user chose. Fact It operates no
  infrastructure and claims never to see keys or articles.
- **Providers:** OpenAI Chat Completions API, Anthropic Messages API, and a
  user-configured OpenAI-compatible endpoint.
- **Persistence:** `chrome.storage.local` only — settings + API key, an analysis
  cache keyed by SHA-256 of the article text, and usage counters.
- **AI surface:** a single LLM text-completion call. **No tools, no function
  calling, no MCP, no RAG, no vector store, no agents, no long-term memory.**
- **Permissions:** `"permissions": ["storage"]` only. No `host_permissions`, no
  `web_accessible_resources`, no `externally_connectable`. Content scripts match
  `http://*/*` and `https://*/*`. `minimum_chrome_version: 116`.
- **Dependencies:** 0 runtime; dev only `@mozilla/readability@0.6.0` and
  `jsdom@30.1.0`; lockfile v3; all 38 resolved packages from
  `registry.npmjs.org` with sha512 integrity; `npm audit` reported 0
  vulnerabilities. Mozilla Readability is vendored into the extension and was
  found **byte-identical** to the pinned package.
- **No CI/CD, no Docker, no Kubernetes, no Terraform, no reverse proxy, no IaC.**
- **Test suite:** 151 tests, all passing in Node/jsdom, including a dedicated
  adversarial file `tests/unit/security.test.js`.

## Data flow

```
WEBPAGE (untrusted DOM)
  -> content script: Readability parse on a CLONE of the document
  -> normalize -> ArticleDocument (schema 1.0, SHA-256 content hash)
  -> chrome.runtime message
  -> background service worker (privileged; holds the API key)
  -> provider adapter -> LLM provider over HTTPS
  -> untrusted JSON response (capped at 2 MB)
  -> parseModelJson -> validateAnalysis (enum/clamp/cap)
  -> chrome.storage.local cache + reply
  -> content script -> in-page UI (textContent only, closed Shadow DOM)
```

## Trust boundaries asserted by the audit

1. webpage → content script: DOM, text, metadata, links; extraction on a clone.
2. content script → background: message payloads re-checked.
3. background → provider: the only network egress; carries the API key.
4. provider → background: untrusted body, size-capped, defensively parsed.
5. `chrome.storage.local` → background/options: re-validated on read.
6. validated result → UI: text nodes only, closed Shadow DOM.

---

# 2. The audit's headline claims

- **CONFIRMED vulnerabilities: 0.**
- **VALIDATION REQUIRED: 2** — both explicitly *not* counted as confirmed.
- Categories judged **NOT APPLICABLE**: authentication, authorization/IDOR/
  tenant isolation, CSRF, multi-tenant aggregation leakage, AI excessive agency,
  tool/MCP security, RAG/memory security, container/IaC/CI-CD review.
- Judged **NOT VERIFIABLE FROM REPOSITORY**: backup/recovery; TLS/HSTS
  (terminated outside the extension).

Note the artifact under review is an **extension installed on the user's own
machine**, not a multi-user service. Judge the trust model accordingly, but say
so if you think that framing itself is wrong.

---

# 3. Finding 1 — `SEC-SECRETS-001`

**Title:** API key is reachable from the content-script context through
`chrome.storage.local`
**Status:** VALIDATION REQUIRED · **Severity:** LOW · **Confidence:** MEDIUM ·
**Counted as a confirmed vulnerability: no**

**Evidence given by the audit**

`extension/manifest.json`:

```json
  "content_scripts": [
    {
      "matches": [
        "http://*/*",
        "https://*/*"
      ],
      "js": [
        "vendor/Readability-readerable.js",
        "vendor/Readability.js",
        "utils/hash.js",
        "content/extractor.js",
        "content/normalize.js",
        "ui/i18n.js",
        "ui/derive.js",
        "ui/top-bar.js",
        "ui/panel.js",
        "content/content-script.js"
      ],
      "run_at": "document_idle"
    }
  ],
  "permissions": [
    "storage"
  ]
```

`extension/storage/settings.js`:

```js
const STORAGE_KEY = "settings";
export function createSettingsStore(area = globalThis.chrome?.storage?.local) {
  if (!area) throw new Error("No storage area available.");
  return {
    async get() {
      const stored = await area.get(STORAGE_KEY);
      return sanitizeSettings(stored && stored[STORAGE_KEY]);
    },
    // ...
  };
}
```

The message layer was found correct — `extension/background/service-worker.js`:

```js
    case "FACTIT_UI_PREFS":
      if (!isContentScript(sender) && !isExtensionPage(sender)) return false;
      settings.get()
        .then((s) => sendResponse({ language: s.uiLanguage }))
        .catch(() => sendResponse({ language: "auto" }));
      return true;
```

`extension/content/content-script.js` opens with the stated intent:

```js
// Runs in an isolated world on http/https pages. It must never receive
// API keys. Loaded after vendor/Readability*.js, utils/hash.js,
// content/extractor.js and content/normalize.js (see manifest.json),
// which provide the globals used here.
```

**The audit's reasoning:** Chrome exposes the `chrome.storage` API to content
scripts when the extension holds the `storage` permission. The key is therefore
readable from the content-script isolated world, which is the context that
processes hostile page content and loads the vendored Readability library. The
audit states plainly that **no code-execution primitive in that world was found**,
so the finding is not confirmed; it is a trust-boundary / defence-in-depth gap.

**The audit could not verify this at runtime** — see limitations.

**The audit's suggested remediations:** document the reachability in
`SECURITY.md`; consider `chrome.storage.session` (not exposed to content scripts
by default) accepting the loss of persistence that ADR-005 chose deliberately;
add a regression test that fails if anything under `extension/content/`
references `chrome.storage`.

---

# 4. Finding 2 — `SEC-CHAIN-001`

**Title:** Custom OpenAI-compatible endpoint may be any remote https host, which
then receives the API key and the article
**Status:** VALIDATION REQUIRED · **Severity:** INFORMATIONAL ·
**Confidence:** HIGH · **Counted as a confirmed vulnerability: no**

**Evidence given by the audit**

`extension/providers/openai-compatible.js`:

```js
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function validateBaseUrl(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (raw === "") throw configError("A base URL is required ...");
  let url;
  try { url = new URL(raw); } catch { throw configError("... not a valid absolute URL."); }
  const loopback = LOOPBACK_HOSTS.has(url.hostname);
  if (url.protocol === "http:" && !loopback) throw configError("Plain http is only allowed for localhost; ...");
  if (url.protocol !== "http:" && url.protocol !== "https:") throw configError("... must use http or https.");
  if (url.username || url.password) throw configError("... must not contain credentials.");
  if (url.search || url.hash) throw configError("... must not contain a query string or fragment.");
  return url.href.replace(/\/+$/, "");
}
```

and the request builder attaches the credential:

```js
  buildRequest(config, req) {
    const headers = {};
    if (config.apiKey) headers.authorization = `Bearer ${config.apiKey}`;
    return { url: `${config.baseUrl}/chat/completions`, headers, body: { ... } };
  }
```

The audit reports that probing the validator rejected non-http(s) schemes,
credentials, query/fragment, and plain http to non-loopback hosts, while
accepting any https host — including e.g. `https://169.254.169.254/latest`.

**The audit's reasoning:** this is the documented feature of the custom-endpoint
provider (`SECURITY.md`: *"A configured custom endpoint receives the key and the
article; the user is responsible for trusting that server."*). It is not
reachable by a webpage or a remote attacker, because only the local user can
write settings and (per the repository's smoke test) a content script cannot
trigger provider calls. Classified INFORMATIONAL rather than a defect.

---

# 5. Controls the audit reports as strengths (verify these claims)

- **One network egress.** All provider calls go through
  `extension/providers/common.js`:

```js
export async function send(fetchImpl, url, headers, body, providerId, apiKey, options = {}) {
  const sleep = options.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const request = () => fetchImpl(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    redirect: "error",
    credentials: "omit",
  });
  // ... one retry on 429/5xx, then a 2 MB capped body read
}
```

- **Credential redaction on every provider error surface:**

```js
export function redact(text, apiKey) {
  let out = typeof text === "string" ? text : "";
  if (apiKey && apiKey.length >= 8) out = out.split(apiKey).join("[redacted]");
  out = out.replace(/\b(sk|key|token)[-_][A-Za-z0-9_-]{8,}/g, "[redacted]");
  out = out.replace(/Bearer\s+[A-Za-z0-9._-]{8,}/g, "Bearer [redacted]");
  out = out.replace(/\s+/g, " ").trim();
  return out.length > MAX_ERROR_MESSAGE_CHARS ? out.slice(0, MAX_ERROR_MESSAGE_CHARS) + "…" : out;
}
```

- **Model output never trusted for control decisions.** The status is recomputed,
  and schema/verification fields are forced:

```js
export function deriveStatus(claims, concerns) {
  const codes = [...concerns.map((c) => c.type), ...claims.flatMap((c) => c.concerns || [])];
  if (codes.some((c) => CONCERN_SEVERITY[c] === "SIGNIFICANT")) return "SIGNIFICANT_CONCERNS";
  if (codes.length > 0) return "REVIEW_RECOMMENDED";
  return "NO_SIGNIFICANT_CONCERNS";
}
// ...
  const assessment = {
    status: deriveStatus(claims, concerns), // derived, never taken from the model
    confidence: clamp01(a.confidence),
    rationale: str(a.rationale, LIMITS.MAX_RATIONALE_CHARS),
    verification_level: VERIFICATION_LEVEL, // never taken from the model
    external_verification: EXTERNAL_VERIFICATION, // metadata, never a concern
  };
  // schema_version is likewise forced
```

- **Authorization on every message.** All 12 `chrome.runtime` message handlers
  check `sender.id === chrome.runtime.id`; 11 additionally require the correct
  context. The two gates are:

```js
function isExtensionPage(sender) {
  const extensionOrigin = chrome.runtime.getURL("").replace(/\/$/, "");
  return Boolean(sender && sender.id === chrome.runtime.id &&
    typeof sender.url === "string" && sender.url.startsWith(extensionOrigin + "/") &&
    (sender.origin === undefined || sender.origin === extensionOrigin));
}
function isContentScript(sender) {
  return Boolean(sender && sender.id === chrome.runtime.id && sender.tab && sender.tab.id &&
    typeof sender.url === "string" && /^https?:\/\//.test(sender.url));
}
```

The audit reports `FACTIT_ANALYZE` (spends tokens) is content-script-only,
`FACTIT_TEST_PROVIDER` (spends tokens) is extension-page-only, and the repository's
smoke test asserts that a content script cannot trigger provider calls and that an
extension page cannot submit an article for analysis.

- **No HTML sink.** The audit states there is **no** `innerHTML`, `outerHTML`,
  `insertAdjacentHTML`, `document.write`, `eval`, `new Function` or
  `createContextualFragment` anywhere in `extension/` outside `vendor/`, and that
  every model-derived string is assigned via `textContent` / `createTextNode`
  inside a **closed** Shadow DOM.
- **Prompt injection containment.** The article is sent as a JSON envelope in
  the user turn, never concatenated into the system prompt, and the system prompt
  states that everything in the user message is data. The audit notes that an
  article can still try to steer the analysis outcome, but judges the impact
  bounded because model output cannot trigger any privileged action.
- **Untrusted input bounds.** 40,000-char article content cap; DOM node cap of
  60,000 before cloning; 2 MB provider response cap; 60 s timeout; 8192 max
  tokens; 200-entry LRU cache; analysis runs only on explicit user click.
- **Other verified claims:** prototype-pollution payloads through the validator,
  migrations and settings left `Object.prototype` untouched (verified by
  execution); timed 1–5 MB hostile inputs against `Intl.getCanonicalLocales` and
  `Date.parse` showed no ReDoS; zero real credentials in tracked files or Git
  history (only obviously fake test keys such as `sk-smoke-test-key-0000`).

---

# 6. Declared limitations of the audit

- No live browser run was possible in the audit environment (the available
  Chromium is snap-confined and fails to start; the available Google Chrome 154
  ignores `--load-extension`). So `npm run test:smoke` — and any runtime probe of
  the content-script storage reachability — **was not executed**. Runtime claims
  rest on the manifest, the source and documented platform behaviour.
- The 151-test Node/jsdom suite **was** executed successfully.
- No penetration test, fuzzing or browser-runtime reverse engineering.
- Provider-side TLS/HSTS and backup/recovery are outside the repository.

---

# 7. Output format requested

Answer in this structure, in English, and be concise but specific:

**A. Verdict per finding**
For each of `SEC-SECRETS-001` and `SEC-CHAIN-001`:
- Agree / disagree with status and severity.
- The single strongest argument *against* the audit's conclusion, and whether it
  survives.
- What test or artifact would settle it.

**B. Additional candidate vulnerabilities**
For each: title, category, the exact code or configuration involved, the
source → sink path, preconditions, honest severity, and why the audit may have
missed it. If none, state **"No additional findings"** and briefly say what you
checked and why the surface is small (or not).

**C. Challenges to the strengths/coverage claims**
Which of the listed strengths do you consider overstated or unproven, and why.

**D. Unverifiable items**
What you could not assess from this material and what you would need.

**E. Overall confidence**
State your confidence in the audit's headline result (0 confirmed) as HIGH /
MEDIUM / LOW, and the one thing most likely to change it.
