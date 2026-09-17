// Provider adapters are tested with an injected fetch; no network, no LLM.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createProvider,
  ProviderError,
  ERROR_KINDS,
  PROVIDERS,
  redact,
  DEFAULT_MAX_TOKENS,
} from "../../extension/providers/provider.js";
import { validateBaseUrl } from "../../extension/providers/openai-compatible.js";

const KEY = "sk-test-1234567890abcdef";

// Records the request and returns a canned response.
function fakeFetch(status, body, { raw = false } = {}) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => (raw ? body : JSON.stringify(body)),
    };
  };
  fn.calls = calls;
  return fn;
}

const openaiReply = {
  model: "gpt-4o-mini-2024",
  choices: [{ message: { role: "assistant", content: "OK" }, finish_reason: "stop" }],
  usage: { prompt_tokens: 12, completion_tokens: 1 },
};

const anthropicReply = {
  model: "claude-opus-5",
  content: [{ type: "text", text: "OK" }],
  stop_reason: "end_turn",
  usage: { input_tokens: 12, output_tokens: 1 },
};

test("registry exposes the three initial providers with a common shape", () => {
  assert.deepEqual(PROVIDERS.map((p) => p.id), ["openai", "anthropic", "openai-compatible"]);
  for (const p of PROVIDERS) {
    for (const fn of ["configure", "buildRequest", "parseResponse"]) assert.equal(typeof p[fn], "function");
    assert.equal(typeof p.label, "string");
  }
});

test("openai: request shape keeps system and article in separate roles", async () => {
  const fetch = fakeFetch(200, openaiReply);
  const provider = createProvider({ provider: "openai", apiKey: KEY, model: "", baseUrl: "" }, { fetch });
  const result = await provider.complete({ system: "SYS", input: "ARTICLE", maxTokens: 99 });

  const [call] = fetch.calls;
  assert.equal(call.url, "https://api.openai.com/v1/chat/completions");
  assert.equal(call.init.method, "POST");
  assert.equal(call.init.headers.authorization, `Bearer ${KEY}`);
  assert.equal(call.init.headers["content-type"], "application/json");
  assert.deepEqual(call.body.messages, [
    { role: "system", content: "SYS" },
    { role: "user", content: "ARTICLE" },
  ]);
  assert.equal(call.body.model, "gpt-4o-mini");
  assert.equal(call.body.max_completion_tokens, 99);
  assert.ok(call.init.signal instanceof AbortSignal);

  assert.deepEqual(result, {
    text: "OK",
    model: "gpt-4o-mini-2024",
    provider: "openai",
    finish: "stop",
    usage: { input_tokens: 12, output_tokens: 1 },
  });
});

test("anthropic: request shape uses system field, user turn and browser headers", async () => {
  const fetch = fakeFetch(200, anthropicReply);
  const provider = createProvider({ provider: "anthropic", apiKey: KEY, model: "", baseUrl: "" }, { fetch });
  const result = await provider.complete({ system: "SYS", input: "ARTICLE" });

  const [call] = fetch.calls;
  assert.equal(call.url, "https://api.anthropic.com/v1/messages");
  assert.equal(call.init.headers["x-api-key"], KEY);
  assert.equal(call.init.headers["anthropic-version"], "2023-06-01");
  assert.equal(call.init.headers["anthropic-dangerous-direct-browser-access"], "true");
  assert.equal(call.init.headers.authorization, undefined);
  assert.equal(call.body.model, "claude-opus-5");
  assert.equal(call.body.system, "SYS");
  assert.deepEqual(call.body.messages, [{ role: "user", content: "ARTICLE" }]);
  assert.equal(call.body.max_tokens, DEFAULT_MAX_TOKENS);

  assert.equal(result.text, "OK");
  assert.equal(result.provider, "anthropic");
  assert.equal(result.finish, "stop");
  assert.deepEqual(result.usage, { input_tokens: 12, output_tokens: 1 });
});

test("anthropic: joins text blocks and maps stop reasons", async () => {
  const reply = { ...anthropicReply, content: [{ type: "text", text: "A" }, { type: "tool_use" }, { type: "text", text: "B" }], stop_reason: "max_tokens" };
  const provider = createProvider({ provider: "anthropic", apiKey: KEY }, { fetch: fakeFetch(200, reply) });
  const result = await provider.complete({ system: "s", input: "i" });
  assert.equal(result.text, "AB");
  assert.equal(result.finish, "length");

  const refused = createProvider({ provider: "anthropic", apiKey: KEY }, { fetch: fakeFetch(200, { ...anthropicReply, content: [], stop_reason: "refusal" }) });
  assert.equal((await refused.complete({ system: "s", input: "i" })).finish, "refusal");
});

test("openai-compatible: custom base URL, optional key, max_tokens field", async () => {
  const fetch = fakeFetch(200, openaiReply);
  const provider = createProvider(
    { provider: "openai-compatible", apiKey: "", model: "llama3", baseUrl: "http://localhost:11434/v1/" },
    { fetch },
  );
  await provider.complete({ system: "SYS", input: "ARTICLE" });
  const [call] = fetch.calls;
  assert.equal(call.url, "http://localhost:11434/v1/chat/completions");
  assert.equal(call.init.headers.authorization, undefined);
  assert.equal(call.body.model, "llama3");
  assert.equal(call.body.max_tokens, DEFAULT_MAX_TOKENS);

  const withKey = fakeFetch(200, openaiReply);
  await createProvider({ provider: "openai-compatible", apiKey: KEY, model: "m", baseUrl: "https://gw.example/v1" }, { fetch: withKey })
    .complete({ system: "s", input: "i" });
  assert.equal(withKey.calls[0].init.headers.authorization, `Bearer ${KEY}`);
});

test("openai-compatible: base URL validation", () => {
  assert.equal(validateBaseUrl("https://gw.example/v1/"), "https://gw.example/v1");
  assert.equal(validateBaseUrl("http://127.0.0.1:1234/v1"), "http://127.0.0.1:1234/v1");
  assert.equal(validateBaseUrl("http://[::1]:1234/v1"), "http://[::1]:1234/v1");

  const rejects = (value, pattern) => {
    assert.throws(() => validateBaseUrl(value), (e) => e instanceof ProviderError && e.kind === ERROR_KINDS.CONFIG && pattern.test(e.message));
  };
  rejects("", /required/);
  rejects("not a url", /valid absolute URL/);
  rejects("http://api.example.com/v1", /localhost/);
  rejects("ftp://localhost/v1", /http or https/);
  rejects("https://user:pw@gw.example/v1", /credentials/);
  rejects("https://gw.example/v1?x=1", /query/);
  rejects("https://gw.example/v1#frag", /query|fragment/);
});

test("openai-compatible: model name is required", () => {
  assert.throws(
    () => createProvider({ provider: "openai-compatible", apiKey: "", model: "", baseUrl: "http://localhost:1/v1" }),
    (e) => e.kind === ERROR_KINDS.CONFIG && /model/i.test(e.message),
  );
});

test("configuration errors: unknown provider and missing key", () => {
  assert.throws(() => createProvider({ provider: "nope" }), (e) => e.kind === ERROR_KINDS.CONFIG);
  assert.throws(() => createProvider({ provider: "openai", apiKey: "  " }), (e) => e.kind === ERROR_KINDS.CONFIG && /API key/.test(e.message));
  assert.throws(() => createProvider({ provider: "anthropic", apiKey: "" }), (e) => e.kind === ERROR_KINDS.CONFIG);
});

test("http status codes map to error kinds and API messages are surfaced", async () => {
  const cases = [
    [400, ERROR_KINDS.INVALID_REQUEST],
    [401, ERROR_KINDS.AUTH],
    [402, ERROR_KINDS.BILLING],
    [403, ERROR_KINDS.AUTH],
    [404, ERROR_KINDS.NOT_FOUND],
    [413, ERROR_KINDS.INVALID_REQUEST],
    [429, ERROR_KINDS.RATE_LIMIT],
    [500, ERROR_KINDS.SERVER],
    [529, ERROR_KINDS.SERVER],
  ];
  for (const [status, kind] of cases) {
    const provider = createProvider({ provider: "openai", apiKey: KEY }, { fetch: fakeFetch(status, { error: { message: `boom ${status}` } }) });
    await assert.rejects(provider.complete({ system: "s", input: "i" }), (e) => {
      assert.ok(e instanceof ProviderError);
      assert.equal(e.kind, kind, `status ${status}`);
      assert.equal(e.status, status);
      assert.equal(e.message, `boom ${status}`);
      return true;
    });
  }
});

test("network failure and timeout become kind network", async () => {
  const failing = async () => { throw new Error("Failed to fetch"); };
  const provider = createProvider({ provider: "openai", apiKey: KEY }, { fetch: failing });
  await assert.rejects(provider.complete({ system: "s", input: "i" }), (e) => e.kind === ERROR_KINDS.NETWORK);
});

test("malformed provider output becomes kind invalid_response", async () => {
  const bad = [
    fakeFetch(200, "<html>not json</html>", { raw: true }),
    fakeFetch(200, { choices: [] }),
    fakeFetch(200, { choices: [{ message: { content: 42 } }] }),
  ];
  for (const fetch of bad) {
    const provider = createProvider({ provider: "openai", apiKey: KEY }, { fetch });
    await assert.rejects(provider.complete({ system: "s", input: "i" }), (e) => e.kind === ERROR_KINDS.INVALID_RESPONSE);
  }
  const anthropicBad = createProvider({ provider: "anthropic", apiKey: KEY }, { fetch: fakeFetch(200, { content: "nope" }) });
  await assert.rejects(anthropicBad.complete({ system: "s", input: "i" }), (e) => e.kind === ERROR_KINDS.INVALID_RESPONSE);
});

test("API keys never appear in error messages", async () => {
  const echoing = fakeFetch(401, { error: { message: `Incorrect API key provided: ${KEY}. Bearer ${KEY} sk-abcdefghijklmnop` } });
  const provider = createProvider({ provider: "openai", apiKey: KEY }, { fetch: echoing });
  await assert.rejects(provider.complete({ system: "s", input: "i" }), (e) => {
    assert.doesNotMatch(e.message, /1234567890abcdef/);
    assert.doesNotMatch(e.message, /sk-abcdefghijklmnop/);
    assert.doesNotMatch(JSON.stringify(e.toJSON()), /1234567890abcdef/);
    return true;
  });
  assert.equal(redact(`key ${KEY} here`, KEY), "key [redacted] here");
  assert.equal(redact("token_ABCDEFGHIJ12 and key-abcdefghijk", ""), "[redacted] and [redacted]");
});

test("error messages from providers are length-capped", async () => {
  const provider = createProvider({ provider: "openai", apiKey: KEY }, { fetch: fakeFetch(500, { error: { message: "x".repeat(5000) } }) });
  await assert.rejects(provider.complete({ system: "s", input: "i" }), (e) => e.message.length <= 201);
});

test("complete() validates its request", async () => {
  const provider = createProvider({ provider: "openai", apiKey: KEY }, { fetch: fakeFetch(200, openaiReply) });
  await assert.rejects(provider.complete({ input: "no system" }), (e) => e.kind === ERROR_KINDS.CONFIG);
  await assert.rejects(provider.complete({ system: "s", input: 5 }), (e) => e.kind === ERROR_KINDS.CONFIG);
});
