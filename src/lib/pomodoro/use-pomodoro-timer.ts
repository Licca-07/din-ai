"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  cancelPomodoroNotification,
  schedulePomodoroNotification,
  showPomodoroNotification,
} from "@/lib/notifications/pomodoro-notifications";
import {
  cheerContextForPhaseEnd,
  pickDinCheer,
  type PomodoroCheerContext,
} from "@/lib/pomodoro/din-cheers";
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
  const [dinMessage, setDinMessage] = useState(() => pickDinCheer("idle"));
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const persist = useCallback((next: PomodoroState) => {
    setState(next);
    savePomodoroState(next);
  }, []);

  const showDinCheer = useCallback((context: PomodoroCheerContext) => {
    setDinMessage(pickDinCheer(context));
  }, []);

  const handlePhaseComplete = useCallback(
    async (current: PomodoroState) => {
      const result = completeCurrentPhase(current);
      persist(result.state);
      showDinCheer(cheerContextForPhaseEnd(current.phase));

      await cancelPomodoroNotification();
      await showPomodoroNotification(
        result.notification.title,
        result.notification.body,
      );
    },
    [persist, showDinCheer],
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
    const current = stateRef.current;
    const next = startPomodoro(current);
    persist(next);

    if (next.phase === "focus") {
      showDinCheer("focusStart");
    }

    const endContext = cheerContextForPhaseEnd(next.phase);
    const scheduledBody = pickDinCheer(endContext);
    const scheduledTitle =
      endContext === "focusEnd" ? "Din — 休憩の時間" : "Din — 集中の時間";

    await schedulePomodoroNotification(
      next.endsAt!,
      scheduledTitle,
      scheduledBody,
    );
  }, [persist, showDinCheer]);

  const pause = useCallback(async () => {
    const next = pausePomodoro(stateRef.current);
    persist(next);
    showDinCheer("pause");
    await cancelPomodoroNotification();
  }, [persist, showDinCheer]);

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
    dinMessage,
    start,
    pause,
    reset,
    skip,
  };
}
