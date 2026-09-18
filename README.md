# Fact It

Know what you're reading.

Fact It is an open-source Chromium extension that gives you a
**preliminary, AI-assisted analysis** of the article you are reading:
which claims it makes, how well the article itself supports them,
what information is missing, and where framing may be at play.

It is not a truth oracle. It never consults external sources. It tells
you what deserves a second look.

## How it works

1. You open an article. Fact It extracts the main text **locally** in
   your browser (Mozilla Readability) and shows a thin, idle bar at the
   top of the page. Nothing has been sent anywhere.
2. You click **Analyze**. The extracted text goes **directly from your
   browser to the AI provider you configured, with your own API key**
   (bring your own key). Fact It runs no servers and never sees your
   key or your articles.
3. The model's answer is validated against a strict schema and shown
   in the bar: **article support** (how well the article backs its own
   claims), how many claims need review, always labelled *AI
   preliminary · not externally verified*.
4. Click **Details** for the **Summary**: the score, analysis
   confidence, the verification level, three counters (supported
   within article / need external verification / evidence or context
   issues), key findings and possible framing. From there, **Detailed
   analysis** opens tabs: Overview (rationale, highlights: supported
   in article vs needs review), Claims (each expandable: support,
   evidence type, article evidence, what may be missing, possible
   reader inference, issues, external verification status), Evidence
   (evidence profile and side-by-side), Framing (observable
   characteristics) and About (provider, model, prompt version, tokens,
   cost).
5. The result is cached locally by a hash of the article text, so
   revisiting the same article costs nothing. **Re-analyze** is always
   explicit.

```
Web page -> local extraction -> normalization -> ArticleDocument
        -> your provider (BYOK) -> LLM -> JSON -> schema validation
        -> Fact It bar -> details panel -> local cache
```

## Install (developer preview)

Fact It is not on the Chrome Web Store yet.

1. Download `factit-<version>.zip` from the releases, or build it with
   `npm run package`, and unzip it - or clone this repository and use
   its `extension/` folder directly.
2. Open `chrome://extensions`, enable **Developer mode**, click **Load
   unpacked** and select the folder containing `manifest.json`.
3. Pin **Fact It** from the extensions menu (puzzle icon).

Works in Chrome, Chromium, Brave, Edge and other Chromium browsers
(Manifest V3, Chrome 116+).

## Configure a provider

Open the extension's **Options** (right-click the Fact It icon, or
`chrome://extensions` -> Details -> Extension options):

| Provider | What to enter |
|---|---|
| **OpenAI** | API key. Model defaults to `gpt-4o-mini`; change it if you like. |
| **Anthropic** | API key. Model defaults to `claude-opus-5`; `claude-sonnet-5` is a cheaper alternative. |
| **OpenAI-compatible** | Base URL, model name, and a key if the server needs one. Works with DeepSeek (`https://api.deepseek.com/v1`, `deepseek-chat`), Google Gemini (`https://generativelanguage.googleapis.com/v1beta/openai`), and local servers such as Ollama or LM Studio (`http://localhost:11434/v1`). Plain `http` is only allowed for localhost. |

Click **Test connection** to confirm. The key is stored in your browser
profile and never shown again; **Remove key** deletes it.

Where to find keys, model names and base URLs for each provider
(OpenAI, Anthropic, DeepSeek, Gemini, Mistral, xAI, Groq, OpenRouter,
Moonshot, Ollama, LM Studio): [docs/PROVIDERS.md](docs/PROVIDERS.md).

## Costs

Each **Analyze** or **Re-analyze** sends the article (up to ~10k
tokens) and receives a JSON answer (typically 1-3k tokens). Nothing is
sent on page load, on toolbar clicks, or when a cached result exists.
Use a key with a spending limit.

The details panel shows the token count of every request. Enter your
provider's price per 1M input and output tokens in the settings
(pre-filled for Anthropic models) and Fact It shows the estimated cost
per analysis and a running total in the settings page.

## Reading the result

- **Article support** is how well the article's factual claims are
  supported *within the article* - attribution, evidence shown,
  internal consistency. It is **not** a truth verdict and it is **not**
  about political, ideological or religious neutrality. "Supported
  within article" never means "verified": external verification is not
  performed in this version.
- **Framing** is assessed separately and never lowers factual support.
  A strongly framed article can be accurate; a neutral one can be
  wrong.
- **Unverified** and **Insufficient evidence** are normal, honest
  outcomes.
- Everything is labelled **AI preliminary**. A future Evidence Engine
  may add evidence-backed verification; until then, nothing in Fact It
  claims external verification happened.

## Privacy and security

- No Fact It servers, telemetry or accounts. See [PRIVACY.md](PRIVACY.md).
- Article text is treated as untrusted data; the model's output is
  validated and rendered as plain text; the UI lives in a closed
  shadow root. See [SECURITY.md](SECURITY.md) for the threat model,
  its test coverage and known limitations.
- Permissions: only `storage` (settings, key and cache). The extension
  runs on http/https pages to read the article; it makes network
  requests only to the provider you configured.

## Development

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for loading the
unpacked extension, verifying it, tests (`npm test`, `npm run
test:smoke`), packaging (`npm run package`) and the permission
rationale. Architecture and decisions: [ARCHITECTURE.md](ARCHITECTURE.md),
[DECISIONS.md](DECISIONS.md). Releases: [docs/RELEASE.md](docs/RELEASE.md),
[CHANGELOG.md](CHANGELOG.md).

## Roadmap

Phase 1 - Browser extension (this release)
Phase 2 - Evidence Engine
Phase 3 - Community
Phase 4 - Reputation / Trust & Abuse

See [ROADMAP.md](ROADMAP.md) and [PLAN.md](PLAN.md).

## License

MIT - see [LICENSE](LICENSE). Bundles Mozilla Readability
(Apache-2.0, `extension/vendor/`).
