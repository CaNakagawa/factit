# Fact It - Current Milestone

## CURRENT

V0.7 - Expanded Panel

## Objective

Clicking the Fact It bar opens the analysis details.

## Tasks

- [x] ui/panel.js - renders into the bar's closed shadow root; open /
      close / toggle; `data-factit-panel` on the host
- [x] Compact layout: overview (support + confidence + "no external
      sources" notice), Conclusion, "Show detailed analysis" toggle,
      one-line provenance (model, provider, prompt version, time,
      truncation / dropped-item notes)
- [x] Details (collapsed by default): claims (classification badge,
      allegation marker, confidence, explanation), flags, framing (own
      section, independence note)
- [x] Prompt 1.0.1: conclusion-first summary (3-6 sentences, ~700
      chars, no lists); manipulation mentioned only when present;
      genre-inherent calls to action are not framing
- [x] Bar: Details button and bar-body click in result state
- [x] Content script wires bar and panel
- [x] 8 unit tests (sections, humanized enums, framing separation,
      empty states, hostile strings, collapse/toggle, bar affordance)
- [x] Smoke test: real click on Details through the closed shadow root
      (CDP DOM domain) and panel content read back

## Acceptance Criteria

- [x] Displays claims, classification, confidence, flags, framing,
      explanations, provider, model and preliminary status.
- [x] Framing is visually and textually separate from factual support.
- [x] Model strings can never become markup.
- [x] Panel is unreachable from page CSS/JS.
- [x] No new permissions.

## Status

V0.7 complete on 2026-09-17.

Notes:

- Enum codes are humanized for display (MISSING_CONTEXT -> "Missing
  context"); the schema values are unchanged in the data.
- Timestamps use the browser locale; UI strings are English.
- Panel width is min(440px, 100vw); on phones it fills the width.
- Live run 2026-09-17 (BBC News Brasil, deepseek-flash): 20 claims /
  9 flags, Portuguese output; the 1.0.0 summary hit the 1200-char cap,
  which motivated the 1.0.1 conclusion format and the collapsed
  details.

Fix 0.7.1: the toolbar button used to run the analysis and re-ran it
on every click. It now only shows the bar / toggles the panel; only
the bar's Analyze button calls the provider, and a page with a result
cannot be re-run until Re-analyze (V0.8). Smoke test asserts one
provider call across repeated clicks.

## Follow-ups noted (not in this milestone)

- Extraction quality: on heise.de Readability kept a related-article
  teaser and audio-player labels; the model flagged them as foreign
  fragments. Consider a post-filter for aside/player widgets or
  Readability options (V0.9 hardening or a V0.2 follow-up).

## NEXT

V0.8 - Local Cache (see PLAN.md). Not started.

## DO NOT IMPLEMENT YET

- Evidence Engine
- Community
- Authentication
- Database
- Reputation
