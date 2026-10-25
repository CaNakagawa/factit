// The evaluation harness (eval/) must measure what users get: same
// extractor, prompt, adapters and validator. These tests run it without a
// network or a key (ADR-015).

import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { loadCases, checkExpectations, articleFromHtml } from "../../eval/lib.mjs";
import { analyzeArticle, articleDocumentProblem } from "../../extension/analysis/engine.js";

const CASES = new URL("../../eval/cases/", import.meta.url).pathname;

test("versioned cases are valid ArticleDocuments the extension would accept", () => {
  const cases = loadCases([CASES]);
  assert.ok(cases.length >= 4);
  for (const c of cases) {
    assert.equal(articleDocumentProblem(c.article), null, c.name);
    assert.equal(c.read_quality.thin, false, `${c.name} would be refused as too thin`);
    assert.ok(c.expect && typeof c.expect === "object", c.name);
  }
});

test("checkExpectations reports each failed expectation by name", async () => {
  const fixture = loadCases([CASES]).find((c) => c.name === "opinion-unsourced-facts");
  const answer = {
    article: { type: "OPINION", thesis: "t", thesis_support: "PARTIALLY_SUPPORTED", thesis_note: "", other_side: "NOT_APPLICABLE" },
    assessment: { confidence: 0.7, rationale: "r" },
    source_transparency: {},
    claims: [{ text: "He voted three times against the holiday.", type: "FACTUAL", support: "UNSUPPORTED_WITHIN_ARTICLE", attribution: "NONE", evidence_type: "NO_EVIDENCE_SHOWN", evidence: "", concerns: [], gap: "No record of the votes is shown.", inference: "" }],
    concerns: [],
    framing: { detected: false, type: null, strength: null, confidence: 0.2, observations: [] },
    summary: "s",
  };
  const provider = { id: "fake", model: "fake", complete: async () => ({ text: JSON.stringify(answer), model: "fake", provider: "fake", finish: "stop", usage: { input_tokens: 1, output_tokens: 1 } }) };
  const result = await analyzeArticle(fixture.article, provider);

  const good = checkExpectations(result, fixture.expect);
  assert.ok(good.every((c) => c.ok), JSON.stringify(good));

  const bad = checkExpectations(result, { status: ["NO_SIGNIFICANT_CONCERNS"], article_type: ["NEWS"], must_not_have_concerns: ["UNSUPPORTED_ASSERTION"], must_contrast: true });
  assert.deepEqual(bad.filter((c) => !c.ok).map((c) => c.name), ["status", "article_type", "no UNSUPPORTED_ASSERTION", "contrast"]);
  assert.deepEqual(checkExpectations(result, {}), [], "no expectation, nothing checked");
});

test("capture from saved HTML builds the same document the content script would", async () => {
  const { readFileSync } = await import("node:fs");
  const html = readFileSync(join(CASES, "../../tests/fixtures/article.html"), "utf8");
  const { article, quality } = await articleFromHtml(html, "https://news.example.com/story");
  assert.equal(article.document.title, "City council approves new transit plan");
  assert.equal(quality.thin, false);
});
