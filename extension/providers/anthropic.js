// Fact It - Anthropic adapter (V0.4).
//
// Messages API called directly from the extension (BYOK). The article goes
// in the user turn; Fact It's instructions in the top-level `system` field.

import { invalidResponse, modelName, requireApiKey } from "./common.js";

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";

export const anthropicProvider = Object.freeze({
  id: "anthropic",
  label: "Anthropic",
  defaultModel: "claude-opus-5",
  needsBaseUrl: false,
  needsApiKey: true,

  configure(settings) {
    return { apiKey: requireApiKey(settings, "anthropic") };
  },

  buildRequest(config, req) {
    return {
      url: ENDPOINT,
      headers: {
        "x-api-key": config.apiKey,
        "anthropic-version": API_VERSION,
        // Required for requests that originate from a browser context.
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: {
        model: req.model,
        max_tokens: req.maxTokens,
        system: req.system,
        messages: [{ role: "user", content: req.input }],
      },
    };
  },

  parseResponse(json, providerId, model) {
    if (!Array.isArray(json.content)) throw invalidResponse(providerId, "missing content blocks");
    const text = json.content
      .filter((block) => block && block.type === "text" && typeof block.text === "string")
      .map((block) => block.text)
      .join("");

    const stop = json.stop_reason;
    const finish = stop === "end_turn" || stop === "stop_sequence" ? "stop"
      : stop === "max_tokens" ? "length"
      : stop === "refusal" ? "refusal"
      : "other";

    if (text === "" && finish !== "refusal") throw invalidResponse(providerId, "no text block");

    const usage = json.usage && Number.isFinite(json.usage.input_tokens)
      ? { input_tokens: json.usage.input_tokens, output_tokens: json.usage.output_tokens ?? 0 }
      : null;

    return {
      text,
      model: modelName(json.model, model),
      provider: providerId,
      finish,
      usage,
    };
  },
});
