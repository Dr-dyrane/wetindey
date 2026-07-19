"use client";

import React from "react";
import { useExchangePanel, type ExchangePanelProps, type ExchangeLocationFilter } from "./hooks/useExchangePanel";
import { ExchangePanelView } from "./views/ExchangePanelView";

export { type ExchangePanelProps, type ExchangeLocationFilter };

export function ExchangePanel(props: ExchangePanelProps) {
  const panel = useExchangePanel(props);
  return <ExchangePanelView {...props} panel={panel} />;
}
