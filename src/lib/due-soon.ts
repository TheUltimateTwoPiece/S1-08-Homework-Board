import { getDateAfterDaysString, getTodayString } from "@/lib/time";
import { SUBJECTS } from "@/lib/subjects";

/**
 * Pure, timezone-aware helpers for the "due soon" student view. Kept free of
 * Supabase/Next imports so they can be unit-tested in isolation. The rest of
 * the app can call these directly instead of re-deriving "today" / "tomorrow"
 * and re-grouping posts by hand.
 */

export type DueSoonBucket = "today" | "tomorrow";

export type DueSoonPost = {
  id: string;
  title: string;
  subject: string[];
  due_at: string;
  pinned: boolean;
};

export type SubjectGroup = {
  subject: string;
  posts: DueSoonPost[];
};

export type DueSoonResult = {
  today: SubjectGroup[];
  tomorrow: SubjectGroup[];
  todayCount: number;
  tomorrowCount: number;
};

/**
 * Classifies a due date against the app timezone's "today" and "tomorrow".
 * Returns null for overdue, undated, or further-out dates.
 */
export function classifyDueSoonBucket(
  dueAt: string,
  today = getTodayString(),
  tomorrow = getDateAfterDaysString(1),
): DueSoonBucket | null {
  if (!dueAt) return null;
  if (dueAt === today) return "today";
  if (dueAt === tomorrow) return "tomorrow";
  return null;
}

/**
 * Groups incomplete posts due today or tomorrow by subject, in canonical
 * subject order. A post with multiple subjects appears in each of its groups.
 */
export function buildDueSoon(
  posts: DueSoonPost[],
  completedIds: Set<string>,
  today = getTodayString(),
  tomorrow = getDateAfterDaysString(1),
): DueSoonResult {
  const todayPosts: DueSoonPost[] = [];
  const tomorrowPosts: DueSoonPost[] = [];

  for (const post of posts) {
    if (!post.due_at || completedIds.has(post.id)) continue;
    const bucket = classifyDueSoonBucket(post.due_at, today, tomorrow);
    if (bucket === "today") todayPosts.push(post);
    else if (bucket === "tomorrow") tomorrowPosts.push(post);
  }

  const sortPosts = (a: DueSoonPost, b: DueSoonPost) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return a.due_at.localeCompare(b.due_at);
  };

  const groupBySubject = (items: DueSoonPost[]): SubjectGroup[] => {
    const bySubject = new Map<string, DueSoonPost[]>();
    for (const post of items) {
      for (const subject of post.subject) {
        if (!bySubject.has(subject)) bySubject.set(subject, []);
        bySubject.get(subject)!.push(post);
      }
    }

    return SUBJECTS
      .filter((subject) => bySubject.has(subject))
      .map((subject) => ({
        subject,
        posts: bySubject.get(subject)!.sort(sortPosts),
      }));
  };

  const todayGroups = groupBySubject(todayPosts);
  const tomorrowGroups = groupBySubject(tomorrowPosts);

  return {
    today: todayGroups,
    tomorrow: tomorrowGroups,
    todayCount: todayPosts.length,
    tomorrowCount: tomorrowPosts.length,
  };
}
