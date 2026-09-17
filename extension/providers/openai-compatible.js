// Fact It - OpenAI-compatible adapter (V0.4).
//
// For self-hosted or third-party servers that speak the Chat Completions
// API (Ollama, LM Studio, vLLM, gateways...). The user supplies the base
// URL, so it is validated strictly: credentials are only ever sent to the
// exact origin the user configured.

import { ERROR_KINDS, ProviderError } from "./common.js";
import { parseChatCompletion } from "./openai.js";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Validate a user-supplied base URL. Returns the normalized base (no
 * trailing slash) or throws a ProviderError of kind "config".
 */
export function validateBaseUrl(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (raw === "") throw configError("A base URL is required (for example http://localhost:11434/v1).");

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw configError("The base URL is not a valid absolute URL.");
  }

  const loopback = LOOPBACK_HOSTS.has(url.hostname);
  if (url.protocol === "http:" && !loopback) {
    throw configError("Plain http is only allowed for localhost; use https for remote servers.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw configError("The base URL must use http or https.");
  }
  if (url.username || url.password) throw configError("The base URL must not contain credentials.");
  if (url.search || url.hash) throw configError("The base URL must not contain a query string or fragment.");

  return url.href.replace(/\/+$/, "");
}

function configError(message) {
  return new ProviderError(ERROR_KINDS.CONFIG, message, { provider: "openai-compatible" });
}

export const openaiCompatibleProvider = Object.freeze({
  id: "openai-compatible",
  label: "OpenAI-compatible (custom endpoint)",
  defaultModel: "",
  needsBaseUrl: true,
  needsApiKey: false, // local servers often need none

  configure(settings) {
    const baseUrl = validateBaseUrl(settings && settings.baseUrl);
    const apiKey = settings && typeof settings.apiKey === "string" ? settings.apiKey.trim() : "";
    if (!(settings && typeof settings.model === "string" && settings.model.trim())) {
      throw configError("A model name is required for a custom endpoint.");
    }
    return { baseUrl, apiKey };
  },

  buildRequest(config, req) {
    const headers = {};
    if (config.apiKey) headers.authorization = `Bearer ${config.apiKey}`;
    return {
      url: `${config.baseUrl}/chat/completions`,
      headers,
      body: {
        model: req.model,
        max_tokens: req.maxTokens,
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
