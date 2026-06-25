import OpenAI from "openai";

let client: OpenAI | null = null;

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

export function getOpenAIModel(): string {
  return process.env.OPENAI_MODEL ?? "gpt-4o-mini";
}
