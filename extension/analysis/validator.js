// Fact It - AnalysisResult validation (schema 2.1).
//
// LLM output is UNTRUSTED. This module turns whatever text the model
// returned into either a schema-conformant AnalysisResult or a clear
// failure. It never trusts the model to set verification_level,
// external_verification or schema_version, clamps every number, caps every
// string and drops items it cannot validate (recording why).
//
// It also migrates results written under schema 1.x and 2.0 (still in the
// local cache) into the 2.1 shape, so one renderer serves everything.

import {
  ANALYSIS_SCHEMA_VERSION,
  VERIFICATION_LEVEL,
  EXTERNAL_VERIFICATION,
  CLAIM_TYPES,
  SUPPORT_LEVELS,
  ATTRIBUTIONS,
  EVIDENCE_TYPES,
  CONCERN_TYPES,
  CONCERN_SEVERITY,
  FRAMING_TYPES,
  FRAMING_STRENGTHS,
  LIMITS,
} from "./schema.js";

/**
 * Extract a JSON object from model text. Tolerates code fences and prose
 * around the object. Returns the parsed object or null.
 */
export function parseModelJson(text) {
  if (typeof text !== "string") return null;
  let s = text.trim();

  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) s = fenced[1].trim();

  const attempt = (candidate) => {
    try {
      const value = JSON.parse(candidate);
      return value && typeof value === "object" && !Array.isArray(value) ? value : null;
    } catch {
      return null;
    }
  };

  const direct = attempt(s);
  if (direct) return direct;

  // Scan for balanced top-level objects (string- and escape-aware) so
  // trailing prose, stray braces or a second object cannot break parsing.
  for (let start = s.indexOf("{"); start !== -1; start = s.indexOf("{", start + 1)) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < s.length; i++) {
      const ch = s[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          const parsed = attempt(s.slice(start, i + 1));
          if (parsed) return parsed;
          break;
        }
      }
    }
  }
  return null;
}

function clamp01(value, fallback = 0) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, Math.round(n * 1000) / 1000));
}

function str(value, max) {
  if (typeof value !== "string") return "";
  const s = value.replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max).trim() + "…" : s;
}

function oneOf(value, allowed) {
  return typeof value === "string" && allowed.includes(value.trim().toUpperCase())
    ? value.trim().toUpperCase()
    : null;
}

function codes(value, allowed, max) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const v of value) {
    const code = oneOf(v, allowed);
    if (code && !out.includes(code)) out.push(code);
    if (out.length >= max) break;
  }
  return out;
}

// ------------------------------------------------------------ migration

// 1.x classification -> 2.1 support
const LEGACY_SUPPORT = {
  SUPPORTED: "ARTICLE_SUPPORTED",
  MOSTLY_SUPPORTED: "ARTICLE_SUPPORTED",
  PARTIALLY_SUPPORTED: "PARTIALLY_ARTICLE_SUPPORTED",
  UNVERIFIED: "UNCLEAR",
  DISPUTED: "INTERNALLY_CONTRADICTED",
  MISLEADING: "UNCLEAR",
  MOSTLY_FALSE: "INTERNALLY_CONTRADICTED",
  FALSE: "INTERNALLY_CONTRADICTED",
  INSUFFICIENT_EVIDENCE: "UNSUPPORTED_WITHIN_ARTICLE",
};

const LEGACY_BASIS_TO_EVIDENCE = {
  EVIDENCE: "UNKNOWN",
  ATTRIBUTION: "SECONDARY_SOURCE",
  OPINION: "ARTICLE_ASSERTION",
  ASSUMPTION: "NO_EVIDENCE_SHOWN",
  UNKNOWN: "UNKNOWN",
};

// 2.0 support -> 2.1 support
const SUPPORT_20_TO_21 = {
  ARTICLE_SUPPORTED: "ARTICLE_SUPPORTED",
  PARTIALLY_ARTICLE_SUPPORTED: "PARTIALLY_ARTICLE_SUPPORTED",
  ATTRIBUTED: "ATTRIBUTED",
  EVIDENCE_GAP: "UNSUPPORTED_WITHIN_ARTICLE",
  UNVERIFIED: "UNCLEAR",
  INSUFFICIENT_EVIDENCE: "UNSUPPORTED_WITHIN_ARTICLE",
  CONTRADICTED_IN_ARTICLE: "INTERNALLY_CONTRADICTED",
  MISLEADING_PRESENTATION: "UNCLEAR",
};

// 1.x flags / 2.0 issues -> 2.1 concerns. Verification-absence codes are
// dropped: they were never a concern about the article (ADR-008).
const ISSUE_TO_CONCERN = {
  MISSING_CONTEXT: "MATERIAL_MISSING_CONTEXT",
  UNSUPPORTED_ACCUSATION: "UNSUPPORTED_SERIOUS_ALLEGATION",
  OUTDATED_INFORMATION: "OUTDATED_INFORMATION",
  STATISTICAL_MISREPRESENTATION: "MISLEADING_STATISTIC",
  HEADLINE_CONTENT_MISMATCH: "HEADLINE_OVERSTATEMENT",
  UNATTRIBUTED_CLAIM: "AMBIGUOUS_ATTRIBUTION",
  WEAK_SOURCE: "AMBIGUOUS_ATTRIBUTION",
  CONTRADICTORY_STATEMENTS: "INTERNAL_CONTRADICTION",
  OPINION_PRESENTED_AS_FACT: "OPINION_PRESENTED_AS_FACT",
  SELECTIVE_EVIDENCE: "SELECTIVE_EVIDENCE",
  UNKNOWN_SOURCE: "AMBIGUOUS_ATTRIBUTION",
  EXTERNAL_VERIFICATION_REQUIRED: null,
};

const mapCodes = (codes) => (Array.isArray(codes) ? codes : [])
  .map((c) => (typeof c === "string" && c.toUpperCase() in ISSUE_TO_CONCERN ? ISSUE_TO_CONCERN[c.toUpperCase()] : c))
  .filter(Boolean);

/**
 * Convert a schema 1.x result (as stored) into the 2.1 raw shape.
 * Explanations become `evidence`; flags become article-level concerns.
 * Nothing is invented.
 */
export function migrateLegacy(raw) {
  if (!raw || typeof raw !== "object") return raw;
  if (raw.assessment || !raw.analysis) return raw;
  const a = raw.analysis || {};
  const claims = (Array.isArray(raw.claims) ? raw.claims : []).map((c, i) => ({
    id: `c${i + 1}`,
    text: c && c.text,
    type: c && c.type,
    support: c && LEGACY_SUPPORT[String(c.classification || "").toUpperCase()],
    attribution: c && String(c.basis || "").toUpperCase() === "ATTRIBUTION" ? "CLEAR" : "UNCLEAR",
    evidence_type: c && (LEGACY_BASIS_TO_EVIDENCE[String(c.basis || "UNKNOWN").toUpperCase()] || "UNKNOWN"),
    evidence: c && c.explanation,
    gap: c && c.missing_information,
    inference: c && c.implied,
    concerns: [],
  }));
  const concerns = (Array.isArray(raw.flags) ? raw.flags : [])
    .map((f) => ({ type: f && ISSUE_TO_CONCERN[String(f.type || "").toUpperCase()], note: f && f.explanation, claim_ids: [] }))
    .filter((f) => f.type);
  const fr = raw.framing || {};
  return {
    assessment: { confidence: a.confidence, rationale: a.rationale },
    source_transparency: {},
    claims,
    concerns,
    framing: { detected: fr.detected, type: fr.type, strength: fr.strength, confidence: fr.confidence, observations: fr.explanation ? [fr.explanation] : [] },
    summary: raw.summary,
    __migrated_from: typeof raw.schema_version === "string" ? raw.schema_version : "1.x",
  };
}

/**
 * Convert a schema 2.0 result into the 2.1 raw shape: support vocabulary,
 * issue codes -> concern codes, verification flags dropped.
 */
export function migrate20(raw) {
  if (!raw || typeof raw !== "object" || !raw.assessment) return raw;
  const is20 = raw.schema_version === "2.0" || raw.issues !== undefined ||
    (Array.isArray(raw.claims) && raw.claims.some((c) => c && typeof c === "object" && ("external_verification_required" in c || "issues" in c)));
  if (!is20) return raw;
  const claims = (Array.isArray(raw.claims) ? raw.claims : []).map((c) => c && typeof c === "object" ? {
    ...c,
    support: SUPPORT_20_TO_21[String(c.support || "").toUpperCase()] || c.support,
    attribution: c.attribution || (["NAMED_SOURCE", "DIRECT_QUOTE", "PRIMARY_DOCUMENT", "OFFICIAL_RECORD", "SECONDARY_SOURCE"].includes(String(c.evidence_type || "").toUpperCase()) ? "CLEAR" : "UNCLEAR"),
    concerns: mapCodes(c.issues),
  } : c);
  const concerns = (Array.isArray(raw.issues) ? raw.issues : [])
    .map((f) => f && typeof f === "object" ? { ...f, type: ISSUE_TO_CONCERN[String(f.type || "").toUpperCase()] } : null)
    .filter((f) => f && f.type);
  return {
    ...raw,
    claims,
    concerns,
    source_transparency: raw.source_transparency || {},
    __migrated_from: raw.__migrated_from || raw.schema_version || "2.0",
  };
}

// ------------------------------------------------------------ validation

/**
 * Overall status from concerns only. External verification status never
 * plays a part (ADR-008).
 */
export function deriveStatus(claims, concerns) {
  const codes = [...concerns.map((c) => c.type), ...claims.flatMap((c) => c.concerns || [])];
  if (codes.some((c) => CONCERN_SEVERITY[c] === "SIGNIFICANT")) return "SIGNIFICANT_CONCERNS";
  if (codes.length > 0) return "REVIEW_RECOMMENDED";
  return "NO_SIGNIFICANT_CONCERNS";
}

/**
 * @param {object|null} raw parsed model output (2.1), or a 1.x / 2.0 result
 * @returns {{ ok: true, value: object, issues: string[], migrated_from: string|null } | { ok: false, errors: string[] }}
 */
export function validateAnalysis(raw) {
  const errors = [];
  const notes = [];
  if (!raw || typeof raw !== "object") return { ok: false, errors: ["output is not a JSON object"] };
  if (!raw.assessment && raw.analysis) raw = migrateLegacy(raw);
  raw = migrate20(raw);

  // assessment
  const a = raw.assessment && typeof raw.assessment === "object" ? raw.assessment : null;
  if (!a) errors.push("missing assessment object");
  if (a && !Number.isFinite(Number(a.confidence))) errors.push("assessment.confidence is not a number");

  // source transparency (observable; all optional booleans)
  const st = raw.source_transparency && typeof raw.source_transparency === "object" ? raw.source_transparency : {};
  const source_transparency = {
    named_sources: st.named_sources === true,
    primary_references: st.primary_references === true,
    direct_quotes: st.direct_quotes === true,
  };

  // claims
  const claims = [];
  const idMapRaw = new Map();
  if (!Array.isArray(raw.claims)) {
    errors.push("claims is not an array");
  } else {
    raw.claims.forEach((c, i) => {
      if (claims.length >= LIMITS.MAX_CLAIMS) return;
      const text = c && str(c.text, LIMITS.MAX_CLAIM_TEXT_CHARS);
      const support = c && oneOf(c.support, SUPPORT_LEVELS);
      if (!text || !support) {
        notes.push(`claim ${i} dropped: missing text or invalid support`);
        return;
      }
      const id = `c${claims.length + 1}`;
      if (c && typeof c.id === "string") idMapRaw.set(c.id.trim().slice(0, 16), id);
      const type = oneOf(c.type, CLAIM_TYPES) || (support === "ALLEGATION_REPORTED" ? "ALLEGATION" : "FACTUAL");
      claims.push({
        id,
        text,
        type,
        support,
        attribution: oneOf(c.attribution, ATTRIBUTIONS) || (support === "ATTRIBUTED" || support === "ALLEGATION_REPORTED" ? "CLEAR" : "UNCLEAR"),
        evidence_type: oneOf(c.evidence_type, EVIDENCE_TYPES) || "UNKNOWN",
        evidence: str(c.evidence, LIMITS.MAX_FIELD_CHARS),
        concerns: codes(c.concerns, CONCERN_TYPES, LIMITS.MAX_CONCERNS_PER_CLAIM),
        gap: str(c.gap, LIMITS.MAX_FIELD_CHARS),
        inference: str(c.inference, LIMITS.MAX_FIELD_CHARS),
      });
    });
    if (raw.claims.length > LIMITS.MAX_CLAIMS) notes.push(`claims truncated to ${LIMITS.MAX_CLAIMS}`);
  }

  // article-level concerns
  const concerns = [];
  if (raw.concerns !== undefined && !Array.isArray(raw.concerns)) {
    notes.push("concerns is not an array; ignored");
  } else if (Array.isArray(raw.concerns)) {
    raw.concerns.forEach((f, i) => {
      if (concerns.length >= LIMITS.MAX_CONCERNS) return;
      const type = f && oneOf(f.type, CONCERN_TYPES);
      if (!type) {
        notes.push(`concern ${i} dropped: invalid type`);
        return;
      }
      const claim_ids = (Array.isArray(f.claim_ids) ? f.claim_ids : [])
        .map((x) => (typeof x === "string" ? idMapRaw.get(x.trim()) || (claims.some((c) => c.id === x.trim()) ? x.trim() : null) : null))
        .filter(Boolean)
        .slice(0, LIMITS.MAX_CLAIMS);
      concerns.push({ type, severity: CONCERN_SEVERITY[type], note: str(f.note, LIMITS.MAX_FIELD_CHARS), claim_ids });
    });
  }

  // framing
  const fr = raw.framing && typeof raw.framing === "object" ? raw.framing : null;
  if (!fr) errors.push("missing framing object");
  const observations = (fr && Array.isArray(fr.observations) ? fr.observations : [])
    .map((o) => str(o, LIMITS.MAX_OBSERVATION_CHARS))
    .filter(Boolean)
    .slice(0, LIMITS.MAX_FRAMING_OBSERVATIONS);
  // Framing needs observable characteristics; "detected" without any is
  // downgraded (the model was told not to force LOW framing).
  const detected = Boolean(fr && fr.detected === true && observations.length > 0);
  if (fr && fr.detected === true && observations.length === 0) notes.push("framing.detected without observations; set to false");
  const framing = {
    detected,
    type: detected ? oneOf(fr.type, FRAMING_TYPES) || "OTHER" : null,
    strength: detected ? oneOf(fr.strength, FRAMING_STRENGTHS) : null,
    confidence: clamp01(fr && fr.confidence),
    observations: detected ? observations : [],
  };
  if (detected && !framing.strength) notes.push("framing.strength missing or invalid; set to null");

  // summary
  if (typeof raw.summary !== "string") errors.push("summary is not a string");
  const summary = str(raw.summary, LIMITS.MAX_SUMMARY_CHARS);

  if (errors.length) return { ok: false, errors };

  const assessment = {
    status: deriveStatus(claims, concerns), // derived, never taken from the model
    confidence: clamp01(a.confidence),
    rationale: str(a.rationale, LIMITS.MAX_RATIONALE_CHARS),
    verification_level: VERIFICATION_LEVEL, // never taken from the model
    external_verification: EXTERNAL_VERIFICATION, // metadata, never a concern
  };

  return {
    ok: true,
    issues: notes,
    migrated_from: typeof raw.__migrated_from === "string" ? raw.__migrated_from : null,
    value: {
      schema_version: ANALYSIS_SCHEMA_VERSION, // never taken from the model
      assessment,
      source_transparency,
      claims,
      concerns,
      framing,
      summary,
    },
  };
}
