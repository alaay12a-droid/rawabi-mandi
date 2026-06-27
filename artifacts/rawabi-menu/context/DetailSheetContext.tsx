import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import { MenuItem } from "@/constants/menu";
import { ProductDetailSheet } from "@/components/ProductDetailSheet";

type DetailItem = MenuItem & { available?: boolean; nameEn?: string; descriptionEn?: string };

interface DetailSheetContextType {
  openDetail: (item: DetailItem) => void;
}

const DetailSheetContext = createContext<DetailSheetContextType | undefined>(undefined);

export function DetailSheetProvider({ children }: { children: React.ReactNode }) {
  const [selectedItem, setSelectedItem] = useState<DetailItem | null>(null);

  const openDetail = useCallback((item: DetailItem) => {
    setSelectedItem(item);
  }, []);

  const closeDetail = useCallback(() => {
    setSelectedItem(null);
  }, []);

  const value = useMemo(() => ({ openDetail }), [openDetail]);

  return (
    <DetailSheetContext.Provider value={value}>
      {children}
      <ProductDetailSheet
        item={selectedItem}
        visible={selectedItem !== null}
        onClose={closeDetail}
      />
    </DetailSheetContext.Provider>
  );
}

export function useDetailSheet(): DetailSheetContextType {
  const ctx = useContext(DetailSheetContext);
  if (!ctx) throw new Error("useDetailSheet must be used within DetailSheetProvider");
  return ctx;
}
