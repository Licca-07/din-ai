import type { DinJournal } from "@/types/journal";

type JournalBodyProps = {
  journal: Pick<DinJournal, "content" | "margin">;
};

export default function JournalBody({ journal }: JournalBodyProps) {
  return (
    <div className="space-y-5">
      <div className="whitespace-pre-wrap text-sm leading-7 text-zinc-100">
        {journal.content}
      </div>

      {journal.margin && (
        <aside className="border-t border-zinc-800/80 pt-4">
          <p className="text-[11px] font-medium tracking-wide text-zinc-500">
            余白
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-zinc-400">
            {journal.margin}
          </p>
        </aside>
      )}
    </div>
  );
}
