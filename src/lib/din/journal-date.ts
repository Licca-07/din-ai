function getJstDate(date = new Date()): Date {
  return new Date(date.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
}

/** JST の日付（YYYY-MM-DD） */
export function getJournalDateJst(date = new Date()): string {
  const jst = getJstDate(date);
  const year = jst.getFullYear();
  const month = String(jst.getMonth() + 1).padStart(2, "0");
  const day = String(jst.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function formatJournalDateLabel(journalDate: string): string {
  const date = new Date(`${journalDate}T12:00:00+09:00`);
  if (Number.isNaN(date.getTime())) return journalDate;

  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
}
