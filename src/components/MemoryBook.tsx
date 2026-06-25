"use client";

import { useEffect, useState } from "react";

import {
  clearAllMemory,
  formatLastConversation,
  loadMemory,
  updateMemory,
} from "@/lib/din/memory";
import {
  getRelationshipFromCount,
  getRelationshipLabel,
} from "@/lib/din/session-context";
import type { DinMemory } from "@/types/din-memory";

type MemoryBookProps = {
  memoryRevision: number;
  onMemoryChange?: () => void;
};

type EditableListProps = {
  label: string;
  items: string[];
  placeholder: string;
  onChange: (items: string[]) => void;
};

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
  onMemoryChange,
}: MemoryBookProps) {
  const [memory, setMemory] = useState<DinMemory | null>(null);

  useEffect(() => {
    setMemory(loadMemory());
  }, [memoryRevision]);

  function persistMemory(updater: (current: DinMemory) => DinMemory) {
    const next = updateMemory(updater);
    setMemory(next);
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

  const relationship = getRelationshipFromCount(memory.conversationCount);

  return (
    <div className="flex h-full flex-col bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-4 py-4">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-lg font-semibold">記憶帳</h1>
          <p className="text-sm text-zinc-400">
            Din がユーザーについて覚えている情報
          </p>
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
