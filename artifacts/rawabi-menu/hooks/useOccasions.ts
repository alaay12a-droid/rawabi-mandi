import { useState, useEffect, useCallback } from "react";
import { apiGet } from "@/constants/api";

export interface ApiOccasion {
  id: number;
  occasionId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  imageKey: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: string;
}

export function useOccasions() {
  const [occasions, setOccasions] = useState<ApiOccasion[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await apiGet<ApiOccasion[]>("/occasions");
      setOccasions(data.filter((o) => o.active));
    } catch {
      /* keep previous */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { occasions, loading, refresh };
}
