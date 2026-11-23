# GitHub Issues — Security Audit

Source: `docs/security-audit/findings.json` (canonical). Generated after the
findings were frozen; no finding is added or changed here.

## Confirmed vulnerabilities requiring an issue

**None.** The audit produced **0 CONFIRMED vulnerabilities**, so no
`[Security]` issue for a confirmed vulnerability is created. Per the audit
rules, items with status `NOT APPLICABLE`, `NOT VERIFIABLE` and
`VALIDATION REQUIRED` are not turned into vulnerability issues.

| Finding | Status | Severity | Issue created |
|---|---|---|---|
| SEC-SECRETS-001 | VALIDATION REQUIRED | LOW | Investigation task only (justified below) |
| SEC-CHAIN-001 | VALIDATION REQUIRED | INFORMATIONAL | No — documented, accepted BYOK behaviour |

---

## Investigation task (justified for a VALIDATION REQUIRED item)

### [Security] Investigate and document API key reachability from the content-script context

Labels: `security`, `severity:low`, `investigation`, `docs`

**Problem description**

The extension declares the extension-wide `storage` permission and injects
content scripts into every `http://*/*` and `https://*/*` page. The provider
API key is stored in `chrome.storage.local`. Chrome exposes `chrome.storage`
to content scripts when the extension holds the `storage` permission, so the
credential is reachable from the content-script execution context — the
context that processes hostile page content and loads the vendored
Readability library.

The extension honours its stated design at the message layer: `FACTIT_UI_PREFS`
returns only `{ language }` and the key never crosses the message channel.
The gap is the *context-level* reachability of the storage area, not a
message-handling defect.

**Evidence**

- `extension/manifest.json` L26-46 — `content_scripts.matches` covers
  `http://*/*` and `https://*/*`.
- `extension/manifest.json` L51-53 — `"permissions": ["storage"]`.
- `extension/storage/settings.js` L57-63 — the settings store (including
  `apiKey`) is read from `chrome.storage.local`.
- `extension/content/content-script.js` L1-14 — the header states content
  scripts must never receive API keys.
- `extension/background/service-worker.js` L151-156 — `FACTIT_UI_PREFS`
  returns only the language (the message-layer control is correct).

**Impact**

If JavaScript execution is ever achieved inside the content script's isolated
world (a bug in the content-script code or in the vendored Readability, which
runs there), the attacker could read `chrome.storage.local.get("settings").apiKey`
and exfiltrate it to the page or the network. No such primitive was found in
this audit, which is why the finding is VALIDATION REQUIRED and not a
confirmed vulnerability.

**Attack path**

```
UNTRUSTED WEBPAGE CONTENT
-> content-script isolated world (vendored Readability / content-script code)
-> MISSING CONTROL: no per-context ACL on chrome.storage.local for content scripts
-> chrome.storage.local.get("settings").apiKey
-> exfiltration
-> API key disclosure (billing/abuse on the user's provider account)
```

**Preconditions**

- A code-execution primitive inside the content-script isolated world (none
  demonstrated).
- A saved API key.

**Remediation guidance**

1. Verify the behaviour at runtime (see acceptance criteria) and record the
   actual reachability in `SECURITY.md`.
2. Either (a) accept and document the residual risk, or (b) evaluate storing
   the credential in `chrome.storage.session`, which Chrome does not expose to
   content scripts unless `setAccessLevel("TRUSTED_AND_UNTRUSTED_CONTEXTS")`
   is called, with the background worker re-hydrating it. Option (b) trades a
   browser-restart re-entry of the key against removing the reachability;
   ADR-005 rejected session storage for persistence reasons, so the decision
   must be revisited explicitly and recorded in `DECISIONS.md`.
3. Consider keeping the content-script world minimal and treating every
   library loaded into it as security-relevant.
4. Add a regression test that fails if any file under `extension/content/`
   references `chrome.storage` or imports a module from `storage/`.

**Verifiable acceptance criteria**

- [ ] A decision (fix or formally accept) is recorded in `SECURITY.md` /
      `DECISIONS.md`, including where the key is stored and whether content
      scripts can read it.
- [ ] If session storage is adopted: from a content-script isolated world,
      `chrome.storage.local.get('settings')` returns no `apiKey` and
      `chrome.storage.session.get('settings')` returns nothing; the background
      worker still completes an analysis end to end.
- [ ] If the risk is accepted: the acceptance and its compensating controls
      are written down and linked from `SECURITY.md`.
- [ ] A test fails when a `chrome.storage` reference or a `storage/` import is
      added under `extension/content/`.
- [ ] The existing message-layer guarantee is preserved:
      `FACTIT_UI_PREFS` still returns only `{ language }`.
