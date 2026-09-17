// Fact It - normalization (V0.3).
//
// Classic script; exposes FactIt.normalizeArticle. Turns the raw result
// of FactIt.extractArticle into an ArticleDocument (docs/ARTICLE_SCHEMA.md).
//
// Deterministic: the same extraction always yields the same document and
// therefore the same content_hash. Input is UNTRUSTED page data; output
// is bounded in size and contains plain text and http(s) URLs only.
// Requires FactIt.sha256Hex (utils/hash.js).

(function (root) {
  const SCHEMA_VERSION = "1.0";

  const MAX_CONTENT_CHARS = 40000;
  const MAX_TITLE_CHARS = 300;
  const MAX_AUTHOR_CHARS = 200;
  const MAX_LINK_TEXT_CHARS = 200;
  const MAX_IMAGE_TEXT_CHARS = 300;
  const MAX_LINKS = 50;
  const MAX_IMAGES = 20;

  // Query parameters that only track the visitor and never identify content.
  const TRACKING_PARAM = /^(utm_\w+|fbclid|gclid|dclid|gbraid|wbraid|msclkid|mc_cid|mc_eid|igshid|yclid|_ga|_gl|ref_src|ref_url)$/i;

  // C0/C1 controls (except tab, LF, CR), zero-width and bidi-control
  // characters, BOM and soft hyphen. Removing them keeps hidden text from
  // surviving into the document.
  const INVISIBLE = /[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F\u00AD\u200B-\u200F\u2028-\u202E\u2060-\u2064\uFEFF]/g;

  function clean(value, max) {
    if (typeof value !== "string") return "";
    const s = value.normalize("NFC").replace(INVISIBLE, "").replace(/\s+/g, " ").trim();
    return s.length > max ? s.slice(0, max).trim() : s;
  }

  function nullable(value, max) {
    const s = clean(value, max);
    return s === "" ? null : s;
  }

  // Paragraph-preserving text normalization plus a hard size cap.
  function normalizeContent(value) {
    if (typeof value !== "string") return { content: "", truncated: false };
    const lines = value
      .normalize("NFC")
      .replace(INVISIBLE, "")
      .split(/\r\n|\r|\n/)
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter((line) => line !== "");

    let content = lines.join("\n");
    let truncated = false;
    if (content.length > MAX_CONTENT_CHARS) {
      truncated = true;
      const cut = content.lastIndexOf("\n", MAX_CONTENT_CHARS);
      content = content.slice(0, cut > 0 ? cut : MAX_CONTENT_CHARS).trim();
    }
    return { content, truncated };
  }

  // Canonical http(s) URL without fragment, credentials or tracking params.
  function normalizeUrl(value) {
    if (typeof value !== "string") return null;
    let url;
    try {
      url = new URL(value.trim());
    } catch {
      return null;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    url.username = "";
    url.password = "";
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAM.test(key)) url.searchParams.delete(key);
    }
    let href = url.href;
    if (href.endsWith("?")) href = href.slice(0, -1);
    return href;
  }

  // ISO 8601 (UTC) or null.
  function normalizeDate(value) {
    if (typeof value !== "string" || value.trim() === "") return null;
    const time = Date.parse(value.trim());
    return Number.isNaN(time) ? null : new Date(time).toISOString();
  }

  // Canonical BCP-47 tag (e.g. "pt-BR") or null.
  function normalizeLanguage(value) {
    if (typeof value !== "string" || value.trim() === "") return null;
    try {
      return Intl.getCanonicalLocales(value.trim())[0] || null;
    } catch {
      return null;
    }
  }

  function normalizeLinks(links) {
    const seen = new Set();
    const out = [];
    for (const link of Array.isArray(links) ? links : []) {
      const href = link && normalizeUrl(link.href);
      if (!href || seen.has(href)) continue;
      seen.add(href);
      out.push({ href, text: clean(link.text, MAX_LINK_TEXT_CHARS) });
      if (out.length >= MAX_LINKS) break;
    }
    return out;
  }

  function normalizeImages(images) {
    const seen = new Set();
    const out = [];
    for (const image of Array.isArray(images) ? images : []) {
      const src = image && normalizeUrl(image.src);
      if (!src || seen.has(src)) continue;
      seen.add(src);
      out.push({
        src,
        alt: clean(image.alt, MAX_IMAGE_TEXT_CHARS),
        caption: clean(image.caption, MAX_IMAGE_TEXT_CHARS),
      });
      if (out.length >= MAX_IMAGES) break;
    }
    return out;
  }

  /**
   * @param {object|null} extraction result of FactIt.extractArticle
   * @returns {Promise<object|null>} ArticleDocument, or null when there is
   *   no extraction or no usable content.
   */
  async function normalizeArticle(extraction) {
    if (!extraction || typeof extraction !== "object") return null;

    const { content, truncated } = normalizeContent(extraction.content);
    if (content === "") return null;

    const url = normalizeUrl(extraction.url);
    if (!url) return null;

    return {
      schema_version: SCHEMA_VERSION,
      content_hash: await root.FactIt.sha256Hex(content),
      document: {
        url,
        domain: new URL(url).hostname,
        title: clean(extraction.title, MAX_TITLE_CHARS),
        author: nullable(extraction.author, MAX_AUTHOR_CHARS),
        published_at: normalizeDate(extraction.published_at),
        language: normalizeLanguage(extraction.language),
        content,
        truncated,
        links: normalizeLinks(extraction.links),
        images: normalizeImages(extraction.images),
      },
    };
  }

  root.FactIt = Object.assign(root.FactIt || {}, {
    normalizeArticle,
    ARTICLE_SCHEMA_VERSION: SCHEMA_VERSION,
    MAX_CONTENT_CHARS,
  });
})(globalThis);
