import { useState, useCallback, useEffect } from "react";
import { apiGet, apiPost, apiPut, apiDelete } from "@/constants/api";

export interface ComboComponent {
  name: string;
  quantity: number;
}

export interface ApiCombo {
  id: number;
  comboId: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  imageKey: string | null;
  components: ComboComponent[];
  available: boolean;
  sortOrder: number;
  createdAt: string;
}

export function useCombos() {
  const [combos, setCombos] = useState<ApiCombo[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await apiGet<ApiCombo[]>("/combos");
      setCombos(rows);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const addCombo = async (data: Omit<ApiCombo, "id" | "comboId" | "createdAt">) => {
    await apiPost("/combos", data);
    await refresh();
  };

  const updateCombo = async (comboId: string, data: Partial<Omit<ApiCombo, "id" | "comboId" | "createdAt">>) => {
    await apiPut(`/combos/${comboId}`, data);
    await refresh();
  };

  const deleteCombo = async (comboId: string) => {
    await apiDelete(`/combos/${comboId}`);
    await refresh();
  };

  return { combos, loading, refresh, addCombo, updateCombo, deleteCombo };
}
