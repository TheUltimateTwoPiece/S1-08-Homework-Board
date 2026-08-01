export const DAILY_LIMIT = 100;

export interface ConfirmAction {
  type: "mark_complete" | "unmark_complete";
  params: Record<string, string>;
  label: string;
}

export type PipResult = {
  reply?: string;
  remaining?: number;
  error?: string;
  confirmActions?: ConfirmAction[];
};
