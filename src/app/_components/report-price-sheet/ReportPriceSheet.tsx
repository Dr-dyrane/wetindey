"use client";

import React from "react";
import { submitObservation } from "@/app/_actions/report-actions";
import { useReportPriceSheet } from "./hooks/useReportPriceSheet";
import { ReportPriceSheetView, type ReportPriceSheetProps } from "./views/ReportPriceSheetView";

export function ReportPriceSheet(props: ReportPriceSheetProps) {
  const sheet = useReportPriceSheet({
    itemId: props.itemId,
    variantId: props.variantId,
    variants: props.variants,
    onPlaceId: props.onPlaceId,
    onItemId: props.onItemId,
    onVariantId: props.onVariantId,
    onUnitId: props.onUnitId,
    onPrice: props.onPrice,
    onAvailable: props.onAvailable,
    submitObservation,
  });

  return (
    <ReportPriceSheetView
      {...props}
      onClose={sheet.dismiss(props.onClose)}
      onPlaceId={sheet.onPlaceId}
      onItemId={sheet.onItemId}
      onVariantId={sheet.onVariantId}
      onUnitId={sheet.onUnitId}
      onPrice={sheet.onPrice}
      onAvailable={sheet.onAvailable}
      sheet={sheet}
    />
  );
}
