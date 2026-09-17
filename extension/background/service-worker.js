// Fact It - background service worker (V0.1 shell).
//
// Privileged extension context. In later milestones this is where
// provider requests are made so that API keys never reach content scripts.

const PING = "FACTIT_PING";

chrome.runtime.onInstalled.addListener((details) => {
  console.log(`[Fact It] service worker installed (${details.reason})`);
});

// Minimal message channel so the content script can be verified end to end.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Only accept messages from this extension's own scripts.
  if (!sender || sender.id !== chrome.runtime.id) {
    return false;
  }

  if (message && message.type === PING) {
    sendResponse({ type: "FACTIT_PONG", version: chrome.runtime.getManifest().version });
  }

  return false;
});
