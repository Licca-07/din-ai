import { PHASE_DURATIONS } from "@/lib/pomodoro/constants";
import type { PomodoroPhase, PomodoroState } from "@/types/pomodoro";

const STORAGE_KEY = "din-ai-pomodoro";

export function createInitialPomodoroState(): PomodoroState {
  return {
    phase: "focus",
    status: "idle",
    remainingSeconds: PHASE_DURATIONS.focus,
    completedPomodoros: 0,
    endsAt: null,
    updatedAt: new Date().toISOString(),
  };
}

export function loadPomodoroState(): PomodoroState {
  if (typeof window === "undefined") {
    return createInitialPomodoroState();
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialPomodoroState();

    const parsed = JSON.parse(raw) as Partial<PomodoroState>;
    const phase = isValidPhase(parsed.phase) ? parsed.phase : "focus";
    const status =
      parsed.status === "running" ||
      parsed.status === "paused" ||
      parsed.status === "idle"
        ? parsed.status
        : "idle";

    return {
      phase,
      status,
      remainingSeconds:
        typeof parsed.remainingSeconds === "number" && parsed.remainingSeconds >= 0
          ? parsed.remainingSeconds
          : PHASE_DURATIONS[phase],
      completedPomodoros:
        typeof parsed.completedPomodoros === "number" && parsed.completedPomodoros >= 0
          ? parsed.completedPomodoros
          : 0,
      endsAt: typeof parsed.endsAt === "number" ? parsed.endsAt : null,
      updatedAt:
        typeof parsed.updatedAt === "string"
          ? parsed.updatedAt
          : new Date().toISOString(),
    };
  } catch {
    return createInitialPomodoroState();
  }
}

export function savePomodoroState(state: PomodoroState): void {
  if (typeof window === "undefined") return;

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...state,
      updatedAt: new Date().toISOString(),
    }),
  );
}

function isValidPhase(value: unknown): value is PomodoroPhase {
  return value === "focus" || value === "shortBreak" || value === "longBreak";
}
