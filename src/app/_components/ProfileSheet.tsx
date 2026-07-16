"use client";

import React from "react";
import { Settings, Flag, Bookmark, MapPin, TrendingUp, CircleHelp } from "lucide-react";
import { ModalSheet } from "@/design-system/components/ModalSheet";
import { ListRow, ListGroup } from "@/design-system/components/ListRow";

interface ProfileSheetProps {
  open: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  /**
   * Present the location sheet. Required, not optional: this row used to carry a
   * no-op `onClick` and a hardcoded `detail="Festac"`, so it looked navigational,
   * pressed like a button, and went nowhere. A required prop is what stops that
   * being expressible again.
   */
  onChangeArea: () => void;
  /**
   * What the location actually is, from `useLocationChrome().label`. Never the
   * literal "Festac" — this row and the map pill must not be able to disagree
   * about where the user is standing.
   */
  currentAreaName: string;
  /** Null until auth exists — the sheet is deliberately useful while signed out. */
  user?: { name: string; handle?: string; reportCount?: number } | null;
}

/**
 * Mini profile, in the shape Apple Maps uses for its account sheet.
 *
 * This is the app's navigation hub. WetinDey is a map-first product, so it has
 * no tab bar and no page chrome to hang navigation off — the avatar is the one
 * persistent affordance, and everything that isn't "search the map" lives
 * behind it.
 *
 * Rows that have no destination yet are rendered disabled rather than hidden.
 * That is deliberate: it shows the shape of the product without pretending the
 * routes exist, and it stops us shipping a dead link.
 */
export function ProfileSheet({
  open,
  onClose,
  onOpenSettings,
  onChangeArea,
  currentAreaName,
  user,
}: ProfileSheetProps) {
  const signedIn = Boolean(user);

  return (
    <ModalSheet open={open} onClose={onClose} title={signedIn ? "Account" : "You"} size="form">
      <div className="space-y-6 py-3">
        {/* Identity */}
        <div className="flex items-center gap-3 px-4">
          <Avatar name={user?.name} size={56} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-title-3 font-semibold text-text-primary">
              {user?.name ?? "Sign in to WetinDey"}
            </p>
            <p className="truncate text-subhead text-text-secondary">
              {signedIn
                ? `${user?.reportCount ?? 0} price${user?.reportCount === 1 ? "" : "s"} reported`
                : "Save markets and track your reports"}
            </p>
          </div>
        </div>

        <ListGroup>
          <ListRow
            icon={<TrendingUp className="h-4 w-4 text-status-info-fg" />}
            iconTint="bg-status-info-bg"
            label="My reports"
            detail={signedIn ? String(user?.reportCount ?? 0) : undefined}
            disabled={!signedIn}
            onClick={() => {}}
          />
          <ListRow
            icon={<Bookmark className="h-4 w-4 text-status-caution-fg" />}
            iconTint="bg-status-caution-bg"
            label="Saved markets"
            disabled={!signedIn}
            onClick={() => {}}
          />
          {/* The one row here that has always had somewhere to go. It is a peer
              of the map's location pill — same store, same label — so reaching
              it from the navigation hub and from the map lands on one sheet. */}
          <ListRow
            icon={<MapPin className="h-4 w-4 text-status-confirmed-fg" />}
            iconTint="bg-status-confirmed-bg"
            label="Change area"
            detail={currentAreaName}
            onClick={() => {
              // Dismiss first, like Settings below: two stacked sheets would
              // bury this one behind the next with no way back to it.
              onClose();
              onChangeArea();
            }}
          />
        </ListGroup>

        <ListGroup>
          <ListRow
            icon={<Settings className="h-4 w-4 text-text-secondary" />}
            label="Settings"
            onClick={() => {
              onClose();
              onOpenSettings();
            }}
          />
          <ListRow
            icon={<Flag className="h-4 w-4 text-text-secondary" />}
            label="Report a problem"
            disabled
            onClick={() => {}}
          />
          <ListRow
            icon={<CircleHelp className="h-4 w-4 text-text-secondary" />}
            label="About WetinDey"
            disabled
            onClick={() => {}}
          />
        </ListGroup>
      </div>
    </ModalSheet>
  );
}

/**
 * Avatar. Initials on a fill until there is auth and a real image.
 * Uses accent/accent-contrast rather than a literal, so it inverts with theme
 * instead of going white-on-white.
 */
export function Avatar({ name, size = 32 }: { name?: string; size?: number }) {
  const initials = (name ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center squircle-full bg-fillPrimary text-text-primary"
      style={{ width: size, height: size }}
    >
      {initials ? (
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
