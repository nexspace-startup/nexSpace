// src/hooks/useTick.ts
import { useEffect, useRef, useState } from "react";

export function useTick(enabled: boolean, intervalMs = 1000): number {
  const [tick, setTick] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    // stop current timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (!enabled) return;

    // start a new one
    timerRef.current = window.setInterval(() => {
      setTick((t) => t + 1);
    }, intervalMs);

    // cleanup
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabled, intervalMs]);

  return tick;
}
