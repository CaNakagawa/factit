// Fact It - cost estimation (V1.1).
//
// Prices are USD per 1M tokens, entered by the user in settings. A small
// table of known list prices pre-fills the fields for models we can
// vouch for; everything else stays empty and the UI shows tokens only.

// Source: Anthropic API reference (cached 2026-06-24). Others are left to
// the user; list prices change and differ per region/tier.
export const KNOWN_PRICES = Object.freeze({
  anthropic: {
    "claude-fable-5-1": { input: 10, output: 50 },
    "claude-fable-5": { input: 10, output: 50 },
    "claude-opus-5": { input: 5, output: 25 },
    "claude-opus-4-8": { input: 5, output: 25 },
    "claude-opus-4-7": { input: 5, output: 25 },
    "claude-opus-4-6": { input: 5, output: 25 },
    "claude-sonnet-5": { input: 2, output: 10 },
    "claude-sonnet-4-6": { input: 3, output: 15 },
    "claude-haiku-4-5": { input: 1, output: 5 },
  },
});

export function knownPrice(provider, model) {
  const table = KNOWN_PRICES[provider];
  return (table && table[model]) || null;
}

/** Parse a user-entered price; null when empty or invalid. */
export function parsePrice(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(n) && n >= 0 && n < 100000 ? n : null;
}

/**
 * @param {{ input_tokens: number, output_tokens: number } | null} usage
 * @param {{ input: number|null, output: number|null }} prices USD per 1M tokens
 * @returns {{ usd: number, input_usd: number, output_usd: number } | null}
 */
export function estimateCost(usage, prices) {
  if (!usage || !prices) return null;
  const inTok = Number(usage.input_tokens);
  const outTok = Number(usage.output_tokens);
  const pIn = parsePrice(prices.input);
  const pOut = parsePrice(prices.output);
  if (!Number.isFinite(inTok) || !Number.isFinite(outTok) || pIn === null || pOut === null) return null;
  const input_usd = (inTok / 1e6) * pIn;
  const output_usd = (outTok / 1e6) * pOut;
  return { usd: input_usd + output_usd, input_usd, output_usd };
}

/** "$0.0123" style, with enough precision for sub-cent amounts. */
export function formatUsd(usd) {
  if (!Number.isFinite(usd)) return "";
  if (usd === 0) return "$0";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}
