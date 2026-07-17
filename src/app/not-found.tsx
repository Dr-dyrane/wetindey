"use client";

import { useRouter } from "next/navigation";
import { MapPinOff } from "lucide-react";

/**
 * Custom 404 page.
 *
 * Without this file, any request to a path other than `/` rendered Next's own
 * default — an unstyled white page reading "404 | This page could not be
 * found." Entirely correct, entirely off-brand. One route is all this app has;
 * anything else is a mistype or a stale link, and the only honest answer is to
 * send them to the map.
 *
 * Voice matches the error boundaries: Nigerian English, not formal.
 */
export default function NotFound() {
  const router = useRouter();

  return (
    <div className="grid min-h-screen place-items-center bg-background p-6">
      <div className="flex w-full max-w-[360px] flex-col items-center gap-4 squircle-lg bg-surface px-6 py-7 text-center shadow-card">
        <span className="grid h-11 w-11 place-items-center squircle-full bg-fillTertiary text-text-tertiary">
          <MapPinOff className="h-5 w-5" />
        </span>

        <div>
          <h1 className="text-title-3 font-semibold text-text-primary">
            Nothing dey here
          </h1>
          <p className="mt-1.5 text-subhead text-text-secondary">
            This page no exist. WetinDey get only one page — the map — and na
            there everything dey.
          </p>
        </div>

        <button
          onClick={() => router.push("/")}
          className="flex min-h-tap w-full items-center justify-center squircle bg-accent px-4 text-headline text-accent-contrast transition-opacity duration-micro ease-decelerate active:opacity-80"
        >
          Go to the map
        </button>
      </div>
    </div>
  );
}
