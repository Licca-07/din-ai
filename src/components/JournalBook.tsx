"use client";

import { useEffect, useRef, useState } from "react";

import { formatJournalDateLabel } from "@/lib/din/journal-date";
import { fetchAllJournals } from "@/lib/din/journal-client";
import type { DinJournal } from "@/types/journal";

type JournalBookProps = {
  refreshKey: number;
};

export default function JournalBook({ refreshKey }: JournalBookProps) {
  const [journals, setJournals] = useState<DinJournal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadedRevisionRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const force =
      loadedRevisionRef.current === null ||
      loadedRevisionRef.current !== refreshKey;
    loadedRevisionRef.current = refreshKey;

    async function loadJournals() {
      setIsLoading(true);
      setError(null);

      try {
        const nextJournals = await fetchAllJournals({ force });

        if (!cancelled) {
          setJournals(nextJournals);
        }
      } catch (loadError) {
        if (!cancelled) {
          const message =
            loadError instanceof Error
              ? loadError.message
              : "日記の取得に失敗しました。";
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadJournals();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-950 text-zinc-400">
        日記を読み込み中...
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-4 py-4">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-lg font-semibold">日記</h1>
          <p className="text-sm text-zinc-400">Din が書いた日々の振り返り</p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6 pb-safe-bottom">
        <div className="mx-auto max-w-3xl space-y-6">
          {error && (
            <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          {!error && journals.length === 0 && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 text-sm text-zinc-400">
              まだ日記はない。会話を続けると、Din が日記を書く。
            </div>
          )}

          {journals.map((journal) => (
            <article
              key={journal.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5"
            >
              <time
                dateTime={journal.journalDate}
                className="block text-sm font-medium text-emerald-400"
              >
                {formatJournalDateLabel(journal.journalDate)}
              </time>
              <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-zinc-100">
                {journal.content}
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
