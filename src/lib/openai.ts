import OpenAI from "openai";

import {
  RESEARCH_MODE_THRESHOLD_DEFAULT,
  shouldUseResearchMode,
} from "@/lib/din/model-routing";

let client: OpenAI | null = null;

export type ChatModelMode = "mini" | "research";

export type ResolvedChatModel = {
  model: string;
  mode: ChatModelMode;
};

export function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY が設定されていません。.env.local を確認してください。");
  }

  if (!client) {
    client = new OpenAI({ apiKey });
  }

  return client;
}

export function getOpenAIModelMini(): string {
  return process.env.OPENAI_MODEL_MINI ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini";
}

export function getOpenAIModelPro(): string {
  return process.env.OPENAI_MODEL_PRO ?? "gpt-4.1";
}

export function getResearchModeThreshold(): number {
  const raw = process.env.RESEARCH_MODE_THRESHOLD;
  if (!raw) return RESEARCH_MODE_THRESHOLD_DEFAULT;

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : RESEARCH_MODE_THRESHOLD_DEFAULT;
}

/** @deprecated 軽量会話以外でも mini を明示する場合は getOpenAIModelMini を使う */
export function getOpenAIModel(): string {
  return getOpenAIModelMini();
}

/** ユーザー入力に応じて lightweight / research モデルを選ぶ */
export function resolveChatModel(userInput: string): ResolvedChatModel {
  const threshold = getResearchModeThreshold();

  if (shouldUseResearchMode(userInput, threshold)) {
    return {
      model: getOpenAIModelPro(),
      mode: "research",
    };
  }

  return {
    model: getOpenAIModelMini(),
    mode: "mini",
  };
}
