"use client";

import { useCallback, useEffect, useState } from "react";

import Chat from "@/components/Chat";
import MemoryBook from "@/components/MemoryBook";
import { initMemory, getLastMemorySyncError } from "@/lib/din/memory";
import type { DinMemoryTab } from "@/types/din-memory";

const tabs: { id: DinMemoryTab; label: string }[] = [
  { id: "chat", label: "チャット" },
  { id: "memory", label: "記憶" },
];

export default function DinApp() {
  const [activeTab, setActiveTab] = useState<DinMemoryTab>("chat");
  const [memoryRevision, setMemoryRevision] = useState(0);
  const [journalRevision, setJournalRevision] = useState(0);
  const [memoryReady, setMemoryReady] = useState(false);
  const [syncWarning, setSyncWarning] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void initMemory()
      .then(() => {
        if (!cancelled) {
          setMemoryReady(true);
          setSyncWarning(getLastMemorySyncError());
        }
      })
      .catch((error) => {
        if (!cancelled) {
          const message =
            error instanceof Error
              ? error.message
              : "記憶の読み込みに失敗しました。";
          setSyncWarning(message);
          setMemoryReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleMemoryChange = useCallback(() => {
    setMemoryRevision((value) => value + 1);
  }, []);

  const handleJournalUpdated = useCallback(() => {
    setJournalRevision((value) => value + 1);
  }, []);

  if (!memoryReady) {
    return (
      <div className="flex h-dvh items-center justify-center bg-zinc-950 px-4 pb-safe-bottom pt-safe-top text-zinc-400">
        記憶を読み込み中...
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-zinc-950">
      <header className="shrink-0 border-b border-zinc-800 px-4 pt-safe-top pb-3">
        {syncWarning && (
          <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-center text-sm text-amber-100">
            クラウド同期に失敗しました。ローカルの記憶で続行しています。{syncWarning}
          </div>
        )}
        <nav>
          <div className="mx-auto flex max-w-3xl gap-2">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                    isActive
                      ? "bg-emerald-500 text-zinc-950"
                      : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      <div className="min-h-0 flex-1">
        {activeTab === "chat" ? (
          <Chat
            key={memoryRevision}
            onJournalUpdated={handleJournalUpdated}
          />
        ) : (
          <MemoryBook
            memoryRevision={memoryRevision}
            journalRevision={journalRevision}
            onMemoryChange={handleMemoryChange}
          />
        )}
      </div>
    </div>
  );
}
