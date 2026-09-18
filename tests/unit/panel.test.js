// Panel (schema 2.1): summary first, detailed tabs on demand, concern-based
// status, text-only rendering of untrusted strings. jsdom provides the DOM.

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
  id: "c1", text: "Microsoft released fixes for CVE-2026-85889.", type: "FACTUAL", support: "ATTRIBUTED", attribution: "CLEAR",
  evidence_type: "PRIMARY_DOCUMENT", evidence: "Microsoft advisory, linked", concerns: [], gap: "", inference: "", ...over,
});

function result(overrides = {}) {
  return {
    schema_version: "2.1",
    assessment: { status: "NO_SIGNIFICANT_CONCERNS", confidence: 0.8, rationale: "Every claim is attributed to Microsoft or the CVE record and the statements agree with each other.", verification_level: "AI_PRELIMINARY", external_verification: "NOT_PERFORMED" },
    source_transparency: { named_sources: true, primary_references: true, direct_quotes: true },
    claims: [
      claim(),
      claim({ id: "c2", text: "The vulnerability has a CVSS score of 10.0.", evidence_type: "OFFICIAL_RECORD", evidence: "CVE record" }),
      claim({ id: "c3", text: "Microsoft says no customer action is required.", evidence_type: "DIRECT_QUOTE", evidence: "quoted statement" }),
    ],
    concerns: [],
    framing: { detected: false, type: null, strength: null, confidence: 0.2, observations: [] },
    summary: "An ordinary vulnerability report; statements are attributed and consistent.",
    meta: { provider: "openai-compatible", model: "deepseek-chat", prompt_version: "2.1.0", schema_version: "2.1", analyzed_at: "2026-09-18T00:00:00.000Z", usage: { input_tokens: 5650, output_tokens: 900 }, validation_issues: [], migrated_from: null },
    ...overrides,
  };
}

function concerning() {
  return result({
    assessment: { status: "SIGNIFICANT_CONCERNS", confidence: 0.7, rationale: "The headline claims proof the body withdraws, and the minister allegation has nothing behind it.", verification_level: "AI_PRELIMINARY", external_verification: "NOT_PERFORMED" },
    claims: [
      claim({ id: "c1", text: "The study found a correlation between X and Y.", evidence_type: "PRIMARY_DOCUMENT", evidence: "study, linked" }),
      claim({ id: "c2", text: "The minister diverted funds to a foundation.", type: "ALLEGATION", support: "UNSUPPORTED_WITHIN_ARTICLE", attribution: "NONE", evidence_type: "NO_EVIDENCE_SHOWN", evidence: "", concerns: ["UNSUPPORTED_SERIOUS_ALLEGATION"], gap: "No document or statement is presented.", inference: "That the minister acted in bad faith." }),
      claim({ id: "c3", text: "Sales rose 3% in the quarter.", concerns: ["MISLEADING_STATISTIC"], gap: "Compared against a holiday quarter." }),
    ],
    concerns: [{ type: "HEADLINE_CONTRADICTS_BODY", severity: "SIGNIFICANT", note: "Headline: 'Study proves X causes Y'.", claim_ids: ["c1"] }],
    framing: { detected: true, type: "POLITICAL", strength: "MODERATE", confidence: 0.6, observations: ["Only one party's reaction is quoted", "Loaded terms in the lead"] },
  });
}

// Join text nodes with spaces; textContent alone glues adjacent blocks.
const text = (node) => {
  const parts = [];
  const walk = (n) => { for (const c of n.childNodes) { if (c.nodeType === 3) parts.push(c.nodeValue); else walk(c); } };
  walk(node);
  return parts.join(" ").replace(/\s+/g, " ").trim();
};

function mount(r, opts = {}) {
  const bar = createTopBar();
  const panel = createPanel(bar.root);
  panel.setResult(r, opts);
  panel.open();
  return { bar, panel, root: bar.root, el: bar.root.querySelector(".panel") };
}

test("Summary for an ordinary article: green status, zero concerns, no verification warnings, no percentage", () => {
  const { bar, el } = mount(result(), { article: { author: "Jane Roe", published_at: "2026-09-18T00:00:00Z" } });
  assert.equal(bar.host.dataset.factitView, "summary");
  const t = text(el);
  assert.match(t, /Status No significant concerns detected/);
  assert.match(t, /not a statement that the article is true/);
  assert.match(t, /AI PRELIMINARY · NO EXTERNAL VERIFICATION PERFORMED/);
  assert.match(t, /metadata about Fact It, not a concern about the article/);
  const counters = [...el.querySelectorAll(".counter")].map((c) => `${c.querySelector(".n").textContent} ${c.querySelector(".l").textContent}`);
  assert.deepEqual(counters, ["3 claims analyzed", "0 significant concerns", "0 observations", "0 contradictions"]);
  assert.match(t, /Key findings No significant concerns detected\. Claims are internally consistent/);
  assert.match(t, /Source transparency ✓ Named author ✓ Publication date ✓ Named sources/);
  assert.match(t, /No notable framing observed/);
  assert.match(t, /Inspect claims \(3\)/);
  assert.deepEqual(t.match(/\d+%/g), ["80%"], "the only percentage is the analysis confidence; no support/truth score");
  assert.doesNotMatch(t, /need(s)? (external )?verification|need review|Article support/i);
  assert.doesNotMatch(t, /5,650/, "token accounting belongs to About");
  assert.equal(el.querySelector(".status .dot").style.background, "rgb(34, 197, 94)");
});

test("Summary for a concerning article: red status, counters, key findings with claim text and note", () => {
  const { el } = mount(concerning());
  const t = text(el);
  assert.match(t, /Status Significant concerns/);
  const counters = [...el.querySelectorAll(".counter")].map((c) => `${c.querySelector(".n").textContent} ${c.querySelector(".l").textContent}`);
  assert.deepEqual(counters, ["3 claims analyzed", "2 significant concerns", "1 observations", "1 contradictions"]);
  const findings = [...el.querySelectorAll(".finding")].map((f) => f.querySelector(".lbl").textContent);
  assert.deepEqual(findings, ["Headline contradicts body", "Serious allegation presented as fact", "Questionable statistic"]);
  assert.match(t, /Possible political framing · Moderate · confidence 60%/);
  assert.match(t, /Framing is reported separately and does not affect the status/);
  assert.equal(el.querySelector(".status .dot").style.background, "rgb(239, 68, 68)");
});

test("Inspect claims opens the Claims tab; ordinary claims are green and expand to metadata, not warnings", () => {
  const { bar, el } = mount(result());
  [...el.querySelectorAll("button")].find((b) => /Inspect claims/.test(b.textContent)).click();
  assert.equal(bar.host.dataset.factitView, "detail:claims");
  const panel = bar.root.querySelector(".panel");
  assert.deepEqual([...panel.querySelectorAll("button.tab")].map((b) => b.textContent), ["Overview", "Claims", "Evidence", "Framing", "About"]);
  const items = [...panel.querySelectorAll(".claim")];
  assert.equal(items.length, 3);
  for (const it of items) {
    assert.equal(it.querySelector(".mark").style.background, "rgb(34, 197, 94)");
    assert.equal(it.querySelector(".reason").textContent, "Attributed reporting");
  }
  items[0].querySelector("button").click();
  const dl = items[0].querySelector("dl");
  assert.equal(dl.hidden, false);
  const fields = [...dl.querySelectorAll("dt")].map((d) => d.textContent);
  assert.deepEqual(fields, ["Within the article", "Type", "Attribution", "Article evidence", "Evidence type", "Concerns", "External verification"]);
  const values = [...dl.querySelectorAll("dd")].map((d) => d.textContent);
  assert.equal(values[0], "Attributed reporting");
  assert.equal(values[2], "Clear");
  assert.equal(values[5], "None");
  assert.equal(values[6], "Not performed (metadata; not a concern)");
});

test("Claims tab for a concerning article: concerns first, expanded fields include gap and inference, article-level list", () => {
  const { panel, root } = mount(concerning());
  panel.showDetail("claims");
  const p = root.querySelector(".panel");
  const reasons = [...p.querySelectorAll(".claim .reason")].map((r) => r.textContent);
  assert.deepEqual(reasons, ["Headline contradicts body", "Serious allegation presented as fact", "Questionable statistic"]);
  p.querySelectorAll(".claim button")[1].click();
  const dts = [...p.querySelectorAll(".claim")[1].querySelectorAll("dt")].map((d) => d.textContent);
  assert.deepEqual(dts, ["Within the article", "Type", "Attribution", "Article evidence", "Evidence type", "Concerns", "What is missing", "Possible reader inference", "External verification"]);
  assert.match(text(p), /Article-level concerns \(1\) Headline contradicts body: Headline: 'Study proves X causes Y'\. \(c1\)/);
});

test("Overview tab: status, rationale, summary, concerns vs ordinary reporting", () => {
  const { panel, root } = mount(concerning());
  panel.showDetail("overview");
  const t = text(root.querySelector(".panel"));
  assert.match(t, /Significant concerns/);
  assert.match(t, /The headline claims proof the body withdraws/);
  assert.match(t, /Concerns \(3\)/);
  assert.match(t, /Ordinary reporting, no concern \(0\)/);
  assert.match(t, /not a statement that the claim is true/);
  assert.doesNotMatch(t, /Strengths|Needs review|Supported in article \(/);
  const ok = mount(result());
  ok.panel.showDetail("overview");
  assert.match(text(ok.root.querySelector(".panel")), /Concerns \(0\) No concerns were found in the content\. Ordinary reporting, no concern \(3\)/);
});

test("Evidence tab: side by side lists only claims with concerns, with possible reader inference wording", () => {
  const { panel, root } = mount(concerning());
  panel.showDetail("evidence");
  const p = root.querySelector(".panel");
  const t = text(p);
  assert.match(t, /Side by side: claims with concerns \(3\)/);
  const dts = [...p.querySelectorAll(".sbs .row:first-of-type dt")].map((d) => d.textContent);
  assert.deepEqual(dts, ["Article says", "Evidence presented", "What may be missing", "Possible reader inference"]);
  assert.match(t, /That the minister acted in bad faith/);
  assert.doesNotMatch(t, /Leads the reader to/);
  const ok = mount(result());
  ok.panel.showDetail("evidence");
  assert.match(text(ok.root.querySelector(".panel")), /Side by side: claims with concerns \(0\) No claim carries a concern/);
});

test("Framing tab: observations only, topic is not framing, independence stated", () => {
  const { panel, root } = mount(concerning());
  panel.showDetail("framing");
  const t = text(root.querySelector(".panel"));
  assert.match(t, /Possible political framing/);
  assert.match(t, /Moderate · Confidence: 60%/);
  assert.match(t, /Only one party's reaction is quoted/);
  assert.match(t, /says nothing about the author's or the publication's ideology/);
  assert.match(t, /A subject being political, commercial or controversial is not framing/);
});

test("About tab: status, verification metadata, provider, model, prompt, tokens, cost, cache", () => {
  const { panel, root } = mount(result(), { cached: true, cost: { usd: 0.0203, input_usd: 0.0113, output_usd: 0.009 } });
  panel.showDetail("about");
  const p = root.querySelector(".panel");
  const kv = Object.fromEntries([...p.querySelectorAll(".kv dt")].map((dt, i) => [dt.textContent, p.querySelectorAll(".kv dd")[i].textContent]));
  assert.equal(kv.Status, "No significant concerns");
  assert.equal(kv["Verification level"], "AI preliminary");
  assert.match(kv["External verification"], /Not performed \(metadata; never counted as a concern\)/);
  assert.equal(kv.Model, "deepseek-chat");
  assert.equal(kv["Prompt version"], "2.1.0");
  assert.equal(kv["Schema version"], "2.1");
  assert.equal(kv.Tokens, "5,650 input · 900 output");
  assert.equal(kv["Estimated cost"], "$0.020 ($0.011 in + $0.0090 out)");
  assert.equal(kv.Source, "local cache");
});

test("Re-analyze offered only with a handler; navigation never re-analyzes", () => {
  let reran = 0;
  const { panel, root } = mount(result(), { onReanalyze: () => reran++ });
  assert.ok([...root.querySelectorAll(".panel button")].some((b) => /Re-analyze \(uses tokens\)/.test(b.textContent)));
  panel.showDetail("about"); panel.showSummary(); panel.showDetail("claims"); panel.showDetail("about");
  assert.equal(reran, 0);
  [...root.querySelectorAll(".panel button")].find((b) => /Re-analyze/.test(b.textContent)).click();
  assert.equal(reran, 1);
});

test("migrated results carry a note in About", () => {
  const { panel, root } = mount(result({ meta: { ...result().meta, migrated_from: "2.0" } }));
  panel.showDetail("about");
  assert.match(text(root.querySelector(".panel")), /Analyzed with schema 2\.0 under the older, verification-centric prompt/);
});

test("model strings are rendered as text in every view", () => {
  const payload = "<img src=x onerror=alert(1)><script>alert(2)</script><a href=javascript:alert(3)>x</a><b>b</b>";
  const hostile = concerning();
  hostile.assessment.rationale = payload;
  hostile.summary = payload;
  hostile.claims = [claim({ text: payload, evidence: payload, gap: payload, inference: payload, support: "UNSUPPORTED_WITHIN_ARTICLE", concerns: ["AMBIGUOUS_ATTRIBUTION"] })];
  hostile.concerns = [{ type: "MATERIAL_MISSING_CONTEXT", severity: "MODERATE", note: payload, claim_ids: ["c1"] }];
  hostile.framing = { detected: true, type: "OTHER", strength: "HIGH", confidence: 1, observations: [payload] };
  hostile.meta = { provider: payload, model: payload, prompt_version: payload, analyzed_at: payload, usage: { input_tokens: 1, output_tokens: 1 } };
  const { panel, root } = mount(hostile, { article: { author: payload, published_at: payload } });
  for (const view of ["summary", "overview", "claims", "evidence", "framing", "about"]) {
    if (view === "summary") panel.showSummary(); else panel.showDetail(view);
    if (view === "claims") root.querySelector(".claim button").click();
    assert.equal(root.querySelectorAll("img, script, a, iframe, object, embed, svg, b").length, 0, view);
    assert.ok(root.querySelector(".panel").textContent.includes("<script>alert(2)</script>"), `${view}: shown literally`);
  }
});

test("panel API: open/close/toggle and open('claims')", () => {
  const bar = createTopBar();
  const panel = createPanel(bar.root);
  panel.open();
  assert.equal(panel.isOpen(), false);
  panel.setResult(result());
  panel.toggle();
  assert.equal(bar.host.dataset.factitPanel, "open");
  bar.root.querySelector(".panel .close").click();
  assert.equal(panel.isOpen(), false);
  panel.open("claims");
  assert.equal(bar.host.dataset.factitView, "detail:claims");
  bar.root.querySelector(".panel .back").click();
  assert.equal(bar.host.dataset.factitView, "summary");
});
