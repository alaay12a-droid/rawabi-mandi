import { useState, useCallback } from "react";
import { apiGet } from "@/constants/api";

export interface ApiBanner {
  id: number;
  bannerId: string;
  imageUrl: string;
  imageKey: string | null;
  title: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: string;
}

export function useBanners() {
  const [banners, setBanners] = useState<ApiBanner[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<ApiBanner[]>("/banners");
      setBanners(data);
    } catch {
      setBanners([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return { banners, loading, refresh };
}
