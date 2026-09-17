// Fact It - cumulative token usage (V1.1).
//
// Running totals of tokens and estimated cost across all requests made
// from this browser profile, in chrome.storage.local. Background-only.

const KEY = "usage_totals";

const EMPTY = Object.freeze({ requests: 0, input_tokens: 0, output_tokens: 0, cost_usd: 0, since: null });

function sanitize(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const num = (v) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : 0);
  return {
    requests: Math.floor(num(r.requests)),
    input_tokens: Math.floor(num(r.input_tokens)),
    output_tokens: Math.floor(num(r.output_tokens)),
    cost_usd: num(r.cost_usd),
    since: typeof r.since === "string" ? r.since : null,
  };
}

/**
 * @param {{ get: Function, set: Function, remove: Function }} [area]
 * @param {{ now?: () => Date }} [options]
 */
export function createUsageTotals(area = globalThis.chrome?.storage?.local, options = {}) {
  if (!area) throw new Error("No storage area available.");
  const now = options.now || (() => new Date());
  return {
    async get() {
      const stored = await area.get(KEY);
      return sanitize(stored && stored[KEY]);
    },
    /** @param {{ input_tokens?: number, output_tokens?: number } | null} usage @param {number|null} costUsd */
    async add(usage, costUsd) {
      const current = await this.get();
      const next = {
        requests: current.requests + 1,
        input_tokens: current.input_tokens + Math.max(0, Math.floor(Number(usage && usage.input_tokens) || 0)),
        output_tokens: current.output_tokens + Math.max(0, Math.floor(Number(usage && usage.output_tokens) || 0)),
        cost_usd: current.cost_usd + (Number.isFinite(costUsd) ? costUsd : 0),
        since: current.since || now().toISOString(),
      };
      await area.set({ [KEY]: next });
      return next;
    },
    async reset() {
      await area.remove(KEY);
      return { ...EMPTY };
    },
  };
}
