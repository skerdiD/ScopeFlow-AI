import { useCallback, useEffect, useState } from "react";
import { ACTIVITY_STORAGE_KEY, loadActivityEvents, type ActivityEvent } from "@/lib/activity";

export function useActivity() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setEvents(loadActivityEvents());
  }, []);

  useEffect(() => {
    refresh();
    setLoading(false);
  }, [refresh]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key === ACTIVITY_STORAGE_KEY) {
        refresh();
      }
    };

    const onFocus = () => {
      refresh();
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  return {
    events,
    loading,
    refresh
  };
}
