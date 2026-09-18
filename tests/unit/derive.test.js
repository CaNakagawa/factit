// View derivation (schema 2.1): status, buckets, counters, findings,
// highlights, side-by-side and source transparency from claim records.

import { test } from "node:test";
import assert from "node:assert/strict";
import { loadClassicScript } from "../helpers/load-script.js";

loadClassicScript(new URL("../../extension/ui/derive.js", import.meta.url));
const D = globalThis.FactIt.derive;

const claim = (over = {}) => ({
  id: "c1", text: "t", type: "FACTUAL", support: "ATTRIBUTED", attribution: "CLEAR",
  evidence_type: "NAMED_SOURCE", evidence: "e", concerns: [], gap: "", inference: "", ...over,
});
const result = (claims, concerns = [], status = null, framing = { detected: false }) => ({
  schema_version: "2.1",
  assessment: {
    status: status || (concerns.some((c) => c.severity === "SIGNIFICANT") || claims.some((c) => (c.concerns || []).some((x) => D.severityOf(x) === "SIGNIFICANT")) ? "SIGNIFICANT_CONCERNS"
      : (concerns.length || claims.some((c) => (c.concerns || []).length)) ? "REVIEW_RECOMMENDED" : "NO_SIGNIFICANT_CONCERNS"),
    confidence: 0.6, rationale: "r", verification_level: "AI_PRELIMINARY", external_verification: "NOT_PERFORMED",
  },
  source_transparency: {}, claims, concerns, framing, summary: "s",
});
const concern = (type, claim_ids = [], note = "n") => ({ type, severity: D.severityOf(type), note, claim_ids });

test("labels: 'supported' always says within article; no truth or verification-demand words", () => {
  for (const [code, label] of Object.entries(D.SUPPORT_LABEL)) {
    if (/supported/i.test(label)) assert.match(label, /within article/i, code);
  }
  const all = [...Object.values(D.SUPPORT_LABEL), ...Object.values(D.CONCERN_LABEL), ...Object.values(D.EVIDENCE_LABEL), ...Object.values(D.STATUS_LABEL)];
  for (const banned of [/fake/i, /\blie/i, /propaganda/i, /\btrue\b/i, /\bfalse\b/i, /needs? (external )?verification/i]) {
    for (const label of all) assert.doesNotMatch(label, banned);
  }
});

test("bucketOf: only concerns color a claim; attributed and unclear reporting is ok", () => {
  assert.equal(D.bucketOf(claim(), result([claim()])), "ok");
  assert.equal(D.bucketOf(claim({ support: "UNCLEAR" }), result([])), "ok");
  assert.equal(D.bucketOf(claim({ support: "ALLEGATION_REPORTED", type: "ALLEGATION" }), result([])), "ok");
  assert.equal(D.bucketOf(claim({ support: "UNSUPPORTED_WITHIN_ARTICLE" }), result([])), "caution");
  assert.equal(D.bucketOf(claim({ support: "INTERNALLY_CONTRADICTED" }), result([])), "concern");
  assert.equal(D.bucketOf(claim({ concerns: ["MATERIAL_MISSING_CONTEXT"] }), result([])), "caution");
  assert.equal(D.bucketOf(claim({ concerns: ["INTERNAL_CONTRADICTION"] }), result([])), "concern");
  const c = claim({ id: "c9" });
  assert.equal(D.bucketOf(c, result([c], [concern("SOURCE_CLAIM_MISMATCH", ["c9"])])), "concern", "article-level concern referencing the claim counts");
});

test("counts, bannerText and status", () => {
  const r = result(
    [claim({ id: "c1" }), claim({ id: "c2", concerns: ["AMBIGUOUS_ATTRIBUTION"] }), claim({ id: "c3", support: "INTERNALLY_CONTRADICTED" })],
    [concern("HEADLINE_OVERSTATEMENT", ["c1"]), concern("NUMERICAL_INCONSISTENCY", ["c3"])],
  );
  const n = D.counts(r);
  assert.deepEqual(n, { total: 3, concerns: 3, significant: 1, observations: 2, contradictions: 1, ok: 0, flagged: 3 });
  assert.deepEqual(D.bannerText(r), { label: "Significant concerns", detail: "3 issues" });
  assert.equal(D.status(r).color, "#ef4444");
  assert.deepEqual(D.bannerText(result([claim()])), { label: "No significant concerns", detail: "" });
  assert.deepEqual(D.bannerText(result([claim({ concerns: ["SELECTIVE_EVIDENCE"] })])), { label: "Review recommended", detail: "1 concern" });
});

test("allConcerns merges article- and claim-level codes without duplicates, significant first", () => {
  const c = claim({ id: "c1", concerns: ["HEADLINE_OVERSTATEMENT", "MATERIAL_MISSING_CONTEXT"], gap: "g" });
  const r = result([c], [concern("HEADLINE_OVERSTATEMENT", ["c1"], "note"), concern("INTERNAL_CONTRADICTION", [], "x")]);
  const all = D.allConcerns(r);
  assert.deepEqual(all.map((x) => [x.type, x.severity]), [["INTERNAL_CONTRADICTION", "SIGNIFICANT"], ["HEADLINE_OVERSTATEMENT", "MODERATE"], ["MATERIAL_MISSING_CONTEXT", "MODERATE"]]);
  assert.equal(all[1].note, "note", "article-level note wins over the claim gap for the same code");
  assert.equal(all[2].note, "g", "claim-level concern carries the claim's gap");
});

test("keyFindings lists concerns only, with the claim text when it refers to one", () => {
  const r = result([claim({ id: "c1", text: "A" }), claim({ id: "c2", text: "B", concerns: ["MISLEADING_STATISTIC"], gap: "compares different years" })], [concern("HEADLINE_CONTRADICTS_BODY", ["c1"], "hl")]);
  const f = D.keyFindings(r, 4);
  assert.deepEqual(f.map((x) => [x.kind, x.label, x.text, x.note]), [
    ["concern", "Headline contradicts body", "A", "hl"],
    ["caution", "Questionable statistic", "B", "compares different years"],
  ]);
  assert.deepEqual(D.keyFindings(result([claim()])), []);
});

test("highlights: concerns vs ordinary reporting", () => {
  const r = result([claim({ id: "c1", text: "ok" }), claim({ id: "c2", text: "bad", concerns: ["OPINION_PRESENTED_AS_FACT"] })]);
  const h = D.highlights(r);
  assert.deepEqual(h.concerns.map((x) => [x.text, x.category]), [["bad", "Opinion presented as fact"]]);
  assert.deepEqual(h.ordinary.map((x) => [x.text, x.label]), [["ok", "Attributed reporting"]]);
});

test("sideBySide: only claims with a concern, gap or inference", () => {
  const { rows, total } = D.sideBySide(result([
    claim({ id: "c1", text: "clean" }),
    claim({ id: "c2", text: "with inference", inference: "reader may think X" }),
    claim({ id: "c3", text: "contradicted", support: "INTERNALLY_CONTRADICTED", concerns: ["INTERNAL_CONTRADICTION"] }),
  ]));
  assert.equal(total, 3);
  assert.deepEqual(rows.map((r) => r.id), ["c3", "c2"]);
  assert.deepEqual(Object.keys(rows[0]), ["id", "says", "allegation", "support", "evidenceType", "evidence", "gap", "inference", "concerns", "bucket"]);
});

test("sourceTransparency is observational and falls back to claim records", () => {
  const r = result([claim({ evidence_type: "DIRECT_QUOTE" }), claim({ attribution: "NONE", evidence_type: "ARTICLE_ASSERTION" })]);
  const tr = D.sourceTransparency(r, { author: null, published_at: "2026-09-18T00:00:00Z" });
  assert.deepEqual(tr.items.map((i) => i.present), [false, true, true, false, true]);
  assert.equal(tr.attributedClaims, 1);
});

test("evidenceProfile counts evidence types presented by the article", () => {
  const p = D.evidenceProfile(result([claim(), claim(), claim({ evidence_type: "NO_EVIDENCE_SHOWN" })]));
  assert.deepEqual(p, [{ type: "NAMED_SOURCE", label: "Named source", count: 2 }, { type: "NO_EVIDENCE_SHOWN", label: "No evidence shown", count: 1 }]);
});
