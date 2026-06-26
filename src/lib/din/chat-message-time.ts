import { formatJournalDateLabel, getJournalDateJst } from "@/lib/din/journal-date";
import type { StoredChatMessage } from "@/types/din-memory";

const MINUTE_MS = 60 * 1000;

export function createChatMessageTimestamp(now = new Date()): string {
  return now.toISOString();
}

/** 既存履歴向け: createdAt が無いメッセージのみ補完する */
export function backfillChatHistoryTimestamps(
  messages: StoredChatMessage[],
  lastConversationAt: string | null = null,
): StoredChatMessage[] {
  if (messages.length === 0) {
    return messages;
  }

  if (messages.every((message) => typeof message.createdAt === "string")) {
    return messages;
  }

  const anchorIso = lastConversationAt ?? createChatMessageTimestamp();
  const anchorMs = new Date(anchorIso).getTime();

  return messages.map((message, index) => {
    if (typeof message.createdAt === "string" && message.createdAt.length > 0) {
      return message;
    }

    const offsetFromEnd = messages.length - 1 - index;
    return {
      ...message,
      createdAt: new Date(anchorMs - offsetFromEnd * MINUTE_MS).toISOString(),
    };
  });
}

export function getChatMessageDayKey(createdAt: string): string {
  return getJournalDateJst(new Date(createdAt));
}

/** JST の 24 時間表記（例: 08:14） */
export function formatMessageClockTime(createdAt: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(createdAt));
}

export function formatChatDateDividerLabel(
  createdAt: string,
  now = new Date(),
): string {
  const messageDay = getChatMessageDayKey(createdAt);
  const todayDay = getJournalDateJst(now);
  const yesterdayDay = getJournalDateJst(
    new Date(now.getTime() - 24 * 60 * 60 * 1000),
  );

  if (messageDay === todayDay) return "今日";
  if (messageDay === yesterdayDay) return "昨日";

  return formatJournalDateLabel(messageDay);
}

export function shouldShowChatDateDivider(
  messages: StoredChatMessage[],
  index: number,
): boolean {
  if (index === 0) return true;

  return (
    getChatMessageDayKey(messages[index].createdAt) !==
    getChatMessageDayKey(messages[index - 1].createdAt)
  );
}
