const NOTIFICATION_TAG = "din-pomodoro";

export type NotificationSupport = {
  supported: boolean;
  /** iOS ではホーム画面に追加した PWA でのみ通知が使える */
  requiresInstalledPwa: boolean;
  isStandalone: boolean;
};

export function getNotificationSupport(): NotificationSupport {
  if (typeof window === "undefined") {
    return { supported: false, requiresInstalledPwa: false, isStandalone: false };
  }

  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      (navigator as Navigator & { standalone?: boolean }).standalone === true);

  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  return {
    supported: "Notification" in window && "serviceWorker" in navigator,
    requiresInstalledPwa: isIOS,
    isStandalone,
  };
}

export async function getNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) return "denied";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) return "denied";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";

  return Notification.requestPermission();
}

export async function showPomodoroNotification(
  title: string,
  body: string,
): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  if (Notification.permission !== "granted") return;

  const registration = await navigator.serviceWorker.ready;

  await registration.showNotification(title, {
    body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: NOTIFICATION_TAG,
    data: { url: "/" },
  } as NotificationOptions);
}

export async function schedulePomodoroNotification(
  endsAt: number,
  title: string,
  body: string,
): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  if (Notification.permission !== "granted") return;

  const registration = await navigator.serviceWorker.ready;
  const worker =
    registration.active ?? registration.waiting ?? registration.installing;

  worker?.postMessage({
    type: "POMODORO_SCHEDULE",
    endsAt,
    title,
    body,
    tag: NOTIFICATION_TAG,
  });
}

export async function cancelPomodoroNotification(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;

  const registration = await navigator.serviceWorker.ready;
  const worker =
    registration.active ?? registration.waiting ?? registration.installing;

  worker?.postMessage({ type: "POMODORO_CANCEL" });
}
