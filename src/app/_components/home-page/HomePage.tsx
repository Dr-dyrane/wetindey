"use client";

import React from "react";
import { useHomePage } from "./hooks/useHomePage";
import { HomePageView } from "./views/HomePageView";

/**
 * Orchestrator component for the HomePage.
 * Tethers the useHomePage hook logic to the presentational HomePageView.
 */
export function HomePage() {
  const homePageState = useHomePage();

  return <HomePageView {...homePageState} />;
}
