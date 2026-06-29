import { getJournalDateJst } from "@/lib/din/journal-date";
import type { DinJournalContinuityState } from "@/types/journal";

export const DEFAULT_JOURNAL_CONTINUITY: DinJournalContinuityState = {
  lastMarginDate: null,
  nextMarginOnOrAfter: null,
  ongoingThread: null,
  lookingForward: null,
  recentMarginTexts: [],
};

const RECENT_MARGIN_LIMIT = 8;

export function normalizeContinuityState(
  value: Partial<DinJournalContinuityState> | null | undefined,
): DinJournalContinuityState {
  if (!value) return { ...DEFAULT_JOURNAL_CONTINUITY };

  return {
    lastMarginDate: value.lastMarginDate ?? null,
    nextMarginOnOrAfter: value.nextMarginOnOrAfter ?? null,
    ongoingThread: value.ongoingThread ?? null,
    lookingForward: value.lookingForward ?? null,
    recentMarginTexts: Array.isArray(value.recentMarginTexts)
      ? value.recentMarginTexts.filter(
          (text): text is string => typeof text === "string" && text.trim().length > 0,
        )
      : [],
  };
}

/** 2〜3日に1回: nextMarginOnOrAfter 以降の最初の日記生成で余白を付ける */
export function shouldIncludeJournalMargin(
  journalDate: string,
  state: DinJournalContinuityState,
): boolean {
  if (!state.nextMarginOnOrAfter) {
    return true;
  }

  return journalDate >= state.nextMarginOnOrAfter;
}

/** 余白を付けた日から、2日後または3日後を次の候補日にする */
export function scheduleNextMarginOnOrAfter(
  journalDate: string,
  random = Math.random(),
): string {
  const dayOffset = random < 0.5 ? 2 : 3;
  const anchor = new Date(`${journalDate}T12:00:00+09:00`);
  return getJournalDateJst(
    new Date(anchor.getTime() + dayOffset * 24 * 60 * 60 * 1000),
  );
}

export function getSeasonFromJournalDate(journalDate: string): string {
  const month = Number.parseInt(journalDate.slice(5, 7), 10);
  if (month >= 3 && month <= 5) return "春";
  if (month >= 6 && month <= 8) return "夏";
  if (month >= 9 && month <= 11) return "秋";
  return "冬";
}

export type MarginGenerationMeta = {
  margin: string;
  ongoingThread?: string | null;
  lookingForward?: string | null;
};

export function applyMarginToContinuity(
  state: DinJournalContinuityState,
  journalDate: string,
  meta: MarginGenerationMeta,
  random = Math.random(),
): DinJournalContinuityState {
  const margin = meta.margin.trim();
  const recentMarginTexts = [
    margin,
    ...state.recentMarginTexts.filter((text) => text !== margin),
  ].slice(0, RECENT_MARGIN_LIMIT);

  return {
    lastMarginDate: journalDate,
    nextMarginOnOrAfter: scheduleNextMarginOnOrAfter(journalDate, random),
    ongoingThread: meta.ongoingThread?.trim() || null,
    lookingForward: meta.lookingForward?.trim() || null,
    recentMarginTexts,
  };
}

export function normalizeMarginText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

export function isMarginLengthValid(text: string): boolean {
  const length = normalizeMarginText(text).length;
  return length >= 50 && length <= 120;
}

const MARGIN_BANNED_PATTERN =
  /世界を救|巨大な戦|大戦争|毎回.*戦|宇宙征服|魔王|英雄にな/;

export function isMarginContentAllowed(text: string): boolean {
  return !MARGIN_BANNED_PATTERN.test(normalizeMarginText(text));
}
