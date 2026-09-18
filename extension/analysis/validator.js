// Fact It - AnalysisResult validation (schema 2.0).
//
// LLM output is UNTRUSTED. This module turns whatever text the model
// returned into either a schema-conformant AnalysisResult or a clear
// failure. It never trusts the model to set verification_level,
// external_verification or schema_version, clamps every number, caps every
// string and drops items it cannot validate (recording why).
//
// It also migrates results written under schema 1.x (still in the local
// cache) into the 2.0 shape, so one renderer serves everything.

import {
  ANALYSIS_SCHEMA_VERSION,
  VERIFICATION_LEVEL,
  EXTERNAL_VERIFICATION,
  CLAIM_TYPES,
  SUPPORT_LEVELS,
  EVIDENCE_TYPES,
  ISSUE_TYPES,
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

const LEGACY_SUPPORT = {
  SUPPORTED: "ARTICLE_SUPPORTED",
  MOSTLY_SUPPORTED: "ARTICLE_SUPPORTED",
  PARTIALLY_SUPPORTED: "PARTIALLY_ARTICLE_SUPPORTED",
  UNVERIFIED: "UNVERIFIED",
  DISPUTED: "CONTRADICTED_IN_ARTICLE",
  MISLEADING: "MISLEADING_PRESENTATION",
  MOSTLY_FALSE: "CONTRADICTED_IN_ARTICLE",
  FALSE: "CONTRADICTED_IN_ARTICLE",
  INSUFFICIENT_EVIDENCE: "INSUFFICIENT_EVIDENCE",
};

const LEGACY_BASIS_TO_EVIDENCE = {
  EVIDENCE: "UNKNOWN",
  ATTRIBUTION: "SECONDARY_SOURCE",
  OPINION: "ARTICLE_ASSERTION",
  ASSUMPTION: "NO_EVIDENCE_SHOWN",
  UNKNOWN: "UNKNOWN",
};

/**
 * Convert a schema 1.x result (as stored) into the raw 2.0 shape that
 * validateAnalysis accepts. Free-text explanations become `evidence`
 * (what the model said backs or fails to back the claim); flags become
 * article-level issues. Nothing is invented.
 */
export function migrateLegacy(raw) {
  if (!raw || typeof raw !== "object") return raw;
  if (raw.assessment || !raw.analysis) return raw; // already 2.0 (or unrecognizable)
  const a = raw.analysis || {};
  const claims = (Array.isArray(raw.claims) ? raw.claims : []).map((c, i) => ({
    id: `c${i + 1}`,
    text: c && c.text,
    type: c && c.type,
    support: c && LEGACY_SUPPORT[String(c.classification || "").toUpperCase()],
    confidence: c && c.confidence,
    evidence_type: c && (LEGACY_BASIS_TO_EVIDENCE[String(c.basis || "UNKNOWN").toUpperCase()] || "UNKNOWN"),
    evidence: c && c.explanation,
    gap: c && c.missing_information,
    inference: c && c.implied,
    issues: [],
    external_verification_required: false,
  }));
  const issues = (Array.isArray(raw.flags) ? raw.flags : []).map((f) => ({
    type: f && f.type,
    note: f && f.explanation,
    claim_ids: [],
  }));
  const fr = raw.framing || {};
  return {
    assessment: { article_support: a.overall_factual_support, confidence: a.confidence, rationale: a.rationale },
    claims,
    issues,
    framing: {
      detected: fr.detected,
      type: fr.type,
      strength: fr.strength,
      confidence: fr.confidence,
      observations: fr.explanation ? [fr.explanation] : [],
    },
    summary: raw.summary,
    __migrated_from: typeof raw.schema_version === "string" ? raw.schema_version : "1.x",
  };
}

// ------------------------------------------------------------ validation

/**
 * @param {object|null} raw parsed model output (2.0) or a migrated 1.x result
 * @returns {{ ok: true, value: object, issues: string[] } | { ok: false, errors: string[] }}
 */
export function validateAnalysis(raw) {
  const errors = [];
  const notes = [];
  if (!raw || typeof raw !== "object") return { ok: false, errors: ["output is not a JSON object"] };
  if (!raw.assessment && raw.analysis) raw = migrateLegacy(raw);

  // assessment
  const a = raw.assessment && typeof raw.assessment === "object" ? raw.assessment : null;
  if (!a) errors.push("missing assessment object");
  if (a && !Number.isFinite(Number(a.article_support))) errors.push("assessment.article_support is not a number");
  if (a && !Number.isFinite(Number(a.confidence))) errors.push("assessment.confidence is not a number");
  const assessment = {
    article_support: clamp01(a && a.article_support),
    confidence: clamp01(a && a.confidence),
    rationale: str(a && a.rationale, LIMITS.MAX_RATIONALE_CHARS),
    verification_level: VERIFICATION_LEVEL, // never taken from the model
    external_verification: EXTERNAL_VERIFICATION, // never taken from the model
  };

  // claims
  const claims = [];
  const seenIds = new Set();
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
      // Ids are ours: sequential, unique, never trusted from the model
      // except to resolve issue references below.
      const id = `c${claims.length + 1}`;
      if (c && typeof c.id === "string") seenIds.add(c.id.trim());
      const issues = codes(c.issues, ISSUE_TYPES, LIMITS.MAX_ISSUES_PER_CLAIM);
      const externalRequired = c.external_verification_required === true || issues.includes("EXTERNAL_VERIFICATION_REQUIRED");
      claims.push({
        id,
        model_id: c && typeof c.id === "string" ? c.id.trim().slice(0, 16) : null,
        text,
        type: oneOf(c.type, CLAIM_TYPES) || "FACTUAL",
        support,
        confidence: clamp01(c.confidence),
        evidence_type: oneOf(c.evidence_type, EVIDENCE_TYPES) || "UNKNOWN",
        evidence: str(c.evidence, LIMITS.MAX_FIELD_CHARS),
        gap: str(c.gap, LIMITS.MAX_FIELD_CHARS),
        inference: str(c.inference, LIMITS.MAX_FIELD_CHARS),
        issues,
        external_verification_required: externalRequired,
      });
    });
    if (raw.claims.length > LIMITS.MAX_CLAIMS) notes.push(`claims truncated to ${LIMITS.MAX_CLAIMS}`);
  }
  // Resolve model ids -> our ids for issue references, then drop model ids.
  const idMap = new Map(claims.filter((c) => c.model_id).map((c) => [c.model_id, c.id]));
  for (const c of claims) delete c.model_id;

  // article-level issues
  const issues = [];
  if (raw.issues !== undefined && !Array.isArray(raw.issues)) {
    notes.push("issues is not an array; ignored");
  } else if (Array.isArray(raw.issues)) {
    raw.issues.forEach((f, i) => {
      if (issues.length >= LIMITS.MAX_ISSUES) return;
      const type = f && oneOf(f.type, ISSUE_TYPES);
      if (!type) {
        notes.push(`issue ${i} dropped: invalid type`);
        return;
      }
      const claim_ids = (Array.isArray(f.claim_ids) ? f.claim_ids : [])
        .map((x) => (typeof x === "string" ? idMap.get(x.trim()) || (claims.some((c) => c.id === x.trim()) ? x.trim() : null) : null))
        .filter(Boolean)
        .slice(0, LIMITS.MAX_CLAIMS);
      issues.push({ type, note: str(f.note, LIMITS.MAX_FIELD_CHARS), claim_ids });
    });
  }

  // framing
  const fr = raw.framing && typeof raw.framing === "object" ? raw.framing : null;
  if (!fr) errors.push("missing framing object");
  const detected = Boolean(fr && fr.detected === true);
  const observations = (fr && Array.isArray(fr.observations) ? fr.observations : [])
    .map((o) => str(o, LIMITS.MAX_OBSERVATION_CHARS))
    .filter(Boolean)
    .slice(0, LIMITS.MAX_FRAMING_OBSERVATIONS);
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

  return {
    ok: true,
    issues: notes,
    migrated_from: typeof raw.__migrated_from === "string" ? raw.__migrated_from : null,
    value: {
      schema_version: ANALYSIS_SCHEMA_VERSION, // never taken from the model
      assessment,
      claims,
      issues,
      framing,
      summary,
    },
  };
}
