// Fact It - provider layer (V0.4).
//
// Common interface every AI provider adapter implements, plus the registry
// used by the background worker and the settings page. Runs only in
// privileged extension contexts (never in content scripts).
//
// Interface:
//
//   const provider = createProvider(settings, { fetch });
//   const result = await provider.complete({ system, input, maxTokens });
//
//   result = { text, model, provider, finish, usage }
//     finish: "stop" | "length" | "refusal" | "other"
//     usage:  { input_tokens, output_tokens } | null
//
// `system` carries Fact It's instructions; `input` carries UNTRUSTED article
// data. Adapters must keep them in separate message roles/fields so the
// model can tell them apart. Prompt construction and output validation are
// not the adapter's job (see analysis/).

import { openaiProvider } from "./openai.js";
import { anthropicProvider } from "./anthropic.js";
import { openaiCompatibleProvider } from "./openai-compatible.js";
import { DEFAULT_MAX_TOKENS, ERROR_KINDS, ProviderError, send } from "./common.js";

export { DEFAULT_MAX_TOKENS, ERROR_KINDS, ProviderError, redact } from "./common.js";

/** Registry. Order is the display order in the settings page. */
export const PROVIDERS = Object.freeze([
  openaiProvider,
  anthropicProvider,
  openaiCompatibleProvider,
]);

export function getProviderDefinition(id) {
  return PROVIDERS.find((p) => p.id === id) || null;
}

/**
 * Build a provider instance from settings.
 *
 * @param {{ provider: string, apiKey: string, model: string, baseUrl: string }} settings
 * @param {{ fetch?: typeof fetch }} [options] fetch injection for tests
 */
export function createProvider(settings, options = {}) {
  const definition = getProviderDefinition(settings && settings.provider);
  if (!definition) {
    throw new ProviderError(ERROR_KINDS.CONFIG, "Unknown provider.");
  }
  const fetchImpl = options.fetch || globalThis.fetch;
  const config = definition.configure(settings); // throws ProviderError on bad config
  const model = (settings.model && settings.model.trim()) || definition.defaultModel;

  return {
    id: definition.id,
    label: definition.label,
    model,
    async complete(request) {
      const req = normalizeRequest(request, model);
      const { url, headers, body } = definition.buildRequest(config, req);
      const response = await send(fetchImpl, url, headers, body, definition.id, config.apiKey);
      return definition.parseResponse(response, definition.id, req.model);
    },
  };
}

function normalizeRequest(request, model) {
  if (!request || typeof request.input !== "string" || typeof request.system !== "string") {
    throw new ProviderError(ERROR_KINDS.CONFIG, "Request needs string `system` and `input`.");
  }
  const maxTokens = Number.isInteger(request.maxTokens) && request.maxTokens > 0
    ? request.maxTokens
    : DEFAULT_MAX_TOKENS;
  return { system: request.system, input: request.input, maxTokens, model };
}

