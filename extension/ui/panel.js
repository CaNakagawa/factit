// Fact It - expanded analysis panel (V0.8).
//
// Layout: verdict and conclusion first; claims, flags, framing and full
// metadata are behind a "Show detailed analysis" toggle.
//
// Opened from the bar. Renders the full AnalysisResult inside the same
// closed shadow root as the bar. Classic script; exposes FactIt.createPanel.
//
// Every string shown here comes from an untrusted model and is set with
// textContent. Factual support and framing are rendered in separate
// sections so they are never read as one score.

(function (root) {
  const PANEL_STYLE = `
    .panel {
      position: fixed; top: 28px; right: 0; z-index: 2147483646;
      width: min(440px, 100vw); max-height: calc(100vh - 28px);
      box-sizing: border-box; overflow-y: auto; padding: 14px 16px 18px;
      background: #1f2933; color: #e4e7eb;
      font: 13px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif;
      box-shadow: -2px 2px 8px rgba(0,0,0,.45); border-left: 1px solid #3e4c59;
    }
    .panel[hidden] { display: none; }
    .panel h2 { font-size: 14px; margin: 0; color: #f5f7fa; }
    .panel h3 { font-size: 12px; text-transform: uppercase; letter-spacing: .05em; color: #9aa5b1; margin: 18px 0 6px; }
    .panel p { margin: 0 0 6px; }
    .panel .head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .panel .close { all: initial; cursor: pointer; color: #9aa5b1; font: 16px system-ui, sans-serif; padding: 2px 6px; }
    .panel .close:hover { color: #f5f7fa; }
    .panel .notice { color: #cbd2d9; font-size: 12px; border: 1px solid #52606d; border-radius: 4px; padding: 6px 8px; margin: 8px 0; }
    .panel .meter { display: inline-block; vertical-align: middle; width: 120px; height: 6px; border-radius: 3px; background: #3e4c59; overflow: hidden; margin-right: 8px; }
    .panel .meter > span { display: block; height: 100%; background: #7fb3c8; }
    .panel .muted { color: #9aa5b1; }
    .panel ul { list-style: none; margin: 0; padding: 0; }
    .panel li { padding: 8px 0; border-top: 1px solid #323f4b; }
    .panel li:first-child { border-top: none; }
    .panel .badge { display: inline-block; font-size: 11px; border: 1px solid #52606d; border-radius: 3px; padding: 1px 6px; margin-right: 6px; color: #cbd2d9; }
    .panel .badge.type { border-color: #7fb3c8; }
    .panel .claim { margin: 4px 0 2px; color: #f5f7fa; }
    .panel .explanation { color: #cbd2d9; }
    .panel .lead { font-size: 14px; color: #f5f7fa; margin: 8px 0 4px; }
    .panel .toggle {
      all: initial; display: block; box-sizing: border-box; width: 100%; cursor: pointer; text-align: center;
      margin: 14px 0 4px; padding: 8px 10px; border: 1px solid #7fb3c8; border-radius: 4px;
      color: #f5f7fa; font: 13px system-ui, sans-serif;
    }
    .panel .toggle:hover { background: #3e4c59; }
    .panel .details[hidden] { display: none; }
    .panel .compact { font-size: 12px; color: #9aa5b1; margin-top: 12px; }
    .panel .actions { display: flex; gap: 8px; margin-top: 10px; }
    .panel .secondary {
      all: initial; cursor: pointer; font: 12px system-ui, sans-serif; color: #cbd2d9;
      border: 1px solid #52606d; border-radius: 3px; padding: 4px 8px;
    }
    .panel .secondary:hover { background: #3e4c59; color: #f5f7fa; }
  `;

  function humanize(code) {
    if (typeof code !== "string" || code === "") return "";
    const s = code.toLowerCase().replace(/_/g, " ");
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  const pct = (n) => `${Math.round((Number(n) || 0) * 100)}%`;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function section(title) {
    return el("h3", "", title);
  }

  function renderOverview(result) {
    const support = Number(result.analysis.overall_factual_support) || 0;
    const wrap = el("div");
    const meter = el("span", "meter");
    const fill = el("span");
    fill.style.width = pct(support);
    meter.append(fill);
    const line = el("p");
    line.append(
      meter,
      el("strong", "", `Factual support: ${root.FactIt.supportLabel(support)} (${pct(support)})`),
    );
    wrap.append(
      line,
      el("p", "muted", `Model confidence: ${root.FactIt.confidenceLabel(Number(result.analysis.confidence) || 0)} (${pct(result.analysis.confidence)})`),
      el("p", "notice", "Preliminary AI analysis of how well the article supports its own claims. No external sources were consulted; this is not a verification of whether the claims are true."),
    );
    return wrap;
  }

  function renderClaims(claims) {
    if (!claims.length) return el("p", "muted", "No verifiable claims were identified.");
    const list = el("ul");
    for (const c of claims) {
      const item = el("li");
      const badges = el("div");
      badges.append(el("span", "badge", humanize(c.classification)));
      if (c.type === "ALLEGATION") badges.append(el("span", "badge type", "Allegation"));
      badges.append(el("span", "muted", `confidence ${pct(c.confidence)}`));
      item.append(badges, el("p", "claim", c.text));
      if (c.explanation) item.append(el("p", "explanation", c.explanation));
      list.append(item);
    }
    return list;
  }

  function renderFlags(flags) {
    if (!flags.length) return el("p", "muted", "No flags raised.");
    const list = el("ul");
    for (const f of flags) {
      const item = el("li");
      item.append(el("div", "", humanize(f.type)));
      if (f.explanation) item.append(el("p", "explanation", f.explanation));
      list.append(item);
    }
    return list;
  }

  function renderFraming(framing) {
    const wrap = el("div");
    wrap.append(el("p", "muted", "Framing is assessed separately and does not affect factual support. A strongly framed article can be accurate; a neutral one can be wrong."));
    if (!framing || !framing.detected) {
      wrap.append(el("p", "", "No notable framing detected."));
      return wrap;
    }
    const line = el("p");
    line.append(
      el("span", "badge", humanize(framing.type || "OTHER")),
      el("span", "badge", framing.strength ? `${humanize(framing.strength)} strength` : "Strength unknown"),
      el("span", "muted", `confidence ${pct(framing.confidence)}`),
    );
    wrap.append(line);
    if (framing.explanation) wrap.append(el("p", "explanation", framing.explanation));
    return wrap;
  }

  function renderMetaCompact(meta, cached) {
    const when = meta.analyzed_at ? new Date(meta.analyzed_at).toLocaleString() : "unknown time";
    const parts = [
      "AI preliminary · not externally verified",
      `${meta.model || "unknown model"} via ${meta.provider || "unknown provider"}`,
      `prompt ${meta.prompt_version || "?"}`,
      cached ? `analyzed ${when} · shown from local cache` : when,
    ];
    const wrap = el("div", "compact");
    wrap.append(el("div", "", parts.join(" · ")));
    if (meta.truncated_input) wrap.append(el("div", "", "Note: the article was cut for length; only the first part was analyzed."));
    if (Array.isArray(meta.validation_issues) && meta.validation_issues.length) {
      wrap.append(el("div", "", `Note: ${meta.validation_issues.length} item(s) from the model were dropped because they did not match the schema.`));
    }
    return wrap;
  }

  /**
   * Build the panel contents for a validated AnalysisResult.
   * Exported for tests; createPanel uses it.
   */
  function renderPanelContent(result, onClose, options = {}) {
    const frag = document.createDocumentFragment();
    const head = el("div", "head");
    const close = el("button", "close", "✕");
    close.title = "Close";
    close.setAttribute("aria-label", "Close analysis");
    if (onClose) close.addEventListener("click", () => onClose());
    head.append(el("h2", "", "Fact It · preliminary analysis"), close);
    frag.append(head, renderOverview(result));

    // Conclusion first: this is what most readers want.
    frag.append(section("Conclusion"), el("p", "lead", result.summary || "No summary provided."));

    // Everything else is opt-in.
    const claims = Array.isArray(result.claims) ? result.claims : [];
    const flags = Array.isArray(result.flags) ? result.flags : [];
    const framingDetected = Boolean(result.framing && result.framing.detected);
    const counts = [
      `${claims.length} claim${claims.length === 1 ? "" : "s"}`,
      `${flags.length} flag${flags.length === 1 ? "" : "s"}`,
      framingDetected ? "framing noted" : "no notable framing",
    ].join(" · ");

    const details = el("div", "details");
    details.hidden = !options.detailsOpen;
    details.append(
      section(`Claims (${claims.length})`), renderClaims(claims),
      section(`Flags (${flags.length})`), renderFlags(flags),
      section("Framing"), renderFraming(result.framing),
    );

    const toggle = el("button", "toggle");
    const setLabel = () => {
      toggle.textContent = `${details.hidden ? "Show" : "Hide"} detailed analysis · ${counts}`;
      toggle.setAttribute("aria-expanded", String(!details.hidden));
    };
    toggle.addEventListener("click", () => {
      details.hidden = !details.hidden;
      setLabel();
      if (options.onToggleDetails) options.onToggleDetails(!details.hidden);
    });
    setLabel();

    frag.append(toggle, details, renderMetaCompact(result.meta || {}, options.cached));

    if (options.onReanalyze) {
      const actions = el("div", "actions");
      const again = el("button", "secondary", "Re-analyze (uses tokens)");
      again.addEventListener("click", () => options.onReanalyze());
      actions.append(again);
      frag.append(actions);
    }
    return frag;
  }

  /**
   * @param {ShadowRoot} shadow the bar's shadow root
   * @param {{ onClose?: Function }} [handlers]
   */
  function createPanel(shadow, handlers = {}) {
    const style = el("style");
    style.textContent = PANEL_STYLE;
    const panel = el("section", "panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Fact It analysis details");
    panel.hidden = true;
    shadow.append(style, panel);
    const host = shadow.host;
    let result = null;

    const api = {
      element: panel,
      /**
       * @param {object} next validated AnalysisResult
       * @param {{ cached?: boolean, onReanalyze?: Function }} [options]
       */
      setResult(next, options = {}) {
        result = next;
        host.dataset.factitDetails = "hidden";
        panel.replaceChildren(renderPanelContent(result, () => api.close(), {
          cached: Boolean(options.cached),
          onReanalyze: options.onReanalyze,
          onToggleDetails: (open) => { host.dataset.factitDetails = open ? "shown" : "hidden"; },
        }));
      },
      open() {
        if (!result) return;
        panel.hidden = false;
        host.dataset.factitPanel = "open";
      },
      close() {
        panel.hidden = true;
        host.dataset.factitPanel = "closed";
        if (handlers.onClose) handlers.onClose();
      },
      toggle() {
        if (panel.hidden) api.open();
        else api.close();
      },
      isOpen() {
        return !panel.hidden;
      },
    };
    host.dataset.factitPanel = "closed";
    return api;
  }

  root.FactIt = Object.assign(root.FactIt || {}, { createPanel, renderPanelContent, humanize });
})(globalThis);
