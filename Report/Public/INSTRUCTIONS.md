# Public reports: instructions for the Report Writer of Fact It

**Audience: anyone on the internet.** A valid file here is shown on the owner's website (Agents work → Fact It) exactly as written, as soon as the owner has set the project to Public. Write for a curious stranger, not for the team.

**File:** `Report/Public/<YYYY-MM-DD>-daily-report.json`, UTC date, one per day (update it if it exists). **Language:** English.

## What to write about

Write about the **subject of the project**, for a reader who cares about the subject and has never seen the repository. 

| Write about | Not about (this belongs in the `Private` report) |
|---|---|
| what the project is trying to find out or build, and why it matters | files, file counts, checksums, hashes, sizes, byte or line counts |
| what was learned today: results, hypotheses and how each one fared | tests, test suites, builds, code reviews, linters, CI, deployments |
| the calculations and arithmetic behind a result, and what they show | repositories, branches, mirrors, tooling, scripts, folders, data formats |
| external sources with relevant information: who said what, and how far it can be trusted | agents, roles, delegation, models, queues, task or board bookkeeping |
| what the result means, what it does not show, and what to try next | governance and housekeeping (who decides, permissions, policies) |

Test every sentence: *would a curious stranger care about this without knowing how the work is organised?* If not, cut it or move it to `Private`. `metrics` count things of the subject (hypotheses tested, results reproduced, sources checked), never things of the process. `evidence` names the analyses and sources behind a claim in plain language, not the tools that ran them.

## What a good report looks like

A document that answers first and shows how far the claim goes, not a wall of text. Fill these blocks (all are optional, but a report needs at least `answer` or `findings`):

| Block | Content |
|---|---|
| `answer` | `title`, `body` (one to three short paragraphs: what a reader needs without scrolling) and `limits[]` (`level` low, medium or high, plus `text`): how far the claim goes and how sure you are |
| `metrics[]` (up to 8) | `label`, a short `value` (`7`, `3 of 5`) and a `note` saying what it counts. Only numbers that were measured |
| `findings[]` (up to 12) | `title`, `status` (low, medium or high confidence) and `fields[]` of `label` + `text`. Use the same labels every day: Observed, Concrete example, Why it matters, Does not establish |
| `evidence[]` | `name` and `description` in plain language ("the overlap graph report: counts the exact edges"). A name, never a path or a link to an internal system |
| `nextChecks[]` | what would weaken the current position and the next verification steps |
| `ownerActions[]` | decisions waiting for the owner: stable `id` (`OA-<SLUG>-01`), `title`, `publicSummary`, `status`, `replyCue`. None if nothing is waiting |
| `limits` | one line on what was not verified |

Fixed fields: `schemaVersion` 1, `projectSlug` `delivery-factit`, `projectName` `Fact It`, `reportDate`, `classification` `Public`, `title`, `summary`. Text is at most 2000 characters per field. Inline markup is only `` `code` `` and `**bold**`.

```json
{
  "schemaVersion": 1, "projectSlug": "delivery-factit", "projectName": "Fact It",
  "reportDate": "YYYY-MM-DD", "classification": "Public",
  "title": "…", "summary": "One or two sentences.",
  "answer": { "title": "…", "body": ["…"], "limits": [{ "level": "medium", "text": "…" }] },
  "metrics": [{ "label": "…", "value": "…", "note": "…" }],
  "findings": [{ "title": "1. …", "status": "medium", "fields": [{ "label": "Observed", "text": "…" }] }],
  "evidence": [{ "name": "…", "description": "…" }],
  "nextChecks": ["…"],
  "ownerActions": [],
  "limits": "…"
}
```

## Never write here (the validator rejects it and the report is shown as "withheld")

- Local or absolute paths, file names from the repository, line numbers, folder names, user names, host names, IP addresses, git remotes, branch names, commit hashes, logs, environment or configuration details, kanban task ids, model or lane names.
- Links other than public `https://` primary sources in `sourceRefs`. If there is no safe public source, drop the citation and generalize the claim.
- Secrets, credentials, personal data, customer names, unreleased security findings, exploit steps, third-party private content.
- Invented progress. Say what was verified and how ("the project's own checks passed", "independently reproduced"). Internal evidence belongs in the `Private` report.

## Before you finish

1. Write the `Private` report first (full detail), then derive this one from it by removing what is on the list above.
2. Validate: `node ~/agent-office-release/scripts/validate-report.mjs Report/Public/<date>-daily-report.json`. Fix the **text** until it prints `OK`; never weaken the rules.
3. Hand off with the file name, "validated", and anything you left out for privacy.
