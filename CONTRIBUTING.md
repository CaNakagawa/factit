# Contributing to Fact It

Before making changes:

1. Read README.md, ARCHITECTURE.md and SECURITY.md.
2. Read DECISIONS.md: architectural choices are recorded there as ADRs.
3. Check TODO.md and PLAN.md for the current milestone and what is
   deliberately out of scope.
4. See docs/DEVELOPMENT.md for loading the extension, tests and
   packaging.

Rules of thumb:

- Keep changes small and within the active milestone.
- No new dependencies in the extension itself; dev-only dependencies
  need a reason.
- Every new Chrome permission needs a documented reason
  (docs/DEVELOPMENT.md, Permissions).
- Webpage content and model output are untrusted; render text, never
  HTML. Security-sensitive changes need tests in
  tests/unit/security.test.js.
- Important logic requires tests: `npm test` and `npm run test:smoke`
  must pass.
- Record architectural decisions in DECISIONS.md.
