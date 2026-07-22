export interface Option {
  id: string;
  name: string;
}

export interface UseReportPriceSheetProps {
  itemId: string;
  variants: { id: string; itemId: string; displayName: string }[];
}

export function useReportPriceSheet({ itemId, variants }: UseReportPriceSheetProps) {
  const variantsForItem = variants.filter((v) => v.itemId === itemId);
  return {
    variantsForItem,
  };
}
