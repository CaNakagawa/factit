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
    .panel .tag { display: inline-block; font-size: 10px; font-weight: 700; letter-spacing: .06em; border: 1px solid; border-radius: 3px; padding: 0 5px; margin-right: 6px; white-space: nowrap; }
    .panel .boxes { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 8px 0 10px; }
    .panel .box { border: 1px solid #3e4c59; border-left-width: 3px; border-radius: 4px; padding: 8px; font-size: 12px; box-sizing: border-box; min-width: 0; }
    .panel .box.believe { border-left-color: #f59e0b; }
    .panel .box.says { border-left-color: #7fb3c8; }
    .panel .box h5 { margin: 0 0 5px; font-size: 10px; text-transform: uppercase; letter-spacing: .05em; color: #9aa5b1; font-weight: 700; }
    .panel .box p { margin: 0 0 5px; overflow-wrap: anywhere; }
    .panel .box p:last-child { margin-bottom: 0; }
    .panel .box .k { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: #9aa5b1; }
    .panel .tiny { font-size: 11px; }
    @media (max-width: 520px) { .panel .boxes { grid-template-columns: 1fr; } }
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
  // Interface language (ui/i18n.js); analysis text is never translated.
  const t = (str, vars) => {
    if (root.FactIt && root.FactIt.i18n) return root.FactIt.i18n.t(str, vars);
    return vars ? String(str).replace(/\{(\w+)\}/g, (m, k) => (Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m)) : str;
  };

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

  function tagChip(claim, result) {
    const tag = d().tagOf(claim, result);
    const chip = el("span", "tag", tag.label);
    chip.style.color = tag.color;
    chip.style.borderColor = tag.color;
    chip.title = tag.title;
    return chip;
  }

  /**
   * The two boxes: what the passage leads a reader to believe (left) versus
   * what the text actually states and shows (right). Both are observations
   * about the text, never about the author's intent.
   */
  function twoBoxesEl(claim, result) {
    const tb = d().twoBoxes(claim, result);
    const wrap = el("div", "boxes");
    const left = el("div", "box believe");
    left.append(el("h5", "", t("What it leads you to believe")), el("p", "", tb.believe));
    if (!tb.fromInference) left.append(el("p", "muted tiny", t("This is the claim as the article puts it; nothing further is implied.")));
    const right = el("div", "box says");
    right.append(el("h5", "", t("What it actually says")));
    for (const line of tb.says) {
      const p = el("p");
      p.append(el("span", "k", line.key), document.createTextNode(line.text));
      right.append(p);
    }
    wrap.append(left, right);
    return wrap;
  }

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
    head.append(el("h2", "", t("Fact It")), closeButton(ctx));
    frag.append(head);

    frag.append(section(t("Status")));
    const status = el("div", "status");
    const dot = el("span", "dot");
    dot.style.background = n.total ? st.color : "#9aa5b1";
    status.append(dot, el("div", "word", n.total
      ? (st.code === "NO_SIGNIFICANT_CONCERNS" ? t("{label} detected", { label: st.label }) : st.label)
      : t("No verifiable claims found")));
    frag.append(status);
    frag.append(el("p", "small", n.total ? st.meaning : t("The analyzed content did not contain claims Fact It could inspect.")));
    if (a.rationale) frag.append(el("p", "muted small", a.rationale));
    frag.append(el("p", "muted small", t("Analysis confidence: {pct} ({word})", { pct: D.pct(a.confidence), word: D.confidenceWord(a.confidence) })));

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
        counter(n.total, t("claims analyzed"), "#f5f7fa"),
        counter(n.significant, t("significant concerns"), n.significant ? "#ef4444" : "#9aa5b1"),
        counter(n.observations, t("observations"), n.observations ? "#f59e0b" : "#9aa5b1"),
        counter(n.contradictions, t("contradictions"), n.contradictions ? "#ef4444" : "#9aa5b1"),
      );
      frag.append(counters);
    }

    const level = el("div", "level");
    level.append(el("strong", "", t("AI PRELIMINARY · NO EXTERNAL VERIFICATION PERFORMED")));
    level.append(el("p", "small", t("This analysis evaluates the content and evidence presented by the article. External sources were not independently verified. That is metadata about Fact It, not a concern about the article.")));
    frag.append(level);

    frag.append(section(t("Key findings")));
    const findings = D.keyFindings(result, 4);
    if (!findings.length) {
      frag.append(el("p", "", n.total ? t("No significant concerns detected. Claims are internally consistent and, where it matters, attributed.") : t("Nothing to report.")));
    } else {
      const list = el("div");
      for (const f of findings) {
        const row = el("div", "finding");
        const body = el("div");
        const lbl = el("div", "lbl");
        if (f.claim) lbl.append(tagChip(f.claim, result));
        lbl.append(document.createTextNode(f.label));
        body.append(lbl, el("div", "", f.text));
        if (f.note) body.append(el("div", "muted small", f.note));
        row.append(mark(f.kind), body);
        list.append(row);
      }
      frag.append(list);
      if (n.concerns > findings.length) frag.append(el("p", "muted small", t("+{n} more in the detailed analysis.", { n: n.concerns - findings.length })));
    }

    frag.append(section(t("Source transparency")));
    const tr = D.sourceTransparency(result, ctx.article);
    const ul = el("ul", "transparency");
    for (const it of tr.items) {
      const li = el("li");
      li.append(el("span", it.present ? "yes" : "no", it.present ? "✓" : "–"), el("span", "", it.label));
      ul.append(li);
    }
    frag.append(ul);
    frag.append(el("p", "muted small", t("Observable sourcing characteristics of the text. They do not verify the sources and do not rate the publication.")));

    const fr = result.framing || {};
    frag.append(section(t("Possible framing")));
    if (fr.detected) {
      frag.append(el("p", "", t("Possible {type} framing · {strength} · confidence {pct}", {
        type: t(D.humanize(fr.type || "OTHER")).toLowerCase(),
        strength: fr.strength ? t(D.humanize(fr.strength)) : t("Strength unknown"),
        pct: D.pct(fr.confidence),
      })));
      if (fr.observations && fr.observations.length) frag.append(el("p", "small muted", fr.observations[0]));
    } else {
      frag.append(el("p", "muted", t("No notable framing observed.")));
    }
    frag.append(el("p", "muted small", t("Framing is reported separately and does not affect the status.")));

    const actions = el("div", "actions");
    const viewClaims = el("button", "primary", t("Inspect claims ({n})", { n: n.total }));
    viewClaims.addEventListener("click", () => ctx.showDetail("claims"));
    const detailed = el("button", "primary", t("Detailed analysis"));
    detailed.addEventListener("click", () => ctx.showDetail("overview"));
    actions.append(viewClaims, detailed);
    if (ctx.onReanalyze) {
      const again = el("button", "secondary", t("Re-analyze (uses tokens)"));
      again.addEventListener("click", () => ctx.onReanalyze());
      actions.append(again);
    }
    frag.append(actions);
    if (ctx.cached) frag.append(el("p", "muted small", t("Shown from local cache · no tokens were used to display this.")));
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
    const back = el("button", "back", t("← Summary"));
    back.addEventListener("click", () => ctx.showSummary());
    const title = el("h2", "", t("Fact It — Detailed analysis"));
    const right = el("div");
    right.append(closeButton(ctx));
    head.append(back, title, right);
    frag.append(head);

    const tabs = el("div", "tabs");
    tabs.setAttribute("role", "tablist");
    for (const [id, label] of TABS) {
      const b = el("button", "tab", t(label));
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
      s.append(mark(b, ""), document.createTextNode(D.bucketLabel(b)));
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
    const b = el("strong", "", n.total ? st.label : t("No verifiable claims found"));
    b.style.color = n.total ? st.color : "#9aa5b1";
    strong.append(b);
    wrap.append(strong);
    if (a.rationale) wrap.append(el("p", "", a.rationale));
    wrap.append(el("p", "muted small", t("Analysis confidence {pct} · AI preliminary · external verification not performed (metadata, not a concern).", { pct: D.pct(a.confidence) })));

    wrap.append(section(t("Summary")));
    wrap.append(el("p", "", result.summary || t("No summary provided.")));

    const h = D.highlights(result);
    const hl = el("div", "hl");
    const h4c = el("h4", "", t("Concerns ({n})", { n: h.concerns.length }));
    h4c.style.color = h.concerns.length ? "#ef4444" : "#9aa5b1";
    hl.append(h4c);
    if (!h.concerns.length) hl.append(el("p", "muted small", t("No concerns were found in the content.")));
    else {
      const ul = el("ul");
      for (const it of h.concerns.slice(0, 8)) {
        const li = el("li");
        li.style.borderLeftColor = it.severity === "SIGNIFICANT" ? "#ef4444" : "#f59e0b";
        li.append(el("span", "cat", it.category), document.createTextNode(it.text));
        ul.append(li);
      }
      if (h.concerns.length > 8) ul.append(el("li", "muted small", t("+{n} more in Claims", { n: h.concerns.length - 8 })));
      hl.append(ul);
    }
    const h4o = el("h4", "", t("Ordinary reporting, no concern ({n})", { n: h.ordinary.length }));
    h4o.style.color = "#22c55e";
    hl.append(h4o);
    if (!h.ordinary.length) hl.append(el("p", "muted small", t("Every claim carries a concern.")));
    else {
      const ul = el("ul");
      for (const it of h.ordinary.slice(0, 6)) {
        const li = el("li");
        li.style.borderLeftColor = "#22c55e";
        li.append(el("span", "cat", it.label), document.createTextNode(it.text));
        ul.append(li);
      }
      if (h.ordinary.length > 6) ul.append(el("li", "muted small", t("+{n} more in Claims", { n: h.ordinary.length - 6 })));
      hl.append(ul);
    }
    wrap.append(section(t("Highlights")), hl);
    wrap.append(el("p", "muted small", t("\"No concern\" means Fact It found no concrete signal in the content; it is not a statement that the claim is true.")));
    return wrap;
  }

  function renderClaimsTab(result) {
    const D = d();
    const wrap = el("div");
    const claims = Array.isArray(result.claims) ? result.claims : [];
    const n = D.counts(result);
    const headline = el("p");
    headline.append(el("strong", "", t("Claims ({n})", { n: n.total })));
    wrap.append(headline, legend());
    if (!claims.length) {
      wrap.append(el("p", "muted", t("No verifiable claims were identified.")));
      return wrap;
    }
    const order = { concern: 0, caution: 1, ok: 2 };
    const sorted = claims.map((c, i) => ({ c, i, b: D.bucketOf(c, result) })).sort((x, y) => order[x.b] - order[y.b] || x.i - y.i);
    for (const { c, b } of sorted) wrap.append(renderClaim(c, b, result));

    const articleConcerns = Array.isArray(result.concerns) ? result.concerns : [];
    if (articleConcerns.length) {
      wrap.append(section(t("Article-level concerns ({n})", { n: articleConcerns.length })));
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
    const head = el("div", "reason");
    head.append(tagChip(c, result), document.createTextNode(D.reasonOf(c, result)));
    body.append(head, el("div", "", c.text));
    button.append(mark(bucket), body, el("span", "chev", "⌄"));
    const boxes = twoBoxesEl(c, result);
    boxes.hidden = true;
    const dl = el("dl");
    dl.hidden = true;
    const row = (k, v) => { dl.append(el("dt", "", k), el("dd", "", v)); };
    row(t("Within the article"), D.supportLabel(c.support));
    row(t("Type"), c.type === "ALLEGATION" ? t("Allegation") : c.type === "OPINION" ? t("Opinion") : t("Factual claim"));
    row(t("Attribution"), D.attributionLabel(c.attribution));
    row(t("Article evidence"), c.evidence || t("None shown"));
    row(t("Evidence type"), D.evidenceLabel(c.evidence_type));
    const codes = D.concernsFor(c, result);
    row(t("Concerns"), codes.length ? codes.map(D.concernLabel).join(" · ") : t("None"));
    if (c.gap) row(t("What is missing"), c.gap);
    if (c.inference) row(t("Possible reader inference"), c.inference);
    row(t("External verification"), t("Not performed (metadata; not a concern)"));
    button.addEventListener("click", () => {
      dl.hidden = !dl.hidden;
      boxes.hidden = dl.hidden;
      button.setAttribute("aria-expanded", String(!dl.hidden));
      button.querySelector(".chev").textContent = dl.hidden ? "⌄" : "⌃";
    });
    item.append(button, boxes, dl);
    return item;
  }

  function renderEvidenceTab(result) {
    const D = d();
    const wrap = el("div");
    const profile = D.evidenceProfile(result);
    wrap.append(section(t("Evidence presented by the article")));
    if (!profile.length) wrap.append(el("p", "muted", t("No claims to profile.")));
    else {
      const ul = el("ul", "plain");
      for (const p of profile) ul.append(el("li", "", `${p.label}: ${p.count}`));
      wrap.append(ul);
    }
    wrap.append(el("p", "muted small", t("These describe the support the article shows, not whether it is true. External verification: not performed.")));

    const { rows, total } = D.sideBySide(result);
    wrap.append(section(t("Side by side: claims with concerns ({n})", { n: rows.length })));
    const sbs = el("div", "sbs");
    if (!rows.length) {
      sbs.append(el("p", "muted", total ? t("No claim carries a concern, so there is nothing to put side by side. Ordinary reporting is not listed here.") : t("No claims to compare.")));
    }
    const claims = Array.isArray(result.claims) ? result.claims : [];
    for (const r of rows) {
      const claim = claims.find((c) => c.id === r.id);
      if (!claim) continue;
      const row = el("div", "row");
      const badges = el("div");
      badges.append(tagChip(claim, result));
      badges.append(el("span", "badge", r.concerns.length ? D.concernLabel(r.concerns[0]) : D.supportLabel(r.support)));
      badges.lastChild.style.borderColor = D.BUCKET_COLOR[r.bucket];
      if (r.allegation) badges.append(el("span", "badge type", t("Allegation")));
      row.append(badges, twoBoxesEl(claim, result));
      sbs.append(row);
    }
    wrap.append(sbs);
    wrap.append(el("p", "muted small", t("The left box is what the passage invites a reader to take away; the right box is what the text states and shows. Both are observations about the text, not claims about the author's intent or about readers.")));
    return wrap;
  }

  function renderFramingTab(result) {
    const D = d();
    const wrap = el("div");
    const fr = result.framing || {};
    if (!fr.detected) {
      wrap.append(el("p", "", t("No notable framing observed.")));
    } else {
      const p = el("p");
      p.append(el("strong", "", t("Possible {type} framing", { type: t(D.humanize(fr.type || "OTHER")).toLowerCase() })));
      wrap.append(p);
      wrap.append(el("p", "", t("{strength} · Confidence: {pct}", { strength: fr.strength ? t(D.humanize(fr.strength)) : t("Strength unknown"), pct: D.pct(fr.confidence) })));
      if (fr.observations && fr.observations.length) {
        wrap.append(section(t("Observed characteristics")));
        const ul = el("ul", "plain");
        for (const o of fr.observations) ul.append(el("li", "", o));
        wrap.append(ul);
      }
    }
    wrap.append(section(t("What this means")));
    wrap.append(el("p", "small", t("Framing describes observable characteristics of the text: which sources are chosen, what is emphasized or ordered first, which counterarguments are absent, which terms carry a charge. It says nothing about the author's or the publication's ideology, and nothing about whether the claims are true.")));
    wrap.append(el("p", "muted small", t("Framing is reported separately and does not affect the status. A subject being political, commercial or controversial is not framing.")));
    return wrap;
  }

  function renderAboutTab(result, ctx) {
    const D = d();
    const wrap = el("div");
    const meta = result.meta || {};
    const dl = el("dl", "kv");
    const row = (k, v) => { dl.append(el("dt", "", k), el("dd", "", v)); };
    row(t("Status"), D.status(result).label);
    row(t("Verification level"), t("AI preliminary"));
    row(t("External verification"), t("Not performed (metadata; never counted as a concern)"));
    row(t("Provider"), meta.provider || t("unknown"));
    row(t("Model"), meta.model || t("unknown"));
    row(t("Prompt version"), meta.prompt_version || t("unknown"));
    row(t("Schema version"), result.schema_version || t("unknown"));
    row(t("Analyzed"), meta.analyzed_at ? new Date(meta.analyzed_at).toLocaleString() : t("unknown"));
    const u = meta.usage;
    if (u && Number.isFinite(Number(u.input_tokens))) {
      const n = (v) => Number(v || 0).toLocaleString();
      row(t("Tokens"), t("{input} input · {output} output", { input: n(u.input_tokens), output: n(u.output_tokens) }));
      const cost = ctx.cost;
      row(t("Estimated cost"), cost && Number.isFinite(cost.usd)
        ? `${formatUsd(cost.usd)} (${formatUsd(cost.input_usd)} in + ${formatUsd(cost.output_usd)} out)`
        : t("set prices in Fact It settings"));
    } else {
      row(t("Tokens"), t("not reported by the provider"));
    }
    row(t("Source"), ctx.cached ? t("local cache") : t("this session"));
    if (meta.migrated_from) row(t("Note"), t("Analyzed with schema {version} under the older, verification-centric prompt; shown in the current layout. Re-analyze for the concern-based analysis.", { version: meta.migrated_from }));
    if (meta.truncated_input) row(t("Note"), t("The article was cut for length; only the first part was analyzed."));
    if (Array.isArray(meta.validation_issues) && meta.validation_issues.length) row(t("Note"), t("{n} item(s) from the model were dropped because they did not match the schema.", { n: meta.validation_issues.length }));
    wrap.append(section(t("About this analysis")), dl);
    wrap.append(el("p", "small", t("This analysis evaluates the content and evidence presented by the article. External sources were not independently verified. Fact It does not decide what is true; it exposes claims, the support shown for them, gaps and possible framing so you can inspect them.")));
    if (ctx.onReanalyze) {
      const actions = el("div", "actions");
      const again = el("button", "secondary", t("Re-analyze (uses tokens)"));
      again.addEventListener("click", () => ctx.onReanalyze());
      actions.append(again);
      wrap.append(actions);
    }
    return wrap;
  }

  function closeButton(ctx) {
    const close = el("button", "close", "✕");
    close.title = t("Close");
    close.setAttribute("aria-label", t("Close analysis"));
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
