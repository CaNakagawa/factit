// Fact It - content script (V0.8).
//
// Runs in an isolated world on http/https pages. It must never receive
// API keys. Loaded after vendor/Readability*.js, utils/hash.js,
// content/extractor.js and content/normalize.js (see manifest.json),
// which provide the globals used here.
//
// Extracts and normalizes the article locally and shows the Fact It bar
// on article pages. On load it asks the background for a cached result
// (by content hash; no tokens). Analysis runs only when the user clicks
// the bar's Analyze button, or Re-analyze in the panel: the
// ArticleDocument goes to the background worker, the validated
// AnalysisResult comes back and the bar/panel render it. The toolbar
// button only shows the bar or toggles the panel.

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
  let lastResult = null; // kept so the bar can be restored after dismiss without re-running
  let lastCached = false;

  function ensureBar() {
    if (!bar || !bar.host.isConnected) {
      bar = FactIt.createTopBar({
        onAnalyze: () => runAnalysis(),
        onOpenSettings: () => chrome.runtime.sendMessage({ type: "FACTIT_OPEN_SETTINGS" }),
        onDetails: () => panel && panel.toggle(),
      });
      panel = FactIt.createPanel(bar.root);
      if (lastResult) showResult(lastResult, lastCached);
    }
    return bar;
  }

  function showResult(result, cached) {
    lastResult = result;
    lastCached = cached;
    panel.setResult(result, { cached, onReanalyze: () => runAnalysis({ force: true }) });
    bar.setResult(result, { cached });
  }

  // Toolbar click: never analyzes. Shows the bar (idle or last result) and,
  // when a result exists, toggles the details panel.
  async function toggleUi() {
    if (running) return { ok: true, state: "running" };
    const hadBar = Boolean(bar && bar.host.isConnected);
    const ui = ensureBar();
    // Re-assert our bar on top: a page may have stacked its own elements
    // over it. Moving the host to the end of <html> restores stacking order.
    (document.documentElement || document.body).append(ui.host);
    if (lastResult) {
      if (hadBar) panel.toggle();
      return { ok: true, state: "result", panel: panel.isOpen() ? "open" : "closed" };
    }
    const article = await buildArticleDocument();
    if (!article) ui.setNoArticle();
    else if (ui.host.dataset.factitState !== "idle") ui.setIdle();
    return { ok: true, state: ui.host.dataset.factitState };
  }

  // Extract, hand the document to the background for analysis, render
  // and log the outcome. Returns the reply so callers can inspect it.
  async function runAnalysis(options = {}) {
    const force = options.force === true;
    if (running) return { ok: false, error: { kind: "busy", message: "Analysis already running." } };
    if (lastResult && !force) return { ok: true, result: lastResult, cached: true }; // only Re-analyze re-runs
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
      console.log(`[Fact It] analysis requested${force ? " (re-analyze)" : ""}:`, summarize(article));
      let reply;
      try {
        reply = await chrome.runtime.sendMessage({ type: "FACTIT_ANALYZE", article, force });
      } catch (error) {
        // Typically "Extension context invalidated": the extension was
        // reloaded while this page kept the old content script.
        reply = { ok: false, error: { kind: "extension_reloaded", message: "Fact It was updated. Reload this page and try again." } };
      }
      if (reply && reply.ok) {
        const r = reply.result;
        console.log(
          `[Fact It] analysis (${r.analysis.verification_level}${reply.cached ? ", cached" : ""}) support=${r.analysis.overall_factual_support} confidence=${r.analysis.confidence} claims=${r.claims.length} flags=${r.flags.length} framing=${r.framing.detected ? r.framing.type + "/" + r.framing.strength : "none"} via ${r.meta.provider}/${r.meta.model}`,
        );
        console.log("[Fact It] analysis result:", r);
        showResult(r, Boolean(reply.cached));
      } else {
        const err = (reply && reply.error) || { kind: "unknown", message: "No reply from background." };
        // Details (e.g. the raw model text for invalid_output) go into the
        // message itself so chrome://extensions "Errors" shows them too.
        const details = Array.isArray(err.details) && err.details.length ? ` | ${err.details.join(" | ")}` : "";
        console.warn(`[Fact It] analysis failed (${err.kind}): ${err.message}${details}`);
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
    if (message.type === "FACTIT_TOGGLE") {
      toggleUi().then(sendResponse);
      return true;
    }
    return false;
  });

  console.log("[Fact It] content script loaded:", location.href);
  buildArticleDocument().then(async (article) => {
    console.log("[Fact It] article:", summarize(article));
    if (!article) return;
    // Idle bar only where there is something to analyze (ADR-006), or the
    // cached result for this exact content (no tokens).
    const ui = ensureBar();
    try {
      const reply = await chrome.runtime.sendMessage({ type: "FACTIT_LOOKUP", content_hash: article.content_hash });
      if (reply && reply.ok && reply.result) {
        console.log("[Fact It] cached analysis found:", reply.cached_at);
        showResult(reply.result, true);
      }
    } catch {
      // Background unavailable; stay idle.
    }
    void ui;
  });

  chrome.runtime.sendMessage({ type: "FACTIT_PING" }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn("[Fact It] service worker unreachable:", chrome.runtime.lastError.message);
      return;
    }
    console.log("[Fact It] service worker responded:", response);
  });
})();
