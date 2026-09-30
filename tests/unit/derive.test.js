// View derivation (schema 2.1): status, buckets, counters, findings,
// highlights, side-by-side and source transparency from claim records.

import { test } from "node:test";
import assert from "node:assert/strict";
import { loadClassicScript } from "../helpers/load-script.js";

loadClassicScript(new URL("../../extension/ui/i18n.js", import.meta.url));
loadClassicScript(new URL("../../extension/ui/derive.js", import.meta.url));
const D = globalThis.FactIt.derive;
const { i18n } = globalThis.FactIt;

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

test("tagOf: one tag per claim, concerns outrank everything, no truth claim", () => {
  const tag = (over, concerns = []) => D.tagOf(claim(over), result([claim(over)], concerns)).code;
  assert.equal(tag({ evidence_type: "PRIMARY_DOCUMENT" }), "DOCUMENTED");
  assert.equal(tag({ evidence_type: "OFFICIAL_RECORD", support: "ARTICLE_SUPPORTED" }), "DOCUMENTED");
  assert.equal(tag({ evidence_type: "NAMED_SOURCE" }), "SOURCED");
  assert.equal(tag({ evidence_type: "DIRECT_QUOTE" }), "SOURCED");
  assert.equal(tag({ evidence_type: "ARTICLE_ASSERTION", attribution: "NONE" }), "REPORTED");
  assert.equal(tag({ support: "ALLEGATION_REPORTED", type: "ALLEGATION" }), "ALLEGATION");
  assert.equal(tag({ type: "OPINION" }), "OPINION");
  assert.equal(tag({ support: "UNCLEAR" }), "UNCLEAR");
  assert.equal(tag({ support: "UNSUPPORTED_WITHIN_ARTICLE" }), "UNSOURCED");
  assert.equal(tag({ support: "INTERNALLY_CONTRADICTED" }), "CONTRADICTION");
  assert.equal(tag({ concerns: ["MATERIAL_MISSING_CONTEXT"] }), "NEEDS_REVIEW");
  assert.equal(tag({ concerns: ["UNSUPPORTED_SERIOUS_ALLEGATION"] }), "SUSPICIOUS");
  assert.equal(tag({ concerns: ["INTERNAL_CONTRADICTION"] }), "CONTRADICTION");
  // A concern outranks an otherwise well-backed claim.
  assert.equal(tag({ evidence_type: "PRIMARY_DOCUMENT", concerns: ["MISLEADING_STATISTIC"] }), "NEEDS_REVIEW");
  // An article-level concern that names the claim counts too.
  const c = claim({ id: "c9", evidence_type: "PRIMARY_DOCUMENT" });
  assert.equal(D.tagOf(c, result([c], [concern("HEADLINE_CONTRADICTS_BODY", ["c9"])])).code, "CONTRADICTION");

  // No tag asserts truth or verification, and every tone maps to a color.
  for (const [code, t] of Object.entries(D.TAGS)) {
    assert.doesNotMatch(t.label, /\bFACT\b|TRUE|VERIFIED/i, code);
    assert.ok(D.TAG_COLOR[t.tone], code);
  }
});

test("tagOf: tag color never disagrees with the claim's bucket color", () => {
  const cases = [
    claim(), claim({ support: "UNCLEAR" }), claim({ type: "OPINION" }), claim({ support: "ALLEGATION_REPORTED" }),
    claim({ support: "UNSUPPORTED_WITHIN_ARTICLE" }), claim({ concerns: ["SELECTIVE_EVIDENCE"] }),
    claim({ concerns: ["INVALID_CITATION"] }), claim({ support: "INTERNALLY_CONTRADICTED" }),
  ];
  for (const c of cases) {
    const r = result([c]);
    const tag = D.tagOf(c, r);
    const bucket = D.bucketOf(c, r);
    const compatible = { concern: ["alert"], caution: ["caution"], ok: ["ok", "neutral"] };
    assert.ok(compatible[bucket].includes(tag.tone), `${tag.code} (${tag.tone}) in bucket ${bucket}`);
  }
});

test("twoBoxes: inference on the left moves the statement to the right", () => {
  const withInference = claim({ text: "Sales rose 3%.", concerns: ["MISLEADING_STATISTIC"], gap: "Compared against a holiday quarter.", inference: "That the business is growing strongly.", evidence: "quarterly report" });
  const tb = D.twoBoxes(withInference, result([withInference]));
  assert.equal(tb.believe, "That the business is growing strongly.");
  assert.equal(tb.fromInference, true);
  assert.deepEqual(tb.says, [
    { key: "Stated", text: "Sales rose 3%." },
    { key: "Shown", text: "quarterly report" },
    { key: "Not shown", text: "Compared against a holiday quarter." },
  ]);
  assert.equal(tb.tag.code, "NEEDS_REVIEW");

  const plain = claim({ text: "The council voted 7-2.", evidence: "session record" });
  const tb2 = D.twoBoxes(plain, result([plain]));
  assert.equal(tb2.believe, "The council voted 7-2.", "with no inference the left box is the claim as put");
  assert.equal(tb2.fromInference, false);
  assert.deepEqual(tb2.says, [{ key: "Shown", text: "session record" }]);

  const nothing = claim({ text: "X happened.", evidence: "", evidence_type: "NO_EVIDENCE_SHOWN", support: "UNSUPPORTED_WITHIN_ARTICLE" });
  assert.deepEqual(D.twoBoxes(nothing, result([nothing])).says, [{ key: "Shown", text: "No evidence shown" }]);
});

test("interface language: labels, tags and counts translate; analysis text is untouched", () => {
  const c = claim({ text: "O ministro desviou recursos.", support: "UNSUPPORTED_WITHIN_ARTICLE", concerns: ["UNSUPPORTED_SERIOUS_ALLEGATION"], gap: "Nenhum documento é apresentado.", inference: "Que houve má-fé." });
  const r = result([c]);
  try {
    i18n.setLanguage("pt");
    assert.equal(D.status(r).label, "Preocupações relevantes");
    assert.match(D.status(r).meaning, /^O conteúdo analisado se contradiz/);
    assert.equal(D.tagOf(c, r).label, "SUSPEITO");
    assert.equal(D.reasonOf(c, r), "Acusação grave apresentada como fato");
    assert.equal(D.supportLabel("ATTRIBUTED"), "Relato atribuído");
    assert.equal(D.evidenceLabel("NAMED_SOURCE"), "Fonte identificada");
    assert.equal(D.attributionLabel("CLEAR"), "Clara");
    assert.equal(D.confidenceWord(0.8), "alta");
    assert.deepEqual(D.bannerText(r), { label: "Preocupações relevantes", detail: "1 problema" }, "a significant concern is counted as an issue");
    assert.deepEqual(D.bannerText(result([claim({ concerns: ["SELECTIVE_EVIDENCE"] }), claim({ id: "c2", concerns: ["MISLEADING_STATISTIC"] })])), { label: "Revisão recomendada", detail: "2 preocupações" });
    const tb = D.twoBoxes(c, r);
    assert.deepEqual(tb.says.map((x) => x.key), ["Afirma", "Mostra", "Não mostra"]);
    // The model's text is never translated.
    assert.equal(tb.believe, "Que houve má-fé.");
    assert.equal(tb.says[0].text, "O ministro desviou recursos.");
    assert.equal(D.sourceTransparency(r, {}).items[0].label, "Autoria identificada");
  } finally {
    i18n.setLanguage("en");
  }
  assert.equal(D.status(r).label, "Significant concerns", "switches back");
});

test("i18n: unknown strings fall back to English, placeholders interpolate, auto follows the browser", () => {
  const { t, resolve, LANGUAGES } = i18n;
  i18n.setLanguage("pt");
  assert.equal(t("A string nobody translated"), "A string nobody translated");
  assert.equal(t("{n} concerns", { n: 4 }), "4 preocupações");
  assert.equal(t("{n} concerns", {}), "{n} preocupações", "a missing value keeps the placeholder");
  i18n.setLanguage("en");
  assert.equal(t("{n} concerns", { n: 4 }), "4 concerns");
  assert.deepEqual(LANGUAGES.map((l) => l.code), ["auto", "en", "pt"]);
  assert.equal(resolve("pt"), "pt");
  assert.equal(resolve("en"), "en");
  assert.ok(["en", "pt"].includes(resolve("auto")), "auto resolves from the browser language");
});
