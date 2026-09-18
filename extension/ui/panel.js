// Fact It - analysis panel (schema 2.1, concern detection).
//
// Progressive disclosure inside the bar's closed shadow root:
//   level 2  Summary        status, counters, key findings, source transparency, framing, actions
//   level 3  Detailed       tabs: Overview · Claims · Evidence · Framing · About
//
// Classic script; exposes FactIt.createPanel. Every string shown here comes
// from an untrusted model and is set with textContent. All views are
// derived from the same claim records via FactIt.derive; the panel never
// asks for extra model output.

(function (root) {
  const PANEL_STYLE = `
    .panel {
      position: fixed; top: 28px; right: 0; z-index: 2147483646;
      width: min(460px, 100vw); max-height: calc(100vh - 28px);
      box-sizing: border-box; overflow-y: auto; padding: 14px 16px 18px;
      background: #1f2933; color: #e4e7eb;
      font: 13px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif;
      box-shadow: -2px 2px 8px rgba(0,0,0,.45); border-left: 1px solid #3e4c59;
    }
    .panel[hidden] { display: none; }
    .panel h2 { font-size: 14px; margin: 0; color: #f5f7fa; }
    .panel h3 { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #9aa5b1; margin: 16px 0 6px; }
    .panel p { margin: 0 0 6px; }
    .panel .head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .panel .close, .panel .back { all: initial; cursor: pointer; color: #9aa5b1; font: 14px system-ui, sans-serif; padding: 2px 6px; }
    .panel .close:hover, .panel .back:hover { color: #f5f7fa; }
    .panel .muted { color: #9aa5b1; }
    .panel .small { font-size: 12px; }

    /* summary */
    .panel .status { display: flex; align-items: center; gap: 12px; margin: 12px 0 4px; }
    .panel .status .dot { width: 14px; height: 14px; border-radius: 50%; flex: none; }
    .panel .status .word { font-size: 17px; color: #f5f7fa; font-weight: 700; line-height: 1.2; }
    .panel .transparency { list-style: none; margin: 0; padding: 0; font-size: 12px; }
    .panel .transparency li { display: flex; gap: 8px; align-items: baseline; margin: 2px 0; }
    .panel .transparency .yes { color: #22c55e; }
    .panel .transparency .no { color: #9aa5b1; }
    .panel .level { margin-top: 10px; padding: 8px 10px; border: 1px solid #52606d; border-radius: 4px; }
    .panel .level strong { color: #f5f7fa; font-size: 11px; letter-spacing: .06em; }
    .panel .counters { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin: 14px 0 4px; }
    .panel .counter { border-radius: 4px; padding: 8px; background: #263340; text-align: center; }
    .panel .counter .n { font-size: 22px; font-weight: 800; line-height: 1.1; }
    .panel .counter .l { font-size: 11px; color: #cbd2d9; }
    .panel .finding { display: grid; grid-template-columns: 14px 1fr; gap: 8px; padding: 6px 0; border-top: 1px solid #323f4b; }
    .panel .finding:first-of-type { border-top: none; }
    .panel .finding .mark { width: 10px; height: 10px; border-radius: 50%; margin-top: 4px; }
    .panel .finding .lbl { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #cbd2d9; }
    .panel .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
    .panel button.primary, .panel button.secondary, .panel button.tab {
      all: initial; cursor: pointer; font: 12px system-ui, sans-serif; border-radius: 3px; padding: 6px 10px;
    }
    .panel button.primary { color: #f5f7fa; border: 1px solid #7fb3c8; }
    .panel button.primary:hover { background: #3e4c59; }
    .panel button.secondary { color: #cbd2d9; border: 1px solid #52606d; }
    .panel button.secondary:hover { background: #3e4c59; color: #f5f7fa; }

    /* detailed */
    .panel .tabs { display: flex; gap: 4px; flex-wrap: wrap; margin: 10px 0 4px; border-bottom: 1px solid #3e4c59; }
    .panel button.tab { color: #9aa5b1; border-radius: 3px 3px 0 0; border-bottom: 2px solid transparent; }
    .panel button.tab[aria-selected="true"] { color: #f5f7fa; border-bottom-color: #7fb3c8; }
    .panel .legend { display: flex; gap: 12px; flex-wrap: wrap; font-size: 11px; color: #cbd2d9; margin: 6px 0; }
    .panel .legend i { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; }
    .panel .claim { border-top: 1px solid #323f4b; }
    .panel .claim:first-of-type { border-top: none; }
    .panel .claim > button {
      all: initial; cursor: pointer; display: grid; grid-template-columns: 12px 1fr 14px; gap: 8px; align-items: start;
      width: 100%; box-sizing: border-box; padding: 8px 0; color: #f5f7fa; font: 13px/1.4 system-ui, sans-serif;
    }
    .panel .claim .mark { width: 10px; height: 10px; border-radius: 50%; margin-top: 4px; }
    .panel .claim .reason { font-size: 11px; color: #cbd2d9; text-transform: uppercase; letter-spacing: .04em; }
    .panel .claim .chev { color: #9aa5b1; }
    .panel .claim dl { margin: 0 0 10px 20px; display: grid; grid-template-columns: 130px 1fr; gap: 3px 10px; font-size: 12px; }
    .panel .claim dl[hidden] { display: none; }
    .panel .claim dt { color: #9aa5b1; }
    .panel .claim dd { margin: 0; color: #e4e7eb; }
    .panel .badge { display: inline-block; font-size: 11px; border: 1px solid #52606d; border-radius: 3px; padding: 1px 6px; margin: 0 6px 4px 0; color: #cbd2d9; }
    .panel .badge.type { border-color: #7fb3c8; }
    .panel .sbs .row { border-top: 1px solid #323f4b; padding: 8px 0; }
    .panel .sbs .row:first-of-type { border-top: none; }
    .panel .sbs dl { display: grid; grid-template-columns: 120px 1fr; gap: 3px 10px; margin: 4px 0 0; font-size: 12px; }
    .panel .sbs dt { color: #9aa5b1; text-transform: uppercase; font-size: 10px; letter-spacing: .05em; padding-top: 2px; }
    .panel .sbs dd { margin: 0; }
    .panel ul.plain { margin: 0; padding-left: 18px; }
    .panel ul.plain li { margin: 2px 0; }
    .panel .kv { font-size: 12px; display: grid; grid-template-columns: 130px 1fr; gap: 2px 10px; }
    .panel .kv dt { color: #9aa5b1; }
    .panel .kv dd { margin: 0; color: #e4e7eb; }
    .panel .hl h4 { font-size: 12px; margin: 10px 0 4px; }
    .panel .hl li { list-style: none; padding: 3px 0 3px 10px; border-left: 3px solid #3e4c59; margin: 3px 0; }
    .panel .hl ul { padding: 0; margin: 0 0 4px; }
    .panel .hl .cat { font-size: 10px; text-transform: uppercase; letter-spacing: .05em; color: #9aa5b1; margin-right: 6px; }
  `;

  const d = () => root.FactIt.derive;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  const section = (title) => el("h3", "", title);
  const mark = (bucket, cls = "mark") => {
    const m = el("span", cls);
    m.style.background = d().BUCKET_COLOR[bucket] || "#9aa5b1";
    return m;
  };

  function formatUsd(usd) {
    if (!Number.isFinite(usd)) return "";
    if (usd === 0) return "$0";
    if (usd < 0.01) return `$${usd.toFixed(4)}`;
    if (usd < 1) return `$${usd.toFixed(3)}`;
    return `$${usd.toFixed(2)}`;
  }

  // ------------------------------------------------------------ level 2

  function renderSummary(result, ctx) {
    const D = d();
    const frag = document.createDocumentFragment();
    const a = result.assessment || {};
    const st = D.status(result);
    const n = D.counts(result);

    const head = el("div", "head");
    head.append(el("h2", "", "Fact It"), closeButton(ctx));
    frag.append(head);

    frag.append(section("Status"));
    const status = el("div", "status");
    const dot = el("span", "dot");
    dot.style.background = n.total ? st.color : "#9aa5b1";
    status.append(dot, el("div", "word", n.total ? `${st.label}${st.code === "NO_SIGNIFICANT_CONCERNS" ? " detected" : ""}` : "No verifiable claims found"));
    frag.append(status);
    frag.append(el("p", "small", n.total ? st.meaning : "The analyzed content did not contain claims Fact It could inspect."));
    if (a.rationale) frag.append(el("p", "muted small", a.rationale));
    frag.append(el("p", "muted small", `Analysis confidence: ${D.pct(a.confidence)} (${D.confidenceWord(a.confidence)})`));

    if (n.total) {
      const counters = el("div", "counters");
      const counter = (num, label, color) => {
        const c = el("div", "counter");
        const nn = el("div", "n", String(num));
        nn.style.color = color;
        c.append(nn, el("div", "l", label));
        return c;
      };
      counters.append(
        counter(n.total, "claims analyzed", "#f5f7fa"),
        counter(n.significant, "significant concerns", n.significant ? "#ef4444" : "#9aa5b1"),
        counter(n.observations, "observations", n.observations ? "#f59e0b" : "#9aa5b1"),
        counter(n.contradictions, "contradictions", n.contradictions ? "#ef4444" : "#9aa5b1"),
      );
      frag.append(counters);
    }

    const level = el("div", "level");
    level.append(el("strong", "", "AI PRELIMINARY · NO EXTERNAL VERIFICATION PERFORMED"));
    level.append(el("p", "small", "This analysis evaluates the content and evidence presented by the article. External sources were not independently verified. That is metadata about Fact It, not a concern about the article."));
    frag.append(level);

    frag.append(section("Key findings"));
    const findings = D.keyFindings(result, 4);
    if (!findings.length) {
      frag.append(el("p", "", n.total ? "No significant concerns detected. Claims are internally consistent and, where it matters, attributed." : "Nothing to report."));
    } else {
      const list = el("div");
      for (const f of findings) {
        const row = el("div", "finding");
        const body = el("div");
        body.append(el("div", "lbl", f.label), el("div", "", f.text));
        if (f.note) body.append(el("div", "muted small", f.note));
        row.append(mark(f.kind), body);
        list.append(row);
      }
      frag.append(list);
      if (n.concerns > findings.length) frag.append(el("p", "muted small", `+${n.concerns - findings.length} more in the detailed analysis.`));
    }

    frag.append(section("Source transparency"));
    const tr = D.sourceTransparency(result, ctx.article);
    const ul = el("ul", "transparency");
    for (const it of tr.items) {
      const li = el("li");
      li.append(el("span", it.present ? "yes" : "no", it.present ? "✓" : "–"), el("span", "", it.label));
      ul.append(li);
    }
    frag.append(ul);
    frag.append(el("p", "muted small", "Observable sourcing characteristics of the text. They do not verify the sources and do not rate the publication."));

    const fr = result.framing || {};
    frag.append(section("Possible framing"));
    if (fr.detected) {
      frag.append(el("p", "", `Possible ${D.humanize(fr.type || "OTHER").toLowerCase()} framing · ${fr.strength ? D.humanize(fr.strength) : "strength unknown"} · confidence ${D.pct(fr.confidence)}`));
      if (fr.observations && fr.observations.length) frag.append(el("p", "small muted", fr.observations[0]));
    } else {
      frag.append(el("p", "muted", "No notable framing observed."));
    }
    frag.append(el("p", "muted small", "Framing is reported separately and does not affect the status."));

    const actions = el("div", "actions");
    const viewClaims = el("button", "primary", `Inspect claims (${n.total})`);
    viewClaims.addEventListener("click", () => ctx.showDetail("claims"));
    const detailed = el("button", "primary", "Detailed analysis");
    detailed.addEventListener("click", () => ctx.showDetail("overview"));
    actions.append(viewClaims, detailed);
    if (ctx.onReanalyze) {
      const again = el("button", "secondary", "Re-analyze (uses tokens)");
      again.addEventListener("click", () => ctx.onReanalyze());
      actions.append(again);
    }
    frag.append(actions);
    if (ctx.cached) frag.append(el("p", "muted small", "Shown from local cache · no tokens were used to display this."));
    return frag;
  }

  // ------------------------------------------------------------ level 3

  const TABS = [
    ["overview", "Overview"],
    ["claims", "Claims"],
    ["evidence", "Evidence"],
    ["framing", "Framing"],
    ["about", "About"],
  ];

  function renderDetail(result, ctx, tab) {
    const frag = document.createDocumentFragment();
    const head = el("div", "head");
    const back = el("button", "back", "← Summary");
    back.addEventListener("click", () => ctx.showSummary());
    const title = el("h2", "", "Fact It — Detailed analysis");
    const right = el("div");
    right.append(closeButton(ctx));
    head.append(back, title, right);
    frag.append(head);

    const tabs = el("div", "tabs");
    tabs.setAttribute("role", "tablist");
    for (const [id, label] of TABS) {
      const b = el("button", "tab", label);
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", String(id === tab));
      b.dataset.tab = id;
      b.addEventListener("click", () => ctx.showDetail(id));
      tabs.append(b);
    }
    frag.append(tabs);

    const body = el("div", "tabbody");
    body.dataset.tab = tab;
    switch (tab) {
      case "claims": body.append(renderClaimsTab(result)); break;
      case "evidence": body.append(renderEvidenceTab(result)); break;
      case "framing": body.append(renderFramingTab(result)); break;
      case "about": body.append(renderAboutTab(result, ctx)); break;
      default: body.append(renderOverviewTab(result));
    }
    frag.append(body);
    return frag;
  }

  function legend() {
    const D = d();
    const l = el("div", "legend");
    for (const b of ["ok", "caution", "concern"]) {
      const s = el("span");
      s.append(mark(b, ""), document.createTextNode(D.BUCKET_LABEL[b]));
      s.firstChild.className = "";
      s.firstChild.style.display = "inline-block";
      s.firstChild.style.width = "8px";
      s.firstChild.style.height = "8px";
      s.firstChild.style.borderRadius = "50%";
      s.firstChild.style.marginRight = "4px";
      l.append(s);
    }
    return l;
  }

  function renderOverviewTab(result) {
    const D = d();
    const wrap = el("div");
    const a = result.assessment || {};
    const st = D.status(result);
    const n = D.counts(result);
    const strong = el("p");
    const b = el("strong", "", n.total ? st.label : "No verifiable claims found");
    b.style.color = n.total ? st.color : "#9aa5b1";
    strong.append(b);
    wrap.append(strong);
    if (a.rationale) wrap.append(el("p", "", a.rationale));
    wrap.append(el("p", "muted small", `Analysis confidence ${D.pct(a.confidence)} · AI preliminary · external verification not performed (metadata, not a concern).`));

    wrap.append(section("Summary"));
    wrap.append(el("p", "", result.summary || "No summary provided."));

    const h = D.highlights(result);
    const hl = el("div", "hl");
    const h4c = el("h4", "", `Concerns (${h.concerns.length})`);
    h4c.style.color = h.concerns.length ? "#ef4444" : "#9aa5b1";
    hl.append(h4c);
    if (!h.concerns.length) hl.append(el("p", "muted small", "No concerns were found in the content."));
    else {
      const ul = el("ul");
      for (const it of h.concerns.slice(0, 8)) {
        const li = el("li");
        li.style.borderLeftColor = it.severity === "SIGNIFICANT" ? "#ef4444" : "#f59e0b";
        li.append(el("span", "cat", it.category), document.createTextNode(it.text));
        ul.append(li);
      }
      if (h.concerns.length > 8) ul.append(el("li", "muted small", `+${h.concerns.length - 8} more in Claims`));
      hl.append(ul);
    }
    const h4o = el("h4", "", `Ordinary reporting, no concern (${h.ordinary.length})`);
    h4o.style.color = "#22c55e";
    hl.append(h4o);
    if (!h.ordinary.length) hl.append(el("p", "muted small", "Every claim carries a concern."));
    else {
      const ul = el("ul");
      for (const it of h.ordinary.slice(0, 6)) {
        const li = el("li");
        li.style.borderLeftColor = "#22c55e";
        li.append(el("span", "cat", it.label), document.createTextNode(it.text));
        ul.append(li);
      }
      if (h.ordinary.length > 6) ul.append(el("li", "muted small", `+${h.ordinary.length - 6} more in Claims`));
      hl.append(ul);
    }
    wrap.append(section("Highlights"), hl);
    wrap.append(el("p", "muted small", "\"No concern\" means Fact It found no concrete signal in the content; it is not a statement that the claim is true."));
    return wrap;
  }

  function renderClaimsTab(result) {
    const D = d();
    const wrap = el("div");
    const claims = Array.isArray(result.claims) ? result.claims : [];
    const n = D.counts(result);
    const headline = el("p");
    headline.append(el("strong", "", `Claims (${n.total})`));
    wrap.append(headline, legend());
    if (!claims.length) {
      wrap.append(el("p", "muted", "No verifiable claims were identified."));
      return wrap;
    }
    const order = { concern: 0, caution: 1, ok: 2 };
    const sorted = claims.map((c, i) => ({ c, i, b: D.bucketOf(c, result) })).sort((x, y) => order[x.b] - order[y.b] || x.i - y.i);
    for (const { c, b } of sorted) wrap.append(renderClaim(c, b, result));

    const articleConcerns = Array.isArray(result.concerns) ? result.concerns : [];
    if (articleConcerns.length) {
      wrap.append(section(`Article-level concerns (${articleConcerns.length})`));
      const ul = el("ul", "plain");
      for (const concern of articleConcerns) {
        const refs = concern.claim_ids && concern.claim_ids.length ? ` (${concern.claim_ids.join(", ")})` : "";
        ul.append(el("li", "", `${D.concernLabel(concern.type)}${concern.note ? ": " + concern.note : ""}${refs}`));
      }
      wrap.append(ul);
    }
    return wrap;
  }

  function renderClaim(c, bucket, result) {
    const D = d();
    const item = el("div", "claim");
    item.dataset.claimId = c.id;
    const button = el("button");
    button.setAttribute("aria-expanded", "false");
    const body = el("div");
    body.append(el("div", "reason", D.reasonOf(c, result)), el("div", "", c.text));
    button.append(mark(bucket), body, el("span", "chev", "⌄"));
    const dl = el("dl");
    dl.hidden = true;
    const row = (k, v) => { dl.append(el("dt", "", k), el("dd", "", v)); };
    row("Within the article", D.SUPPORT_LABEL[c.support] || D.humanize(c.support));
    row("Type", c.type === "ALLEGATION" ? "Allegation" : c.type === "OPINION" ? "Opinion" : "Factual claim");
    row("Attribution", D.ATTRIBUTION_LABEL[c.attribution] || D.humanize(c.attribution));
    row("Article evidence", c.evidence || "None shown");
    row("Evidence type", D.EVIDENCE_LABEL[c.evidence_type] || D.humanize(c.evidence_type));
    const codes = D.concernsFor(c, result);
    row("Concerns", codes.length ? codes.map(D.concernLabel).join(" · ") : "None");
    if (c.gap) row("What is missing", c.gap);
    if (c.inference) row("Possible reader inference", c.inference);
    row("External verification", "Not performed (metadata; not a concern)");
    button.addEventListener("click", () => {
      dl.hidden = !dl.hidden;
      button.setAttribute("aria-expanded", String(!dl.hidden));
      button.querySelector(".chev").textContent = dl.hidden ? "⌄" : "⌃";
    });
    item.append(button, dl);
    return item;
  }

  function renderEvidenceTab(result) {
    const D = d();
    const wrap = el("div");
    const profile = D.evidenceProfile(result);
    wrap.append(section("Evidence presented by the article"));
    if (!profile.length) wrap.append(el("p", "muted", "No claims to profile."));
    else {
      const ul = el("ul", "plain");
      for (const p of profile) ul.append(el("li", "", `${p.label}: ${p.count}`));
      wrap.append(ul);
    }
    wrap.append(el("p", "muted small", "These describe the support the article shows, not whether it is true. External verification: not performed."));

    const { rows, total } = D.sideBySide(result);
    wrap.append(section(`Side by side: claims with concerns (${rows.length})`));
    const sbs = el("div", "sbs");
    if (!rows.length) {
      sbs.append(el("p", "muted", total ? "No claim carries a concern, so there is nothing to put side by side. Ordinary reporting is not listed here." : "No claims to compare."));
    }
    for (const r of rows) {
      const row = el("div", "row");
      const badges = el("div");
      const first = el("span", "badge", r.concerns.length ? D.concernLabel(r.concerns[0]) : D.SUPPORT_LABEL[r.support] || D.humanize(r.support));
      first.style.borderColor = D.BUCKET_COLOR[r.bucket];
      badges.append(first);
      if (r.allegation) badges.append(el("span", "badge type", "Allegation"));
      row.append(badges);
      const dl = el("dl");
      const cell = (k, v) => { dl.append(el("dt", "", k), el("dd", "", v)); };
      cell("Article says", r.says);
      cell("Evidence presented", r.evidence ? `${D.EVIDENCE_LABEL[r.evidenceType] || D.humanize(r.evidenceType)} — ${r.evidence}` : D.EVIDENCE_LABEL[r.evidenceType] || "None shown");
      cell("What may be missing", r.gap || "—");
      cell("Possible reader inference", r.inference || "—");
      row.append(dl);
      sbs.append(row);
    }
    wrap.append(sbs);
    wrap.append(el("p", "muted small", "\"Possible reader inference\" is a textual observation about what the passage invites; it is not a claim about the author's intent or about readers."));
    return wrap;
  }

  function renderFramingTab(result) {
    const D = d();
    const wrap = el("div");
    const fr = result.framing || {};
    if (!fr.detected) {
      wrap.append(el("p", "", "No notable framing observed."));
    } else {
      const p = el("p");
      p.append(el("strong", "", `Possible ${D.humanize(fr.type || "OTHER").toLowerCase()} framing`));
      wrap.append(p);
      wrap.append(el("p", "", `${fr.strength ? D.humanize(fr.strength) : "Strength unknown"} · Confidence: ${D.pct(fr.confidence)}`));
      if (fr.observations && fr.observations.length) {
        wrap.append(section("Observed characteristics"));
        const ul = el("ul", "plain");
        for (const o of fr.observations) ul.append(el("li", "", o));
        wrap.append(ul);
      }
    }
    wrap.append(section("What this means"));
    wrap.append(el("p", "small", "Framing describes observable characteristics of the text: which sources are chosen, what is emphasized or ordered first, which counterarguments are absent, which terms carry a charge. It says nothing about the author's or the publication's ideology, and nothing about whether the claims are true."));
    wrap.append(el("p", "muted small", "Framing is reported separately and does not affect the status. A subject being political, commercial or controversial is not framing."));
    return wrap;
  }

  function renderAboutTab(result, ctx) {
    const D = d();
    const wrap = el("div");
    const meta = result.meta || {};
    const dl = el("dl", "kv");
    const row = (k, v) => { dl.append(el("dt", "", k), el("dd", "", v)); };
    row("Status", D.status(result).label);
    row("Verification level", "AI preliminary");
    row("External verification", "Not performed (metadata; never counted as a concern)");
    row("Provider", meta.provider || "unknown");
    row("Model", meta.model || "unknown");
    row("Prompt version", meta.prompt_version || "unknown");
    row("Schema version", result.schema_version || "unknown");
    row("Analyzed", meta.analyzed_at ? new Date(meta.analyzed_at).toLocaleString() : "unknown");
    const u = meta.usage;
    if (u && Number.isFinite(Number(u.input_tokens))) {
      const n = (v) => Number(v || 0).toLocaleString();
      row("Tokens", `${n(u.input_tokens)} input · ${n(u.output_tokens)} output`);
      const cost = ctx.cost;
      row("Estimated cost", cost && Number.isFinite(cost.usd)
        ? `${formatUsd(cost.usd)} (${formatUsd(cost.input_usd)} in + ${formatUsd(cost.output_usd)} out)`
        : "set prices in Fact It settings");
    } else {
      row("Tokens", "not reported by the provider");
    }
    row("Source", ctx.cached ? "local cache" : "this session");
    if (meta.migrated_from) row("Note", `Analyzed with schema ${meta.migrated_from} under the older, verification-centric prompt; shown in the current layout. Re-analyze for the concern-based analysis.`);
    if (meta.truncated_input) row("Note", "The article was cut for length; only the first part was analyzed.");
    if (Array.isArray(meta.validation_issues) && meta.validation_issues.length) row("Note", `${meta.validation_issues.length} item(s) from the model were dropped because they did not match the schema.`);
    wrap.append(section("About this analysis"), dl);
    wrap.append(el("p", "small", "This analysis evaluates the content and evidence presented by the article. External sources were not independently verified. Fact It does not decide what is true; it exposes claims, the support shown for them, gaps and possible framing so you can inspect them."));
    if (ctx.onReanalyze) {
      const actions = el("div", "actions");
      const again = el("button", "secondary", "Re-analyze (uses tokens)");
      again.addEventListener("click", () => ctx.onReanalyze());
      actions.append(again);
      wrap.append(actions);
    }
    return wrap;
  }

  function closeButton(ctx) {
    const close = el("button", "close", "✕");
    close.title = "Close";
    close.setAttribute("aria-label", "Close analysis");
    close.addEventListener("click", () => ctx.close());
    return close;
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
    panel.setAttribute("aria-label", "Fact It analysis");
    panel.hidden = true;
    shadow.append(style, panel);
    const host = shadow.host;
    let result = null;
    let options = {};
    let view = "summary"; // "summary" | "detail"
    let tab = "overview";

    const ctx = {
      get cached() { return Boolean(options.cached); },
      get cost() { return options.cost || null; },
      get article() { return options.article || null; },
      get onReanalyze() { return options.onReanalyze; },
      close: () => api.close(),
      showSummary: () => { view = "summary"; render(); },
      showDetail: (t) => { view = "detail"; tab = TABS.some(([id]) => id === t) ? t : "overview"; render(); },
    };

    function render() {
      if (!result) return;
      panel.replaceChildren(view === "detail" ? renderDetail(result, ctx, tab) : renderSummary(result, ctx));
      host.dataset.factitView = view === "detail" ? `detail:${tab}` : "summary";
      panel.scrollTop = 0;
    }

    const api = {
      element: panel,
      setResult(next, opts = {}) {
        result = next;
        options = opts;
        view = "summary";
        tab = "overview";
        render();
      },
      open(target) {
        if (!result) return;
        if (target === "claims" || target === "detail") { view = "detail"; tab = target === "claims" ? "claims" : tab; render(); }
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
      showDetail: ctx.showDetail,
      showSummary: ctx.showSummary,
    };
    host.dataset.factitPanel = "closed";
    return api;
  }

  root.FactIt = Object.assign(root.FactIt || {}, { createPanel, renderSummary, renderDetail });
})(globalThis);
