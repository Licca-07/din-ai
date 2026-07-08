"use client";

import { useEffect } from "react";

import { formatJournalDateLabel } from "@/lib/din/journal-date";
import JournalBody from "@/components/JournalBody";
import type { DinJournal } from "@/types/journal";

type TodayJournalSheetProps = {
  open: boolean;
  journalDate: string;
  journal: DinJournal | null;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
};

export default function TodayJournalSheet({
  open,
  journalDate,
  journal,
  isLoading,
  error,
  onClose,
}: TodayJournalSheetProps) {
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label="日記を閉じる"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="today-journal-title"
        className="relative max-h-[min(85dvh,640px)] overflow-hidden rounded-t-3xl border border-zinc-800 bg-zinc-950 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-800 px-5 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-400">
              Din の日記
            </p>
            <h2 id="today-journal-title" className="mt-1 text-lg font-semibold">
              今日の日記
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              {formatJournalDateLabel(journalDate)}（JST）
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition hover:bg-zinc-900"
          >
            閉じる
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5 pb-safe-bottom">
          {isLoading && (
            <p className="text-sm text-zinc-400">日記を読み込み中...</p>
          )}

          {!isLoading && error && (
            <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          {!isLoading && !error && !journal && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 text-sm leading-7 text-zinc-400">
              今日の日記はまだない。会話を続けると、Din が振り返りを書く。
            </div>
          )}

          {!isLoading && !error && journal && <JournalBody journal={journal} />}
        </div>
      </section>
    </div>
  );
}
