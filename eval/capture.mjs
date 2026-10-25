// Fact It - capture an article for evaluation (ADR-015).
//
//   node eval/capture.mjs --html page.html --url https://... --name estadao-porto-feliz
//
// Save the page from your own browser first (Ctrl+S, "Webpage, HTML
// only"): that keeps your session, cookies and anything a paywall shows
// you, which a headless browser does not have. The file is written to
// eval/cases/local/, which is git-ignored: article text is someone else's
// copyrighted work and never goes into the repository.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { articleFromHtml } from "./lib.mjs";

const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : null; };
const html = arg("html");
const url = arg("url");
const name = (arg("name") || "").replace(/[^a-z0-9-]/gi, "-").toLowerCase();
if (!html || !url || !name) {
  console.error("usage: node eval/capture.mjs --html <saved page.html> --url <original url> --name <case-name>");
  process.exit(2);
}

const { article, quality } = await articleFromHtml(readFileSync(html, "utf8"), url);
if (!article) {
  console.error("No article could be extracted from that page.");
  process.exit(1);
}
const dir = new URL("./cases/local/", import.meta.url).pathname;
mkdirSync(dir, { recursive: true });
const file = join(dir, `${name}.json`);
writeFileSync(file, JSON.stringify({
  name,
  note: "Fill in what a good analysis of this article must and must not do. Every field is optional.",
  expect: { status: [], article_type: [], thesis_support: [], other_side: [], must_have_concerns: [], must_not_have_concerns: [] },
  read_quality: quality,
  article,
}, null, 2));
console.log(`Saved ${file}: ${quality.chars} chars, ${quality.paragraphs} paragraphs${quality.thin ? " - TOO THIN, the extension would refuse it" : ""}.`);
console.log("Edit its \"expect\" block, then run: node eval/run.mjs --dry");
