// Fact It - view derivation (schema 2.1, concern detection).
//
// Classic script; exposes FactIt.derive. Pure functions that turn one
// validated AnalysisResult into everything the bar, the summary panel and
// the detailed analysis show. Nothing here comes from the model beyond
// the records themselves, so every view stays consistent and no extra
// tokens are spent on presentation.
//
// Rules (ADR-008):
// - The overall status comes from concerns only.
// - External verification status is metadata; it never counts as a
//   concern, never colors anything, never increments a counter.
// - "Supported" always means supported WITHIN THE ARTICLE.

(function (root) {
  const STATUS_LABEL = {
    NO_SIGNIFICANT_CONCERNS: "No significant concerns",
    REVIEW_RECOMMENDED: "Review recommended",
    SIGNIFICANT_CONCERNS: "Significant concerns",
  };
  const STATUS_MEANING = {
    NO_SIGNIFICANT_CONCERNS: "No significant misleading or problematic signals were detected in the analyzed content. This is not a statement that the article is true.",
    REVIEW_RECOMMENDED: "There are concrete reasons for caution in the analyzed content. Review the concerns below.",
    SIGNIFICANT_CONCERNS: "The analyzed content conflicts with itself or with what it presents. Review the concerns below before relying on it.",
  };
  const STATUS_COLOR = {
    NO_SIGNIFICANT_CONCERNS: "#22c55e",
    REVIEW_RECOMMENDED: "#f59e0b",
    SIGNIFICANT_CONCERNS: "#ef4444",
  };

  const SUPPORT_LABEL = {
    ARTICLE_SUPPORTED: "Supported within article",
    PARTIALLY_ARTICLE_SUPPORTED: "Partially supported within article",
    ATTRIBUTED: "Attributed reporting",
    ALLEGATION_REPORTED: "Allegation reported, attributed",
    UNSUPPORTED_WITHIN_ARTICLE: "Unsupported within article",
    INTERNALLY_CONTRADICTED: "Contradicted within article",
    UNCLEAR: "Unclear from the article",
  };

  const ATTRIBUTION_LABEL = { CLEAR: "Clear", UNCLEAR: "Unclear", NONE: "None" };

  const EVIDENCE_LABEL = {
    PRIMARY_DOCUMENT: "Primary document",
    OFFICIAL_RECORD: "Official record",
    NAMED_SOURCE: "Named source",
    DIRECT_QUOTE: "Direct quote",
    SECONDARY_SOURCE: "Secondary source",
    ANONYMOUS_SOURCE: "Anonymous source",
    UNIDENTIFIED_REPORT: "Unidentified report",
    ARTICLE_ASSERTION: "Article's own assertion",
    NO_EVIDENCE_SHOWN: "No evidence shown",
    UNKNOWN: "Not stated",
  };

  const CONCERN_LABEL = {
    HEADLINE_CONTRADICTS_BODY: "Headline contradicts body",
    INTERNAL_CONTRADICTION: "Internal contradiction",
    NUMERICAL_INCONSISTENCY: "Numbers do not add up",
    UNSUPPORTED_SERIOUS_ALLEGATION: "Serious allegation presented as fact",
    SOURCE_CLAIM_MISMATCH: "Source does not support the claim",
    CONCLUSION_CONFLICTS_WITH_EVIDENCE: "Conclusion conflicts with evidence",
    INVALID_CITATION: "Invalid citation",
    HEADLINE_OVERSTATEMENT: "Headline overstates the body",
    AMBIGUOUS_ATTRIBUTION: "Ambiguous attribution",
    MISLEADING_STATISTIC: "Questionable statistic",
    MATERIAL_MISSING_CONTEXT: "Material context missing",
    OPINION_PRESENTED_AS_FACT: "Opinion presented as fact",
    SELECTIVE_EVIDENCE: "Selective evidence",
    EXTRAORDINARY_CLAIM_UNSUPPORTED: "Extraordinary claim without support",
    OUTDATED_INFORMATION: "Possibly outdated",
    MISLEADING_FRAMING: "Potentially misleading framing",
  };

  const SIGNIFICANT = new Set([
    "HEADLINE_CONTRADICTS_BODY", "INTERNAL_CONTRADICTION", "NUMERICAL_INCONSISTENCY", "UNSUPPORTED_SERIOUS_ALLEGATION",
    "SOURCE_CLAIM_MISMATCH", "CONCLUSION_CONFLICTS_WITH_EVIDENCE", "INVALID_CITATION",
  ]);
  const CONTRADICTIONS = new Set(["HEADLINE_CONTRADICTS_BODY", "INTERNAL_CONTRADICTION", "NUMERICAL_INCONSISTENCY", "CONCLUSION_CONFLICTS_WITH_EVIDENCE"]);

  // Claim buckets. "ok" is the normal case: ordinary attributed or supported
  // reporting with nothing wrong. Only claims that carry a concern are
  // colored.
  const BUCKET = { CONCERN: "concern", CAUTION: "caution", OK: "ok" };
  const BUCKET_LABEL = { concern: "Significant concern", caution: "Concern", ok: "No concern" };
  const BUCKET_COLOR = { concern: "#ef4444", caution: "#f59e0b", ok: "#22c55e" };

  const severityOf = (code) => (SIGNIFICANT.has(code) ? "SIGNIFICANT" : "MODERATE");

  function humanize(code) {
    if (typeof code !== "string" || code === "") return "";
    const s = code.toLowerCase().replace(/_/g, " ");
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  const pct = (n) => `${Math.round((Number(n) || 0) * 100)}%`;
  const concernLabel = (code) => CONCERN_LABEL[code] || humanize(code);

  function confidenceWord(confidence) {
    if (confidence >= 0.7) return "high";
    if (confidence >= 0.4) return "moderate";
    return "low";
  }

  // All concern codes that touch a claim: its own plus article-level ones
  // that reference it.
  function concernsFor(claim, result) {
    const own = Array.isArray(claim.concerns) ? claim.concerns : [];
    const referenced = (Array.isArray(result && result.concerns) ? result.concerns : [])
      .filter((c) => Array.isArray(c.claim_ids) && c.claim_ids.includes(claim.id))
      .map((c) => c.type);
    return [...new Set([...own, ...referenced])];
  }

  function bucketOf(claim, result) {
    const codes = concernsFor(claim, result);
    if (codes.some((c) => SIGNIFICANT.has(c)) || claim.support === "INTERNALLY_CONTRADICTED") return BUCKET.CONCERN;
    if (codes.length > 0 || claim.support === "UNSUPPORTED_WITHIN_ARTICLE") return BUCKET.CAUTION;
    return BUCKET.OK;
  }

  // Short reason next to a claim: the concern if any, else its status.
  function reasonOf(claim, result) {
    const codes = concernsFor(claim, result);
    if (codes.length) return concernLabel(codes.sort((a, b) => (SIGNIFICANT.has(b) ? 1 : 0) - (SIGNIFICANT.has(a) ? 1 : 0))[0]);
    return SUPPORT_LABEL[claim.support] || humanize(claim.support);
  }

  /** Status and its presentation. */
  function status(result) {
    const s = (result.assessment && result.assessment.status) || "NO_SIGNIFICANT_CONCERNS";
    return { code: s, label: STATUS_LABEL[s] || humanize(s), meaning: STATUS_MEANING[s] || "", color: STATUS_COLOR[s] || "#9aa5b1" };
  }

  /** Every concern, article-level and claim-level, as one flat list. */
  function allConcerns(result) {
    const claims = Array.isArray(result.claims) ? result.claims : [];
    const out = [];
    for (const c of Array.isArray(result.concerns) ? result.concerns : []) {
      out.push({ type: c.type, severity: c.severity || severityOf(c.type), label: concernLabel(c.type), note: c.note || "", claim_ids: c.claim_ids || [], claim: null });
    }
    for (const cl of claims) {
      for (const code of Array.isArray(cl.concerns) ? cl.concerns : []) {
        // Skip codes already listed at article level for this claim.
        if (out.some((o) => o.type === code && o.claim_ids.includes(cl.id))) continue;
        out.push({ type: code, severity: severityOf(code), label: concernLabel(code), note: cl.gap || "", claim_ids: [cl.id], claim: cl });
      }
    }
    return out.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "SIGNIFICANT" ? -1 : 1));
  }

  /** Counters for the summary and the banner. */
  function counts(result) {
    const claims = Array.isArray(result.claims) ? result.claims : [];
    const concerns = allConcerns(result);
    const significant = concerns.filter((c) => c.severity === "SIGNIFICANT").length;
    const contradictions = concerns.filter((c) => CONTRADICTIONS.has(c.type)).length +
      claims.filter((c) => c.support === "INTERNALLY_CONTRADICTED" && !concernsFor(c, result).some((x) => CONTRADICTIONS.has(x))).length;
    return {
      total: claims.length,
      concerns: concerns.length,
      significant,
      observations: concerns.length - significant, // moderate concerns
      contradictions,
      ok: claims.filter((c) => bucketOf(c, result) === BUCKET.OK).length,
      flagged: claims.filter((c) => bucketOf(c, result) !== BUCKET.OK).length,
    };
  }

  /** Banner text: status, plus a count only when there is something to count. */
  function bannerText(result) {
    const s = status(result);
    const n = counts(result);
    if (s.code === "NO_SIGNIFICANT_CONCERNS") return { label: s.label, detail: "" };
    if (s.code === "REVIEW_RECOMMENDED") return { label: s.label, detail: `${n.concerns} concern${n.concerns === 1 ? "" : "s"}` };
    return { label: s.label, detail: `${n.concerns} issue${n.concerns === 1 ? "" : "s"}` };
  }

  /**
   * Key findings for the summary: concerns first (significant before
   * moderate), each with the claim text when it refers to one. When there
   * are none, the caller shows the "no significant concerns" line.
   */
  function keyFindings(result, limit = 4) {
    const claims = Array.isArray(result.claims) ? result.claims : [];
    return allConcerns(result).slice(0, limit).map((c) => {
      const claim = c.claim || claims.find((cl) => c.claim_ids.includes(cl.id)) || null;
      return { kind: c.severity === "SIGNIFICANT" ? BUCKET.CONCERN : BUCKET.CAUTION, label: c.label, text: claim ? claim.text : c.note, note: claim ? c.note : "", claim };
    });
  }

  /** Observable sourcing characteristics; never reputation. */
  function sourceTransparency(result, article) {
    const st = result.source_transparency || {};
    const claims = Array.isArray(result.claims) ? result.claims : [];
    const attributedClaims = claims.filter((c) => c.attribution === "CLEAR").length;
    const evidenceTypes = new Set(claims.map((c) => c.evidence_type));
    const items = [];
    const add = (present, label) => items.push({ present: Boolean(present), label });
    add(article && article.author, "Named author");
    add(article && article.published_at, "Publication date");
    add(st.named_sources || attributedClaims > 0, "Named sources for important claims");
    add(st.primary_references || evidenceTypes.has("PRIMARY_DOCUMENT") || evidenceTypes.has("OFFICIAL_RECORD"), "Primary references (advisories, filings, studies)");
    add(st.direct_quotes || evidenceTypes.has("DIRECT_QUOTE"), "Direct quotations");
    return { items, attributedClaims, total: claims.length };
  }

  /**
   * Highlights for the Overview tab: what carries a concern vs. what is
   * ordinary attributed or supported reporting.
   */
  function highlights(result) {
    const claims = Array.isArray(result.claims) ? result.claims : [];
    const concerns = allConcerns(result).map((c) => ({ text: c.claim ? c.claim.text : c.note, category: c.label, severity: c.severity, claim: c.claim }));
    const ordinary = claims.filter((c) => bucketOf(c, result) === BUCKET.OK).map((c) => ({ text: c.text, label: SUPPORT_LABEL[c.support], claim: c }));
    return { concerns, ordinary };
  }

  /**
   * Side-by-side rows: only claims that carry a concern or a stated gap /
   * inference. Ordinary reporting does not appear here.
   */
  function sideBySide(result) {
    const claims = Array.isArray(result.claims) ? result.claims : [];
    const rows = claims
      .filter((c) => concernsFor(c, result).length || c.gap || c.inference)
      .map((c) => ({
        id: c.id,
        says: c.text,
        allegation: c.type === "ALLEGATION",
        support: c.support,
        evidenceType: c.evidence_type,
        evidence: c.evidence || "",
        gap: c.gap || "",
        inference: c.inference || "",
        concerns: concernsFor(c, result),
        bucket: bucketOf(c, result),
      }))
      .sort((a, b) => (a.bucket === b.bucket ? 0 : a.bucket === BUCKET.CONCERN ? -1 : 1));
    return { rows, total: claims.length };
  }

  /** Evidence-type distribution for the Evidence tab. */
  function evidenceProfile(result) {
    const claims = Array.isArray(result.claims) ? result.claims : [];
    const byType = {};
    for (const c of claims) byType[c.evidence_type] = (byType[c.evidence_type] || 0) + 1;
    return Object.entries(byType)
      .sort((a, b) => b[1] - a[1])
      .map(([type, n]) => ({ type, label: EVIDENCE_LABEL[type] || humanize(type), count: n }));
  }

  root.FactIt = Object.assign(root.FactIt || {}, {
    derive: {
      STATUS_LABEL, STATUS_MEANING, STATUS_COLOR, SUPPORT_LABEL, ATTRIBUTION_LABEL, EVIDENCE_LABEL, CONCERN_LABEL,
      BUCKET, BUCKET_LABEL, BUCKET_COLOR,
      humanize, pct, confidenceWord, concernLabel, severityOf,
      concernsFor, bucketOf, reasonOf, status, allConcerns, counts, bannerText, keyFindings,
      sourceTransparency, highlights, sideBySide, evidenceProfile,
    },
  });
})(globalThis);
