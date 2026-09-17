# Fact It

Know what you're reading.

Fact It is an open-source browser extension for transparent,
AI-assisted analysis of online content.

The extension extracts the main content of a webpage locally,
normalizes it, sends the relevant content directly to an AI provider
selected by the user, validates the structured response and displays
the result through a minimal indicator at the top of the webpage.

## MVP Architecture

Web Page
  |
  v
Local Content Extraction
  |
  v
Normalization
  |
  v
ArticleDocument
  |
  v
User-selected AI Provider
  |
  v
LLM
  |
  v
Structured Analysis
  |
  v
Schema Validation
  |
  v
Fact It Bar
  |
  v
Expandable Analysis Panel

## BYOK

The first version uses:

Bring Your Own Key.

Initial providers:

- OpenAI
- Anthropic
- OpenAI-compatible APIs

Fact It does not operate centralized AI inference infrastructure
during V1.

## Philosophy

Fact It does not tell users what to believe.

It exposes:

- factual claims
- uncertainty
- possible inaccuracies
- missing context
- unsupported allegations
- possible framing
- AI confidence

The objective is to allow users to understand why content may
deserve further scrutiny.

## Important Principle

Bias or framing is NOT equivalent to falsehood.

Factual support and possible framing are independent dimensions.

## Development

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for loading the
unpacked extension, verifying it, and running tests.

## Development Phases

Phase 1 - Browser Extension
Phase 2 - Evidence Engine
Phase 3 - Community
Phase 4 - Reputation / Trust & Abuse

Only Phase 1 belongs to the initial MVP.
