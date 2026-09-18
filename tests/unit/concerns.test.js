// ADR-008 regression cases: concern detection, not verification absence.
// Each case is a model output shaped as the prompt requests, run through
// the validator and the UI derivation exactly as the extension does.
// (LLM behaviour itself cannot be unit-tested; the prompt wording that
// drives it is asserted in analysis.test.js.)

import { test } from "node:test";
import assert from "node:assert/strict";
import { validateAnalysis } from "../../extension/analysis/validator.js";
import { loadClassicScript } from "../helpers/load-script.js";

loadClassicScript(new URL("../../extension/ui/derive.js", import.meta.url));
const D = globalThis.FactIt.derive;

const claim = (text, over = {}) => ({
  text, type: "FACTUAL", support: "ATTRIBUTED", attribution: "CLEAR", evidence_type: "NAMED_SOURCE",
  evidence: "vendor advisory, linked", concerns: [], gap: "", inference: "", ...over,
});
const output = (over = {}) => ({
  assessment: { confidence: 0.8, rationale: "Claims are attributed and consistent." },
  source_transparency: { named_sources: true, primary_references: true, direct_quotes: true },
  claims: [],
  concerns: [],
  framing: { detected: false, type: null, strength: null, confidence: 0.2, observations: [] },
  summary: "Ordinary reporting.",
  ...over,
});
const run = (raw) => {
  const r = validateAnalysis(raw);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  return r.value;
};

test("CASE 1: ordinary technical article, clearly attributed, no internal problems -> NO_SIGNIFICANT_CONCERNS, NOT_PERFORMED", () => {
  const v = run(output({
    claims: [
      claim("Microsoft released fixes for CVE-2026-85889.", { evidence_type: "PRIMARY_DOCUMENT", evidence: "Microsoft advisory, linked" }),
      claim("The vulnerability has a CVSS score of 10.0.", { evidence_type: "OFFICIAL_RECORD", evidence: "CVE record" }),
      claim("Researcher Jane Roe discovered the issue.", { evidence_type: "NAMED_SOURCE", evidence: "credited in the advisory" }),
      claim("Microsoft says no customer action is required.", { evidence_type: "DIRECT_QUOTE", evidence: "quoted statement" }),
      claim("Two related vulnerabilities were also patched.", { evidence: "advisory" }),
    ],
  }));
  assert.equal(v.assessment.status, "NO_SIGNIFICANT_CONCERNS");
  assert.equal(v.assessment.external_verification, "NOT_PERFORMED");
  const n = D.counts(v);
  assert.deepEqual([n.total, n.concerns, n.significant, n.observations, n.contradictions, n.flagged], [5, 0, 0, 0, 0, 0]);
  assert.deepEqual(D.bannerText(v), { label: "No significant concerns", detail: "" });
  assert.equal(D.keyFindings(v).length, 0);
  assert.equal(D.sideBySide(v).rows.length, 0, "ordinary reporting never appears side by side");
  for (const c of v.claims) {
    assert.equal(D.bucketOf(c, v), "ok");
    assert.equal(D.reasonOf(c, v), "Attributed reporting");
  }
  assert.equal(D.status(v).color, "#22c55e");
  // Labels never mention verification as a problem.
  const everything = JSON.stringify([D.keyFindings(v), D.highlights(v), D.counts(v), D.bannerText(v)]);
  assert.doesNotMatch(everything, /need(s)? (external )?verification/i);
});

test("CASE 2: headline materially contradicts body -> SIGNIFICANT_CONCERNS; overstatement -> REVIEW_RECOMMENDED", () => {
  const contradicts = run(output({
    claims: [claim("The study found a correlation; causation was not established.", { evidence_type: "PRIMARY_DOCUMENT" })],
    concerns: [{ type: "HEADLINE_CONTRADICTS_BODY", note: "Headline: 'Study proves X'; body: causation not established.", claim_ids: ["c1"] }],
  }));
  assert.equal(contradicts.assessment.status, "SIGNIFICANT_CONCERNS");
  assert.equal(D.counts(contradicts).contradictions, 1);
  assert.deepEqual(D.bannerText(contradicts), { label: "Significant concerns", detail: "1 issue" });
  assert.equal(D.keyFindings(contradicts)[0].label, "Headline contradicts body");

  const overstates = run(output({
    claims: [claim("Sales rose 3% in the quarter.")],
    concerns: [{ type: "HEADLINE_OVERSTATEMENT", note: "Headline says 'sales surge'.", claim_ids: ["c1"] }],
  }));
  assert.equal(overstates.assessment.status, "REVIEW_RECOMMENDED");
  assert.deepEqual(D.bannerText(overstates), { label: "Review recommended", detail: "1 concern" });
});

test("CASE 3: serious allegation presented as established fact without attribution -> concern", () => {
  const v = run(output({
    claims: [
      claim("The minister diverted public funds to a private foundation.", {
        type: "ALLEGATION", support: "UNSUPPORTED_WITHIN_ARTICLE", attribution: "NONE", evidence_type: "NO_EVIDENCE_SHOWN", evidence: "",
        concerns: ["UNSUPPORTED_SERIOUS_ALLEGATION"], gap: "No document, source or statement is presented.",
      }),
    ],
  }));
  assert.equal(v.assessment.status, "SIGNIFICANT_CONCERNS");
  assert.equal(D.bucketOf(v.claims[0], v), "concern");
  assert.equal(D.reasonOf(v.claims[0], v), "Serious allegation presented as fact");
  assert.equal(D.sideBySide(v).rows.length, 1);
});

test("CASE 4: article reports that another party made an allegation -> not the article's own unsupported claim", () => {
  const v = run(output({
    claims: [
      claim("According to investigators, the company is accused of price fixing.", {
        type: "ALLEGATION", support: "ALLEGATION_REPORTED", attribution: "CLEAR", evidence_type: "NAMED_SOURCE", evidence: "investigators, named",
      }),
    ],
  }));
  assert.equal(v.assessment.status, "NO_SIGNIFICANT_CONCERNS");
  assert.equal(D.bucketOf(v.claims[0], v), "ok");
  assert.equal(D.reasonOf(v.claims[0], v), "Allegation reported, attributed");
  assert.equal(v.claims[0].type, "ALLEGATION", "still visibly an allegation, just an attributed one");
  assert.equal(D.keyFindings(v).length, 0);
});

test("CASE 5: article lacks unrelated/background information -> no MATERIAL_MISSING_CONTEXT", () => {
  // The prompt forbids manufacturing missing context; on the data side a
  // plain UNCLEAR claim without a concern code must not become one.
  const v = run(output({
    claims: [
      claim("The vulnerability affects versions 2.1 through 2.4.", { evidence_type: "PRIMARY_DOCUMENT" }),
      claim("Two other vulnerabilities in unrelated products were not discussed.", { support: "UNCLEAR", attribution: "NONE", evidence_type: "ARTICLE_ASSERTION", evidence: "" }),
    ],
  }));
  assert.equal(v.assessment.status, "NO_SIGNIFICANT_CONCERNS");
  assert.equal(D.counts(v).observations, 0);
  assert.equal(D.counts(v).flagged, 0);
  // When the model does state material missing context, it is a moderate concern, once.
  const material = run(output({
    claims: [claim("Unemployment fell to 4%.", { concerns: ["MATERIAL_MISSING_CONTEXT"], gap: "The article omits that the survey method changed that month." })],
  }));
  assert.equal(material.assessment.status, "REVIEW_RECOMMENDED");
  assert.equal(D.counts(material).observations, 1);
});

test("CASE 6: political subject with neutral factual reporting -> no framing, no concern", () => {
  const v = run(output({
    claims: [
      claim("Parliament passed the budget 310-290 on Thursday.", { evidence_type: "OFFICIAL_RECORD", evidence: "vote record" }),
      claim("The opposition leader said the budget favours large firms.", { evidence_type: "DIRECT_QUOTE", evidence: "quoted" }),
      claim("The finance minister said the deficit will fall next year.", { evidence_type: "DIRECT_QUOTE", evidence: "quoted" }),
    ],
    // Model tried to mark LOW framing with no observable characteristic.
    framing: { detected: true, type: "POLITICAL", strength: "LOW", confidence: 0.4, observations: [] },
  }));
  assert.equal(v.framing.detected, false, "topic is not framing");
  assert.equal(v.assessment.status, "NO_SIGNIFICANT_CONCERNS");
  assert.equal(D.counts(v).flagged, 0);
  assert.equal(D.keyFindings(v).length, 0);
  // Framing, when it IS observed, never changes the status.
  const framed = run(output({
    claims: [claim("Parliament passed the budget 310-290 on Thursday.", { evidence_type: "OFFICIAL_RECORD" })],
    framing: { detected: true, type: "POLITICAL", strength: "HIGH", confidence: 0.8, observations: ["Only one side's reaction is quoted", "Loaded terms in the lead"] },
  }));
  assert.equal(framed.framing.detected, true);
  assert.equal(framed.assessment.status, "NO_SIGNIFICANT_CONCERNS", "framing is reported separately; it is not a concern by itself");
});

test("CASE 7: no concerns found -> empty lists accepted and displayed normally", () => {
  const v = run(output({ claims: [claim("The company reported revenue of 2.1 billion.", { evidence_type: "OFFICIAL_RECORD" })], concerns: [] }));
  assert.deepEqual(v.concerns, []);
  assert.deepEqual(v.claims[0].concerns, []);
  assert.equal(v.framing.detected, false);
  assert.equal(v.assessment.status, "NO_SIGNIFICANT_CONCERNS");
  assert.equal(D.status(v).label, "No significant concerns");
  assert.match(D.status(v).meaning, /not a statement that the article is true/);
  assert.deepEqual(D.highlights(v).concerns, []);
  assert.equal(D.highlights(v).ordinary.length, 1);
  // Even an empty article (no claims) is a valid, non-error result.
  const empty = run(output({ claims: [] }));
  assert.equal(empty.assessment.status, "NO_SIGNIFICANT_CONCERNS");
  assert.equal(D.counts(empty).total, 0);
});

test("verification metadata never influences status, buckets, counters or banner", () => {
  const v = run(output({ claims: [claim("A"), claim("B"), claim("C")] }));
  const tampered = JSON.parse(JSON.stringify(v));
  tampered.assessment.external_verification = "CONTRADICTED";
  tampered.assessment.verification_level = "EVIDENCE_VERIFIED";
  for (const c of tampered.claims) c.external_verification_required = true;
  assert.equal(D.status(tampered).code, "NO_SIGNIFICANT_CONCERNS");
  assert.equal(D.counts(tampered).flagged, 0);
  assert.deepEqual(D.bannerText(tampered), { label: "No significant concerns", detail: "" });
  // Source transparency is observed, never scored as reputation.
  const tr = D.sourceTransparency(v, { author: "Jane Roe", published_at: "2026-09-18T00:00:00Z", domain: "example.com" });
  assert.deepEqual(tr.items.map((i) => [i.label, i.present]), [
    ["Named author", true], ["Publication date", true], ["Named sources for important claims", true],
    ["Primary references (advisories, filings, studies)", true], ["Direct quotations", true],
  ]);
  assert.doesNotMatch(JSON.stringify(tr), /reput|trust/i);
});
