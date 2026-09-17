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

---

## ADR-003 - Mozilla Readability, vendored, no build step

### Context

V0.2 needs reader-mode extraction. PLAN.md names Mozilla Readability
as the first candidate. Content scripts cannot be ES modules, and the
project has no bundler.

### Decision

Use Mozilla Readability (Apache-2.0) unchanged. Ship it as classic
scripts committed under `extension/vendor/`, copied from the pinned
npm devDependency by `npm run vendor`. A unit test fails if the copy
drifts from `node_modules`.

The extractor takes Readability by injection so it is unit-testable in
Node with jsdom, without a browser or an LLM.

### Alternatives

- Custom extraction engine: rejected; the skill says not to unless
  necessary, and Readability handles the common cases.
- Bundler (esbuild/rollup) with npm import: rejected for now; adds a
  build step for a single dependency. Can be revisited if the
  extension gains more dependencies.

### Tradeoffs

- ~94 KB of third-party code in the repository.
- Upgrades are manual (bump version, run vendor script).
- Extraction quality is bounded by Readability; pages it cannot parse
  yield "no article", which is a valid result.

