# Fact It - Current Milestone

## CURRENT

V0.6 - Fact It Bar

## Objective

Inject a thin indicator at the top of the webpage representing
FACTUAL SUPPORT only.

## Tasks

- [x] ui/top-bar.js - closed shadow root, fixed 28px bar, states idle /
      loading / result / error / no-article, dismiss
- [x] Support and confidence labels: descriptive wording, no verdict
      words (per skills/ux-review)
- [x] Preliminary status always visible ("AI preliminary · not
      externally verified")
- [x] Content script shows the idle bar on article pages; Analyze
      button and toolbar click share one run path; result/error
      rendered in the bar
- [x] Background: FACTIT_OPEN_SETTINGS from content scripts
- [x] 7 unit tests (states, thresholds, hostile strings as text, closed
      root, dismiss); smoke test checks idle-on-load with zero provider
      calls, result state, no bar on non-article pages

## Acceptance Criteria

- [x] Indicator represents overall_factual_support only; framing,
      neutrality, source popularity and community opinion play no part.
- [x] Inactive by default: no provider call until the user clicks.
- [x] Model strings can never become markup in the page.
- [x] Page CSS/JS cannot restyle or read the bar.
- [x] No new permissions.

## Status

V0.6 complete on 2026-09-17.

Notes:

- Bar is a fixed overlay; it does not push page content. Sites with
  their own fixed headers are partly covered by 28px until dismissed.
- UI strings are English; analysis text follows the article language.
- Clicking the bar body does nothing yet (V0.7 opens the panel).
- Live run 2026-09-17 (heise.de, deepseek-flash): bar rendered
  0.72 / moderate confidence / 8 claims / 4 flags.

## Follow-ups noted (not in this milestone)

- Extraction quality: on heise.de Readability kept a related-article
  teaser and audio-player labels; the model flagged them as foreign
  fragments. Consider a post-filter for aside/player widgets or
  Readability options (V0.9 hardening or a V0.2 follow-up).
- Prompt 1.0.1: mention manipulation attempts only when present; a
  call-to-action tone in security advisories is not ACTIVIST framing.

## NEXT

V0.7 - Expanded Panel (see PLAN.md). Not started.

## DO NOT IMPLEMENT YET

- Local cache
- Evidence Engine
- Community
- Authentication
- Database
- Reputation
