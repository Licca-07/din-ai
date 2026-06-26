"use client";

import { FormEvent, Fragment, useEffect, useMemo, useRef, useState } from "react";
import { generateId } from "@/lib/generate-id";
import {
  createChatMessageTimestamp,
  formatChatDateDividerLabel,
  formatMessageClockTime,
  shouldShowChatDateDivider,
} from "@/lib/din/chat-message-time";
import {
  addMemoryItems,
  addFollowUpRecalls,
  ensureUserProfile,
  loadChatHistory,
  loadMemory,
  loadUserProfile,
  markMemoryItemsReferenced,
  recordFollowUpTopicAsked,
  recordLastConversation,
  recordTopicMentionsFromMessage,
  recordTopicsFromMemoryItems,
  recordAppOpened,
  recordStartupGreetingShown,
  resolveStartupGreeting,
  recordProactiveOpenerUsed,
  saveChatHistory,
  saveUserProfile,
} from "@/lib/din/memory";
import {
  incrementConversationCount,
  syncConversationCountFromHistory,
} from "@/lib/din/conversation-count";
import { getJournalDateJst } from "@/lib/din/journal-date";
import {
  ensureDailyJournal,
} from "@/lib/din/journal-client";
import { revealAssistantBubbles } from "@/lib/din/chat-bubble-reveal";
import type { ProactiveOpener } from "@/lib/din/proactive-opener";
import { buildSessionContext } from "@/lib/din/session-context";
import TodayJournalSheet from "@/components/TodayJournalSheet";
import type { ChatMessage } from "@/types/chat";
import type { StoredChatMessage } from "@/types/din-memory";
import type { DinJournal } from "@/types/journal";
import type { FollowUpRecallInput } from "@/types/follow-up";
import type { MemoryItem } from "@/types/memory-item";
import type { UserProfile } from "@/types/user-profile";

type Message = StoredChatMessage;

type DinReply = {
  content: string;
  remembered: boolean;
  userProfile?: UserProfile;
  newMemoryItems?: MemoryItem[];
  newFollowUpRecalls?: FollowUpRecallInput[];
  referencedMemoryIds?: string[];
};

async function requestDinReply(body: {
  messages: ChatMessage[];
  requestGreeting?: boolean;
  userProfile: UserProfile;
  followUpTopic?: string;
  followUpTopicId?: string;
  proactiveOpener?: ProactiveOpener;
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
      proactiveOpener: body.proactiveOpener,
    }),
  });

  const data = (await response.json()) as
    | {
        message: ChatMessage;
        remembered?: boolean;
        userProfile?: UserProfile;
        newMemoryItems?: MemoryItem[];
        newFollowUpRecalls?: FollowUpRecallInput[];
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

  if (data.newFollowUpRecalls?.length) {
    addFollowUpRecalls(data.newFollowUpRecalls);
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
  return requestDinReply({
    messages: [],
    requestGreeting: true,
    userProfile: profile,
  });
}

async function requestStartupProactiveMessage(
  profile: UserProfile,
  proactiveOpener: ProactiveOpener,
): Promise<DinReply> {
  return requestDinReply({
    messages: [],
    requestGreeting: true,
    userProfile: profile,
    proactiveOpener,
    followUpTopicId: proactiveOpener.followUpTopicId,
  });
}

export default function Chat({
  onJournalUpdated,
}: {
  onJournalUpdated?: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [todayJournal, setTodayJournal] = useState<DinJournal | null>(null);
  const [todayJournalDate, setTodayJournalDate] = useState(getJournalDateJst());
  const [isJournalLoading, setIsJournalLoading] = useState(false);
  const [journalError, setJournalError] = useState<string | null>(null);
  const [isJournalOpen, setIsJournalOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const onJournalUpdatedRef = useRef(onJournalUpdated);
  onJournalUpdatedRef.current = onJournalUpdated;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping, error]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setIsBootstrapping(true);
      setError(null);
      setIsJournalLoading(true);
      setJournalError(null);

      try {
        const today = await ensureDailyJournal(() => {
          onJournalUpdatedRef.current?.();
        });

        if (cancelled) return;

        setTodayJournalDate(today.journalDate);
        setTodayJournal(today.journal);
      } catch (journalError) {
        if (cancelled) return;

        const message =
          journalError instanceof Error
            ? journalError.message
            : "日記の取得に失敗しました。";
        setJournalError(message);
      } finally {
        if (!cancelled) {
          setIsJournalLoading(false);
        }
      }

      const profile = ensureUserProfile();
      setUserProfile(profile);

      const savedMessages = loadChatHistory();

      if (savedMessages.length > 0) {
        if (cancelled) return;

        const userMessageCount = savedMessages.filter(
          (message) => message.role === "user",
        ).length;
        syncConversationCountFromHistory(userMessageCount);
        setMessages(savedMessages);

        const greetingDecision = resolveStartupGreeting(loadMemory());

        if (greetingDecision?.mode === "fixed") {
          try {
            setIsTyping(true);
            await revealAssistantBubbles(greetingDecision.message, {
              onTypingChange: setIsTyping,
              appendMessage: (message) => {
                if (cancelled) return;
                setMessages((prev) => [...prev, message]);
              },
              shouldCancel: () => cancelled,
            });

            if (!cancelled) {
              recordStartupGreetingShown(greetingDecision.message);
            }
          } catch {
            // 固定メッセージ表示のみ。失敗しても履歴はそのまま。
          } finally {
            if (!cancelled) {
              setIsTyping(false);
            }
          }
        } else if (greetingDecision?.mode === "llm") {
          try {
            setIsTyping(true);
            const proactiveReply = await requestStartupProactiveMessage(
              profile,
              greetingDecision.opener,
            );

            if (cancelled) return;

            recordProactiveOpenerUsed(greetingDecision.opener);
            recordStartupGreetingShown(proactiveReply.content);

            await revealAssistantBubbles(proactiveReply.content, {
              remembered: proactiveReply.remembered,
              onTypingChange: setIsTyping,
              appendMessage: (message) => {
                if (cancelled) return;
                setMessages((prev) => [...prev, message]);
              },
              shouldCancel: () => cancelled,
            });
          } catch {
            // API 失敗時は履歴のみ表示。
          } finally {
            if (!cancelled) {
              setIsTyping(false);
            }
          }
        }

        recordAppOpened();
        setIsBootstrapping(false);
        return;
      }

      try {
        setIsTyping(true);
        const greeting = await requestOpeningMessage(profile);

        if (cancelled) return;

        await revealAssistantBubbles(greeting.content, {
          remembered: greeting.remembered,
          onTypingChange: setIsTyping,
          appendMessage: (message) => {
            if (cancelled) return;
            setMessages((prev) => [...prev, message]);
          },
          shouldCancel: () => cancelled,
        });
        recordStartupGreetingShown(greeting.content);
        recordAppOpened();
      } catch (bootstrapError) {
        if (cancelled) return;

        const message =
          bootstrapError instanceof Error
            ? bootstrapError.message
            : "挨拶の取得に失敗しました。";
        setError(message);
        await revealAssistantBubbles("戻ったか。", {
          onTypingChange: setIsTyping,
          appendMessage: (assistantMessage) => {
            if (cancelled) return;
            setMessages((prev) => [...prev, assistantMessage]);
          },
          shouldCancel: () => cancelled,
        });
      } finally {
        if (!cancelled) {
          setIsTyping(false);
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
      createdAt: createChatMessageTimestamp(),
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

      await revealAssistantBubbles(reply.content, {
        remembered: reply.remembered,
        onTypingChange: setIsTyping,
        appendMessage: (message) => {
          setMessages((prev) => [...prev, message]);
        },
      });

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

  function openJournalSheet() {
    setIsJournalOpen(true);
  }

  const journalPreview = todayJournal?.content
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 96);

  const messageRows = useMemo(
    () =>
      messages.map((message, index) => ({
        message,
        showDateDivider: shouldShowChatDateDivider(messages, index),
        dateLabel: formatChatDateDividerLabel(message.createdAt),
        clockTime: formatMessageClockTime(message.createdAt),
      })),
    [messages],
  );

  return (
    <div className="flex h-full flex-col bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-4 py-4">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-sm font-bold text-zinc-950">
            D
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold">Din AI</h1>
            <p className="text-sm text-zinc-400">OpenAI API 接続済み</p>
          </div>
          <button
            type="button"
            onClick={openJournalSheet}
            className="shrink-0 rounded-xl border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-200 transition hover:border-emerald-500/60 hover:bg-zinc-900"
          >
            日記
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {!isBootstrapping && todayJournal && (
            <button
              type="button"
              onClick={openJournalSheet}
              className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-left transition hover:border-emerald-500/40 hover:bg-emerald-500/15"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium text-emerald-400">今日の日記</p>
                <span className="text-xs text-zinc-400">開く</span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-100">
                {journalPreview}
                {todayJournal.content.length > 96 ? "…" : ""}
              </p>
            </button>
          )}

          {!isBootstrapping && !isJournalLoading && !todayJournal && !journalError && (
            <button
              type="button"
              onClick={openJournalSheet}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-left text-sm text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-300"
            >
              今日の日記はまだない。タップして確認する。
            </button>
          )}
          {isBootstrapping && messages.length === 0 && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-zinc-800 px-4 py-3 text-sm text-zinc-400">
                待機中...
              </div>
            </div>
          )}

          {messageRows.map(({ message, showDateDivider, dateLabel, clockTime }) => (
            <Fragment key={message.id}>
              {showDateDivider && (
                <div
                  className="flex items-center gap-3 py-1"
                  role="separator"
                  aria-label={dateLabel}
                >
                  <div className="h-px flex-1 bg-zinc-800" />
                  <span className="text-xs text-zinc-500">{dateLabel}</span>
                  <div className="h-px flex-1 bg-zinc-800" />
                </div>
              )}
              <div
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
                  <time
                    dateTime={message.createdAt}
                    className={`mt-1 block text-right text-[10px] leading-none ${
                      message.role === "user"
                        ? "text-emerald-100/70"
                        : "text-zinc-500"
                    }`}
                  >
                    {clockTime}
                  </time>
                </div>
              </div>
            </Fragment>
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
            disabled={isBootstrapping || isTyping}
            className="text-ios-input max-h-40 min-h-[48px] flex-1 resize-none rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 leading-6 text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-emerald-500 disabled:opacity-50"
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

      <TodayJournalSheet
        open={isJournalOpen}
        journalDate={todayJournalDate}
        journal={todayJournal}
        isLoading={isJournalLoading}
        error={journalError}
        onClose={() => setIsJournalOpen(false)}
      />
    </div>
  );
}
