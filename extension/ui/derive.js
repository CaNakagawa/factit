// Fact It - view derivation (schema 2.0).
//
// Classic script; exposes FactIt.derive. Pure functions that turn one
// validated AnalysisResult into everything the bar, the summary panel and
// the detailed analysis show. Nothing here comes from the model beyond
// the claim records themselves, so every view stays consistent and no
// extra tokens are spent on presentation.
//
// Vocabulary rule: "supported" always means supported WITHIN THE ARTICLE.
// Nothing in V1 is externally verified, and the labels say so.

(function (root) {
  const SUPPORT_LABEL = {
    ARTICLE_SUPPORTED: "Supported within article",
    PARTIALLY_ARTICLE_SUPPORTED: "Partially supported within article",
    ATTRIBUTED: "Attributed to a source",
    EVIDENCE_GAP: "Evidence not shown",
    UNVERIFIED: "Not verifiable from the article",
    INSUFFICIENT_EVIDENCE: "Insufficient evidence",
    CONTRADICTED_IN_ARTICLE: "Contradicted within article",
    MISLEADING_PRESENTATION: "Misleading presentation",
  };

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

  const ISSUE_LABEL = {
    MISSING_CONTEXT: "Missing context",
    UNSUPPORTED_ACCUSATION: "Unsupported accusation",
    OUTDATED_INFORMATION: "Possibly outdated",
    STATISTICAL_MISREPRESENTATION: "Statistics misrepresented",
    HEADLINE_CONTENT_MISMATCH: "Headline does not match content",
    UNATTRIBUTED_CLAIM: "Unattributed claim",
    WEAK_SOURCE: "Weak source",
    CONTRADICTORY_STATEMENTS: "Contradictory statements",
    OPINION_PRESENTED_AS_FACT: "Opinion presented as fact",
    SELECTIVE_EVIDENCE: "Selective evidence",
    UNKNOWN_SOURCE: "Unknown source",
    EXTERNAL_VERIFICATION_REQUIRED: "Needs external verification",
  };

  // Three buckets, chosen by priority: a claim with a problem is an issue
  // even if it is also attributed; a claim needing verification is not
  // "supported" even if partially backed.
  const ISSUE_SUPPORT = new Set(["EVIDENCE_GAP", "INSUFFICIENT_EVIDENCE", "CONTRADICTED_IN_ARTICLE", "MISLEADING_PRESENTATION"]);
  const VERIFY_SUPPORT = new Set(["ATTRIBUTED", "UNVERIFIED"]);
  const SUPPORTED_SUPPORT = new Set(["ARTICLE_SUPPORTED", "PARTIALLY_ARTICLE_SUPPORTED"]);

  const BUCKET = {
    SUPPORTED: "supported", // green: supported within the article
    VERIFY: "verify", // amber: needs external verification
    ISSUE: "issue", // red: evidence or context issue
  };
  const BUCKET_LABEL = {
    supported: "Supported within article",
    verify: "Needs verification",
    issue: "Evidence / context issue",
  };
  const BUCKET_COLOR = { supported: "#22c55e", verify: "#f59e0b", issue: "#ef4444" };

  // Color for the article-support meter. Same thresholds as supportWord so
  // the color and the wording never disagree. Driven by article support
  // only; framing and confidence never change it.
  function supportColor(score) {
    if (score >= 0.75) return "#3b82f6";
    if (score >= 0.5) return "#f59e0b";
    if (score >= 0.25) return "#f97316";
    return "#ef4444";
  }

  function supportWord(score) {
    if (score >= 0.75) return "Well supported within article";
    if (score >= 0.5) return "Partially supported within article";
    if (score >= 0.25) return "Weakly supported within article";
    return "Little support within article";
  }

  function confidenceWord(confidence) {
    if (confidence >= 0.7) return "high";
    if (confidence >= 0.4) return "moderate";
    return "low";
  }

  function humanize(code) {
    if (typeof code !== "string" || code === "") return "";
    const s = code.toLowerCase().replace(/_/g, " ");
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  const pct = (n) => `${Math.round((Number(n) || 0) * 100)}%`;

  function needsExternal(claim) {
    const issues = Array.isArray(claim.issues) ? claim.issues : [];
    return claim.external_verification_required === true || issues.includes("EXTERNAL_VERIFICATION_REQUIRED");
  }

  function bucketOf(claim) {
    const issues = Array.isArray(claim.issues) ? claim.issues : [];
    const structural = issues.filter((i) => i !== "EXTERNAL_VERIFICATION_REQUIRED");
    if (ISSUE_SUPPORT.has(claim.support) || structural.length > 0) return BUCKET.ISSUE;
    if (VERIFY_SUPPORT.has(claim.support) || needsExternal(claim)) return BUCKET.VERIFY;
    if (SUPPORTED_SUPPORT.has(claim.support)) return BUCKET.SUPPORTED;
    return BUCKET.VERIFY;
  }

  // Short reason shown next to a claim in lists: the most specific thing
  // wrong with it, or its support level.
  function reasonOf(claim) {
    const issues = (claim.issues || []).filter((i) => i !== "EXTERNAL_VERIFICATION_REQUIRED");
    if (claim.type === "ALLEGATION" && bucketOf(claim) !== BUCKET.SUPPORTED) return "Allegation";
    if (issues.length) return ISSUE_LABEL[issues[0]] || humanize(issues[0]);
    if (claim.support === "ARTICLE_SUPPORTED" || claim.support === "PARTIALLY_ARTICLE_SUPPORTED") return SUPPORT_LABEL[claim.support];
    if (needsExternal(claim) && VERIFY_SUPPORT.has(claim.support)) return "Needs external verification";
    return SUPPORT_LABEL[claim.support] || humanize(claim.support);
  }

  /** Counts for the summary counters and the banner. */
  function counts(result) {
    const claims = Array.isArray(result.claims) ? result.claims : [];
    const out = { total: claims.length, supported: 0, verify: 0, issue: 0, articleIssues: Array.isArray(result.issues) ? result.issues.length : 0 };
    for (const c of claims) out[bucketOf(c)]++;
    out.needsReview = out.verify + out.issue;
    return out;
  }

  /**
   * Key findings for the summary panel: the few claims that matter most
   * (issues first, then verification, then one or two supported ones),
   * plus article-level issues. Max `limit` entries.
   */
  function keyFindings(result, limit = 4) {
    const claims = Array.isArray(result.claims) ? result.claims : [];
    const order = { issue: 0, verify: 1, supported: 2 };
    const ranked = claims
      .map((c, i) => ({ claim: c, bucket: bucketOf(c), i }))
      .sort((a, b) => order[a.bucket] - order[b.bucket] || a.i - b.i);
    const findings = [];
    for (const r of ranked) {
      if (findings.length >= limit) break;
      // Keep at least one supported claim visible when there is room.
      findings.push({ kind: r.bucket, label: reasonOf(r.claim), text: r.claim.text, claim: r.claim });
    }
    const hasSupported = findings.some((f) => f.kind === BUCKET.SUPPORTED);
    const firstSupported = ranked.find((r) => r.bucket === BUCKET.SUPPORTED);
    if (!hasSupported && firstSupported && findings.length >= limit) {
      findings[limit - 1] = { kind: BUCKET.SUPPORTED, label: reasonOf(firstSupported.claim), text: firstSupported.claim.text, claim: firstSupported.claim };
    }
    for (const issue of Array.isArray(result.issues) ? result.issues : []) {
      if (findings.length >= limit) break;
      findings.push({ kind: BUCKET.ISSUE, label: ISSUE_LABEL[issue.type] || humanize(issue.type), text: issue.note || "", claim: null });
    }
    return findings;
  }

  /**
   * Highlights: "Supported in article" vs "Needs review", the latter broken
   * down by category. Replaces the old strengths/concerns wording, which
   * read as verified-true / verified-false.
   */
  function highlights(result) {
    const claims = Array.isArray(result.claims) ? result.claims : [];
    const supported = [];
    const review = [];
    for (const c of claims) {
      const bucket = bucketOf(c);
      if (bucket === BUCKET.SUPPORTED) {
        supported.push({ text: c.text, label: SUPPORT_LABEL[c.support], evidence: c.evidence, claim: c });
      } else {
        review.push({ text: c.text, category: reviewCategory(c), label: reasonOf(c), claim: c });
      }
    }
    for (const issue of Array.isArray(result.issues) ? result.issues : []) {
      review.push({ text: issue.note || "", category: ISSUE_LABEL[issue.type] || humanize(issue.type), label: ISSUE_LABEL[issue.type] || humanize(issue.type), claim: null });
    }
    return { supported, review };
  }

  function reviewCategory(claim) {
    if (claim.type === "ALLEGATION") return "Allegation";
    const issues = (claim.issues || []).filter((i) => i !== "EXTERNAL_VERIFICATION_REQUIRED");
    if (issues.includes("WEAK_SOURCE") || issues.includes("UNKNOWN_SOURCE") || claim.evidence_type === "ANONYMOUS_SOURCE" || claim.evidence_type === "UNIDENTIFIED_REPORT") return "Weak source";
    if (issues.includes("MISSING_CONTEXT") || issues.includes("SELECTIVE_EVIDENCE")) return "Missing context";
    if (ISSUE_SUPPORT.has(claim.support) || issues.length) return "Evidence gap";
    return "External verification required";
  }

  /**
   * Side-by-side rows: claims where the article's support is thin, missing
   * or invites an inference. Four columns, all textual observations.
   */
  function sideBySide(result) {
    const claims = Array.isArray(result.claims) ? result.claims : [];
    const order = { issue: 0, verify: 1, supported: 2 };
    const rows = claims
      .filter((c) => c.gap || c.inference || bucketOf(c) !== BUCKET.SUPPORTED)
      .map((c) => ({
        id: c.id,
        says: c.text,
        allegation: c.type === "ALLEGATION",
        support: c.support,
        evidenceType: c.evidence_type,
        evidence: c.evidence || "",
        gap: c.gap || "",
        inference: c.inference || "",
        bucket: bucketOf(c),
      }))
      .sort((a, b) => order[a.bucket] - order[b.bucket]);
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
      SUPPORT_LABEL, EVIDENCE_LABEL, ISSUE_LABEL, BUCKET, BUCKET_LABEL, BUCKET_COLOR,
      supportColor, supportWord, confidenceWord, humanize, pct,
      bucketOf, reasonOf, counts, keyFindings, highlights, reviewCategory, sideBySide, evidenceProfile,
    },
    // Kept for the bar, which predates derive.
    supportColor,
    supportLabel: supportWord,
    confidenceLabel: (c) => `${confidenceWord(c)} confidence`,
  });
})(globalThis);
