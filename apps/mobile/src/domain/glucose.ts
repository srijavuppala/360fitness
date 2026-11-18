/**
 * Self-reported glucose log. Rules live in the shared, dependency-free
 * packages/glucose-core so the app, MCP server and messaging adapter agree.
 */
import type { HealthProfile } from "./health";

export * from "../../../../packages/glucose-core/src/index.ts";

export const DIABETES = "Diabetes (Type 1 / Type 2)";

/** Show glucose tools prominently only to people who said diabetes applies. */
export function tracksGlucose(health?: HealthProfile): boolean {
  return !!health?.conditions?.includes(DIABETES);
}
