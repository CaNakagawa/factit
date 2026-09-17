// Expanded panel: sections, humanized labels, separation of framing from
// factual support, empty states, and text-only rendering of model output.

import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { loadClassicScript } from "../helpers/load-script.js";

const dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", { url: "https://example.com/" });
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
loadClassicScript(new URL("../../extension/ui/top-bar.js", import.meta.url));
loadClassicScript(new URL("../../extension/ui/panel.js", import.meta.url));
const { createTopBar, createPanel, renderPanelContent, deriveHighlights, humanize } = globalThis.FactIt;

function result(overrides = {}) {
  return {
    schema_version: "1.0",
    analysis: { overall_factual_support: 0.72, confidence: 0.6, verification_level: "AI_PRELIMINARY" },
    claims: [
      { text: "Cisco ISE has a critical auth bypass.", type: "FACTUAL", classification: "PARTIALLY_SUPPORTED", confidence: 0.7, explanation: "Attributed to CISA with a link." },
      { text: "The vendor hid the flaw for months.", type: "ALLEGATION", classification: "INSUFFICIENT_EVIDENCE", confidence: 0.3, explanation: "No evidence given." },
    ],
    flags: [{ type: "EXTERNAL_VERIFICATION_REQUIRED", explanation: "Check CVE numbers." }, { type: "MISSING_CONTEXT", explanation: "" }],
    framing: { detected: true, type: "ACTIVIST", strength: "LOW", confidence: 0.5, explanation: "Urgent call to patch." },
    summary: "Three advisories summarized; Acronis part is thin.",
    meta: { provider: "openai-compatible", model: "deepseek-flash", prompt_version: "1.0.0", schema_version: "1.0", analyzed_at: "2026-09-17T19:18:23.516Z", truncated_input: false, validation_issues: [] },
    ...overrides,
  };
}

const textOf = (node) => [...node.querySelectorAll("*")].map((n) => n.childNodes.length && [...n.childNodes].some((c) => c.nodeType === 3) ? n.textContent : "").join(" ").replace(/\s+/g, " ");

function mount(r) {
  const container = document.createElement("div");
  container.append(renderPanelContent(r));
  return container;
}

test("humanize turns enum codes into readable labels", () => {
  assert.equal(humanize("MISSING_CONTEXT"), "Missing context");
  assert.equal(humanize("PARTIALLY_SUPPORTED"), "Partially supported");
  assert.equal(humanize("OTHER"), "Other");
  assert.equal(humanize(""), "");
  assert.equal(humanize(null), "");
});

test("panel renders every section with the result's content", () => {
  const c = mount(result());
  const t = textOf(c);
  assert.match(t, /Fact It · preliminary analysis/);
  assert.match(t, /Factual support: Partially supported \(72%\)/);
  assert.match(t, /Model confidence: moderate confidence \(60%\)/);
  assert.match(t, /No external sources were consulted/);
  assert.match(t, /Conclusion/);
  assert.match(t, /Three advisories summarized/);
  assert.match(t, /Claims \(2\)/);
  assert.match(t, /Partially supported/);
  assert.match(t, /Allegation/);
  assert.match(t, /Insufficient evidence/);
  assert.match(t, /confidence 70%/);
  assert.match(t, /Attributed to CISA/);
  assert.match(t, /Flags \(2\)/);
  assert.match(t, /External verification required/);
  assert.match(t, /Missing context/);
  assert.match(t, /Activist/);
  assert.match(t, /Low strength/);
  assert.match(t, /Urgent call to patch/);
  assert.match(t, /AI preliminary · not externally verified/);
  assert.match(t, /deepseek-flash via openai-compatible/);
  assert.match(t, /prompt 1\.0\.0/);
});

test("framing has its own section stating independence from factual support", () => {
  const c = mount(result());
  const headings = [...c.querySelectorAll("h3")].map((h) => h.textContent);
  assert.ok(headings.includes("Framing"));
  assert.match(textOf(c), /does not affect factual support/);
  // Framing badges never appear inside the overview (before the Conclusion heading).
  const overviewText = textOf(c).split("Conclusion")[0];
  assert.doesNotMatch(overviewText, /Activist/);
});

test("empty states and notices", () => {
  const c = mount(result({
    claims: [],
    flags: [],
    framing: { detected: false, type: null, strength: null, confidence: 0.2, explanation: "" },
    summary: "",
    meta: { provider: "anthropic", model: "claude-opus-5", prompt_version: "1.0.0", analyzed_at: "2026-09-17T19:18:23.516Z", truncated_input: true, validation_issues: ["claim 3 dropped"] },
  }));
  const t = textOf(c);
  assert.match(t, /Claims \(0\)/);
  assert.match(t, /No verifiable claims were identified/);
  assert.match(t, /No flags raised/);
  assert.match(t, /No notable framing detected/);
  assert.match(t, /No summary provided/);
  assert.match(t, /cut for length/);
  assert.match(t, /1 item\(s\) from the model were dropped/);
});

test("details are collapsed by default; conclusion is visible; toggle reveals claims", () => {
  const bar = createTopBar();
  const panel = createPanel(bar.root);
  panel.setResult(result());
  panel.open();
  const p = bar.root.querySelector(".panel");
  const details = p.querySelector(".details");
  assert.equal(details.hidden, true);
  assert.equal(bar.host.dataset.factitDetails, "hidden");
  assert.match(p.querySelector(".lead").textContent, /Three advisories summarized/);

  const toggle = p.querySelector(".toggle");
  assert.match(toggle.textContent, /Show detailed analysis · 2 claims · 2 flags · framing noted/);
  assert.equal(toggle.getAttribute("aria-expanded"), "false");
  toggle.click();
  assert.equal(details.hidden, false);
  assert.equal(bar.host.dataset.factitDetails, "shown");
  assert.match(toggle.textContent, /^Hide detailed analysis/);
  toggle.click();
  assert.equal(details.hidden, true);

  // The visible order is: overview, conclusion, toggle, (details), compact meta.
  const order = [...p.children].map((n) => n.className || n.tagName);
  assert.ok(order.indexOf("lead") < order.indexOf("toggle"));
  assert.ok(order.indexOf("toggle") < order.indexOf("details"));
});

test("model strings are rendered as text, never markup", () => {
  const c = mount(result({
    summary: "<img src=x onerror=alert(1)>",
    claims: [{ text: "<script>x</script>", classification: "FALSE", explanation: "<a href='javascript:1'>y</a>", confidence: 0.1 }],
    flags: [{ type: "WEAK_SOURCE", explanation: "<iframe src=//evil>" }],
    framing: { detected: true, type: "OTHER", strength: "HIGH", confidence: 1, explanation: "<b>bold</b>" },
    meta: { provider: "<b>p</b>", model: "<i>m</i>" },
  }));
  assert.equal(c.querySelectorAll("img, script, a, iframe, b, i").length, 0);
  assert.match(textOf(c), /<img src=x onerror=alert\(1\)>/);
});

test("createPanel: attaches to the bar's shadow root and toggles with state attribute", () => {
  const bar = createTopBar();
  const panel = createPanel(bar.root);
  assert.equal(bar.host.dataset.factitPanel, "closed");
  assert.equal(panel.isOpen(), false);

  panel.open();
  assert.equal(panel.isOpen(), false, "cannot open before a result exists");

  panel.setResult(result());
  panel.toggle();
  assert.equal(panel.isOpen(), true);
  assert.equal(bar.host.dataset.factitPanel, "open");
  assert.match(bar.root.querySelector(".panel").textContent, /Claims \(2\)/);

  bar.root.querySelector(".panel .close").click();
  assert.equal(panel.isOpen(), false);
  assert.equal(bar.host.dataset.factitPanel, "closed");
});

test("bar result state offers Details and the bar body opens it", () => {
  let opened = 0;
  const bar = createTopBar({ onDetails: () => opened++ });
  bar.setResult(result());
  const details = [...bar.root.querySelectorAll("button")].find((b) => b.textContent === "Details");
  assert.ok(details);
  details.click();
  assert.equal(opened, 1);
  bar.root.querySelector(".label").click(); // click on the bar body
  assert.equal(opened, 2);
  bar.root.querySelector("button.close").click(); // ✕ must not open details
  assert.equal(opened, 2);
});

test("cached results show the cache note and a Re-analyze action", () => {
  const bar = createTopBar();
  const panel = createPanel(bar.root);
  let reran = 0;
  panel.setResult(result(), { cached: true, onReanalyze: () => reran++ });
  const p = bar.root.querySelector(".panel");
  assert.match(p.querySelector(".compact").textContent, /shown from local cache/);
  const again = [...p.querySelectorAll("button")].find((b) => /Re-analyze/.test(b.textContent));
  assert.ok(again);
  assert.match(again.textContent, /uses tokens/);
  again.click();
  assert.equal(reran, 1);

  panel.setResult(result(), {});
  assert.equal([...bar.root.querySelectorAll(".panel button")].some((b) => /Re-analyze/.test(b.textContent)), false);
  assert.doesNotMatch(bar.root.querySelector(".panel .compact").textContent, /cache/);
});

test("highlights: positives and negatives are derived from classifications, flags and framing", () => {
  const h = deriveHighlights(result({
    claims: [
      { text: "A", type: "FACTUAL", classification: "SUPPORTED" },
      { text: "B", type: "FACTUAL", classification: "MOSTLY_SUPPORTED" },
      { text: "C", type: "FACTUAL", classification: "UNVERIFIED" },
      { text: "D", type: "FACTUAL", classification: "PARTIALLY_SUPPORTED" },
      { text: "E", type: "FACTUAL", classification: "FALSE" },
      { text: "F", type: "ALLEGATION", classification: "INSUFFICIENT_EVIDENCE" },
      { text: "G", type: "ALLEGATION", classification: "UNVERIFIED" },
    ],
    flags: [{ type: "MISSING_CONTEXT", explanation: "ctx" }],
    framing: { detected: true, type: "POLITICAL", strength: "HIGH", confidence: 0.8, explanation: "leans" },
  }));
  assert.deepEqual(h.positives, ["Supported: A", "Mostly supported: B"]);
  assert.deepEqual(h.negatives, [
    "False: E",
    "Insufficient evidence: F",
    "Allegation, not established: G",
    "Missing context: ctx",
    "Framing noted (Political, high strength): leans",
  ]);
  assert.equal(h.neutral, 3, "C, D and G are neutral");

  const clean = deriveHighlights(result({ claims: [{ text: "A", classification: "SUPPORTED" }], flags: [], framing: { detected: false } }));
  assert.deepEqual(clean.positives, ["Supported: A", "No notable framing detected", "No flags raised"]);
  assert.deepEqual(clean.negatives, []);

  const empty = deriveHighlights(result({ claims: [], flags: [], framing: { detected: false } }));
  assert.deepEqual(empty, { positives: [], negatives: [], neutral: 0 });
});

test("highlights: button under the conclusion toggles the lists; text only", () => {
  const bar = createTopBar();
  const panel = createPanel(bar.root);
  panel.setResult(result({ summary: "<b>sum</b>", claims: [{ text: "<img src=x onerror=alert(1)>", classification: "FALSE" }] }));
  const p = bar.root.querySelector(".panel");
  const toggle = p.querySelector(".hl-toggle");
  const block = p.querySelector(".highlights");
  assert.ok(toggle && block);
  assert.equal(block.hidden, true);
  assert.match(toggle.textContent, /Show highlights · 0 ✓ 4 ✗/);
  // Sits right after the conclusion lead.
  assert.equal(p.querySelector(".lead").nextElementSibling, toggle);

  toggle.click();
  assert.equal(block.hidden, false);
  assert.match(toggle.textContent, /^Hide highlights/);
  assert.match(block.textContent, /Concerns \(4\)/);
  assert.match(block.textContent, /False: <img src=x onerror=alert\(1\)>/);
  assert.equal(block.querySelectorAll("img, b").length, 0);
  assert.equal(block.querySelectorAll("li.neg").length, 4);
  toggle.click();
  assert.equal(block.hidden, true);
});
