"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  cancelPomodoroNotification,
  schedulePomodoroNotification,
  showPomodoroNotification,
} from "@/lib/notifications/pomodoro-notifications";
import { PHASE_LABELS } from "@/lib/pomodoro/constants";
import {
  loadPomodoroState,
  savePomodoroState,
} from "@/lib/pomodoro/storage";
import {
  completeCurrentPhase,
  getRemainingSeconds,
  pausePomodoro,
  resetPomodoro,
  skipPomodoroPhase,
  startPomodoro,
} from "@/lib/pomodoro/timer-logic";
import type { PomodoroState } from "@/types/pomodoro";

export function usePomodoroTimer() {
  const [state, setState] = useState<PomodoroState>(() => loadPomodoroState());
  const [displaySeconds, setDisplaySeconds] = useState(() =>
    getRemainingSeconds(loadPomodoroState()),
  );
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const persist = useCallback((next: PomodoroState) => {
    setState(next);
    savePomodoroState(next);
  }, []);

  const handlePhaseComplete = useCallback(
    async (current: PomodoroState) => {
      const result = completeCurrentPhase(current);
      persist(result.state);

      await cancelPomodoroNotification();
      await showPomodoroNotification(
        result.notification.title,
        result.notification.body,
      );
    },
    [persist],
  );

  const syncDisplay = useCallback(() => {
    const current = stateRef.current;
    const remaining = getRemainingSeconds(current);

    setDisplaySeconds(remaining);

    if (current.status === "running" && remaining <= 0) {
      void handlePhaseComplete(current);
    }
  }, [handlePhaseComplete]);

  useEffect(() => {
    syncDisplay();

    const intervalId = window.setInterval(syncDisplay, 1000);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncDisplay();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [syncDisplay]);

  const start = useCallback(async () => {
    const next = startPomodoro(stateRef.current);
    persist(next);

    const phaseLabel = PHASE_LABELS[next.phase];
    await schedulePomodoroNotification(
      next.endsAt!,
      `${phaseLabel}終了`,
      next.phase === "focus"
        ? "休憩に入ろう。"
        : "次の集中タイムを始められるよ。",
    );
  }, [persist]);

  const pause = useCallback(async () => {
    const next = pausePomodoro(stateRef.current);
    persist(next);
    await cancelPomodoroNotification();
  }, [persist]);

  const reset = useCallback(async () => {
    const next = resetPomodoro(stateRef.current);
    persist(next);
    await cancelPomodoroNotification();
  }, [persist]);

  const skip = useCallback(async () => {
    const next = skipPomodoroPhase(stateRef.current);
    persist(next);
    await cancelPomodoroNotification();
  }, [persist]);

  return {
    state,
    displaySeconds,
    start,
    pause,
    reset,
    skip,
  };
}
