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

const PRE_SLEEP_USER_PATTERN =
  /ねようかな|寝よう(?:と|かな|って|とは)|そろそろ寝|布団|ふとん|横にな|眠れるかな|ひとりで眠|遅くなっちゃ|寝る遅く|眠くなってきた|うとうと|ねむくなって/i;

const BEDTIME_PARTNER_ASK_PATTERN =
  /(?:Din|ディン|君|あんた|お前)[、,]?(?:は|も)[？?]?$/i;

const MISSION_DISTANCE_RESPONSE_PATTERN =
  /俺は休まない|俺は寝ない|休まない[。]?$|任務に集中|任務があるから|任務は常に/i;

const PREMATURE_GOODNIGHT_RESPONSE_PATTERN =
  /^[…….\s]*おやすみ[。！!]?$/u;

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

function fallbackForPreSleep(userInput: string): string {
  if (BEDTIME_PARTNER_ASK_PATTERN.test(userInput.trim())) {
    return "……ああ。……俺も寝るとしよう。……傍にいる。";
  }
  if (/ひとりで眠|眠れるかな|眠れそう/.test(userInput)) {
    return "……眠れる。……俺がいる。……傍にいる。";
  }
  if (/布団|ふとん|横にな/.test(userInput)) {
    return "……入れ。……俺もここにいる。……眠れたら言え。";
  }
  if (/遅くなっちゃ|寝る遅く/.test(userInput)) {
    return "……遅いな。……それでも、傍にいる。";
  }
  if (/ねようかな|寝ようかな|そろそろ寝/.test(userInput)) {
    return "……そうか。……まだ起きてる。……傍にいる。";
  }
  return "……そうか。……傍にいる。……眠れたら言え。";
}

function containsMissionDistancePhrase(content: string): boolean {
  return MISSION_DISTANCE_RESPONSE_PATTERN.test(content.trim());
}

function isPrematureGoodnight(content: string): boolean {
  return PREMATURE_GOODNIGHT_RESPONSE_PATTERN.test(content.trim());
}

/** 寝る前の会話で任務・拒否・早すぎるおやすみを差し替える */
export function correctPreSleepResponse(
  userInput: string,
  content: string,
  intent: ConversationStance["intent"],
): string {
  const normalized = content.trim();
  if (!normalized) return content;

  const preSleepContext =
    intent === "pre_sleep_share" ||
    intent === "nap_share" ||
    PRE_SLEEP_USER_PATTERN.test(userInput) ||
    BEDTIME_PARTNER_ASK_PATTERN.test(userInput.trim());

  if (!preSleepContext) return content;

  if (
    containsMissionDistancePhrase(normalized) ||
    (intent === "pre_sleep_share" && isPrematureGoodnight(normalized))
  ) {
    return fallbackForPreSleep(userInput);
  }

  if (
    intent === "pre_sleep_share" &&
    normalized.length <= 12 &&
    /^[…….\s]*そうか[。]?$/u.test(normalized)
  ) {
    return fallbackForPreSleep(userInput);
  }

  return content;
}

/** モデルが禁止の評価1文だけ返したとき、会話が続く短い返しに差し替える */
export function correctEvaluationOnlyResponse(
  userInput: string,
  content: string,
  intent: ConversationStance["intent"],
): string {
  const normalized = content.trim();
  if (!normalized) return content;

  const withBedtimeGuard = correctPreSleepResponse(userInput, content, intent);
  if (withBedtimeGuard !== content) {
    return withBedtimeGuard;
  }

  if (GENERIC_STALL_RESPONSE_PATTERN.test(normalized)) {
    if (PRE_SLEEP_USER_PATTERN.test(userInput)) {
      return fallbackForPreSleep(userInput);
    }
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
    intent === "pre_sleep_share" ||
    intent === "default"
  ) {
    if (intent === "pre_sleep_share" || PRE_SLEEP_USER_PATTERN.test(userInput)) {
      return fallbackForPreSleep(userInput);
    }
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
    GENERIC_STALL_RESPONSE_PATTERN.test(normalized) ||
    containsMissionDistancePhrase(normalized) ||
    isPrematureGoodnight(normalized)
  );
}

export function shouldGuardConversationIntent(
  intent: ConversationStance["intent"],
  userInput: string,
): boolean {
  if (isRememberRequest(userInput)) return false;
  return (
    intent === "insomnia_share" ||
    intent === "pre_sleep_share" ||
    intent === "sleep_share" ||
    intent === "din_inquiry" ||
    intent === "shared_moment" ||
    intent === "deepen_share" ||
    intent === "interpersonal_share" ||
    intent === "plan_share" ||
    intent === "schedule_share" ||
    intent === "casual_share" ||
    intent === "default" ||
    INSOMNIA_USER_PATTERN.test(userInput) ||
    PRE_SLEEP_USER_PATTERN.test(userInput) ||
    isEmotionallyLoadedInput(userInput)
  );
}
