import {
  applyMarginToContinuity,
  getSeasonFromJournalDate,
  isMarginContentAllowed,
  isMarginLengthValid,
  normalizeMarginText,
  shouldIncludeJournalMargin,
} from "@/lib/din/journal-continuity";
import {
  buildJournalUserPrompt,
  JOURNAL_SYSTEM_PROMPT,
} from "@/lib/prompts/din-journal-prompt";
import {
  buildMarginUserPrompt,
  MARGIN_SYSTEM_PROMPT,
  parseMarginResponse,
} from "@/lib/prompts/din-journal-margin-prompt";
import { getOpenAIClient, getOpenAIModelMini } from "@/lib/openai";
import type { StoredChatMessage } from "@/types/din-memory";
import type {
  DinDiaryWorldContext,
  DinJournalContinuityState,
} from "@/types/journal";
import type { MemoryItem } from "@/types/memory-item";
import type { UserProfile } from "@/types/user-profile";

export type DinDiaryGenerationInput = {
  journalDate: string;
  profile: UserProfile;
  recentMessages: StoredChatMessage[];
  longTermMemories: MemoryItem[];
  shortTermMemories: MemoryItem[];
  continuity: DinJournalContinuityState;
  /** 未指定なら continuity と日付から自動判定（2〜3日に1回） */
  includeMargin?: boolean;
  world?: DinDiaryWorldContext;
};

export type DinDiaryGenerationResult = {
  conversationContent: string;
  margin: string | null;
  continuity: DinJournalContinuityState;
};

async function generateConversationJournal(
  input: DinDiaryGenerationInput,
): Promise<string> {
  const openai = getOpenAIClient();
  const model = getOpenAIModelMini();

  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: JOURNAL_SYSTEM_PROMPT },
      {
        role: "user",
        content: buildJournalUserPrompt({
          journalDate: input.journalDate,
          profile: input.profile,
          recentMessages: input.recentMessages,
          longTermMemories: input.longTermMemories,
          shortTermMemories: input.shortTermMemories,
        }),
      },
    ],
    temperature: 0.7,
  });

  const content = completion.choices[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("日記本文を生成できませんでした。");
  }

  return content;
}

async function generateMarginSection(
  input: DinDiaryGenerationInput,
): Promise<{ margin: string; ongoingThread: string | null; lookingForward: string | null }> {
  const openai = getOpenAIClient();
  const model = getOpenAIModelMini();
  const world: DinDiaryWorldContext = {
    season: getSeasonFromJournalDate(input.journalDate),
    ...input.world,
  };

  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: MARGIN_SYSTEM_PROMPT },
      {
        role: "user",
        content: buildMarginUserPrompt({
          journalDate: input.journalDate,
          recentMessages: input.recentMessages,
          continuity: input.continuity,
          world,
        }),
      },
    ],
    temperature: 0.88,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content?.trim();
  if (!raw) {
    throw new Error("余白を生成できませんでした。");
  }

  const parsed = parseMarginResponse(raw);
  if (!parsed) {
    throw new Error("余白の形式が正しくありません。");
  }

  const margin = normalizeMarginText(parsed.margin);
  if (!isMarginLengthValid(margin) || !isMarginContentAllowed(margin)) {
    throw new Error("余白の内容または長さが基準を満たしません。");
  }

  return {
    margin,
    ongoingThread: parsed.ongoingThread,
    lookingForward: parsed.lookingForward,
  };
}

/**
 * 会話要約日記と、条件を満たす場合の余白（Din の別生活）を生成する。
 * 継続状態（ongoingThread / lookingForward）は余白生成時のみ更新する。
 */
export async function generateDinDiary(
  input: DinDiaryGenerationInput,
): Promise<DinDiaryGenerationResult> {
  const includeMargin =
    input.includeMargin ??
    shouldIncludeJournalMargin(input.journalDate, input.continuity);

  const conversationContent = await generateConversationJournal(input);

  if (!includeMargin) {
    return {
      conversationContent,
      margin: null,
      continuity: input.continuity,
    };
  }

  try {
    const marginMeta = await generateMarginSection(input);

    return {
      conversationContent,
      margin: marginMeta.margin,
      continuity: applyMarginToContinuity(
        input.continuity,
        input.journalDate,
        marginMeta,
      ),
    };
  } catch (error) {
    console.error("[generateDinDiary margin]", error);
    return {
      conversationContent,
      margin: null,
      continuity: input.continuity,
    };
  }
}
