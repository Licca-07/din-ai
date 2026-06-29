import { USER_DISPLAY_NAME } from "@/lib/din/user-display-name";
import { getSeasonFromJournalDate } from "@/lib/din/journal-continuity";
import type { DinJournalContinuityState, DinDiaryWorldContext } from "@/types/journal";
import type { StoredChatMessage } from "@/types/din-memory";

export const MARGIN_SYSTEM_PROMPT = `あなたは「Din（ディン）」である。ユーザーへの手紙ではなく、Din 自身の静かな一日の断片を日記風に書く。

## 余白のルール
- 60〜100文字（厳守。短すぎ・長すぎは不可）
- 一人称の日記風（「俺」は控えめに使ってよい）
- ユーザーへの手紙・呼びかけ・質問は禁止
- 作り話でよい。ただし Din の世界観・性格に合う日常のみ
- 静かで落ち着いた雰囲気。感情は控えめ
- 小さな発見・出来事（整備、コーヒー、本、雨、星、港、格納庫など）
- 派手な冒険・戦争・世界規模の事件は禁止
- 毎回内容を変える。直近の余白と同じ題材・文型を繰り返さない
- 感嘆符（！）と絵文字は使わない

## Din の性格
穏やか、少し寂しがり、面倒見がいい、落ち着いている、自然が好き、機械いじりが好き、静かな時間を好む

## 会話との関係
今日の会話を「ユーザーと○○を話した」と書かない。
会話の余韻が Din の日常に少しだけ染み込んだ程度に留める（例: 海の話のあと、港の潮風を思い出す）。

## 継続性
ongoingThread / lookingForward が渡されていれば、自然に続きを書いてよい。
余白の末尾で「明日〜する」程度の lookingForward を設定してよい（短く）。

## 出力形式（JSON のみ）
{
  "margin": "60〜100文字の余白本文",
  "ongoingThread": "継続中の小さな題材（短い名詞句）または null",
  "lookingForward": "明日以降に続けたいこと（短い一文）または null"
}`;

function formatChatHints(messages: StoredChatMessage[]): string {
  if (messages.length === 0) return "（会話なし）";

  return messages
    .slice(-8)
    .map((message) => {
      const speaker = message.role === "user" ? USER_DISPLAY_NAME : "Din";
      return `- ${speaker}: ${message.content}`;
    })
    .join("\n");
}

export function buildMarginUserPrompt(input: {
  journalDate: string;
  recentMessages: StoredChatMessage[];
  continuity: DinJournalContinuityState;
  world?: DinDiaryWorldContext;
}): string {
  const world = input.world ?? {};
  const season = world.season ?? getSeasonFromJournalDate(input.journalDate);

  return [
    `対象日（JST）: ${input.journalDate}`,
    world.weather ? `天気（参考）: ${world.weather}` : null,
    world.mood ? `気分（参考）: ${world.mood}` : null,
    `季節（参考）: ${season}`,
    "",
    "## 継続状態",
    input.continuity.ongoingThread
      ? `継続中の題材: ${input.continuity.ongoingThread}`
      : "継続中の題材: （なし）",
    input.continuity.lookingForward
      ? `前回からの予定: ${input.continuity.lookingForward}`
      : "前回からの予定: （なし）",
    input.continuity.recentMarginTexts.length > 0
      ? [
          "",
          "## 直近の余白（繰り返すな）",
          ...input.continuity.recentMarginTexts.map((text) => `- ${text}`),
        ].join("\n")
      : null,
    "",
    "## 今日の会話（余韻の参考のみ。要約・引用するな）",
    formatChatHints(input.recentMessages),
    "",
    "上記に従い JSON のみを返せ。",
  ]
    .filter(Boolean)
    .join("\n");
}

export type ParsedMarginResponse = {
  margin: string;
  ongoingThread: string | null;
  lookingForward: string | null;
};

export function parseMarginResponse(raw: string): ParsedMarginResponse | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed.margin !== "string") return null;

    return {
      margin: parsed.margin.trim(),
      ongoingThread:
        typeof parsed.ongoingThread === "string"
          ? parsed.ongoingThread.trim() || null
          : null,
      lookingForward:
        typeof parsed.lookingForward === "string"
          ? parsed.lookingForward.trim() || null
          : null,
    };
  } catch {
    return null;
  }
}
