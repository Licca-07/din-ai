"use client";

import { useEffect, useState } from "react";

import {
  getNotificationPermission,
  getNotificationSupport,
  requestNotificationPermission,
} from "@/lib/notifications/pomodoro-notifications";
import { registerWebPushSubscription } from "@/lib/notifications/push-subscription";
import { PHASE_DURATIONS, PHASE_LABELS } from "@/lib/pomodoro/constants";
import { formatPomodoroTime } from "@/lib/pomodoro/timer-logic";
import { usePomodoroTimer } from "@/lib/pomodoro/use-pomodoro-timer";

export default function PomodoroTimer() {
  const { state, displaySeconds, dinMessage, start, pause, reset, skip } =
    usePomodoroTimer();
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [pushRegistered, setPushRegistered] = useState(false);
  const support = getNotificationSupport();

  useEffect(() => {
    void getNotificationPermission().then(async (result) => {
      setPermission(result);
      if (result === "granted") {
        const registered = await registerWebPushSubscription();
        setPushRegistered(registered);
      }
    });
  }, []);

  const handleEnableNotifications = async () => {
    const result = await requestNotificationPermission();
    setPermission(result);
    if (result === "granted") {
      const registered = await registerWebPushSubscription();
      setPushRegistered(registered);
    }
  };

  const isRunning = state.status === "running";
  const isPaused = state.status === "paused";
  const isIdle = state.status === "idle";
  const phaseTotal = PHASE_DURATIONS[state.phase];
  const progress = 1 - displaySeconds / phaseTotal;

  const showNotificationHint =
    support.supported &&
    permission !== "granted" &&
    (support.requiresInstalledPwa ? support.isStandalone : true);

  const showInstallHint =
    support.requiresInstalledPwa && !support.isStandalone && permission !== "granted";

  return (
    <div className="flex h-full flex-col px-4 pb-safe-bottom pt-4">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="mb-6 text-center">
          <p className="text-sm text-zinc-400">Din と一緒に</p>
          <h1 className="mt-1 text-2xl font-semibold text-zinc-100">ポモドーロ</h1>
        </div>

        {showInstallHint && (
          <div className="mb-4 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
            iPhone で通知を受け取るには、Safari の共有メニューから「ホーム画面に追加」して Din AI を開いてください。
          </div>
        )}

        {showNotificationHint && !showInstallHint && (
          <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            <p>タイマー終了時に通知を送るには、通知を許可してください。</p>
            <button
              type="button"
              onClick={() => void handleEnableNotifications()}
              className="mt-2 rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-zinc-950"
            >
              通知を許可する
            </button>
          </div>
        )}

        {permission === "granted" && support.serverPushAvailable && !pushRegistered && (
          <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            ロック画面への通知はサーバー経由の Push 登録が必要です。もう一度ボタンを押してください。
            <button
              type="button"
              onClick={() => void handleEnableNotifications()}
              className="mt-2 rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-zinc-950"
            >
              Push 通知を登録する
            </button>
          </div>
        )}

        {permission === "denied" && (
          <div className="mb-4 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-300">
            通知がブロックされています。iPhone の設定 → 通知 → Din AI から許可できます。
          </div>
        )}

        <div className="flex flex-1 flex-col items-center justify-center">
          <div className="mb-6 w-full max-w-sm">
            <div className="flex justify-start">
              <div className="max-w-full rounded-2xl bg-zinc-800 px-4 py-3 text-sm leading-6 text-zinc-100">
                <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                  Din
                </p>
                <p>{dinMessage}</p>
              </div>
            </div>
          </div>

          <div className="relative mb-8 flex h-64 w-64 items-center justify-center">
            <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                className="text-zinc-800"
              />
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 45}`}
                strokeDashoffset={`${2 * Math.PI * 45 * (1 - Math.min(progress, 1))}`}
                className={
                  state.phase === "focus" ? "text-emerald-500" : "text-sky-400"
                }
              />
            </svg>

            <div className="text-center">
              <p className="text-sm font-medium text-zinc-400">
                {PHASE_LABELS[state.phase]}
              </p>
              <p className="mt-2 font-mono text-5xl font-semibold tracking-tight text-zinc-50">
                {formatPomodoroTime(displaySeconds)}
              </p>
              <p className="mt-2 text-xs text-zinc-500">
                完了 {state.completedPomodoros} セット
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            {isRunning ? (
              <button
                type="button"
                onClick={() => void pause()}
                className="rounded-xl bg-zinc-800 px-6 py-3 text-sm font-medium text-zinc-100 transition hover:bg-zinc-700"
              >
                一時停止
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void start()}
                className="rounded-xl bg-emerald-500 px-8 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400"
              >
                {isPaused ? "再開" : "スタート"}
              </button>
            )}

            {!isIdle && (
              <button
                type="button"
                onClick={() => void skip()}
                className="rounded-xl bg-zinc-900 px-4 py-3 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800"
              >
                スキップ
              </button>
            )}

            <button
              type="button"
              onClick={() => void reset()}
              className="rounded-xl bg-zinc-900 px-4 py-3 text-sm font-medium text-zinc-400 transition hover:bg-zinc-800"
            >
              リセット
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-xs leading-relaxed text-zinc-400">
          <p>25分集中 → 5分休憩。4セットごとに15分の長い休憩。</p>
          <p className="mt-1">
            画面ロック中も通知を届けるには、ホーム画面に追加したうえで Push 通知を登録してください。
          </p>
        </div>
      </div>
    </div>
  );
}
