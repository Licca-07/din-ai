import type { ConversationStance } from "@/lib/din/conversation-stance";
import { isEmotionallyLoadedInput } from "@/lib/din/conversation-stance";
import { isRememberRequest } from "@/lib/din/remember-request";

/** 評価だけで会話を切る典型パターン（本文全体がこれ系なら差し替える） */
const EVALUATION_ONLY_RESPONSE_PATTERN =
  /^[…….\s]*それは.{1,32}(?:だ|な|ことだ|状況だ)[。]?$/u;

const INSOMNIA_USER_PATTERN =
  /眠れな|寝付|寝られ|眠れない|眠れん|不眠|嫌な感じ|眠くなれ|寝れな/i;

function fallbackForInsomnia(userInput: string): string {
  if (/嫌な感じ|不安|怖/.test(userInput)) {
    return "……そうか。……どんな感じだ。";
  }
  if (/何故|なぜ|原因/.test(userInput)) {
    return "……そうか。……いつからだ。";
  }
  return "……そうか。……何が気になる。";
}

function fallbackForEmotional(userInput: string): string {
  if (INSOMNIA_USER_PATTERN.test(userInput)) {
    return fallbackForInsomnia(userInput);
  }
  if (/疲れ|しんど|つら/.test(userInput)) {
    return "……そうか。……今日は何があった。";
  }
  return "……そうか。……続きは。";
}

/** モデルが禁止の評価1文だけ返したとき、会話が続く短い返しに差し替える */
export function correctEvaluationOnlyResponse(
  userInput: string,
  content: string,
  intent: ConversationStance["intent"],
): string {
  const normalized = content.trim();
  if (!normalized || !EVALUATION_ONLY_RESPONSE_PATTERN.test(normalized)) {
    return content;
  }

  if (intent === "insomnia_share" || INSOMNIA_USER_PATTERN.test(userInput)) {
    return fallbackForInsomnia(userInput);
  }

  if (
    intent === "shared_moment" ||
    intent === "deepen_share" ||
    intent === "interpersonal_share" ||
    intent === "comfort_request" ||
    intent === "default"
  ) {
    if (isEmotionallyLoadedInput(userInput) || INSOMNIA_USER_PATTERN.test(userInput)) {
      return fallbackForEmotional(userInput);
    }
  }

  if (intent === "profile_share" || intent === "remember_request") {
    return content;
  }

  return fallbackForEmotional(userInput);
}

export function containsBannedEvaluationPhrase(content: string): boolean {
  return EVALUATION_ONLY_RESPONSE_PATTERN.test(content.trim());
}

export function shouldGuardConversationIntent(
  intent: ConversationStance["intent"],
  userInput: string,
): boolean {
  if (isRememberRequest(userInput)) return false;
  return (
    intent === "insomnia_share" ||
    intent === "shared_moment" ||
    intent === "deepen_share" ||
    intent === "interpersonal_share" ||
    intent === "default" ||
    INSOMNIA_USER_PATTERN.test(userInput) ||
    isEmotionallyLoadedInput(userInput)
  );
}
