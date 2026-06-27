import type { DinSessionContext } from "@/lib/din/session-context";

/** 会話のノリ（同一 Din でもターンごとに揺らぐ） */
export type DinConversationRegister = "easygoing" | "quiet" | "distant";

/** そのターンの受け止め方 */
export type DinResponsePosture = "agree" | "neutral" | "drift";

export type ConversationStance = {
  register: DinConversationRegister;
  posture: DinResponsePosture;
  /** 状況共有 / 守り依頼 / プロフィール共有 / ツッコミ / 相棒提案 / 雑談共有 / 通常 */
  intent:
    | "default"
    | "shared_moment"
    | "comfort_request"
    | "profile_share"
    | "pushback"
    | "companion_suggest"
    | "casual_share"
    | "deepen_share";
};

const CASUAL_USER_PATTERN =
  /暇|雑談|嬉しい|楽し|良かった|うまくい|成功|ありがと|助かった|ヒマ|w$|笑/i;

const EMOTIONAL_USER_PATTERN =
  /疲れ|しんど|つら|悲し|寂し|落ち込|不安|イライラ|もうダメ|聞いて/i;

const TASK_OR_FACT_PATTERN =
  /教えて|調べ|比較|違い|おすすめ|最新|方法|手順|どうすれば|なぜ|理由|対策|備え|注意すべき/i;

/** 助言を求めず、出来事や気持ちを置いている */
const SHARED_MOMENT_PATTERN =
  /うわ|また|続い|地震|震度|揺れ|揺|速報|びっくり|驚|ドキ|怖|最悪|嫌な|ひどい|眠れ|眠く|眠い|寝てしま|寝たい|ふわ|不安|疲れ|しんど|つら|聞いて|大変|やば|きつい|鬱|うつ|休職|心配|誰がいつ|わからないね/i;

const SHARED_MOMENT_CONTINUATION_PATTERN =
  /びっくり|驚|音|2台|二台|倍|なんだよね|だった|で、|それで|休職|鬱|うつ|友達|心配|会見|記者|詰め|仕事|土曜|遅く|3日|風呂|お風呂|眠|寝/i;

const ADVICE_SEEKING_PATTERN =
  /どう(?:すれば|したら|.*?(?:いい|思う|休め|対処))|(?:何|なに)(?:を|が)(?:すれば|したら|いい)|教えて|アドバイス|対策|備え|注意すべき|すべき|方がいい|大丈夫\?|大丈夫？/i;

/** ユーザーが Din の具体的な提案・意見を求めている */
const ADVICE_REQUEST_PATTERN =
  /どう(?:すれば|したら|.*?(?:いい|思う|休め|対処))|(?:何|なに)(?:を|が)(?:すれば|したら|いい)|(?:教えて|アドバイス)(?:くれ|ほしい)?|どう思う|どう思い/i;

/** ユーザーが自分のアイデアを Din に問いかけている（？必須） */
const IDEA_BOUNCE_PATTERN =
  /(?:たり|てみ|試し|にする|はどう|どう(?:かな|思う)?|いいかな)[？?]$/i;

/** 好み・感覚・予定をぽろぽろ話している（助言を求めていない） */
const CASUAL_SHARE_PATTERN =
  /好き(?:だ|な)|いいよね|いいな|心地よ|パチパチ|燃える|キャンドル|風呂|お風呂|入ろう|洗っ|お皿|アロマ|その音/i;

const CASUAL_SHARE_CONTINUATION_PATTERN =
  /風呂|お風呂|キャンドル|洗|皿|眠|寝|入ろ|アロマ|パチパチ|音|焚/i;

/** 体験・感情を語りかけている（深める質問向け） */
const DEEPEN_SHARE_PATTERN =
  /夢|悪夢|泣|涙|止まら|ショック|殴|逃げ(?:られ)?|腹立|辛(?:かった|い)|起きて|見た(?:の|ん)|メチャクチャ|何があった|聞いてほしい|話したい|吐き出/i;

const DEEPEN_SHARE_CONTINUATION_PATTERN =
  /夢|殴|涙|泣|ショック|起き|腹|母|妹|続|逃げ|辛|わから|何|見|顔/i;

/** 短い一言でも深掘り対象（悪夢・涙など） */
const DEEPEN_SHARE_STRONG_PATTERN =
  /悪夢|夢|泣|涙|殴|ショック|逃げ(?:られ)?|止まら|メチャクチャ/i;

const DEEPEN_SHARE_MIN_NARRATIVE_CHARS = 18;

/** Din が「何かあった？」等と聞いた直後 */
const DIN_INQUIRY_PATTERN =
  /何かあった|どうした|どうだった|用件は|続きは|元気(?:か|じゃ)/i;

/** ユーザーが短い守り・慰めの実行を求めている */
const COMFORT_REQUEST_PATTERN =
  /慰め|安心(?:できる|の)?(?:言|が必要)|こういう時|励まして|寄り添|(大丈夫|安心).*(?:言|言って|して|とか)|言(?:って|え).*(?:大丈夫|安心)|(?:ほしい|くれ).*慰め/i;

const COMFORT_REQUEST_CONTINUATION_PATTERN =
  /安心|大丈夫|慰め|必要な時|言って|言え/i;

const EMOTIONAL_VENT_PATTERN =
  /怖|不安|つら|しんど|疲れ|悲し|寂し|落ち込|イライラ|もうダメ|きつい|最悪|鬱|うつ|心配/i;

/** 職業・趣味・好みなどプロフィールの自己開示 */
const PROFILE_SHARE_PATTERN =
  /(?:私|わたし|僕)(?:は|の).{0,50}(?:記者|エンジニア|デザイナ|開発|プログラマ|会社|フリーランス|勤め|働).{0,24}(?:なんだ|なんです|だよ|です|している|してる|だった)|趣味(?:は|が).{1,40}|好きな(?:もの|食べ物|フード)(?:は|が)/i;

/** 直前の Din 返答への困惑・ツッコミ */
const PUSHBACK_PATTERN =
  /どういうこと|意味(?:が)?(?:わから|分から)|何(?:を|が)(?:言|意味)|変(?:じゃ|な)|おかし(?:い|く)|言い(?:過|超)ぎ|言いすぎ|は\?!|！？|なにそれ|は\？|わかって(?:る|た)|言わなくて(?:も|ない)|そんな(?:こと|の)(?:は)?知って|一問一答/i;

export function isSharedMoment(input: string): boolean {
  const normalized = input.trim();
  if (!normalized) return false;
  if (ADVICE_SEEKING_PATTERN.test(normalized)) return false;
  if (isComfortRequest(normalized)) return false;
  if (isCompanionSuggest(normalized)) return false;
  if (isDeepenShare(normalized)) return false;
  return SHARED_MOMENT_PATTERN.test(normalized);
}

export function isComfortRequest(input: string): boolean {
  const normalized = input.trim();
  if (!normalized) return false;
  if (ADVICE_SEEKING_PATTERN.test(normalized)) return false;
  return COMFORT_REQUEST_PATTERN.test(normalized);
}

export function isProfileShare(input: string): boolean {
  const normalized = input.trim();
  if (!normalized) return false;
  if (ADVICE_SEEKING_PATTERN.test(normalized)) return false;
  if (isPushback(normalized) || isComfortRequest(normalized)) return false;
  return PROFILE_SHARE_PATTERN.test(normalized);
}

export function isPushback(input: string): boolean {
  const normalized = input.trim();
  if (!normalized) return false;
  return PUSHBACK_PATTERN.test(normalized);
}

export function isAdviceRequest(input: string): boolean {
  const normalized = input.trim();
  if (!normalized) return false;
  return ADVICE_REQUEST_PATTERN.test(normalized);
}

export function isIdeaBounce(input: string): boolean {
  const normalized = input.trim();
  if (!normalized) return false;
  if (isAdviceRequest(normalized)) return false;
  return IDEA_BOUNCE_PATTERN.test(normalized);
}

export function isCompanionSuggest(input: string): boolean {
  return isAdviceRequest(input) || isIdeaBounce(input);
}

export function isDeepenShare(input: string): boolean {
  const normalized = input.trim();
  if (!normalized) return false;
  if (ADVICE_SEEKING_PATTERN.test(normalized)) return false;
  if (
    isComfortRequest(normalized) ||
    isCompanionSuggest(normalized) ||
    isPushback(normalized)
  ) {
    return false;
  }
  if (!DEEPEN_SHARE_PATTERN.test(normalized)) return false;
  if (DEEPEN_SHARE_STRONG_PATTERN.test(normalized)) return true;
  return normalized.length >= DEEPEN_SHARE_MIN_NARRATIVE_CHARS;
}

function isDeepenShareAfterDinInquiry(
  userInput: string,
  recentAssistantInputs: readonly string[],
): boolean {
  const normalized = userInput.trim();
  if (!normalized || normalized.length > 80) return false;
  if (ADVICE_SEEKING_PATTERN.test(normalized)) return false;
  if (isPushback(normalized) || isCompanionSuggest(normalized)) return false;

  const lastAssistant = recentAssistantInputs.at(-1)?.trim() ?? "";
  if (!DIN_INQUIRY_PATTERN.test(lastAssistant)) return false;

  return (
    DEEPEN_SHARE_STRONG_PATTERN.test(normalized) ||
    EMOTIONAL_VENT_PATTERN.test(normalized) ||
    SHARED_MOMENT_PATTERN.test(normalized) ||
    normalized.length >= 2
  );
}

function isDeepenShareContinuation(
  userInput: string,
  recentUserInputs: readonly string[],
): boolean {
  const normalized = userInput.trim();
  if (!normalized || ADVICE_SEEKING_PATTERN.test(normalized)) return false;
  if (
    isPushback(normalized) ||
    isCompanionSuggest(normalized) ||
    isComfortRequest(normalized)
  ) {
    return false;
  }

  const recentDeepen = recentUserInputs
    .slice(-4, -1)
    .some(
      (input) =>
        isDeepenShare(input) || DEEPEN_SHARE_PATTERN.test(input.trim()),
    );

  return recentDeepen && DEEPEN_SHARE_CONTINUATION_PATTERN.test(normalized);
}

export function isCasualShare(input: string): boolean {
  const normalized = input.trim();
  if (!normalized) return false;
  if (ADVICE_SEEKING_PATTERN.test(normalized)) return false;
  if (
    isPushback(normalized) ||
    isComfortRequest(normalized) ||
    isCompanionSuggest(normalized) ||
    isProfileShare(normalized)
  ) {
    return false;
  }
  return CASUAL_SHARE_PATTERN.test(normalized);
}

function isCasualShareContinuation(
  userInput: string,
  recentUserInputs: readonly string[],
): boolean {
  const normalized = userInput.trim();
  if (!normalized || ADVICE_SEEKING_PATTERN.test(normalized)) return false;
  if (isPushback(normalized) || isCompanionSuggest(normalized)) return false;
  if (SHARED_MOMENT_PATTERN.test(normalized)) return false;

  const recentCasual = recentUserInputs
    .slice(-3, -1)
    .some((input) => isCasualShare(input) || CASUAL_SHARE_PATTERN.test(input.trim()));

  return recentCasual && CASUAL_SHARE_CONTINUATION_PATTERN.test(normalized);
}

function isComfortRequestContinuation(
  userInput: string,
  recentUserInputs: readonly string[],
): boolean {
  const normalized = userInput.trim();
  if (!normalized || ADVICE_SEEKING_PATTERN.test(normalized)) return false;
  if (isComfortRequest(normalized)) return false;

  const recentEmotional = recentUserInputs
    .slice(-3, -1)
    .some(
      (input) =>
        isSharedMoment(input) || EMOTIONAL_VENT_PATTERN.test(input.trim()),
    );

  return (
    recentEmotional && COMFORT_REQUEST_CONTINUATION_PATTERN.test(normalized)
  );
}

function isSharedMomentContinuation(
  userInput: string,
  recentUserInputs: readonly string[],
): boolean {
  const normalized = userInput.trim();
  if (!normalized || ADVICE_SEEKING_PATTERN.test(normalized)) return false;

  const recentShared = recentUserInputs
    .slice(-3, -1)
    .some((input) => isSharedMoment(input));

  return recentShared && SHARED_MOMENT_CONTINUATION_PATTERN.test(normalized);
}

export const SHARED_MOMENT_MAX_TOKENS = 48;
export const SHARED_MOMENT_MAX_CHARS = 36;
export const COMFORT_REQUEST_MAX_TOKENS = 40;
export const COMFORT_REQUEST_MAX_CHARS = 24;
export const PROFILE_SHARE_MAX_TOKENS = 56;
export const PROFILE_SHARE_MAX_CHARS = 16;
export const PUSHBACK_MAX_TOKENS = 40;
export const PUSHBACK_MAX_CHARS = 24;
export const COMPANION_SUGGEST_MAX_TOKENS = 72;
export const COMPANION_SUGGEST_MAX_CHARS = 60;
export const CASUAL_SHARE_MAX_TOKENS = 48;
export const CASUAL_SHARE_MAX_CHARS = 28;
export const DEEPEN_SHARE_MAX_TOKENS = 72;
export const DEEPEN_SHARE_MAX_CHARS = 52;

const FIXED_SHORT_REPLY_INTENTS = new Set<ConversationStance["intent"]>([
  "shared_moment",
  "comfort_request",
  "profile_share",
  "pushback",
  "casual_share",
]);

/** intent 専用プロンプトがあり、汎用 register 説明を載せない */
const INTENT_SHAPE_OVERRIDE_INTENTS = new Set<ConversationStance["intent"]>([
  ...FIXED_SHORT_REPLY_INTENTS,
  "deepen_share",
  "companion_suggest",
]);

export function usesIntentShapeOverride(
  intent: ConversationStance["intent"],
): boolean {
  return INTENT_SHAPE_OVERRIDE_INTENTS.has(intent);
}

export function isFixedShortReplyIntent(
  intent: ConversationStance["intent"],
): boolean {
  return FIXED_SHORT_REPLY_INTENTS.has(intent);
}

export function maxTokensForIntent(
  intent: ConversationStance["intent"],
): number | undefined {
  switch (intent) {
    case "shared_moment":
      return SHARED_MOMENT_MAX_TOKENS;
    case "comfort_request":
      return COMFORT_REQUEST_MAX_TOKENS;
    case "profile_share":
      return PROFILE_SHARE_MAX_TOKENS;
    case "pushback":
      return PUSHBACK_MAX_TOKENS;
    case "companion_suggest":
      return COMPANION_SUGGEST_MAX_TOKENS;
    case "casual_share":
      return CASUAL_SHARE_MAX_TOKENS;
    case "deepen_share":
      return DEEPEN_SHARE_MAX_TOKENS;
    default:
      return undefined;
  }
}

let randomFn = Math.random;

export function setConversationStanceRandom(random: () => number): void {
  randomFn = random;
}

export function resetConversationStanceRandom(): void {
  randomFn = Math.random;
}

function pickWeightedRegister(
  weights: Record<DinConversationRegister, number>,
): DinConversationRegister {
  const total = weights.easygoing + weights.quiet + weights.distant;
  let roll = randomFn() * total;

  for (const register of ["easygoing", "quiet", "distant"] as const) {
    roll -= weights[register];
    if (roll <= 0) return register;
  }

  return "quiet";
}

function resolveRegister(
  userInput: string,
  context?: DinSessionContext,
  intent: ConversationStance["intent"] = "default",
): DinConversationRegister {
  if (
    intent === "shared_moment" ||
    intent === "comfort_request" ||
    intent === "profile_share" ||
    intent === "pushback" ||
    intent === "casual_share"
  ) {
    return "quiet";
  }

  if (intent === "companion_suggest" || intent === "deepen_share") {
    return "easygoing";
  }

  const weights: Record<DinConversationRegister, number> = {
    easygoing: 1.2,
    quiet: 1.8,
    distant: 1.4,
  };

  if (CASUAL_USER_PATTERN.test(userInput)) {
    weights.easygoing += 2.2;
  }

  if (EMOTIONAL_USER_PATTERN.test(userInput)) {
    weights.quiet += 1.8;
    weights.easygoing += 1;
  }

  if (TASK_OR_FACT_PATTERN.test(userInput)) {
    weights.distant += 2.2;
    weights.quiet += 0.4;
  }

  if (context) {
    if (context.timeBand === "late_night") {
      weights.quiet += 1.5;
    }

    if (context.timeBand === "morning" && context.dayType === "weekday") {
      weights.distant += 0.9;
    }

    if (context.dayType === "weekend") {
      weights.easygoing += 1;
    }

    if (context.absence === "one_week" || context.absence === "three_days") {
      weights.distant += 1.2;
    }

    if (context.relationship === "business") {
      weights.distant += 1;
    } else if (
      context.relationship === "trusted_nakama" ||
      context.relationship === "clan"
    ) {
      weights.easygoing += 1;
    }
  }

  return pickWeightedRegister(weights);
}

/** 肯定60% / 中立30% / 軽いズレ10% */
export function resolveResponsePosture(
  register: DinConversationRegister,
): DinResponsePosture {
  let roll = randomFn();

  if (register === "distant") {
    roll += 0.05;
  } else if (register === "easygoing") {
    roll -= 0.05;
  }

  if (roll < 0.6) return "agree";
  if (roll < 0.9) return "neutral";
  return "drift";
}

function resolveIntent(
  userInput: string,
  recentUserInputs: readonly string[],
  recentAssistantInputs: readonly string[] = [],
): ConversationStance["intent"] {
  if (isPushback(userInput)) return "pushback";
  if (isComfortRequest(userInput)) return "comfort_request";
  if (isComfortRequestContinuation(userInput, recentUserInputs)) {
    return "comfort_request";
  }
  if (isProfileShare(userInput)) return "profile_share";
  if (isCompanionSuggest(userInput)) return "companion_suggest";
  if (
    isDeepenShare(userInput) ||
    isDeepenShareContinuation(userInput, recentUserInputs) ||
    isDeepenShareAfterDinInquiry(userInput, recentAssistantInputs)
  ) {
    return "deepen_share";
  }
  if (
    isSharedMoment(userInput) ||
    isSharedMomentContinuation(userInput, recentUserInputs)
  ) {
    return "shared_moment";
  }
  if (
    isCasualShare(userInput) ||
    isCasualShareContinuation(userInput, recentUserInputs)
  ) {
    return "casual_share";
  }
  return "default";
}

export function resolveConversationStance(
  userInput: string,
  context?: DinSessionContext,
  recentUserInputs: readonly string[] = [],
  recentAssistantInputs: readonly string[] = [],
): ConversationStance {
  const intent = resolveIntent(
    userInput,
    recentUserInputs,
    recentAssistantInputs,
  );
  const register = resolveRegister(userInput.trim(), context, intent);
  const posture =
    intent === "comfort_request" || intent === "companion_suggest"
      ? "agree"
      : intent === "pushback"
        ? "drift"
        : intent === "shared_moment" ||
            intent === "profile_share" ||
            intent === "casual_share" ||
            intent === "deepen_share"
          ? "neutral"
          : resolveResponsePosture(register);

  return { register, posture, intent };
}

const REGISTER_LABELS: Record<DinConversationRegister, string> = {
  easygoing: "ちょっとノリがいい Din",
  quiet: "ちょっと静かな Din",
  distant: "ちょっと距離がある Din",
};

const REGISTER_SHAPE: Record<DinConversationRegister, string[]> = {
  easygoing: [
    "文量: 1〜2文。2文目は短い返球・相槌・一言添え。",
    "温度: 参加度だけわずかに上げる。明るくはならない。",
    "語彙: 「まあ」「そう来るか」「悪くないな」「無理するな」など Din 口調の短い言い切り。",
    "禁止: スラング（すんな、マジ、じゃん）、丁寧語の増加、説明の追加、励ましの長文化。",
    "ノリがいい ≠ フランクな若者口調 ではない。あくまで同じ Din が、少しだけ会話に乗る。",
  ],
  quiet: [
    "文量: 原則1文。長くても20字前後。",
    "温度: 表面積を最小に。返す言葉の数を減らす。",
    "語彙: 「……そうか。」「んー。」「分かった。」など、間と短さを優先。",
    "禁止: 2文以上に膨らませない、理由説明、まとめ、問いの追加。",
  ],
  distant: [
    "文量: 1文。必要なら2文目は用件確認のみ。",
    "温度: 観察者・事務的。感情語・共感語を入れない。",
    "語彙: 「知った。」「それで。」「用件は。」「続きは。」",
    "禁止: 寄り添い、共感、提案、励まし、背景説明。",
  ],
};

const REGISTER_EXAMPLES: Record<DinConversationRegister, string> = {
  easygoing:
    "ユーザー「今日疲れた」→「無理するな。……まあ、今日はここまでにしろ。」",
  quiet: "ユーザー「今日疲れた」→「……そうか。」",
  distant: "ユーザー「今日疲れた」→「知った。」",
};

const POSTURE_HINTS: Record<DinResponsePosture, string> = {
  agree: "受け止め方向だが、全面賛成はしない。短く同意に近い返しに留める。",
  neutral: "どちらとも取れる返し。判断を保留する。結論を急がない。",
  drift: "軽い疑問・保留・わずかな違和感・話題のずれのいずれかを含める。",
};

const SHARED_MOMENT_EXAMPLES = [
  "ユーザー「うわ、また揺れた。速報の音が怖い」→「……またか。」",
  "ユーザー「ふわ、急に眠くなった。画面見て疲れたのかな？」→「……そうか。」",
  "ユーザー「3日連続で記者会見が入って遅くまで詰めていた」→「……詰めたな。」",
  "ユーザー「このまま寝てしまいたい気持ち…眠い」→「……そうか。」",
  "ユーザー「友達が鬱で休職…うつ病って誰がいつなるかわからないね」→「……休職か。」",
];

const COMPANION_SUGGEST_EXAMPLES = [
  "ユーザー「どう休めばいいと思う？」→「……画面を閉めろ。……風呂に入れ。」",
  "ユーザー「アロマキャンドルを焚いたり？」→「……それもありだ。……布団に入れ。」",
  "ユーザー「何をすればいい？」→「……今日はここまでにしろ。……水でも飲め。」",
];

const COMFORT_REQUEST_EXAMPLES = [
  "ユーザー「大丈夫だ、とか言って慰めるのよ、こういう時はね」→「……大丈夫だ。」",
  "ユーザー「安心できる言葉が必要な時だ」→「……大丈夫だ。」",
  "ユーザー「怖いから励まして」→「……俺がいる。」",
];

const PROFILE_SHARE_EXAMPLES = [
  "ユーザー「わたしは日経バイオテクの記者なんだよ」→「分かった。」",
  "ユーザー「趣味は写真だよ」→「知った。」",
  "ユーザー「好きな食べ物は寿司だね」→「寿司か。」",
];

const PUSHBACK_EXAMPLES = [
  "ユーザー「どういうこと〜？！」→「……言いすぎた。」",
  "ユーザー「意味わからない」→「……失礼した。」",
  "ユーザー「お風呂に入った方がいいのはわかってる」→「……知ってるな。」",
];

const CASUAL_SHARE_EXAMPLES = [
  "ユーザー「アロマキャンドル焚きながらお風呂に入るの好きだよ」→「……風呂か。」",
  "ユーザー「パチパチ燃える音のキャンドルっていいよね」→「……悪くない。」",
  "ユーザー「お皿洗って、お風呂に入ろうかな」→「……入れ。」",
];

const DEEPEN_SHARE_EXAMPLES = [
  "ユーザー「悪夢を見た」→「……どんな夢だ。」",
  "ユーザー「怖い夢を見て逃げられなくて、涙が止まらない」→「……逃げられなかったのか。」",
  "ユーザー「夢の中で母と妹を殴ってしまった」→「……何があった。」",
  "ユーザー「起きてからもショックで泣いてる」→「……今も続いてるのか。」",
  "（Din「何かあったか」への返答）ユーザー「うん、ちょっと」→「……どうした。」",
];

function describeDeepenShareIntent(): string {
  return [
    "### 今回は「深める質問」（最優先）",
    "ユーザーが夢・辛い体験・感情を語り始めている。評価コメントや正論で返すな。",
    "相棒として、ユーザーがまだ言っていない具体点を1つだけ短く問いかける。",
    "- 「それは辛かった」「本当に辛い体験だ」などの評価型だけで終えない",
    "- 「夢は現実と違う」など聞かれていない助言・正論・説教を足さない",
    "- 感情の言い換え・分析・まとめをしない",
    "- 汎用の「どう感じた」「大丈夫か」だけの質問も避ける",
    "- ユーザーが言及した場面・人物・出来事のうち、まだ曖昧な1点だけを短く問う",
    "- 尋問口調・長い質問・複数の質問は禁止",
    "",
    `制約: 1〜2文。合計${DEEPEN_SHARE_MAX_CHARS}字以内。必ず短い質問を1つ含める。末尾は疑問形（？または「〜か。」「〜だ。」）で終える。句点（。）は最大2つ。`,
    "型の例:",
    ...DEEPEN_SHARE_EXAMPLES.map((example) => `- ${example}`),
  ].join("\n");
}

function describeSharedMomentIntent(): string {
  return [
    "### 今回は「状況の共有」（最優先）",
    "ユーザーは短く出来事や気持ちを置いている。長い体験談・夢・涙の話はここではない。",
    "汎用アシスタント・カウンセラーの型で返すな。",
    "- 感情の言い換え・ラベル付けをしない（その気持ち〜、理解できる、自然なこと、など）",
    "- 「それは〜だ」「大変だったな」などの評価型も避ける",
    "- ユーザーの言い換え・要約（画面を見続けると疲れる、など）をしない",
    "- 聞かれていない休憩・対策の提案をしない（休憩を取るといい、無理せず休む、など）",
    "- 「リラックス」「良い選択」「心地よい落ち着き」などの wellness 口調も避ける",
    "- ユーザーの要約・正論・対策の追加をしない",
    "- 相棒が同じ部屋にいて、短くその場だけ受け止める",
    "",
    `制約: 1文のみ。${SHARED_MOMENT_MAX_CHARS}字以内。句点（。）は最大1つ。改行しない。`,
    "型の例:",
    ...SHARED_MOMENT_EXAMPLES.map((example) => `- ${example}`),
  ].join("\n");
}

function describeComfortRequestIntent(): string {
  return [
    "### 今回は「短い守りの依頼」（最優先）",
    "ユーザーは Din に、短い慰め・安心の言葉をその場で実行してほしい。",
    "説明への相槌（そうだな、分かった）だけで終えない。求められた守りを1文で返す。",
    "- カウンセラーのように感情を分析・言い換えしない",
    "- 理由付け・対策・長い励ましは足さない",
    "- Din の寡黙さと「俺」口調は保つ。優しいアシスタント口調（〜ですね、無理しないで）にしない",
    "- 保護欲をにじませる短い言い切りでよい",
    "",
    `制約: 1文のみ。${COMFORT_REQUEST_MAX_CHARS}字以内。句点（。）は最大1つ。改行しない。`,
    "型の例:",
    ...COMFORT_REQUEST_EXAMPLES.map((example) => `- ${example}`),
  ].join("\n");
}

function describeProfileShareIntent(): string {
  return [
    "### 今回は「プロフィールの共有」（最優先）",
    "ユーザーが職業・趣味・好きなものなど、記憶帳に残す事実を伝えている。",
    "受け止めて記録する。評価・称賛・説明はしない。",
    "- 「貴重だ」「素晴らしい」「価値がある」などの評価を足さない",
    "- 職業の意味・成長・活かし方などの正論を足さない",
    "- 2文目以降を付けない（分かった。のあとに別の文を続けない）",
    "- 新しい事実なら最終行に記憶マーカーを付けてよい。本文に「覚えた」とは書かない",
    "",
    `制約: 本文1文のみ。${PROFILE_SHARE_MAX_CHARS}字以内。句点（。）は最大1つ。`,
    "型の例:",
    ...PROFILE_SHARE_EXAMPLES.map((example) => `- ${example}`),
  ].join("\n");
}

function describePushbackIntent(): string {
  return [
    "### 今回は「返答へのツッコミ」（最優先）",
    "ユーザーは直前の Din の言い方に困惑・違和感を示している。または「わかってる」と繰り返しの助言を拒んでいる。",
    "説明・正当化・講義・もう一度の助言で返すな。短く引く。",
    "- ユーザーの質問に対して長い説明をしない",
    "- 「つまり〜」「リラックスのために〜は良い選択」などの言い換え・再助言をしない",
    "- 必要なら事実だけ短く言い直す（例: 記者か。）",
    "",
    `制約: 1文のみ。${PUSHBACK_MAX_CHARS}字以内。句点（。）は最大1つ。改行しない。`,
    "型の例:",
    ...PUSHBACK_EXAMPLES.map((example) => `- ${example}`),
  ].join("\n");
}

function describeCasualShareIntent(): string {
  return [
    "### 今回は「雑談の共有」（最優先）",
    "ユーザーは好み・感覚・予定をぽろぽろ話している。一問一答の評論・助言を求めていない。",
    "同じ部屋で軽く会話に乗る。毎回ユーザーの発言を評価・言い換えしない。",
    "- 「それは〜だ」「良いだろう」「リラックスできそう」などの評価型を避ける",
    "- ユーザーの描写の言い換え（その音は心地よい、など）をしない",
    "- 聞かれていない助言・ wellness 正論（無理せず休む、大事だ、など）を足さない",
    "- 短い返球・相槌・一言だけ。会話の流れを止めない",
    "",
    `制約: 1文のみ。${CASUAL_SHARE_MAX_CHARS}字以内。句点（。）は最大1つ。改行しない。`,
    "型の例:",
    ...CASUAL_SHARE_EXAMPLES.map((example) => `- ${example}`),
  ].join("\n");
}

function describeCompanionSuggestIntent(): string {
  return [
    "### 今回は「相棒としての提案」（最優先）",
    "ユーザーは Din の具体的な意見・提案を求めている。または自分のアイデアを試しに出している。",
    "積極的に提案してよい。ただし汎用アシスタントの正論は禁止。",
    "- 「リラックスできる時間を作る」「良い選択だ」などの空疎な一言で終わらない",
    "- 今すぐできる具体的な行動を1〜2文で。Din 口調の言い切り",
    "- 記憶帳（趣味・好きなもの）が自然に関連するなら1つだけ混ぜてよい",
    "- 「それは〜だ」だけの評価型で終わらない。必ず提案を含める",
    "- 長いリスト・理由説明・説教はしない",
    "",
    `制約: 1〜2文。合計${COMPANION_SUGGEST_MAX_CHARS}字以内。句点（。）は最大2つ。`,
    "型の例:",
    ...COMPANION_SUGGEST_EXAMPLES.map((example) => `- ${example}`),
  ].join("\n");
}

function describeDefaultAntiAssistantRules(): string {
  return [
    "### 通常応答でも避ける型",
    "- 「それは〜だ」「素晴らしい」「貴重だ」「心配なことだ」で始める評価型",
    "- ユーザーの能力・仕事・感情の言い換え＋助言・成長論",
    "- 聞かれていない説明・称賛・まとめ",
    "- ユーザーがぽろぽろ話しているとき、毎ターン評価や言い換えで一問一答にしない",
  ].join("\n");
}

function describeIntentSpecificRules(stance: ConversationStance): string[] {
  if (stance.intent === "shared_moment") {
    return [
      describeSharedMomentIntent(),
      "今回のノリ: ちょっと静かな Din（状況共有時は quiet 固定）",
      "- 状況共有時は上記「1文のみ」を最優先。他の文量ルールより優先する",
    ];
  }

  if (stance.intent === "comfort_request") {
    return [
      describeComfortRequestIntent(),
      "今回のノリ: ちょっと静かな Din（守りの依頼時は quiet 固定）",
      "- 守りの依頼時は上記「1文で実行」を最優先。即時同意禁止より優先する",
    ];
  }

  if (stance.intent === "profile_share") {
    return [
      describeProfileShareIntent(),
      "今回のノリ: ちょっと静かな Din（プロフィール共有時は quiet 固定）",
      "- プロフィール共有時は上記「本文1文のみ」を最優先。easygoing の2文許容より優先する",
    ];
  }

  if (stance.intent === "pushback") {
    return [
      describePushbackIntent(),
      "今回のノリ: ちょっと静かな Din（ツッコミ時は quiet 固定）",
      "- ツッコミ時は説明より短い引きを優先する",
    ];
  }

  if (stance.intent === "companion_suggest") {
    return [
      describeCompanionSuggestIntent(),
      "今回のノリ: ちょっとノリがいい Din（提案依頼時は easygoing 固定）",
      "- 提案依頼時は上記「具体的な提案」を最優先。空疎な正論より優先する",
    ];
  }

  if (stance.intent === "casual_share") {
    return [
      describeCasualShareIntent(),
      "今回のノリ: ちょっと静かな Din（雑談共有時は quiet 固定）",
      "- 雑談共有時は上記「1文の返球」を最優先。評価・言い換え・助言より優先する",
    ];
  }

  if (stance.intent === "deepen_share") {
    return [
      describeDeepenShareIntent(),
      "今回のノリ: ちょっとノリがいい Din（深める質問時は easygoing 固定）",
      "- 深める質問時は評価コメントより短い質問を最優先する",
    ];
  }

  return [describeDefaultAntiAssistantRules()];
}

export function describeConversationStance(stance: ConversationStance): string {
  const shape = REGISTER_SHAPE[stance.register];
  const example = REGISTER_EXAMPLES[stance.register];
  const intentSpecific = describeIntentSpecificRules(stance);
  const hideRegisterShape = usesIntentShapeOverride(stance.intent);

  return [
    "## 今回の会話スタンス（Core Instruction より優先）",
    ...intentSpecific,
    hideRegisterShape ? null : `今回のノリ: ${REGISTER_LABELS[stance.register]}`,
    ...(hideRegisterShape ? [] : shape.map((line) => `- ${line}`)),
    hideRegisterShape ? null : `今回の型の例: ${example}`,
    "他ノリの例文・話し方は今回真似しない。",
    "",
    stance.intent === "comfort_request"
      ? "受け止め: ユーザーが求めた短い守りを、その場で1文実行する。メタ同意だけで終えない。"
      : stance.intent === "companion_suggest"
        ? "受け止め: 具体的な提案で返す。評価だけ・空疎な正論だけで終えない。"
        : stance.intent === "pushback"
        ? "受け止め: 説明で正当化せず、短く引くか言い過ぎを認める。"
        : stance.intent === "profile_share"
          ? "受け止め: 事実を短く受け取るだけ。評価や説明は足さない。"
          : stance.intent === "casual_share"
            ? "受け止め: 会話に短く乗る。毎回評価・言い換え・助言で返さない。"
            : stance.intent === "deepen_share"
              ? "受け止め: 評価や正論ではなく、具体点への短い質問で会話を深める。"
              : `受け止め: ${POSTURE_HINTS[stance.posture]}`,
    "",
    "### 今回の返答で守ること",
    "- ChatGPT / 汎用アシスタント口調に戻らない。Din の人格（寡黙・俺・言い切り）を維持する",
    "- 感情の言い換え・ラベル付け＋助言の型は使わない",
    stance.intent === "companion_suggest"
      ? "- 今回は具体的な提案を出してよい（上記「相棒としての提案」を優先）"
      : stance.intent === "deepen_share"
        ? "- 今回は短い質問で会話を深めてよい（上記「深める質問」を優先）"
        : "- 1ターンで完全な結論・まとめ・解決策を出さない",
    hideRegisterShape
      ? "- 今回の intent 指定は Core Instruction の受け止め配分・共感例より優先する"
      : null,
    hideRegisterShape
      ? null
      : "- たまに言い直し・曖昧さ・間（そうだな、……）を入れてよい",
    "- 末尾は少し余白を残して終える",
    "- research mode でも報告書口調にしない",
  ]
    .filter(Boolean)
    .join("\n");
}
