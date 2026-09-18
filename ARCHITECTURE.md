# Fact It - Architecture

## MVP Architecture

Web Page
   |
   v
Content Extraction
   |
   v
Normalization
   |
   v
ArticleDocument
   |
   v
Provider Adapter
   |
   v
LLM
   |
   v
Analysis JSON
   |
   v
Schema Validation
   |
   +----------------+
   |                |
   v                v
Fact It Bar     Detail Panel

## Analysis model (ADR-008)

ARTICLE
   |
   v
CLAIM EXTRACTION
   |
   +-----------------------+
   |                       |
   v                       v
CLAIM CONSISTENCY      SOURCE TRANSPARENCY
   |                       |
   +-----------+-----------+
               |
               v
       CONTENT ANALYSIS
      (contradiction, attribution, headline, statistics, framing)
               |
               v
        CONCERN ENGINE (validator derives the status from concerns)
               |
        +------+------+
        |             |
        v             v
 No material      Material concerns
 concerns         (moderate / significant)
        |             |
        v             v
      GREEN       YELLOW / RED

Parallel metadata: EXTERNAL VERIFICATION = NOT PERFORMED (V1). It never
affects the concern level.

## content/

Responsible for webpage interaction.

Includes:

- article extraction
- DOM interaction
- Fact It UI injection

Content scripts must not receive API keys.

## background/

Extension orchestration.

Responsible for privileged operations and provider communication.

## providers/

AI provider adapters.

All providers must expose a common interface.

Concept:

analyze(document, configuration)

returns:

AnalysisResult

## analysis/

Responsible for:

- prompts
- prompt versioning
- schemas
- validation
- result normalization

## storage/

Responsible for:

- settings
- provider configuration
- local cache

## ui/

Fact It interface.

Primary component:

thin top indicator.

Secondary component:

expanded analysis panel.

## Future Boundary

Evidence Engine and Community must remain logically independent.

Browser DOM code must not become coupled to future backend
architecture.
