# Fact It - Provider reference

Where to get an API key, find current model names, and which base URL to
enter. Fact It does not verify any of this: model names and prices
change, so use the provider's own pages linked below as the source of
truth. Everything except OpenAI and Anthropic goes through the
**OpenAI-compatible** provider in Fact It's settings.

Quick recap of the settings fields:

- **Provider**: OpenAI, Anthropic, or OpenAI-compatible (custom endpoint)
- **Base URL** (OpenAI-compatible only): the root Fact It appends
  `/chat/completions` to. Plain `http` is allowed only for localhost.
- **Model**: the exact model id as the provider lists it (no date
  suffix unless the provider uses one)
- **API key**: from the provider's console; stored locally only
- **Prices per 1M tokens**: optional, for cost estimates

## OpenAI

| | |
|---|---|
| Fact It provider | OpenAI |
| API keys | https://platform.openai.com/api-keys |
| Model names | https://platform.openai.com/docs/models |
| Pricing | https://openai.com/api/pricing/ |
| Notes | Default model in Fact It: `gpt-4o-mini`. Any chat model works. |

## Anthropic (Claude)

| | |
|---|---|
| Fact It provider | Anthropic |
| API keys | https://console.anthropic.com/settings/keys |
| Model names | https://docs.anthropic.com/en/docs/about-claude/models/overview |
| Pricing | https://www.anthropic.com/pricing |
| Notes | Default model in Fact It: `claude-opus-5`; `claude-sonnet-5` is cheaper. Use ids exactly as listed (`claude-opus-5`, not a dated variant). Prices for known Claude models are pre-filled in the settings. |

## DeepSeek

| | |
|---|---|
| Fact It provider | OpenAI-compatible |
| Base URL | `https://api.deepseek.com/v1` |
| API keys | https://platform.deepseek.com/api_keys |
| Model names and pricing | https://api-docs.deepseek.com/quick_start/pricing |
| Notes | `deepseek-chat` (general) or `deepseek-reasoner`. Verified working with Fact It. |

## Google Gemini

| | |
|---|---|
| Fact It provider | OpenAI-compatible |
| Base URL | `https://generativelanguage.googleapis.com/v1beta/openai` |
| API keys | https://aistudio.google.com/apikey |
| Model names | https://ai.google.dev/gemini-api/docs/models |
| OpenAI-compatibility docs | https://ai.google.dev/gemini-api/docs/openai |
| Pricing | https://ai.google.dev/gemini-api/docs/pricing |
| Notes | Use the model id shown in AI Studio (for example a `gemini-...-flash` id). |

## Mistral

| | |
|---|---|
| Fact It provider | OpenAI-compatible |
| Base URL | `https://api.mistral.ai/v1` |
| API keys | https://console.mistral.ai/api-keys |
| Model names | https://docs.mistral.ai/getting-started/models/ |
| Pricing | https://mistral.ai/pricing |

## xAI (Grok)

| | |
|---|---|
| Fact It provider | OpenAI-compatible |
| Base URL | `https://api.x.ai/v1` |
| API keys and console | https://console.x.ai/ |
| Model names and pricing | https://docs.x.ai/docs/models |

## Groq

| | |
|---|---|
| Fact It provider | OpenAI-compatible |
| Base URL | `https://api.groq.com/openai/v1` |
| API keys | https://console.groq.com/keys |
| Model names | https://console.groq.com/docs/models |
| Pricing | https://groq.com/pricing |

## OpenRouter (many models behind one key)

| | |
|---|---|
| Fact It provider | OpenAI-compatible |
| Base URL | `https://openrouter.ai/api/v1` |
| API keys | https://openrouter.ai/keys |
| Model names and pricing | https://openrouter.ai/models |
| Notes | Model ids look like `vendor/model` (copy from the model page). |

## Moonshot (Kimi)

| | |
|---|---|
| Fact It provider | OpenAI-compatible |
| Base URL | `https://api.moonshot.ai/v1` |
| Console and docs | https://platform.moonshot.ai/ |
| Notes | Check the console for the current `kimi-...` model ids and the regional base URL. |

## Ollama (local, free)

| | |
|---|---|
| Fact It provider | OpenAI-compatible |
| Base URL | `http://localhost:11434/v1` |
| API key | none needed (leave empty) |
| Models | https://ollama.com/library — pull one with `ollama pull <name>` and use that name |
| Docs | https://github.com/ollama/ollama/blob/main/docs/openai.md |
| Notes | Small local models produce more `invalid_output` errors than hosted ones; prefer instruction-tuned models of 7B or more. |

## LM Studio (local, free)

| | |
|---|---|
| Fact It provider | OpenAI-compatible |
| Base URL | `http://localhost:1234/v1` |
| API key | none needed (leave empty) |
| Docs | https://lmstudio.ai/docs/app/api/endpoints/openai |
| Notes | Start the local server in LM Studio; the model id is shown in the server tab. |

## Troubleshooting

- `Failed (not_found)` on Test connection: the model id is wrong for
  that provider; copy it from the model page above.
- `Failed (auth)`: key invalid or for a different product/region.
- `Failed (config): Plain http is only allowed for localhost`: remote
  endpoints must use `https`.
- `analysis failed (invalid_output)`: the model did not return valid
  JSON; the console line shows the raw text. Try a stronger model.
