// axe-core checks for the e2e specs: WCAG 2.0-2.2 A and AA rules plus best
// practices; a test fails on any serious or critical violation.
import AxeBuilder from "@axe-core/playwright";
import { expect } from "./fixtures.js";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

/** Run axe on the page as it is now; return every violation, worst first. */
export async function axeViolations(page) {
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const rank = { critical: 0, serious: 1, moderate: 2, minor: 3 };
  return violations
    .map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => n.target.join(" ")).slice(0, 5),
    }))
    .sort((a, b) => rank[a.impact] - rank[b.impact]);
}

/** Fail on serious or critical violations (moderate and minor are returned for notes). */
export async function expectNoSeriousViolations(page) {
  const all = await axeViolations(page);
  const serious = all.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  return all;
}
