import { PHASE_DURATIONS, PHASE_LABELS } from "@/lib/pomodoro/constants";
import { formatPomodoroTime } from "@/lib/pomodoro/timer-logic";
import type { PomodoroPhase } from "@/types/pomodoro";

const SILENT_AUDIO_URL = "/audio/silence.mp3";

let audioElement: HTMLAudioElement | null = null;
let activePhase: PomodoroPhase | null = null;
let totalSeconds = 0;
let handlersInstalled = false;

function isMediaSessionSupported(): boolean {
  return typeof navigator !== "undefined" && "mediaSession" in navigator;
}

function getOrCreateAudio(): HTMLAudioElement {
  if (!audioElement) {
    audioElement = new Audio(SILENT_AUDIO_URL);
    audioElement.loop = true;
    audioElement.volume = 0.01;
    audioElement.preload = "auto";
    audioElement.setAttribute("playsinline", "true");
  }

  return audioElement;
}

async function playSilentAudio(): Promise<void> {
  const audio = getOrCreateAudio();

  try {
    await audio.play();
  } catch {
    // iOS may reject without a recent user gesture.
  }
}

function pauseSilentAudio(): void {
  audioElement?.pause();
}

function stopSilentAudio(): void {
  if (!audioElement) return;

  audioElement.pause();
  audioElement.currentTime = 0;
}

function setMetadata(phase: PomodoroPhase, remainingSeconds: number): void {
  if (!isMediaSessionSupported()) return;

  const label = PHASE_LABELS[phase];
  const remaining = formatPomodoroTime(remainingSeconds);

  navigator.mediaSession.metadata = new MediaMetadata({
    title: `残り ${remaining}`,
    artist: `Din — ${label}`,
    album: "ポモドーロ",
    artwork: [
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
  });
}

function setPositionState(remainingSeconds: number): void {
  if (!isMediaSessionSupported() || !navigator.mediaSession.setPositionState) {
    return;
  }

  const elapsed = Math.max(0, totalSeconds - remainingSeconds);

  try {
    navigator.mediaSession.setPositionState({
      duration: totalSeconds,
      playbackRate: 1,
      position: elapsed,
    });
  } catch {
    // iOS may reject some position updates.
  }
}

export function setupPomodoroMediaSessionHandlers(
  onPause: () => void,
  onPlay: () => void,
): void {
  if (!isMediaSessionSupported() || handlersInstalled) return;

  handlersInstalled = true;

  try {
    navigator.mediaSession.setActionHandler("pause", () => {
      navigator.mediaSession.playbackState = "paused";
      onPause();
    });

    navigator.mediaSession.setActionHandler("play", () => {
      navigator.mediaSession.playbackState = "playing";
      onPlay();
    });

    navigator.mediaSession.setActionHandler("previoustrack", null);
    navigator.mediaSession.setActionHandler("nexttrack", null);
    navigator.mediaSession.setActionHandler("seekbackward", null);
    navigator.mediaSession.setActionHandler("seekforward", null);
  } catch {
    handlersInstalled = false;
  }
}

export async function startPomodoroMediaSession(
  phase: PomodoroPhase,
  remainingSeconds: number,
): Promise<void> {
  activePhase = phase;
  totalSeconds = PHASE_DURATIONS[phase];

  await playSilentAudio();

  if (isMediaSessionSupported()) {
    navigator.mediaSession.playbackState = "playing";
  }

  setMetadata(phase, remainingSeconds);
  setPositionState(remainingSeconds);
}

export function updatePomodoroMediaSession(remainingSeconds: number): void {
  if (!activePhase) return;

  setMetadata(activePhase, remainingSeconds);
  setPositionState(remainingSeconds);
}

export async function resumePomodoroMediaSession(
  phase: PomodoroPhase,
  remainingSeconds: number,
): Promise<void> {
  activePhase = phase;
  totalSeconds = PHASE_DURATIONS[phase];

  await playSilentAudio();

  if (isMediaSessionSupported()) {
    navigator.mediaSession.playbackState = "playing";
  }

  setMetadata(phase, remainingSeconds);
  setPositionState(remainingSeconds);
}

export function pausePomodoroMediaSession(remainingSeconds: number): void {
  pauseSilentAudio();

  if (isMediaSessionSupported()) {
    navigator.mediaSession.playbackState = "paused";
  }

  if (activePhase) {
    setMetadata(activePhase, remainingSeconds);
    setPositionState(remainingSeconds);
  }
}

export function stopPomodoroMediaSession(): void {
  stopSilentAudio();
  activePhase = null;
  totalSeconds = 0;

  if (!isMediaSessionSupported()) return;

  navigator.mediaSession.playbackState = "none";

  try {
    navigator.mediaSession.metadata = null;
  } catch {
    // noop
  }
}

export function isPomodoroMediaSessionSupported(): boolean {
  return isMediaSessionSupported();
}
