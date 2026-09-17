// Fact It - local analysis cache (V0.8).
//
// Stores validated AnalysisResults in chrome.storage.local keyed by the
// article's content hash (SHA-256 of the normalized text), so revisiting
// an unchanged article costs no tokens. Background-only module.
//
// Layout in storage:
//   "analysis:<hash>"  -> { result, cached_at }
//   "analysis_index"   -> { "<hash>": cached_at }   (for LRU eviction)
//
// Article text is never stored; only the hash and the analysis.

import { validateAnalysis } from "../analysis/validator.js";
import { ANALYSIS_SCHEMA_VERSION } from "../analysis/schema.js";

export const MAX_ENTRIES = 200;
const INDEX_KEY = "analysis_index";
const PREFIX = "analysis:";

const HASH = /^[0-9a-f]{64}$/;

function entryKey(hash) {
  return PREFIX + hash;
}

// Stored data is extension-private, but re-validating is cheap and keeps
// the UI's guarantees independent of what is on disk.
function sanitizeStored(entry) {
  if (!entry || typeof entry !== "object" || !entry.result || typeof entry.result !== "object") return null;
  const { result } = entry;
  if (result.schema_version !== ANALYSIS_SCHEMA_VERSION) return null;
  const validated = validateAnalysis(result);
  if (!validated.ok) return null;
  const meta = result.meta && typeof result.meta === "object" ? result.meta : {};
  return {
    result: {
      ...validated.value,
      meta: {
        provider: typeof meta.provider === "string" ? meta.provider : "unknown",
        model: typeof meta.model === "string" ? meta.model : "unknown",
        prompt_version: typeof meta.prompt_version === "string" ? meta.prompt_version : "unknown",
        schema_version: ANALYSIS_SCHEMA_VERSION,
        analyzed_at: typeof meta.analyzed_at === "string" ? meta.analyzed_at : null,
        content_hash: typeof meta.content_hash === "string" ? meta.content_hash : null,
        truncated_input: Boolean(meta.truncated_input),
        finish: typeof meta.finish === "string" ? meta.finish : "other",
        usage: meta.usage && typeof meta.usage === "object" ? meta.usage : null,
        validation_issues: Array.isArray(meta.validation_issues) ? meta.validation_issues : [],
      },
    },
    cached_at: typeof entry.cached_at === "string" ? entry.cached_at : null,
  };
}

/**
 * @param {{ get: Function, set: Function, remove: Function }} [area]
 *   storage area; defaults to chrome.storage.local. Injectable for tests.
 * @param {{ now?: () => Date, maxEntries?: number }} [options]
 */
export function createAnalysisCache(area = globalThis.chrome?.storage?.local, options = {}) {
  if (!area) throw new Error("No storage area available.");
  const now = options.now || (() => new Date());
  const maxEntries = options.maxEntries || MAX_ENTRIES;

  async function readIndex() {
    const stored = await area.get(INDEX_KEY);
    const index = stored && stored[INDEX_KEY];
    return index && typeof index === "object" ? { ...index } : {};
  }

  return {
    /** @returns {Promise<{ result: object, cached_at: string|null } | null>} */
    async get(hash) {
      if (!HASH.test(hash || "")) return null;
      const stored = await area.get(entryKey(hash));
      const entry = sanitizeStored(stored && stored[entryKey(hash)]);
      if (!entry) return null;
      // Touch for LRU.
      const index = await readIndex();
      index[hash] = now().toISOString();
      await area.set({ [INDEX_KEY]: index });
      return entry;
    },

    async put(hash, result) {
      if (!HASH.test(hash || "")) throw new Error("Invalid content hash.");
      const stamp = now().toISOString();
      const index = await readIndex();
      index[hash] = stamp;

      // Evict least recently used beyond the cap.
      const overflow = Object.entries(index)
        .sort((a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0))
        .slice(0, Math.max(0, Object.keys(index).length - maxEntries))
        .map(([h]) => h);
      for (const h of overflow) delete index[h];
      if (overflow.length) await area.remove(overflow.map(entryKey));

      await area.set({ [entryKey(hash)]: { result, cached_at: stamp }, [INDEX_KEY]: index });
      return { cached_at: stamp, evicted: overflow.length };
    },

    async remove(hash) {
      if (!HASH.test(hash || "")) return;
      const index = await readIndex();
      delete index[hash];
      await area.remove(entryKey(hash));
      await area.set({ [INDEX_KEY]: index });
    },

    async clear() {
      const index = await readIndex();
      const hashes = Object.keys(index);
      await area.remove([...hashes.map(entryKey), INDEX_KEY]);
      return { removed: hashes.length };
    },

    async stats() {
      const index = await readIndex();
      return { count: Object.keys(index).length, max: maxEntries };
    },
  };
}
