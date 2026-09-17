# Fact It - Development

## Requirements

- Chromium or Google Chrome (Manifest V3, Chrome 88+)
- Node.js 20+ (tests only; the extension itself has no build step and
  no dependencies)

## Load the extension (unpacked)

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked**.
4. Select the `extension/` directory of this repository.

The extension appears as **Fact It** with no errors shown on its card.

After editing files under `extension/`, click the reload icon on the
extension card. Pages that already have the content script need a
reload as well.

## Verify

Service worker:

1. On `chrome://extensions`, click **Service worker** on the Fact It
   card. A DevTools window opens for the worker.
2. With that window still open, click the reload icon on the card.
   The console shows `[Fact It] service worker installed (update)`.

The console is empty if you open it after installation: `onInstalled`
runs once, the worker then goes idle (`service worker (Inactive)`),
and waking it by clicking the link does not run `onInstalled` again.
Messages logged before DevTools attached are not replayed.

Content script:

1. Open any normal `http://` or `https://` page.
2. Open DevTools > Console.
3. The console shows `[Fact It] content script loaded: <url>` followed
   by `[Fact It] service worker responded: {type: "FACTIT_PONG", ...}`.

Content scripts do not run on `chrome://` pages, the Chrome Web Store,
or `file://` URLs.

Settings page:

1. On `chrome://extensions`, open **Details** on the Fact It card.
2. Click **Extension options**. The settings page opens in a new tab.

## Tests

Unit tests (no browser required):

```bash
npm test
```

Browser smoke test (loads the unpacked extension in headless Chromium
and checks the service worker, content script and settings page):

```bash
npm run test:smoke
```

The smoke test needs a Chromium build that honours `--load-extension`.
Branded Google Chrome 137 and later ignores that flag, so the test
defaults to the `chromium` binary. Point it elsewhere with
`FACTIT_BROWSER=/path/to/chromium npm run test:smoke`.

## Permissions

SECURITY.md requires a documented reason for every permission.

Current state (V0.1):

| Manifest key         | Value                          | Reason |
|----------------------|--------------------------------|--------|
| `permissions`        | `[]`                           | Nothing is needed yet. |
| `host_permissions`   | not declared                   | No cross-origin requests yet. |
| `content_scripts[].matches` | `http://*/*`, `https://*/*` | Fact It analyses ordinary web pages, so the content script must be able to run on any http/https page. `<all_urls>` is deliberately not used; it would also cover `file://` and other schemes. Chrome shows this as "Read and change all your data on all websites" at install time. |

Any addition must be justified here and reflected in
`tests/unit/manifest.test.js`.

## Layout

```
extension/
  manifest.json
  background/service-worker.js   privileged context; future provider calls
  content/content-script.js      runs on pages; never receives API keys
  options/                       settings page (options_ui)
tests/
  unit/                          node:test, hermetic
  integration/smoke.mjs          headless Chromium smoke test
```
