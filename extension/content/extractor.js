// Fact It - article extraction (V0.2).
//
// Classic script (content scripts cannot be ES modules). Exposes
// FactIt.extractArticle on the content-script global. Readability is
// injected so this file can be unit-tested in Node against the npm
// package while the extension uses the vendored copy.
//
// Everything read from the page is UNTRUSTED. The result contains plain
// text and validated http(s) URLs only - never HTML.

(function (root) {
  const MAX_LINKS = 50;
  const MAX_IMAGES = 20;
  const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
  // Cloning and parsing a huge DOM is the one thing a hostile page can make
  // expensive. Real articles are a few thousand nodes.
  const MAX_DOM_NODES = 60000;
  // Below this the extraction is menus, headlines and teasers rather than an
  // article: pages that render their body late, or hide it behind a gate.
  // Analyzing it would answer a question nobody asked and could report
  // "no significant concerns" about a page that was never read (ADR-014).
  const MIN_CONTENT_CHARS = 600;
  const MIN_PARAGRAPHS = 3;
  const PARAGRAPH_MIN_CHARS = 80;
  const BLOCK_SELECTOR = "p,li,blockquote,div,section,article,h1,h2,h3,h4,h5,h6,ul,ol,table";
  // Widgets Readability tends to keep although they are not article prose:
  // sidebars, media players, embedded frames, forms, teasers. Removed from
  // the CLONE only; the page itself is never touched.
  const NOISE_SELECTOR = [
    "aside", "audio", "video", "iframe", "form", "nav", "footer",
    "[role=\"complementary\"]", "[role=\"navigation\"]",
    "[class*=\"related\" i]", "[class*=\"recommend\" i]", "[class*=\"player\" i]",
    "[class*=\"newsletter\" i]", "[class*=\"teaser\" i]", "[class*=\"share\" i]",
    "[class*=\"cookie\" i]", "[class*=\"paywall\" i]", "[class*=\"advert\" i]",
  ].join(",");

  // Resolve href against base and keep only http(s) URLs. Returns null
  // for javascript:, data:, mailto:, malformed values, etc.
  function safeUrl(value, base) {
    if (typeof value !== "string" || value.trim() === "") return null;
    try {
      const url = new URL(value, base);
      if (!ALLOWED_PROTOCOLS.has(url.protocol)) return null;
      url.hash = "";
      return url.href;
    } catch {
      return null;
    }
  }

  function text(value) {
    return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  }

  function nullable(value) {
    const t = text(value);
    return t === "" ? null : t;
  }

  // Blocks of running text: a block with no block child of its own and at
  // least PARAGRAPH_MIN_CHARS characters. Counted on the extracted content
  // (never the whole page), so menus of short links do not add up to prose.
  function countParagraphs(articleElement) {
    if (!articleElement || typeof articleElement.querySelectorAll !== "function") return 0;
    let count = 0;
    for (const node of articleElement.querySelectorAll(BLOCK_SELECTOR)) {
      if (node.querySelector(BLOCK_SELECTOR)) continue; // a container, not text
      const len = (node.textContent || "").replace(/\s+/g, " ").trim().length;
      if (len >= PARAGRAPH_MIN_CHARS) count++;
    }
    return count;
  }

  // Hyperlinks inside the extracted article only, deduplicated by URL.
  function collectLinks(articleElement, base) {
    const seen = new Set();
    const links = [];
    for (const a of articleElement.querySelectorAll("a[href]")) {
      const href = safeUrl(a.getAttribute("href"), base);
      if (!href || seen.has(href)) continue;
      seen.add(href);
      links.push({ href, text: text(a.textContent) });
      if (links.length >= MAX_LINKS) break;
    }
    return links;
  }

  // Image metadata only. Images are never fetched or sent anywhere.
  function collectImages(articleElement, base) {
    const seen = new Set();
    const images = [];
    for (const img of articleElement.querySelectorAll("img[src]")) {
      const src = safeUrl(img.getAttribute("src"), base);
      if (!src || seen.has(src)) continue;
      seen.add(src);
      const figure = img.closest("figure");
      const figcaption = figure ? figure.querySelector("figcaption") : null;
      images.push({
        src,
        alt: text(img.getAttribute("alt")),
        caption: figcaption ? text(figcaption.textContent) : "",
      });
      if (images.length >= MAX_IMAGES) break;
    }
    return images;
  }

  /**
   * Extract the main article from a Document.
   *
   * @param {Document} doc            the page document (not mutated)
   * @param {{ href: string, hostname: string }} location
   * @param {{ Readability: Function, isProbablyReaderable: Function }} deps
   * @returns {object|null} extraction result, or null when the page does
   *   not look like an article or Readability finds nothing.
   */
  function extractArticle(doc, location, deps) {
    const { Readability, isProbablyReaderable } = deps;

    if (!isProbablyReaderable(doc)) return null;
    if (doc.getElementsByTagName("*").length > MAX_DOM_NODES) return null;

    // Readability mutates the DOM it is given.
    const clone = doc.cloneNode(true);
    for (const node of clone.querySelectorAll(NOISE_SELECTOR)) {
      // Keep <form>/<nav> etc. only if they would remove the whole body.
      if (node !== clone.body && node !== clone.documentElement) node.remove();
    }
    const article = new Readability(clone, {
      serializer: (element) => element,
    }).parse();

    if (!article || !article.content) return null;

    const base = location.href;
    const documentLang = doc.documentElement ? doc.documentElement.getAttribute("lang") : null;

    return {
      url: safeUrl(base, base) || base,
      domain: location.hostname,
      title: text(article.title),
      author: nullable(article.byline),
      published_at: nullable(article.publishedTime),
      language: nullable(article.lang) || nullable(documentLang),
      content: typeof article.textContent === "string" ? article.textContent : "",
      paragraphs: countParagraphs(article.content),
      excerpt: nullable(article.excerpt),
      links: collectLinks(article.content, base),
      images: collectImages(article.content, base),
    };
  }

  /**
   * Whether an extraction is too thin to analyze (ADR-014).
   * @returns {{ thin: boolean, chars: number, paragraphs: number }}
   */
  function readQuality(extraction) {
    const chars = extraction && typeof extraction.content === "string" ? extraction.content.trim().length : 0;
    const paragraphs = extraction && Number.isInteger(extraction.paragraphs) ? extraction.paragraphs : 0;
    return { thin: chars < MIN_CONTENT_CHARS || paragraphs < MIN_PARAGRAPHS, chars, paragraphs };
  }

  root.FactIt = Object.assign(root.FactIt || {}, {
    extractArticle, readQuality, MAX_DOM_NODES, MIN_CONTENT_CHARS, MIN_PARAGRAPHS,
  });
})(globalThis);
