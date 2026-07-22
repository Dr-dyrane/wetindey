"use client";

import React from "react";
import { useCurrencyFlag } from "./hooks/useCurrencyFlag";
import { CurrencyFlagView } from "./views/CurrencyFlagView";
import type { ReferenceCurrencyCode } from "@/app/_data/reference-currencies";

export interface CurrencyFlagProps {
  code: ReferenceCurrencyCode | "NGN" | string;
  className?: string;
}

export function CurrencyFlag(props: CurrencyFlagProps) {
  const sheet = useCurrencyFlag({ code: props.code });
  return <CurrencyFlagView {...props} sheet={sheet} />;
}
