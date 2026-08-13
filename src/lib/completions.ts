/**
 * Pure completion-toggle decision logic, shared by the server action and
 * unit tests. Returns the exact operation the action should perform so
 * retries and double-clicks stay idempotent.
 */

export type CompletionDecision =
  | { action: "complete" }
  | { action: "uncomplete" }
  | { action: "none" };

export function resolveCompletionAction(
  existing: boolean,
  desired: boolean | null,
): CompletionDecision {
  const shouldComplete = desired ?? !existing;

  if (shouldComplete) {
    return existing ? { action: "none" } : { action: "complete" };
  }
  return existing ? { action: "uncomplete" } : { action: "none" };
}
