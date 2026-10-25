# Fact It — evaluation set

Measures a prompt or schema change against fixed articles with expected
outcomes, instead of judging it by screenshots (ADR-015). It uses the
extension's own extractor, prompt, provider adapters and validator, so
it measures exactly what users get.

## Cases

| Where | What | In git |
|---|---|---|
| `eval/cases/*.json` | Synthetic articles written for this project | yes |
| `eval/cases/local/*.json` | Real articles you captured | **no** — they are third-party copyrighted text |
| `eval/results/` | One JSON file per run | no |

Each case is `{ name, note, expect, read_quality, article }`. Every
field of `expect` is optional:

| Field | Passes when |
|---|---|
| `status` | the status is one of the listed values |
| `article_type`, `thesis_support`, `other_side` | the article profile field is one of the listed values |
| `min_claims`, `max_claims` | the number of claims is within range |
| `must_have_concerns` | every listed concern code appears |
| `must_not_have_concerns` | none of the listed codes appears |
| `must_contrast` | some claim shows a contrast (an inference with no concern, ADR-012) |

## Add a real article

1. In your own browser, open the article and wait for it to load fully.
   Save it with **Ctrl+S → Webpage, HTML only**. Your session and
   cookies come with it; a headless browser would see a paywall.
2. Capture it:

   ```bash
   node eval/capture.mjs --html ~/Downloads/page.html --url https://... --name estadao-porto-feliz
   ```

3. Edit the `expect` block in `eval/cases/local/<name>.json`: what a good
   analysis of this article must and must not do.

`node eval/make-synthetic.mjs` regenerates the synthetic cases.

## Run

```bash
node eval/run.mjs --dry
```

estimates tokens and cost; no network, no key. Running for real spends
tokens on your key and needs `--yes`:

```bash
FACTIT_PROVIDER=openai-compatible FACTIT_BASE_URL=https://api.deepseek.com/v1 FACTIT_MODEL=deepseek-chat FACTIT_API_KEY=... FACTIT_PRICE_IN=0.27 FACTIT_PRICE_OUT=1.10 node eval/run.mjs --yes
```

The key is read from the environment and never printed or written to the
results. Compare two runs by their `prompt_version` in `eval/results/`.
