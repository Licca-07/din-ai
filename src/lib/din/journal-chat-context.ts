import { getJournalDateJst } from "@/lib/din/journal-date";
import { fetchJournalContinuity } from "@/lib/supabase/journal-continuity-repository";
import { fetchJournalByDate } from "@/lib/supabase/journal-repository";

/** チャット応答と日記余白の整合に使う、当日の Din の生活コンテキスト */
export type DinJournalChatContext = {
  journalDate: string;
  margin: string | null;
  ongoingThread: string | null;
  lookingForward: string | null;
};

export async function loadJournalChatContext(): Promise<DinJournalChatContext | null> {
  try {
    const journalDate = getJournalDateJst();
    const [journal, continuity] = await Promise.all([
      fetchJournalByDate(journalDate),
      fetchJournalContinuity(),
    ]);

    return {
      journalDate,
      margin: journal?.margin ?? null,
      ongoingThread: continuity.ongoingThread,
      lookingForward: continuity.lookingForward,
    };
  } catch (error) {
    console.error("[loadJournalChatContext]", error);
    return null;
  }
}

export function describeJournalChatContext(
  journal: DinJournalChatContext,
): string {
  const lines = [
    "### 今日の Din（日記余白との整合・最優先）",
    "ユーザーが Din の今日の予定・行動・何をしているかを聞いている。",
    "以下は Din の日記余白・継続状態から得た**事実**として扱う。矛盾する返答は禁止。",
    `- 対象日（JST）: ${journal.journalDate}`,
    journal.margin
      ? `- 今日の余白: ${journal.margin}`
      : "- 今日の余白: （まだない）",
    journal.ongoingThread
      ? `- 継続中の題材: ${journal.ongoingThread}`
      : null,
    journal.lookingForward
      ? `- 予定・続き: ${journal.lookingForward}`
      : null,
    "",
    "答え方:",
    "- Din 口調で1〜2文。余白の内容を短く言い切る（……港で本を読んでいる。……整備をしている。）",
    "- 2文目に ……傍にいる。……ここにいる。 を足してよい",
    "- 「任務に集中している。」「任務があるからな。」**だけ**で終わるのは禁止",
    "- 日記に本・港・整備などが出ていれば、それを答える。任務だけ言ってごまかすな",
    "- 余白がない場合は ……特に予定はない。……ここにいる。",
  ];

  return lines.filter(Boolean).join("\n");
}
