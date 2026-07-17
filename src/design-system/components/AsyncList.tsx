"use client";

import React, { useEffect, useState } from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

import { Button } from "./Button";
import { StatusDot } from "./StatusBadge";
import { ItemCardListSkeleton } from "./Skeleton";

/**
 * Every list in this app has the same four states — loading, empty, error,
 * data — and page.tsx hand-rolled three of them three separate times, with
 * three different empty states and no error state at all. This owns them once.
 *
 * The state it exists to fix is the fifth one nobody named: REFRESHING WHILE
 * DATA IS SHOWN. The old guard was `isPending && items.length === 0`, which is
 * true exactly once — on first load. Change the view inside the sheet and the
 * list is already populated, so the guard is false and you stare at a stale
 * list with no sign anything is happening. Two different situations were being
 * collapsed into one test:
 *
 *   · Refreshing the SAME subject (pull to refresh, revalidate). The rows on
 *     screen are still true. Keep them, mark the region busy, dim it slightly.
 *     Replacing true rows with skeletons here would be a regression.
 *   · Loading a DIFFERENT subject (new area, new query). The rows on screen are
 *     about something else and are now lies. That is a fresh load however full
 *     the list looks, and it must show skeletons.
 *
 * Nothing in `items` distinguishes those. Only the caller knows, and it tells
 * us with `subject` — see below.
 */

/* `AsyncListEmpty` and `AsyncListError` are not exported: every caller passes an
   object literal to the props below and infers them, so nobody has ever needed
   the name. They stay named types because `AsyncListProps` reads better for it. */
interface AsyncListEmpty {
  title: string;
  description?: string;
  /** Optional glyph. Wrapped in a neutral chip here so every empty state matches. */
  icon?: React.ReactNode;
  /** Optional escape hatch, e.g. "Report a price". */
  action?: React.ReactNode;
}

interface AsyncListError {
  title?: string;
  description?: string;
  retryLabel?: string;
}

export interface AsyncListProps<T> {
  /**
   * `undefined` means "never fetched" and renders as loading. An empty array
   * means "fetched, and there is genuinely nothing" and renders as empty. They
   * are not the same claim and must not collapse into `!items?.length`.
   */
  items: T[] | undefined;
  /** A fetch is in flight — initial OR refresh. This component sorts out which. */
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;

  /**
   * What the list is currently ABOUT: an area id, a search query, an item slug.
   * When this changes, whatever is on screen belongs to the previous subject,
   * so the next load is treated as a fresh one and shows skeletons instead of
   * stale rows. This is the whole fix. Omit it only for a list whose subject
   * never changes.
   */
  subject?: React.Key;

  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T, index: number) => React.Key;

  /** Defaults to ItemCardListSkeleton — the shape most lists here hold. */
  skeleton?: React.ReactNode;
  skeletonCount?: number;

  empty: AsyncListEmpty;
  errorState?: AsyncListError;

  /** Rendered under the rows in the data state only (e.g. PhotoCredits). */
  footer?: React.ReactNode;
  /** Applied to the rows container, not the state panels. Defaults to a 8px grid. */
  className?: string;
  /** Announced to screen readers while a refresh is in flight. */
  busyLabel?: string;
}

/** Shared geometry for the empty and error panels. Surface + elevation, no stroke. */
function Panel({ children }: { children: React.ReactNode }) {
  return <div className="squircle-card bg-surface p-5 text-center shadow-card">{children}</div>;
}

export function AsyncList<T>({
  items,
  isLoading = false,
  error = null,
  onRetry,
  subject,
  renderItem,
  keyExtractor,
  skeleton,
  skeletonCount = 4,
  empty,
  errorState,
  footer,
  className,
  busyLabel = "Updating",
}: AsyncListProps<T>) {
  /**
   * Remember the array that belonged to the OLD subject at the moment the
   * subject changed. While the caller is still handing us that same array
   * reference, what is on screen is about the wrong thing, so it does not count
   * as data. The instant a new array arrives the identity check fails on its
   * own and the rows render — no timer, no flash, no second render to wait for.
   *
   * Derived during render, not in an effect: an effect would paint one frame of
   * the wrong list first, which is the artefact this whole file exists to kill.
   */
  const [lastSubject, setLastSubject] = useState(subject);
  const [supersededItems, setSupersededItems] = useState<T[] | undefined>(undefined);

  if (subject !== lastSubject) {
    setLastSubject(subject);
    setSupersededItems(items);
  }

  // If no load ever materialises for the new subject, stop withholding the rows
  // we have rather than showing skeletons forever.
  useEffect(() => {
    if (!isLoading && supersededItems !== undefined) setSupersededItems(undefined);
  }, [isLoading, supersededItems]);

  const isSuperseded = supersededItems !== undefined && supersededItems === items;
  const data = isSuperseded ? undefined : items;
  const hasData = data !== undefined && data.length > 0;

  // 1. Error, with nothing trustworthy to fall back on. The only state that
  //    does not exist in the app today, which is why a failed load currently
  //    reads as "there is no food in Festac".
  if (error && !hasData) {
    return (
      <div role="alert">
        <Panel>
          <div className="flex flex-col items-center gap-2">
            <StatusDot kind="unavailable" />
            <p className="text-subhead font-semibold text-text-primary">
              {errorState?.title ?? "Could not load"}
            </p>
            <p className="text-caption-1 text-text-secondary">
              {errorState?.description ?? error}
            </p>
            {onRetry && (
              <Button variant="secondary" size="sm" onClick={onRetry} className="mt-1 min-h-tap">
                {errorState?.retryLabel ?? "Try again"}
              </Button>
            )}
          </div>
        </Panel>
      </div>
    );
  }

  // 2. Loading with nothing to show — a first load, or a load for a new subject.
  if (!hasData && (isLoading || data === undefined)) {
    return (
      <div role="status" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading</span>
        {skeleton ?? <ItemCardListSkeleton count={skeletonCount} />}
      </div>
    );
  }

  // 3. Settled, and there is genuinely nothing.
  if (!hasData) {
    return (
      <div role="status">
        <Panel>
          <div className="flex flex-col items-center gap-2">
            {empty.icon && (
              <span className="inline-flex squircle-full bg-fillSecondary p-3 text-text-secondary">
                {empty.icon}
              </span>
            )}
            <p className="text-subhead font-semibold text-text-primary">{empty.title}</p>
            {empty.description && (
              <p className="text-caption-1 text-text-secondary">{empty.description}</p>
            )}
            {empty.action}
          </div>
        </Panel>
      </div>
    );
  }

  // 4. Data. Possibly refreshing, possibly with a failed refresh behind it.
  return (
    <div className="space-y-2">
      {/**
       * A refresh that failed while good rows are on screen is not worth
       * destroying them over — the rows are still the best answer we have. Say
       * so above them and offer the retry.
       */}
      {error && (
        <div role="alert" className="squircle bg-status-unavailable-bg px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 text-caption-1 text-status-unavailable-fg">
              {errorState?.title ?? "Could not refresh"}
            </p>
            {onRetry && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRetry}
                className="h-8 shrink-0 px-2 text-caption-1 text-status-unavailable-fg"
              >
                {errorState?.retryLabel ?? "Try again"}
              </Button>
            )}
          </div>
        </div>
      )}

      {/**
       * Refreshing over live data: dim and go inert, do not blank. `aria-busy`
       * is what actually tells a screen reader something is happening — the
       * opacity is only for people who can see it. Opacity, not a spinner over
       * the top: it costs no layout, so nothing moves, and prefers-reduced-motion
       * already collapses the transition in globals.css.
       */}
      <div
        aria-busy={isLoading || undefined}
        className={twMerge(
          clsx("grid grid-cols-1 gap-2 transition-opacity duration-standard ease-decelerate", {
            "pointer-events-none opacity-50": isLoading,
          }),
          className
        )}
      >
        {isLoading && <span className="sr-only">{busyLabel}</span>}
        {data.map((item, i) => (
          <React.Fragment key={keyExtractor(item, i)}>{renderItem(item, i)}</React.Fragment>
        ))}
      </div>

      {footer}
    </div>
  );
}
