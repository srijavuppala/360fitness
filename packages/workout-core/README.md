# @360fitness/workout-core

Dependency-free workout goals and tracking. One engine shared by the mobile app, the web companion, an MCP server and chat (iMessage/SMS) adapters. Product spec: [docs/workouts/WORKOUT-PRD.md](../../docs/workouts/WORKOUT-PRD.md).

Requires Node ≥ 22.18 (runs TypeScript natively, no build step or install).

```bash
cd packages/workout-core
npm test
```

## Use it in an app

```ts
import { dispatch, emptyWorkoutState, weekSummary } from "@360fitness/workout-core";

let state = emptyWorkoutState();
({ state } = dispatch(state, { action: "set_goal", metric: "sessions", target: 3 }, { source: "app" }));
const { state: next, result } = dispatch(state, { action: "log_workout", type: "run", durationMin: 28, distanceKm: 5 }, { source: "app" });
if (result.ok) state = next; // persist `state`
weekSummary(state); // totals, goal progress, streak
```

The mobile app imports it through `apps/mobile/src/domain/workouts.ts`, and Metro watches `packages/`.

## Use it from an MCP client

Local stdio server, storing data in `~/.360fitness/workouts.json`:

```json
{
  "mcpServers": {
    "360fitness-workouts": {
      "command": "node",
      "args": ["/absolute/path/to/360fitness/packages/workout-core/bin/mcp-server.ts"],
      "env": { "WORKOUT_DATA_FILE": "/absolute/path/to/workouts.json" }
    }
  }
}
```

Tools: `log_workout`, `update_workout`, `delete_workout`, `undo_last`, `set_goal`, `archive_goal`, `list_goals`, `list_workouts`, `summary`.

## Use it from iMessage / SMS

```ts
import { handleMessage } from "@360fitness/workout-core";

// Inside a verified webhook handler, after mapping the sender to a user:
const { state: next, reply } = handleMessage(userState, body.text, { messageId: body.id });
await save(uid, next);
await sendReply(body.from, reply);
```

Phrases it understands: `ran 5k in 28 min` · `45 min yoga easy` · `lifted 1h hard yesterday` · `skipped run, knee sore` · `goal 3 workouts a week` · `goal 150 minutes a week` · `status` · `history` · `goals` · `undo` · `help`.

Using the provider's message id as `messageId` makes webhook redelivery safe. `undo` only removes workouts that were logged from the same surface.
