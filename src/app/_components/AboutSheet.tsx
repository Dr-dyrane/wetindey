"use client";

import React, { useEffect, useState } from "react";
import { ScrollText, ShieldCheck, LifeBuoy, Info, Mail, ChevronRight } from "lucide-react";
import { ModalSheet } from "@/design-system/components/ModalSheet";
import { NavigationStack } from "@/design-system/components/NavigationStack";
import { ListGroup } from "@/design-system/components/ListRow";
import { useT } from "@/core/i18n";

/**
 * The one address the owner supplied, verbatim (support@wetindey.live), and the
 * single source of truth for it. It is a fact only the owner can supply, so it
 * is a constant here rather than a translatable string — and it feeds both the
 * Support surface's mail link and the Privacy surface's deletion line, so the
 * two can never drift.
 */
const SUPPORT_EMAIL = "support@wetindey.live";

/**
 * The three surfaces that hang off About, addressable by name.
 *
 * `null` is the hub itself. A string union rather than three booleans so the
 * pushed level is always exactly one thing. Not exported: nothing outside this
 * file selects a surface — the hub does, and it does it through `onSelect`.
 */
type AboutPage = "terms" | "privacy" | "support";

interface AboutSheetProps {
  open: boolean;
  onClose: () => void;
}

/**
 * About — the product's own account of itself, and the three surfaces the App
 * Store and an honest app both need: Terms of service, Privacy, Support.
 *
 * WHY ONE SHEET, NOT FOUR STACKED MODALS. The owner asked for "separate modals",
 * and these ARE separate surfaces — but stacking a modal per surface is the exact
 * pattern this app already paid to undo (task #13). They are levels of one
 * hierarchy (About → a sub-page), which is navigation, so they push on a single
 * `NavigationStack` the way LocationSheet pushes an LGA. One sheet, one backdrop,
 * one back affordance, and the hub stays underneath the whole time.
 *
 * WHY THE LEGAL COPY CARRIES A VISIBLE DRAFT MARKER. Terms and Privacy are drafted
 * from what the code demonstrably does — nothing invented, no warranties, no
 * governing law, because an agent may not write those. `about.draft_notice` says
 * so in the UI, on each drafted surface, because a privacy notice that a user
 * trusts while it misdescribes what is collected is worse than none. The owner
 * must have it reviewed before it is relied on.
 */
export function AboutSheet({ open, onClose }: AboutSheetProps) {
  const t = useT();

  /** Which sub-surface is pushed. `null` is the hub, where every present lands. */
  const [page, setPage] = useState<AboutPage | null>(null);

  /**
   * A dismissed sheet returns to the hub. Without this, closing while reading
   * Privacy and reopening would drop you back onto Privacy — the panel is
   * unmounted while closed, so nothing flickers on screen; this only resets the
   * level the next present starts from.
   */
  useEffect(() => {
    if (!open) setPage(null);
  }, [open]);

  const detailTitle: string | undefined =
    page === "terms"
      ? t("about.terms_title")
      : page === "privacy"
        ? t("about.privacy_title")
        : page === "support"
          ? t("about.support_title")
          : undefined;

  return (
    <ModalSheet open={open} onClose={onClose} title={t("profile.about")} size="page">
      <NavigationStack
        listNode={<AboutHub onSelect={setPage} />}
        detailNode={page ? <AboutDetail page={page} /> : undefined}
        detailLabel={detailTitle}
        onDetailBack={() => setPage(null)}
        backLabel={t("about.back")}
      />
    </ModalSheet>
  );
}

/**
 * Level 0 — what the app is, then the way into each surface.
 *
 * The prose is the honest core of this whole build: this product's one claim is
 * that every price carries evidence of how fresh it is and who saw it, and About
 * is where that is said plainly. It brings its own scroller because
 * NavigationStack's root is a fixed-size, overflow-hidden host and only pads and
 * scrolls level 1.
 */
function AboutHub({ onSelect }: { onSelect: (page: AboutPage) => void }) {
  const t = useT();
  return (
    <div className="h-full overflow-y-auto overscroll-contain space-y-6 py-3">
      <div className="space-y-3 px-4">
        <p className="text-body text-text-primary">{t("about.lede")}</p>
        <p className="text-subhead leading-relaxed text-text-secondary">{t("about.body_what")}</p>
        <p className="text-subhead leading-relaxed text-text-secondary">{t("about.body_prices")}</p>
        <p className="text-subhead leading-relaxed text-text-secondary">{t("about.body_account")}</p>
        <p className="text-subhead leading-relaxed text-text-secondary">{t("about.body_pilot")}</p>
      </div>

      <ListGroup>
        <AboutRow
          icon={<ScrollText className="h-4 w-4 text-text-secondary" />}
          label={t("about.terms")}
          onClick={() => onSelect("terms")}
        />
        <AboutRow
          icon={<ShieldCheck className="h-4 w-4 text-text-secondary" />}
          label={t("about.privacy")}
          onClick={() => onSelect("privacy")}
        />
        <AboutRow
          icon={<LifeBuoy className="h-4 w-4 text-text-secondary" />}
          label={t("about.support")}
          onClick={() => onSelect("support")}
        />
      </ListGroup>
    </div>
  );
}

/**
 * A hub row. This is `ListRow`'s exact shape, hand-rolled for one reason: these
 * push a level on the SAME sheet, and `ListRow`'s chevron is the right caret for
 * that. It stays a peer of ProfileSheet's own rows — 44pt tap target, fill on
 * press, no divider, no border — so the two sheets read as one system.
 */
function AboutRow({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-tap w-full items-center gap-3 px-4 py-2 text-left
                 active:bg-fillTertiary transition-colors duration-instant"
    >
      <span className="grid h-7 w-7 shrink-0 place-items-center squircle bg-fillTertiary">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate text-body text-text-primary">{label}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-text-tertiary" strokeWidth={2.5} />
    </button>
  );
}

/** Level 1 — the selected surface. NavigationStack already gives this level its
 *  padding, scroller and back row, so it renders prose directly. */
function AboutDetail({ page }: { page: AboutPage }) {
  if (page === "terms") return <TermsPage />;
  if (page === "privacy") return <PrivacyPage />;
  return <SupportPage />;
}

/**
 * The review marker. A caution-tinted callout, so it can never be read as part of
 * the copy it guards. Present on every DRAFTED legal surface (Terms, Privacy) and
 * absent from Support, which invents nothing — it is one real email address.
 */
function DraftNotice() {
  const t = useT();
  return (
    <div className="flex gap-2.5 squircle-card bg-status-caution-bg p-4">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-status-caution-fg" aria-hidden />
      <p className="text-footnote leading-relaxed text-text-secondary">{t("about.draft_notice")}</p>
    </div>
  );
}

function PageHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-title-3 font-semibold text-text-primary">{children}</h2>;
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return <p className="text-subhead leading-relaxed text-text-secondary">{children}</p>;
}

function TermsPage() {
  const t = useT();
  return (
    <div className="space-y-4">
      <PageHeading>{t("about.terms_title")}</PageHeading>
      <DraftNotice />
      <Paragraph>{t("about.terms_intro")}</Paragraph>
      <Paragraph>{t("about.terms_prices")}</Paragraph>
      <Paragraph>{t("about.terms_fulfilment")}</Paragraph>
      <Paragraph>{t("about.terms_reporting")}</Paragraph>
    </div>
  );
}

function PrivacyPage() {
  const t = useT();
  return (
    <div className="space-y-4">
      <PageHeading>{t("about.privacy_title")}</PageHeading>
      <DraftNotice />
      <Paragraph>{t("about.privacy_intro")}</Paragraph>
      <Paragraph>{t("about.privacy_collect")}</Paragraph>
      <Paragraph>{t("about.privacy_device")}</Paragraph>
      <Paragraph>{t("about.privacy_third")}</Paragraph>
      <Paragraph>{t("about.privacy_ads")}</Paragraph>
      <Paragraph>{t("about.privacy_delete", { email: SUPPORT_EMAIL })}</Paragraph>
    </div>
  );
}

function SupportPage() {
  const t = useT();
  return (
    <div className="space-y-4">
      <PageHeading>{t("about.support_title")}</PageHeading>
      <Paragraph>{t("about.support_body")}</Paragraph>

      {/* A real mailto, not a button that fakes one: long-press copies it, it
          survives with JS asleep, and it is the honest minimum the owner asked
          for — no phone number, no address, no response-time promise invented
          around it. Its own surface on the elevated rung, so it sits on the sheet
          rather than sinking into it in dark. */}
      <a
        href={`mailto:${SUPPORT_EMAIL}`}
        className="flex items-center gap-3 squircle-card bg-surface px-4 py-3 shadow-card
                   transition-colors duration-instant active:bg-fillTertiary dark:bg-surface-elevated"
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center squircle bg-status-info-bg">
          <Mail className="h-4 w-4 text-status-info-fg" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-body text-accent">{t("about.support_cta")}</span>
          <span className="block truncate text-footnote text-text-secondary">{SUPPORT_EMAIL}</span>
        </span>
      </a>
    </div>
  );
}
