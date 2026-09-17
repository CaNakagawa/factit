# Fact It - Architecture Decision Records

Important architectural decisions belong here.

## ADR-001 - BYOK

### Context

Centralized AI inference introduces:

- infrastructure cost
- API cost
- credential management
- privacy complexity

### Decision

Fact It MVP uses BYOK.

Bring Your Own Key.

### Benefits

- minimal infrastructure
- minimal project AI costs
- provider flexibility
- user control

### Tradeoffs

- configuration required
- model behavior differs
- analysis may differ between providers

Future official/community analysis may require standardized models.

---

## ADR-002 - Separate Factuality and Framing

### Context

Biased or framed content can still contain accurate factual
information.

### Decision

Fact It will never use detected framing directly to reduce factual
support.

### Consequence

The UI and schemas maintain separate dimensions for:

- factual support
- possible framing
