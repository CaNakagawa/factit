# Fact It - Development Plan

## V0 - Foundation

Project structure.
Documentation.
Architecture.
Security model.
Schemas.
Agent instructions.

## V0.1 - Chrome Extension Shell

Goal:

Create the smallest valid Manifest V3 extension.

Requirements:

- extension loads successfully
- service worker loads
- content script executes
- settings page exists
- no AI functionality yet

## V0.2 - Article Extraction

Integrate reader-mode extraction.

First candidate:

Mozilla Readability.

Extract:

- URL
- domain
- title
- author
- publication date
- language
- main article text
- relevant hyperlinks
- relevant image metadata

Avoid sending raw page HTML to AI.

## V0.3 - Content Normalization

Convert extraction result into ArticleDocument.

Normalize:

- whitespace
- URLs
- metadata
- links
- text

Generate content hash.

## V0.4 - Provider Layer

Implement common AI provider interface.

Initial providers:

- OpenAI
- Anthropic
- OpenAI-compatible

Architecture should allow future support for:

- Gemini
- Grok
- DeepSeek
- Mistral
- Kimi
- Ollama
- LM Studio

without rewriting the analysis engine.

## V0.5 - AI Analysis Engine

Create versioned analysis prompt.

Input:

ArticleDocument

Output:

AnalysisResult

Requirements:

- structured JSON
- schema validation
- malformed output handling
- preliminary-analysis classification
- prompt injection resistance

## V0.6 - Fact It Bar

Inject a thin indicator at the top of the webpage.

The primary indicator represents:

FACTUAL SUPPORT

It must NOT represent:

- political neutrality
- ideological neutrality
- source popularity
- community opinion

## V0.7 - Expanded Panel

Clicking the Fact It bar opens analysis details.

Display:

- claims
- classification
- confidence
- flags
- framing
- explanations
- provider
- model
- preliminary-analysis status

## V0.8 - Local Cache

Generate:

SHA-256(normalized content)

Cache:

- content hash
- analysis
- provider
- model
- prompt version
- schema version
- timestamp

Provide a Re-analyze option.

## V0.9 - Security Hardening

Test:

- prompt injection
- XSS
- malformed LLM output
- malicious webpage content
- invalid providers
- custom endpoint abuse
- API key leakage
- extraction failures
- oversized articles
- permission requirements

## V1.0 - MVP

Release first usable Fact It extension.

Explicitly excluded:

- Community
- Evidence Engine
- User accounts
- Reputation
- Trust & Abuse backend

## V2 - Evidence Engine

Future pipeline:

Claim
  ->
Evidence Search
  ->
Source
  ->
Evidence
  ->
Assessment
  ->
Citation

## V3 - Community

Future.

Users can:

- review claims
- submit evidence
- challenge analysis
- add missing context
- rate AI analysis

## V4 - Reputation / Trust & Abuse

Future.

Independent reputation:

- Source
- Author
- Contributor

Evaluate observable behavior and evidence quality.

Do not penalize political or ideological orientation itself.
