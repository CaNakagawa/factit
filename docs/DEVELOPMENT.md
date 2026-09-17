# Fact It - Development

## Requirements

- Chromium or Google Chrome (Manifest V3, Chrome 88+)
- Node.js 20+ (tests and vendoring only; the extension itself has no
  build step)

```bash
npm install
```

installs dev-only dependencies: `@mozilla/readability` (source of the
vendored extraction library) and `jsdom` (extraction tests).

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

Article extraction and normalization:

1. Open a news article or blog post.
2. The page console shows `[Fact It] article: {title, author,
   published_at, language, content_chars, truncated, links, images,
   content_hash}`. Only this summary is logged, never the article text.
3. On pages that do not look like an article (search results, home
   pages, dashboards) it shows `no article detected`. That is a valid
   result, not an error.

To inspect the full ArticleDocument (docs/ARTICLE_SCHEMA.md), open the
service worker console and run:

```js
chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) =>
  chrome.tabs.sendMessage(tab.id, { type: "FACTIT_EXTRACT" }, console.log));
```

Settings page:

1. On `chrome://extensions`, open **Details** on the Fact It card.
2. Click **Extension options**. The settings page opens in a new tab.

Provider connection:

1. On the settings page choose a provider, paste an API key (or, for an
   OpenAI-compatible server, enter its base URL and model) and click
   **Test connection**. The settings are saved first, then the
   background worker sends a tiny request and reports the model that
   answered, or an error kind (`config`, `auth`, `network`,
   `rate_limit`, ...) with the provider's message.
2. The key is never displayed again after saving. **Remove key** clears
   it.

Provider requests are made only by the background worker; the settings
page and content scripts never call providers directly.

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

## Vendored code

`extension/vendor/` holds a committed copy of Mozilla Readability
(Apache-2.0). Content scripts cannot be ES modules and the project has
no bundler, so the files are shipped as classic scripts. Never edit
them by hand; bump the pinned version in `package.json` and run:

```bash
npm run vendor
```

`tests/unit/vendor.test.js` fails if the copies drift from
`node_modules`.

## Permissions

SECURITY.md requires a documented reason for every permission.

Current state (V0.4):

| Manifest key         | Value                          | Reason |
|----------------------|--------------------------------|--------|
| `permissions`        | `["storage"]`                  | `chrome.storage.local` holds the provider settings and API key (V0.4). Not encrypted; stated on the settings page. |
| `host_permissions`   | not declared                   | Provider requests from the background worker work without it: Chrome grants host access for the content-script match patterns below, which already cover every http/https origin. Verified in `tests/integration/smoke.mjs` against a non-CORS local server. |
| `content_scripts[].matches` | `http://*/*`, `https://*/*` | Fact It analyses ordinary web pages, so the content script must be able to run on any http/https page. `<all_urls>` is deliberately not used; it would also cover `file://` and other schemes. Chrome shows this as "Read and change all your data on all websites" at install time. |

Any addition must be justified here and reflected in
`tests/unit/manifest.test.js`.

## Layout

```
extension/
  manifest.json
  background/service-worker.js   privileged context; future provider calls
  content/content-script.js      runs on pages; never receives API keys
  content/extractor.js           Readability-based article extraction
  content/normalize.js           extraction -> ArticleDocument (+ hash)
  utils/hash.js                  SHA-256 via WebCrypto
  providers/provider.js          registry + createProvider (common interface)
  providers/common.js            ProviderError, redaction, HTTP round trip
  providers/openai.js            adapters (also anthropic.js,
                                 openai-compatible.js)
  storage/settings.js            provider settings + key (storage.local)
  vendor/                        committed copy of Mozilla Readability
  options/                       settings page (options_ui, ES module)
scripts/vendor-readability.mjs   refreshes extension/vendor/
tests/
  unit/                          node:test + jsdom, hermetic
  fixtures/                      HTML pages used by tests
  integration/smoke.mjs          headless Chromium smoke test
```
