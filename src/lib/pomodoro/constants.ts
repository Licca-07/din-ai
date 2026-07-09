import type { PomodoroPhase } from "@/types/pomodoro";

export const FOCUS_SECONDS = 25 * 60;
export const SHORT_BREAK_SECONDS = 5 * 60;
export const LONG_BREAK_SECONDS = 15 * 60;
export const POMODOROS_BEFORE_LONG_BREAK = 4;

export const PHASE_DURATIONS: Record<PomodoroPhase, number> = {
  focus: FOCUS_SECONDS,
  shortBreak: SHORT_BREAK_SECONDS,
  longBreak: LONG_BREAK_SECONDS,
};

export const PHASE_LABELS: Record<PomodoroPhase, string> = {
  focus: "集中",
  shortBreak: "短い休憩",
  longBreak: "長い休憩",
};
