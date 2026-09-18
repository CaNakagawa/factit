// Panel (schema 2.0): summary view first, detailed tabs on demand, text-only
// rendering of untrusted strings, and derived views that agree with each
// other. jsdom provides the DOM and shadow roots.

import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { loadClassicScript } from "../helpers/load-script.js";

const dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", { url: "https://example.com/" });
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
for (const f of ["ui/derive.js", "ui/top-bar.js", "ui/panel.js"]) loadClassicScript(new URL(`../../extension/${f}`, import.meta.url));
const { createTopBar, createPanel } = globalThis.FactIt;

const claim = (over = {}) => ({
  id: "c1", text: "Cisco ISE has a critical auth bypass.", type: "FACTUAL", support: "ARTICLE_SUPPORTED", confidence: 0.8,
  evidence_type: "OFFICIAL_RECORD", evidence: "CISA advisory quoted with CVE number.", gap: "", inference: "", issues: [], external_verification_required: false, ...over,
});

function result(overrides = {}) {
  return {
    schema_version: "2.0",
    assessment: { article_support: 0.72, confidence: 0.6, rationale: "Advisories are quoted with CVE numbers; the Acronis passage cites only a secondary article.", verification_level: "AI_PRELIMINARY", external_verification: "NOT_PERFORMED" },
    claims: [
      claim(),
      claim({ id: "c2", text: "Acronis Backup has an unspecified flaw.", support: "ATTRIBUTED", evidence_type: "SECONDARY_SOURCE", evidence: "Cites an earlier heise article.", gap: "The original Acronis advisory and a CVE.", external_verification_required: true }),
      claim({ id: "c3", text: "The vendor hid the flaw for months.", type: "ALLEGATION", support: "EVIDENCE_GAP", evidence_type: "NO_EVIDENCE_SHOWN", evidence: "", gap: "Any timeline or statement.", inference: "That the vendor acted negligently.", issues: ["UNSUPPORTED_ACCUSATION"], external_verification_required: true }),
    ],
    issues: [{ type: "HEADLINE_CONTENT_MISMATCH", note: "Headline gives three products equal weight; Acronis gets one line.", claim_ids: ["c2"] }],
    framing: { detected: true, type: "OTHER", strength: "LOW", confidence: 0.5, observations: ["Urgency wording in the lead", "Vendor statements placed last"] },
    summary: "Two advisories are backed by quoted records; the Acronis item rests on a secondary source.",
    meta: { provider: "openai-compatible", model: "deepseek-chat", prompt_version: "2.0.0", schema_version: "2.0", analyzed_at: "2026-09-18T00:00:00.000Z", usage: { input_tokens: 5650, output_tokens: 1800 }, validation_issues: [], migrated_from: null },
    ...overrides,
  };
}

const text = (node) => node.textContent.replace(/\s+/g, " ").trim();

function mount(r, opts = {}) {
  const bar = createTopBar();
  const panel = createPanel(bar.root);
  panel.setResult(r, opts);
  panel.open();
  return { bar, panel, root: bar.root, el: bar.root.querySelector(".panel") };
}

test("Details opens the Summary (level 2), not the full report", () => {
  const { bar, el } = mount(result());
  assert.equal(bar.host.dataset.factitView, "summary");
  const t = text(el);
  assert.match(t, /72%/);
  assert.match(t, /Partially supported within article/);
  assert.match(t, /Analysis confidence: 60%/);
  assert.match(t, /AI PRELIMINARY · NO EXTERNAL VERIFICATION PERFORMED/);
  assert.match(t, /External sources were not independently verified/);
  assert.match(t, /Key findings/);
  assert.match(t, /View all claims \(3\)/);
  assert.match(t, /Detailed analysis/);
  assert.doesNotMatch(t, /Evidence type/, "no per-claim inspection fields in the summary");
  assert.doesNotMatch(t, /5,650/, "token accounting belongs to About, not the summary");
});

test("summary counters and key findings come from the claim buckets", () => {
  const { el } = mount(result());
  const counters = [...el.querySelectorAll(".counter")].map((c) => `${c.querySelector(".n").textContent} ${c.querySelector(".l").textContent}`);
  assert.deepEqual(counters, ["1 supported within article", "1 need external verification", "2 evidence / context issues"]);
  const findings = [...el.querySelectorAll(".finding")].map((f) => f.querySelector(".lbl").textContent);
  assert.deepEqual(findings, ["Allegation", "Needs external verification", "Supported within article", "Headline does not match content"]);
});

test("framing in the summary is possible, observable and declared independent of the score", () => {
  const { el } = mount(result());
  const t = text(el);
  assert.match(t, /Possible other framing · Low · confidence 50%/);
  assert.match(t, /Urgency wording in the lead/);
  assert.match(t, /Framing does not affect the article-support score/);
});

test("View all claims opens the Claims tab; claims expand with inspection fields", () => {
  const { bar, el } = mount(result());
  [...el.querySelectorAll("button")].find((b) => /View all claims/.test(b.textContent)).click();
  assert.equal(bar.host.dataset.factitView, "detail:claims");
  const panel = bar.root.querySelector(".panel");
  const tabs = [...panel.querySelectorAll("button.tab")].map((b) => b.textContent);
  assert.deepEqual(tabs, ["Overview", "Claims", "Evidence", "Framing", "About"]);
  const items = [...panel.querySelectorAll(".claim")];
  assert.equal(items.length, 3);
  assert.match(items[0].textContent, /Allegation/, "issues first");
  const dl = items[0].querySelector("dl");
  assert.equal(dl.hidden, true);
  items[0].querySelector("button").click();
  assert.equal(dl.hidden, false);
  const fields = [...dl.querySelectorAll("dt")].map((d) => d.textContent);
  assert.deepEqual(fields, ["Support", "Type", "Confidence", "Article evidence", "Evidence type", "What may be missing", "Possible reader inference", "Issues", "External verification"]);
  const values = [...dl.querySelectorAll("dd")].map((d) => d.textContent);
  assert.equal(values[0], "Evidence not shown");
  assert.equal(values[4], "No evidence shown");
  assert.equal(values[8], "Recommended · not performed");
  assert.match(panel.textContent, /Article-level issues \(1\)/);
  assert.match(panel.textContent, /Headline does not match content: Headline gives three products equal weight.*\(c2\)/);
});

test("Overview tab: rationale, summary and Supported-in-article / Needs-review highlights", () => {
  const { panel, root } = mount(result());
  panel.showDetail("overview");
  const t = text(root.querySelector(".panel"));
  assert.match(t, /Article support: 72% · Partially supported within article/);
  assert.match(t, /Advisories are quoted with CVE numbers/);
  assert.match(t, /Supported in article \(1\)/);
  assert.match(t, /Needs review \(3\)/);
  assert.match(t, /ALLEGATION|Allegation/);
  assert.match(t, /not a statement that the claim is true/);
  assert.doesNotMatch(t, /Strengths|Concerns/);
});

test("Evidence tab: evidence profile and side by side with possible reader inference wording", () => {
  const { panel, root } = mount(result());
  panel.showDetail("evidence");
  const p = root.querySelector(".panel");
  const t = text(p);
  assert.match(t, /Official record: 1/);
  assert.match(t, /Secondary source: 1/);
  assert.match(t, /No evidence shown: 1/);
  assert.match(t, /Side by side \(2\)/);
  const dts = [...p.querySelectorAll(".sbs .row:first-of-type dt")].map((d) => d.textContent);
  assert.deepEqual(dts, ["Article says", "Evidence presented", "What may be missing", "Possible reader inference"]);
  assert.match(t, /That the vendor acted negligently/);
  assert.doesNotMatch(t, /Leads the reader to/);
  assert.match(t, /not a claim about the author's intent/);
});

test("Framing tab: observations only, no ideology, independence stated", () => {
  const { panel, root } = mount(result());
  panel.showDetail("framing");
  const t = text(root.querySelector(".panel"));
  assert.match(t, /Possible other framing/);
  assert.match(t, /Low · Confidence: 50%/);
  assert.match(t, /Observed characteristics/);
  assert.match(t, /Vendor statements placed last/);
  assert.match(t, /says nothing about the author's or the publication's ideology/);
  assert.match(t, /Framing does not affect the article-support score/);
});

test("About tab: verification level, provider, model, prompt, tokens, cost, cache source", () => {
  const { panel, root } = mount(result(), { cached: true, cost: { usd: 0.0293, input_usd: 0.0113, output_usd: 0.018 } });
  panel.showDetail("about");
  const p = root.querySelector(".panel");
  const kv = Object.fromEntries([...p.querySelectorAll(".kv dt")].map((dt, i) => [dt.textContent, p.querySelectorAll(".kv dd")[i].textContent]));
  assert.equal(kv["Verification level"], "AI preliminary");
  assert.equal(kv["External verification"], "Not performed");
  assert.equal(kv.Provider, "openai-compatible");
  assert.equal(kv.Model, "deepseek-chat");
  assert.equal(kv["Prompt version"], "2.0.0");
  assert.equal(kv["Schema version"], "2.0");
  assert.equal(kv.Tokens, "5,650 input · 1,800 output");
  assert.equal(kv["Estimated cost"], "$0.029 ($0.011 in + $0.018 out)");
  assert.equal(kv.Source, "local cache");
  assert.ok([...p.querySelectorAll("button")].some((b) => /Re-analyze \(uses tokens\)/.test(b.textContent)) === false, "no Re-analyze without a handler");
});

test("Re-analyze is offered in summary and About when a handler exists, never runs by itself", () => {
  let reran = 0;
  const { panel, root } = mount(result(), { onReanalyze: () => reran++ });
  const again = [...root.querySelectorAll(".panel button")].find((b) => /Re-analyze \(uses tokens\)/.test(b.textContent));
  assert.ok(again);
  panel.showDetail("about");
  panel.showSummary();
  panel.showDetail("claims");
  assert.equal(reran, 0, "navigation never re-analyzes");
  panel.showDetail("about");
  [...root.querySelectorAll(".panel button")].find((b) => /Re-analyze/.test(b.textContent)).click();
  assert.equal(reran, 1);
});

test("legacy (migrated) results render with a note and without invented data", () => {
  const legacyMigrated = result({
    claims: [claim({ evidence_type: "UNKNOWN", support: "ARTICLE_SUPPORTED", evidence: "quoted filing" })],
    issues: [],
    meta: { ...result().meta, migrated_from: "1.2" },
  });
  const { panel, root } = mount(legacyMigrated);
  panel.showDetail("about");
  assert.match(text(root.querySelector(".panel")), /Analyzed with schema 1\.2; shown in the current layout/);
  panel.showDetail("claims");
  root.querySelector(".claim button").click();
  assert.match(root.querySelector(".claim dl").textContent, /Evidence typeNot stated/);
});

test("model strings are rendered as text in every view", () => {
  const payload = "<img src=x onerror=alert(1)><script>alert(2)</script><a href=javascript:alert(3)>x</a><b>b</b>";
  const hostile = result({
    assessment: { article_support: 0.5, confidence: 0.5, rationale: payload, verification_level: "AI_PRELIMINARY", external_verification: "NOT_PERFORMED" },
    claims: [claim({ text: payload, evidence: payload, gap: payload, inference: payload, support: "EVIDENCE_GAP", issues: ["WEAK_SOURCE"] })],
    issues: [{ type: "MISSING_CONTEXT", note: payload, claim_ids: ["c1"] }],
    framing: { detected: true, type: "OTHER", strength: "HIGH", confidence: 1, observations: [payload] },
    summary: payload,
    meta: { provider: payload, model: payload, prompt_version: payload, analyzed_at: payload, usage: { input_tokens: 1, output_tokens: 1 } },
  });
  const { panel, root } = mount(hostile);
  for (const view of ["summary", "overview", "claims", "evidence", "framing", "about"]) {
    if (view === "summary") panel.showSummary(); else panel.showDetail(view);
    if (view === "claims") root.querySelector(".claim button").click();
    assert.equal(root.querySelectorAll("img, script, a, iframe, object, embed, svg, b").length, 0, view);
    assert.ok(root.querySelector(".panel").textContent.includes("<script>alert(2)</script>"), `${view}: shown literally`);
  }
});

test("panel API: open/close/toggle state attributes; open('claims') jumps to the tab", () => {
  const bar = createTopBar();
  const panel = createPanel(bar.root);
  assert.equal(bar.host.dataset.factitPanel, "closed");
  panel.open();
  assert.equal(panel.isOpen(), false, "cannot open before a result exists");
  panel.setResult(result());
  panel.toggle();
  assert.equal(panel.isOpen(), true);
  assert.equal(bar.host.dataset.factitPanel, "open");
  bar.root.querySelector(".panel .close").click();
  assert.equal(panel.isOpen(), false);
  panel.open("claims");
  assert.equal(bar.host.dataset.factitView, "detail:claims");
  bar.root.querySelector(".panel .back").click();
  assert.equal(bar.host.dataset.factitView, "summary");
});
