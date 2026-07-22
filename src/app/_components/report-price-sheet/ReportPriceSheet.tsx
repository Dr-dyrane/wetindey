"use client";

import React from "react";
import { useReportPriceSheet } from "./hooks/useReportPriceSheet";
import { ReportPriceSheetView, type ReportPriceSheetProps } from "./views/ReportPriceSheetView";

export function ReportPriceSheet(props: ReportPriceSheetProps) {
  const sheet = useReportPriceSheet({ itemId: props.itemId, variants: props.variants });
  return <ReportPriceSheetView {...props} sheet={sheet} />;
}
