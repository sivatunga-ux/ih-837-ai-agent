import test from "node:test";
import assert from "node:assert/strict";

import { SAMPLE_ENCOUNTERS } from "../data/samples.js";
import { buildReviewModel } from "../ui/review.js";

test("buildReviewModel parses IHAS X12 sample into review sections", () => {
  const sample = SAMPLE_ENCOUNTERS[0];
  const model = buildReviewModel(sample.text);

  assert.equal(model.submitter?.last, "PREMIER BILLING SERVICE");
  assert.equal(model.receiver?.last, "KEY INSURANCE COMPANY");
  assert.equal(model.subscriber?.last, "SMITH");
  assert.equal(model.subscriber?.first, "JANE");
  assert.equal(model.patient?.last, "SMITH");
  assert.equal(model.patient?.first, "TED");

  assert.equal(model.claim.claimId, "26463774");
  assert.equal(model.claim.totalCharge, "100");
  assert.equal(model.claim.clearinghouseTrace, "17312345600006351");
  assert.deepEqual(model.claim.diagnoses, ["0340", "V7389"]);
  assert.equal(model.claim.serviceLines.length, 4);
  assert.equal(model.claim.serviceLines[0].procedureCode, "99213");
  assert.equal(model.claim.serviceLines[3].procedureCode, "86663");
  assert.equal(model.claim.computedLineTotal, 100);
});
