// View derivation: buckets, labels, counters, key findings, highlights and
// side-by-side rows all come from the same claim records.

import { test } from "node:test";
import assert from "node:assert/strict";
import { loadClassicScript } from "../helpers/load-script.js";

loadClassicScript(new URL("../../extension/ui/derive.js", import.meta.url));
const D = globalThis.FactIt.derive;

const claim = (over = {}) => ({
  id: "c1", text: "t", type: "FACTUAL", support: "ARTICLE_SUPPORTED", confidence: 0.7,
  evidence_type: "NAMED_SOURCE", evidence: "e", gap: "", inference: "", issues: [], external_verification_required: false, ...over,
});

const result = (claims, issues = [], framing = { detected: false }) => ({
  schema_version: "2.0",
  assessment: { article_support: 0.62, confidence: 0.55, rationale: "r", verification_level: "AI_PRELIMINARY", external_verification: "NOT_PERFORMED" },
  claims, issues, framing, summary: "s",
});

test("labels never say 'supported' without 'within article'", () => {
  for (const [code, label] of Object.entries(D.SUPPORT_LABEL)) {
    if (/supported/i.test(label)) assert.match(label, /within article/i, code);
  }
  for (const s of [0.9, 0.6, 0.3, 0.1]) assert.match(D.supportWord(s), /within article/);
  for (const banned of [/fake/i, /\blie/i, /propaganda/i, /\btrue\b/i, /\bfalse\b/i]) {
    for (const label of [...Object.values(D.SUPPORT_LABEL), ...Object.values(D.ISSUE_LABEL), ...Object.values(D.EVIDENCE_LABEL)]) assert.doesNotMatch(label, banned);
  }
});

test("bucketOf: issues beat verification beats supported; framing plays no part", () => {
  assert.equal(D.bucketOf(claim()), "supported");
  assert.equal(D.bucketOf(claim({ support: "PARTIALLY_ARTICLE_SUPPORTED" })), "supported");
  assert.equal(D.bucketOf(claim({ support: "ATTRIBUTED" })), "verify");
  assert.equal(D.bucketOf(claim({ support: "UNVERIFIED" })), "verify");
  assert.equal(D.bucketOf(claim({ external_verification_required: true })), "verify", "supported but flagged for external check");
  assert.equal(D.bucketOf(claim({ issues: ["EXTERNAL_VERIFICATION_REQUIRED"] })), "verify");
  assert.equal(D.bucketOf(claim({ support: "EVIDENCE_GAP" })), "issue");
  assert.equal(D.bucketOf(claim({ support: "CONTRADICTED_IN_ARTICLE" })), "issue");
  assert.equal(D.bucketOf(claim({ issues: ["MISSING_CONTEXT"] })), "issue", "a structural issue makes it an issue even if supported");
  assert.equal(D.bucketOf(claim({ support: "ATTRIBUTED", issues: ["WEAK_SOURCE"] })), "issue");
});

test("counts and needsReview", () => {
  const r = result([
    claim(), claim({ support: "PARTIALLY_ARTICLE_SUPPORTED" }),
    claim({ support: "ATTRIBUTED" }), claim({ support: "UNVERIFIED", external_verification_required: true }),
    claim({ support: "EVIDENCE_GAP" }), claim({ issues: ["MISSING_CONTEXT"] }),
  ], [{ type: "HEADLINE_CONTENT_MISMATCH", note: "n", claim_ids: [] }]);
  assert.deepEqual(D.counts(r), { total: 6, supported: 2, verify: 2, issue: 2, articleIssues: 1, needsReview: 4 });
});

test("supportColor follows supportWord thresholds", () => {
  const pairs = { "#3b82f6": /Well/, "#f59e0b": /Partially/, "#f97316": /Weakly/, "#ef4444": /Little/ };
  for (const s of [0, 0.24, 0.25, 0.49, 0.5, 0.74, 0.75, 1]) assert.match(D.supportWord(s), pairs[D.supportColor(s)]);
});

test("reasonOf picks the most specific description", () => {
  assert.equal(D.reasonOf(claim()), "Supported within article");
  assert.equal(D.reasonOf(claim({ support: "ATTRIBUTED", external_verification_required: true })), "Needs external verification");
  assert.equal(D.reasonOf(claim({ support: "ATTRIBUTED" })), "Attributed to a source");
  assert.equal(D.reasonOf(claim({ issues: ["WEAK_SOURCE", "MISSING_CONTEXT"] })), "Weak source");
  assert.equal(D.reasonOf(claim({ type: "ALLEGATION", support: "EVIDENCE_GAP" })), "Allegation");
  assert.equal(D.reasonOf(claim({ type: "ALLEGATION" })), "Supported within article", "a supported allegation is shown as supported");
});

test("keyFindings: issues first, then verification, always at most limit, keeps one supported when possible", () => {
  const r = result([
    claim({ id: "c1", text: "S1" }), claim({ id: "c2", text: "S2" }),
    claim({ id: "c3", text: "V1", support: "ATTRIBUTED" }),
    claim({ id: "c4", text: "I1", support: "EVIDENCE_GAP" }), claim({ id: "c5", text: "I2", issues: ["MISSING_CONTEXT"] }), claim({ id: "c6", text: "I3", support: "CONTRADICTED_IN_ARTICLE" }),
  ]);
  const f = D.keyFindings(r, 4);
  assert.deepEqual(f.map((x) => x.text), ["I1", "I2", "I3", "S1"]);
  assert.deepEqual(f.map((x) => x.kind), ["issue", "issue", "issue", "supported"]);
  assert.equal(D.keyFindings(result([]), 4).length, 0);
  const withArticleIssue = D.keyFindings(result([claim()], [{ type: "HEADLINE_CONTENT_MISMATCH", note: "headline overstates", claim_ids: [] }]), 4);
  assert.deepEqual(withArticleIssue.map((x) => [x.kind, x.label]), [["supported", "Supported within article"], ["issue", "Headline does not match content"]]);
});

test("highlights: supported-in-article vs needs-review with categories", () => {
  const h = D.highlights(result([
    claim({ text: "ok" }),
    claim({ text: "alleg", type: "ALLEGATION", support: "EVIDENCE_GAP" }),
    claim({ text: "weak", support: "ATTRIBUTED", issues: ["WEAK_SOURCE"] }),
    claim({ text: "anon", support: "ATTRIBUTED", evidence_type: "ANONYMOUS_SOURCE", external_verification_required: true }),
    claim({ text: "ctx", issues: ["MISSING_CONTEXT"] }),
    claim({ text: "gap", support: "INSUFFICIENT_EVIDENCE" }),
    claim({ text: "ext", support: "UNVERIFIED", external_verification_required: true }),
  ], [{ type: "SELECTIVE_EVIDENCE", note: "only one side", claim_ids: [] }]));
  assert.deepEqual(h.supported.map((x) => x.text), ["ok"]);
  assert.deepEqual(h.review.map((x) => [x.text, x.category]), [
    ["alleg", "Allegation"], ["weak", "Weak source"], ["anon", "Weak source"], ["ctx", "Missing context"],
    ["gap", "Evidence gap"], ["ext", "External verification required"], ["only one side", "Selective evidence"],
  ]);
});

test("sideBySide: rows for non-supported claims or any with gap/inference; four textual columns", () => {
  const { rows, total } = D.sideBySide(result([
    claim({ id: "c1", text: "clean" }),
    claim({ id: "c2", text: "supported but with inference", inference: "reader may think X" }),
    claim({ id: "c3", text: "attributed", support: "ATTRIBUTED", gap: "the report" }),
    claim({ id: "c4", text: "gap", support: "EVIDENCE_GAP", evidence_type: "NO_EVIDENCE_SHOWN", evidence: "" }),
  ]));
  assert.equal(total, 4);
  assert.deepEqual(rows.map((r) => r.id), ["c4", "c3", "c2"], "issues first, then verify, then supported-with-inference");
  assert.deepEqual(Object.keys(rows[0]), ["id", "says", "allegation", "support", "evidenceType", "evidence", "gap", "inference", "bucket"]);
});

test("evidenceProfile counts evidence types presented by the article", () => {
  const p = D.evidenceProfile(result([claim(), claim(), claim({ evidence_type: "NO_EVIDENCE_SHOWN" })]));
  assert.deepEqual(p, [{ type: "NAMED_SOURCE", label: "Named source", count: 2 }, { type: "NO_EVIDENCE_SHOWN", label: "No evidence shown", count: 1 }]);
});
