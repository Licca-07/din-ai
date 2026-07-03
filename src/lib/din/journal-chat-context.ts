import { getJournalDateJst } from "@/lib/din/journal-date";
import { fetchJournalContinuity } from "@/lib/supabase/journal-continuity-repository";
import { fetchJournalByDate } from "@/lib/supabase/journal-repository";
import { isSupabaseConfigured } from "@/lib/supabase/server";

/** クライアントが既に読み込んだ当日日記（サーバー fetch のフォールバック） */
export type JournalContextInput = {
  journalDate: string;
  margin?: string | null;
  contentExcerpt?: string | null;
};

/** チャット応答と日記余白の整合に使う、当日の Din の生活コンテキスト */
export type DinJournalChatContext = {
  journalDate: string;
  margin: string | null;
  /** 余白がない日でも、会話要約日記の冒頭を背景に使う */
  contentExcerpt: string | null;
  ongoingThread: string | null;
  lookingForward: string | null;
};

function excerptJournalContent(
  content: string | null | undefined,
  maxLength = 160,
): string | null {
  if (!content?.trim()) return null;

  const normalized = content.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;

  return `${normalized.slice(0, maxLength)}…`;
}

function buildJournalChatContext(input: {
  journalDate: string;
  margin: string | null;
  contentExcerpt: string | null;
  ongoingThread: string | null;
  lookingForward: string | null;
}): DinJournalChatContext | null {
  if (
    !input.margin &&
    !input.contentExcerpt &&
    !input.ongoingThread &&
    !input.lookingForward
  ) {
    return null;
  }

  return input;
}

export function hasJournalChatSignal(
  journal: DinJournalChatContext | null | undefined,
): journal is DinJournalChatContext {
  if (!journal) return false;

  return Boolean(
    journal.margin ||
      journal.contentExcerpt ||
      journal.ongoingThread ||
      journal.lookingForward,
  );
}

export async function loadJournalChatContext(
  clientContext?: JournalContextInput | null,
): Promise<DinJournalChatContext | null> {
  const journalDate = clientContext?.journalDate ?? getJournalDateJst();

  if (!isSupabaseConfigured()) {
    return buildJournalChatContext({
      journalDate,
      margin: clientContext?.margin?.trim() || null,
      contentExcerpt: clientContext?.contentExcerpt?.trim() || null,
      ongoingThread: null,
      lookingForward: null,
    });
  }

  try {
    const [journal, continuity] = await Promise.all([
      fetchJournalByDate(journalDate),
      fetchJournalContinuity(),
    ]);

    const margin =
      journal?.margin?.trim() ||
      clientContext?.margin?.trim() ||
      null;
    const contentExcerpt =
      clientContext?.contentExcerpt?.trim() ||
      excerptJournalContent(journal?.content) ||
      null;

    return buildJournalChatContext({
      journalDate,
      margin,
      contentExcerpt,
      ongoingThread: continuity.ongoingThread,
      lookingForward: continuity.lookingForward,
    });
  } catch (error) {
    console.error("[loadJournalChatContext]", error);

    return buildJournalChatContext({
      journalDate,
      margin: clientContext?.margin?.trim() || null,
      contentExcerpt: clientContext?.contentExcerpt?.trim() || null,
      ongoingThread: null,
      lookingForward: null,
    });
  }
}

export function describeJournalChatContext(
  journal: DinJournalChatContext,
): string {
  const lines = [
    "## 今日の Din（日記・余白との整合）",
    "以下は Din の日記・余白・継続状態から得た**事実**。Din の一日・行動・今何をしているかに触れるときは、これと矛盾する返答をしてはならない。",
    `- 対象日（JST）: ${journal.journalDate}`,
    journal.margin
      ? `- 今日の余白: ${journal.margin}`
      : "- 今日の余白: （まだない）",
    journal.contentExcerpt
      ? `- 今日の日記（要約）: ${journal.contentExcerpt}`
      : null,
    journal.ongoingThread
      ? `- 継続中の題材: ${journal.ongoingThread}`
      : null,
    journal.lookingForward
      ? `- 予定・続き: ${journal.lookingForward}`
      : null,
    "",
    "使い方:",
    "- ユーザーが Din の一日・予定・行動を聞いたとき: 余白を最優先で短く言い切る（……港で本を読んでいる。）",
    "- 余白がない日: 日記要約か継続題材から具体を1点拾う。なければ ……特に予定はない。……ここにいる。",
    "- 「任務に集中している。」「任務があるからな。」**だけ**で距離を取るのは禁止",
    "- 2文目に ……傍にいる。……ここにいる。 ……お前はどうだった。 を足してよい",
  ];

  return lines.filter(Boolean).join("\n");
}

export function journalContextFromClientJournal(
  journalDate: string,
  journal: { margin?: string | null; content?: string | null } | null,
): JournalContextInput | undefined {
  if (!journal) return undefined;

  return {
    journalDate,
    margin: journal.margin ?? null,
    contentExcerpt: excerptJournalContent(journal.content),
  };
}
