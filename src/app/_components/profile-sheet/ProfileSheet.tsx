"use client";

import React from "react";
import { useProfileSheet, type ProfileSheetProps } from "./hooks/useProfileSheet";
import { ProfileSheetView } from "./views/ProfileSheetView";
import { Avatar } from "./views/Avatar";

export { Avatar, type ProfileSheetProps };

export function ProfileSheet(props: ProfileSheetProps) {
  const sheet = useProfileSheet(props);
  return <ProfileSheetView {...props} sheet={sheet} />;
}
