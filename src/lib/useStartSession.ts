"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { actions, useLabState } from "./store";
import { createSession, type SessionOrigin } from "./session";

/** Creates a session from question IDs, makes it active and opens it. */
export function useStartSession() {
  const router = useRouter();
  const { preferences } = useLabState();
  return useCallback(
    (title: string, origin: SessionOrigin, questionIds: readonly string[], timerEnabled = preferences.timer) => {
      if (questionIds.length === 0) return false;
      actions.startSession(createSession({ title, origin, questionIds, timerEnabled }));
      router.push("/session");
      return true;
    },
    [router, preferences.timer],
  );
}
