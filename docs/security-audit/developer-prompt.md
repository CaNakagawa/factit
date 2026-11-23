# Developer Prompt — Security Audit Follow-up

> **How to use this file:** copy everything from the horizontal rule below
> into a fresh coding-agent session (the agent has no memory of this audit).
> It is a bounded follow-up to the security audit, not a new milestone.

---

# Task: act on the security audit of Fact It

You are the **Developer Agent** for this repository (see `agents/DEVELOPER.md`).
A security audit has already been completed. Your job is to **process its
results correctly**, not to repeat the audit and not to discover vulnerabilities
of your own.

## Required reading before you touch anything

1. `AGENTS.md` (mandatory principles)
2. `docs/security-audit/findings.json` — **canonical source of truth**
3. `docs/security-audit/findings.md` — the same findings, readable
4. `SECURITY.md`, `DECISIONS.md` (especially ADR-005 and ADR-006)
5. `docs/DEVELOPMENT.md` (permissions table and verification steps)
6. `agents/DEVELOPER.md` and `skills/security-review/SKILL.md`

The audit report `docs/security-audit/security-audit-report.pdf` is in
Brazilian Portuguese and is **derived** from `findings.json`. Never treat the
PDF or `findings.md` as a source of new findings — if you think you found
something, it is a *new* finding and must be reported to the maintainer as
such, not silently folded into this work.

## Audit result you must respect

- Audited revision: `main` @ `f69ddd8693e30cd7d326e0e3a32ab281a6dc3983` (v1.4.0).
- **Confirmed vulnerabilities: 0.**
- **Items requiring validation: 2.** Both have status `VALIDATION REQUIRED`
  and are explicitly **not** counted as confirmed vulnerabilities.
- 151 automated tests passed during the audit (`npm test`).

Rules for interpreting this:

- Do **not** treat `SEC-SECRETS-001` or `SEC-CHAIN-001` as confirmed bugs.
- Do **not** invent additional findings, do not "harden" things the audit found
  correct, and do not re-litigate the audit's conclusions.
- Do **not** weaken or delete existing controls while making changes.
- The audit could **not** run a real browser (`npm run test:smoke` and an
  ad-hoc content-script probe were blocked by the audit environment). Runtime
  verification is therefore still outstanding and is part of your job.

## Work to do

Do these in order. **Stop and ask the maintainer** before any change that
alters the architecture or violates a stated principle.

### 1. Establish the runtime fact behind `SEC-SECRETS-001` (no code change yet)

The claim is: because `manifest.json` grants the extension-wide `storage`
permission (L51-53) and injects content scripts on `http://*/*` and
`https://*/*` (L26-46), a content script's isolated world can read the API key
from `chrome.storage.local` (`storage/settings.js` L57-63), even though the
message layer is correct (`FACTIT_UI_PREFS` returns only `{ language }`,
`background/service-worker.js` L151-156).

- Reproduce or refute this with a real browser run. The existing harness in
  `tests/integration/smoke.mjs` already loads the unpacked extension, finds the
  content script's isolated world via CDP and evaluates expressions in it —
  extend that pattern rather than building a new harness.
- Note: branded Google Chrome 137+ ignores `--load-extension`. Use
  `FACTIT_BROWSER=/path/to/chromium` as documented in `docs/DEVELOPMENT.md`.
- Report the observed result to the maintainer **before** writing any fix.
  If the key is **not** reachable, say so plainly — that refutes the finding
  and the correct action is to record that, not to add code.

### 2. Record the decision (documentation only)

Once the runtime fact is known, the maintainer must choose one of:

- **(a) Accept** the residual risk, or
- **(b) Move the credential out of content-script reach** — for example
  `chrome.storage.session`, which Chrome does not expose to content scripts
  unless `setAccessLevel("TRUSTED_AND_UNTRUSTED_CONTEXTS")` is called.

Present both options with concrete tradeoffs (option (b) forces re-entering the
key after a browser restart, which is exactly why ADR-005 rejected session
storage, so ADR-005 must be revisited explicitly — see `AGENTS.md`:
architectural changes require problem, alternatives, tradeoffs and a recorded
decision in `DECISIONS.md`). Do **not** implement option (b) without the
maintainer's approval.

Either way, `SECURITY.md` must end up stating truthfully **where the key is
stored and whether content scripts can read it**. Today it says content scripts
must never *receive* keys (true at the message layer) but is silent about
storage reachability.

### 3. Add the regression test (regardless of the choice in step 2)

Add a test that fails if any file under `extension/content/`:
- references `chrome.storage`, or
- imports a module from `storage/`.

Match the style of the existing tests in `tests/unit/`. Keep it small.

### 4. Decide on `SEC-CHAIN-001` (maintainer decision, likely no code change)

`providers/openai-compatible.js` `validateBaseUrl()` (L17-39) correctly rejects
non-http(s) schemes, credentials, query/fragment and plain http to non-loopback
hosts, and `send()` uses `redirect: "error"` + `credentials: "omit"`. It does
accept any remote https host, so a user-configured endpoint receives the API
key and the article. This is the documented BYOK feature
(`SECURITY.md` known limitations).

Only if the maintainer asks for a change: consider requiring an explicit
confirmation for remote https URLs that resolve to private/loopback/link-local
ranges. **Do not implement this by default** — it is a product decision, and
the audit classified it INFORMATIONAL.

## Verification (must all pass before you report back)

```
npm test                 # 151 tests currently green — do not regress
npm run test:smoke       # requires a Chromium that honours --load-extension
npm run package          # runs the unit tests, then zips extension/
```

If `npm run test:smoke` cannot run in your environment, say so explicitly in
your report instead of claiming it passed. Do not mark runtime work as done
based on static reasoning alone.

If you touched `SECURITY.md`, keep its threat-model table and its
"known limitations" honest: every row must still describe a control that
actually exists, with the test that covers it.

## Constraints

- Do not implement anything from `ROADMAP.md` or a future milestone.
- Do not add permissions, dependencies, network calls or HTML sinks.
- Keep the change set small and reviewable; one concern per commit.
- Security-sensitive changes require explicit review — flag them as such in
  your summary.
- Do not edit `docs/security-audit/findings.json`. It is frozen. If a finding
  turns out to be wrong, report it to the maintainer; do not rewrite history.

## Report back with

1. What you actually observed when running the browser check (command +
   observed output, or the blocker).
2. The files you changed and why, one line each.
3. Whether `SECURITY.md` / `DECISIONS.md` were updated, and the exact wording
   of the recorded decision.
4. Test results: `npm test`, `npm run test:smoke`, `npm run package` — passed,
   failed, or not runnable and why.
5. Anything you could not verify, stated plainly.
6. Any **new** issue you noticed, reported as new and separate — never mixed
   into the audit findings.
