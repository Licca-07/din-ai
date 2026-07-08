"use client";

import { useEffect, useState } from "react";

import JournalBook from "@/components/JournalBook";
import {
  clearAllMemory,
  formatLastConversation,
  loadMemory,
  removeFollowUpTopic,
  removeMemoryItem,
  updateMemory,
} from "@/lib/din/memory";
import {
  buildRecallScoreContext,
  scoreRecallTopic,
} from "@/lib/din/memory-recall";
import {
  sortLongTermMemories,
  sortShortTermMemories,
} from "@/lib/din/memory-priority";
import {
  getRelationshipFromCount,
  getRelationshipLabel,
} from "@/lib/din/session-context";
import type { DinMemory } from "@/types/din-memory";
import type { FollowUpTopic } from "@/types/follow-up";
import type { MemoryItem } from "@/types/memory-item";

type MemoryBookProps = {
  memoryRevision: number;
  journalRevision: number;
  onMemoryChange?: () => void;
};

type MemoryBookSection = "memory" | "journal";

type EditableListProps = {
  label: string;
  items: string[];
  placeholder: string;
  onChange: (items: string[]) => void;
};

function formatMemoryExpiry(expiresAt: string | null): string | null {
  if (!expiresAt) return null;

  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatMemoryCategory(category: string): string | null {
  const labels: Record<string, string> = {
    occupation: "職業",
    hobby: "趣味",
    favorite: "好きなもの",
    general: "一般",
    context: "文脈",
  };

  return labels[category] ?? category;
}

type StoredMemoryListProps = {
  title: string;
  description: string;
  emptyMessage: string;
  items: MemoryItem[];
  showExpiry?: boolean;
  onDelete: (id: string) => void;
};

function StoredMemoryList({
  title,
  description,
  emptyMessage,
  items,
  showExpiry = false,
  onDelete,
}: StoredMemoryListProps) {
  return (
    <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div>
        <h2 className="text-base font-semibold text-emerald-400">
          {title}
          <span className="ml-2 text-sm font-normal text-zinc-500">
            ({items.length}件)
          </span>
        </h2>
        <p className="mt-1 text-sm text-zinc-400">{description}</p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-950/40 px-4 py-3">
          <p className="text-sm text-zinc-500">{emptyMessage}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const categoryLabel = formatMemoryCategory(item.category);
            const expiryLabel = showExpiry
              ? formatMemoryExpiry(item.expiresAt)
              : null;

            return (
              <li
                key={item.id}
                className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="text-sm leading-6 text-zinc-100">{item.content}</p>
                    <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
                      <span className="rounded-full border border-zinc-700 px-2 py-0.5">
                        重要度 {item.importance}/5
                      </span>
                      {categoryLabel && (
                        <span className="rounded-full border border-zinc-700 px-2 py-0.5">
                          {categoryLabel}
                        </span>
                      )}
                      {expiryLabel && (
                        <span className="rounded-full border border-zinc-700 px-2 py-0.5">
                          期限 {expiryLabel}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDelete(item.id)}
                    className="shrink-0 rounded-xl border border-red-500/40 px-3 py-2 text-xs text-red-200 transition hover:bg-red-500/10"
                  >
                    削除
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

type RecallTopicListProps = {
  topics: FollowUpTopic[];
  themeRecurrence: Map<string, number>;
  onDelete: (id: string) => void;
};

function RecallTopicList({ topics, themeRecurrence, onDelete }: RecallTopicListProps) {
  return (
    <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div>
        <h2 className="text-base font-semibold text-emerald-400">
          Recall 話題
          <span className="ml-2 text-sm font-normal text-zinc-500">
            ({topics.length}件)
          </span>
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          Din が続きを気にしている話題。起動時に自然に尋ねる候補。
        </p>
      </div>

      {topics.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-950/40 px-4 py-3">
          <p className="text-sm text-zinc-500">
            まだ Recall 話題はない。会話の中で Din が気になった話題がここに蓄積される。
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {topics.map((topic) => {
            const relatedCount = themeRecurrence.get(topic.id) ?? 0;
            const isOngoing = topic.mentionCount >= 2 || relatedCount >= 1;
            const isUnresolved =
              !topic.lastFollowedUpAt ||
              new Date(topic.lastMentionedAt).getTime() >
                new Date(topic.lastFollowedUpAt).getTime();

            return (
            <li
              key={topic.id}
              className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-sm leading-6 text-zinc-100">{topic.content}</p>
                  <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
                    <span className="rounded-full border border-zinc-700 px-2 py-0.5">
                      言及 {topic.mentionCount}回
                    </span>
                    {relatedCount > 0 && (
                      <span className="rounded-full border border-emerald-500/30 px-2 py-0.5 text-emerald-300">
                        関連 {relatedCount}件
                      </span>
                    )}
                    {isOngoing && (
                      <span className="rounded-full border border-emerald-500/30 px-2 py-0.5 text-emerald-300">
                        継続テーマ
                      </span>
                    )}
                    {isUnresolved ? (
                      <span className="rounded-full border border-amber-500/30 px-2 py-0.5 text-amber-200">
                        未解決
                      </span>
                    ) : (
                      <span className="rounded-full border border-zinc-700 px-2 py-0.5">
                        質問 {topic.askedCount}回
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onDelete(topic.id)}
                  className="shrink-0 rounded-xl border border-red-500/40 px-3 py-2 text-xs text-red-200 transition hover:bg-red-500/10"
                >
                  削除
                </button>
              </div>
            </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function EditableList({
  label,
  items,
  placeholder,
  onChange,
}: EditableListProps) {
  const [draft, setDraft] = useState("");

  function handleAdd() {
    const trimmed = draft.trim();
    if (!trimmed || items.includes(trimmed)) return;

    onChange([...items, trimmed]);
    setDraft("");
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-zinc-300">{label}</p>

      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">未設定</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item, index) => (
            <li key={`${label}-${index}`} className="flex items-center gap-2">
              <input
                type="text"
                value={item}
                onChange={(event) => {
                  const next = [...items];
                  next[index] = event.target.value;
                  onChange(next);
                }}
                className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={() => onChange(items.filter((_, i) => i !== index))}
                className="rounded-xl border border-red-500/40 px-3 py-2 text-xs text-red-200 transition hover:bg-red-500/10"
              >
                削除
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleAdd();
            }
          }}
          placeholder={placeholder}
          className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-emerald-500"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!draft.trim()}
          className="rounded-xl bg-zinc-800 px-4 py-2 text-sm text-zinc-100 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          追加
        </button>
      </div>
    </div>
  );
}

export default function MemoryBook({
  memoryRevision,
  journalRevision,
  onMemoryChange,
}: MemoryBookProps) {
  const [memory, setMemory] = useState<DinMemory | null>(null);
  const [section, setSection] = useState<MemoryBookSection>("memory");

  useEffect(() => {
    setMemory(loadMemory());
  }, [memoryRevision]);

  function persistMemory(updater: (current: DinMemory) => DinMemory) {
    const next = updateMemory(updater);
    setMemory(next);
    onMemoryChange?.();
  }

  function handleDeleteMemoryItem(id: string) {
    removeMemoryItem(id);
    setMemory(loadMemory());
    onMemoryChange?.();
  }

  function handleDeleteRecallTopic(id: string) {
    removeFollowUpTopic(id);
    setMemory(loadMemory());
    onMemoryChange?.();
  }

  function handleClearAll() {
    const confirmed = window.confirm(
      "すべての記憶を削除します。プロフィール、会話回数、チャット履歴が初期化されます。よろしいですか？",
    );

    if (!confirmed) return;

    void clearAllMemory()
      .then(() => {
        setMemory(loadMemory());
        onMemoryChange?.();
      })
      .catch((error) => {
        const message =
          error instanceof Error ? error.message : "記憶の削除に失敗しました。";
        window.alert(message);
      });
  }

  if (!memory) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-950 text-zinc-400">
        読み込み中...
      </div>
    );
  }

  if (section === "journal") {
    return (
      <div className="flex h-full flex-col bg-zinc-950">
        <div className="border-b border-zinc-800 px-4 py-3">
          <div className="mx-auto flex max-w-3xl gap-2">
            <SectionTab
              label="記憶"
              active={false}
              onClick={() => setSection("memory")}
            />
            <SectionTab label="日記" active onClick={() => setSection("journal")} />
          </div>
        </div>
        <div className="min-h-0 flex-1">
          <JournalBook refreshKey={journalRevision} />
        </div>
      </div>
    );
  }

  const relationship = getRelationshipFromCount(memory.conversationCount);
  const longTermMemories = sortLongTermMemories(memory.longTermMemories);
  const shortTermMemories = sortShortTermMemories(memory.shortTermMemories);
  const recallScoreContext = buildRecallScoreContext(memory.followUpTopics);
  const recallTopics = [...memory.followUpTopics].sort(
    (left, right) =>
      scoreRecallTopic(right, recallScoreContext) -
      scoreRecallTopic(left, recallScoreContext),
  );

  return (
    <div className="flex h-full flex-col bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-4 py-4">
        <div className="mx-auto max-w-3xl space-y-3">
          <div className="flex gap-2">
            <SectionTab label="記憶" active onClick={() => setSection("memory")} />
            <SectionTab
              label="日記"
              active={false}
              onClick={() => setSection("journal")}
            />
          </div>
          <div>
            <h1 className="text-lg font-semibold">記憶帳</h1>
            <p className="text-sm text-zinc-400">
              Din がユーザーについて覚えている情報
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6 pb-safe-bottom">
        <div className="mx-auto max-w-3xl space-y-8">
          <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
            <h2 className="text-base font-semibold text-emerald-400">プロフィール</h2>

            <div className="space-y-3">
              <p className="text-sm font-medium text-zinc-300">職業</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={memory.profile.occupation}
                  onChange={(event) =>
                    persistMemory((current) => ({
                      ...current,
                      profile: {
                        ...current.profile,
                        occupation: event.target.value,
                      },
                    }))
                  }
                  placeholder="未設定"
                  className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={() =>
                    persistMemory((current) => ({
                      ...current,
                      profile: {
                        ...current.profile,
                        occupation: "",
                      },
                    }))
                  }
                  className="rounded-xl border border-red-500/40 px-3 py-2 text-xs text-red-200 transition hover:bg-red-500/10"
                >
                  削除
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-zinc-300">誕生日</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={memory.profile.birthday}
                  onChange={(event) =>
                    persistMemory((current) => ({
                      ...current,
                      profile: {
                        ...current.profile,
                        birthday: event.target.value,
                      },
                    }))
                  }
                  placeholder="例: 7月7日"
                  className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={() =>
                    persistMemory((current) => ({
                      ...current,
                      profile: {
                        ...current.profile,
                        birthday: "7月7日",
                      },
                    }))
                  }
                  className="rounded-xl border border-zinc-700 px-3 py-2 text-xs text-zinc-300 transition hover:bg-zinc-900"
                >
                  7/7
                </button>
              </div>
            </div>

            <EditableList
              label="趣味"
              items={memory.profile.hobbies}
              placeholder="趣味を追加"
              onChange={(hobbies) =>
                persistMemory((current) => ({
                  ...current,
                  profile: {
                    ...current.profile,
                    hobbies,
                  },
                }))
              }
            />

            <EditableList
              label="好きなもの"
              items={memory.profile.favoriteFoods}
              placeholder="好きなものを追加"
              onChange={(favoriteFoods) =>
                persistMemory((current) => ({
                  ...current,
                  profile: {
                    ...current.profile,
                    favoriteFoods,
                  },
                }))
              }
            />
          </section>

          <RecallTopicList
            topics={recallTopics}
            themeRecurrence={recallScoreContext.themeRecurrence}
            onDelete={handleDeleteRecallTopic}
          />

          <StoredMemoryList
            title="長期記憶"
            description="会話の中で Din が覚えた内容。重要度の高いものほど返答に優先して使われる。"
            emptyMessage="まだ長期記憶はない。会話を続けると、Din がここに覚えていく。"
            items={longTermMemories}
            onDelete={handleDeleteMemoryItem}
          />

          <StoredMemoryList
            title="一時記憶"
            description="直近の文脈用。通常7日で期限切れになる。"
            emptyMessage="まだ一時記憶はない。"
            items={shortTermMemories}
            showExpiry
            onDelete={handleDeleteMemoryItem}
          />

          <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
            <h2 className="text-base font-semibold text-emerald-400">関係性</h2>

            <div className="space-y-3">
              <p className="text-sm font-medium text-zinc-300">会話回数</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={memory.conversationCount}
                  onChange={(event) => {
                    const parsed = Number.parseInt(event.target.value, 10);
                    persistMemory((current) => ({
                      ...current,
                      conversationCount:
                        Number.isFinite(parsed) && parsed >= 0 ? parsed : 0,
                    }));
                  }}
                  className="w-32 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500"
                />
                <span className="text-sm text-zinc-400">回</span>
                <button
                  type="button"
                  onClick={() =>
                    persistMemory((current) => ({
                      ...current,
                      conversationCount: 0,
                    }))
                  }
                  className="rounded-xl border border-red-500/40 px-3 py-2 text-xs text-red-200 transition hover:bg-red-500/10"
                >
                  削除
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-sm font-medium text-zinc-300">現在の関係性</p>
              <p className="text-sm text-zinc-100">
                {getRelationshipLabel(relationship)}
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-zinc-300">最終会話日時</p>
              <div className="flex items-center gap-2">
                <p className="flex-1 text-sm text-zinc-100">
                  {formatLastConversation(memory.lastConversationAt)}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    persistMemory((current) => ({
                      ...current,
                      lastConversationAt: null,
                    }))
                  }
                  className="rounded-xl border border-red-500/40 px-3 py-2 text-xs text-red-200 transition hover:bg-red-500/10"
                >
                  削除
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-red-500/30 bg-red-500/5 p-5">
            <h2 className="text-base font-semibold text-red-200">全記憶削除</h2>
            <p className="mt-2 text-sm text-zinc-400">
              プロフィール、関係性、チャット履歴をすべて初期状態に戻します。
            </p>
            <button
              type="button"
              onClick={handleClearAll}
              className="mt-4 rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm text-red-200 transition hover:bg-red-500/20"
            >
              全記憶を削除
            </button>
          </section>
        </div>
      </main>
    </div>
  );
}

type SectionTabProps = {
  label: string;
  active: boolean;
  onClick: () => void;
};

function SectionTab({ label, active, onClick }: SectionTabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
        active
          ? "bg-emerald-500 text-zinc-950"
          : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
      }`}
    >
      {label}
    </button>
  );
}
