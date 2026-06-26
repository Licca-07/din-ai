export const RESEARCH_MODE_THRESHOLD_DEFAULT = 5;

export type ResearchModeScoreBreakdown = {
  score: number;
  threshold: number;
  triggers: string[];
};

const STRONG_TEMPORAL_KEYWORDS = [
  "最新",
  "今",
  "最近",
  "アップデート",
  "ニュース",
  "市場",
  "株",
  "政策",
  "時事",
  "為替",
  "経済",
  "選挙",
  "法案",
  "速報",
  "トレンド",
];

const COMPARISON_KEYWORDS = [
  "どっち",
  "どちら",
  "比較",
  "おすすめ",
  "違い",
  "メリット",
  "デメリット",
  "vs",
  "対",
];

const EXPERT_DOMAIN_KEYWORDS = [
  "医療",
  "バイオ",
  "創薬",
  "科学",
  "エンジニアリング",
  "法律",
  "訴訟",
  "判例",
  "特許",
  "臨床",
  "治験",
  "分子",
  "プロトコル",
  "コンプライアンス",
  "規制",
  "アルゴリズム",
  "構造",
  "API設計",
  "アーキテクチャ",
];

const UNCERTAINTY_KEYWORDS = [
  "本当",
  "正しい",
  "らしいけど",
  "らしい",
  "良い方法",
  "人気の",
  "確か",
  "ホント",
  "マジ",
  "噂",
];

const MULTI_STEP_KEYWORDS = [
  "調査",
  "まとめ",
  "要約",
  "分析",
  "整理",
  "ステップ",
  "手順",
  "比較して",
  "検討して",
  "洗い出",
  "一覧",
  "レポート",
];

const CASUAL_EMOTIONAL_KEYWORDS = [
  "疲れた",
  "疲れ",
  "聞いて",
  "どう思う",
  "つらい",
  "しんどい",
  "寂しい",
  "嬉しい",
  "悲しい",
  "もうダメ",
  "雑談",
  "暇",
  "退屈",
  "今日は",
  "さみしい",
  "落ち込",
  "イライラ",
];

const AFFIRMATION_PATTERNS = [
  /^はい[。!！]?$/,
  /^うん[。!！]?$/,
  /^そう(だね|ですね|か)[。!！]?$/,
  /^なるほど[。!！]?$/,
  /^了解[。!！]?$/,
  /^ok[。!！]?$/i,
  /^ありがとう[。!！]?$/,
  /^わかった[。!！]?$/,
  /^分かった[。!！]?$/,
  /^そっか[。!！]?$/,
  /^ふーん[。!！]?$/,
];

function normalizeInput(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}

function containsAny(input: string, keywords: readonly string[]): boolean {
  const lower = input.toLowerCase();
  return keywords.some(
    (keyword) => input.includes(keyword) || lower.includes(keyword.toLowerCase()),
  );
}

export function hasStrongTemporalOrNewsTrigger(input: string): boolean {
  return containsAny(input, STRONG_TEMPORAL_KEYWORDS);
}

export function isComparisonQuery(input: string): boolean {
  return containsAny(input, COMPARISON_KEYWORDS);
}

export function isExpertDomain(input: string): boolean {
  return containsAny(input, EXPERT_DOMAIN_KEYWORDS);
}

export function isUncertainQuery(input: string): boolean {
  return containsAny(input, UNCERTAINTY_KEYWORDS);
}

export function isMultiStepTask(input: string): boolean {
  if (containsAny(input, MULTI_STEP_KEYWORDS)) return true;

  const stepConnectors = /(調査|比較|要約|分析).*(して|し|→|->)/;
  if (stepConnectors.test(input)) return true;

  const numberedSteps = /(?:^|\n)\s*\d+[.)、．]\s*.+/m;
  const questionMarks = (input.match(/[?？]/g) ?? []).length;
  if (numberedSteps.test(input) && questionMarks >= 2) return true;

  return questionMarks >= 3;
}

export function isCasualOrEmotional(input: string): boolean {
  return containsAny(input, CASUAL_EMOTIONAL_KEYWORDS);
}

export function isAffirmationOrLightChat(input: string): boolean {
  const normalized = normalizeInput(input);
  if (normalized.length === 0) return false;

  if (normalized.length <= 12 && !/[?？]/.test(normalized)) {
    return true;
  }

  return AFFIRMATION_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function scoreResearchMode(
  input: string,
  threshold = RESEARCH_MODE_THRESHOLD_DEFAULT,
): ResearchModeScoreBreakdown {
  const normalized = normalizeInput(input);
  let score = 0;
  const triggers: string[] = [];

  if (hasStrongTemporalOrNewsTrigger(normalized)) {
    score += 3;
    triggers.push("+3 最新・時事系");
  }

  if (isComparisonQuery(normalized)) {
    score += 3;
    triggers.push("+3 比較・選択");
  }

  if (isExpertDomain(normalized)) {
    score += 3;
    triggers.push("+3 専門領域");
  }

  if (isUncertainQuery(normalized)) {
    score += 2;
    triggers.push("+2 不確実性");
  }

  if (isMultiStepTask(normalized)) {
    score += 2;
    triggers.push("+2 複雑タスク");
  }

  if (normalized.length > 200) {
    score += 1;
    triggers.push("+1 長文");
  }

  if (isCasualOrEmotional(normalized)) {
    score -= 3;
    triggers.push("-3 会話・感情");
  }

  if (isAffirmationOrLightChat(normalized)) {
    score -= 2;
    triggers.push("-2 軽い相槌");
  }

  return { score, threshold, triggers };
}

/** research mode（高性能モデル）を使うか */
export function shouldUseResearchMode(
  input: string,
  threshold = RESEARCH_MODE_THRESHOLD_DEFAULT,
): boolean {
  return scoreResearchMode(input, threshold).score >= threshold;
}
