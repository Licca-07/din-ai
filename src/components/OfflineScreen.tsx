"use client";

type OfflineScreenProps = {
  onRetry?: () => void;
};

export default function OfflineScreen({ onRetry }: OfflineScreenProps) {
  function handleRetry() {
    if (onRetry) {
      onRetry();
      return;
    }

    window.location.reload();
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-zinc-950 px-6 pb-safe-bottom pt-safe-top text-zinc-100">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-2xl font-bold text-zinc-950">
          D
        </div>
        <h1 className="text-xl font-semibold">通信できない</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          ネットワークに接続できません。接続を確認してから、もう一度お試しください。
        </p>
        <button
          type="button"
          onClick={handleRetry}
          className="mt-6 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400"
        >
          再試行
        </button>
      </div>
    </div>
  );
}
