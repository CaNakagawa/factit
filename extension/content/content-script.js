// Fact It - content script (V0.3).
//
// Runs in an isolated world on http/https pages. It must never receive
// API keys. Loaded after vendor/Readability*.js, utils/hash.js,
// content/extractor.js and content/normalize.js (see manifest.json),
// which provide the globals used here.
//
// V0.3: extracts the main article locally and normalizes it into an
// ArticleDocument. Nothing leaves the page yet.

(() => {
  const deps = { Readability, isProbablyReaderable };

  // Extraction + normalization. Returns an ArticleDocument or null.
  async function buildArticleDocument() {
    try {
      const extraction = FactIt.extractArticle(document, location, deps);
      return await FactIt.normalizeArticle(extraction);
    } catch (error) {
      console.warn("[Fact It] extraction failed:", error);
      return null;
    }
  }

  // Summary only - article text is never logged.
  function summarize(articleDocument) {
    if (!articleDocument) return "no article detected";
    const d = articleDocument.document;
    return {
      title: d.title,
      author: d.author,
      published_at: d.published_at,
      language: d.language,
      content_chars: d.content.length,
      truncated: d.truncated,
      links: d.links.length,
      images: d.images.length,
      content_hash: articleDocument.content_hash,
    };
  }

  // On-demand extraction for the extension's own privileged context.
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!sender || sender.id !== chrome.runtime.id) return false;
    if (message && message.type === "FACTIT_EXTRACT") {
      buildArticleDocument().then((article) => sendResponse({ type: "FACTIT_ARTICLE", article }));
      return true; // async response
    }
    return false;
  });

  console.log("[Fact It] content script loaded:", location.href);
  buildArticleDocument().then((article) => console.log("[Fact It] article:", summarize(article)));

  chrome.runtime.sendMessage({ type: "FACTIT_PING" }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn("[Fact It] service worker unreachable:", chrome.runtime.lastError.message);
      return;
    }
    console.log("[Fact It] service worker responded:", response);
  });
})();
