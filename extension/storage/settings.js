// Fact It - settings storage (V0.4).
//
// Provider configuration, including the user's API key, in
// chrome.storage.local. Only privileged extension contexts (background
// worker, settings page) import this module. Content scripts never do.
//
// chrome.storage.local is not encrypted: anyone with access to the browser
// profile can read it. This limitation is stated on the settings page.

const STORAGE_KEY = "settings";
const MAX_FIELD_CHARS = 512;

export const PROVIDER_IDS = Object.freeze(["openai", "anthropic", "openai-compatible"]);

export const DEFAULT_SETTINGS = Object.freeze({
  provider: "openai",
  apiKey: "",
  model: "",
  baseUrl: "",
  // USD per 1M tokens, as entered; "" = unknown (tokens shown, no cost).
  inputPricePerM: "",
  outputPricePerM: "",
});

/**
 * Coerce arbitrary input into a valid settings object. Unknown keys are
 * dropped, strings are trimmed and capped, invalid provider ids fall back
 * to the default. Never throws.
 */
export function sanitizeSettings(input) {
  const src = input && typeof input === "object" ? input : {};
  const str = (v) => (typeof v === "string" ? v.trim().slice(0, MAX_FIELD_CHARS) : "");
  const price = (v) => {
    const n = typeof v === "number" ? v : Number(String(v ?? "").trim().replace(",", "."));
    return String(v ?? "").trim() !== "" && Number.isFinite(n) && n >= 0 && n < 100000 ? String(n) : "";
  };
  return {
    provider: PROVIDER_IDS.includes(src.provider) ? src.provider : DEFAULT_SETTINGS.provider,
    apiKey: str(src.apiKey),
    model: str(src.model),
    baseUrl: str(src.baseUrl),
    inputPricePerM: price(src.inputPricePerM),
    outputPricePerM: price(src.outputPricePerM),
  };
}

/**
 * @param {{ get: Function, set: Function, remove: Function }} [area]
 *   storage area; defaults to chrome.storage.local. Injectable for tests.
 */
export function createSettingsStore(area = globalThis.chrome?.storage?.local) {
  if (!area) throw new Error("No storage area available.");

  return {
    async get() {
      const stored = await area.get(STORAGE_KEY);
      return sanitizeSettings(stored && stored[STORAGE_KEY]);
    },

    /** Merge a partial update; an undefined apiKey keeps the stored one. */
    async update(patch) {
      const current = await this.get();
      const next = sanitizeSettings({ ...current, ...(patch || {}) });
      await area.set({ [STORAGE_KEY]: next });
      return next;
    },

    async clearApiKey() {
      return this.update({ apiKey: "" });
    },
  };
}
