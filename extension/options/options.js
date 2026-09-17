// Fact It - settings page (V0.4).
//
// Extension page (privileged). Reads and writes settings directly; provider
// requests are delegated to the background worker. The stored API key is
// never written back into the form.

import { createSettingsStore } from "../storage/settings.js";
import { PROVIDERS } from "../providers/provider.js";

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
      setStatus(`Connected: ${reply.provider} / ${reply.model} replied "${reply.sample}".`, "ok");
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

load().then(refreshCacheCount);
