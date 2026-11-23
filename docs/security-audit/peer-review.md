# Fact It — peer review of the security audit

**Audit under review:** `docs/security-audit/findings.json` (schema `factit.security-audit/1`), commit `f69ddd8`, version 1.4.0, audit date 2026-10-01.
**Review date:** 2026-10-01. **Reviewer environment:** same repository, working tree clean, **plus a working headless Chromium**, which the audit did not have.

## 0. Summary of the review

The audit is accurate and unusually honest about its own limits. I did not find a material error in either finding, and I found **no additional confirmed vulnerability**.

The review adds three things the audit could not or did not produce:

1. **Runtime confirmation of SEC-SECRETS-001's premise.** The audit could not start a browser and recorded the finding at MEDIUM confidence, unverified. I ran it: a content script reads the stored API key verbatim. The premise is now fact, not hypothesis → **raise confidence to HIGH** (status stays VALIDATION REQUIRED).
2. **Runtime validation of the proposed remediation.** `chrome.storage.session` at its default access level **throws** in the content-script world, so the audit's main recommendation would work — but it collides with ADR-005, which the audit does not mention.
3. **Four precision corrections to the declared strengths**, one of which (S6) is numerically wrong, and one (S2) is phrased in a way that contradicts SEC-SECRETS-001.

Two informational observations are added (§3), neither counted as a vulnerability.

Confidence in the audit's headline result of **0 confirmed vulnerabilities: HIGH** (§5).

---

## 1. Verdict per finding

### SEC-SECRETS-001 — API key reachable from the content-script context

**Verdict: AGREE with the classification (VALIDATION REQUIRED, LOW, not counted). Reclassify confidence MEDIUM → HIGH. Correct the stated precondition.**

The audit reasoned from the manifest and the storage module that the credential sits where the least-trusted extension context can read it, and flagged that it had not been executed. I executed it.

Probe: load the unpacked extension, store a canary key through the privileged options page, open an ordinary `http://` article page, then evaluate inside the content script's isolated world.

```
--- content-script isolated world ---
chrome.storage.local.get('settings') -> {"settings":{"apiKey":"sk-PROBE-CANARY-0123456789", ...}}
storage.session default access       -> THREW: Access to storage is not allowed from this context.
can it reach the network?            -> function
--- page main world ---
typeof chrome.storage -> undefined
bar host shadowRoot   -> null          (closed; page cannot read the UI)
can page message ext? -> blocked       (no externally_connectable)
```

So the full chain **read key → `fetch` to anywhere** exists in the content-script world; only the entry condition (code execution there) is missing. That is exactly what the audit said, and it is now evidence rather than inference. The isolation claims it makes about the *page* main world are also confirmed.

**Strongest argument against the audit (and why it does not win):** one could argue the finding is not a finding at all, because Chrome's extension model deliberately gives content scripts the `storage` API, so "the key is readable there" is a platform property, not a defect in Fact It. That argument fails on Fact It's own terms: `content/content-script.js` opens with "It must never receive API keys", and SECURITY.md promises the same. A control the code claims to have and does not have is worth recording, even at LOW severity. Keeping it out of the confirmed count is right.

**Correction to the precondition.** The audit writes the precondition as "a memory-safety or logic bug in the content-script code or in a component loaded into it". *Memory-safety* is the wrong frame for JavaScript and makes the risk sound more exotic than it is. The realistic entry condition is **supply-chain**: `extension/vendor/Readability.js` (89 KB of third-party code, re-vendored by `npm run vendor` from a dev dependency) runs in that world over attacker-controlled DOM. The precondition should read: *a compromised or malicious asset loaded into the content-script world (vendored Readability, or any future content-script dependency), or a logic bug in Fact It's own content-script code.* This matters because it changes which compensating control is primary: it is the lockfile pinning and vendoring discipline, not "no memory-safety bugs found".

**On the recommended remediation.** `chrome.storage.session` is confirmed inaccessible to content scripts by default, so the fix works technically. But **ADR-005 explicitly rejected session storage** ("cleared on browser exit; re-entering the key every session makes the extension impractical"). The audit recommends it without noting that it reverses a recorded decision. A reviewer-preferred ordering:

1. Adopt the cheap half now: the regression test asserting nothing under `extension/content/` references `chrome.storage` or imports `storage/`, and align the comment in `content-script.js` and SECURITY.md with reality (today they overstate the boundary).
2. Treat session storage as a product decision for ADR-005 to revisit, not a security to-do — with the honest trade-off that it costs the user a re-entry per browser session.

### SEC-CHAIN-001 — custom OpenAI-compatible endpoint may be any remote https host

**Verdict: AGREE (VALIDATION REQUIRED, INFORMATIONAL, not counted), with one reservation about the category label.**

The control set is as described, and I re-verified it in source: https required except loopback, credentials/query/fragment rejected, `redirect: "error"`, `credentials: "omit"`, 2 MB response cap, 60 s timeout. Exploitation requires the local user to configure the endpoint; a web page cannot write settings and cannot trigger provider calls (both refusals are asserted in the smoke test, which I ran — see §4).

**Strongest argument against the audit:** calling this *SSRF* is a category error. In SSRF an attacker induces a server to make a request it did not intend; here the user deliberately configures the destination and is warned in the settings page, SECURITY.md and PRIVACY.md. Under the audit's own classification rules this is closer to *accepted-by-design trust delegation* than to a finding. I would keep the entry (it usefully documents the residual risk) but relabel the category to "third-party trust / user-configured egress" and drop "SSRF".

The suggested extra control — refusing or confirming private/link-local ranges — is worth doing cheaply, because it costs one validation rule and defends the one case the user cannot foresee: a URL that *looks* public but resolves inward. Note that it is not complete without DNS-rebinding protection, which an extension cannot do properly; the remediation text should say so rather than implying a full fix.

---

## 2. Verdict on "0 confirmed vulnerabilities"

**Agree.** Both findings are correctly kept out of the confirmed count: SEC-SECRETS-001 has no entry condition in this repository, and SEC-CHAIN-001 requires the user's own configuration. Neither is reachable by the two actors that matter here — a hostile webpage and a hostile provider.

I attacked both of those actors' paths independently and reached the same conclusion:

| Actor | Path tried | Why it stops |
|---|---|---|
| Hostile page | DOM → Readability → extraction → normalization → prompt | Node cap, 40 k char cap, link/image caps; every prompt field re-coerced in `buildPrompt`; article travels JSON-escaped inside the user turn |
| Hostile page | DOM → UI | Closed shadow root (confirmed `shadowRoot === null` at runtime), `textContent` only, no HTML sink outside `vendor/` |
| Hostile page | page JS → extension | `chrome.storage` undefined in the main world; no `externally_connectable`; message to the extension blocked (confirmed at runtime) |
| Hostile page | page JS → cache poisoning | Cache key is the SHA-256 of the normalized text, so a crafted page can only retrieve the analysis *of that same text*; no cross-content substitution |
| Hostile provider | response → validator → UI | Status, `verification_level`, `external_verification` and `schema_version` forced by the validator; enums enforced; `__proto__` payload inert (tested); 2 MB cap; model name capped at 100 chars |
| Hostile provider | error body → user | `redact()` + 200-char cap, and the sink is the closed-shadow bar and the isolated-world console, neither readable by the page |
| Compromised content script | `FACTIT_ANALYZE` with forged article / `FACTIT_LOOKUP` with arbitrary hash | Real, but strictly dominated by SEC-SECRETS-001: the same precondition already yields the key directly, so these add no new impact |

**No additional findings.** I am stating that explicitly, as the audit's review prompt asks: I did not find a second confirmed vulnerability, and I did not manufacture one.

---

## 3. Informational observations the audit does not contain

Neither is a vulnerability; both are reportable gaps.

### PR-INFO-001 — the extension is trivially detectable by the page, which enables evasion

`#factit-bar-host` is appended to `<html>`, and since commit `19cc6fd` the bar also sets `margin-top` on `<html>` with `!important`. Confirmed at runtime: the page main world reads `margin-top: 28px` and sees the host element, with one line of JavaScript.

Consequence worth naming: a publisher who wants to avoid scrutiny can detect Fact It and **serve different content when it is present**. Fingerprinting is unavoidable for any visible in-page UI, so this is not a defect to fix; it belongs in SECURITY.md's known-limitations list next to the existing "the in-page UI can be imitated" entry, which currently covers spoofing but not detection-and-evasion.

### PR-INFO-002 — PRIVACY.md does not disclose that extraction runs on every readerable page

The content script extracts, normalizes and SHA-256-hashes the page **on load, without user action**, on every `http(s)` page that Readability considers readerable — including pages the user would not think of as articles. I verified that this is local-only: no network egress occurs, and `cache.get` returns before touching the LRU index on a miss, so nothing is persisted either.

PRIVACY.md and SECURITY.md say nothing about this (grep for "every page", "on load", "automatically" returns nothing). PRIVACY.md doubles as the store privacy policy, where "what is processed locally, and when" is exactly what a reviewer looks for. One paragraph fixes it.

---

## 4. Claims I could verify that the audit could not

The audit's stated blocker was that no browser would start. In this environment the snap Chromium does run with `--load-extension`, so:

- **`npm run test:smoke`: 29/29 checks pass, no failures.** This is the audit's single largest unverified dependency. It covers, in a real browser: the content-script refusal of `FACTIT_TEST_PROVIDER`, the extension-page refusal of `FACTIT_ANALYZE`, the `FACTIT_UI_PREFS` reply containing only `{"language":…}`, the closed shadow root, one provider call per Analyze click, and zero provider calls on load or on toolbar clicks.
- **`npm test`: 151/151 pass**, matching the audit.
- **`npm audit`: 0 vulnerabilities** with and without dev dependencies, matching the audit.
- The runtime probe in §1.

Everything the audit marked NOT VERIFIABLE for environmental reasons is now verified, and nothing it asserted about runtime behaviour turned out to be wrong.

---

## 5. Strengths that are overstated or imprecise

The audit asked which of its twelve strength claims are overstated. Four need correction; the other eight I verified and they stand as written.

**S6 — "All 12 message handlers check `sender.id` and 11 additionally require the correct context" is numerically wrong.** Counting from source: 10 handlers in `background/service-worker.js` (`PING`, `TEST_PROVIDER`, `ANALYZE`, `UI_PREFS`, `LOOKUP`, `CACHE_STATS`, `CACHE_CLEAR`, `USAGE_STATS`, `USAGE_RESET`, `OPEN_SETTINGS`) plus 2 in `content/content-script.js` (`FACTIT_EXTRACT`, `FACTIT_TOGGLE`) = 12 total, of which **9 are context-gated**, not 11: `FACTIT_PING` is deliberately ungated (it returns only the version) and the two content-script handlers check extension identity only. No security impact — the content-script handlers are reachable only from first-party extension contexts — but a strength claim should be countable. Correct to "9 of 12".

**S2 — "The key is read only by the background worker and the options page" is true of the code and false of the platform.** As written it reads as a confinement guarantee, which §1 disproves. It should say: *no code outside the background worker and options page reads the key, but any content script could* — with a pointer to SEC-SECRETS-001. As it stands, S2 and SEC-SECRETS-001 contradict each other in the same document.

**S3 — redaction is best-effort, and "verified by execution" should say against whom.** I re-ran `redact()` adversarially:

```
ok   exact echo / url-encoded / lowercased / json-escaped / Bearer / sk- pattern
LEAK base64 of key            -> token QUl6YVN5RC1FWEFNUExF...
LEAK split across whitespace  -> key AIzaSyD-EX AMPLE-KEY-...
```

Exact-substring plus prefix patterns cannot survive a deliberate transformation. This is **not** a vulnerability, and I want to be clear why: the only party positioned to transform the echo is the provider, which already received the key in the `Authorization` header, and the sinks (closed-shadow bar, isolated-world console) are not readable by the page. Redaction protects against *accidental* disclosure — screenshots, pasted errors, shared consoles. The claim should be scoped that way instead of implying it is adversarially complete.

**S10 — the vendor drift test detects drift, not compromise.** `tests/unit/vendor.test.js` compares `extension/vendor/` against `node_modules/@mozilla/readability`. If a malicious version were installed, both sides would match and the test would pass. The real supply-chain control is the lockfile's sha512 integrity pinning (which is genuine and which I confirmed), plus the fact that re-vendoring is a deliberate, committed step. Claim the lockfile; describe the test as drift detection. This matters more than it looks, because that file is the most plausible entry condition for SEC-SECRETS-001 (§1).

Verified as written and not overstated: **S1** (single egress — note that a `grep "fetch("` misses it, because the only call site is `fetchImpl(url, …)` in `common.js:59` bound from `globalThis.fetch` in `provider.js:50`; the vendored Readability contains zero egress primitives), **S4**, **S5**, **S7**, **S8**, **S9**, **S11**, **S12**.

I also checked a surface introduced in 1.4.0 that the audit does not discuss: the i18n layer could, in principle, let model text be used as a dictionary key and be silently replaced by a different string. It cannot — `t()` is only ever called with literals or validated enum codes, and model-derived text is always passed as a *value* to `el()`/`row()`. No action needed; worth a line in the next audit.

---

## 6. What remains unverifiable, honestly

- Provider-side behaviour (TLS, retention, what the endpoint does with the article) is outside the repository, as the audit says.
- "No code-execution primitive exists in the content-script world" is an absence claim over 89 KB of vendored third-party code; neither the audit nor this review can prove it. The honest statement is that none was found and that the lockfile plus vendoring discipline is the control.
- Everything else the audit listed as environmentally unverifiable is now verified (§4).
- This review inherits the audit's commit scope: `f69ddd8`, working tree clean apart from the untracked `docs/security-audit/` directory.

---

## 7. Recommended edits to the audit artifacts

| Artifact | Edit |
|---|---|
| `findings.json` SEC-SECRETS-001 | `confidence`: MEDIUM → **HIGH**; rewrite `preconditions[0]` to "compromised/malicious asset in the content-script world, or a logic bug in Fact It's content-script code" (drop "memory-safety"); note in `recommended_remediation` that session storage reverses ADR-005 |
| `findings.json` SEC-CHAIN-001 | `category`: drop "SSRF", use "third-party trust / user-configured egress"; note that private-range blocking is not complete without DNS-rebinding protection |
| `security_strengths` S2, S3, S6, S10 | Rewrite per §5 |
| `limitations` | Replace the "no browser available" limitation with the results in §4, or mark it as lifted by this review |
| New informational entries | PR-INFO-001 (detectability/evasion), PR-INFO-002 (PRIVACY.md disclosure) |
| Repository, separately | Add the content-script storage regression test; add the two disclosure paragraphs to SECURITY.md / PRIVACY.md |

## 8. Confidence

**HIGH** in the audit's "0 confirmed vulnerabilities" for commit `f69ddd8`.

Basis: the two untrusted actors' paths were walked independently and stop at controls I verified in source and, for the decisive ones, at runtime; the unit and smoke suites pass in a real browser; dependencies are pinned with 0 advisories. The confidence is bounded by the one absence claim in §6 and by everything outside the repository.
