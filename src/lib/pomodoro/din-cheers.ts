export type PomodoroCheerContext =
  | "focusStart"
  | "focusEnd"
  | "breakEnd"
  | "pause"
  | "idle";

/** Din のポモドーロ声かけ（全10種） */
export const DIN_POMODORO_CHEERS: Record<
  Exclude<PomodoroCheerContext, "idle">,
  readonly string[]
> = {
  focusStart: [
    "よし、25分だけ。俺は静かにしてるから。",
    "集中タイムだ。終わったら声かける。",
    "ん、じゃあ行こう。途中で迷っても戻ればいい。",
    "ここからは黙るよ。……必要なら後で話そう。",
  ],
  focusEnd: [
    "終わったな。少し、休め。",
    "25分、よく耐えた。水分ぐらい取っとけ。",
    "一区切りついた。……長く息、吐いていい。",
  ],
  breakEnd: [
    "休めたか。……次、行く？",
    "休憩おしまい。準備できたらスタートで。",
    "そろそろ戻る時間だ。無理はしなくていい。",
  ],
  pause: [
    "……まあ、区切りがついたな。",
    "止めたか。戻るときはスタートでいい。",
  ],
};

const IDLE_CHEERS = [
  "ポモドーロ、使う？ 俺も隣にいるから。",
  "外でも集中できるように、タイマー置いといた。",
  "準備できたらスタート。急がなくていい。",
] as const;

export function pickDinCheer(
  context: PomodoroCheerContext,
  random = Math.random,
): string {
  if (context === "idle") {
    const index = Math.floor(random() * IDLE_CHEERS.length);
    return IDLE_CHEERS[index] ?? IDLE_CHEERS[0];
  }

  const pool = DIN_POMODORO_CHEERS[context];
  const index = Math.floor(random() * pool.length);
  return pool[index] ?? pool[0];
}

export function cheerContextForPhaseEnd(
  phase: "focus" | "shortBreak" | "longBreak",
): PomodoroCheerContext {
  return phase === "focus" ? "focusEnd" : "breakEnd";
}
