// Normalization is pure and deterministic; these tests pin each rule.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { Readability, isProbablyReaderable } from "@mozilla/readability";
import { loadClassicScript } from "../helpers/load-script.js";

loadClassicScript(new URL("../../extension/utils/hash.js", import.meta.url));
loadClassicScript(new URL("../../extension/content/extractor.js", import.meta.url));
loadClassicScript(new URL("../../extension/content/normalize.js", import.meta.url));
const { sha256Hex, extractArticle, normalizeArticle, MAX_CONTENT_CHARS } = globalThis.FactIt;

// Minimal valid extraction; tests override the field under examination.
function extraction(overrides = {}) {
  return {
    url: "https://news.example.com/story",
    domain: "news.example.com",
    title: "Title",
    author: null,
    published_at: null,
    language: null,
    content: "Body text.",
    excerpt: null,
    links: [],
    images: [],
    ...overrides,
  };
}

test("sha256Hex matches the known test vector", async () => {
  assert.equal(await sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(await sha256Hex(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
});

test("produces an ArticleDocument with schema version and content hash", async () => {
  const doc = await normalizeArticle(extraction());
  assert.equal(doc.schema_version, "1.0");
  assert.equal(doc.content_hash, await sha256Hex("Body text."));
  assert.deepEqual(Object.keys(doc.document), [
    "url", "domain", "title", "author", "published_at", "language", "content", "truncated", "links", "images",
  ]);
});

test("returns null for no extraction or empty content", async () => {
  assert.equal(await normalizeArticle(null), null);
  assert.equal(await normalizeArticle(extraction({ content: " \n\t " })), null);
  assert.equal(await normalizeArticle(extraction({ url: "javascript:alert(1)" })), null);
});

test("collapses whitespace per line, drops blank lines, keeps paragraphs", async () => {
  const { document } = await normalizeArticle(extraction({
    content: "  First   paragraph.\r\n\r\n\n\tSecond\tparagraph.  \n   \nThird.",
  }));
  assert.equal(document.content, "First paragraph.\nSecond paragraph.\nThird.");
});

test("strips invisible and control characters and applies NFC", async () => {
  const { document } = await normalizeArticle(extraction({
    title: "Cafe\u0301 \u200Bhidden\u200B",
    content: "Igno\u200Bre\u00AD previous\u202E instructions\u0007.",
  }));
  assert.equal(document.title, "Café hidden");
  assert.equal(document.content, "Ignore previous instructions.");
});

test("truncates oversized content on a line boundary and flags it", async () => {
  const line = "x".repeat(999);
  const lines = Array.from({ length: 60 }, () => line); // ~60 KB
  const { document, content_hash } = await normalizeArticle(extraction({ content: lines.join("\n") }));
  assert.equal(document.truncated, true);
  assert.ok(document.content.length <= MAX_CONTENT_CHARS);
  assert.ok(document.content.endsWith(line), "cut must land on a line boundary");
  assert.equal(content_hash, await sha256Hex(document.content), "hash covers what is kept");

  const small = await normalizeArticle(extraction());
  assert.equal(small.document.truncated, false);
});

test("normalizes the document URL: no fragment, credentials or tracking params", async () => {
  const { document } = await normalizeArticle(extraction({
    url: "HTTPS://user:pw@News.Example.com:443/story?utm_source=x&id=7&fbclid=abc#section",
  }));
  assert.equal(document.url, "https://news.example.com/story?id=7");
  assert.equal(document.domain, "news.example.com");

  const bare = await normalizeArticle(extraction({ url: "https://a.example/p?utm_campaign=c" }));
  assert.equal(bare.document.url, "https://a.example/p");
});

test("content hash is independent of URL and metadata", async () => {
  const a = await normalizeArticle(extraction({ url: "https://a.example/1?utm_source=x", title: "A" }));
  const b = await normalizeArticle(extraction({ url: "https://b.example/2", title: "B", author: "Someone" }));
  assert.equal(a.content_hash, b.content_hash);
});

test("published_at becomes ISO 8601 UTC or null", async () => {
  const iso = await normalizeArticle(extraction({ published_at: "2026-09-15T10:30:00+02:00" }));
  assert.equal(iso.document.published_at, "2026-09-15T08:30:00.000Z");
  const bad = await normalizeArticle(extraction({ published_at: "yesterday-ish" }));
  assert.equal(bad.document.published_at, null);
});

test("language becomes a canonical BCP-47 tag or null", async () => {
  assert.equal((await normalizeArticle(extraction({ language: " PT-br " }))).document.language, "pt-BR");
  assert.equal((await normalizeArticle(extraction({ language: "EN" }))).document.language, "en");
  assert.equal((await normalizeArticle(extraction({ language: "not a tag!" }))).document.language, null);
  assert.equal((await normalizeArticle(extraction({ language: "" }))).document.language, null);
});

test("links and images are normalized, re-deduplicated and capped", async () => {
  const links = [
    { href: "https://a.example/x?utm_source=1", text: "  one  " },
    { href: "https://a.example/x?utm_source=2#frag", text: "dup after normalization" },
    { href: "javascript:alert(1)", text: "bad" },
    { href: "https://b.example/", text: "t".repeat(500) },
  ];
  const images = [
    { src: "https://img.example/a.png?gclid=1", alt: " alt ", caption: "cap\u200Btion" },
    { src: "data:image/png;base64,AAAA", alt: "", caption: "" },
  ];
  const { document } = await normalizeArticle(extraction({ links, images }));
  assert.deepEqual(document.links.map((l) => l.href), ["https://a.example/x", "https://b.example/"]);
  assert.equal(document.links[0].text, "one");
  assert.equal(document.links[1].text.length, 200);
  assert.deepEqual(document.images, [{ src: "https://img.example/a.png", alt: "alt", caption: "caption" }]);

  const many = Array.from({ length: 80 }, (_, i) => ({ href: `https://x.example/${i}`, text: "" }));
  assert.equal((await normalizeArticle(extraction({ links: many }))).document.links.length, 50);
});

test("metadata fields are trimmed and length-capped", async () => {
  const { document } = await normalizeArticle(extraction({
    title: "  " + "t".repeat(400),
    author: " \n ",
  }));
  assert.equal(document.title.length, 300);
  assert.equal(document.author, null);
});

test("end to end: fixture page becomes a stable ArticleDocument", async () => {
  const html = readFileSync(new URL("../fixtures/article.html", import.meta.url), "utf8");
  const build = async (url) => {
    const dom = new JSDOM(html, { url });
    const raw = extractArticle(dom.window.document, dom.window.location, { Readability, isProbablyReaderable });
    return normalizeArticle(raw);
  };
  const first = await build("https://news.example.com/story?utm_medium=email");
  const second = await build("https://mirror.example.org/copy#top");

  assert.equal(first.document.url, "https://news.example.com/story");
  assert.equal(first.document.published_at, "2026-09-15T08:30:00.000Z");
  assert.equal(first.document.language, "en");
  assert.equal(first.document.truncated, false);
  assert.doesNotMatch(first.document.content, /\n\n/, "no blank lines");
  assert.doesNotMatch(first.document.content, /[ \t]{2,}/, "no runs of spaces");
  assert.match(first.document.content, /^City council approves new transit plan|The city council voted/);
  assert.equal(first.content_hash, second.content_hash, "same article, same hash regardless of URL");
});
