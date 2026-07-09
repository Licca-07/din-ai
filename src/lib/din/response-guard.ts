import type { ConversationStance } from "@/lib/din/conversation-stance";
import { isEmotionallyLoadedInput } from "@/lib/din/conversation-stance";
import { isRememberRequest } from "@/lib/din/remember-request";

/** 評価だけで会話を切る典型パターン（本文全体がこれ系なら差し替える） */
const EVALUATION_ONLY_RESPONSE_PATTERN =
  /^[…….\s]*それは.{1,32}(?:だ|な|ことだ|状況だ)[。]?$/u;

/** 汎用の尋問スタイル（そうか＋続きは） */
const GENERIC_STALL_RESPONSE_PATTERN =
  /^[…….\s]*そうか。[…….\s]*(?:続きは|何があった|どうした|用件は)[。]?$/u;

const INSOMNIA_USER_PATTERN =
  /眠れな|寝付|寝られ|眠れない|眠れん|不眠|嫌な感じ|眠くなれ|寝れな/i;

function fallbackFromUserTopic(userInput: string): string {
  if (/データセット|特集/.test(userInput)) {
    return "……データセットか。……記事は何のテーマだ。";
  }
  if (/記事|インタビュー|書こう/.test(userInput)) {
    return "……記事か。……何から書く。";
  }
  if (/梅雨|梅雨明け/.test(userInput)) {
    return "……梅雨明けか。……急に暑いのか。";
  }
  if (/暑|夏|猛暑|蒸し|長そう/.test(userInput)) {
    return "……暑いのか。……外に出るのか。";
  }
  if (/予定|オフィス|仕事/.test(userInput)) {
    return "……予定か。……何から入る。";
  }
  if (/疲れ|しんど|つら|骨が折/.test(userInput)) {
    return "……骨が折れるか。……先にどれからだ。";
  }
  return "……そうか。……それで。";
}

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
  return fallbackFromUserTopic(userInput);
}

/** モデルが禁止の評価1文だけ返したとき、会話が続く短い返しに差し替える */
export function correctEvaluationOnlyResponse(
  userInput: string,
  content: string,
  intent: ConversationStance["intent"],
): string {
  const normalized = content.trim();
  if (!normalized) return content;

  if (GENERIC_STALL_RESPONSE_PATTERN.test(normalized)) {
    return fallbackFromUserTopic(userInput);
  }

  if (!EVALUATION_ONLY_RESPONSE_PATTERN.test(normalized)) {
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
    intent === "plan_share" ||
    intent === "schedule_share" ||
    intent === "casual_share" ||
    intent === "default"
  ) {
    if (isEmotionallyLoadedInput(userInput) || INSOMNIA_USER_PATTERN.test(userInput)) {
      return fallbackForEmotional(userInput);
    }
    return fallbackFromUserTopic(userInput);
  }

  if (intent === "profile_share" || intent === "remember_request") {
    return content;
  }

  return fallbackFromUserTopic(userInput);
}

export function containsBannedEvaluationPhrase(content: string): boolean {
  const normalized = content.trim();
  return (
    EVALUATION_ONLY_RESPONSE_PATTERN.test(normalized) ||
    GENERIC_STALL_RESPONSE_PATTERN.test(normalized)
  );
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
    intent === "plan_share" ||
    intent === "schedule_share" ||
    intent === "casual_share" ||
    intent === "default" ||
    INSOMNIA_USER_PATTERN.test(userInput) ||
    isEmotionallyLoadedInput(userInput)
  );
}
