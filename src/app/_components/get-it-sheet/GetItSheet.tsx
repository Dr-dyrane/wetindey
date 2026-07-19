"use client";

import React from "react";
import { useGetItSheet, type GetItSheetProps, type GetItTarget, type GetItOffer } from "./hooks/useGetItSheet";
import { GetItSheetView } from "./views/GetItSheetView";

export { type GetItSheetProps, type GetItTarget, type GetItOffer };

export function GetItSheet(props: GetItSheetProps) {
  const sheet = useGetItSheet(props);
  return <GetItSheetView {...props} sheet={sheet} />;
}
