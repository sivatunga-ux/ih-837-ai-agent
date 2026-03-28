import test from "node:test";
import assert from "node:assert/strict";
import { computeStatus, validate837 } from "../rules/validation.js";

test("validate837 returns member id and non-empty findings", () => {
  const input = [
    "ISA*00*~",
    "NM1*IL*1*DOE*JANE****MI*W123456789~",
    "SE*45*0001~"
  ].join("");

  const report = validate837(input);
  assert.equal(report.memberId, "W123456789");
  assert.ok(report.findings.length > 0);
});

test("computeStatus marks RA_BLOCKED when RA-level finding exists", () => {
  const status = computeStatus([
    { level: "WARN", code: "ANY" },
    { level: "RA_BLOCK", code: "RA-01" }
  ]);

  assert.equal(status, "RA_BLOCKED");
});
