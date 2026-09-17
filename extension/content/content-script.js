// Fact It - content script (V0.7).
//
// Runs in an isolated world on http/https pages. It must never receive
// API keys. Loaded after vendor/Readability*.js, utils/hash.js,
// content/extractor.js and content/normalize.js (see manifest.json),
// which provide the globals used here.
//
// Extracts and normalizes the article locally and shows the Fact It bar
// on article pages. Analysis runs on demand (toolbar click or the bar's
// Analyze button): the ArticleDocument goes to the background worker,
// the validated AnalysisResult comes back and the bar renders it.

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

  let bar = null;
  let panel = null;
  let running = false;

  function ensureBar() {
    if (!bar || !bar.host.isConnected) {
      bar = FactIt.createTopBar({
        onAnalyze: () => runAnalysis(),
        onOpenSettings: () => chrome.runtime.sendMessage({ type: "FACTIT_OPEN_SETTINGS" }),
        onDetails: () => panel && panel.toggle(),
      });
      panel = FactIt.createPanel(bar.root);
    }
    return bar;
  }

  // Extract, hand the document to the background for analysis, render
  // and log the outcome. Returns the reply so callers can inspect it.
  async function runAnalysis() {
    if (running) return { ok: false, error: { kind: "busy", message: "Analysis already running." } };
    running = true;
    const ui = ensureBar();
    try {
      ui.setLoading();
      const article = await buildArticleDocument();
      if (!article) {
        console.log("[Fact It] analysis skipped: no article detected");
        ui.setNoArticle();
        return { ok: false, error: { kind: "no_article", message: "No article detected on this page." } };
      }
      console.log("[Fact It] analysis requested:", summarize(article));
      const reply = await chrome.runtime.sendMessage({ type: "FACTIT_ANALYZE", article });
      if (reply && reply.ok) {
        const r = reply.result;
        console.log(
          `[Fact It] analysis (${r.analysis.verification_level}) support=${r.analysis.overall_factual_support} confidence=${r.analysis.confidence} claims=${r.claims.length} flags=${r.flags.length} framing=${r.framing.detected ? r.framing.type + "/" + r.framing.strength : "none"} via ${r.meta.provider}/${r.meta.model}`,
        );
        console.log("[Fact It] analysis result:", r);
        panel.setResult(r);
        ui.setResult(r);
      } else {
        const err = (reply && reply.error) || { kind: "unknown", message: "No reply from background." };
        console.warn(`[Fact It] analysis failed (${err.kind}): ${err.message}`, err.details || "");
        ui.setError(err);
      }
      return reply;
    } finally {
      running = false;
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!sender || sender.id !== chrome.runtime.id) return false;
    if (!message || typeof message.type !== "string") return false;

    if (message.type === "FACTIT_EXTRACT") {
      buildArticleDocument().then((article) => sendResponse({ type: "FACTIT_ARTICLE", article }));
      return true; // async response
    }
    if (message.type === "FACTIT_RUN") {
      runAnalysis().then(sendResponse);
      return true;
    }
    return false;
  });

  console.log("[Fact It] content script loaded:", location.href);
  buildArticleDocument().then((article) => {
    console.log("[Fact It] article:", summarize(article));
    // Idle bar only where there is something to analyze (ADR-006).
    if (article) ensureBar();
  });

  chrome.runtime.sendMessage({ type: "FACTIT_PING" }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn("[Fact It] service worker unreachable:", chrome.runtime.lastError.message);
      return;
    }
    console.log("[Fact It] service worker responded:", response);
  });
})();
