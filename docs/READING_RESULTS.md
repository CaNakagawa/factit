# How to read a Fact It result

Fact It reports **concerns found in the content**, not verdicts about
the truth of the content. Nothing in this version is externally
verified. This page explains what each part of the interface means.

## The bar

![The Fact It bar and summary panel](images/bar-and-summary.jpg)

The thin bar at the top of the page carries the status and, when there
is something to count, the number of concerns:

| Status | Meaning |
|---|---|
| **No significant concerns** | No meaningful warning signals were found in the analyzed content. A normal, complete result — not a claim that the article is true. |
| **Review recommended** | There are concrete reasons for caution; read the concerns before relying on it. |
| **Significant concerns** | Signals strong enough that the content may mislead. |

Every status is shown next to *AI preliminary · not externally
verified*. That label is **metadata about Fact It**, not a finding
about the article, and it never changes the status.

## The summary panel

**Details** opens the summary: the status and what it means, analysis
confidence, counters, the verification notice, key findings, observable
source transparency and possible framing.

The counters distinguish two levels: **concerns** are significant
signals, **observations** are moderate ones. The bar's number is the
total of both, so a bar reading *Review recommended · 3 concerns* can
sit above *0 concerns · 3 observations* in the panel.

A statement the article asserts as fact while naming no source and
showing nothing counts as a signal on its own, so the status reflects
it even when the model wrote no separate note. Attributed reporting,
reported allegations and plain uncertainty never do.

Interface text follows your **Interface language** setting; the
analysis text itself is written in the language of the article and is
never translated.

## The detailed analysis

**Detailed analysis** opens five tabs:

- **Overview** — the rationale, and what separates a concern from
  ordinary reporting.
- **Claims** — each claim, expandable: its status within the article,
  attribution, the evidence the article gives, the evidence type,
  concerns, what is missing, and the inference a reader may draw.
- **Evidence** — the evidence profile, and the side-by-side view. Each
  claim is shown with what the article states on the left and what it
  shows for it on the right; where the wording invites a reading the
  text does not establish, the left box holds that reading instead.
- **Framing** — observable characteristics only.
- **About** — provider, model, prompt and schema version, tokens and
  estimated cost.

<img src="images/about-tab.jpg" alt="The About tab" width="420">

## What the labels mean

- **Status** reflects the strength of warning signals in the content.
  It is **not** a truth verdict and **not** a judgement of political,
  ideological or religious position. Ordinary attributed reporting is
  not a concern.
- **Tags describe the article, never the truth of a claim.**
  DOCUMENTED and SOURCED say what the article shows for a claim;
  UNSOURCED and NEEDS REVIEW say what it is missing. There is
  deliberately **no FACT tag** — nothing here is externally verified
  (ADR-009).
- **Claim labels** — "Supported within article", "Attributed
  reporting", "Allegation reported, attributed", "Unsupported within
  article", "Contradicted within article". None of them means
  *verified*.
- **Framing** is assessed separately and never lowers factual support.
  A strongly framed article can be accurate; a neutral one can be
  wrong.
- **Unverified** and **Insufficient evidence** are honest outcomes, not
  failures.

A future Evidence Engine may add evidence-backed verification. Until
then, nothing in Fact It claims that external verification happened
(ADR-008).

## Related

[ANALYSIS_SCHEMA.md](ANALYSIS_SCHEMA.md) ·
[PROMPT.md](PROMPT.md) ·
[../DECISIONS.md](../DECISIONS.md)
