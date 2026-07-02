import { loadConversationCount } from "@/lib/din/conversation-count";
import {
  getJournalDateDiffDays,
  getJournalDateJst,
  getJstHour,
  getJstWeekday,
} from "@/lib/din/journal-date";

export type DinTimeBand = "morning" | "afternoon" | "evening" | "late_night";

export type DinDayType = "weekday" | "weekend";

export type DinAbsence = "normal" | "one_day" | "three_days" | "one_week";

export type DinRelationship =
  | "business"
  | "nakama"
  | "trusted_nakama"
  | "clan";

export type DinSessionContext = {
  currentDateTime: string;
  timeBand: DinTimeBand;
  dayType: DinDayType;
  absence: DinAbsence;
  relationship: DinRelationship;
  conversationCount: number;
  lateNightFrequent: boolean;
  isGreeting: boolean;
};

const LAST_VISIT_KEY = "din-ai-last-visit";
const LATE_NIGHT_VISITS_KEY = "din-ai-late-night-visits";

export function formatCurrentDateTimeJst(date = new Date()): string {
  const formatted = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

  return `${formatted} (JST)`;
}

export function getTimeBand(date = new Date()): DinTimeBand {
  const hour = getJstHour(date);

  if (hour >= 0 && hour < 5) return "late_night";
  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "afternoon";
  return "evening";
}

/** 21:00 以降、または深夜 0:00〜4:59 を就寝ウィンドウとみなす */
export function isBedtimeWindow(date = new Date()): boolean {
  const hour = getJstHour(date);
  return hour >= 21 || hour < 5;
}

/** 20:00 以降なら「忙しかった」系の振り返り。それ以前は「忙しい」系 */
export function isPastDayReflectionTime(date = new Date()): boolean {
  return getJstHour(date) >= 20;
}

/** 2:00〜5:59（JST）の早朝帯。夜中に目が覚えたユーザー向け */
export function isEarlyMorningWakeWindow(date = new Date()): boolean {
  const hour = getJstHour(date);
  return hour >= 2 && hour < 6;
}

export const EARLY_MORNING_WAKE_OPENERS = [
  "目が覚めたのか。",
  "起きたのか。",
  "眠れなかったのか。",
  "目が覚めたか。",
  "夜中に目が覚めたのか。",
  "まだ起きていたのか。",
] as const;

export function getBusyCheckGreeting(date = new Date()): string {
  return isPastDayReflectionTime(date)
    ? "忙しかったのか。"
    : "今日は忙しいのか？";
}

/** クライアントの timeBand を優先し、就寝系 intent を夜間に確実に有効化する */
export function isSleepTimeContext(context?: DinSessionContext): boolean {
  if (context?.timeBand === "late_night") return true;
  if (context?.timeBand === "evening") return isBedtimeWindow();
  return isBedtimeWindow();
}

export function getDayType(date = new Date()): DinDayType {
  const day = getJstWeekday(date);
  return day === 0 || day === 6 ? "weekend" : "weekday";
}

export function getAbsence(lastVisitIso: string | null, now = new Date()): DinAbsence {
  if (!lastVisitIso) return "normal";

  const diffDays = getJournalDateDiffDays(
    getJournalDateJst(new Date(lastVisitIso)),
    getJournalDateJst(now),
  );

  if (diffDays >= 7) return "one_week";
  if (diffDays >= 3) return "three_days";
  if (diffDays >= 1) return "one_day";
  return "normal";
}

export function getRelationshipFromCount(
  conversationCount: number,
): DinRelationship {
  if (conversationCount >= 200) return "clan";
  if (conversationCount >= 50) return "trusted_nakama";
  if (conversationCount >= 10) return "nakama";
  return "business";
}

function readLateNightVisits(): string[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(LATE_NIGHT_VISITS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

export function isLateNightFrequent(now = new Date()): boolean {
  const visits = readLateNightVisits();
  const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const recentVisits = visits.filter(
    (iso) => new Date(iso).getTime() >= sevenDaysAgo,
  );

  return recentVisits.length >= 3;
}

export function recordSessionVisit(now = new Date()): void {
  if (typeof window === "undefined") return;

  const iso = now.toISOString();
  localStorage.setItem(LAST_VISIT_KEY, iso);

  if (getTimeBand(now) === "late_night") {
    const visits = readLateNightVisits();
    visits.push(iso);
    localStorage.setItem(LATE_NIGHT_VISITS_KEY, JSON.stringify(visits.slice(-20)));
  }
}

export function getLastVisitIso(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LAST_VISIT_KEY);
}

export function maxIsoTimestamp(
  a: string | null | undefined,
  b: string | null | undefined,
): string | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

export function buildSessionContext(options?: {
  isGreeting?: boolean;
  conversationCount?: number;
  now?: Date;
}): DinSessionContext {
  const now = options?.now ?? new Date();
  const lastVisit = getLastVisitIso();

  const conversationCount = options?.conversationCount ?? loadConversationCount();

  return {
    currentDateTime: formatCurrentDateTimeJst(now),
    timeBand: getTimeBand(now),
    dayType: getDayType(now),
    absence: getAbsence(lastVisit, now),
    relationship: getRelationshipFromCount(conversationCount),
    conversationCount,
    lateNightFrequent: isLateNightFrequent(now),
    isGreeting: options?.isGreeting ?? false,
  };
}

export function getRelationshipLabel(relationship: DinRelationship): string {
  const labels: Record<DinRelationship, string> = {
    business: "ビジネスライク",
    nakama: "仲間",
    trusted_nakama: "信頼できる仲間",
    clan: "クラン",
  };

  return labels[relationship];
}

export function describeSessionContext(context: DinSessionContext): string {
  const timeBandLabels: Record<DinTimeBand, string> = {
    morning: "朝（5:00〜11:00）",
    afternoon: "昼（11:00〜17:00）",
    evening: "夜（17:00〜24:00）",
    late_night: "深夜（0:00〜5:00）",
  };

  const dayTypeLabels: Record<DinDayType, string> = {
    weekday: "平日",
    weekend: "休日",
  };

  const absenceLabels: Record<DinAbsence, string> = {
    normal: "通常（本日または初回）",
    one_day: "1日ぶり",
    three_days: "3日ぶり",
    one_week: "1週間ぶり",
  };

  return [
    `現在日時: ${context.currentDateTime}`,
    `時間帯: ${timeBandLabels[context.timeBand]}`,
    `曜日区分: ${dayTypeLabels[context.dayType]}`,
    `会話間隔: ${absenceLabels[context.absence]}`,
    `深夜利用が頻発: ${context.lateNightFrequent ? "はい" : "いいえ"}`,
    `挨拶生成: ${context.isGreeting ? "はい（会話開始の最初の一言）" : "いいえ（通常応答）"}`,
  ].join("\n");
}
