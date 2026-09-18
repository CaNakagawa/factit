// Fact It - top bar (schema 2.0).
//
// Thin indicator injected at the top of the page. Classic script running
// in the content-script world; exposes FactIt.createTopBar.
//
// The primary indicator represents ARTICLE SUPPORT only: how well the
// article backs its own claims. Never political or ideological neutrality,
// source popularity, community opinion, or truth.
//
// Security: everything lives in a closed shadow root so page CSS and
// scripts cannot restyle or read it. All dynamic text - which comes from
// an untrusted model - is set with textContent, never as HTML.

(function (root) {
  const HOST_ID = "factit-bar-host";
  const PRELIMINARY_LABEL = "AI preliminary · not externally verified";

  // Wording, colors and buckets come from ui/derive.js (loaded first).
  const derive = () => root.FactIt.derive;

  const STYLE = `
    :host { all: initial; }
    .bar {
      position: fixed; top: 0; left: 0; right: 0; z-index: 2147483647;
      box-sizing: border-box; height: 28px; padding: 0 10px;
      display: flex; align-items: center; gap: 12px;
      background: #1f2933; color: #f5f7fa;
      font: 13px/1 system-ui, -apple-system, "Segoe UI", sans-serif;
      box-shadow: 0 1px 3px rgba(0,0,0,.4);
    }
    .brand { font-weight: 700; letter-spacing: .02em; white-space: nowrap; }
    .main { flex: 1; display: flex; align-items: center; gap: 10px; min-width: 0; }
    .text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .label { flex: none; }
    .muted { color: #9aa5b1; }
    @media (max-width: 700px) { .detail, .tag.long { display: none; } }
    .meter { width: 90px; height: 6px; border-radius: 3px; background: #3e4c59; overflow: hidden; flex: none; }
    .meter > span { display: block; height: 100%; width: 0; background: #7fb3c8; }
    .dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
    .tag { font-size: 11px; color: #cbd2d9; border: 1px solid #52606d; border-radius: 3px; padding: 2px 6px; white-space: nowrap; }
    button {
      all: initial; cursor: pointer; font: 12px system-ui, sans-serif; color: #f5f7fa;
      border: 1px solid #7fb3c8; border-radius: 3px; padding: 3px 8px; white-space: nowrap;
    }
    button:hover { background: #3e4c59; }
    button.close { border: none; padding: 2px 6px; font-size: 14px; color: #9aa5b1; }
    .spinner {
      width: 12px; height: 12px; flex: none; border-radius: 50%;
      border: 2px solid #52606d; border-top-color: #7fb3c8; animation: factit-spin .8s linear infinite;
    }
    @keyframes factit-spin { to { transform: rotate(360deg); } }
  `;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  /**
   * @param {{ onAnalyze?: Function, onOpenSettings?: Function, onDetails?: Function }} handlers
   */
  function createTopBar(handlers = {}) {
    const existing = document.getElementById(HOST_ID);
    if (existing) existing.remove();

    const host = el("div");
    host.id = HOST_ID;
    const shadow = host.attachShadow({ mode: "closed" });

    const style = el("style");
    style.textContent = STYLE;
    shadow.append(style);

    const bar = el("div", "bar");
    bar.setAttribute("role", "status");
    // In the result state the whole bar (except buttons) opens the details.
    bar.addEventListener("click", (event) => {
      if (host.dataset.factitState !== "result" || !handlers.onDetails) return;
      if (event.target && event.target.closest && event.target.closest("button")) return;
      handlers.onDetails();
    });
    const main = el("div", "main");
    const close = el("button", "close", "✕");
    close.title = "Hide Fact It on this page";
    close.setAttribute("aria-label", "Hide Fact It bar");
    close.addEventListener("click", () => api.dismiss());
    bar.append(el("span", "brand", "Fact It"), main, close);
    shadow.append(bar);
    (document.documentElement || document.body).append(host);

    function render(state, ...nodes) {
      main.replaceChildren(...nodes);
      host.dataset.factitState = state;
    }

    function actionButton(label, handler) {
      const button = el("button", "", label);
      if (handler) button.addEventListener("click", () => handler());
      return button;
    }

    const api = {
      root: shadow,
      host,

      setIdle() {
        render("idle",
          el("span", "text muted", "Not analyzed"),
          actionButton("Analyze", handlers.onAnalyze),
          el("span", "tag", "AI preliminary"));
      },

      setLoading() {
        render("loading", el("span", "spinner"), el("span", "text muted", "Analyzing…"));
      },

      setNoArticle() {
        render("no-article", el("span", "text muted", "No article detected on this page"));
      },

      /**
       * @param {object} result validated AnalysisResult
       * @param {{ cached?: boolean }} [options]
       */
      setResult(result, options = {}) {
        const d = derive();
        const support = Number(result.assessment && result.assessment.article_support) || 0;
        const n = d.counts(result);
        const color = n.total === 0 ? "#9aa5b1" : d.supportColor(support);

        const meter = el("span", "meter");
        const fill = el("span");
        fill.style.width = `${Math.round(support * 100)}%`;
        fill.style.background = color;
        meter.append(fill);
        meter.title = `${d.supportWord(support)} - how well the article backs its own claims; not a truth score`;
        const dot = el("span", "dot");
        dot.style.background = color;

        const label = n.total === 0
          ? "No verifiable claims found"
          : `Article support: ${Math.round(support * 100)}%`;
        let detail = n.total === 0
          ? `${d.confidenceWord(result.assessment.confidence)} confidence`
          : n.needsReview > 0
            ? `${n.needsReview} need${n.needsReview === 1 ? "s" : ""} review`
            : "no claims need review";
        if (options.cached) detail = `from cache · ${detail}`;

        const nodes = [
          dot,
          meter,
          el("span", "text label", label),
          el("span", "text muted detail", detail),
          el("span", "tag long", PRELIMINARY_LABEL),
        ];
        if (handlers.onDetails) nodes.push(actionButton("Details", handlers.onDetails));
        render("result", ...nodes);
        bar.style.cursor = handlers.onDetails ? "pointer" : "";
      },

      /** @param {{ kind?: string, message?: string }} error */
      setError(error) {
        const kind = (error && error.kind) || "unknown";
        const message = (error && error.message) || "Unknown error";
        const nodes = [el("span", "text", `Analysis failed (${kind}): ${message}`)];
        if (kind === "config" || kind === "auth") {
          nodes.push(actionButton("Open settings", handlers.onOpenSettings));
        } else if (kind !== "extension_reloaded") {
          nodes.push(actionButton("Retry", handlers.onAnalyze));
        }
        render("error", ...nodes);
      },

      dismiss() {
        host.remove();
      },
    };

    api.setIdle();
    return api;
  }

  root.FactIt = Object.assign(root.FactIt || {}, { createTopBar });
})(globalThis);
