// Fact It bar: states, wording thresholds, and text-only rendering of
// untrusted model strings. jsdom provides the DOM and shadow roots.

import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { loadClassicScript } from "../helpers/load-script.js";

const dom = new JSDOM("<!DOCTYPE html><html><head></head><body><p>page</p></body></html>", { url: "https://example.com/" });
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
loadClassicScript(new URL("../../extension/ui/top-bar.js", import.meta.url));
const { createTopBar, supportLabel, supportColor, confidenceLabel } = globalThis.FactIt;

function result(overrides = {}) {
  return {
    analysis: { overall_factual_support: 0.62, confidence: 0.45, verification_level: "AI_PRELIMINARY" },
    claims: [{}, {}, {}],
    flags: [{}],
    framing: { detected: false },
    summary: "s",
    ...overrides,
  };
}

// Join element texts with spaces; textContent alone would glue adjacent spans.
const text = (bar) => [...bar.root.querySelectorAll(".bar > *:not(.main), .main > *")]
  .map((n) => n.textContent).join(" ").replace(/\s+/g, " ").trim();

test("support and confidence labels are descriptive, not verdicts", () => {
  assert.equal(supportLabel(0.9), "Well supported");
  assert.equal(supportLabel(0.75), "Well supported");
  assert.equal(supportLabel(0.6), "Partially supported");
  assert.equal(supportLabel(0.3), "Weakly supported");
  assert.equal(supportLabel(0.1), "Insufficient support");
  assert.equal(confidenceLabel(0.8), "high confidence");
  assert.equal(confidenceLabel(0.5), "moderate confidence");
  assert.equal(confidenceLabel(0.1), "low confidence");
  for (const banned of [/fake/i, /lie/i, /propaganda/i, /false/i, /true/i]) {
    for (const s of [0, 0.3, 0.6, 0.9]) assert.doesNotMatch(supportLabel(s), banned);
  }
});

test("bar mounts once in a closed shadow root and starts idle", () => {
  const bar = createTopBar();
  const host = document.getElementById("factit-bar-host");
  assert.ok(host);
  assert.equal(host.shadowRoot, null, "closed shadow root is not reachable from the page");
  assert.equal(host.dataset.factitState, "idle");
  assert.match(text(bar), /Fact It/);
  assert.match(text(bar), /Not analyzed/);
  assert.match(text(bar), /Analyze/);
  assert.match(text(bar), /AI preliminary/);

  createTopBar();
  assert.equal(document.querySelectorAll("#factit-bar-host").length, 1, "re-creating replaces, never duplicates");
});

test("idle Analyze button triggers the handler; nothing runs by itself", () => {
  let calls = 0;
  const bar = createTopBar({ onAnalyze: () => calls++ });
  assert.equal(calls, 0);
  bar.root.querySelector("button:not(.close)").click();
  assert.equal(calls, 1);
});

test("loading, no-article and result states", () => {
  const bar = createTopBar();
  bar.setLoading();
  assert.equal(bar.host.dataset.factitState, "loading");
  assert.match(text(bar), /Analyzing/);

  bar.setNoArticle();
  assert.equal(bar.host.dataset.factitState, "no-article");

  bar.setResult(result());
  assert.equal(bar.host.dataset.factitState, "result");
  const t = text(bar);
  assert.match(t, /Factual support: Partially supported/);
  assert.match(t, /moderate confidence/);
  assert.match(t, /3 claims/);
  assert.match(t, /1 flag\b/);
  assert.match(t, /AI preliminary · not externally verified/);
  assert.equal(bar.root.querySelector(".meter > span").style.width, "62%");

  bar.setResult(result({ claims: [], analysis: { overall_factual_support: 0, confidence: 0.2 } }));
  assert.match(text(bar), /No verifiable claims found/);
  assert.doesNotMatch(text(bar), /Insufficient support/, "no support verdict when there were no claims");
});

test("result rendering never turns model strings into markup", () => {
  const bar = createTopBar();
  bar.setResult(result({ summary: "<img src=x onerror=alert(1)>", claims: [{ text: "<b>x</b>" }] }));
  assert.equal(bar.root.querySelectorAll("img, b, script").length, 0);
});

test("error state: Retry for transient errors, Open settings for config/auth; message is text", () => {
  let analyze = 0;
  let settings = 0;
  const bar = createTopBar({ onAnalyze: () => analyze++, onOpenSettings: () => settings++ });

  bar.setError({ kind: "rate_limit", message: "Too many <script>alert(1)</script> requests" });
  assert.equal(bar.host.dataset.factitState, "error");
  assert.match(text(bar), /Analysis failed \(rate_limit\): Too many <script>alert\(1\)<\/script> requests/);
  assert.equal(bar.root.querySelectorAll("script").length, 0);
  bar.root.querySelector("button:not(.close)").click();
  assert.equal(analyze, 1);

  bar.setError({ kind: "config", message: "An API key is required." });
  const button = bar.root.querySelector("button:not(.close)");
  assert.equal(button.textContent, "Open settings");
  button.click();
  assert.equal(settings, 1);

  bar.setError(undefined);
  assert.match(text(bar), /unknown/);
});

test("dismiss removes the bar from the page", () => {
  const bar = createTopBar();
  bar.root.querySelector("button.close").click();
  assert.equal(document.getElementById("factit-bar-host"), null);
});

test("cached results are marked in the bar", () => {
  const bar = createTopBar();
  bar.setResult(result(), { cached: true });
  assert.match(text(bar), /from cache · moderate confidence/);
  bar.setResult(result());
  assert.doesNotMatch(text(bar), /from cache/);
});

test("meter color follows the support thresholds, blue to red, and only support", () => {
  assert.equal(supportColor(0.9), "#3b82f6");
  assert.equal(supportColor(0.75), "#3b82f6");
  assert.equal(supportColor(0.6), "#f59e0b");
  assert.equal(supportColor(0.3), "#f97316");
  assert.equal(supportColor(0.1), "#ef4444");
  // Same boundaries as the labels.
  for (const s of [0, 0.24, 0.25, 0.49, 0.5, 0.74, 0.75, 1]) {
    const pairs = { "#3b82f6": "Well supported", "#f59e0b": "Partially supported", "#f97316": "Weakly supported", "#ef4444": "Insufficient support" };
    assert.equal(pairs[supportColor(s)], supportLabel(s));
  }

  const bar = createTopBar();
  bar.setResult(result({ analysis: { overall_factual_support: 0.2, confidence: 0.9 }, framing: { detected: true, type: "POLITICAL", strength: "HIGH" } }));
  const fill = bar.root.querySelector(".meter > span");
  assert.equal(fill.style.background, "rgb(239, 68, 68)");
  bar.setResult(result({ analysis: { overall_factual_support: 0.9, confidence: 0.1 }, framing: { detected: true, type: "POLITICAL", strength: "HIGH" } }));
  assert.equal(bar.root.querySelector(".meter > span").style.background, "rgb(59, 130, 246)", "strong framing does not change the color");

  bar.setResult(result({ claims: [] }));
  assert.equal(bar.root.querySelector(".meter > span").style.background, "rgb(154, 165, 177)", "no claims -> neutral gray");
});
