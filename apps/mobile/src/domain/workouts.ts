/**
 * Workout goals and tracking. The rules live in the shared, dependency-free
 * packages/workout-core so the app, the web companion, the MCP server and the
 * messaging adapter all behave identically.
 */
export * from "../../../../packages/workout-core/src/index.ts";
