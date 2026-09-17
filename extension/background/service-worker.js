// Fact It - background service worker (V0.4).
//
// Privileged extension context. Provider requests are made here so that
// API keys never reach content scripts or the webpage.

import { createSettingsStore } from "../storage/settings.js";
import { createProvider, ProviderError } from "../providers/provider.js";

const settings = createSettingsStore();

chrome.runtime.onInstalled.addListener((details) => {
  console.log(`[Fact It] service worker installed (${details.reason})`);
});

// True only for the extension's own pages (settings page). Content scripts
// report the webpage's http(s) URL/origin here, set by the browser, so
// they can never pass this check.
function isExtensionPage(sender) {
  const extensionOrigin = chrome.runtime.getURL("").replace(/\/$/, "");
  return Boolean(
    sender &&
      sender.id === chrome.runtime.id &&
      typeof sender.url === "string" &&
      sender.url.startsWith(extensionOrigin + "/") &&
      (sender.origin === undefined || sender.origin === extensionOrigin),
  );
}

// Minimal round trip to confirm the configured provider works. Returns
// only what the settings page needs to show; never the key.
async function testProvider() {
  const provider = createProvider(await settings.get());
  const result = await provider.complete({
    system: "You are a connectivity check. Reply with the single word OK.",
    input: "ping",
    maxTokens: 16,
  });
  return {
    ok: true,
    provider: provider.id,
    model: result.model,
    finish: result.finish,
    sample: result.text.slice(0, 40),
    usage: result.usage,
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!sender || sender.id !== chrome.runtime.id) return false;
  if (!message || typeof message.type !== "string") return false;

  switch (message.type) {
    case "FACTIT_PING":
      sendResponse({ type: "FACTIT_PONG", version: chrome.runtime.getManifest().version });
      return false;

    case "FACTIT_TEST_PROVIDER":
      if (!isExtensionPage(sender)) return false;
      testProvider()
        .then(sendResponse)
        .catch((error) => {
          const detail = error instanceof ProviderError
            ? error.toJSON()
            : { kind: "unknown", message: "Unexpected error." };
          sendResponse({ ok: false, error: detail });
        });
      return true; // async

    default:
      return false;
  }
});
