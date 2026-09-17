// Fact It - provider layer shared pieces (V0.4).
//
// Errors, redaction and the single HTTP round trip used by every adapter.
// Kept separate from provider.js (the registry) so adapters can import
// this file without a circular dependency.
//
// Responses and error bodies come from the network and are UNTRUSTED: they
// are parsed defensively, size-capped and never trusted to be well formed.


export const DEFAULT_MAX_TOKENS = 4096;
export const REQUEST_TIMEOUT_MS = 60_000;
// One automatic retry for transient failures. A rejected request produced
// no output, so retrying does not double the token cost.
const RETRY_STATUSES = new Set([429, 500, 502, 503, 504, 529]);
const RETRY_DELAY_MS = 1500;
const RETRY_DELAY_MAX_MS = 5000;
const MAX_ERROR_MESSAGE_CHARS = 200;

/** Error kinds the rest of the extension can act on. */
export const ERROR_KINDS = Object.freeze({
  CONFIG: "config", // missing key, bad base URL, unknown provider
  NETWORK: "network", // fetch failed, timeout
  AUTH: "auth", // 401 / 403
  BILLING: "billing", // 402
  NOT_FOUND: "not_found", // 404: endpoint or model
  INVALID_REQUEST: "invalid_request", // 400 / 413 / 422
  RATE_LIMIT: "rate_limit", // 429
  SERVER: "server", // 5xx
  INVALID_RESPONSE: "invalid_response", // not JSON / unexpected shape
});

export class ProviderError extends Error {
  /**
   * @param {string} kind one of ERROR_KINDS
   * @param {string} message safe to show to the user (already redacted)
   * @param {{ status?: number, provider?: string }} [details]
   */
  constructor(kind, message, details = {}) {
    super(message);
    this.name = "ProviderError";
    this.kind = kind;
    this.status = details.status ?? null;
    this.provider = details.provider ?? null;
  }

  toJSON() {
    return { kind: this.kind, message: this.message, status: this.status, provider: this.provider };
  }
}

// One HTTP round trip with timeout, status mapping and defensive parsing,
// plus a single retry on transient statuses.
export async function send(fetchImpl, url, headers, body, providerId, apiKey, options = {}) {
  const sleep = options.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const request = () => fetchImpl(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  let response;
  try {
    response = await request();
    if (RETRY_STATUSES.has(response.status)) {
      const retryAfter = Number(response.headers && typeof response.headers.get === "function" ? response.headers.get("retry-after") : NaN);
      const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, RETRY_DELAY_MAX_MS) : RETRY_DELAY_MS;
      await sleep(delay);
      response = await request();
    }
  } catch (error) {
    throw new ProviderError(
      ERROR_KINDS.NETWORK,
      redact(`Request failed: ${error && error.message ? error.message : "network error"}`, apiKey),
      { provider: providerId },
    );
  }

  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  if (!response.ok) {
    const apiMessage = json && json.error && typeof json.error.message === "string"
      ? json.error.message
      : `HTTP ${response.status}`;
    throw new ProviderError(
      statusToKind(response.status),
      redact(apiMessage, apiKey),
      { status: response.status, provider: providerId },
    );
  }

  if (json === null || typeof json !== "object") {
    throw new ProviderError(ERROR_KINDS.INVALID_RESPONSE, "Provider returned a non-JSON response.", {
      status: response.status,
      provider: providerId,
    });
  }
  return json;
}

export function statusToKind(status) {
  if (status === 401 || status === 403) return ERROR_KINDS.AUTH;
  if (status === 402) return ERROR_KINDS.BILLING;
  if (status === 404) return ERROR_KINDS.NOT_FOUND;
  if (status === 429) return ERROR_KINDS.RATE_LIMIT;
  if (status >= 500) return ERROR_KINDS.SERVER;
  return ERROR_KINDS.INVALID_REQUEST;
}

/**
 * Remove anything that looks like a credential from text destined for the
 * UI or logs, and cap its length (error bodies are untrusted).
 */
export function redact(text, apiKey) {
  let out = typeof text === "string" ? text : "";
  if (apiKey && apiKey.length >= 8) out = out.split(apiKey).join("[redacted]");
  out = out.replace(/\b(sk|key|token)[-_][A-Za-z0-9_-]{8,}/g, "[redacted]");
  out = out.replace(/Bearer\s+[A-Za-z0-9._-]{8,}/g, "Bearer [redacted]");
  out = out.replace(/\s+/g, " ").trim();
  return out.length > MAX_ERROR_MESSAGE_CHARS ? out.slice(0, MAX_ERROR_MESSAGE_CHARS) + "…" : out;
}

/** Shared helper for adapters: assert a non-empty API key. */
export function requireApiKey(settings, providerId) {
  const key = settings && typeof settings.apiKey === "string" ? settings.apiKey.trim() : "";
  if (!key) {
    throw new ProviderError(ERROR_KINDS.CONFIG, "An API key is required.", { provider: providerId });
  }
  return key;
}

/** Shared helper for adapters: pull text and usage safely from a response. */
export function invalidResponse(providerId, what) {
  return new ProviderError(ERROR_KINDS.INVALID_RESPONSE, `Unexpected response from provider: ${what}.`, {
    provider: providerId,
  });
}
