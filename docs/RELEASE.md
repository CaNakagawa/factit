# Fact It - Release checklist

1. Versions: `extension/manifest.json` and `package.json` must match
   (the manifest test enforces it). Bump both.
2. `CHANGELOG.md`: add the release section.
3. Prompt / schema: if `PROMPT_VERSION` or `ANALYSIS_SCHEMA_VERSION`
   changed, make sure `docs/PROMPT.md` and `docs/ANALYSIS_SCHEMA.md`
   say so and that the cache still accepts older results
   (`ACCEPTED_SCHEMA_VERSIONS`).
4. `npm test` - all unit tests green.
5. `npm run test:smoke` - all checks green in headless Chromium.
6. Manual pass in a real browser with a real key:
   - load unpacked, no errors on the extension card
   - open an article: idle bar, nothing sent
   - Analyze: result in the bar, panel opens, highlights and
     side-by-side render, provenance line correct
   - reload the page: result from cache, no request
   - Re-analyze: one request
   - settings: test connection, remove key, clear cache
   - a non-article page: no bar
7. `npm run package` - produces `dist/factit-<version>.zip` (runs the
   unit tests first).
8. Install the zip unpacked in a clean profile and repeat step 6
   briefly.
9. Commit, tag `v<version>`, attach the zip to the release.

Store submission (when applicable): the description in the manifest
is under 132 characters; PRIVACY.md is the privacy policy; the only
permission is `storage`; host access comes from the content-script
match pattern and is explained in docs/DEVELOPMENT.md.
