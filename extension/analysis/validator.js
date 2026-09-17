// Fact It - AnalysisResult validation (V0.5).
//
// LLM output is UNTRUSTED. This module turns whatever text the model
// returned into either a schema-conformant AnalysisResult or a clear
// failure. It never trusts the model to set verification_level or
// schema_version, clamps every number, caps every string and drops items
// it cannot validate (recording why).

import {
  ANALYSIS_SCHEMA_VERSION,
  VERIFICATION_LEVEL,
  CLAIM_TYPES,
  CLAIM_BASES,
  CLAIM_CLASSIFICATIONS,
  FLAG_TYPES,
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
  // The first candidate that parses wins.
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
          break; // this candidate is unbalanced/invalid; try the next "{"
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

/**
 * @param {object|null} raw parsed model output
 * @returns {{ ok: true, value: object, issues: string[] } | { ok: false, errors: string[] }}
 */
export function validateAnalysis(raw) {
  const errors = [];
  const issues = [];
  if (!raw || typeof raw !== "object") return { ok: false, errors: ["output is not a JSON object"] };

  // analysis
  const a = raw.analysis && typeof raw.analysis === "object" ? raw.analysis : null;
  if (!a) errors.push("missing analysis object");
  const analysis = {
    overall_factual_support: clamp01(a && a.overall_factual_support),
    confidence: clamp01(a && a.confidence),
    verification_level: VERIFICATION_LEVEL, // never taken from the model
    rationale: str(a && a.rationale, LIMITS.MAX_RATIONALE_CHARS), // schema 1.2; "" when absent
  };
  if (a && !Number.isFinite(Number(a.overall_factual_support))) errors.push("analysis.overall_factual_support is not a number");
  if (a && !Number.isFinite(Number(a.confidence))) errors.push("analysis.confidence is not a number");

  // claims
  const claims = [];
  if (!Array.isArray(raw.claims)) {
    errors.push("claims is not an array");
  } else {
    raw.claims.forEach((c, i) => {
      if (claims.length >= LIMITS.MAX_CLAIMS) return;
      const text = c && str(c.text, LIMITS.MAX_CLAIM_TEXT_CHARS);
      const classification = c && oneOf(c.classification, CLAIM_CLASSIFICATIONS);
      if (!text || !classification) {
        issues.push(`claim ${i} dropped: missing text or invalid classification`);
        return;
      }
      claims.push({
        text,
        type: oneOf(c.type, CLAIM_TYPES) || "FACTUAL",
        classification,
        confidence: clamp01(c.confidence),
        explanation: str(c.explanation, LIMITS.MAX_EXPLANATION_CHARS),
        // Schema 1.1; absent in older results -> UNKNOWN / empty.
        basis: oneOf(c.basis, CLAIM_BASES) || "UNKNOWN",
        missing_information: str(c.missing_information, LIMITS.MAX_SIDE_BY_SIDE_CHARS),
        implied: str(c.implied, LIMITS.MAX_SIDE_BY_SIDE_CHARS),
      });
    });
    if (raw.claims.length > LIMITS.MAX_CLAIMS) issues.push(`claims truncated to ${LIMITS.MAX_CLAIMS}`);
  }

  // flags
  const flags = [];
  if (!Array.isArray(raw.flags)) {
    errors.push("flags is not an array");
  } else {
    raw.flags.forEach((f, i) => {
      if (flags.length >= LIMITS.MAX_FLAGS) return;
      const type = f && oneOf(f.type, FLAG_TYPES);
      if (!type) {
        issues.push(`flag ${i} dropped: invalid type`);
        return;
      }
      flags.push({ type, explanation: str(f.explanation, LIMITS.MAX_EXPLANATION_CHARS) });
    });
  }

  // framing
  const fr = raw.framing && typeof raw.framing === "object" ? raw.framing : null;
  if (!fr) errors.push("missing framing object");
  const detected = Boolean(fr && fr.detected === true);
  const framing = {
    detected,
    type: detected ? oneOf(fr.type, FRAMING_TYPES) || "OTHER" : null,
    strength: detected ? oneOf(fr.strength, FRAMING_STRENGTHS) : null,
    confidence: clamp01(fr && fr.confidence),
    explanation: str(fr && fr.explanation, LIMITS.MAX_EXPLANATION_CHARS),
  };
  if (detected && !framing.strength) issues.push("framing.strength missing or invalid; set to null");

  // summary
  if (typeof raw.summary !== "string") errors.push("summary is not a string");
  const summary = str(raw.summary, LIMITS.MAX_SUMMARY_CHARS);

  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    issues,
    value: {
      schema_version: ANALYSIS_SCHEMA_VERSION, // never taken from the model
      analysis,
      claims,
      flags,
      framing,
      summary,
    },
  };
}
