"use client";

import { useEffect, useState } from "react";

import OfflineScreen from "@/components/OfflineScreen";

type OfflineGuardProps = {
  children: React.ReactNode;
};

export default function OfflineGuard({ children }: OfflineGuardProps) {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    function updateOnlineStatus() {
      setIsOffline(!navigator.onLine);
    }

    updateOnlineStatus();
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);

    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  if (isOffline) {
    return <OfflineScreen />;
  }

  return children;
}
