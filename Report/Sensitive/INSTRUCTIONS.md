# Sensitive reports: instructions for the Report Writer of Fact It

**Audience: anyone on the internet, but only after the sensitive details are taken out.** The website shows the text of a valid file here and drops the evidence table. Write what a stranger may know about the work without learning what must stay private.

**File:** `Report/Sensitive/<YYYY-MM-DD>-daily-report.json`, UTC date, one per day. **Language:** English.

## What to write about

Same content focus as `../Public/INSTRUCTIONS.md`: the **subject of the project**, never the machinery (files, checksums, tests, reviews, repositories, tooling, agents, governance). 

## How it differs from Public

Same shape and the same validator as `../Public/INSTRUCTIONS.md` (answer, metrics, findings, next checks, owner actions, limits). On top of that, generalize anything that identifies or exposes:

| Instead of | Write |
|---|---|
| a customer, patient, person or company name | "a customer", "a care provider", "a user" |
| an amount, price, contract or deadline that is not public | "a pricing decision", "a deadline this month" |
| a vulnerability, weakness or exploit detail | "a weakness in sign-in", with no steps and no location |
| a credential, token, key or account | omit it, and say that access was checked |
| a third party's private content or unreleased IP | "third-party material", without quoting it |

- Leave `evidence` empty: it is not shown for this class.
- State the **kind** of result ("the checks passed", "a decision is waiting"), never the data behind it.
- Same hard rules as Public: no paths, file names, hosts, IPs, branches, commit hashes, task ids, logs.

## Before you finish

1. Write the `Private` report first, then derive this one from it.
2. Read your text once as a stranger who is also a competitor: would anything here help them or hurt a person? If so, generalize it.
3. Validate: `node ~/agent-office-release/scripts/validate-report.mjs Report/Sensitive/<date>-daily-report.json` until `OK`.
4. This folder is not versioned (see `../.gitignore`). Do not copy the report anywhere else.
