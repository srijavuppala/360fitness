import { dispatch, type CommandResult } from "./commands.ts";
import { localDate, systemClock, type Clock } from "./engine.ts";
import { formatReply, helpText } from "./format.ts";
import { parseMessage } from "./parse.ts";
import type { WorkoutState } from "./types.ts";

/**
 * Messaging adapter (iMessage / SMS / WhatsApp / Slack).
 *
 * Transport-agnostic: the webhook layer (e.g. an iMessage relay provider or
 * Apple Messages for Business) authenticates the sender, loads that user's
 * WorkoutState, calls handleMessage, saves `state` and sends `reply`.
 *
 * `messageId` should be the provider's unique message id: it becomes the
 * idempotency key, so a redelivered webhook never logs a workout twice.
 */
export function handleMessage(
  state: WorkoutState,
  text: string,
  options: { messageId?: string; clock?: Clock } = {},
): { state: WorkoutState; reply: string; result: CommandResult | null } {
  const clock = options.clock ?? systemClock;
  if (text.length > 500) return { state, reply: "That message is a bit long — try something like \"ran 5k in 28 min\".", result: null };
  const command = parseMessage(text, localDate(clock.now()));
  if (!command) return { state, reply: `Sorry, I didn't catch that.\n${helpText}`, result: null };
  if (command.action === "log_workout" && options.messageId) command.idempotencyKey = `msg:${options.messageId}`;
  const out = dispatch(state, command, { source: "message", clock });
  return { state: out.state, reply: formatReply(out.result), result: out.result };
}
