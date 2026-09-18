// Fact It - analysis engine (V0.5).
//
// ArticleDocument -> prompt -> provider -> parse -> validate -> AnalysisResult.
// Provider-independent: any adapter that implements complete() works.

import { buildPrompt, PROMPT_VERSION } from "./prompt.js";
import { parseModelJson, validateAnalysis } from "./validator.js";
import { ANALYSIS_SCHEMA_VERSION } from "./schema.js";

// Room for up to MAX_CLAIMS claims with explanations, in JSON.
export const ANALYSIS_MAX_TOKENS = 8192;

export class AnalysisError extends Error {
  /**
   * @param {"invalid_output"|"truncated_output"|"refused"} kind
   * @param {string} message
   * @param {string[]} [details]
   */
  constructor(kind, message, details = []) {
    super(message);
    this.name = "AnalysisError";
    this.kind = kind;
    this.details = details;
  }

  toJSON() {
    return { kind: this.kind, message: this.message, details: this.details };
  }
}

// Head and tail of the raw model text for diagnostics (console only).
function rawSnippet(text) {
  const t = typeof text === "string" ? text.replace(/\s+/g, " ").trim() : "";
  if (t.length <= 400) return `raw(${t.length}): ${t}`;
  return `raw(${t.length}): ${t.slice(0, 250)} … ${t.slice(-150)}`;
}

/**
 * @param {object} articleDocument ArticleDocument
 * @param {{ id: string, model: string, complete: Function }} provider
 * @param {{ now?: () => Date }} [options]
 * @returns {Promise<object>} AnalysisResult with `meta`
 */
export async function analyzeArticle(articleDocument, provider, options = {}) {
  const { system, input } = buildPrompt(articleDocument);
  const completion = await provider.complete({ system, input, maxTokens: ANALYSIS_MAX_TOKENS });

  if (completion.finish === "refusal") {
    throw new AnalysisError("refused", "The model declined to analyze this article.");
  }

  const parsed = parseModelJson(completion.text);
  if (!parsed) {
    const snippet = rawSnippet(completion.text);
    if (completion.finish === "length") {
      throw new AnalysisError("truncated_output", "The model's answer was cut off before it was complete.", [snippet]);
    }
    throw new AnalysisError("invalid_output", "The model did not return valid JSON.", [snippet]);
  }

  const validated = validateAnalysis(parsed);
  if (!validated.ok) {
    throw new AnalysisError("invalid_output", "The model's answer did not match the expected structure.", validated.errors);
  }

  const now = options.now ? options.now() : new Date();
  return {
    ...validated.value,
    meta: {
      provider: provider.id,
      model: completion.model,
      prompt_version: PROMPT_VERSION,
      schema_version: ANALYSIS_SCHEMA_VERSION,
      analyzed_at: now.toISOString(),
      content_hash: articleDocument.content_hash,
      truncated_input: Boolean(articleDocument.document.truncated),
      finish: completion.finish,
      usage: completion.usage,
      validation_issues: validated.issues,
      migrated_from: null,
    },
  };
}

const MAX_ARTICLE_CONTENT_CHARS = 40000; // matches content/normalize.js

/**
 * Shape check for an ArticleDocument received over the message channel.
 * Defense in depth: the background never trusts message payloads blindly.
 * Returns null when valid, otherwise a short reason.
 */
export function articleDocumentProblem(doc) {
  if (!doc || typeof doc !== "object") return "not an object";
  if (doc.schema_version !== "1.0") return "unsupported schema_version";
  if (typeof doc.content_hash !== "string" || !/^[0-9a-f]{64}$/.test(doc.content_hash)) return "invalid content_hash";
  const d = doc.document;
  if (!d || typeof d !== "object") return "missing document";
  if (typeof d.url !== "string" || !/^https?:\/\//.test(d.url)) return "invalid url";
  if (typeof d.content !== "string" || d.content === "") return "missing content";
  if (d.content.length > MAX_ARTICLE_CONTENT_CHARS) return "content too large";
  if (typeof d.title !== "string") return "invalid title";
  if (!Array.isArray(d.links) || !Array.isArray(d.images)) return "invalid links/images";
  return null;
}
