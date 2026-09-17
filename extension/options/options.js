// Fact It - settings page (V0.4).
//
// Extension page (privileged). Reads and writes settings directly; provider
// requests are delegated to the background worker. The stored API key is
// never written back into the form.

import { createSettingsStore } from "../storage/settings.js";
import { PROVIDERS } from "../providers/provider.js";
import { knownPrice, formatUsd } from "../providers/pricing.js";

const store = createSettingsStore();
const $ = (id) => document.getElementById(id);

const form = $("settings");
const providerSelect = $("provider");
const baseUrlField = $("baseUrlField");
const baseUrlInput = $("baseUrl");
const apiKeyInput = $("apiKey");
const apiKeyHint = $("apiKeyHint");
const modelInput = $("model");
const modelHint = $("modelHint");
const inputPrice = $("inputPrice");
const outputPrice = $("outputPrice");
const priceHint = $("priceHint");
const status = $("status");

let hasStoredKey = false;

function definition() {
  return PROVIDERS.find((p) => p.id === providerSelect.value) || PROVIDERS[0];
}

function setStatus(text, kind = "") {
  status.textContent = text;
  status.className = kind;
}

function renderProviderFields() {
  const def = definition();
  baseUrlField.hidden = !def.needsBaseUrl;
  modelInput.placeholder = def.defaultModel || "model name";
  modelHint.textContent = def.defaultModel
    ? `Leave empty to use ${def.defaultModel}.`
    : "Required. Use the model name your server expects.";
  apiKeyInput.placeholder = hasStoredKey ? "(saved - leave empty to keep)" : "";
  apiKeyHint.textContent = def.needsApiKey
    ? "Required. Stored locally, never shown again."
    : "Optional for local servers. Stored locally, never shown again.";
  suggestPrices();
}

// Pre-fill list prices we know (Anthropic models); never overwrite what
// the user typed.
function suggestPrices() {
  const model = modelInput.value.trim() || definition().defaultModel;
  const known = knownPrice(providerSelect.value, model);
  if (known && inputPrice.value.trim() === "" && outputPrice.value.trim() === "") {
    inputPrice.value = String(known.input);
    outputPrice.value = String(known.output);
  }
  priceHint.textContent = known
    ? `List price for ${model}: $${known.input} in / $${known.output} out per 1M tokens (pre-filled; edit if your plan differs).`
    : "Optional. Used only to estimate the cost of each analysis; leave empty to see token counts only. Check your provider's pricing page.";
}

async function load() {
  for (const p of PROVIDERS) {
    const option = document.createElement("option");
    option.value = p.id;
    option.textContent = p.label;
    providerSelect.append(option);
  }

  const settings = await store.get();
  providerSelect.value = settings.provider;
  baseUrlInput.value = settings.baseUrl;
  modelInput.value = settings.model;
  inputPrice.value = settings.inputPricePerM;
  outputPrice.value = settings.outputPricePerM;
  hasStoredKey = settings.apiKey !== "";
  apiKeyInput.value = "";
  renderProviderFields();

  $("version").textContent = chrome.runtime.getManifest().version;
}

async function save() {
  const patch = {
    provider: providerSelect.value,
    model: modelInput.value,
    baseUrl: baseUrlInput.value,
    inputPricePerM: inputPrice.value,
    outputPricePerM: outputPrice.value,
  };
  // Only replace the key when the user typed one.
  if (apiKeyInput.value.trim() !== "") patch.apiKey = apiKeyInput.value;

  const saved = await store.update(patch);
  hasStoredKey = saved.apiKey !== "";
  apiKeyInput.value = "";
  renderProviderFields();
  return saved;
}

providerSelect.addEventListener("change", renderProviderFields);
modelInput.addEventListener("change", suggestPrices);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await save();
  setStatus("Saved.", "ok");
});

$("removeKey").addEventListener("click", async () => {
  await store.clearApiKey();
  hasStoredKey = false;
  apiKeyInput.value = "";
  renderProviderFields();
  setStatus("API key removed.", "ok");
});

$("test").addEventListener("click", async () => {
  const button = $("test");
  button.disabled = true;
  setStatus("Saving and testing…");
  try {
    await save();
    const reply = await chrome.runtime.sendMessage({ type: "FACTIT_TEST_PROVIDER" });
    if (reply && reply.ok) {
      const cost = reply.cost && Number.isFinite(reply.cost.usd) ? ` Cost ≈ ${formatUsd(reply.cost.usd)}.` : "";
      setStatus(`Connected: ${reply.provider} / ${reply.model} replied "${reply.sample}".${cost}`, "ok");
      refreshUsage();
    } else {
      const err = (reply && reply.error) || { kind: "unknown", message: "No response from background." };
      setStatus(`Failed (${err.kind}): ${err.message}`, "error");
    }
  } catch (error) {
    setStatus(`Failed: ${error && error.message ? error.message : "unknown error"}`, "error");
  } finally {
    button.disabled = false;
  }
});

async function refreshUsage() {
  const t = await chrome.runtime.sendMessage({ type: "FACTIT_USAGE_STATS" });
  if (!t) return;
  const n = (v) => Number(v || 0).toLocaleString();
  const since = t.since ? ` since ${new Date(t.since).toLocaleDateString()}` : "";
  $("usageTotals").textContent = t.requests
    ? `${n(t.requests)} request${t.requests === 1 ? "" : "s"}${since}: ${n(t.input_tokens)} input + ${n(t.output_tokens)} output tokens, estimated ${formatUsd(t.cost_usd)} (only requests made with prices set are counted in the estimate).`
    : "No requests yet.";
}

$("resetUsage").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "FACTIT_USAGE_RESET" });
  await refreshUsage();
});

async function refreshCacheCount() {
  const stats = await chrome.runtime.sendMessage({ type: "FACTIT_CACHE_STATS" });
  const n = stats && Number.isFinite(stats.count) ? stats.count : 0;
  $("cacheCount").textContent = `${n} cached ${n === 1 ? "analysis" : "analyses"}.`;
}

$("clearCache").addEventListener("click", async () => {
  const reply = await chrome.runtime.sendMessage({ type: "FACTIT_CACHE_CLEAR" });
  const n = reply && reply.removed ? reply.removed : 0;
  $("cacheStatus").textContent = `Removed ${n} cached ${n === 1 ? "analysis" : "analyses"}.`;
  await refreshCacheCount();
});

load().then(() => Promise.all([refreshCacheCount(), refreshUsage()]));
