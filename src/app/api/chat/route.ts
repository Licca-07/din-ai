import { NextResponse } from "next/server";

import {
  buildMemoryBookContext,
  buildMemoryPrompt,
} from "@/lib/din/memory-book-context";
import { parseMemoryFromResponse } from "@/lib/din/memory-marker";
import { getOpenAIClient, getOpenAIModel } from "@/lib/openai";
import { buildDinSystemPrompt } from "@/lib/prompts/din-system-prompt";
import type {
  ChatErrorResponse,
  ChatMessage,
  ChatRequestBody,
  ChatResponseBody,
} from "@/types/chat";

export const runtime = "nodejs";

function isValidMessage(message: unknown): message is ChatMessage {
  if (!message || typeof message !== "object") return false;

  const candidate = message as Record<string, unknown>;

  return (
    (candidate.role === "user" || candidate.role === "assistant") &&
    typeof candidate.content === "string" &&
    candidate.content.trim().length > 0
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ChatRequestBody;
    const requestGreeting = body.requestGreeting === true;
    const followUpTopic = body.followUpTopic?.trim() || undefined;
    const proactiveOpener = body.proactiveOpener;

    if (!Array.isArray(body.messages)) {
      return NextResponse.json<ChatErrorResponse>(
        { error: "messages の形式が正しくありません。" },
        { status: 400 },
      );
    }

    if (!requestGreeting && body.messages.length === 0) {
      return NextResponse.json<ChatErrorResponse>(
        { error: "messages が空です。" },
        { status: 400 },
      );
    }

    if (body.messages.length > 0 && !body.messages.every(isValidMessage)) {
      return NextResponse.json<ChatErrorResponse>(
        { error: "messages の形式が正しくありません。" },
        { status: 400 },
      );
    }

    const openai = getOpenAIClient();
    const model = getOpenAIModel();
    const sessionContext = body.sessionContext
      ? {
          ...body.sessionContext,
          isGreeting: requestGreeting || body.sessionContext.isGreeting,
        }
      : undefined;

    const memoryBookContext =
      body.userProfile && sessionContext
        ? buildMemoryBookContext(
            body.userProfile,
            sessionContext.conversationCount,
            body.longTermMemories ?? [],
            body.shortTermMemories ?? [],
          )
        : body.userProfile
          ? buildMemoryBookContext(
              body.userProfile,
              0,
              body.longTermMemories ?? [],
              body.shortTermMemories ?? [],
            )
          : undefined;

    const memoryPrompt = memoryBookContext
      ? buildMemoryPrompt(memoryBookContext)
      : undefined;

    const completionMessages =
      requestGreeting && body.messages.length === 0
        ? [
            {
              role: "user" as const,
              content: proactiveOpener
                ? "自発的な話しかけを返せ。"
                : followUpTopic
                  ? "フォローアップを返せ。"
                  : "挨拶を返せ。",
            },
          ]
        : body.messages.map((message) => ({
            role: message.role,
            content: message.content,
          }));

    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: buildDinSystemPrompt(sessionContext, memoryPrompt?.text, {
            followUpTopic,
            proactiveOpener,
          }),
        },
        ...completionMessages,
      ],
      temperature: proactiveOpener ? 0.75 : 0.6,
    });

    const rawContent = completion.choices[0]?.message?.content?.trim();

    if (!rawContent) {
      return NextResponse.json<ChatErrorResponse>(
        { error: "AI からの返答を取得できませんでした。" },
        { status: 502 },
      );
    }

    const currentProfile = body.userProfile ?? {
      occupation: "",
      hobbies: [],
      favoriteFoods: [],
    };

    const { content, remembered, profile, newMemoryItems, newFollowUpRecalls } =
      parseMemoryFromResponse(rawContent, currentProfile);

    if (!content) {
      return NextResponse.json<ChatErrorResponse>(
        { error: "AI からの返答を取得できませんでした。" },
        { status: 502 },
      );
    }

    return NextResponse.json<ChatResponseBody>({
      message: {
        role: "assistant",
        content,
      },
      remembered,
      userProfile: remembered ? profile : undefined,
      newMemoryItems: newMemoryItems.length > 0 ? newMemoryItems : undefined,
      newFollowUpRecalls:
        newFollowUpRecalls.length > 0 ? newFollowUpRecalls : undefined,
      referencedMemoryIds: memoryPrompt?.referencedMemoryIds,
      followUpTopicId: body.followUpTopicId,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "チャットの処理中にエラーが発生しました。";

    console.error("[POST /api/chat]", error);

    return NextResponse.json<ChatErrorResponse>({ error: message }, { status: 500 });
  }
}
