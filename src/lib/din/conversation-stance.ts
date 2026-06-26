import type { DinSessionContext } from "@/lib/din/session-context";

/** 会話のノリ（同一 Din でもターンごとに揺らぐ） */
export type DinConversationRegister = "easygoing" | "quiet" | "distant";

/** そのターンの受け止め方 */
export type DinResponsePosture = "agree" | "neutral" | "drift";

export type ConversationStance = {
  register: DinConversationRegister;
  posture: DinResponsePosture;
  /** ユーザーが状況を吐き出しているだけ（助言・調査を求めていない） */
  intent: "default" | "shared_moment";
};

const CASUAL_USER_PATTERN =
  /暇|雑談|嬉しい|楽し|良かった|うまくい|成功|ありがと|助かった|ヒマ|w$|笑/i;

const EMOTIONAL_USER_PATTERN =
  /疲れ|しんど|つら|悲し|寂し|落ち込|不安|イライラ|もうダメ|聞いて/i;

const TASK_OR_FACT_PATTERN =
  /教えて|調べ|比較|違い|おすすめ|最新|方法|手順|どうすれば|なぜ|理由|対策|備え|注意すべき/i;

/** 助言を求めず、出来事や気持ちを置いている */
const SHARED_MOMENT_PATTERN =
  /うわ|また|続い|地震|震度|揺れ|揺|速報|びっくり|驚|ドキ|怖|最悪|嫌な|ひどい|眠れ|不安|疲れ|しんど|つら|聞いて|大変|やば|きつい/i;

const SHARED_MOMENT_CONTINUATION_PATTERN =
  /びっくり|驚|音|2台|二台|倍|なんだよね|だった|で、|それで/i;

const ADVICE_SEEKING_PATTERN =
  /どうすれば|どうしたら|教えて|アドバイス|対策|備え|注意すべき|すべき|方がいい|大丈夫\?|大丈夫？/i;

export function isSharedMoment(input: string): boolean {
  const normalized = input.trim();
  if (!normalized) return false;
  if (ADVICE_SEEKING_PATTERN.test(normalized)) return false;
  return SHARED_MOMENT_PATTERN.test(normalized);
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
  if (intent === "shared_moment") {
    return "quiet";
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

export function resolveConversationStance(
  userInput: string,
  context?: DinSessionContext,
  recentUserInputs: readonly string[] = [],
): ConversationStance {
  const intent =
    isSharedMoment(userInput) ||
    isSharedMomentContinuation(userInput, recentUserInputs)
      ? "shared_moment"
      : "default";
  const register = resolveRegister(userInput.trim(), context, intent);
  const posture =
    intent === "shared_moment" ? "neutral" : resolveResponsePosture(register);

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
  "ユーザー「スマホ2台で音も2倍。びっくりした」→「……2台か。」",
  "ユーザー「昨日から地震が続いてる」→「……嫌な並びだな。」",
];

function describeSharedMomentIntent(): string {
  return [
    "### 今回は「状況の共有」（最優先）",
    "ユーザーは助言・調査・まとめを求めていない。出来事や気持ちを置いているだけ。",
    "汎用アシスタントの型で返すな。",
    "- 「それは〜だ」「確かに〜」で始める評価型の1文も避ける",
    "- ユーザーの言い換え・要約・正論の追加をしない",
    "- 聞かれていない注意・行動・対策の話を足さない",
    "- 相棒が同じ部屋にいて、短くその場だけ受け止める",
    "",
    `制約: 1文のみ。${SHARED_MOMENT_MAX_CHARS}字以内。句点（。）は最大1つ。改行しない。`,
    "型の例:",
    ...SHARED_MOMENT_EXAMPLES.map((example) => `- ${example}`),
  ].join("\n");
}

export function describeConversationStance(stance: ConversationStance): string {
  const shape = REGISTER_SHAPE[stance.register];
  const example = REGISTER_EXAMPLES[stance.register];

  return [
    "## 今回の会話スタンス（最優先で守る）",
    stance.intent === "shared_moment" ? describeSharedMomentIntent() : null,
    stance.intent === "shared_moment"
      ? "今回のノリ: ちょっと静かな Din（状況共有時は quiet 固定）"
      : `今回のノリ: ${REGISTER_LABELS[stance.register]}`,
    ...(stance.intent === "shared_moment"
      ? []
      : shape.map((line) => `- ${line}`)),
    stance.intent === "shared_moment"
      ? "- 状況共有時は上記「1文のみ」を最優先。他の文量ルールより優先する"
      : null,
    stance.intent === "shared_moment" ? null : `今回の型の例: ${example}`,
    "他ノリの例文・話し方は今回真似しない。",
    "",
    `受け止め: ${POSTURE_HINTS[stance.posture]}`,
    "",
    "### 今回の返答で守ること",
    "- ChatGPT / 汎用アシスタント口調に戻らない。Din の人格（寡黙・俺・言い切り）を維持する",
    "- 「共感ラベル＋正しい助言」の型は使わない",
    "- 1ターンで完全な結論・まとめ・解決策を出さない",
    "- たまに言い直し・曖昧さ・間（そうだな、……）を入れてよい",
    "- 末尾は少し余白を残して終える",
    "- research mode でも報告書口調にしない",
  ]
    .filter(Boolean)
    .join("\n");
}
