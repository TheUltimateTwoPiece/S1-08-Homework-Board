import { createClient } from "@/lib/supabase/server";
import { DEFAULT_SUBJECT } from "@/lib/subjects";
import { normalizePost } from "@/lib/types";
import { getTodayString } from "@/lib/time";

type PostRow = {
  id: string;
  title: string;
  subject: string[];
  due_at: string | null;
  content: string;
};

type CompletionsRow = { post_id: string };
type ProfileRow = { full_name?: string; role?: string } | null;

/** Shared by pip.ts and the streaming route to prevent drift. */
export function parseConfirmActions(reply: string): {
  cleanReply: string;
  actions: { type: "mark_complete" | "unmark_complete"; params: Record<string, string>; label: string }[];
} {
  const CONFIRM_REGEX = /\[CONFIRM:([^|\]]+)\|([^|\]]+)\|label=([^\]]+)\]/g;
  const actions: { type: "mark_complete" | "unmark_complete"; params: Record<string, string>; label: string }[] = [];
  const cleanReply = reply.replace(CONFIRM_REGEX, (_match, type, paramsStr, label) => {
    const actionType = type.trim();
    if (actionType !== "mark_complete" && actionType !== "unmark_complete") return "";

    const params: Record<string, string> = {};
    for (const pair of paramsStr.split(",")) {
      const [k, ...v] = pair.split("=");
      if (k && v.length > 0) params[k.trim()] = v.join("=").trim();
    }
    if (params.post_id) {
      actions.push({
        type: actionType,
        params,
        label: label.trim() || (actionType === "mark_complete" ? "Mark complete" : "Unmark complete"),
      });
    }
    return "";
  });
  return { cleanReply: cleanReply.replace(/\n{3,}/g, "\n\n").trim(), actions };
}

/** Builds the full system prompt including context. Shared by both paths. */
export function buildSystemPrompt(
  userContext: string,
  effectiveInstructions: string | null,
): string {
  return `You are Pip, a friendly and helpful homework assistant for students. You have access to the student's real homework data below.

Your personality: encouraging, concise, and slightly playful. Use emoji sparingly. Keep answers short but helpful — students are busy.
${effectiveInstructions ? `\nCUSTOM INSTRUCTIONS FROM THE STUDENT (follow these above all else):\n${effectiveInstructions}\n` : ""}
${userContext}

CRITICAL RULES — violating these is unacceptable:
1. NEVER invent, guess, or make up post titles, instructions, or details. If you cannot find something in the data above, say "I don't see that in your homework list" instead of guessing.
2. ONLY reference posts by their EXACT title as shown in the "Remaining to complete" or other sections above. Copy the title verbatim.
3. When you mention a post, include its exact title and subject from the data. Do not paraphrase or rename posts.
4. If the "Remaining to complete" section is empty, tell the student they're all caught up — do not suggest there is remaining work.
5. The post IDs in brackets [like-this] are for the system — do not show them to the student.

Guidelines:
- Answer questions about the student's homework, progress, and deadlines.
- When the student asks about a specific assignment, quote the actual instructions from the context.
- If they ask about something not in their data, say so honestly.
- Encourage them to complete overdue work first.
- Celebrate milestones (all caught up, finishing a subject, etc.).
- Never make up data. Only reference what's in the context above.
- Keep responses under 3 paragraphs unless the question demands detail.
- Use **bold** for emphasis, - for lists, and \`code\` for technical terms — markdown formatting is supported.

AVAILABLE ACTIONS — suggest these ONLY when a post ID from the context matches:
- Mark complete: [CONFIRM:mark_complete|post_id=REAL_UUID_FROM_CONTEXT|label=✅ Mark complete]
- Unmark: [CONFIRM:unmark_complete|post_id=REAL_UUID_FROM_CONTEXT|label=↩ Unmark]
Put the marker at the very end of your message, on its own line. Only use IDs that appear in the [brackets] above.`;
}

/**
 * Builds a structured snapshot of the user's homework data.
 * The "Remaining to complete" section is a compact flat list (titles + IDs only).
 * Detailed content lives in the Overdue/Upcoming/No-due-date sections.
 */
export async function buildUserContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string> {
  const todayStr = getTodayString();

  const [{ data: posts }, { data: completions }, { data: notifications }, { data: profile }] =
    await Promise.all([
      supabase
        .from("posts")
        .select("id, title, subject, due_at, content")
        .order("due_at", { ascending: true, nullsFirst: false })
        .limit(100),
      supabase.from("post_completions").select("post_id").eq("user_id", userId),
      supabase.from("notifications").select("id, read_at").eq("user_id", userId).is("read_at", null),
      supabase.from("profiles").select("full_name, role").eq("id", userId).single(),
    ]);

  const typedPosts = ((posts ?? []) as PostRow[]).map(normalizePost);
  const completedSet = new Set(
    (completions ?? []).map((c: CompletionsRow) => c.post_id),
  );

  const totalPosts = typedPosts.length;
  const completedCount = typedPosts.filter((p) => completedSet.has(p.id)).length;
  const unreadCount = (notifications ?? []).length;

  // Subject breakdown — a post counts toward EACH of its subjects.
  const subjectMap = new Map<string, { total: number; done: number }>();
  for (const p of typedPosts) {
    const keys = p.subject.length > 0 ? p.subject : [DEFAULT_SUBJECT];
    for (const key of keys) {
      const entry = subjectMap.get(key) ?? { total: 0, done: 0 };
      entry.total += 1;
      if (completedSet.has(p.id)) entry.done += 1;
      subjectMap.set(key, entry);
    }
  }
  const subjectLines = Array.from(subjectMap.entries()).map(
    ([subj, { total, done }]) => `${subj}: ${done}/${total} done`,
  );

  // ── Remaining to complete: compact list with IDs, no content ──
  const remaining = typedPosts.filter((p) => !completedSet.has(p.id));
  const remainingLines = remaining.map(
    (p) =>
      `  - [${p.id}] ${p.title} (${p.subject.join(" + ")}${p.due_at ? `, due ${p.due_at}` : ", no due date"})`,
  );

  // ── Overdue (due date in the past + uncompleted) — with content ──
  const overdue = typedPosts
    .filter((p) => p.due_at && p.due_at < todayStr && !completedSet.has(p.id))
    .slice(0, 5)
    .map(
      (p) =>
        `  - [${p.id}] ${p.title} (${p.subject.join(" + ")}, overdue since ${p.due_at}) — ${p.content.slice(0, 300)}${p.content.length > 300 ? "..." : ""}`,
    );

  // ── Upcoming (due date today/future + uncompleted) — with content ──
  const upcoming = typedPosts
    .filter((p) => p.due_at && p.due_at >= todayStr && !completedSet.has(p.id))
    .slice(0, 10)
    .map(
      (p) =>
        `  - [${p.id}] ${p.title} (${p.subject.join(" + ")}, due ${p.due_at}) — ${p.content.slice(0, 300)}${p.content.length > 300 ? "..." : ""}`,
    );

  // ── No due date (uncompleted) — with content ──
  const noDueDate = typedPosts
    .filter((p) => !p.due_at && !completedSet.has(p.id))
    .slice(0, 10)
    .map(
      (p) =>
        `  - [${p.id}] ${p.title} (${p.subject.join(" + ")}, no due date) — ${p.content.slice(0, 300)}${p.content.length > 300 ? "..." : ""}`,
    );

  // ── Completed ──
  const completed = typedPosts
    .filter((p) => completedSet.has(p.id))
    .slice(-10)
    .map((p) => `  - [${p.id}] ${p.title} (${p.subject.join(" + ")})`);

  const userName = (profile as ProfileRow)?.full_name ?? "Student";
  const userRole = (profile as ProfileRow)?.role ?? "student";

  return `## Your homework data — DO NOT invent post names or details

### Profile
Name: ${userName}
Role: ${userRole}
Overall progress: ${completedCount}/${totalPosts} posts completed
Unread notifications: ${unreadCount}

### Subject breakdown
${subjectLines.join("\n")}

### Remaining to complete — use EXACT titles below, never make up names
${remainingLines.length > 0 ? remainingLines.join("\n") : "  None — all caught up! 🎉"}

${overdue.length > 0 ? `### Overdue — tackle these first\n${overdue.join("\n")}\n` : ""}
${upcoming.length > 0 ? `### Upcoming\n${upcoming.join("\n")}\n` : ""}
${noDueDate.length > 0 ? `### No due date set\n${noDueDate.join("\n")}\n` : ""}
${completed.length > 0 ? `### Recently completed\n${completed.join("\n")}` : ""}`;
}
