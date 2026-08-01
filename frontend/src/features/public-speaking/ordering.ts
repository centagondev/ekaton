import type { SpeakingMessage } from "./api";

/**
 * Feed order: newest first.
 *
 * The feed used to be vote-ranked, which meant a card could move under the
 * reader's thumb every time someone else voted, and a brand new response could
 * land halfway down where nobody would see it. Time order is stable — a story
 * only ever enters at the top, and never moves again. Vote ranking still
 * exists, but it belongs to the ranking modal, where reordering is the point.
 */
export function byNewest(messages: SpeakingMessage[]): SpeakingMessage[] {
  return [...messages].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

/** Ranking order: most hearted first, newest breaking ties. */
export function byVotes(messages: SpeakingMessage[]): SpeakingMessage[] {
  return [...messages].sort((a, b) => {
    if (b.upvote_count !== a.upvote_count) return b.upvote_count - a.upvote_count;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}
