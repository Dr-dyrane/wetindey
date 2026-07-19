"use client";

import React from "react";
import { useProfileSheet, type ProfileSheetProps } from "./hooks/useProfileSheet";
import { ProfileSheetView, Avatar } from "./views/ProfileSheetView";

export { Avatar, type ProfileSheetProps };

export function ProfileSheet(props: ProfileSheetProps) {
  const sheet = useProfileSheet(props);
  return <ProfileSheetView {...props} sheet={sheet} />;
}
