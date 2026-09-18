// Fact It bar: states, wording thresholds, and text-only rendering of
// untrusted model strings. jsdom provides the DOM and shadow roots.

import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { loadClassicScript } from "../helpers/load-script.js";

const dom = new JSDOM("<!DOCTYPE html><html><head></head><body><p>page</p></body></html>", { url: "https://example.com/" });
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
loadClassicScript(new URL("../../extension/ui/derive.js", import.meta.url));
loadClassicScript(new URL("../../extension/ui/top-bar.js", import.meta.url));
const { createTopBar } = globalThis.FactIt;
const D = globalThis.FactIt.derive;

const claim = (over = {}) => ({ id: "c", text: "t", type: "FACTUAL", support: "ATTRIBUTED", attribution: "CLEAR", evidence_type: "NAMED_SOURCE", evidence: "e", concerns: [], gap: "", inference: "", ...over });

function result(overrides = {}) {
  const base = {
    schema_version: "2.1",
    assessment: { status: "NO_SIGNIFICANT_CONCERNS", confidence: 0.45, rationale: "r", verification_level: "AI_PRELIMINARY", external_verification: "NOT_PERFORMED" },
    source_transparency: {},
    claims: [claim(), claim({ id: "c2" }), claim({ id: "c3" })],
    concerns: [],
    framing: { detected: false },
    summary: "s",
    ...overrides,
  };
  return base;
}

// Join element texts with spaces; textContent alone would glue adjacent spans.
const text = (bar) => [...bar.root.querySelectorAll(".bar > *:not(.main), .main > *")]
  .map((n) => n.textContent).join(" ").replace(/\s+/g, " ").trim();

test("status wording is descriptive, never a verdict or a verification demand", () => {
  for (const label of Object.values(D.STATUS_LABEL)) {
    for (const banned of [/fake/i, /\blie/i, /propaganda/i, /\btrue\b/i, /\bfalse\b/i, /verif/i]) assert.doesNotMatch(label, banned);
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
  assert.match(t, /No significant concerns/);
  assert.match(t, /AI preliminary · not externally verified/);
  assert.doesNotMatch(t, /%|need review|need(s)? (external )?verification|Article support|framing/i, "banner: status only, no score, no verification demand, no framing");
  assert.equal(bar.root.querySelector(".dot").style.background, "rgb(34, 197, 94)");
  assert.match(bar.root.querySelector(".dot").title, /not a statement that the article is true/);

  bar.setResult(result({ assessment: { ...result().assessment, status: "REVIEW_RECOMMENDED" }, claims: [claim({ concerns: ["MATERIAL_MISSING_CONTEXT"] }), claim({ id: "c2", concerns: ["AMBIGUOUS_ATTRIBUTION"] })] }));
  assert.match(text(bar), /Review recommended 2 concerns/);
  assert.equal(bar.root.querySelector(".dot").style.background, "rgb(245, 158, 11)");

  bar.setResult(result({ assessment: { ...result().assessment, status: "SIGNIFICANT_CONCERNS" }, claims: [claim({ concerns: ["INTERNAL_CONTRADICTION"] })], concerns: [{ type: "HEADLINE_CONTRADICTS_BODY", severity: "SIGNIFICANT", note: "n", claim_ids: [] }] }));
  assert.match(text(bar), /Significant concerns 2 issues/);
  assert.equal(bar.root.querySelector(".dot").style.background, "rgb(239, 68, 68)");

  bar.setResult(result({ claims: [], assessment: { ...result().assessment, confidence: 0.2 } }));
  assert.match(text(bar), /No verifiable claims found/);
});

test("result rendering never turns model strings into markup", () => {
  const bar = createTopBar();
  bar.setResult(result({ summary: "<img src=x onerror=alert(1)>", claims: [claim({ text: "<b>x</b>" })] }));
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

  bar.setError({ kind: "extension_reloaded", message: "Fact It was updated. Reload this page and try again." });
  assert.equal(bar.root.querySelectorAll("button:not(.close)").length, 0, "no Retry when the extension context is gone");
  assert.match(text(bar), /Reload this page/);
});

test("dismiss removes the bar from the page", () => {
  const bar = createTopBar();
  bar.root.querySelector("button.close").click();
  assert.equal(document.getElementById("factit-bar-host"), null);
});

test("cached results are marked in the bar", () => {
  const bar = createTopBar();
  bar.setResult(result(), { cached: true });
  assert.match(text(bar), /No significant concerns from cache/);
  bar.setResult(result());
  assert.doesNotMatch(text(bar), /from cache/);
});

test("verification metadata never changes the banner", () => {
  const bar = createTopBar();
  const r = result();
  r.assessment.external_verification = "CONTRADICTED";
  for (const c of r.claims) c.external_verification_required = true;
  bar.setResult(r);
  assert.match(text(bar), /No significant concerns/);
  assert.equal(bar.root.querySelector(".dot").style.background, "rgb(34, 197, 94)");
});
