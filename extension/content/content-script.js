// Fact It - content script (V0.1 shell).
//
// Runs in an isolated world on http/https pages. It must never receive
// API keys. In V0.1 it only confirms that it executed and that the
// service worker is reachable. It does not modify the page.

(() => {
  console.log("[Fact It] content script loaded:", location.href);

  chrome.runtime.sendMessage({ type: "FACTIT_PING" }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn("[Fact It] service worker unreachable:", chrome.runtime.lastError.message);
      return;
    }
    console.log("[Fact It] service worker responded:", response);
  });
})();
