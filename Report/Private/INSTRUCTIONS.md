# Private reports: instructions for the Report Writer of Fact It

**Audience: the owner only.** The website never reads these files: it shows a single line saying a report exists. This is the place for the full, internal picture, the one a reviewer would want: what was measured, where the artifacts are and what to check next.

**File:** `Report/Private/<YYYY-MM-DD>-daily-report.json`, UTC date, one per day. **Language:** English. This is the source the Public and Sensitive reports are derived from, so write it first.

## What to include

This is where the machinery goes: the files, checks, tests, reviews and tooling the Public and Sensitive reports leave out. Keep the **subject** first, as in `../Public/INSTRUCTIONS.md`, then the internal detail.

Use the same blocks as `../Public/INSTRUCTIONS.md` (answer with limits, metrics, findings with Observed / Concrete example / Why it matters / Does not establish, next checks, owner actions, limits) and add the internal detail the other folders may not carry:

- `evidence[]` items may add a `path` (repository-relative or absolute), plus commands, hashes, line references and task ids so each claim can be reproduced.
- Name what each artifact is, what it counts, and what it does **not** show.
- Put the honest negatives in: failing checks, blocked work, dead ends, and anything that could change the position.
- Separate facts (measured) from inference (labelled) and from what was not checked.

## One thing that stays the same

**No secrets, even here**: no tokens, passwords, private keys, session cookies or personal data. These files can be copied, backed up or committed by mistake. Refer to a secret by name ("the deploy key") and never paste it.

## Before you finish

1. The file must be valid JSON (`node -e "JSON.parse(require('fs').readFileSync(process.argv[1]))" <file>`). There is no content validator for this folder.
2. This folder is not versioned (see `../.gitignore`).
3. Then derive the Sensitive and Public reports from it, if the owner's class for this project allows them (`node ~/agent-office-release/scripts/report-class.mjs delivery-factit`).
