import { useEffect, useRef, useCallback } from "react";
import { playAppSound } from "@/hooks/useAppSound";

export function useChatSound() {
  const playAlert = useCallback(async () => {
    await playAppSound("message", "/assets/sounds/notification.wav");
  }, []);

  return { playAlert };
}

/**
 * Watches a numeric count and fires playAlert whenever it INCREASES.
 * Ignores the very first value (mount) to avoid spurious alerts on load.
 */
export function useChatUnreadAlert(count: number) {
  const { playAlert } = useChatSound();
  const prevRef     = useRef(count);
  const mountedRef  = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      prevRef.current = count;
      return;
    }
    if (count > prevRef.current) {
      playAlert();
    }
    prevRef.current = count;
  }, [count, playAlert]);
}
