const JST = "Asia/Tokyo";

export type JstDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  weekday: number;
};

function readJstParts(date: Date): JstDateParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: JST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    weekday: "short",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";

  const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return {
    year: Number.parseInt(read("year"), 10),
    month: Number.parseInt(read("month"), 10),
    day: Number.parseInt(read("day"), 10),
    hour: Number.parseInt(read("hour"), 10),
    weekday: weekdayLabels.indexOf(read("weekday")),
  };
}

/** API / DB から来た日付文字列を JST の YYYY-MM-DD に正規化する */
export function normalizeJournalDate(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return getJournalDateJst(parsed);
  }

  return trimmed;
}

/** JST の日付（YYYY-MM-DD） */
export function getJournalDateJst(date = new Date()): string {
  const { year, month, day } = readJstParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** JST の 0〜23 時 */
export function getJstHour(date = new Date()): number {
  return readJstParts(date).hour;
}

/** JST の曜日（0=日, 6=土） */
export function getJstWeekday(date = new Date()): number {
  return readJstParts(date).weekday;
}

/** JST カレンダー上の前日（YYYY-MM-DD） */
export function getPreviousJournalDateJst(date = new Date()): string {
  const noonJst = new Date(`${getJournalDateJst(date)}T12:00:00+09:00`);
  return getJournalDateJst(new Date(noonJst.getTime() - 24 * 60 * 60 * 1000));
}

/** JST カレンダー上で fromDay から toDay まで何日離れているか（同日=0） */
export function getJournalDateDiffDays(fromDay: string, toDay: string): number {
  const from = new Date(`${normalizeJournalDate(fromDay)}T12:00:00+09:00`);
  const to = new Date(`${normalizeJournalDate(toDay)}T12:00:00+09:00`);
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

export function formatJournalDateLabel(journalDate: string): string {
  const date = new Date(`${normalizeJournalDate(journalDate)}T12:00:00+09:00`);
  if (Number.isNaN(date.getTime())) return journalDate;

  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: JST,
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
}
