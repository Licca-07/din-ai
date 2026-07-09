export type PomodoroPhase = "focus" | "shortBreak" | "longBreak";

export type PomodoroStatus = "idle" | "running" | "paused";

export type PomodoroState = {
  phase: PomodoroPhase;
  status: PomodoroStatus;
  /** 残り秒数（停止中・一時停止中に使用） */
  remainingSeconds: number;
  /** 完了したフォーカスセッション数 */
  completedPomodoros: number;
  /** 実行中の終了予定時刻（Unix ms） */
  endsAt: number | null;
  updatedAt: string;
};
