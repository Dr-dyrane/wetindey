"use client";

import React from "react";
import { useHomePage } from "./useHomePage";
import { HomePageView } from "./HomePageView";

/**
 * Root Controller Component for the WetinDey Application.
 *
 * It invokes the useHomePage logic hook to acquire the application state,
 * hooks, and handlers, and passes them directly to the HomePageView component
 * to separate state logic from the render tree.
 */
export default function HomePage() {
  const homePageState = useHomePage();

  return <HomePageView {...homePageState} />;
}
