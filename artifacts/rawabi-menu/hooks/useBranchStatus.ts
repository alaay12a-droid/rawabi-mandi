import { useState, useEffect, useCallback } from "react";
import { apiGet } from "@/constants/api";

export interface BranchStatus {
  isOpen: boolean;
  message: string | null;
}

export function useBranchStatus() {
  const [status, setStatus] = useState<BranchStatus>({ isOpen: true, message: null });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const r = await apiGet<BranchStatus>("/branch-status");
      setStatus(r);
    } catch {
      setStatus({ isOpen: true, message: null });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 60000); // re-check every minute
    return () => clearInterval(id);
  }, [refresh]);

  return { ...status, loading, refresh };
}
