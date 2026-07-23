import React from "react";
import Image from "next/image";

/**
 * Lives in its own module, not ProfileSheetView: the always-visible sheet
 * header renders the avatar on every boot, and importing it through the
 * profile sheet would drag the whole sheet subtree back into the first-load
 * bundle that the code split just removed it from.
 */
export function Avatar({ name, url, size = 32 }: { name?: string; url?: string | null; size?: number }) {
  const initials = (name ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <span
      aria-hidden
      className="relative grid shrink-0 place-items-center squircle-full bg-fillPrimary text-text-primary overflow-hidden"
      style={{ width: size, height: size }}
    >
      {url ? (
        <Image
          src={url}
          alt={name ?? "Avatar"}
          fill
          sizes={`${size}px`}
          className="object-cover"
        />
      ) : initials ? (
        <span className="text-subhead font-semibold">{initials}</span>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" className="h-1/2 w-1/2" aria-hidden>
          <circle cx="12" cy="8" r="3.5" fill="currentColor" opacity="0.55" />
          <path d="M4.5 20a7.5 7.5 0 0 1 15 0" fill="currentColor" opacity="0.55" />
        </svg>
      )}
    </span>
  );
}
