# Fact It - Privacy

Fact It V1 uses BYOK.

Bring Your Own Key.

Fact It does not operate centralized AI inference infrastructure.

When analysis is requested, extracted article content is sent directly
to the AI provider selected by the user.

Examples:

- OpenAI
- Anthropic
- Custom provider

Users should always know which provider receives their content.

Fact It must never intentionally collect:

- API keys
- article contents
- browsing history

through project-controlled telemetry.

API credentials remain local to the extension.

Local browser storage does not make API credentials completely
risk-free.

The security limitations of BYOK must be documented transparently.
