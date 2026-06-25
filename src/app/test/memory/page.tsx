"use client";

import { useCallback, useEffect, useState } from "react";

import {
  formatMemorySummary,
  MEMORY_SYNC_TEST_MARKER,
} from "@/lib/din/memory-sync-test";
import {
  flushMemorySync,
  incrementConversationCount,
  initMemory,
  loadMemory,
} from "@/lib/din/memory";

import type { DinMemory } from "@/types/din-memory";

export default function MemorySyncTestPage() {
  const [clientMemory, setClientMemory] = useState<string>("loading...");
  const [remoteMemory, setRemoteMemory] = useState<string>("loading...");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);

    try {
      await initMemory();
      const memory = loadMemory();
      setClientMemory(formatMemorySummary(memory));

      const response = await fetch("/api/memory", { cache: "no-store" });
      const data = (await response.json()) as
        | { exists: boolean; memory: DinMemory }
        | { error: string };

      if (!response.ok) {
        throw new Error("error" in data ? data.error : "API error");
      }

      if (!("memory" in data)) {
        throw new Error("Invalid API response");
      }

      setRemoteMemory(
        `exists=${data.exists}, ${formatMemorySummary(data.memory)}`,
      );
    } catch (refreshError) {
      const message =
        refreshError instanceof Error
          ? refreshError.message
          : "読み込みに失敗しました";
      setError(message);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleIncrement() {
    incrementConversationCount();
    await flushMemorySync();
    await refresh();
  }

  if (process.env.NODE_ENV === "production") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zinc-950 text-zinc-400">
        Not available in production.
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-zinc-950 px-4 py-8 text-zinc-100">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold">Memory Sync Test</h1>
          <p className="text-sm text-zinc-400">
            Mac / iPhone 同期確認用。両方の端末でこのページを開き、Remote
            Memory が一致するか見てください。
          </p>
        </header>

        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <section className="space-y-2 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
          <h2 className="text-sm font-medium text-emerald-400">Client Memory</h2>
          <p className="font-mono text-sm text-zinc-200">{clientMemory}</p>
        </section>

        <section className="space-y-2 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
          <h2 className="text-sm font-medium text-emerald-400">Remote Memory (Supabase)</h2>
          <p className="font-mono text-sm text-zinc-200">{remoteMemory}</p>
        </section>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950"
          >
            再読込
          </button>
          <button
            type="button"
            onClick={handleIncrement}
            className="rounded-xl bg-zinc-800 px-4 py-2 text-sm text-zinc-100"
          >
            会話回数 +1
          </button>
        </div>

        <section className="space-y-2 rounded-2xl border border-zinc-800 p-4 text-sm text-zinc-400">
          <h2 className="font-medium text-zinc-200">確認手順</h2>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              ターミナルで{" "}
              <code className="text-zinc-200">npm run test:memory-sync</code>{" "}
              を実行
            </li>
            <li>Mac でこのページを開いて Remote Memory を確認</li>
            <li>
              iPhone で同じ URL を開き、Remote Memory が一致するか確認
            </li>
            <li>「会話回数 +1」→ 再読込後も保持されるか確認</li>
            <li>
              職業に{" "}
              <code className="text-zinc-200">{MEMORY_SYNC_TEST_MARKER}</code>{" "}
              が含まれていれば CLI テストデータ
            </li>
          </ol>
        </section>
      </div>
    </div>
  );
}
