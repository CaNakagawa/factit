// Fact It - evaluation helpers (ADR-015).
//
// Shared by eval/capture.mjs and eval/run.mjs. Nothing here runs in the
// extension; it only reuses the extension's own extractor, normalizer,
// prompt, provider adapters and validator, so an evaluation measures
// exactly what users get.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { Readability, isProbablyReaderable } from "@mozilla/readability";
import { loadClassicScript } from "../tests/helpers/load-script.js";

const ROOT = new URL("../", import.meta.url).pathname;
for (const f of ["utils/hash.js", "content/extractor.js", "content/normalize.js"]) {
  loadClassicScript(join(ROOT, "extension", f));
}
const { extractArticle, normalizeArticle, readQuality } = globalThis.FactIt;

/** ArticleDocument + read quality from saved HTML, as the content script would build it. */
export async function articleFromHtml(html, url) {
  const dom = new JSDOM(html, { url });
  const extraction = extractArticle(dom.window.document, dom.window.location, { Readability, isProbablyReaderable });
  return { article: await normalizeArticle(extraction), quality: readQuality(extraction) };
}

/** Every case file under the given directories, sorted by name. */
export function loadCases(dirs) {
  const out = [];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir).filter((n) => n.endsWith(".json")).sort()) {
      const path = join(dir, name);
      out.push({ path, ...JSON.parse(readFileSync(path, "utf8")) });
    }
  }
  return out;
}

const concernCodes = (r) => [...r.concerns.map((c) => c.type), ...r.claims.flatMap((c) => c.concerns)];

/**
 * Compare a validated AnalysisResult with a case's expectations. Every
 * expectation is optional; an absent one is not checked.
 * @returns {{ name: string, ok: boolean, detail: string }[]}
 */
export function checkExpectations(result, expect = {}) {
  const checks = [];
  const add = (name, ok, detail) => checks.push({ name, ok: Boolean(ok), detail });
  const codes = concernCodes(result);
  const a = result.article || {};
  if (expect.status) add("status", expect.status.includes(result.assessment.status), result.assessment.status);
  if (expect.article_type) add("article_type", expect.article_type.includes(a.type), String(a.type));
  if (expect.thesis_support) add("thesis_support", expect.thesis_support.includes(a.thesis_support), String(a.thesis_support));
  if (expect.other_side) add("other_side", expect.other_side.includes(a.other_side), String(a.other_side));
  if (Number.isInteger(expect.min_claims)) add("min_claims", result.claims.length >= expect.min_claims, `${result.claims.length}`);
  if (Number.isInteger(expect.max_claims)) add("max_claims", result.claims.length <= expect.max_claims, `${result.claims.length}`);
  for (const code of expect.must_have_concerns || []) add(`has ${code}`, codes.includes(code), codes.join(",") || "none");
  for (const code of expect.must_not_have_concerns || []) add(`no ${code}`, !codes.includes(code), codes.join(",") || "none");
  if (expect.must_contrast) add("contrast", result.claims.some((c) => c.inference && c.concerns.length === 0), "attributed characterization shown as contrast");
  return checks;
}
