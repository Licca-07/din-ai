import {
  PHASE_DURATIONS,
  POMODOROS_BEFORE_LONG_BREAK,
} from "@/lib/pomodoro/constants";
import {
  pickDinCheer,
} from "@/lib/pomodoro/din-cheers";
import type { PomodoroPhase, PomodoroState } from "@/types/pomodoro";

export type PhaseCompleteResult = {
  state: PomodoroState;
  notification: {
    title: string;
    body: string;
  };
};

export function getRemainingSeconds(state: PomodoroState, now = Date.now()): number {
  if (state.status === "running" && state.endsAt !== null) {
    return Math.max(0, Math.ceil((state.endsAt - now) / 1000));
  }

  return state.remainingSeconds;
}

export function startPomodoro(state: PomodoroState, now = Date.now()): PomodoroState {
  const remainingSeconds =
    state.status === "idle" ? PHASE_DURATIONS[state.phase] : state.remainingSeconds;

  return {
    ...state,
    status: "running",
    remainingSeconds,
    endsAt: now + remainingSeconds * 1000,
  };
}

export function pausePomodoro(state: PomodoroState, now = Date.now()): PomodoroState {
  if (state.status !== "running") return state;

  return {
    ...state,
    status: "paused",
    remainingSeconds: getRemainingSeconds(state, now),
    endsAt: null,
  };
}

export function resetPomodoro(state: PomodoroState): PomodoroState {
  return {
    ...state,
    phase: "focus",
    status: "idle",
    remainingSeconds: PHASE_DURATIONS.focus,
    endsAt: null,
  };
}

export function skipPomodoroPhase(state: PomodoroState): PomodoroState {
  const next = advancePhase(state);

  return {
    ...next.state,
    status: "idle",
    remainingSeconds: PHASE_DURATIONS[next.state.phase],
    endsAt: null,
  };
}

export function completeCurrentPhase(state: PomodoroState): PhaseCompleteResult {
  const next = advancePhase(state);

  return {
    state: {
      ...next.state,
      status: "idle",
      remainingSeconds: PHASE_DURATIONS[next.state.phase],
      endsAt: null,
    },
    notification: next.notification,
  };
}

function advancePhase(state: PomodoroState): PhaseCompleteResult {
  if (state.phase === "focus") {
    const completedPomodoros = state.completedPomodoros + 1;
    const nextPhase: PomodoroPhase =
      completedPomodoros % POMODOROS_BEFORE_LONG_BREAK === 0
        ? "longBreak"
        : "shortBreak";

    return {
      state: {
        ...state,
        phase: nextPhase,
        completedPomodoros,
      },
      notification: buildDinNotification("focusEnd"),
    };
  }

  return {
    state: {
      ...state,
      phase: "focus",
    },
    notification: buildDinNotification("breakEnd"),
  };
}

function buildDinNotification(context: "focusEnd" | "breakEnd") {
  const body = pickDinCheer(context);
  const title = context === "focusEnd" ? "Din — 休憩の時間" : "Din — 集中の時間";

  return { title, body };
}

export function formatPomodoroTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
