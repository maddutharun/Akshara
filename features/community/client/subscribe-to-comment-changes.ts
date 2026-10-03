"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CommentLocation =
  | { verseId: string; chapterId?: never }
  | { chapterId: string; verseId?: never };

export function subscribeToCommentChanges(
  location: CommentLocation,
  onChange: () => void,
  onError: (error: Error) => void,
) {
  const verseId = "verseId" in location ? location.verseId : undefined;
  const chapterId = "chapterId" in location ? location.chapterId : undefined;
  const id = verseId ?? chapterId;
  if (!id || !uuidPattern.test(id)) {
    throw new Error("A valid verse or chapter ID is required for a comment subscription.");
  }

  const client = getSupabaseBrowserClient();
  const channel = client
    .channel(`comments:${verseId ? "verse" : "chapter"}:${id}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "comments",
        filter: `${verseId ? "verse_id" : "chapter_id"}=eq.${id}`,
      },
      onChange,
    )
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        onError(new Error(`Comment updates could not be subscribed to (${status}).`));
      }
    });

  return () => {
    void client.removeChannel(channel).then((status) => {
      if (status !== "ok") {
        onError(new Error(`The comment subscription could not be closed cleanly (${status}).`));
      }
    });
  };
}
