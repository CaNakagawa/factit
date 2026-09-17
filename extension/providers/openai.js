// Fact It - OpenAI adapter (V0.4).
//
// Chat Completions API. System instructions go in the `system` role and the
// untrusted article in the `user` role, never concatenated.

import { invalidResponse, modelName, requireApiKey } from "./common.js";

const ENDPOINT = "https://api.openai.com/v1/chat/completions";

export const openaiProvider = Object.freeze({
  id: "openai",
  label: "OpenAI",
  defaultModel: "gpt-4o-mini",
  needsBaseUrl: false,
  needsApiKey: true,

  configure(settings) {
    return { apiKey: requireApiKey(settings, "openai") };
  },

  buildRequest(config, req) {
    return {
      url: ENDPOINT,
      headers: { authorization: `Bearer ${config.apiKey}` },
      body: {
        model: req.model,
        max_completion_tokens: req.maxTokens,
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: req.input },
        ],
      },
    };
  },

  parseResponse(json, providerId, model) {
    return parseChatCompletion(json, providerId, model);
  },
});

/** Shared with the OpenAI-compatible adapter. */
export function parseChatCompletion(json, providerId, model) {
  const choice = Array.isArray(json.choices) ? json.choices[0] : null;
  const content = choice && choice.message ? choice.message.content : null;
  if (typeof content !== "string") throw invalidResponse(providerId, "missing message content");

  const finishReason = choice.finish_reason;
  const finish = finishReason === "stop" ? "stop"
    : finishReason === "length" ? "length"
    : finishReason === "content_filter" ? "refusal"
    : "other";

  const usage = json.usage && Number.isFinite(json.usage.prompt_tokens)
    ? { input_tokens: json.usage.prompt_tokens, output_tokens: json.usage.completion_tokens ?? 0 }
    : null;

  return {
    text: content,
    model: modelName(json.model, model),
    provider: providerId,
    finish,
    usage,
  };
}
