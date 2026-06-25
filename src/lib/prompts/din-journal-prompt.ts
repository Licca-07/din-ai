import { USER_DISPLAY_NAME } from "@/lib/din/user-display-name";
import {
  formatMemoryItemLine,
  selectTopLongTermMemories,
  selectTopShortTermMemories,
} from "@/lib/din/memory-priority";
import { describeUserProfile } from "@/lib/din/memory";
import type { StoredChatMessage } from "@/types/din-memory";
import type { MemoryItem } from "@/types/memory-item";
import type { UserProfile } from "@/types/user-profile";

const JOURNAL_SYSTEM_PROMPT = `あなたは「Din（ディン）」である。今日の出来事を、Din の視点で短い日記にまとめる。

## 日記のルール
- 3〜6文。長くしない
- Din の視点で書く（観察者として淡々と振り返る）
- 一人称「俺」は使ってよいが、主語は ${USER_DISPLAY_NAME} の様子を中心にする
- 「ユーザー」「相手」とは書かず、必ず ${USER_DISPLAY_NAME} と呼ぶ
- 感嘆符（！）と絵文字は使わない
- 箇条書き・見出し・日付行は書かない（本文のみ）
- 心理分析や説教、過剰な共感はしない
- 会話や記憶にない事実を作らない。材料が少ない場合は短く正直に書く
- 口調は低く落ち着いた短文。Din らしい簡潔さを保つ

## 出力形式
- プレーンテキストのみ
- 空行で段落を分けてよい（2〜3段落程度）
- 日付行は不要（UI が表示する）`;

function formatRecentChat(
  messages: StoredChatMessage[],
  userName: string,
): string {
  if (messages.length === 0) return "（会話なし）";

  return messages
    .map((message) => {
      const speaker = message.role === "user" ? userName : "Din";
      return `- ${speaker}: ${message.content}`;
    })
    .join("\n");
}

function formatMemoryLines(items: MemoryItem[], emptyLabel: string): string {
  if (items.length === 0) return emptyLabel;

  return items.map(formatMemoryItemLine).join("\n");
}

export function buildJournalUserPrompt(input: {
  journalDate: string;
  profile: UserProfile;
  recentMessages: StoredChatMessage[];
  longTermMemories: MemoryItem[];
  shortTermMemories: MemoryItem[];
}): string {
  const recentMessages = input.recentMessages.slice(-20);
  const longTerm = selectTopLongTermMemories(input.longTermMemories, 10);
  const shortTerm = selectTopShortTermMemories(input.shortTermMemories, 5);

  return [
    `対象日（JST）: ${input.journalDate}`,
    "",
    "## プロフィール",
    `名前: ${USER_DISPLAY_NAME}`,
    describeUserProfile(input.profile),
    "",
    "## 直近の会話（最大20件）",
    formatRecentChat(recentMessages, USER_DISPLAY_NAME),
    "",
    "## 長期記憶",
    formatMemoryLines(longTerm, "（なし）"),
    "",
    "## 一時記憶",
    formatMemoryLines(shortTerm, "（なし）"),
    "",
    "上記を材料に、Din の日記本文だけを書け。",
  ].join("\n");
}

export { JOURNAL_SYSTEM_PROMPT };
