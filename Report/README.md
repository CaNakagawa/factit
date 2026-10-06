# Report

Daily reports of **Fact It**, written by the project's **Report Writer** role and grouped by who may read them.

| Folder | Who can read it | What the website shows | In git |
|---|---|---|---|
| `Public/` | everyone | the whole report, in the "Agents work" pop-up | versioned |
| `Sensitive/` | everyone, after details are generalized | the text, without the evidence table | stays on the machine (ignored) |
| `Private/` | the owner only | only "a report exists", the text is never read | stays on the machine (ignored) |

Each folder has an `INSTRUCTIONS.md` with the rules the writer follows for the reports in that folder. Read it before writing.

## How it works

1. Every day the project's PM gives the Report Writer role one task: write today's report.
2. The writer asks which class the owner set for this project (`node ~/agent-office-release/scripts/report-class.mjs delivery-factit`) and writes the report for that class **and for every more restrictive class**: Public projects get a Public, a Sensitive and a Private report, Sensitive projects a Sensitive and a Private one, Private projects only a Private one.
3. The file is `Report/<Folder>/<YYYY-MM-DD>-daily-report.json` (UTC date). One file per day: update it instead of adding another.
4. AgentOffice reads these folders every minute. The class shown on the website is the **more restrictive** of the folder and the class the owner set for the project, so a file in the wrong folder can never publish more than the owner allows.
5. The writer does not commit, push or publish. The PM decides what goes into a pull request.

## Rules that never change

- The owner decides the class. Never edit the owner's configuration and never move a report to a more open folder than the owner allowed.
- No secrets in any folder: no tokens, passwords, keys or personal data, not even in `Private/`.
- Facts are facts, inference is labelled inference, and what was not checked goes in the limits. "Nothing changed today" is a valid report.

Project language for reports: English.

