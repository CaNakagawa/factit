// Fact It - content script (V0.2).
//
// Runs in an isolated world on http/https pages. It must never receive
// API keys. Loaded after vendor/Readability*.js and content/extractor.js
// (see manifest.json), which provide the globals used here.
//
// V0.2: extracts the main article locally. Nothing leaves the page yet.

(() => {
  const deps = { Readability, isProbablyReaderable };

  function extract() {
    try {
      return FactIt.extractArticle(document, location, deps);
    } catch (error) {
      console.warn("[Fact It] extraction failed:", error);
      return null;
    }
  }

  // Summary only - article text is never logged.
  function summarize(result) {
    if (!result) return "no article detected";
    return {
      title: result.title,
      author: result.author,
      published_at: result.published_at,
      language: result.language,
      content_chars: result.content.length,
      links: result.links.length,
      images: result.images.length,
    };
  }

  // On-demand extraction for the extension's own privileged context.
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!sender || sender.id !== chrome.runtime.id) return false;
    if (message && message.type === "FACTIT_EXTRACT") {
      sendResponse({ type: "FACTIT_ARTICLE", article: extract() });
    }
    return false;
  });

  console.log("[Fact It] content script loaded:", location.href);
  console.log("[Fact It] extraction:", summarize(extract()));

  chrome.runtime.sendMessage({ type: "FACTIT_PING" }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn("[Fact It] service worker unreachable:", chrome.runtime.lastError.message);
      return;
    }
    console.log("[Fact It] service worker responded:", response);
  });
})();
