import { NextResponse } from "next/server";

import {
  buildMemoryBookContext,
  buildMemoryPrompt,
} from "@/lib/din/memory-book-context";
import {
  isDinUserInquiry,
  isEmotionallyLoadedInput,
  maxTokensForIntent,
  resolveConversationStance,
  type ConversationStance,
} from "@/lib/din/conversation-stance";
import {
  hasJournalChatSignal,
  loadJournalChatContext,
} from "@/lib/din/journal-chat-context";
import { parseMemoryFromResponse } from "@/lib/din/memory-marker";
import { getOpenAIClient, getOpenAIModelMini, resolveChatModel } from "@/lib/openai";
import { buildDinSystemPrompt } from "@/lib/prompts/din-system-prompt";
import type {
  ChatErrorResponse,
  ChatMessage,
  ChatRequestBody,
  ChatResponseBody,
} from "@/types/chat";

export const runtime = "nodejs";

function applyJournalAwareStance(
  stance: ConversationStance,
  userInput: string,
  journal: Awaited<ReturnType<typeof loadJournalChatContext>>,
): ConversationStance {
  if (
    stance.intent !== "default" ||
    !hasJournalChatSignal(journal) ||
    !isDinUserInquiry(userInput)
  ) {
    return stance;
  }

  return {
    ...stance,
    intent: "din_inquiry",
    posture: "agree",
    register: "easygoing",
  };
}

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
    const latestUserInput =
      body.messages.filter((message) => message.role === "user").at(-1)?.content ??
      "";
    const { model, mode: modelMode } = requestGreeting
      ? { model: getOpenAIModelMini(), mode: "mini" as const }
      : resolveChatModel(latestUserInput);
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

    const recentUserInputs = body.messages
      .filter((message) => message.role === "user")
      .map((message) => message.content);

    const recentAssistantInputs = body.messages
      .filter((message) => message.role === "assistant")
      .map((message) => message.content);

    const conversationStance = resolveConversationStance(
      latestUserInput,
      sessionContext,
      recentUserInputs,
      recentAssistantInputs,
    );

    const journalChatContext = !requestGreeting
      ? await loadJournalChatContext(body.journalContext)
      : null;

    const effectiveStance = applyJournalAwareStance(
      conversationStance,
      latestUserInput,
      journalChatContext,
    );

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

    const shortReplyMaxTokens = maxTokensForIntent(effectiveStance.intent);

    const defaultTemperature =
      effectiveStance.intent === "default" &&
      isEmotionallyLoadedInput(latestUserInput)
        ? 0.55
        : effectiveStance.register === "easygoing"
          ? 0.72
          : effectiveStance.register === "quiet"
            ? 0.55
            : 0.6;

    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: buildDinSystemPrompt(sessionContext, memoryPrompt?.text, {
            followUpTopic,
            proactiveOpener,
            conversationStance: effectiveStance,
            userInput: latestUserInput,
            journalChatContext,
          }),
        },
        ...completionMessages,
      ],
      temperature: proactiveOpener
        ? 0.75
        : effectiveStance.intent === "comfort_request"
          ? 0.62
          : effectiveStance.intent === "pamper_request"
            ? 0.7
          : effectiveStance.intent === "nap_share"
            ? 0.68
          : effectiveStance.intent === "schedule_share"
            ? 0.67
          : effectiveStance.intent === "return_home_share"
            ? 0.66
          : effectiveStance.intent === "interpersonal_share"
            ? 0.65
          : effectiveStance.intent === "departure_share"
            ? 0.62
          : effectiveStance.intent === "together_invite"
            ? 0.64
          : effectiveStance.intent === "din_inquiry"
            ? 0.66
          : effectiveStance.intent === "care_share"
            ? 0.67
            : effectiveStance.intent === "sleep_share"
              ? 0.58
              : effectiveStance.intent === "daily_share"
              ? 0.69
              : effectiveStance.intent === "companion_suggest"
            ? 0.68
            : effectiveStance.intent === "plan_share"
              ? 0.68
              : effectiveStance.intent === "bond_share"
                ? 0.64
                : effectiveStance.intent === "attend_share"
                  ? 0.65
                  : effectiveStance.intent === "deepen_share"
              ? 0.66
              : effectiveStance.intent === "casual_share"
              ? 0.58
              : effectiveStance.intent === "pushback"
            ? 0.58
            : effectiveStance.intent === "profile_share"
              ? 0.52
              : effectiveStance.intent === "shared_moment"
                ? 0.55
                : modelMode === "research"
                  ? 0.52
                  : defaultTemperature,
      ...(shortReplyMaxTokens !== undefined
        ? { max_tokens: shortReplyMaxTokens }
        : {}),
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
      birthday: "7月7日",
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
      conversationIntent: effectiveStance.intent,
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
