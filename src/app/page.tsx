"use client";

import React from "react";
import { HomePage } from "./_components/home-page/HomePage";

/**
 * Root Controller Component for the WetinDey Application.
 * Routes directly to the modular HomePage orchestrator under components/home-page/
 */
export default function page() {
  return <HomePage />;
}
