"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { generateId } from "@/lib/generate-id";
import {
  addMemoryItems,
  ensureUserProfile,
  loadChatHistory,
  loadMemory,
  loadUserProfile,
  markMemoryItemsReferenced,
  recordFollowUpTopicAsked,
  recordLastConversation,
  recordTopicMentionsFromMessage,
  recordTopicsFromMemoryItems,
  resolveSessionFollowUp,
  saveChatHistory,
  saveUserProfile,
} from "@/lib/din/memory";
import {
  incrementConversationCount,
  syncConversationCountFromHistory,
} from "@/lib/din/conversation-count";
import {
  buildSessionContext,
  recordSessionVisit,
} from "@/lib/din/session-context";
import type { ChatMessage } from "@/types/chat";
import type { StoredChatMessage } from "@/types/din-memory";
import type { MemoryItem } from "@/types/memory-item";
import type { UserProfile } from "@/types/user-profile";

type Message = StoredChatMessage;

type DinReply = {
  content: string;
  remembered: boolean;
  userProfile?: UserProfile;
  newMemoryItems?: MemoryItem[];
  referencedMemoryIds?: string[];
};

async function requestDinReply(body: {
  messages: ChatMessage[];
  requestGreeting?: boolean;
  userProfile: UserProfile;
  followUpTopic?: string;
  followUpTopicId?: string;
}): Promise<DinReply> {
  const sessionContext = buildSessionContext({
    isGreeting: body.requestGreeting ?? false,
  });
  const memory = loadMemory();

  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: body.messages,
      sessionContext,
      userProfile: body.userProfile,
      longTermMemories: memory.longTermMemories,
      shortTermMemories: memory.shortTermMemories,
      requestGreeting: body.requestGreeting,
      followUpTopic: body.followUpTopic,
      followUpTopicId: body.followUpTopicId,
    }),
  });

  const data = (await response.json()) as
    | {
        message: ChatMessage;
        remembered?: boolean;
        userProfile?: UserProfile;
        newMemoryItems?: MemoryItem[];
        referencedMemoryIds?: string[];
        followUpTopicId?: string;
      }
    | { error: string };

  if (!response.ok) {
    const errorMessage =
      "error" in data ? data.error : "返答の取得に失敗しました。";
    throw new Error(errorMessage);
  }

  if (!("message" in data)) {
    throw new Error("返答の形式が正しくありません。");
  }

  if (data.referencedMemoryIds?.length) {
    markMemoryItemsReferenced(data.referencedMemoryIds);
  }

  if (data.newMemoryItems?.length) {
    addMemoryItems(data.newMemoryItems);
    recordTopicsFromMemoryItems(data.newMemoryItems);
  }

  if (data.followUpTopicId) {
    recordFollowUpTopicAsked(data.followUpTopicId);
  }

  return {
    content: data.message.content,
    remembered: data.remembered === true,
    userProfile: data.userProfile,
    newMemoryItems: data.newMemoryItems,
    referencedMemoryIds: data.referencedMemoryIds,
  };
}

async function requestOpeningMessage(profile: UserProfile): Promise<DinReply> {
  const followUp = resolveSessionFollowUp();

  return requestDinReply({
    messages: [],
    requestGreeting: true,
    userProfile: profile,
    followUpTopic: followUp?.content,
    followUpTopicId: followUp?.id,
  });
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping, error]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setIsBootstrapping(true);
      setError(null);

      const profile = ensureUserProfile();
      setUserProfile(profile);

      const savedMessages = loadChatHistory();

      if (savedMessages.length > 0) {
        if (cancelled) return;

        const userMessageCount = savedMessages.filter(
          (message) => message.role === "user",
        ).length;
        syncConversationCountFromHistory(userMessageCount);

        const followUp = resolveSessionFollowUp();

        if (followUp) {
          try {
            const followUpReply = await requestDinReply({
              messages: [],
              requestGreeting: true,
              userProfile: profile,
              followUpTopic: followUp.content,
              followUpTopicId: followUp.id,
            });

            if (cancelled) return;

            setMessages([
              ...savedMessages,
              {
                id: generateId(),
                role: "assistant",
                content: followUpReply.content,
              },
            ]);
          } catch {
            setMessages(savedMessages);
          }
        } else {
          setMessages(savedMessages);
        }

        recordSessionVisit();
        setIsBootstrapping(false);
        return;
      }

      try {
        const greeting = await requestOpeningMessage(profile);

        if (cancelled) return;

        setMessages([
          {
            id: generateId(),
            role: "assistant",
            content: greeting.content,
          },
        ]);
        recordSessionVisit();
      } catch (bootstrapError) {
        if (cancelled) return;

        const message =
          bootstrapError instanceof Error
            ? bootstrapError.message
            : "挨拶の取得に失敗しました。";
        setError(message);
        setMessages([
          {
            id: "fallback",
            role: "assistant",
            content: "戻ったか。",
          },
        ]);
      } finally {
        if (!cancelled) {
          setIsBootstrapping(false);
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isBootstrapping || messages.length === 0) return;
    saveChatHistory(messages);
  }, [messages, isBootstrapping]);

  async function sendMessage() {
    const trimmed = input.trim();
    const profile = userProfile ?? loadUserProfile() ?? ensureUserProfile();
    if (!trimmed || isTyping || isBootstrapping) return;

    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content: trimmed,
    };

    incrementConversationCount();
    recordTopicMentionsFromMessage(trimmed);

    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setIsTyping(true);
    setError(null);

    try {
      const history = nextMessages.map(({ role, content }) => ({ role, content }));
      const reply = await requestDinReply({
        messages: history,
        userProfile: profile,
      });

      if (reply.userProfile) {
        saveUserProfile(reply.userProfile);
        setUserProfile(reply.userProfile);
      }

      const assistantMessage: Message = {
        id: generateId(),
        role: "assistant",
        content: reply.content,
        remembered: reply.remembered,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      recordLastConversation();
      setInput("");
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "通信中にエラーが発生しました。";
      setError(message);
    } finally {
      setIsTyping(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendMessage();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing) return;

    if (event.key === "Enter" && event.metaKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  return (
    <div className="flex h-full flex-col bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-4 py-4">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-sm font-bold text-zinc-950">
            D
          </div>
          <div>
            <h1 className="text-lg font-semibold">Din AI</h1>
            <p className="text-sm text-zinc-400">OpenAI API 接続済み</p>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {isBootstrapping && messages.length === 0 && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-zinc-800 px-4 py-3 text-sm text-zinc-400">
                待機中...
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 whitespace-pre-wrap ${
                  message.role === "user"
                    ? "bg-emerald-600 text-white"
                    : "bg-zinc-800 text-zinc-100"
                }`}
              >
                {message.content}
                {message.role === "assistant" && message.remembered && (
                  <p className="mt-2 text-xs text-emerald-400">✔︎記憶した</p>
                )}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-zinc-800 px-4 py-3 text-sm text-zinc-400">
                待機中...
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </main>

      <footer className="border-t border-zinc-800 px-4 pt-4 pb-safe-bottom">
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex max-w-3xl items-end gap-3"
        >
          <label htmlFor="message" className="sr-only">
            メッセージ
          </label>
          <textarea
            ref={inputRef}
            id="message"
            rows={1}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="メッセージを入力..."
            disabled={isBootstrapping}
            className="max-h-40 min-h-[48px] flex-1 resize-none rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-emerald-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping || isBootstrapping}
            className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            送信
          </button>
        </form>
      </footer>
    </div>
  );
}
