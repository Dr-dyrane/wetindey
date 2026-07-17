"use client";

import React from "react";
import { ChevronRight } from "lucide-react";

interface ListRowProps {
  icon?: React.ReactNode;
  /** Tint behind the icon — pass a status token, never a raw colour. */
  iconTint?: string;
  label: string;
  detail?: string;
  onClick?: () => void;
  /** Renders the row as informational rather than navigational. */
  chevron?: boolean;
  disabled?: boolean;
}

/**
 * iOS inset-grouped list row.
 *
 * Rows separate by fill on press, never by a rule — there are no dividers in
 * this UI. Adjacency and the group's own surface do the work a hairline used to.
 *
 * min-h-tap keeps every row at the 44pt default control size even when its
 * content is shorter, which also means the row grows gracefully rather than
 * clipping when Dynamic Type scales the label.
 */
export function ListRow({ icon, iconTint, label, detail, onClick, chevron = true, disabled }: ListRowProps) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-tap w-full items-center gap-3 px-4 py-2 text-left
                  disabled:opacity-40
                  ${onClick ? "active:bg-fillTertiary transition-colors duration-instant" : ""}`}
    >
      {icon && (
        <span
          className={`grid h-7 w-7 shrink-0 place-items-center squircle ${iconTint ?? "bg-fillTertiary"}`}
        >
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-body text-text-primary">{label}</span>
      {detail && <span className="shrink-0 text-body text-text-secondary">{detail}</span>}
      {onClick && chevron && (
        <ChevronRight className="h-4 w-4 shrink-0 text-text-tertiary" strokeWidth={2.5} />
      )}
    </Tag>
  );
}

/** Inset-grouped section. The header is sentence case — Apple retired the
 *  tracked-out uppercase headers of iOS 6, and nothing here shouts.
 *
 *  Every call site presents inside a ModalSheet, so the group is pinned to the
 *  elevated rung — dark #2C2C2E over the panel's #1C1C1E. In the base ladder
 *  (docked BottomSheet, #000000) it would sit one rung high. */
export function ListGroup({
  header,
  footer,
  children,
}: {
  header?: string;
  footer?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-1.5">
      {header && <h3 className="px-4 text-footnote text-text-secondary">{header}</h3>}
      <div className="mx-4 overflow-hidden bg-surface dark:bg-surface-elevated shadow-card squircle-card">
        {children}
      </div>
      {footer && <p className="px-4 text-caption-1 text-text-secondary">{footer}</p>}
    </section>
  );
}
